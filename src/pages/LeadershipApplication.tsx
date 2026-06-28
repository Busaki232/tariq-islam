// src/pages/LeadershipApplication.tsx
import { LeadershipApplicationForm } from "@/components/LeadershipApplicationForm";
import { useTranslation } from "react-i18next";

const LeadershipApplication = () => {
  const { t } = useTranslation("dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("empty.leadershipSubtitle", {
              defaultValue: "Become a Community Leader",
            })}
          </h1>

          <p className="text-lg text-muted-foreground">
            {t("leadershipForm.successDesc", {
              defaultValue:
                "Help expand the Tariq Islam global community network in your area",
            })}
          </p>
        </div>

        <LeadershipApplicationForm />
      </div>
    </div>
  );
};

export default LeadershipApplication;