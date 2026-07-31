-- Phase 1: Security Fixes - User Roles System and Enhanced Security

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enhanced audit logging for rate limiting
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  endpoint text NOT NULL,
  ip_address text,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages rate limits"
ON public.api_rate_limits
FOR ALL
USING (public.is_system_user());

-- Enhanced contact access tracking
CREATE TABLE IF NOT EXISTS public.contact_info_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  advertisement_id uuid REFERENCES advertisements(id),
  access_type text NOT NULL, -- 'view', 'export', 'copy'
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contact_info_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages contact access logs"
ON public.contact_info_access_log
FOR ALL
USING (public.is_system_user());

CREATE POLICY "Users can view their own access logs"
ON public.contact_info_access_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to check rate limit for contact info access
CREATE OR REPLACE FUNCTION public.check_contact_access_rate_limit(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_count integer;
BEGIN
  -- Check access in last hour
  SELECT COUNT(*) INTO access_count
  FROM public.contact_info_access_log
  WHERE user_id = _user_id
    AND advertisement_id = _advertisement_id
    AND created_at > now() - interval '1 hour';
  
  -- Allow max 5 accesses per hour per ad
  IF access_count >= 5 THEN
    PERFORM log_security_violation('contact_access_rate_limit', 'advertisements', _user_id);
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Enhanced session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.user_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System manages sessions"
ON public.user_sessions
FOR ALL
USING (public.is_system_user());

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at < now();
END;
$$;

-- Enhanced leadership applications security
-- Remove the loose 2-year time filter and add admin approval
ALTER TABLE public.leadership_applications
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Update RLS policy for leadership applications
DROP POLICY IF EXISTS "Enhanced user access to own leadership applications" ON public.leadership_applications;
DROP POLICY IF EXISTS "Users can view their own leadership applications" ON public.leadership_applications;

CREATE POLICY "Users can view their own leadership applications"
ON public.leadership_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leadership applications"
ON public.leadership_applications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leadership applications"
ON public.leadership_applications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enhanced mosque submissions security
ALTER TABLE public.mosque_submissions
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE POLICY "Admins can view all mosque submissions"
ON public.mosque_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update mosque submissions"
ON public.mosque_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enhanced prayer time updates security
ALTER TABLE public.prayer_time_updates
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS applied boolean DEFAULT false;

CREATE POLICY "Admins can view all prayer time updates"
ON public.prayer_time_updates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update prayer time updates"
ON public.prayer_time_updates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_contact_access_log_user_ad ON public.contact_info_access_log(user_id, advertisement_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_log_created ON public.contact_info_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Insert default admin role (update this user_id with your admin user)
-- Users will need to manually set their first admin through SQL
COMMENT ON TABLE public.user_roles IS 'To create the first admin, run: INSERT INTO public.user_roles (user_id, role) VALUES (''YOUR_USER_ID'', ''admin'');';