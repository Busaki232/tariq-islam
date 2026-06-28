// src/components/HeroSection.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, CheckCircle2 } from "lucide-react";

import { HeroButton } from "@/components/ui/hero-button";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";
import islamicPatternBg from "@/assets/islamic-pattern-bg.png";
import { useTranslation } from "react-i18next";


// Add these badge images to src/assets
import appStoreBadge from "@/assets/apple-store-badge.svg";
import googlePlayBadge from "@/assets/google-play-badge.png";

const APP_STORE_URL = "https://apps.apple.com/us/app/tariq-islam/id6760355006";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.tariqislam.app";

const HeroSection = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { coords, requestLocation, loading } = useGeolocation();
  const { toast } = useToast();
  const [locationRequesting, setLocationRequesting] = useState(false);

  const handleOpenQibla = () => {
    navigate("/qibla");
  };

  const handleFindMosquesNearby = async () => {
    setLocationRequesting(true);
    try {
      await requestLocation();

      const lat = coords?.latitude;
      const lng = coords?.longitude;

      if (lat != null && lng != null) {
        toast({
          title: t("home.location.obtained.title", "Location obtained"),
          description: t(
            "home.location.obtained.desc",
            "Showing mosques near your location"
          ),
        });
        navigate(
          `/mosques?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
        );
      } else {
        toast({
          title: t("home.location.unavailable.title", "Location unavailable"),
          description: t(
            "home.location.unavailable.desc",
            "Showing all mosques in your area"
          ),
        });
        navigate("/mosques");
      }
    } catch {
      toast({
        title: t("home.location.unavailable.title", "Location unavailable"),
        description: t(
          "home.location.unavailable.desc",
          "Showing all mosques in your area"
        ),
        variant: "destructive",
      });
      navigate("/mosques");
    } finally {
      setLocationRequesting(false);
    }
  };

  const gettingLocationText = t("home.cta.gettingLocation", "Getting Location...");

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={islamicPatternBg}
          alt={t(
            "home.hero.bgAlt",
            "Islamic geometric pattern background for global Muslim community"
          )}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-hero/90">
          <div className="absolute inset-0 bg-black/50" />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <p
              className="text-2xl md:text-3xl text-white/90 font-light mb-2"
              dir="rtl"
              lang="ar"
              style={{
                fontFamily:
                  '"Geeza Pro", "Damascus", "Arial", "Noto Naskh Arabic", "Noto Sans Arabic", sans-serif',
              }}
            >
              السلام عليكم ورحمة الله وبركاته
            </p>
            <p className="text-lg text-white/80">
              {t(
                "home.hero.greetingTranslation",
                "May the peace, mercy, and blessings of Allah be upon you"
              )}
            </p>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            <span className="block">
              {t(
                "home.hero.title",
                "Stay connected to your faith and community worldwide"
              )}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
            {t(
              "home.hero.subtitle",
              "Find prayer times, locate mosques, and connect with Muslims around the globe."
            )}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            {user ? (
              <>
                <Link to="/chat-room">
                  <HeroButton
                    size="xl"
                    className="w-full sm:w-auto"
                    aria-label={t("home.cta.joinChatAria", "Join the community chat")}
                  >
                    {t("home.cta.joinChat", "Join Chat Room")}
                  </HeroButton>
                </Link>

                <HeroButton
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto touch-manipulation"
                  aria-label={t("home.cta.findMosquesAria", "Find nearby mosques")}
                  onClick={handleFindMosquesNearby}
                  disabled={locationRequesting || loading}
                >
                  <MapPin className="mr-2" aria-hidden="true" />
                  {locationRequesting || loading
                    ? gettingLocationText
                    : t("home.cta.findMosques", "Find Mosques Nearby")}
                </HeroButton>

                <HeroButton
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto"
                  aria-label={t("home.cta.qiblaAria", "Open Qibla")}
                  onClick={handleOpenQibla}
                >
                  {t("home.cta.qibla", "Find Qibla")}
                </HeroButton>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <HeroButton
                    size="xl"
                    className="w-full sm:w-auto"
                    aria-label={t(
                      "home.cta.joinNowAria",
                      "Sign up to join the community"
                    )}
                  >
                    {t("home.cta.joinNow", "Join Now - It's Free")}
                  </HeroButton>
                </Link>

                <HeroButton
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto touch-manipulation"
                  aria-label={t("home.cta.findMosquesAria", "Find nearby mosques")}
                  onClick={handleFindMosquesNearby}
                  disabled={locationRequesting || loading}
                >
                  <MapPin className="mr-2" aria-hidden="true" />
                  {locationRequesting || loading
                    ? gettingLocationText
                    : t("home.cta.findMosques", "Find Mosques Nearby")}
                </HeroButton>

                <HeroButton
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto"
                  aria-label={t(
                    "home.cta.islamicCalendarAria",
                    t("home.cta.islamicCalendarAria", {
                      defaultValue: "Open Islamic Calendar",
                    })
                  )}
                  onClick={() => navigate("/islamic-calendar")}
                >
                  {t("home.cta.islamicCalendar", "Islamic Calendar")}
                </HeroButton>

                <HeroButton
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto"
                  aria-label={t("home.cta.qiblaDirectionAria", "Find Qibla direction")}
                  onClick={handleOpenQibla}
                >
                  {t("home.cta.qibla", "Find Qibla")}
                </HeroButton>
              </>
            )}
          </div>

          <div className="mb-12">
            <p className="text-white/85 text-sm md:text-base mb-4">
              {t("home.downloadBadges", "Download Tariq Islam on iPhone and Android")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download on the App Store"
                className="inline-flex transition-transform duration-200 hover:scale-[1.02]"
              >
                <img
                  src={appStoreBadge}
                  alt="Download on the App Store"
                  className="h-14 w-auto"
                  loading="lazy"
                  decoding="async"
                />
              </a>

              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Get it on Google Play"
                className="inline-flex transition-transform duration-200 hover:scale-[1.02]"
              >
                <img
                  src={googlePlayBadge}
                  alt="Get it on Google Play"
                  className="h-14 w-auto"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
              {t("home.why.title", "Why Join Tariq Islam?")}
            </h2>

            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-islamic-gold flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-lg">
                  {t("home.why.bullet1", "Meet Muslims worldwide in real time")}
                </span>
              </li>

              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-islamic-gold flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-lg">
                  {t("home.why.bullet2", "Find nearby mosques and events")}
                </span>
              </li>

              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-islamic-gold flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-lg">
                  {t("home.why.bullet3", "Access Quran, prayer times, and more")}
                </span>
              </li>
            </ul>

            <div className="mt-8 pt-6 border-t border-white/20">
              <p className="text-white/80 text-center text-sm">
                {t(
                  "home.privacy",
                  "Your privacy and data are protected. We never share your information."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white/20 to-transparent" />
    </section>
  );
};

export default HeroSection;