-- Security Fix: Remove overly permissive RLS policy on advertisements table
-- Issue: "Authenticated users can view approved ads via RPC" policy allows
-- authenticated users to see contact_email and contact_phone for all approved ads,
-- enabling potential spam/harassment.
--
-- Solution: Remove the problematic policy and ensure all access goes through
-- secure RPC functions (get_public_advertisements, get_advertisement_contact_secure)
-- which properly control field-level access based on authorization.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view approved ads via RPC" ON public.advertisements;

-- The remaining policies are:
-- 1. "Ad owners can view their complete ads" - owners see their own ads (all fields)
-- 2. "Ad owners full access to their ads" - owners manage their own ads
-- 3. "Public access only via secure RPC functions" - blocks direct SELECT (using: false)
-- 4. "Users can create their own ads" - users can create ads
-- 5. "Users can delete their own ads" - users can delete their own ads
-- 6. "Users can update their own ads" - users can update their own ads

-- All public advertisement viewing must now go through get_public_advertisements()
-- which explicitly excludes contact_email and contact_phone.
-- Contact information access is controlled by get_advertisement_contact_secure()
-- which checks authorization via the contact_requests system.

COMMENT ON TABLE public.advertisements IS 
'Stores business advertisements. Contact fields (contact_email, contact_phone) are protected. 
Public viewing uses get_public_advertisements() RPC which excludes contact fields.
Contact access requires approval via contact_requests table and is accessed through 
get_advertisement_contact_secure() RPC.';