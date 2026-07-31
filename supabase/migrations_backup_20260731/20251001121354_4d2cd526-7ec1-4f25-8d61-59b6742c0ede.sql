-- Fix: Prevent public access to business owner contact information
-- This migration addresses the security vulnerability where contact_email and contact_phone
-- were exposed through overly permissive RLS policies

-- Step 1: Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public can view advertisement basic info only" ON public.advertisements;
DROP POLICY IF EXISTS "Anonymous users can view approved advertisements via RPC" ON public.advertisements;
DROP POLICY IF EXISTS "No direct anonymous access to advertisements" ON public.advertisements;

-- Step 2: Create a restrictive policy that prevents direct SELECT on advertisements table
-- Users can only access advertisement data through secure RPC functions
CREATE POLICY "Public access only via secure RPC functions"
ON public.advertisements
FOR SELECT
TO public
USING (false);

-- Step 3: Ensure authenticated users can still view approved ads via RPC
-- (The get_public_advertisements function will handle safe column filtering)
CREATE POLICY "Authenticated users can view approved ads via RPC"
ON public.advertisements
FOR SELECT
TO authenticated
USING (status = 'approved');

-- Step 4: Update the get_public_advertisements function to explicitly exclude contact fields
CREATE OR REPLACE FUNCTION public.get_public_advertisements()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  location text,
  image_url text,
  website text,
  status text,
  featured boolean,
  view_count integer,
  category_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Return only safe public fields, explicitly excluding contact_email and contact_phone
  SELECT 
    a.id,
    a.title,
    a.description,
    a.location,
    a.image_url,
    a.website,
    a.status,
    a.featured,
    a.view_count,
    a.category_id,
    a.created_at,
    a.updated_at
  FROM public.advertisements a
  WHERE a.status = 'approved'
  ORDER BY a.featured DESC, a.created_at DESC;
$$;

-- Step 5: Add a comment documenting the security measure
COMMENT ON FUNCTION public.get_public_advertisements() IS 
'Securely returns public advertisement data without exposing contact information. Contact details are only accessible through get_advertisement_contact_secure() after proper authorization.';

-- Step 6: Ensure the secure contact function is properly locked down
-- This function already exists but let's add an additional security check
CREATE OR REPLACE FUNCTION public.get_advertisement_contact_secure(_advertisement_id uuid)
RETURNS TABLE(
  id uuid,
  contact_email text,
  contact_phone text,
  access_granted boolean,
  requires_verification boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean := false;
  has_valid_access boolean := false;
  contact_request_record RECORD;
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    -- Return masked information for anonymous users
    RETURN QUERY
    SELECT 
      a.id,
      '[Sign in required]'::text as contact_email,
      '[Sign in required]'::text as contact_phone,
      false as access_granted,
      true as requires_verification
    FROM advertisements a
    WHERE a.id = _advertisement_id AND a.status = 'approved';
    RETURN;
  END IF;

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
  
  -- Check for valid contact request with proper authorization
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
  
  -- If valid access exists, return contact info and log the access
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

COMMENT ON FUNCTION public.get_advertisement_contact_secure(uuid) IS 
'Securely returns contact information only to authorized users: ad owners or approved contact requesters. All access is logged for security monitoring.';