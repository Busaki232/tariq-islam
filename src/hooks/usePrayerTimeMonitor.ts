import { useState, useEffect } from "react";
import { usePrayerTimes } from "./usePrayerTimes";

interface PrayerTimeWindow {
  inPrayerTime: boolean;
  prayerName: string | null;
  endsAt: Date | null;
}

export const usePrayerTimeMonitor = () => {
  const { data } = usePrayerTimes();
  const [currentWindow, setCurrentWindow] = useState<PrayerTimeWindow>({
    inPrayerTime: false,
    prayerName: null,
    endsAt: null,
  });

  useEffect(() => {
    const checkPrayerTime = () => {
      if (!data?.prayerTimes) {
        setCurrentWindow({ inPrayerTime: false, prayerName: null, endsAt: null });
        return;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const prayers = data.prayerTimes.map(prayer => ({
        name: prayer.name,
        time: prayer.time,
        duration: prayer.name === "Fajr" || prayer.name === "Isha" ? 20 : 15
      }));

      for (const prayer of prayers) {
        const [hours, minutes] = prayer.time.split(":").map(Number);
        const prayerTimeMinutes = hours * 60 + minutes;
        const endTimeMinutes = prayerTimeMinutes + prayer.duration;

        if (currentTime >= prayerTimeMinutes && currentTime < endTimeMinutes) {
          const endsAt = new Date();
          endsAt.setHours(Math.floor(endTimeMinutes / 60));
          endsAt.setMinutes(endTimeMinutes % 60);

          setCurrentWindow({
            inPrayerTime: true,
            prayerName: prayer.name,
            endsAt,
          });
          return;
        }
      }

      setCurrentWindow({ inPrayerTime: false, prayerName: null, endsAt: null });
    };

    checkPrayerTime();
    const interval = setInterval(checkPrayerTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [data]);

  return currentWindow;
};
