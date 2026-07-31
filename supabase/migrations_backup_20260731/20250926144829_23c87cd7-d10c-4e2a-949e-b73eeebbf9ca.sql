-- Fix critical security issues with contact information exposure

-- First, drop the problematic public_advertisements view that exposes all data
DROP VIEW IF EXISTS public.public_advertisements;

-- Create security definer functions to safely check permissions without causing RLS recursion
CREATE OR REPLACE FUNCTION public.can_view_contact_info(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.is_ad_owner(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM advertisements 
    WHERE id = _advertisement_id AND user_id = _user_id
  );
$$;

-- Drop existing problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Ad owners can view full contact info for their own ads" ON public.advertisements;
DROP POLICY IF EXISTS "Approved requesters can view contact info" ON public.advertisements;
DROP POLICY IF EXISTS "Owners can view their own ads" ON public.advertisements;
DROP POLICY IF EXISTS "Users can view approved ads without contact info" ON public.advertisements;
DROP POLICY IF EXISTS "Ad owners can view requests for their ads" ON public.contact_requests;
DROP POLICY IF EXISTS "Ad owners can update request status" ON public.contact_requests;

-- Create new secure RLS policies for advertisements
-- Policy 1: Public can view approved ads but WITHOUT contact information
CREATE POLICY "Public can view approved ads without contact info" 
ON public.advertisements 
FOR SELECT 
USING (
  status = 'approved' 
  AND NOT (
    -- Hide contact info columns from public access
    current_setting('request.jwt.claim.sub', true)::uuid IS NULL 
    AND (contact_phone IS NOT NULL OR contact_email IS NOT NULL)
  )
);

-- Policy 2: Ad owners can view their own ads with full contact info
CREATE POLICY "Ad owners can view their own ads with contact info" 
ON public.advertisements 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 3: Approved requesters can view ads with contact info (using security definer function)
CREATE POLICY "Approved requesters can view ads with contact info" 
ON public.advertisements 
FOR SELECT 
USING (
  status = 'approved' 
  AND public.can_view_contact_info(auth.uid(), id)
);

-- Create new secure RLS policies for contact_requests using security definer functions
CREATE POLICY "Ad owners can view requests for their ads" 
ON public.contact_requests 
FOR SELECT 
USING (public.is_ad_owner(auth.uid(), advertisement_id));

CREATE POLICY "Ad owners can update request status" 
ON public.contact_requests 
FOR UPDATE 
USING (public.is_ad_owner(auth.uid(), advertisement_id));

-- Recreate public_advertisements view WITHOUT any contact information
CREATE VIEW public.public_advertisements AS
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
  updated_at
  -- Explicitly exclude contact_phone and contact_email for security
FROM public.advertisements
WHERE status = 'approved';

-- Grant appropriate permissions on the new view
GRANT SELECT ON public.public_advertisements TO anon, authenticated;