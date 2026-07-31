-- Phase 1: Convert RLS helper functions to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.is_ad_owner(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM advertisements 
    WHERE id = _advertisement_id AND user_id = _user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_contact_info(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  -- User can view contact info if they own the ad OR have an approved contact request
  SELECT EXISTS (
    SELECT 1 FROM advertisements 
    WHERE id = _advertisement_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM contact_requests 
    WHERE advertisement_id = _advertisement_id 
      AND requester_id = _user_id 
      AND status = 'approved'
  );
$function$;

-- Phase 2: Drop the problematic SECURITY DEFINER function and create secure view
DROP FUNCTION IF EXISTS public.get_sanitized_contact_requests(uuid);

-- Create a secure view for contact requests with privacy controls
CREATE OR REPLACE VIEW public.contact_requests_with_privacy AS
SELECT 
  cr.id,
  cr.advertisement_id,
  CASE 
    WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.requester_name
    ELSE 'Contact Request #' || substring(cr.id::text from 1 for 8)
  END as requester_name,
  CASE 
    WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.requester_email
    ELSE '[Hidden until approved]'
  END as requester_email,
  CASE 
    WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.message
    ELSE '[Message hidden until approved]'
  END as message,
  cr.status,
  cr.created_at,
  cr.status_changed_at,
  cr.requester_id
FROM public.contact_requests cr
WHERE is_ad_owner(auth.uid(), cr.advertisement_id) OR cr.requester_id = auth.uid();

-- Create a SECURITY INVOKER function to query contact requests
CREATE OR REPLACE FUNCTION public.get_contact_requests_for_ad(ad_id uuid)
RETURNS TABLE(
  id uuid, 
  advertisement_id uuid, 
  requester_name text, 
  requester_email text, 
  message text, 
  status text, 
  created_at timestamp with time zone, 
  status_changed_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT 
    crvp.id,
    crvp.advertisement_id,
    crvp.requester_name,
    crvp.requester_email,
    crvp.message,
    crvp.status,
    crvp.created_at,
    crvp.status_changed_at
  FROM public.contact_requests_with_privacy crvp
  WHERE crvp.advertisement_id = ad_id;
$function$;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.contact_requests_with_privacy TO authenticated;

-- Phase 3: Enhance trigger functions with input validation (keep SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.validate_contact_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Input validation
  IF NEW.id IS NULL OR NEW.advertisement_id IS NULL OR NEW.requester_id IS NULL THEN
    RAISE EXCEPTION 'Required fields cannot be null';
  END IF;
  
  -- Validate status values
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status value: %', NEW.status;
  END IF;
  
  -- Authorization check: only ad owners can change status
  IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
    IF NOT is_ad_owner(auth.uid(), NEW.advertisement_id) THEN
      RAISE EXCEPTION 'Only advertisement owners can change request status';
    END IF;
    
    -- Only allow specific status transitions
    IF OLD.status = 'pending' AND NEW.status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    -- Approved/rejected requests cannot be changed back to pending
    IF OLD.status IN ('approved', 'rejected') AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'Cannot change status from % back to pending', OLD.status;
    END IF;
    
    -- Update audit fields when status changes
    NEW.status_changed_at = now();
    NEW.status_changed_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_contact_request_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_count integer;
  recent_requests integer;
BEGIN
  -- Input validation
  IF NEW.requester_id IS NULL OR NEW.advertisement_id IS NULL THEN
    RAISE EXCEPTION 'Requester ID and Advertisement ID cannot be null';
  END IF;
  
  -- Authorization check: ensure user can only create requests for themselves
  IF NEW.requester_id != auth.uid() THEN
    RAISE EXCEPTION 'Users can only create contact requests for themselves';
  END IF;
  
  -- Validate required fields
  IF NEW.requester_name IS NULL OR trim(NEW.requester_name) = '' THEN
    RAISE EXCEPTION 'Requester name cannot be empty';
  END IF;
  
  IF NEW.requester_email IS NULL OR trim(NEW.requester_email) = '' THEN
    RAISE EXCEPTION 'Requester email cannot be empty';
  END IF;
  
  IF NEW.message IS NULL OR trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  
  -- Check if user has made too many requests to the same ad in the last hour
  SELECT COUNT(*) INTO recent_requests
  FROM public.contact_requests
  WHERE requester_id = NEW.requester_id 
    AND advertisement_id = NEW.advertisement_id
    AND created_at > now() - interval '1 hour';
    
  IF recent_requests >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 3 requests per advertisement per hour';
  END IF;
  
  -- Check total requests per user in the last 24 hours
  SELECT COUNT(*) INTO request_count
  FROM public.contact_requests
  WHERE requester_id = NEW.requester_id
    AND created_at > now() - interval '24 hours';
    
  IF request_count >= 10 THEN
    RAISE EXCEPTION 'Daily rate limit exceeded: Maximum 10 contact requests per day';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Phase 4: Convert maintenance function to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.cleanup_old_contact_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Input validation: ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for cleanup operations';
  END IF;
  
  -- Delete rejected requests older than 90 days
  DELETE FROM public.contact_requests
  WHERE status = 'rejected' 
    AND created_at < now() - interval '90 days';
    
  -- Delete pending requests older than 30 days (likely abandoned)
  DELETE FROM public.contact_requests
  WHERE status = 'pending' 
    AND created_at < now() - interval '30 days';
END;
$function$;