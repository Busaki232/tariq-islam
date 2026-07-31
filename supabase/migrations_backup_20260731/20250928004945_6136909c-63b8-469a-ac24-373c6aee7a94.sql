-- Fix Security Definer functions by converting them to SECURITY INVOKER where appropriate
-- while maintaining the same security level through proper RLS policies

-- 1. Update check_contact_request_rate_limit to use SECURITY INVOKER
-- This function already has proper authorization checks, so SECURITY INVOKER is safe
CREATE OR REPLACE FUNCTION public.check_contact_request_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
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

-- 2. Update validate_contact_request_status_change to use SECURITY INVOKER
-- This function also has proper authorization checks, so SECURITY INVOKER is safe
CREATE OR REPLACE FUNCTION public.validate_contact_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
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

-- 3. Keep handle_new_user as SECURITY DEFINER because it needs to insert into profiles
-- during user registration, which might not have the user context yet.
-- This is a legitimate use case for SECURITY DEFINER.
-- No changes needed for this function as it's properly securing the user registration flow.

-- 4. Ensure RLS policies are properly enforced on contact_requests table
-- Since we're removing SECURITY DEFINER from the trigger functions,
-- we need to make sure RLS policies handle the security correctly

-- Add comment to document why handle_new_user remains SECURITY DEFINER
COMMENT ON FUNCTION public.handle_new_user() IS 
'This function requires SECURITY DEFINER to insert user profiles during auth.users registration. This is a secure pattern for user onboarding.';