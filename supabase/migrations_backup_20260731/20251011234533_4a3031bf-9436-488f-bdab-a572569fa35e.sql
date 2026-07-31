-- ============================================
-- COMPREHENSIVE SECURITY ENHANCEMENT MIGRATION
-- Implements: Rate limiting, explicit deny policies, audit logging, admin audit system
-- ============================================

-- 1. Partnership Inquiry Rate Limiting
-- ============================================

-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.partnership_inquiry_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  submission_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partnership_inquiry_rate_limits ENABLE ROW LEVEL SECURITY;

-- System can manage rate limits
CREATE POLICY "System manages partnership rate limits"
ON public.partnership_inquiry_rate_limits FOR ALL
USING (is_system_user());

-- Rate limiting function (max 3 submissions per IP per hour)
CREATE OR REPLACE FUNCTION public.check_partnership_inquiry_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_ip text;
  recent_count integer;
BEGIN
  -- Get IP from request headers
  request_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  
  -- If no IP found, use fallback
  IF request_ip IS NULL THEN
    request_ip := 'unknown';
  END IF;
  
  -- Count recent submissions from this IP in last hour
  SELECT COUNT(*) INTO recent_count
  FROM public.partnership_inquiry_rate_limits
  WHERE ip_address = request_ip
    AND created_at > now() - interval '1 hour';
  
  -- Rate limit: 3 submissions per IP per hour
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again in an hour.';
  END IF;
  
  -- Log this submission attempt
  INSERT INTO public.partnership_inquiry_rate_limits (ip_address)
  VALUES (request_ip);
  
  RETURN NEW;
END;
$$;

-- Attach trigger to partnership_inquiries
CREATE TRIGGER partnership_inquiry_rate_limit_trigger
  BEFORE INSERT ON public.partnership_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_partnership_inquiry_rate_limit();

-- 2. Explicit Anonymous Deny Policies
-- ============================================

-- Block anonymous access to profiles (protect phone numbers)
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles FOR ALL
TO anon
USING (false);

-- Block anonymous direct access to contact_requests
CREATE POLICY "Block anonymous access to contact_requests"
ON public.contact_requests FOR ALL
TO anon
USING (false);

-- Block anonymous access to advertisements
CREATE POLICY "Block anonymous access to advertisements"
ON public.advertisements FOR ALL
TO anon
USING (false);

-- Block anonymous access to leadership applications
CREATE POLICY "Block anonymous access to leadership_applications"
ON public.leadership_applications FOR ALL
TO anon
USING (false);

-- Block anonymous access to mosque submissions
CREATE POLICY "Block anonymous access to mosque_submissions"
ON public.mosque_submissions FOR ALL
TO anon
USING (false);

-- Block anonymous access to prayer time updates
CREATE POLICY "Block anonymous access to prayer_time_updates"
ON public.prayer_time_updates FOR ALL
TO anon
USING (false);

-- 3. Message Deletion Audit Logging
-- ============================================

-- Audit function for message soft deletes
CREATE OR REPLACE FUNCTION public.audit_message_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when is_deleted changes from false to true
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    -- Log to security_logs table
    INSERT INTO public.security_logs (
      violation_type,
      table_name,
      user_id,
      details
    ) VALUES (
      'message_soft_deleted',
      'messages',
      auth.uid(),
      jsonb_build_object(
        'message_id', OLD.id,
        'sender_id', OLD.sender_id,
        'recipient_id', OLD.recipient_id,
        'content_preview', substring(OLD.content, 1, 50),
        'deleted_at', now(),
        'message_type', OLD.message_type
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Don't block deletion if logging fails
    RAISE WARNING 'Failed to log message deletion: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Attach trigger to messages table
CREATE TRIGGER message_deletion_audit_trigger
  AFTER UPDATE OF is_deleted ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_message_deletion();

-- 4. Admin Audit Log System
-- ============================================

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user 
  ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at 
  ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_table_record 
  ON public.admin_audit_log(table_name, record_id);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.admin_audit_log FOR INSERT
WITH CHECK (is_system_user());

-- Helper function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action_type text,
  _table_name text,
  _record_id uuid DEFAULT NULL,
  _changes jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action_type,
    table_name,
    record_id,
    changes,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    _action_type,
    _table_name,
    _record_id,
    _changes,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails
    RAISE WARNING 'Failed to log admin action: %', SQLERRM;
END;
$$;

-- 5. Maintenance Function
-- ============================================

-- Cleanup expired rate limit records (run daily via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.partnership_inquiry_rate_limits
  WHERE created_at < now() - interval '24 hours';
END;
$$;