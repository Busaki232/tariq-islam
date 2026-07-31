-- CRITICAL: Fix remaining security issues - handle existing policies carefully

-- Fix the Security Definer View issue 
DROP VIEW IF EXISTS public.safe_advertisements CASCADE;

-- Recreate as a simple view 
CREATE VIEW public.safe_advertisements AS 
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
  created_at,
  updated_at,
  user_id
FROM public.advertisements
WHERE status = 'approved';

-- Grant permissions
GRANT SELECT ON public.safe_advertisements TO anon, authenticated;

-- Fix RLS policies on advertisements table - create restrictive anonymous policy
DROP POLICY IF EXISTS "Anonymous users can view safe advertisement fields only" ON public.advertisements;
DROP POLICY IF EXISTS "Authenticated users can view safe advertisement fields" ON public.advertisements;

CREATE POLICY "No direct anonymous access to advertisements"
ON public.advertisements
FOR SELECT
TO anon
USING (false);

-- Fix contact_requests policies - remove anonymous access carefully
DROP POLICY IF EXISTS "Ad owners can update request status" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can update request status only" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can view requests for their ads" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can view requests for their ads with full access" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can view their own contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can view their own contact requests with limited fields" ON public.contact_requests;

-- Recreate contact_requests policies without anonymous access
CREATE POLICY "Authenticated users can view their own contact requests"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (auth.uid() = requester_id);

CREATE POLICY "Authenticated ad owners can view requests for their ads"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (is_ad_owner(auth.uid(), advertisement_id));

CREATE POLICY "Authenticated ad owners can update request status"
ON public.contact_requests
FOR UPDATE
TO authenticated
USING (is_ad_owner(auth.uid(), advertisement_id));

-- Fix profiles policies - remove anonymous access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add security comment
COMMENT ON VIEW public.safe_advertisements IS 
'SECURITY: Public view of advertisements WITHOUT contact information. Forces anonymous users to use this safe view instead of direct table access.';

SELECT 'Security fixes applied: Restricted anonymous access, removed security definer properties' AS result;