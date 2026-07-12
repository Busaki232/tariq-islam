import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface PrayerTime {
  name: string;
  time: string;
  arabic: string;
}

export interface PrayerTimesData {
  prayerTimes: PrayerTime[];
  currentPrayer: string;
  nextPrayer: string;
  timeUntilNext: string;
  location: string;
  date: string;
}

interface UsePrayerTimesReturn {
  data: PrayerTimesData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function isAbortError(err: any) {
  return (
    err?.name === "AbortError" ||
    String(err?.message || "").toLowerCase().includes("aborted")
  );
}

export const usePrayerTimes = (
  latitude?: number,
  longitude?: number
): UsePrayerTimesReturn => {
  const [data, setData] = useState<PrayerTimesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrayerTimes = async (retryCount = 0) => {
    if (!latitude || !longitude) return;

    setLoading(true);
    setError(null);

    try {
      logger.info(`Fetching prayer times (attempt ${retryCount + 1})`, {
        latitude,
        longitude,
      });

      const { data: result, error: funcError } =
        await supabase.functions.invoke("prayer-times", {
          body: { latitude, longitude },
        });

      if (funcError) {
        throw new Error(funcError.message || "Failed to call prayer times function");
      }

      if (!result) {
        throw new Error("No data returned from prayer times function");
      }

      setData(result);
      setLoading(false);
    } catch (err: any) {
      if (isAbortError(err)) {
        logger.info("Prayer times request aborted. Ignoring.");
        setLoading(false);
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch prayer times";

      logger.error("Prayer times error", {
        error: err,
        retryCount,
        latitude,
        longitude,
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage,
      });

      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;

        setTimeout(() => {
          fetchPrayerTimes(retryCount + 1);
        }, delay);

        return;
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrayerTimes();

    const interval = setInterval(fetchPrayerTimes, 60 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return { data, loading, error, refetch: fetchPrayerTimes };
};