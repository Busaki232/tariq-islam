import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface NotificationPreferences {
  notifications_enabled: boolean;
  notification_timing: number;
  athan_enabled: boolean;
  athan_audio_id: string;
  notify_fajr: boolean;
  notify_dhuhr: boolean;
  notify_asr: boolean;
  notify_maghrib: boolean;
  notify_isha: boolean;
  notify_jummah: boolean;
}

export const usePrayerNotifications = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast({
        title: 'Not Supported',
        description: 'Notifications are not supported in this browser',
        variant: 'destructive'
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    setPermissionGranted(permission === 'granted');
    
    if (permission === 'granted') {
      toast({
        title: 'Notifications Enabled',
        description: 'You will receive prayer time notifications'
      });
      return true;
    }
    return false;
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('prayer_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences
        const { data: newPrefs, error: insertError } = await supabase
          .from('prayer_notification_preferences')
          .insert([{ user_id: user.id }])
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('prayer_notification_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      
      toast({
        title: 'Settings Updated',
        description: 'Your notification preferences have been saved'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences',
        variant: 'destructive'
      });
    }
  }, [user]);

  const scheduleNotification = useCallback((prayerName: string, prayerTime: string) => {
    if (!preferences?.notifications_enabled || !permissionGranted) return;

    const notificationKey = `notify_${prayerName.toLowerCase()}` as keyof NotificationPreferences;
    if (!preferences[notificationKey]) return;

    // Calculate notification time
    const prayerDate = new Date(prayerTime);
    const notificationTime = new Date(prayerDate.getTime() - preferences.notification_timing * 60000);

    const now = new Date();
    const delay = notificationTime.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        new Notification(`${prayerName} Prayer Time`, {
          body: `Prayer time in ${preferences.notification_timing} minutes`,
          icon: '/favicon.ico',
          tag: prayerName
        });
      }, delay);
    }
  }, [preferences, permissionGranted]);

  return {
    preferences,
    loading,
    permissionGranted,
    requestPermission,
    updatePreferences,
    scheduleNotification
  };
};
