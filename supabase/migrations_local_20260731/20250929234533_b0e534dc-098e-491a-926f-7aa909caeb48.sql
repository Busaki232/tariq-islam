-- Fix public access to advertisements function to allow anonymous access
CREATE OR REPLACE FUNCTION public.get_public_advertisements()
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
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

-- Insert sample categories only if they don't exist
INSERT INTO public.categories (name, description, slug) 
SELECT * FROM (
  VALUES
    ('Restaurants & Food', 'Halal restaurants, catering, and food services', 'restaurants-food'),
    ('Professional Services', 'Legal, accounting, consulting, and business services', 'professional-services'),
    ('Education & Training', 'Islamic schools, tutoring, and educational services', 'education-training'),
    ('Health & Wellness', 'Medical, dental, and wellness services', 'health-wellness'),
    ('Technology & IT', 'IT services, web development, tech support', 'technology-it')
) AS new_categories(name, description, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE categories.name = new_categories.name
);

-- Get the first available category ID for sample data (since we can't create fake users)
DO $$
DECLARE
    sample_cat_id uuid;
BEGIN
    -- Just get any existing category ID for sample advertisements
    SELECT id INTO sample_cat_id FROM public.categories LIMIT 1;
    
    -- We'll skip adding sample advertisements since they require real user IDs
    -- The categories filtering will work once real users create advertisements
    
    -- Log what we're doing
    RAISE NOTICE 'Categories created successfully. Sample advertisements will be created when real users sign up and submit ads.';
END $$;