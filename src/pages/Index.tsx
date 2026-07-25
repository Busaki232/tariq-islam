// src/pages/Index.tsx
import { useMemo } from "react";
import { Capacitor } from "@capacitor/core";

import HomeHeroBackground from "@/components/HomeHeroBackground";
import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import PrayerTimes from "@/components/PrayerTimes";
import FeaturedReflection from "@/components/FeaturedReflection";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);
  const showWebsiteMenu = !isNative;

  return (
    <div className={`min-h-screen bg-background ${isNative ? "pb-24" : ""}`}>
      {showWebsiteMenu ? <Navigation /> : null}

      <div className="fixed right-4 top-20 z-40">
        <div className="rounded-lg border border-border bg-card/80 p-2 shadow-lg backdrop-blur-sm">
          <ThemeToggle />
        </div>
      </div>

      <main className="pb-20 md:pb-0">
   <HomeHeroBackground>
     <HeroSection />
     <FeaturedReflection />
     <PrayerTimes />
   </HomeHeroBackground>

        <Footer />
      </main>
    </div>
  );
};

export default Index;