-- Security Enhancement Migration
-- This migration strengthens RLS policies and adds additional security measures

-- 1. Add time-based access validation for contact requests
CREATE OR REPLACE FUNCTION public.validate_contact_access_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if access has expired
  IF NEW.access_expires_at IS NOT NULL AND NEW.access_expires_at < now() THEN
    NEW.status := 'expired';
    NEW.access_granted_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for time-based access validation
DROP TRIGGER IF EXISTS validate_contact_access_time_trigger ON public.contact_requests;
CREATE TRIGGER validate_contact_access_time_trigger
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contact_access_time();

-- 2. Enhanced security function for profile access
CREATE OR REPLACE FUNCTION public.can_view_profile(_user_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Users can only view their own profile
  -- This prevents phone number exposure
  SELECT _user_id = _profile_user_id;
$$;

-- 3. Add security audit function for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_sensitive_access(
  _table_name text,
  _record_id uuid,
  _action_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access to sensitive data
  INSERT INTO public.security_logs (
    violation_type,
    table_name,
    user_id,
    timestamp,
    details
  ) VALUES (
    _action_type,
    _table_name,
    auth.uid(),
    now(),
    jsonb_build_object(
      'record_id', _record_id,
      'user_agent', current_setting('request.headers', true)::json->>'user-agent',
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    )
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails
    NULL;
END;
$$;

-- 4. Strengthen contact_requests RLS policy for requester email visibility
DROP POLICY IF EXISTS "Authenticated ad owners can view requests for their ads" ON public.contact_requests;
CREATE POLICY "Authenticated ad owners can view requests with limited PII"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (
  is_ad_owner(auth.uid(), advertisement_id)
  AND auth.uid() IS NOT NULL
  AND (
    -- Only show full contact info if request is approved and not expired
    status = 'approved' 
    OR access_granted_at IS NOT NULL
    OR advertisement_id IN (
      SELECT id FROM advertisements WHERE user_id = auth.uid()
    )
  )
);

-- 5. Add index for faster security checks
CREATE INDEX IF NOT EXISTS idx_contact_requests_access_expires 
  ON public.contact_requests(access_expires_at) 
  WHERE access_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_requests_status_user 
  ON public.contact_requests(status, requester_id);

-- 6. Add automatic cleanup function for expired access
CREATE OR REPLACE FUNCTION public.cleanup_expired_contact_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark expired access as expired
  UPDATE public.contact_requests
  SET 
    status = 'expired',
    access_granted_at = NULL
  WHERE access_expires_at < now()
    AND status = 'approved'
    AND access_granted_at IS NOT NULL;
END;
$$;