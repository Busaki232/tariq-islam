-- Fix the Security Definer View issue by properly configuring view security

-- Drop and recreate the safe_advertisements view with proper security settings
DROP VIEW IF EXISTS public.safe_advertisements;

-- Create the view with SECURITY INVOKER to respect RLS and user permissions
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
FROM public.advertisements
WHERE status = 'approved';

-- Ensure the view respects RLS by setting security barrier
ALTER VIEW public.safe_advertisements SET (security_barrier = true);

-- Grant appropriate permissions on the view
GRANT SELECT ON public.safe_advertisements TO authenticated, anon;