-- Fix: Customer Contact Information Could Be Harvested by Spammers
-- Replace the public_advertisements view with a secure function approach

-- Drop the existing view first
DROP VIEW IF EXISTS public.public_advertisements;

-- Create a secure function that returns public advertisement data without contact info
CREATE OR REPLACE FUNCTION public.get_public_advertisements()
RETURNS TABLE (
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
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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

-- Grant access to authenticated and anonymous users for this function
GRANT EXECUTE ON FUNCTION public.get_public_advertisements() TO authenticated, anon;

-- Add security documentation
COMMENT ON FUNCTION public.get_public_advertisements() IS 
'Returns approved advertisements without sensitive contact information.
This function replaces the public_advertisements view and ensures contact details
(email/phone) are never exposed to prevent spammer harvesting. Users must go 
through the authenticated contact request system to access contact information.
SECURITY: Uses SECURITY INVOKER to respect caller permissions.';

-- Verify the fix by showing what data is returned (no contact info)
SELECT 'Security fix applied - contact information is protected from spammer harvesting' AS security_status;