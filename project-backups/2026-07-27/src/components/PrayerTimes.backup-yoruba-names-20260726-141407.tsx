import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Clock,
  MapPin,
  Compass,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroButton } from "@/components/ui/hero-button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useRealTimeClock } from "@/hooks/useRealTimeClock";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

import QiblaCompass from "./QiblaCompass";

const PrayerTimes = () => {
  const { t } = useTranslation("prayer");
  const { coords, error: locationError, loading: locationLoading, requestLocation } =
    useGeolocation();

  const {
    data: prayerData,
    loading: prayerLoading,
    error: prayerError,
    refetch,
  } = usePrayerTimes(coords?.latitude, coords?.longitude);

  const currentTime = useRealTimeClock();
  const { toast } = useToast();
  const [showCompass, setShowCompass] = useState(false);

  const handleQiblaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    logger.info("Qibla compass toggle", { hasCoords: !!coords, currentState: showCompass });

    if (!coords) {
      toast({
        title: t("qibla.locationRequiredTitle", "Location Required"),
        description: t(
          "qibla.locationRequiredBody",
          "Please allow location access to find Qibla direction."
        ),
        variant: "destructive",
      });
      return;
    }

    const newState = !showCompass;
    setShowCompass(newState);

    if (newState) {
      toast({
        title: t("qibla.toastTitle", "🧭 Qibla Compass"),
        description: t("qibla.toastBody", "Interactive compass displayed below"),
        duration: 3000,
      });
    }
  };

  const handleLocationRequest = async () => {
    try {
      toast({
        title: t("location.requestingTitle", "Requesting Location"),
        description: t(
          "location.requestingBody",
          "Please allow location access for accurate prayer times."
        ),
      });

      await requestLocation();

      // Optional: show a success toast if you want it here too
      toast({
        title: t("location.obtained.title", "Location obtained"),
        description: t("location.obtained.desc", "Showing mosques near your location"),
      });
    } catch (error) {
      logger.error("Location request failed", error);
      toast({
        title: t("location.failedTitle", "Location Request Failed"),
        description: t(
          "location.failedBody",
          "Unable to get your location. Please check your browser settings."
        ),
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (locationLoading || (coords && prayerLoading)) {
    return (
      <section className="py-16 bg-gradient-to-br from-background to-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("prayerTimes.title", "Prayer Times")}
            </h2>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("prayerTimes.loading", "Loading prayer times...")}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Initial state (no location yet)
  if (!coords && !locationError) {
    return (
      <section className="py-16 bg-gradient-to-br from-background to-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("prayerTimes.title", "Prayer Times")}
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              {t(
                "prayerTimes.subtitle",
                "Stay connected to your prayers with accurate timing for your location"
              )}
            </p>

            <Card className="max-w-md mx-auto bg-gradient-to-br from-background to-secondary/50 border-primary/20">
              <CardContent className="pt-6">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {t("prayerTimes.enableLocationTitle", "Enable Location Access")}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t(
                    "prayerTimes.enableLocationBody",
                    "Allow location access to get accurate prayer times for your area"
                  )}
                </p>

                <HeroButton
                  onClick={handleLocationRequest}
                  className="w-full touch-manipulation"
                  size="lg"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  {t("prayerTimes.getPrayerTimes", "Get Prayer Times")}
                </HeroButton>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (locationError || prayerError) {
    const errText = locationError || prayerError;

    return (
      <section className="py-16 bg-gradient-to-br from-background to-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("prayerTimes.title", "Prayer Times")}
            </h2>

            <div className="max-w-md mx-auto">
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="pt-6">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                  <p className="text-sm text-destructive mb-4">{errText}</p>

                  <HeroButton
                    onClick={locationError ? handleLocationRequest : refetch}
                    variant="outline"
                    size="sm"
                    className="w-full touch-manipulation"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {locationError
                      ? t("errors.tryAgain", "Try Again")
                      : t("errors.retry", "Retry")}
                  </HeroButton>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Data / fallbacks
  const prayerTimes = prayerData?.prayerTimes || [];
  const currentPrayer = prayerData?.currentPrayer || "Fajr";
  const nextPrayer = prayerData?.nextPrayer || "Dhuhr";
  const timeUntilNext = prayerData?.timeUntilNext || t("prayerTimes.loading", "Loading...");
  const location = prayerData?.location || t("location.unknown", "Unknown Location");
  const dateLabel = prayerData?.date || t("date.today", "Today");

  return (
    <section
      id="prayer-times"
      className="py-16 bg-gradient-to-br from-background to-secondary/30"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("prayerTimes.title", "Prayer Times")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t(
              "prayerTimes.subtitle",
              "Stay connected to your prayers with accurate timing for your location"
            )}
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Prayer Status */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-primary text-primary-foreground shadow-islamic border-0">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-xl">
                  <Clock size={24} />
                  {t("status.currentPrayer", "Current Prayer")}
                </CardTitle>
                <p className="text-xs opacity-75 text-center">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </CardHeader>

              <CardContent className="text-center">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold">{currentPrayer}</h3>
                  <p className="text-lg opacity-90" dir="rtl" lang="ar">
                    {prayerTimes.find((p) => p.name === currentPrayer)?.arabic || ""}
                  </p>
                </div>

                <div className="mb-6">
                  <p className="text-sm opacity-80 mb-1">
                    {t("status.nextPrayer", "Next Prayer")}: {nextPrayer}
                  </p>
                  <p className="text-2xl font-bold">{timeUntilNext}</p>
                </div>

                <HeroButton
                  variant="outline"
                  size="sm"
                  className="w-full border-white text-white hover:bg-white hover:text-islamic-green touch-manipulation active:scale-95"
                  aria-label={t("qibla.ariaLabel", "Find Qibla direction")}
                  onClick={handleQiblaClick}
                  type="button"
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleQiblaClick(e as any);
                  }}
                >
                  <Compass className="mr-2" size={16} aria-hidden="true" />
                  {showCompass
                    ? t("qibla.hide", "Hide Compass")
                    : t("qibla.show", "Show Qibla Compass")}
                </HeroButton>
              </CardContent>
            </Card>
          </div>

          {/* Prayer Times List */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin size={24} className="text-islamic-green" />
                  <span className="truncate">{location}</span>
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    {dateLabel}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {prayerTimes.map((prayer: any) => (
                    <div
                      key={prayer.name}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                        prayer.name === currentPrayer
                          ? "bg-gradient-primary text-white shadow-islamic"
                          : "bg-secondary/50 hover:bg-secondary/80"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            prayer.name === currentPrayer ? "bg-white" : "bg-islamic-green"
                          }`}
                        ></div>

                        <div>
                          <h4
                            className={`font-semibold ${
                              prayer.name === currentPrayer ? "text-white" : "text-foreground"
                            }`}
                          >
                            {prayer.name}
                          </h4>
                          <p
                            className={`text-sm ${
                              prayer.name === currentPrayer
                                ? "text-white/80"
                                : "text-muted-foreground"
                            }`}
                            dir="rtl"
                            lang="ar"
                          >
                            {prayer.arabic}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            prayer.name === currentPrayer ? "text-white" : "text-foreground"
                          }`}
                        >
                          {prayer.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <HeroButton
                    variant="ghost"
                    size="sm"
                    className="flex-1 touch-manipulation"
                    onClick={handleLocationRequest}
                  >
                    <MapPin className="mr-2" size={16} />
                    {t("location.update", "Update Location")}
                  </HeroButton>

                  <HeroButton
                    variant="secondary"
                    size="sm"
                    className="flex-1 touch-manipulation"
                    onClick={refetch}
                  >
                    <RefreshCw className="mr-2" size={16} />
                    {t("actions.refreshTimes", "Refresh Times")}
                  </HeroButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Qibla Compass */}
        {showCompass && coords && (
          <div className="max-w-2xl mx-auto mt-8 animate-fade-in">
            <QiblaCompass latitude={coords.latitude} longitude={coords.longitude} />
          </div>
        )}
      </div>
    </section>
  );
};

export default PrayerTimes;