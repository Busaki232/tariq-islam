import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  MessageCircle,
  Building2,
  Sparkles,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OnboardingStep = {
  key: string;
  icon: typeof Sparkles;
  action?: "ibadah";
};

const USER_STEPS: OnboardingStep[] = [
  { key: "welcome", icon: Sparkles },
  { key: "ibadah", icon: Compass, action: "ibadah" },
  { key: "reflections", icon: Video },
  { key: "scholars", icon: BookOpen },
  { key: "mosques", icon: Building2 },
  { key: "ai", icon: Bot },
  { key: "community", icon: MessageCircle },
];

const SCHOLAR_STEPS: OnboardingStep[] = [
  { key: "scholarWelcome", icon: Sparkles },
  { key: "ibadah", icon: Compass, action: "ibadah" },
  { key: "scholarProfile", icon: BookOpen },
  { key: "scholarLectures", icon: Video },
  { key: "scholarCaptions", icon: Bot },
  { key: "scholarReview", icon: CheckCircle2 },
  { key: "scholarManage", icon: BookOpen },
  { key: "ai", icon: Bot },
];

function completionKey(
  userId: string,
  isScholar: boolean
) {
  return isScholar
    ? `tariq_scholar_onboarding_v1_${userId}`
    : `tariq_user_onboarding_v1_${userId}`;
}

export default function AppOnboarding() {
  const { user, loading } = useAuth();
  const { t } = useTranslation("common");

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isScholar, setIsScholar] = useState(false);
  const [checkingScholar, setCheckingScholar] =
    useState(false);

  const steps = useMemo(
    () => (isScholar ? SCHOLAR_STEPS : USER_STEPS),
    [isScholar]
  );

  useEffect(() => {
    if (loading || !user?.id) {
      setOpen(false);
      return;
    }

    let active = true;

    const initialize = async () => {
      setCheckingScholar(true);

      try {
        const { data, error } = await supabase
          .from("scholar_profiles")
          .select("id")
          .eq("user_id", user.id)
          .eq("verification_status", "approved")
          .eq("is_active", true)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error(
            "Unable to check scholar onboarding:",
            error
          );
        }

        const approvedScholar = Boolean(data?.id);
        setIsScholar(approvedScholar);

        const key = completionKey(
          user.id,
          approvedScholar
        );

        let completed = false;

        try {
          completed =
            localStorage.getItem(key) === "done";
        } catch {
          completed = false;
        }

        if (!completed) {
          setStepIndex(0);
          setOpen(true);
        }
      } finally {
        if (active) {
          setCheckingScholar(false);
        }
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [loading, user?.id]);

  useEffect(() => {
    const handleOpenOnboarding = () => {
      if (!user?.id) return;

      setStepIndex(0);
      setOpen(true);
    };

    window.addEventListener(
      "tariq:open-onboarding",
      handleOpenOnboarding
    );

    return () => {
      window.removeEventListener(
        "tariq:open-onboarding",
        handleOpenOnboarding
      );
    };
  }, [user?.id]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(0);
    }
  }, [stepIndex, steps.length]);

  const markDone = () => {
    if (user?.id) {
      try {
        localStorage.setItem(
          completionKey(user.id, isScholar),
          "done"
        );
      } catch {
        // Ignore storage failures.
      }
    }

    setOpen(false);
  };

  const openIbadah = () => {
    window.dispatchEvent(
      new CustomEvent("tariq:open-ibadah")
    );

    setOpen(false);
  };

  if (
    loading ||
    checkingScholar ||
    !user?.id ||
    !open
  ) {
    return null;
  }

  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${
                ((stepIndex + 1) / steps.length) * 100
              }%`,
            }}
          />
        </div>

        <CardHeader className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <StepIcon className="h-7 w-7" />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("appOnboarding.progress", {
                current: stepIndex + 1,
                total: steps.length,
                defaultValue:
                  "Step {{current}} of {{total}}",
              })}
            </p>

            <CardTitle className="text-xl">
              {t(
                `appOnboarding.steps.${step.key}.title`,
                {
                  defaultValue: "Welcome to Tariq Islam",
                }
              )}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <p className="leading-7 text-muted-foreground">
            {t(
              `appOnboarding.steps.${step.key}.body`,
              {
                defaultValue:
                  "Explore the tools available in Tariq Islam.",
              }
            )}
          </p>

          {step.action === "ibadah" && (
            <Button
              type="button"
              className="w-full"
              onClick={openIbadah}
            >
              <Compass className="mr-2 h-4 w-4" />

              {t("appOnboarding.openIbadah", {
                defaultValue: "Open Ibadah",
              })}
            </Button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={markDone}
            >
              {t("appOnboarding.skip", {
                defaultValue: "Skip",
              })}
            </Button>

            <div className="flex gap-2">
              {stepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setStepIndex((current) =>
                      Math.max(0, current - 1)
                    )
                  }
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />

                  {t("appOnboarding.back", {
                    defaultValue: "Back",
                  })}
                </Button>
              )}

              <Button
                type="button"
                onClick={() => {
                  if (isLast) {
                    markDone();
                    return;
                  }

                  setStepIndex((current) =>
                    Math.min(
                      steps.length - 1,
                      current + 1
                    )
                  );
                }}
              >
                {isLast
                  ? t("appOnboarding.done", {
                      defaultValue: "Done",
                    })
                  : t("appOnboarding.next", {
                      defaultValue: "Next",
                    })}

                {!isLast && (
                  <ChevronRight className="ml-1 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
