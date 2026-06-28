-- CRITICAL SECURITY FIX: Protect Customer Contact Information
-- This migration blocks direct access and implements secure data handling

-- 1. Remove all existing SELECT policies that allow direct table access
DROP POLICY IF EXISTS "Authenticated users can view their own contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Authenticated ad owners can view requests with limited PII" ON public.contact_requests;
DROP POLICY IF EXISTS "Authenticated users can create contact requests" ON public.contact_requests;

-- 2. Create restrictive policies that BLOCK all direct access
-- Users must go through secure RPC functions only
CREATE POLICY "Block all direct SELECT access"
ON public.contact_requests
FOR SELECT
TO public
USING (false);

CREATE POLICY "Block all direct INSERT access"
ON public.contact_requests
FOR INSERT
TO public
WITH CHECK (false);

-- 3. Allow only secure RPC function access via service role
CREATE POLICY "Service role full access"
ON public.contact_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Keep existing UPDATE and DELETE policies for ad owners (they use secure functions)
-- Policy "Authenticated ad owners can update request status" remains

-- 5. Create secure function to submit contact requests with data masking
CREATE OR REPLACE FUNCTION public.submit_contact_request_secure(
  _advertisement_id uuid,
  _requester_name text,
  _requester_email text,
  _message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _result record;
  _risk_score integer;
BEGIN
  -- Validate authentication
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Input validation
  IF _requester_name IS NULL OR trim(_requester_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  
  IF _requester_email IS NULL OR trim(_requester_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  IF _message IS NULL OR trim(_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  -- Check rate limiting (reuse existing trigger logic)
  -- The check_contact_request_rate_limit trigger will handle this

  -- Calculate risk score
  _risk_score := calculate_risk_score(_user_id, _advertisement_id);

  -- Insert with enhanced_contact_request_validation trigger handling security
  INSERT INTO public.contact_requests (
    advertisement_id,
    requester_id,
    requester_name,
    requester_email,
    message,
    risk_score
  ) VALUES (
    _advertisement_id,
    _user_id,
    trim(_requester_name),
    trim(_requester_email),
    trim(_message),
    _risk_score
  )
  RETURNING * INTO _result;

  -- Log security event
  PERFORM audit_sensitive_access('contact_requests', _result.id, 'request_created');

  -- Return masked data (never return actual email in response)
  RETURN jsonb_build_object(
    'id', _result.id,
    'status', _result.status,
    'created_at', _result.created_at,
    'risk_score', _result.risk_score,
    'requires_verification', _result.requires_verification,
    'message', 'Request submitted successfully - details hidden for security'
  );
END;
$$;

-- 6. Enhanced function to get contact requests with complete data masking
CREATE OR REPLACE FUNCTION public.get_user_contact_requests_secure()
RETURNS TABLE(
  id uuid,
  advertisement_id uuid,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  risk_score integer,
  requires_verification boolean,
  access_granted_at timestamp with time zone,
  access_expires_at timestamp with time zone,
  status_changed_at timestamp with time zone,
  -- Masked fields
  requester_name text,
  requester_email text,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    cr.id,
    cr.advertisement_id,
    cr.status,
    cr.created_at,
    cr.updated_at,
    cr.risk_score,
    cr.requires_verification,
    cr.access_granted_at,
    cr.access_expires_at,
    cr.status_changed_at,
    -- User can see their own data
    cr.requester_name,
    cr.requester_email,
    cr.message
  FROM public.contact_requests cr
  WHERE cr.requester_id = _user_id;
END;
$$;

-- 7. Enhanced function for ad owners to view requests with strict PII masking
CREATE OR REPLACE FUNCTION public.get_ad_contact_requests_secure(_advertisement_id uuid)
RETURNS TABLE(
  id uuid,
  advertisement_id uuid,
  status text,
  created_at timestamp with time zone,
  risk_score integer,
  requires_verification boolean,
  access_granted_at timestamp with time zone,
  access_expires_at timestamp with time zone,
  -- Conditional PII visibility
  requester_name text,
  requester_email text,
  message text,
  -- Metadata
  can_view_full_info boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user is the ad owner
  IF NOT is_ad_owner(_user_id, _advertisement_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this advertisement';
  END IF;

  RETURN QUERY
  SELECT 
    cr.id,
    cr.advertisement_id,
    cr.status,
    cr.created_at,
    cr.risk_score,
    cr.requires_verification,
    cr.access_granted_at,
    cr.access_expires_at,
    -- Mask PII unless request is approved and not expired
    CASE 
      WHEN cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.requester_name
      ELSE 'Request #' || substring(cr.id::text from 1 for 8)
    END as requester_name,
    CASE 
      WHEN cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.requester_email
      ELSE '[Contact info available after approval]'
    END as requester_email,
    CASE 
      WHEN cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.message
      ELSE '[Message hidden until you approve this request]'
    END as message,
    -- Flag to indicate if full info is visible
    (cr.status = 'approved' AND 
     cr.access_granted_at IS NOT NULL AND
     (cr.access_expires_at IS NULL OR cr.access_expires_at > now())) as can_view_full_info
  FROM public.contact_requests cr
  WHERE cr.advertisement_id = _advertisement_id
  ORDER BY cr.created_at DESC;
END;
$$;

-- 8. Add encryption helper function for future use (for verification codes)
CREATE OR REPLACE FUNCTION public.hash_sensitive_field(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Use pgcrypto extension for hashing
  RETURN encode(digest(_input, 'sha256'), 'hex');
END;
$$;

-- 9. Update existing get_contact_requests_with_privacy to use new secure logic
CREATE OR REPLACE FUNCTION public.get_contact_requests_with_privacy()
RETURNS TABLE(
  id uuid,
  advertisement_id uuid,
  requester_name text,
  requester_email text,
  message text,
  status text,
  created_at timestamp with time zone,
  status_changed_at timestamp with time zone,
  requester_id uuid,
  risk_score integer,
  requires_verification boolean,
  access_granted_at timestamp with time zone,
  access_expires_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    cr.id,
    cr.advertisement_id,
    -- Show real name only if user owns request OR is ad owner with approved access
    CASE 
      WHEN cr.requester_id = _user_id THEN cr.requester_name
      WHEN is_ad_owner(_user_id, cr.advertisement_id) AND 
           cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.requester_name
      ELSE 'Request #' || substring(cr.id::text from 1 for 8)
    END as requester_name,
    -- Show real email only if user owns request OR is ad owner with approved access
    CASE 
      WHEN cr.requester_id = _user_id THEN cr.requester_email
      WHEN is_ad_owner(_user_id, cr.advertisement_id) AND 
           cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.requester_email
      ELSE '[Hidden until approved]'
    END as requester_email,
    -- Show message only to authorized parties
    CASE 
      WHEN cr.requester_id = _user_id THEN cr.message
      WHEN is_ad_owner(_user_id, cr.advertisement_id) AND 
           cr.status = 'approved' AND 
           cr.access_granted_at IS NOT NULL AND
           (cr.access_expires_at IS NULL OR cr.access_expires_at > now())
      THEN cr.message
      ELSE '[Message hidden]'
    END as message,
    cr.status,
    cr.created_at,
    cr.status_changed_at,
    cr.requester_id,
    cr.risk_score,
    cr.requires_verification,
    cr.access_granted_at,
    cr.access_expires_at
  FROM public.contact_requests cr
  WHERE cr.requester_id = _user_id 
     OR is_ad_owner(_user_id, cr.advertisement_id);
END;
$$;

-- 10. Add comment to document security approach
COMMENT ON TABLE public.contact_requests IS 
'SECURITY: Direct access blocked. All queries must use secure RPC functions that mask PII based on access level and approval status. Functions: submit_contact_request_secure(), get_user_contact_requests_secure(), get_ad_contact_requests_secure(), get_contact_requests_with_privacy()';