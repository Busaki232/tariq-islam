-- SECURITY FIX: Remove insecure safe_advertisements view to prevent RLS bypass

-- Drop the insecure safe_advertisements view that bypasses RLS
DROP VIEW IF EXISTS public.safe_advertisements;

-- Ensure the get_public_advertisements function is the only way to access advertisement data
-- This function properly restricts access to authenticated users and excludes sensitive fields