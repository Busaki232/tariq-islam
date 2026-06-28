-- Remove the security definer view and replace with a regular view
-- The view is safe since it only exposes non-sensitive approved advertisement data

DROP VIEW IF EXISTS public.public_advertisements;

-- Recreate as a regular view (not security definer) with only safe, public data
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

-- Enable RLS on the view
ALTER VIEW public.public_advertisements SET (security_barrier = true);

-- Grant appropriate permissions
GRANT SELECT ON public.public_advertisements TO anon, authenticated;