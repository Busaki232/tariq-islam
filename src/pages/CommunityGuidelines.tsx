// src/pages/CommunityGuidelines.tsx
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { useMemo } from "react";

const CommunityGuidelines = () => {
  const { t } = useTranslation("communityGuidelines");

  // Memo to avoid any weird re-evaluations during hydration
  const showWebsiteMenu = useMemo(() => !Capacitor.isNativePlatform(), []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {showWebsiteMenu ? <Navigation /> : null}

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-card/60 backdrop-blur-sm rounded-xl shadow-lg p-8 md:p-12 border border-border/50">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t("title")}</h1>

          <p className="text-muted-foreground mb-8">{t("intro")}</p>

          <div className="space-y-6 text-foreground/90">
            <section>
              <h2 className="text-2xl font-semibold mb-2">{t("sections.respect.title")}</h2>

              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t("sections.respect.items.0")}</li>
                <li>{t("sections.respect.items.1")}</li>
                <li>{t("sections.respect.items.2")}</li>
              </ul>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-semibold mb-2">{t("sections.content.title")}</h2>

              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t("sections.content.items.0")}</li>
                <li>{t("sections.content.items.1")}</li>
                <li>{t("sections.content.items.2")}</li>
              </ul>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-semibold mb-2">{t("sections.enforcement.title")}</h2>

              <p className="leading-relaxed">{t("sections.enforcement.body")}</p>
            </section>
          </div>
        </div>
      </main>

      {showWebsiteMenu ? <Footer /> : null}
    </div>
  );
};

export default CommunityGuidelines;