-- Fix remaining Security Definer functions

-- Update can_view_contact_fields to remove SECURITY DEFINER
-- This function should use RLS instead of bypassing it
CREATE OR REPLACE FUNCTION public.can_view_contact_fields(_user_id uuid, _advertisement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
-- Remove SECURITY DEFINER to let RLS handle access control
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

-- Update get_advertisement_contact_info to remove SECURITY DEFINER
-- This should rely on RLS policies instead
CREATE OR REPLACE FUNCTION public.get_advertisement_contact_info(_advertisement_id uuid)
RETURNS TABLE(id uuid, contact_email text, contact_phone text)
LANGUAGE sql
STABLE
-- Remove SECURITY DEFINER to let RLS handle access control  
SET search_path = public
AS $$
  -- Only return contact info if user is authorized to see it
  SELECT 
    a.id,
    CASE 
      WHEN auth.uid() = a.user_id OR can_view_contact_info(auth.uid(), a.id) THEN a.contact_email
      ELSE NULL
    END as contact_email,
    CASE 
      WHEN auth.uid() = a.user_id OR can_view_contact_info(auth.uid(), a.id) THEN a.contact_phone  
      ELSE NULL
    END as contact_phone
  FROM public.advertisements a
  WHERE a.id = _advertisement_id
    AND a.status = 'approved';
$$;