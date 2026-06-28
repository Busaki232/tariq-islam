// src/components/FeaturesSection.tsx
import React from "react";
import { Compass, MapPin, Calendar, Users, BookOpen, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { HeroButton } from "@/components/ui/hero-button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Feature = {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description: string;
  color: string;
  onClick?: () => void;
};

const FeaturesSection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation("features");

  // Always stay in-app (avoid window.location hard reloads)
  const go = (path: string) => {
    navigate(path);
  };

  // Qibla MUST go to /qibla (do not scroll to prayer-times)
  const handleQiblaFinder = () => {
    go("/qibla");
  };

  const handleMosqueLocator = () => {
    go("/mosques");
  };

  const handleIslamicCalendar = () => {
    go("/islamic-calendar");
  };

  const handleCommunityNetwork = () => {
    if (!user) {
      toast({
        title: t("journey.toasts.signInRequiredTitle"),
        description: t("journey.toasts.signInRequiredDescNetwork"),
      });
      go("/auth");
      return;
    }
    go("/chat-room");
  };

  const handleIslamicLearning = () => {
    const quranSection = document.querySelector("#quran-section");
    if (quranSection) {
      (quranSection as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      toast({
        title: t("journey.toasts.islamicLearningTitle"),
        description: t("journey.toasts.islamicLearningDesc"),
      });
      return;
    }

    go("/");
    setTimeout(() => {
      const section = document.querySelector("#quran-section");
      (section as HTMLElement | null)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 300);
  };

  const handleCommunityGuidelines = () => {
    go("/community-guidelines");
  };

  const handleCulturalHeritage = () => {
    const communitySection = document.querySelector("#community-section");
    if (communitySection) {
      (communitySection as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      toast({
        title: t("journey.toasts.culturalHeritageTitle"),
        description: t("journey.toasts.culturalHeritageDesc"),
      });
      return;
    }

    go("/");
    setTimeout(() => {
      const section = document.querySelector("#community-section");
      (section as HTMLElement | null)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 300);
  };

  const handleJoinCommunity = () => {
    if (!user) {
      toast({
        title: t("journey.toasts.signInRequiredTitle"),
        description: t("journey.toasts.signInRequiredDescChat"),
      });
      go("/auth");
      return;
    }
    go("/chat-room");
  };

  const handleExploreFeatures = () => {
    const featuresSection = document.querySelector("#features-section");
    if (featuresSection) {
      (featuresSection as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    go("/");
  };

  const features: Feature[] = [
    {
      icon: Compass,
      title: t("journey.items.qibla.title"),
      description: t("journey.items.qibla.desc"),
      color: "text-prayer-blue",
      onClick: handleQiblaFinder,
    },
    {
      icon: MapPin,
      title: t("journey.items.mosques.title"),
      description: t("journey.items.mosques.desc"),
      color: "text-islamic-green",
      onClick: handleMosqueLocator,
    },
    {
      icon: Calendar,
      title: t("journey.items.calendar.title"),
      description: t("journey.items.calendar.desc"),
      color: "text-islamic-gold",
      onClick: handleIslamicCalendar,
    },
    {
      icon: Users,
      title: t("journey.items.network.title"),
      description: t("journey.items.network.desc"),
      color: "text-islamic-green",
      onClick: handleCommunityNetwork,
    },
    {
      icon: BookOpen,
      title: t("journey.items.learning.title"),
      description: t("journey.items.learning.desc"),
      color: "text-prayer-blue",
      onClick: handleIslamicLearning,
    },
    {
      icon: Heart,
      title: t("journey.items.heritage.title"),
      description: t("journey.items.heritage.desc"),
      color: "text-islamic-gold",
      onClick: handleCulturalHeritage,
    },
  ];

  return (
    <section className="py-16 bg-background" id="features-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("journey.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t("journey.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;

            return (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("[FEATURE CLICK]", feature.title);
                  feature.onClick?.();
                }}
                className="w-full text-left touch-manipulation cursor-pointer active:opacity-70"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                  minHeight: "44px",
                  minWidth: "44px",
                }}
                aria-label={feature.title}
              >
                <Card className="group hover:shadow-islamic transition-all duration-300 hover:-translate-y-1 active:translate-y-0 border-border/50 h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IconComponent className="text-white" size={28} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-hero rounded-2xl p-8 md:p-12 text-white max-w-4xl mx-auto shadow-2xl border-2 border-white/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              {t("journey.cta.title")}
            </h3>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              {t("journey.cta.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <HeroButton
                size="lg"
                className="bg-white text-islamic-green hover:bg-white/90 shadow-none touch-manipulation"
                onClick={handleJoinCommunity}
              >
                <Users className="mr-2" />
                {t("journey.cta.joinButton")}
              </HeroButton>

              <HeroButton
                variant="outline"
                size="lg"
                className="border-white/80 border-2 text-white bg-white/10 hover:bg-white hover:text-islamic-green backdrop-blur-sm touch-manipulation"
                onClick={handleExploreFeatures}
              >
                <BookOpen className="mr-2" />
                {t("journey.cta.exploreButton")}
              </HeroButton>

              <HeroButton
                variant="outline"
                size="lg"
                className="border-white/80 border-2 text-white bg-white/10 hover:bg-white hover:text-islamic-green backdrop-blur-sm touch-manipulation"
                onClick={handleCommunityGuidelines}
              >
                {t("journey.cta.guidelinesButton")}
              </HeroButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;