// src/pages/Index.tsx
import { useMemo, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";

import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import PrayerTimes from "@/components/PrayerTimes";
import CommunitySection from "@/components/CommunitySection";
import CallToActionSection from "@/components/CallToActionSection";
import SupportBanner from "@/components/SupportBanner";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";

const QuranSection = lazy(() => import("@/components/QuranSection"));
const GlobalLocations = lazy(() => import("@/components/GlobalLocations"));

const Index = () => {
  const { t } = useTranslation(["quran", "common", "features"]);
  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);
  const showWebsiteMenu = !isNative;

  const loadingText =
    t("common.loading", { ns: "common", defaultValue: "" }) || "Loading...";

  const loadingQuranText =
    t("quran.loading", { ns: "quran", defaultValue: "" }) ||
    t("common.loading", { ns: "common", defaultValue: "" }) ||
    "Loading Quran...";

  return (
    <div className={`min-h-screen bg-background ${isNative ? "pb-24" : ""}`}>
      {showWebsiteMenu ? <Navigation /> : null}

      <div className="fixed top-20 right-4 z-40">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
          <ThemeToggle />
        </div>
      </div>

     <main className="pb-20 md:pb-0">
        <HeroSection />
        <PrayerTimes />
        <CommunitySection />

        <Suspense
          fallback={
            <div className="px-4 mt-6">
              <div className="rounded-xl border bg-card/50 p-4">
                <div className="text-sm text-muted-foreground">
                  {loadingQuranText}
                </div>
              </div>
            </div>
          }
        >
          <QuranSection />
        </Suspense>

        <CallToActionSection />
        <SupportBanner />

        <Suspense
          fallback={
            <div className="px-4 mt-6">
              <div className="rounded-xl border bg-card/50 p-4">
                <div className="text-sm text-muted-foreground">
                  {loadingText}
                </div>
              </div>
            </div>
          }
        >
          <GlobalLocations />
        </Suspense>

        <FeaturesSection />
        <Footer />
      </main>
    </div>
  );
};

export default Index;