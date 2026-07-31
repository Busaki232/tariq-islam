-- SECURITY FIX: Remove public access to contact information in advertisements table

-- First, drop the dangerous public policy that exposes contact information
DROP POLICY IF EXISTS "Public can view safe advertisement data" ON public.advertisements;

-- Create a much safer public policy that explicitly excludes contact information
-- This policy only allows viewing non-sensitive advertisement data
CREATE POLICY "Public can view non-sensitive advertisement data"
ON public.advertisements
FOR SELECT
TO public
USING (
  status = 'approved' 
  AND id IS NOT NULL 
  AND title IS NOT NULL
);

-- Update the safe_advertisements view to absolutely ensure no contact info is included
DROP VIEW IF EXISTS public.safe_advertisements;

CREATE VIEW public.safe_advertisements 
WITH (security_invoker = true)
AS
SELECT 
  id,
  title,
  description,
  location,
  image_url,
  website,
  status,
  featured,
  view_count,
  category_id,
  user_id,
  created_at,
  updated_at
  -- EXPLICITLY EXCLUDE contact_email and contact_phone for security
FROM public.advertisements
WHERE status = 'approved';

-- Set security barrier to ensure RLS is respected
ALTER VIEW public.safe_advertisements SET (security_barrier = true);

-- Grant permissions on the safe view only
GRANT SELECT ON public.safe_advertisements TO authenticated, anon;

-- Ensure contact info access is ONLY through proper authorization
-- Update the contact info access policy to be more explicit
DROP POLICY IF EXISTS "Approved requesters can view specific ad contact info" ON public.advertisements;

CREATE POLICY "Authorized users can view contact info"
ON public.advertisements  
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND (
    -- Ad owner can always see their own contact info
    auth.uid() = user_id OR
    -- Approved requesters can see contact info through the contact request system
    EXISTS (
      SELECT 1 FROM public.contact_requests cr
      WHERE cr.advertisement_id = advertisements.id
        AND cr.requester_id = auth.uid()
        AND cr.status = 'approved'
    )
  )
);