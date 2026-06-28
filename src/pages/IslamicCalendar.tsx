// src/pages/IslamicCalendar.tsx
import { IslamicCalendar } from "@/components/IslamicCalendar";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Capacitor } from "@capacitor/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const IslamicCalendarPage = () => {
  // ✅ Use the namespace that actually contains these strings
  const { t } = useTranslation("features");

  // Website only: show top menu + footer
  const showWebsiteMenu = useMemo(() => !Capacitor.isNativePlatform(), []);

  return (
    <div className="min-h-screen bg-background">
      {showWebsiteMenu ? <Navigation /> : null}

      {/* Floating Theme Toggle */}
      <div className="fixed top-20 right-4 z-40">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
          <ThemeToggle />
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {t("islamicCalendar.title")}
              </span>
            </h1>

            <p className="text-xl text-muted-foreground" dir="rtl">
              {t("islamicCalendar.subtitleAr", { defaultValue: "التقويم الهجري" })}
            </p>

            {/* ✅ This is the line that was stuck in English */}
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("islamicCalendar.subtitle")}
            </p>
          </div>

          <IslamicCalendar />
        </div>
      </section>

      {showWebsiteMenu ? <Footer /> : null}
    </div>
  );
};

export default IslamicCalendarPage;