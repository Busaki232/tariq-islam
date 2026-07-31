-- Fix security issue: Add RLS policies to contact_requests_with_privacy view
ALTER VIEW public.contact_requests_with_privacy SET (security_barrier = true);

-- Enable RLS on the view (this creates an implicit table for the view)
-- First, we need to create RLS policies for views by using security_barrier
-- However, since views don't support RLS directly, let's create a more secure approach

-- Drop the problematic view and recreate as a function with proper security
DROP VIEW IF EXISTS public.contact_requests_with_privacy;

-- Create a secure function that replaces the view functionality
CREATE OR REPLACE FUNCTION public.get_contact_requests_with_privacy()
RETURNS TABLE(
  id uuid,
  advertisement_id uuid,
  requester_name text,
  requester_email text,
  message text,
  status text,
  created_at timestamp with time zone,
  status_changed_at timestamp with time zone,
  requester_id uuid
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    cr.id,
    cr.advertisement_id,
    CASE 
      WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.requester_name
      ELSE 'Contact Request #' || substring(cr.id::text from 1 for 8)
    END as requester_name,
    CASE 
      WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.requester_email
      ELSE '[Hidden until approved]'
    END as requester_email,
    CASE 
      WHEN cr.status = 'approved' OR is_ad_owner(auth.uid(), cr.advertisement_id) THEN cr.message
      ELSE '[Message hidden until approved]'
    END as message,
    cr.status,
    cr.created_at,
    cr.status_changed_at,
    cr.requester_id
  FROM public.contact_requests cr
  WHERE (is_ad_owner(auth.uid(), cr.advertisement_id) OR cr.requester_id = auth.uid())
    AND auth.uid() IS NOT NULL; -- Ensure user is authenticated
$function$;

-- Update the get_contact_requests_for_ad function to use the secure function
CREATE OR REPLACE FUNCTION public.get_contact_requests_for_ad(ad_id uuid)
RETURNS TABLE(
  id uuid, 
  advertisement_id uuid, 
  requester_name text, 
  requester_email text, 
  message text, 
  status text, 
  created_at timestamp with time zone, 
  status_changed_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    crf.id,
    crf.advertisement_id,
    crf.requester_name,
    crf.requester_email,
    crf.message,
    crf.status,
    crf.created_at,
    crf.status_changed_at
  FROM public.get_contact_requests_with_privacy() crf
  WHERE crf.advertisement_id = ad_id;
$function$;

-- Remove the grant that's no longer needed since we dropped the view
-- GRANT SELECT ON public.contact_requests_with_privacy TO authenticated;