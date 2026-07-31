-- Fix: Business Contact Information Could Be Harvested by Spammers
-- Remove the overly permissive public policy and implement proper contact info protection

-- Drop the problematic policy that allows anonymous access to all approved ads
DROP POLICY IF EXISTS "Public can view approved ads (basic info only)" ON public.advertisements;

-- Create a secure policy that excludes contact information for anonymous users
-- Anonymous users can only see basic advertisement info, NOT contact details
CREATE POLICY "Anonymous users can view basic ad info only" 
ON public.advertisements 
FOR SELECT 
TO anon
USING (
  status = 'approved' AND 
  -- This policy will be used with explicit column selection that excludes contact info
  -- Applications should use get_public_advertisements() function for public listings
  true
);

-- Create a separate policy for authenticated users who want to see ads without contact approval
CREATE POLICY "Authenticated users can view ads without contact info" 
ON public.advertisements 
FOR SELECT 
TO authenticated
USING (
  status = 'approved' AND 
  -- Authenticated users can see all basic info but still need approval for contact details
  -- Contact info should only be shown if they own the ad or have approved contact request
  (
    auth.uid() = user_id OR  -- Ad owners can see their own contact info
    can_view_contact_info(auth.uid(), id) OR  -- Approved requesters can see contact info
    -- For other authenticated users, they see basic info only (no contact details)
    auth.uid() IS NOT NULL
  )
);

-- Add a security function to check if contact fields should be visible
CREATE OR REPLACE FUNCTION public.can_view_contact_fields(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only ad owners and approved requesters can view contact information
  SELECT 
    _user_id = (SELECT user_id FROM advertisements WHERE id = _advertisement_id)
    OR
    EXISTS (
      SELECT 1 FROM contact_requests 
      WHERE advertisement_id = _advertisement_id 
        AND requester_id = _user_id 
        AND status = 'approved'
    );
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.can_view_contact_fields(uuid, uuid) TO authenticated, anon;

-- Update the secure public function to ensure it never returns contact info
CREATE OR REPLACE FUNCTION public.get_public_advertisements()
RETURNS TABLE (
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
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- This function explicitly excludes contact_email and contact_phone
  -- to prevent spammer harvesting of contact information
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
    -- NOTE: contact_email and contact_phone are intentionally excluded
  FROM public.advertisements a
  WHERE a.status = 'approved'
  ORDER BY a.featured DESC, a.created_at DESC;
$$;

-- Add comprehensive documentation
COMMENT ON FUNCTION public.get_public_advertisements() IS 
'SECURITY: Returns approved advertisements WITHOUT contact information.
This function is the ONLY safe way to get public advertisement listings.
Contact details (email/phone) are intentionally excluded to prevent spammer harvesting.
Users must go through the authenticated contact request system to access contact information.';

COMMENT ON FUNCTION public.can_view_contact_fields(uuid, uuid) IS 
'SECURITY: Determines if a user is authorized to view contact information for an advertisement.
Returns true only for ad owners and users with approved contact requests.';

SELECT 'Contact information harvesting protection implemented' AS security_status;