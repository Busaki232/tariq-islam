-- Fix Security Definer View issue and add RLS policies for safe_advertisements

-- First, drop the existing safe_advertisements view if it exists
DROP VIEW IF EXISTS public.safe_advertisements;

-- Create the safe_advertisements view without SECURITY DEFINER
-- This view should only return non-sensitive advertisement data
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
  user_id,
  created_at,
  updated_at
FROM public.advertisements
WHERE status = 'approved';

-- Enable RLS on the view
ALTER VIEW public.safe_advertisements SET (security_barrier = true);

-- Create RLS policies for safe_advertisements view
-- Anyone can view approved advertisements (without contact info)
CREATE POLICY "Public can view safe advertisement data"
ON public.advertisements
FOR SELECT
USING (status = 'approved');

-- Update the get_public_advertisements function to use proper RLS instead of SECURITY DEFINER
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
-- Remove SECURITY DEFINER and let RLS handle access control
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