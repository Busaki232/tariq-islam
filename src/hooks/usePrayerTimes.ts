import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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

export const usePrayerTimes = (latitude?: number, longitude?: number): UsePrayerTimesReturn => {
  const [data, setData] = useState<PrayerTimesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrayerTimes = async (retryCount = 0) => {
    if (!latitude || !longitude) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logger.info(`Fetching prayer times (attempt ${retryCount + 1})`, { latitude, longitude });

      // Add timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const { data: result, error: funcError } = await supabase.functions.invoke('prayer-times', {
        body: { latitude, longitude }
      });

      clearTimeout(timeoutId);

      if (funcError) {
        logger.error('Edge function error', {
          message: funcError.message,
          context: funcError.context,
          status: funcError.status
        });
        throw new Error(funcError.message || 'Failed to call prayer times function');
      }

      if (!result) {
        throw new Error('No data returned from prayer times function');
      }

      logger.info('Prayer times fetched successfully', result);
      setData(result);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prayer times';
      logger.error('Prayer times error', {
        error: err,
        retryCount,
        latitude,
        longitude,
        errorName: err instanceof Error ? err.name : 'Unknown',
        errorMessage
      });

      // Retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        logger.info(`Retrying in ${delay}ms...`);
        
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
    
    // Refresh prayer times every hour
    const interval = setInterval(fetchPrayerTimes, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return { data, loading, error, refetch: fetchPrayerTimes };
};