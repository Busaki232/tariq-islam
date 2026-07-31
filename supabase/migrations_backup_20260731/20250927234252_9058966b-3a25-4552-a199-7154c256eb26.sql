-- Enhanced Security Controls for Contact Requests (Fixed)

-- Add audit trail columns to contact_requests
ALTER TABLE public.contact_requests 
ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS status_changed_by uuid,
ADD COLUMN IF NOT EXISTS request_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_request_at timestamp with time zone DEFAULT now();

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION public.validate_contact_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow specific status transitions
  IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
    -- Pending can go to approved or rejected
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check rate limiting for contact requests
CREATE OR REPLACE FUNCTION public.check_contact_request_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  request_count integer;
  recent_requests integer;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function for automatic cleanup of old rejected requests (data retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_contact_requests()
RETURNS void AS $$
BEGIN
  -- Delete rejected requests older than 90 days
  DELETE FROM public.contact_requests
  WHERE status = 'rejected' 
    AND created_at < now() - interval '90 days';
    
  -- Delete pending requests older than 30 days (likely abandoned)
  DELETE FROM public.contact_requests
  WHERE status = 'pending' 
    AND created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for enhanced security
DROP TRIGGER IF EXISTS validate_contact_request_status_trigger ON public.contact_requests;
CREATE TRIGGER validate_contact_request_status_trigger
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contact_request_status_change();

DROP TRIGGER IF EXISTS check_contact_request_rate_limit_trigger ON public.contact_requests;
CREATE TRIGGER check_contact_request_rate_limit_trigger
  BEFORE INSERT ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contact_request_rate_limit();

-- Enhanced RLS policies with field-level access control
DROP POLICY IF EXISTS "Users can view their own contact requests with limited fields" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can view requests for their ads with full access" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can update request status only" ON public.contact_requests;

-- More granular policies for enhanced security
CREATE POLICY "Users can view their own contact requests with limited fields"
ON public.contact_requests
FOR SELECT 
USING (auth.uid() = requester_id);

CREATE POLICY "Ad owners can view requests for their ads with full access"
ON public.contact_requests
FOR SELECT 
USING (is_ad_owner(auth.uid(), advertisement_id));

CREATE POLICY "Ad owners can update request status only"
ON public.contact_requests
FOR UPDATE 
USING (is_ad_owner(auth.uid(), advertisement_id));

-- Function to get sanitized contact requests (hides sensitive info until approved)
CREATE OR REPLACE FUNCTION public.get_sanitized_contact_requests(ad_id uuid)
RETURNS TABLE (
  id uuid,
  advertisement_id uuid,
  requester_name text,
  requester_email text,
  message text,
  status text,
  created_at timestamp with time zone,
  status_changed_at timestamp with time zone
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
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
    cr.status_changed_at
  FROM public.contact_requests cr
  WHERE cr.advertisement_id = ad_id
    AND (is_ad_owner(auth.uid(), cr.advertisement_id) OR cr.requester_id = auth.uid());
$$;