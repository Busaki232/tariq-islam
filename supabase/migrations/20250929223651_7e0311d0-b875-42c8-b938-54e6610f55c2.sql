-- Drop the existing function and recreate with the required fields
DROP FUNCTION IF EXISTS public.get_contact_requests_with_privacy();

-- Create the updated function with all required fields for the ContactRequest interface
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
   requester_id uuid,
   risk_score integer,
   requires_verification boolean,
   access_granted_at timestamp with time zone,
   access_expires_at timestamp with time zone
 )
 LANGUAGE sql
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
    cr.requester_id,
    cr.risk_score,
    cr.requires_verification,
    cr.access_granted_at,
    cr.access_expires_at
  FROM public.contact_requests cr
  WHERE (is_ad_owner(auth.uid(), cr.advertisement_id) OR cr.requester_id = auth.uid())
    AND auth.uid() IS NOT NULL; -- Ensure user is authenticated
$function$