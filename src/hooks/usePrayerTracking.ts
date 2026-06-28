import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface PrayerCompletion {
  id: string;
  prayer_name: string;
  prayer_date: string;
  completed_at: string;
  on_time: boolean;
}

export const usePrayerTracking = () => {
  const { user } = useAuth();
  const [todaysPrayers, setTodaysPrayers] = useState<PrayerCompletion[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTodaysPrayers = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('prayer_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('prayer_date', today);

      if (error) throw error;
      setTodaysPrayers(data || []);
    } catch (error) {
      console.error('Error fetching prayers:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const calculateStreak = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('prayer_completions')
        .select('prayer_date')
        .eq('user_id', user.id)
        .order('prayer_date', { ascending: false });

      if (error) throw error;

      // Calculate consecutive days
      let currentStreak = 0;
      let lastDate: Date | null = null;

      for (const record of data || []) {
        const recordDate = new Date(record.prayer_date);
        
        if (!lastDate) {
          lastDate = recordDate;
          currentStreak = 1;
          continue;
        }

        const dayDiff = Math.floor((lastDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          currentStreak++;
          lastDate = recordDate;
        } else if (dayDiff > 1) {
          break;
        }
      }

      setStreak(currentStreak);
    } catch (error) {
      console.error('Error calculating streak:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchTodaysPrayers();
    calculateStreak();
  }, [fetchTodaysPrayers, calculateStreak]);

  const markPrayerComplete = useCallback(async (prayerName: string, onTime: boolean = true) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('prayer_completions')
        .upsert({
          user_id: user.id,
          prayer_name: prayerName,
          prayer_date: today,
          on_time: onTime
        }, {
          onConflict: 'user_id,prayer_name,prayer_date'
        });

      if (error) throw error;

      await fetchTodaysPrayers();
      await calculateStreak();

      toast({
        title: `${prayerName} Prayer Marked`,
        description: 'May Allah accept your prayers'
      });
    } catch (error) {
      console.error('Error marking prayer:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark prayer as complete',
        variant: 'destructive'
      });
    }
  }, [user, fetchTodaysPrayers, calculateStreak]);

  const isPrayerCompleted = (prayerName: string) => {
    return todaysPrayers.some(p => p.prayer_name === prayerName);
  };

  return {
    todaysPrayers,
    streak,
    loading,
    markPrayerComplete,
    isPrayerCompleted
  };
};
