-- Create enum for report types
CREATE TYPE public.report_type AS ENUM (
  'hate_speech',
  'extremism',
  'harassment',
  'spam',
  'violence',
  'inappropriate_content',
  'other'
);

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM (
  'pending',
  'under_review',
  'resolved',
  'dismissed'
);

-- Create enum for moderation action types
CREATE TYPE public.moderation_action AS ENUM (
  'warning',
  'content_removed',
  'user_suspended',
  'user_banned',
  'no_action'
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'post', 'profile', 'review', 'advertisement')),
  content_id UUID NOT NULL,
  report_type report_type NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 1000),
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  is_auto_flagged BOOLEAN NOT NULL DEFAULT false,
  severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create moderation_logs table
CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  action_type moderation_action NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) >= 10),
  content_type TEXT CHECK (content_type IN ('message', 'post', 'profile', 'review', 'advertisement')),
  content_id UUID,
  content_snapshot JSONB,
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create flagged_keywords table for extremist content detection
CREATE TABLE public.flagged_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('extremism', 'violence', 'hate_speech', 'harassment')),
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  redirect_to_education BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_suspensions table
CREATE TABLE public.user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  moderation_log_id UUID REFERENCES public.moderation_logs(id) ON DELETE SET NULL,
  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_guidelines_acceptance table
CREATE TABLE public.community_guidelines_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX idx_reports_content ON public.reports(content_type, content_id);
CREATE INDEX idx_moderation_logs_moderator ON public.moderation_logs(moderator_id);
CREATE INDEX idx_moderation_logs_target_user ON public.moderation_logs(target_user_id);
CREATE INDEX idx_moderation_logs_created ON public.moderation_logs(created_at DESC);
CREATE INDEX idx_user_suspensions_user ON public.user_suspensions(user_id) WHERE is_active = true;
CREATE INDEX idx_flagged_keywords_keyword ON public.flagged_keywords(keyword) WHERE is_active = true;

-- Enable RLS on all tables
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flagged_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_guidelines_acceptance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports table
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by AND reported_by != reported_user_id);

CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reported_by);

CREATE POLICY "Moderators can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- RLS Policies for moderation_logs table
CREATE POLICY "Moderators can insert moderation logs"
  ON public.moderation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND auth.uid() = moderator_id
  );

CREATE POLICY "Moderators can view moderation logs"
  ON public.moderation_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view logs about themselves"
  ON public.moderation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = target_user_id);

-- RLS Policies for flagged_keywords table
CREATE POLICY "Admins can manage flagged keywords"
  ON public.flagged_keywords FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can read active keywords"
  ON public.flagged_keywords FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for user_suspensions table
CREATE POLICY "Moderators can manage suspensions"
  ON public.user_suspensions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view their own suspensions"
  ON public.user_suspensions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for community_guidelines_acceptance
CREATE POLICY "Users can insert their own acceptance"
  ON public.community_guidelines_acceptance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own acceptance"
  ON public.community_guidelines_acceptance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all acceptances"
  ON public.community_guidelines_acceptance FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Function to check if user is suspended
CREATE OR REPLACE FUNCTION public.is_user_suspended(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_suspensions
    WHERE user_id = _user_id
      AND is_active = true
      AND (is_permanent = true OR expires_at > now())
  );
$$;

-- Function to check if user has accepted community guidelines
CREATE OR REPLACE FUNCTION public.has_accepted_guidelines(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_guidelines_acceptance
    WHERE user_id = _user_id
  );
$$;

-- Function to auto-flag content based on keywords
CREATE OR REPLACE FUNCTION public.check_content_for_flags(content TEXT)
RETURNS TABLE(matched_keyword TEXT, category TEXT, severity INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT keyword, category, severity
  FROM public.flagged_keywords
  WHERE is_active = true
    AND content ILIKE '%' || keyword || '%'
  ORDER BY severity DESC;
$$;

-- Trigger to update updated_at on reports
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_reports_updated_at_trigger
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reports_updated_at();

-- Insert some initial flagged keywords (examples - should be expanded)
INSERT INTO public.flagged_keywords (keyword, category, severity, redirect_to_education) VALUES
  ('isis', 'extremism', 10, true),
  ('al-qaeda', 'extremism', 10, true),
  ('jihad kill', 'violence', 10, true),
  ('death to', 'violence', 9, true),
  ('bomb making', 'violence', 10, true),
  ('terrorist attack', 'extremism', 9, true),
  ('kuffar die', 'hate_speech', 9, true),
  ('kill infidels', 'violence', 10, true)
ON CONFLICT (keyword) DO NOTHING;