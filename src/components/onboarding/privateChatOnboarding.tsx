import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const KEY = "ti_onboard_private_chat_v1";

type Step = {
  titleKey: string;
  bodyKey: string;
};

const steps: Step[] = [
  { titleKey: "onboarding.pm.step1.title", bodyKey: "onboarding.pm.step1.body" },
  { titleKey: "onboarding.pm.step2.title", bodyKey: "onboarding.pm.step2.body" },
  { titleKey: "onboarding.pm.step3.title", bodyKey: "onboarding.pm.step3.body" },
  { titleKey: "onboarding.pm.step4.title", bodyKey: "onboarding.pm.step4.body" },
];

export function shouldShowPrivateChatOnboarding() {
  try {
    return localStorage.getItem(KEY) !== "done";
  } catch {
    return true;
  }
}

export function markPrivateChatOnboardingDone() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    // ignore
  }
}

export default function PrivateChatOnboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(["privateChat", "common"]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
  }, [open]);

  if (!open) return null;

  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">
            {t(step.titleKey, { ns: "privateChat", defaultValue: "Quick tour" })}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(step.bodyKey, { ns: "privateChat", defaultValue: "" })}
          </p>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {idx + 1}/{steps.length}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  markPrivateChatOnboardingDone();
                  onClose();
                }}
              >
                {t("onboarding.pm.skip", { ns: "privateChat", defaultValue: "Skip" })}
              </Button>

              {idx > 0 ? (
                <Button variant="outline" onClick={() => setIdx((v) => Math.max(0, v - 1))}>
                  {t("onboarding.pm.back", { ns: "privateChat", defaultValue: "Back" })}
                </Button>
              ) : null}

              <Button
                onClick={() => {
                  if (isLast) {
                    markPrivateChatOnboardingDone();
                    onClose();
                  } else {
                    setIdx((v) => Math.min(steps.length - 1, v + 1));
                  }
                }}
              >
                {isLast
                  ? t("onboarding.pm.done", { ns: "privateChat", defaultValue: "Done" })
                  : t("onboarding.pm.next", { ns: "privateChat", defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}