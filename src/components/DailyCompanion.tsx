import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";


export default function DailyCompanion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { coords, requestLocation, loading } = useGeolocation();
  const { toast } = useToast();
  const { t } = useTranslation("common");

  const reminders = [
    {
      text: t("dailyCompanion.reminders.1.text"),
      source: t("dailyCompanion.reminders.1.source"),
    },
    {
      text: t("dailyCompanion.reminders.2.text"),
      source: t("dailyCompanion.reminders.2.source"),
    },
    {
      text: t("dailyCompanion.reminders.3.text"),
      source: t("dailyCompanion.reminders.3.source"),
    },
    {
      text: t("dailyCompanion.reminders.4.text"),
      source: t("dailyCompanion.reminders.4.source"),
    },
  ];

  const reminder =
    reminders[Math.floor(Math.random() * reminders.length)];

  const { data: prayerData } = usePrayerTimes(coords?.latitude, coords?.longitude);

  if (!user) return null;

  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Friend";

const handleFindMosques = async () => {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      });
    });

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    navigate(`/mosques?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  } catch {
    toast({
      title: "Location unavailable",
      description: "Showing all mosques instead.",
      variant: "destructive",
    });

    navigate("/mosques");
  }
};

  return (
    <section className="px-4 py-6">
      <Card className="overflow-hidden border border-white/20 shadow-lg bg-white/10 backdrop-blur-xl text-white">
        <CardContent className="p-5 space-y-5">
          <div>
            ☪️ {t("dailyCompanion.greeting")}, {name}
            <p className="mt-1 text-white/85">
              {t("dailyCompanion.blessYourDay")}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 backdrop-blur p-4">
            <div className="text-sm text-white/80">
              {t("dailyCompanion.currentPrayer")}:{" "}
              {prayerData?.currentPrayer || t("dailyCompanion.loading")}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <div>
                <div className="text-sm text-white/80">
                  {t("dailyCompanion.nextPrayer")}
                </div>
            <div className="text-xl font-semibold">
              {prayerData?.nextPrayer && prayerData?.timeUntilNext
                ? t("dailyCompanion.prayerIn", {
                    prayer: prayerData.nextPrayer,
                    time: prayerData.timeUntilNext,
                  })
                : t("dailyCompanion.loadingPrayerTime")}
            </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 space-y-2">
            <div className="font-semibold">
              📖 {t("dailyCompanion.todaysReminder")}
            </div>
            <p className="text-white/90">“{reminder.text}”</p>
            <div className="text-sm text-white/75">{reminder.source}</div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 space-y-3">
            <div>
              <div className="font-semibold mb-1">
                📅 {t("dailyCompanion.todaysHadith")}
              </div>
           <p className="text-sm text-white/85">
             “{t("dailyCompanion.hadith.text")}”
           </p>
            </div>

            <Button
              type="button"
              onClick={handleFindMosques}
              disabled={loading}
              className="w-full bg-white/90 text-emerald-900 hover:bg-white"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {loading
                ? t("dailyCompanion.gettingLocation")
                : t("dailyCompanion.findMosques")}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="w-full text-left rounded-2xl bg-white/10 p-4 hover:bg-white/15 transition"
          >
            <Users className="h-5 w-5 mb-2" />
            <div className="font-semibold">
              {t("dailyCompanion.community")}
            </div>
            <div className="text-sm text-white/80">
              {t("dailyCompanion.openCommunityMessages")}
            </div>
          </button>
        </CardContent>
      </Card>
    </section>
  );
}