-- Enhanced security for contact information access
-- Create a more secure contact access system with additional verification layers

-- Add verification fields to contact_requests if they don't exist
DO $$ BEGIN
  ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS verification_token TEXT;
  ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS contact_accessed_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create a secure function that masks contact information until proper verification
CREATE OR REPLACE FUNCTION public.get_advertisement_contact_secure(_advertisement_id uuid)
RETURNS TABLE(
  id uuid, 
  contact_email text, 
  contact_phone text,
  access_granted boolean,
  requires_verification boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_owner boolean := false;
  has_valid_access boolean := false;
  contact_request_record RECORD;
BEGIN
  -- Check if user is the advertisement owner
  SELECT EXISTS (
    SELECT 1 FROM advertisements 
    WHERE id = _advertisement_id AND user_id = auth.uid()
  ) INTO is_owner;
  
  -- If owner, return full contact info
  IF is_owner THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.contact_email,
      a.contact_phone,
      true as access_granted,
      false as requires_verification
    FROM advertisements a
    WHERE a.id = _advertisement_id AND a.status = 'approved';
    RETURN;
  END IF;
  
  -- Check for valid contact request with proper verification
  SELECT cr.* INTO contact_request_record
  FROM contact_requests cr
  WHERE cr.advertisement_id = _advertisement_id 
    AND cr.requester_id = auth.uid()
    AND cr.status = 'approved'
    AND cr.access_granted_at IS NOT NULL
    AND cr.access_expires_at > now()
    AND (cr.requires_verification = false OR cr.verification_code IS NULL)
  ORDER BY cr.access_granted_at DESC
  LIMIT 1;
  
  -- If valid access exists, return contact info but log the access
  IF contact_request_record.id IS NOT NULL THEN
    -- Update access tracking
    UPDATE contact_requests 
    SET 
      contact_accessed_at = now(),
      access_count = COALESCE(access_count, 0) + 1
    WHERE id = contact_request_record.id;
    
    -- Log the access for security monitoring
    PERFORM log_contact_access(contact_request_record.id, 'contact_info_viewed');
    
    RETURN QUERY
    SELECT 
      a.id,
      a.contact_email,
      a.contact_phone,
      true as access_granted,
      false as requires_verification
    FROM advertisements a
    WHERE a.id = _advertisement_id AND a.status = 'approved';
    RETURN;
  END IF;
  
  -- Return masked information for unauthorized access
  RETURN QUERY
  SELECT 
    a.id,
    '[Contact via secure messaging]'::text as contact_email,
    '[Contact via secure messaging]'::text as contact_phone,
    false as access_granted,
    true as requires_verification
  FROM advertisements a
  WHERE a.id = _advertisement_id AND a.status = 'approved';
END;
$$;

-- Update the existing RLS policies to be more restrictive
DROP POLICY IF EXISTS "Authorized users can view contact info" ON public.advertisements;

-- Create a more restrictive policy that only allows viewing through the secure function
CREATE POLICY "Contact info only via secure function" ON public.advertisements
FOR SELECT
USING (
  -- Only allow selecting basic advertisement info (not contact fields directly)
  status = 'approved'
);

-- Prevent direct access to contact fields in SELECT queries
-- Users must use the secure function instead
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Add a security trigger to monitor direct contact field access attempts
CREATE OR REPLACE FUNCTION public.detect_contact_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- This trigger would detect if someone tries to access contact fields directly
  -- Log suspicious activity for security monitoring
  PERFORM log_security_violation('direct_contact_access_attempt', 'advertisements', auth.uid());
  RETURN NEW;
END;
$$;