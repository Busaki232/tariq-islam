import { AdSubmissionForm } from "@/components/AdSubmissionForm";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SubmitAd = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("marketplace");

  const handleSuccess = () => {
    // After successful submission, go to Business Listings
    navigate("/business-listings");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-4xl font-bold text-foreground">
              {t("submit.title")}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t("submit.subtitle")}
            </p>
          </div>

          <AdSubmissionForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
};

export default SubmitAd;