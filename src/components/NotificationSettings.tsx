import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Loader2, Bell, BellOff, Moon, Clock, MessageSquare, Calendar, Volume2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";

const ADHAN_CHANNEL_ID = "adhan_channel_v2";

async function ensureAdhanChannel() {
  try {
    await LocalNotifications.createChannel({
      id: ADHAN_CHANNEL_ID,
      name: "Adhan",
      description: "Prayer time Adhan notifications",
      importance: 5, // HIGH
      sound: "adhan", // android/app/src/main/res/raw/adhan.mp3
      vibration: true,
      visibility: 1,
    });
  } catch (e) {
    console.warn("[Adhan] Failed to create channel", e);
  }
}


export const NotificationSettings = () => {
  const { preferences, loading, updatePreferences } = useNotificationPreferences();
  const { 
    requestNotificationPermission, 
    permissionStatus, 
    isInPrayerTime, 
    currentPrayer,
    pushEnabled,
    enablePushNotifications,
    disablePushNotifications 
  } = useSmartNotifications();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <Card className={pushEnabled ? "border-primary" : "border-warning"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Mobile Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications for messages and calls on your phone (works on Android and iOS 16.4+)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications" className="flex flex-col gap-1">
              <span>{pushEnabled ? "Push Notifications Enabled" : "Enable Push Notifications"}</span>
              <span className="text-sm text-muted-foreground font-normal">
                {pushEnabled 
                  ? "You'll receive notifications even when the app is closed" 
                  : "Get notified for calls and messages on your device"}
              </span>
            </Label>
            <Switch
              id="push-notifications"
              checked={pushEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  enablePushNotifications();
                } else {
                  disablePushNotifications();
                }
              }}
            />
          </div>
          
          {!pushEnabled && permissionStatus !== "granted" && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
              <p>To enable push notifications:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Allow browser notifications when prompted</li>
                <li>On iOS: Add this site to your Home Screen for best results</li>
                <li>Toggle the switch above to enable push</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browser Permission */}
      {permissionStatus !== "granted" && !pushEnabled && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Enable Browser Notifications
            </CardTitle>
            <CardDescription>
              Required for push notifications to work
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={requestNotificationPermission}>
              Enable Notifications
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Prayer Time Status */}
      {isInPrayerTime && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Do Not Disturb Active
            </CardTitle>
            <CardDescription>
              Currently in {currentPrayer} prayer time. Notifications are paused.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Master Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Manage all notification settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="master-notifications" className="flex flex-col gap-1">
              <span>Enable All Notifications</span>
              <span className="text-sm text-muted-foreground font-normal">
                Master switch for all notifications
              </span>
            </Label>
            <Switch
              id="master-notifications"
              checked={preferences.notifications_enabled}
              onCheckedChange={(checked) => updatePreferences({ notifications_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-notifications">Direct Messages</Label>
            <Switch
              id="dm-notifications"
              checked={preferences.dm_notifications}
              onCheckedChange={(checked) => updatePreferences({ dm_notifications: checked })}
              disabled={!preferences.notifications_enabled}
            />
          </div>
          
          <div className="flex items-center justify-between pl-6">
            <Label htmlFor="dm-sound" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound
            </Label>
            <Switch
              id="dm-sound"
              checked={preferences.dm_sound_enabled}
              onCheckedChange={(checked) => updatePreferences({ dm_sound_enabled: checked })}
              disabled={!preferences.dm_notifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="group-notifications">Group Messages</Label>
            <Switch
              id="group-notifications"
              checked={preferences.group_notifications}
              onCheckedChange={(checked) => updatePreferences({ group_notifications: checked })}
              disabled={!preferences.notifications_enabled}
            />
          </div>

          <div className="flex items-center justify-between pl-6">
            <Label htmlFor="mentions-only">Mentions Only</Label>
            <Switch
              id="mentions-only"
              checked={preferences.group_mentions_only}
              onCheckedChange={(checked) => updatePreferences({ group_mentions_only: checked })}
              disabled={!preferences.group_notifications}
            />
          </div>

          <div className="flex items-center justify-between pl-6">
            <Label htmlFor="group-sound" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound
            </Label>
            <Switch
              id="group-sound"
              checked={preferences.group_sound_enabled}
              onCheckedChange={(checked) => updatePreferences({ group_sound_enabled: checked })}
              disabled={!preferences.group_notifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Event Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="event-notifications">Event Reminders</Label>
            <Switch
              id="event-notifications"
              checked={preferences.event_notifications}
              onCheckedChange={(checked) => updatePreferences({ event_notifications: checked })}
              disabled={!preferences.notifications_enabled}
            />
          </div>

          <div className="flex items-center justify-between pl-6">
            <Label htmlFor="event-sound" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound
            </Label>
            <Switch
              id="event-sound"
              checked={preferences.event_sound_enabled}
              onCheckedChange={(checked) => updatePreferences({ event_sound_enabled: checked })}
              disabled={!preferences.event_notifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Do Not Disturb */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Do Not Disturb
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dnd-prayer">Auto-DND During Prayer Times</Label>
            <Switch
              id="dnd-prayer"
              checked={preferences.dnd_during_prayer}
              onCheckedChange={(checked) => updatePreferences({ dnd_during_prayer: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="dnd-manual">Manual Do Not Disturb</Label>
            <Switch
              id="dnd-manual"
              checked={preferences.dnd_enabled}
              onCheckedChange={(checked) => updatePreferences({ dnd_enabled: checked })}
            />
          </div>

          {preferences.dnd_enabled && (
            <div className="pl-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dnd-start">Start Time</Label>
                  <Input
                    id="dnd-start"
                    type="time"
                    value={preferences.dnd_start_time || ""}
                    onChange={(e) => updatePreferences({ dnd_start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dnd-end">End Time</Label>
                  <Input
                    id="dnd-end"
                    type="time"
                    value={preferences.dnd_end_time || ""}
                    onChange={(e) => updatePreferences({ dnd_end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Silence notifications during night time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
            <Switch
              id="quiet-hours"
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => updatePreferences({ quiet_hours_enabled: checked })}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) => updatePreferences({ quiet_hours_start: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) => updatePreferences({ quiet_hours_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Bundling */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Bundling</CardTitle>
          <CardDescription>
            Group multiple notifications into summaries to reduce interruptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="bundling">Enable Summary Notifications</Label>
            <Switch
              id="bundling"
              checked={preferences.enable_summary_notifications}
              onCheckedChange={(checked) => updatePreferences({ enable_summary_notifications: checked })}
            />
          </div>

          {preferences.enable_summary_notifications && (
            <>
              <div>
                <Label htmlFor="delay">Bundling Delay (minutes)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="1"
                  max="15"
                  value={preferences.summary_delay_minutes}
                  onChange={(e) => updatePreferences({ summary_delay_minutes: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label htmlFor="max-per-hour">Max Notifications Per Hour</Label>
                <Input
                  id="max-per-hour"
                  type="number"
                  min="1"
                  max="50"
                  value={preferences.max_notifications_per_hour}
                  onChange={(e) => updatePreferences({ max_notifications_per_hour: parseInt(e.target.value) })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
