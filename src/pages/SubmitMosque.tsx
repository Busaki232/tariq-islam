import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import MosqueSubmissionForm from "@/components/MosqueSubmissionForm";

const SubmitMosque = () => {
  const { t } = useTranslation("mosques");

  return (
    <main className="min-h-screen bg-background pt-16">
      {/* Header Section */}
      <section className="bg-gradient-to-br from-secondary/30 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">

            <Link to="/mosques">
              <Button variant="ghost" className="mb-4 hover:bg-islamic-green/10">
                <ArrowLeft className="mr-2 w-4 h-4" />
                {t("submitPage.backToMosques", {
                  defaultValue: "Back to Mosques"
                })}
              </Button>
            </Link>

            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t("submitPageTitle")}
              </h1>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("submitPageSubtitle")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <MosqueSubmissionForm />
        </div>
      </section>

      {/* Guidelines Section */}
      <section className="py-12 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">

            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t("submitPage.guidelinesTitle", {
                defaultValue: "Submission Guidelines"
              })}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">

              {/* Required Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-islamic-green">
                  {t("submitPage.guidelines.requiredInfoTitle", {
                    defaultValue: "Required Information"
                  })}
                </h3>
                {t("submitPage.guidelines.requiredInfoItems", {
                  returnObjects: true,
                  defaultValue: []
                })?.map((item: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {item}</p>
                ))}
              </div>

              {/* Review Process */}
              <div className="space-y-2">
                <h3 className="font-semibold text-islamic-green">
                  {t("submitPage.guidelines.reviewProcessTitle", {
                    defaultValue: "Review Process"
                  })}
                </h3>
                {t("submitPage.guidelines.reviewProcessItems", {
                  returnObjects: true,
                  defaultValue: []
                })?.map((item: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {item}</p>
                ))}
              </div>

              {/* Helpful Tips */}
              <div className="space-y-2">
                <h3 className="font-semibold text-islamic-green">
                  {t("submitPage.guidelines.helpfulTipsTitle", {
                    defaultValue: "Helpful Tips"
                  })}
                </h3>
                {t("submitPage.guidelines.helpfulTipsItems", {
                  returnObjects: true,
                  defaultValue: []
                })?.map((item: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {item}</p>
                ))}
              </div>

              {/* Updates */}
              <div className="space-y-2">
                <h3 className="font-semibold text-islamic-green">
                  {t("submitPage.guidelines.updatesTitle", {
                    defaultValue: "Updates"
                  })}
                </h3>
                {t("submitPage.guidelines.updatesItems", {
                  returnObjects: true,
                  defaultValue: []
                })?.map((item: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {item}</p>
                ))}
              </div>

            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SubmitMosque;