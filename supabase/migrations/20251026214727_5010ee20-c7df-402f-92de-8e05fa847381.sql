-- Create user notification preferences table
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Master switches
  notifications_enabled BOOLEAN DEFAULT true,
  
  -- Channel-specific settings
  dm_notifications BOOLEAN DEFAULT true,
  dm_sound_enabled BOOLEAN DEFAULT true,
  group_notifications BOOLEAN DEFAULT true,
  group_mentions_only BOOLEAN DEFAULT false,
  group_sound_enabled BOOLEAN DEFAULT true,
  event_notifications BOOLEAN DEFAULT true,
  event_sound_enabled BOOLEAN DEFAULT true,
  prayer_notifications BOOLEAN DEFAULT true,
  prayer_sound_enabled BOOLEAN DEFAULT true,
  
  -- Do Not Disturb settings
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_during_prayer BOOLEAN DEFAULT true,
  dnd_start_time TIME,
  dnd_end_time TIME,
  dnd_days INTEGER[],
  
  -- Summary/Bundling settings
  enable_summary_notifications BOOLEAN DEFAULT true,
  summary_delay_minutes INTEGER DEFAULT 5,
  max_notifications_per_hour INTEGER DEFAULT 10,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notification queue table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 1,
  is_sent BOOLEAN DEFAULT false,
  is_bundled BOOLEAN DEFAULT false,
  bundle_id UUID,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_notification_queue_user_pending 
  ON notification_queue(user_id, is_sent, scheduled_at) 
  WHERE NOT is_sent;

CREATE INDEX idx_notification_queue_bundle 
  ON notification_queue(bundle_id) 
  WHERE bundle_id IS NOT NULL;

CREATE INDEX idx_notification_queue_type 
  ON notification_queue(user_id, notification_type, is_sent);

-- Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_notification_preferences
CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for notification_queue
CREATE POLICY "Users can view own notifications"
  ON notification_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notification_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage notification queue"
  ON notification_queue FOR ALL
  USING (is_system_user());

-- Add trigger for updated_at
CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();