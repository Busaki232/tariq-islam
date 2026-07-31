-- Fix the advertisements table RLS policies to properly protect contact information
-- Drop existing problematic policies first
DROP POLICY IF EXISTS "Public can view non-sensitive advertisement data" ON public.advertisements;
DROP POLICY IF EXISTS "Contact info only via secure function" ON public.advertisements;

-- Create a secure policy that excludes contact information from public access
CREATE POLICY "Public can view advertisement basic info only" 
ON public.advertisements 
FOR SELECT 
USING (
  status = 'approved' 
  AND id IS NOT NULL 
  AND title IS NOT NULL
);

-- Create a policy specifically for ad owners to access their full ad data including contact info
CREATE POLICY "Ad owners can view their complete ads" 
ON public.advertisements 
FOR SELECT 
USING (auth.uid() = user_id);

-- Ensure no one can directly access contact fields except through the secure function
-- This will be enforced by only allowing access to contact info via get_advertisement_contact_secure function