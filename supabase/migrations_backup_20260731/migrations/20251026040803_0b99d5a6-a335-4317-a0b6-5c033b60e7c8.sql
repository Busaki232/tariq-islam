-- Fix overly restrictive RLS policy on profiles table
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Create a proper policy that only blocks anonymous users
-- This allows authenticated users to access their profiles via other policies
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);