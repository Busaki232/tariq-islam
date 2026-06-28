// src/components/SupportBanner.tsx
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const SupportBanner = () => {
  const { t } = useTranslation("features");

  return (
    <div className="bg-white/60 dark:bg-black/20 border border-border/50 rounded-2xl p-6 md:p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-islamic-green/10 flex items-center justify-center">
          <Heart className="h-5 w-5 text-islamic-green" aria-hidden="true" />
        </div>

        <div className="flex-1">
          <h3 className="text-xl font-semibold text-foreground">
            {t("supportMission.title")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("supportMission.subtitle")}
          </p>

          <div className="mt-4">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/support">{t("supportMission.learnMore")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportBanner;
