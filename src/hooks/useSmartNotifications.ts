import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useNotificationPreferences } from "./useNotificationPreferences";
import { usePrayerTimeMonitor } from "./usePrayerTimeMonitor";
import { toast } from "@/hooks/use-toast";

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDpEdsNeFSe1-6F0ErSYywTUMNsYLdVjzJsZ7FKSthZg";

type NotificationType = "dm" | "group" | "mention" | "event" | "prayer";

interface QueuedNotification {
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  priority?: number;
}

export const useSmartNotifications = () => {
  const { user } = useAuth();
  const { preferences } = useNotificationPreferences();
  const prayerWindow = usePrayerTimeMonitor();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
    
    // Check if push is already enabled
    checkPushSubscription();
  }, []);

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        setPushSubscription(subscription);
        setPushEnabled(true);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);
    return permission === "granted";
  };

  const enablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in your browser",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Request notification permission first
      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted) {
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to database
      if (user) {
        const subscriptionJSON = subscription.toJSON();
        
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: subscriptionJSON.keys?.p256dh || '',
            auth: subscriptionJSON.keys?.auth || '',
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
            is_active: true,
          }, {
            onConflict: 'user_id,endpoint'
          });

        if (error) {
          console.error('Error saving push subscription:', error);
          throw error;
        }

        setPushSubscription(subscription);
        setPushEnabled(true);

        toast({
          title: "Push Notifications Enabled",
          description: "You'll receive notifications for messages and calls",
        });

        return true;
      }
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast({
        title: "Failed to Enable",
        description: "Could not enable push notifications",
        variant: "destructive",
      });
      return false;
    }

    return false;
  };

  const disablePushNotifications = async () => {
    try {
      if (pushSubscription) {
        await pushSubscription.unsubscribe();
      }

      if (user) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('user_id', user.id);
      }

      setPushSubscription(null);
      setPushEnabled(false);

      toast({
        title: "Push Notifications Disabled",
        description: "You won't receive push notifications anymore",
      });

      return true;
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      return false;
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const checkDndStatus = useCallback((): boolean => {
    if (!preferences) return false;

    // Check if DND is manually enabled
    if (preferences.dnd_enabled) {
      // Check if we're in the DND time window
      if (preferences.dnd_start_time && preferences.dnd_end_time) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = preferences.dnd_start_time.split(":").map(Number);
        const [endHour, endMin] = preferences.dnd_end_time.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (currentTime >= startMinutes && currentTime < endMinutes) {
          return true;
        }
      } else {
        return true; // DND enabled without specific times means always on
      }
    }

    // Check auto-DND during prayer times
    if (preferences.dnd_during_prayer && prayerWindow.inPrayerTime) {
      return true;
    }

    // Check quiet hours
    if (preferences.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = preferences.quiet_hours_start.split(":").map(Number);
      const [endHour, endMin] = preferences.quiet_hours_end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Handle overnight quiet hours (e.g., 22:00 to 07:00)
      if (startMinutes > endMinutes) {
        if (currentTime >= startMinutes || currentTime < endMinutes) {
          return true;
        }
      } else {
        if (currentTime >= startMinutes && currentTime < endMinutes) {
          return true;
        }
      }
    }

    return false;
  }, [preferences, prayerWindow]);

  const shouldSendNotification = useCallback((type: NotificationType, priority: number = 1): boolean => {
    if (!preferences || !preferences.notifications_enabled) return false;

    // Urgent notifications (priority 4) bypass DND for mentions and prayer times
    if (priority >= 4 && (type === "mention" || type === "prayer")) {
      return true;
    }

    // Check DND status
    if (checkDndStatus()) {
      return false;
    }

    // Check type-specific preferences
    switch (type) {
      case "dm":
        return preferences.dm_notifications;
      case "group":
        return preferences.group_notifications;
      case "mention":
        return preferences.group_notifications; // Mentions depend on group notifications
      case "event":
        return preferences.event_notifications;
      case "prayer":
        return preferences.prayer_notifications;
      default:
        return false;
    }
  }, [preferences, checkDndStatus]);

  const queueNotification = async (notification: QueuedNotification) => {
    if (!user) return;

    try {
      const priority = notification.priority || 1;
      const scheduledAt = new Date();

      // Add delay for bundling if enabled and not urgent
      if (preferences?.enable_summary_notifications && priority < 4) {
        scheduledAt.setMinutes(scheduledAt.getMinutes() + (preferences.summary_delay_minutes || 5));
      }

      await supabase.from("notification_queue").insert({
        user_id: user.id,
        notification_type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata || {},
        priority,
        scheduled_at: scheduledAt.toISOString(),
      });

      // For urgent notifications, send immediately
      if (priority >= 4 && shouldSendNotification(notification.type, priority)) {
        sendImmediateNotification(notification);
      }
    } catch (error) {
      console.error("Error queueing notification:", error);
    }
  };

  const sendImmediateNotification = (notification: QueuedNotification) => {
    if (permissionStatus !== "granted") return;
    if (!shouldSendNotification(notification.type, notification.priority || 1)) return;

    const notif = new Notification(notification.title, {
      body: notification.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });

    // Play sound if enabled for this type
    const shouldPlaySound = 
      (notification.type === "dm" && preferences?.dm_sound_enabled) ||
      (notification.type === "group" && preferences?.group_sound_enabled) ||
      (notification.type === "mention" && preferences?.group_sound_enabled) ||
      (notification.type === "event" && preferences?.event_sound_enabled) ||
      (notification.type === "prayer" && preferences?.prayer_sound_enabled);

    if (shouldPlaySound) {
      // You can add a notification sound here
      // new Audio("/notification.mp3").play();
    }

    return notif;
  };

  return {
    permissionStatus,
    requestNotificationPermission,
    queueNotification,
    shouldSendNotification,
    checkDndStatus,
    isInPrayerTime: prayerWindow.inPrayerTime,
    currentPrayer: prayerWindow.prayerName,
    pushEnabled,
    enablePushNotifications,
    disablePushNotifications,
  };
};
