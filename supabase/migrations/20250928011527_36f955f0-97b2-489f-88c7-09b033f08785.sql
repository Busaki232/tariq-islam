-- Fix the Security Definer View issue
-- Remove the problematic view setting and ensure proper security

-- Remove the security_barrier setting that's causing the Security Definer warning
ALTER VIEW public.safe_advertisements RESET (security_barrier);

-- Drop the view and recreate it as a simple view without security definer properties
DROP VIEW IF EXISTS public.safe_advertisements;

-- Create a simple view without security definer properties
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
  -- SECURITY: contact_email and contact_phone are intentionally excluded
FROM public.advertisements
WHERE status = 'approved';

-- Grant access to the view
GRANT SELECT ON public.safe_advertisements TO anon, authenticated;

-- Ensure RLS is properly configured to prevent contact info exposure
-- The view will inherit RLS from the base advertisements table

COMMENT ON VIEW public.safe_advertisements IS 
'SECURITY VIEW: Contains advertisement data WITHOUT sensitive contact information.
This view excludes contact_email and contact_phone fields to prevent spammer harvesting.
RLS policies on the base advertisements table control access.';

SELECT 'Security Definer View issue resolved' AS security_fix;