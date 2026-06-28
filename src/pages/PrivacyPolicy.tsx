// src/pages/PrivacyPolicy.tsx
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Shield } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";

export default function PrivacyPolicy() {
  const { t, i18n } = useTranslation("privacy");
  const showWebsiteMenu = useMemo(() => !Capacitor.isNativePlatform(), []);

  const lastUpdatedText = useMemo(() => {
    const locale = (i18n.resolvedLanguage || i18n.language || "en").toLowerCase();
    const d = new Date();
    try {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);
    } catch {
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }, [i18n.resolvedLanguage, i18n.language]);

  const useBullets = (
    t("sections.use.bullets", {
      returnObjects: true,
      defaultValue: [],
    }) || []
  ) as string[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      {showWebsiteMenu ? <Navigation /> : null}

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-islamic-green/10 rounded-full">
              <Shield className="w-12 h-12 text-islamic-green" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            {t("title", { defaultValue: "Privacy Policy" })}
          </h1>

          <p className="text-muted-foreground">
            {t("lastUpdatedLabel", { defaultValue: "Last updated:" })} {lastUpdatedText}
          </p>
        </div>

        <div className="space-y-8">
          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "intro",
                {
                  defaultValue:
                    "Tariq Islam respects your privacy. This Privacy Policy explains what information we collect, how we use it, and how we protect it when you use our website and mobile application.",
                },
              )}
            </p>
          </section>

          {/* Clear summary for Apple / users */}
          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Privacy Summary
            </h2>

            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Tariq Islam collects limited information needed to provide core app
                functionality.
              </p>

              <ul className="space-y-3 list-disc list-inside">
                <li>
                  <strong className="text-foreground">Name and email address:</strong>{" "}
                  used to create and manage user accounts, support sign in, and help
                  users access account-based features.
                </li>
                <li>
                  <strong className="text-foreground">Location data:</strong>{" "}
                  used to provide accurate prayer times, nearby mosque locations, and
                  Qibla-related functionality based on the user’s area.
                </li>
                <li>
                  <strong className="text-foreground">Identifiers:</strong>{" "}
                  may be used to maintain app functionality, security, and account
                  continuity.
                </li>
              </ul>

              <p>
                We do not sell personal data to third parties. We use collected
                information only to operate, maintain, and improve the app’s core
                functionality.
              </p>
            </div>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">1.</span>{" "}
              {t("sections.collect.title", { defaultValue: "Information We Collect" })}
            </h2>

            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("sections.collect.personal.title", { defaultValue: "Personal Information" })}
                </h3>
                <p>
                  {t(
                    "sections.collect.personal.body",
                    {
                      defaultValue:
                        "We may collect personal information such as your name and email address when you create an account, sign in, or communicate with us through the app.",
                    },
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("sections.collect.usage.title", { defaultValue: "Usage Information" })}
                </h3>
                <p>
                  {t(
                    "sections.collect.usage.body",
                    {
                      defaultValue:
                        "We may collect limited usage information necessary to operate features, improve reliability, and support app functionality.",
                    },
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Location Information
                </h3>
                <p>
                  We may collect precise location information to provide accurate prayer
                  times, nearby mosque results, and other location-based Islamic tools.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("sections.collect.device.title", { defaultValue: "Device Information" })}
                </h3>
                <p>
                  {t(
                    "sections.collect.device.body",
                    {
                      defaultValue:
                        "We may collect limited device and identifier information to maintain app security, performance, and account continuity.",
                    },
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">2.</span>{" "}
              {t("sections.use.title", { defaultValue: "How We Use Your Information" })}
            </h2>

            <ul className="space-y-3 text-muted-foreground list-disc list-inside">
              {useBullets.length > 0 ? (
                useBullets.map((b, idx) => <li key={idx}>{b}</li>)
              ) : (
                <>
                  <li>To create and manage user accounts.</li>
                  <li>To allow users to sign in and access account-based features.</li>
                  <li>To provide accurate prayer times and nearby mosque information.</li>
                  <li>To support app functionality, account continuity, and security.</li>
                  <li>To maintain and improve the reliability of the app.</li>
                </>
              )}
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">3.</span>{" "}
              {t("sections.sharing.title", { defaultValue: "How We Share Information" })}
            </h2>

            <div className="space-y-4 text-muted-foreground">
              <p>
                {t(
                  "sections.sharing.lead",
                  {
                    defaultValue:
                      "We do not sell your personal information. We may share limited information only when necessary to provide core app services, comply with legal obligations, or protect the safety and integrity of the platform.",
                  },
                )}
              </p>

              <ul className="space-y-3 list-disc list-inside ml-4">
                <li>
                  <strong>
                    {t("sections.sharing.items.withUsers.label", { defaultValue: "With users:" })}
                  </strong>{" "}
                  {t(
                    "sections.sharing.items.withUsers.body",
                    {
                      defaultValue:
                        "certain account or profile information may be visible where required for app functionality.",
                    },
                  )}
                </li>
                <li>
                  <strong>
                    {t("sections.sharing.items.providers.label", { defaultValue: "With service providers:" })}
                  </strong>{" "}
                  {t(
                    "sections.sharing.items.providers.body",
                    {
                      defaultValue:
                        "trusted service providers may process limited information on our behalf to help operate the app.",
                    },
                  )}
                </li>
                <li>
                  <strong>
                    {t("sections.sharing.items.legal.label", { defaultValue: "For legal reasons:" })}
                  </strong>{" "}
                  {t(
                    "sections.sharing.items.legal.body",
                    {
                      defaultValue:
                        "we may disclose information where required by law or to protect rights, safety, and security.",
                    },
                  )}
                </li>
                <li>
                  <strong>
                    {t("sections.sharing.items.transfers.label", { defaultValue: "Business transfers:" })}
                  </strong>{" "}
                  {t(
                    "sections.sharing.items.transfers.body",
                    {
                      defaultValue:
                        "information may be transferred if the app or service is involved in a merger, acquisition, or similar transaction.",
                    },
                  )}
                </li>
              </ul>
            </div>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">4.</span>{" "}
              {t("sections.security.title", { defaultValue: "Security" })}
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              {t(
                "sections.security.body",
                {
                  defaultValue:
                    "We take reasonable steps to protect personal information from unauthorized access, loss, misuse, or disclosure. However, no method of storage or transmission is completely secure.",
                },
              )}
            </p>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">5.</span>{" "}
              {t("sections.rights.title", { defaultValue: "Your Rights" })}
            </h2>

            <ul className="space-y-3 text-muted-foreground list-disc list-inside">
              <li>
                <strong>{t("sections.rights.items.access.label", { defaultValue: "Access:" })}</strong>{" "}
                {t(
                  "sections.rights.items.access.body",
                  {
                    defaultValue:
                      "you may request access to information associated with your account where applicable.",
                  },
                )}
              </li>
              <li>
                <strong>{t("sections.rights.items.deletion.label", { defaultValue: "Deletion:" })}</strong>{" "}
                {t(
                  "sections.rights.items.deletion.body",
                  {
                    defaultValue:
                      "you may request deletion of your account or applicable personal information, subject to legal or operational requirements.",
                  },
                )}
              </li>
              <li>
                <strong>{t("sections.rights.items.optOut.label", { defaultValue: "Opt out:" })}</strong>{" "}
                {t(
                  "sections.rights.items.optOut.body",
                  {
                    defaultValue:
                      "you may limit certain permissions, such as location access, through your device settings.",
                  },
                )}
              </li>
              <li>
                <strong>{t("sections.rights.items.portability.label", { defaultValue: "Portability:" })}</strong>{" "}
                {t(
                  "sections.rights.items.portability.body",
                  {
                    defaultValue:
                      "you may request a copy of certain data you have provided where applicable.",
                  },
                )}
              </li>
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">6.</span>{" "}
              {t("sections.cookies.title", { defaultValue: "Cookies" })}
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              {t(
                "sections.cookies.body",
                {
                  defaultValue:
                    "Our website may use cookies or similar technologies to improve functionality, remember preferences, and support a better browsing experience.",
                },
              )}
            </p>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">7.</span>{" "}
              {t("sections.children.title", { defaultValue: "Children" })}
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              {t(
                "sections.children.body",
                {
                  defaultValue:
                    "Tariq Islam is not intended for children under the age required by applicable law without parental or guardian involvement. We do not knowingly collect personal information from children in violation of applicable laws.",
                },
              )}
            </p>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">8.</span>{" "}
              {t("sections.changes.title", { defaultValue: "Changes to This Policy" })}
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              {t(
                "sections.changes.body",
                {
                  defaultValue:
                    "We may update this Privacy Policy from time to time. When we do, we will revise the date at the top of this page. Continued use of the app after updates means you accept the revised policy.",
                },
              )}
            </p>
          </section>

          <section className="bg-card rounded-lg p-6 border border-border shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="text-islamic-green">9.</span>{" "}
              {t("sections.contact.title", { defaultValue: "Contact" })}
            </h2>

            <p className="text-muted-foreground leading-relaxed mb-4">
              {t(
                "sections.contact.lead",
                {
                  defaultValue:
                    "If you have questions about this Privacy Policy or your data, please contact us.",
                },
              )}
            </p>

            <ul className="space-y-2 text-muted-foreground">
              <li>
                • {t("sections.contact.emailLabel", { defaultValue: "Email:" })}{" "}
                {t("sections.contact.emailValue", { defaultValue: "support@global-muslims-connect.com" })}
              </li>
              <li>
                • {t("sections.contact.formLine", { defaultValue: "You may also contact us through our website contact form." })}
              </li>
            </ul>
          </section>
        </div>
      </main>

      {showWebsiteMenu ? <Footer /> : null}
    </div>
  );
}