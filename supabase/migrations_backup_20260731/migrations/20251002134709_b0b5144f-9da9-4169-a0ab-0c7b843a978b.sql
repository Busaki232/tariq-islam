-- Phase 2: Prayer Notifications - Prayer Tracking System
-- Phase 3: Event RSVP Enhancements
-- Phase 4: Chat Enhancements
-- Phase 5: Mosque Reviews System

-- ===== PHASE 2: PRAYER TRACKING =====

-- Prayer tracking for user statistics
CREATE TABLE public.prayer_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prayer_name text NOT NULL, -- 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'
  prayer_date date NOT NULL,
  completed_at timestamptz DEFAULT now(),
  on_time boolean DEFAULT true,
  location text,
  UNIQUE(user_id, prayer_name, prayer_date)
);

ALTER TABLE public.prayer_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own prayer completions"
ON public.prayer_completions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Prayer notification preferences
CREATE TABLE public.prayer_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notifications_enabled boolean DEFAULT true,
  notification_timing integer DEFAULT 15, -- minutes before prayer
  athan_enabled boolean DEFAULT true,
  athan_audio_id text DEFAULT 'makkah',
  notify_fajr boolean DEFAULT true,
  notify_dhuhr boolean DEFAULT true,
  notify_asr boolean DEFAULT true,
  notify_maghrib boolean DEFAULT true,
  notify_isha boolean DEFAULT true,
  notify_jummah boolean DEFAULT true,
  jummah_reminder_day text DEFAULT 'Friday',
  jummah_reminder_time time DEFAULT '09:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prayer_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification preferences"
ON public.prayer_notification_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ===== PHASE 3: EVENT RSVP ENHANCEMENTS =====

-- Add additional columns to event_rsvps
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS rsvp_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS check_in_time timestamptz,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_event_rsvps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_event_rsvps_updated_at ON public.event_rsvps;
CREATE TRIGGER set_event_rsvps_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_event_rsvps_updated_at();

-- Event waitlist for when events are full
CREATE TABLE public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  notified_at timestamptz,
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist entries"
ON public.event_waitlist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own waitlist entries"
ON public.event_waitlist
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event organizers can view waitlist for their events"
ON public.event_waitlist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_waitlist.event_id
    AND events.organizer_id = auth.uid()
  )
);

-- ===== PHASE 4: CHAT ENHANCEMENTS =====

-- Add new columns to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_by jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES messages(id),
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS forwarded_from uuid REFERENCES messages(id);

-- Message attachments table
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL, -- 'image', 'document', 'video', 'audio'
  file_size integer NOT NULL,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their messages"
ON public.message_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_attachments.message_id
    AND (
      messages.recipient_id IS NULL -- public message
      OR messages.sender_id = auth.uid()
      OR messages.recipient_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload attachments to their messages"
ON public.message_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Typing indicators (uses Realtime presence, no table needed)
-- But we'll track typing history for analytics
CREATE TABLE public.typing_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  room_id text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.typing_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages typing activity log"
ON public.typing_activity_log
FOR ALL
USING (public.is_system_user());

-- ===== PHASE 5: MOSQUE REVIEWS SYSTEM =====

-- Mosques master table (for when user-submitted mosques are created)
CREATE TABLE public.mosques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text,
  phone text,
  email text,
  website text,
  imam_name text,
  languages text[],
  services text[],
  description text,
  prayer_times jsonb,
  image_url text,
  rating_average numeric(3,2) DEFAULT 0,
  review_count integer DEFAULT 0,
  verified boolean DEFAULT false,
  claimed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mosques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mosques"
ON public.mosques
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage mosques"
ON public.mosques
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mosque reviews
CREATE TABLE public.mosque_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid REFERENCES mosques(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text NOT NULL CHECK (length(title) >= 5),
  review_text text NOT NULL CHECK (length(review_text) >= 50),
  visit_date date,
  
  -- Category ratings
  cleanliness_rating integer CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  friendliness_rating integer CHECK (friendliness_rating >= 1 AND friendliness_rating <= 5),
  parking_rating integer CHECK (parking_rating >= 1 AND parking_rating <= 5),
  accessibility_rating integer CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5),
  facilities_rating integer CHECK (facilities_rating >= 1 AND facilities_rating <= 5),
  
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_verified_visit boolean DEFAULT false,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  
  UNIQUE(mosque_id, user_id)
);

ALTER TABLE public.mosque_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved reviews"
ON public.mosque_reviews
FOR SELECT
TO authenticated
USING (NOT is_flagged OR auth.uid() = user_id);

CREATE POLICY "Users can create reviews"
ON public.mosque_reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.mosque_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.mosque_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews"
ON public.mosque_reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Review helpfulness tracking
CREATE TABLE public.review_helpfulness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES mosque_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_helpful boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.review_helpfulness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review helpfulness"
ON public.review_helpfulness
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can mark reviews as helpful"
ON public.review_helpfulness
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their helpfulness votes"
ON public.review_helpfulness
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Review photos
CREATE TABLE public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES mosque_reviews(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review photos"
ON public.review_photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can upload photos to their reviews"
ON public.review_photos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Mosque admin responses to reviews
CREATE TABLE public.review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES mosque_reviews(id) ON DELETE CASCADE NOT NULL,
  mosque_id uuid REFERENCES mosques(id) NOT NULL,
  responder_id uuid REFERENCES auth.users(id) NOT NULL,
  response_text text NOT NULL CHECK (length(response_text) >= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(review_id)
);

ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view responses"
ON public.review_responses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Mosque admins can respond to reviews"
ON public.review_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mosques
    WHERE mosques.id = mosque_id
    AND mosques.claimed_by = auth.uid()
  )
);

-- Functions for review system

-- Update mosque rating average
CREATE OR REPLACE FUNCTION update_mosque_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mosques
  SET 
    rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM mosque_reviews
      WHERE mosque_id = COALESCE(NEW.mosque_id, OLD.mosque_id)
      AND NOT is_flagged
    ),
    review_count = (
      SELECT COUNT(*)
      FROM mosque_reviews
      WHERE mosque_id = COALESCE(NEW.mosque_id, OLD.mosque_id)
      AND NOT is_flagged
    )
  WHERE id = COALESCE(NEW.mosque_id, OLD.mosque_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_mosque_rating_on_review ON public.mosque_reviews;
CREATE TRIGGER update_mosque_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.mosque_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_mosque_rating();

-- Update helpfulness counts
CREATE OR REPLACE FUNCTION update_review_helpfulness_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mosque_reviews
  SET 
    helpful_count = (
      SELECT COUNT(*)
      FROM review_helpfulness
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
      AND is_helpful = true
    ),
    not_helpful_count = (
      SELECT COUNT(*)
      FROM review_helpfulness
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
      AND is_helpful = false
    )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_helpfulness_count ON public.review_helpfulness;
CREATE TRIGGER update_helpfulness_count
  AFTER INSERT OR UPDATE OR DELETE ON public.review_helpfulness
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpfulness_count();

-- Create indexes for performance
CREATE INDEX idx_prayer_completions_user_date ON public.prayer_completions(user_id, prayer_date);
CREATE INDEX idx_prayer_notification_prefs_user ON public.prayer_notification_preferences(user_id);
CREATE INDEX idx_event_waitlist_event ON public.event_waitlist(event_id);
CREATE INDEX idx_message_attachments_message ON public.message_attachments(message_id);
CREATE INDEX idx_mosque_reviews_mosque ON public.mosque_reviews(mosque_id);
CREATE INDEX idx_mosque_reviews_rating ON public.mosque_reviews(rating);
CREATE INDEX idx_mosque_reviews_created ON public.mosque_reviews(created_at DESC);
CREATE INDEX idx_review_helpfulness_review ON public.review_helpfulness(review_id);
CREATE INDEX idx_mosques_rating ON public.mosques(rating_average DESC);