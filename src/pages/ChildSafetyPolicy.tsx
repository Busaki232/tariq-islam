// src/pages/ChildSafetyPolicy.tsx
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { useMemo } from "react";

type BulletsObj = Record<string, string>;
type ItemsObj = Record<string, string>;

const ChildSafetyPolicy = () => {
  // ✅ This must match your namespace in i18n config
  const { t } = useTranslation("childSafetyPolicy");

  // Website only: show top menu + footer
  const showWebsiteMenu = useMemo(() => !Capacitor.isNativePlatform(), []);

  const readBullets = (path: string): string[] => {
    const raw = t(path, { returnObjects: true, defaultValue: {} }) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const obj = raw as BulletsObj;

    // Sort numeric keys: "1","2","3"...
    return Object.keys(obj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => obj[k])
      .filter(Boolean);
  };

  const readItems = (path: string): string[] => {
    const raw = t(path, { returnObjects: true, defaultValue: {} }) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const obj = raw as ItemsObj;

    return Object.keys(obj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => obj[k])
      .filter(Boolean);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {showWebsiteMenu ? <Navigation /> : null}

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-card/60 backdrop-blur-sm rounded-xl shadow-lg p-8 md:p-12 border border-border/50">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-islamic-green" />
            <h1 className="text-4xl font-bold text-foreground">{t("title")}</h1>
          </div>

          <p className="text-muted-foreground mb-8">
            <strong>{t("lastUpdatedLabel")}</strong> {t("lastUpdatedDate")}
          </p>

          <div className="space-y-8 text-foreground/90">
            {/* Introduction */}
            <section>
              <p className="leading-relaxed">{t("intro")}</p>
            </section>

            <hr className="border-border/50" />

            {/* 1 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.1.title")}
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readBullets("sections.1.bullets").map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </section>

            <hr className="border-border/50" />

            {/* 2 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.2.title")}
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readBullets("sections.2.bullets").map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </section>

            <hr className="border-border/50" />

            {/* 3 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.3.title")}
              </h2>
              <p className="leading-relaxed mb-3">{t("sections.3.lead")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readBullets("sections.3.bullets").map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </section>

            <hr className="border-border/50" />

            {/* 4 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.4.title")}
              </h2>
              <p className="leading-relaxed mb-3">{t("sections.4.lead")}</p>

              {/* ✅ in your JSON it's "items", not "bullets" */}
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readItems("sections.4.items").map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>

              <p className="leading-relaxed mt-3">{t("sections.4.note")}</p>
            </section>

            <hr className="border-border/50" />

            {/* 5 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.5.title")}
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readBullets("sections.5.bullets").map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </section>

            <hr className="border-border/50" />

            {/* 6 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.6.title")}
              </h2>
              <p className="leading-relaxed mb-3">{t("sections.6.p1")}</p>
              <p className="leading-relaxed">{t("sections.6.p2")}</p>
            </section>

            <hr className="border-border/50" />

            {/* 7 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.7.title")}
              </h2>
              <p className="leading-relaxed mb-3">{t("sections.7.lead")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {readBullets("sections.7.bullets").map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </section>

            <hr className="border-border/50" />

            {/* 8 */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("sections.8.title")}
              </h2>
              <p className="leading-relaxed mb-3">{t("sections.8.lead")}</p>
              <div className="ml-4 space-y-2">
                <p>
                  <strong>{t("sections.8.emailLabel")}</strong> {t("sections.8.emailValue")}
                </p>
                <p>
                  <strong>{t("sections.8.businessLabel")}</strong> {t("sections.8.businessValue")}
                </p>
                <p>
                  <strong>{t("sections.8.websiteLabel")}</strong> {t("sections.8.websiteValue")}
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {showWebsiteMenu ? <Footer /> : null}
    </div>
  );
};

export default ChildSafetyPolicy;