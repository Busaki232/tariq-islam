import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Award,
  Check,
  Loader2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserAchievementBadge, {
  type UserAchievementBadgeData,
} from "@/components/tariq/UserAchievementBadge";

type BadgeRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  color_scheme: string;
  category: string;
  sort_order: number;
};

type AwardRecord = {
  id: string;
  badge_id: string;
  reason: string | null;
  awarded_at: string;
  award_key: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

export function ManageBadgesDialog({
  open,
  onOpenChange,
  user,
}: Props) {
  const { toast } = useToast();

  const [badges, setBadges] = useState<
    BadgeRecord[]
  >([]);
  const [awards, setAwards] = useState<
    AwardRecord[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [changingSlug, setChangingSlug] =
    useState<string | null>(null);
  const [reason, setReason] = useState("");

  const loadBadges = useCallback(async () => {
    setLoading(true);

    try {
      const [badgeResult, awardResult] =
        await Promise.all([
          supabase
            .from("badges")
            .select(
              "id,slug,name,description,icon_key,color_scheme,category,sort_order"
            )
            .eq("is_active", true)
            .order("sort_order", {
              ascending: true,
            }),
          supabase
            .from("user_badges")
            .select(
              "id,badge_id,reason,awarded_at,award_key"
            )
            .eq("user_id", user.id),
        ]);

      if (badgeResult.error) {
        throw badgeResult.error;
      }

      if (awardResult.error) {
        throw awardResult.error;
      }

      setBadges(
        (badgeResult.data ?? []) as BadgeRecord[]
      );

      setAwards(
        (awardResult.data ?? []) as AwardRecord[]
      );
    } catch (error) {
      console.error(
        "Unable to load user badges:",
        error
      );

      toast({
        title: "Unable to load badges",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user.id]);

  useEffect(() => {
    if (!open) return;

    void loadBadges();
  }, [loadBadges, open]);

  const handleAward = async (
    badge: BadgeRecord
  ) => {
    setChangingSlug(badge.slug);

    try {
      const { error } = await supabase.rpc(
        "award_user_badge",
        {
          p_user_id: user.id,
          p_badge_slug: badge.slug,
          p_reason: reason.trim() || null,
          p_award_key: "permanent",
        }
      );

      if (error) {
        throw error;
      }

      setReason("");
      await loadBadges();

      toast({
        title: `${badge.name} awarded`,
        description:
          "The badge now appears on the user’s profile.",
      });
    } catch (error) {
      console.error(
        "Unable to award badge:",
        error
      );

      toast({
        title: "Unable to award badge",
        variant: "destructive",
      });
    } finally {
      setChangingSlug(null);
    }
  };

  const handleRevoke = async (
    badge: BadgeRecord
  ) => {
    const confirmed = window.confirm(
      `Remove ${badge.name} from this user?`
    );

    if (!confirmed) return;

    setChangingSlug(badge.slug);

    try {
      const { error } = await supabase.rpc(
        "revoke_user_badge",
        {
          p_user_id: user.id,
          p_badge_slug: badge.slug,
          p_award_key: "permanent",
        }
      );

      if (error) {
        throw error;
      }

      await loadBadges();

      toast({
        title: `${badge.name} removed`,
      });
    } catch (error) {
      console.error(
        "Unable to remove badge:",
        error
      );

      toast({
        title: "Unable to remove badge",
        variant: "destructive",
      });
    } finally {
      setChangingSlug(null);
    }
  };

  const displayName =
    user.profile?.full_name ||
    user.email ||
    "this user";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Manage Badges
          </DialogTitle>

          <DialogDescription>
            Award or remove achievement badges for{" "}
            {displayName}.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label
            htmlFor="badge-award-reason"
            className="text-sm font-medium"
          >
            Award reason, optional
          </label>

          <input
            id="badge-award-reason"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            placeholder="Example: Outstanding community contribution"
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {badges.map((badge) => {
              const award = awards.find(
                (item) =>
                  item.badge_id === badge.id &&
                  item.award_key === "permanent"
              );

              const changing =
                changingSlug === badge.slug;

              const displayBadge: UserAchievementBadgeData =
                {
                  awardId:
                    award?.id ?? badge.id,
                  slug: badge.slug,
                  name: badge.name,
                  description:
                    badge.description,
                  iconKey: badge.icon_key,
                  colorScheme:
                    badge.color_scheme,
                  category: badge.category,
                  awardedAt:
                    award?.awarded_at ??
                    new Date().toISOString(),
                  reason:
                    award?.reason ?? null,
                  sortOrder:
                    badge.sort_order,
                };

              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl border p-4 ${
                    award
                      ? "border-green-500/40 bg-green-500/5"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <UserAchievementBadge
                        badge={displayBadge}
                      />

                      <p className="mt-2 text-sm text-muted-foreground">
                        {badge.description}
                      </p>

                      {award?.reason && (
                        <p className="mt-2 text-xs font-medium text-primary">
                          Reason: {award.reason}
                        </p>
                      )}
                    </div>

                    {award ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={changing}
                        onClick={() =>
                          void handleRevoke(badge)
                        }
                        className="shrink-0"
                      >
                        {changing ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <X className="mr-1 h-4 w-4" />
                        )}
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={changing}
                        onClick={() =>
                          void handleAward(badge)
                        }
                        className="shrink-0"
                      >
                        {changing ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-4 w-4" />
                        )}
                        Award
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
