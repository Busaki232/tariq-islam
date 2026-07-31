-- Security Fix: Create Public Profile View
-- This migration addresses the security vulnerability where the profiles table
-- contains sensitive PII (phone numbers) but RLS policies block necessary features.
-- 
-- Solution: Create a separate view that exposes only non-sensitive profile data
-- (user_id, full_name, location) while keeping phone numbers private.

-- Create public_profiles view with only non-sensitive data
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker = on) AS
SELECT 
  user_id,
  full_name,
  location,
  created_at,
  updated_at
FROM public.profiles;

-- Create security definer function for safe profile lookups
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, location text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, full_name, location
  FROM public.profiles
  WHERE user_id = _user_id;
$$;

-- Grant usage to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add comment documenting the security model
COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles exposing only non-sensitive data. Phone numbers remain private in the profiles table.';