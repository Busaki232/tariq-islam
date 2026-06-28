import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface NotificationPreferences {
  notifications_enabled: boolean;
  dm_notifications: boolean;
  dm_sound_enabled: boolean;
  group_notifications: boolean;
  group_mentions_only: boolean;
  group_sound_enabled: boolean;
  event_notifications: boolean;
  event_sound_enabled: boolean;
  prayer_notifications: boolean;
  prayer_sound_enabled: boolean;
  dnd_enabled: boolean;
  dnd_during_prayer: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
  dnd_days: number[] | null;
  enable_summary_notifications: boolean;
  summary_delay_minutes: number;
  max_notifications_per_hour: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) {
        // Create default preferences
        const { data: newData, error: insertError } = await supabase
          .from("user_notification_preferences")
          .insert({
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences(newData as NotificationPreferences);
      } else {
        setPreferences(data as NotificationPreferences);
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_notification_preferences")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPreferences(data as NotificationPreferences);
      toast({
        title: "Success",
        description: "Notification preferences updated",
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      toast({
        title: "Error",
        description: "Failed to update notification preferences",
        variant: "destructive",
      });
    }
  };

  return {
    preferences,
    loading,
    updatePreferences,
    refetch: fetchPreferences,
  };
};
