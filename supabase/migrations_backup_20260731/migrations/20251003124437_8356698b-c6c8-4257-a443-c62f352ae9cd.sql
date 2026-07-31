-- Security Fix: Replace public_profiles view with proper access control
-- Issue: Views cannot have RLS policies in PostgreSQL. The security_invoker mode
-- causes the view to inherit restrictive RLS from profiles table, breaking features.
--
-- Solution: Create security definer functions that properly control access to
-- public profile data while keeping phone_number private.

-- Drop the problematic view
DROP VIEW IF EXISTS public.public_profiles;

-- Create a comprehensive security definer function to list all public profiles
-- This replaces the view and provides proper access control
CREATE OR REPLACE FUNCTION public.get_all_public_profiles()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  location text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only allow authenticated users to view public profiles
  -- Explicitly exclude phone_number to protect sensitive data
  SELECT 
    user_id,
    full_name,
    location,
    created_at,
    updated_at
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL  -- Require authentication
    AND full_name IS NOT NULL;   -- Only show profiles with names
$$;

-- Keep the existing single-user lookup function (already exists)
-- public.get_public_profile(_user_id uuid) - for looking up specific users

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_all_public_profiles() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_public_profiles() FROM anon;

-- Add security documentation
COMMENT ON FUNCTION public.get_all_public_profiles() IS 
'Security definer function to list public profile information.
Requires authentication. Excludes phone_number field for privacy.
Used by user directory and messaging features.
Rate limiting should be implemented at application layer if needed.';