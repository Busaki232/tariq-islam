import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ActivityScore = {
  user_id: string;
  active_days: number;
  knowledge_points: number;
  community_points: number;
  mosque_points: number;
  total_points: number;
  eligible: boolean;
  disqualification_reason: string | null;
};

type Candidate = {
  id: string;
  user_id: string;
  badge_slug: string;
  rank: number;
  score: number;
  status: string;
};

const currentMonthStart = () => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");
};

export function MonthlyBadgeCandidatesPanel() {
  const { toast } = useToast();
  const [monthStart, setMonthStart] =
    useState(currentMonthStart);
  const [scores, setScores] = useState<ActivityScore[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [profileNames, setProfileNames] =
    useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [reviewingId, setReviewingId] =
    useState<string | null>(null);

  const monthValue = useMemo(
    () => monthStart.slice(0, 7),
    [monthStart]
  );

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [scoresResult, candidatesResult] =
        await Promise.all([
          supabase
            .from("monthly_activity_scores")
            .select(
              "user_id,active_days,knowledge_points,community_points,mosque_points,total_points,eligible,disqualification_reason"
            )
            .eq("month_start", monthStart)
            .order("total_points", { ascending: false })
            .limit(25),
          supabase
            .from("monthly_badge_candidates")
            .select(
              "id,user_id,badge_slug,rank,score,status"
            )
            .eq("month_start", monthStart)
            .order("rank", { ascending: true }),
        ]);

      if (scoresResult.error) throw scoresResult.error;
      if (candidatesResult.error) {
        throw candidatesResult.error;
      }

      const nextScores =
        (scoresResult.data || []) as ActivityScore[];
      const nextCandidates =
        (candidatesResult.data || []) as Candidate[];

      setScores(nextScores);
      setCandidates(nextCandidates);

      const userIds = Array.from(
        new Set([
          ...nextScores.map((item) => item.user_id),
          ...nextCandidates.map((item) => item.user_id),
        ])
      );

      if (userIds.length === 0) {
        setProfileNames({});
        return;
      }

      const { data: profiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("user_id,full_name,username")
          .in("user_id", userIds);

      if (profilesError) throw profilesError;

      setProfileNames(
        Object.fromEntries(
          (profiles || []).map((profile) => [
            profile.user_id,
            profile.full_name ||
              profile.username ||
              "Unnamed User",
          ])
        )
      );
    } catch (error: any) {
      console.error(
        "[MonthlyBadgeCandidatesPanel] load failed:",
        error
      );

      toast({
        title: "Unable to load monthly scores",
        description:
          error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [monthStart, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const calculate = async () => {
    setCalculating(true);

    try {
      const { data, error } = await supabase.rpc(
        "calculate_monthly_badge_scores",
        {
          p_month_start: monthStart,
        }
      );

      if (error) throw error;

      toast({
        title: "Monthly scores calculated",
        description: `${data ?? 0} user score(s) processed.`,
      });

      await load();
    } catch (error: any) {
      console.error(
        "[MonthlyBadgeCandidatesPanel] calculation failed:",
        error
      );

      toast({
        title: "Calculation failed",
        description:
          error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const review = async (
    candidateId: string,
    approve: boolean
  ) => {
    setReviewingId(candidateId);

    try {
      const { error } = await supabase.rpc(
        "review_monthly_badge_candidate",
        {
          p_candidate_id: candidateId,
          p_approve: approve,
        }
      );

      if (error) throw error;

      toast({
        title: approve
          ? "Winner approved"
          : "Candidate rejected",
        description: approve
          ? "The Member of the Month badge was awarded."
          : "The candidate was not awarded the badge.",
      });

      await load();
    } catch (error: any) {
      console.error(
        "[MonthlyBadgeCandidatesPanel] review failed:",
        error
      );

      toast({
        title: "Review failed",
        description:
          error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Monthly Badge Rankings
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground">
              Scores are calculated from verified activity with
              daily anti-abuse limits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={monthValue}
              onChange={(event) =>
                setMonthStart(`${event.target.value}-01`)
              }
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => void calculate()}
              disabled={calculating}
            >
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Calculate
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section>
              <h3 className="mb-3 font-semibold">
                Leaderboard
              </h3>

              {scores.length === 0 ? (
                <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                  No activity scores are available for this month.
                </p>
              ) : (
                <div className="space-y-2">
                  {scores.map((score, index) => (
                    <div
                      key={score.user_id}
                      className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            #{index + 1}{" "}
                            {profileNames[score.user_id] ||
                              "Unnamed User"}
                          </span>

                          <Badge
                            variant={
                              score.eligible
                                ? "default"
                                : "outline"
                            }
                          >
                            {score.eligible
                              ? "Eligible"
                              : "Not eligible"}
                          </Badge>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {score.active_days} active days ·{" "}
                          {score.knowledge_points} knowledge ·{" "}
                          {score.community_points} community ·{" "}
                          {score.mosque_points} mosque
                        </p>

                        {score.disqualification_reason && (
                          <p className="mt-1 text-xs text-amber-700">
                            {score.disqualification_reason}
                          </p>
                        )}
                      </div>

                      <div className="text-lg font-bold text-primary">
                        {score.total_points} points
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 font-semibold">
                Member of the Month Candidates
              </h3>

              {candidates.length === 0 ? (
                <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                  No user has reached the 10-day eligibility
                  requirement yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-amber-500 text-white">
                            Rank #{candidate.rank}
                          </Badge>

                          <span className="font-semibold">
                            {profileNames[candidate.user_id] ||
                              "Unnamed User"}
                          </span>

                          <Badge variant="outline">
                            {candidate.status}
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {candidate.score} points
                        </p>
                      </div>

                      {candidate.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void review(candidate.id, true)
                            }
                            disabled={
                              reviewingId === candidate.id
                            }
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              void review(candidate.id, false)
                            }
                            disabled={
                              reviewingId === candidate.id
                            }
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
