-- Create the get_public_advertisements function that returns approved ads without sensitive contact info
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Return only safe public fields, explicitly excluding contact_email and contact_phone
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
  FROM public.advertisements a
  WHERE a.status = 'approved'
  ORDER BY a.featured DESC, a.created_at DESC;
$$;