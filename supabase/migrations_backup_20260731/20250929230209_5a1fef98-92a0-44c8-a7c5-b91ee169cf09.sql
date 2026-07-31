-- Create a secure function to get advertisement owner ID without exposing sensitive data
CREATE OR REPLACE FUNCTION public.get_advertisement_owner_id(_advertisement_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_id 
  FROM public.advertisements 
  WHERE id = _advertisement_id 
    AND status = 'approved';
$function$