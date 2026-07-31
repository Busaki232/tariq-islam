-- SECURITY FIX: Ensure secure access to advertisement data

-- Create or replace the existing get_public_advertisements function with proper security
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

-- Ensure only authenticated users can execute this function
-- This prevents anonymous data scraping
REVOKE ALL ON FUNCTION public.get_public_advertisements() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_advertisements() TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.get_public_advertisements() IS 
'Securely returns approved advertisements without sensitive contact information. Restricted to authenticated users to prevent unauthorized data access and scraping.';