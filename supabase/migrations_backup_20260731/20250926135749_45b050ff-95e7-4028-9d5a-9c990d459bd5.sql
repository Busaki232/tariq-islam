-- Fix security issue: Protect contact information in advertisements table
-- Remove the insecure policy that exposes contact info to everyone
DROP POLICY IF EXISTS "Anyone can view approved ads" ON public.advertisements;

-- Create public view without sensitive contact information
CREATE VIEW public.public_advertisements AS 
SELECT 
  id, title, description, category_id, location, website, 
  image_url, featured, status, view_count, created_at, updated_at
FROM public.advertisements 
WHERE status = 'approved';

-- Allow authenticated users to view full ads including contact info
CREATE POLICY "Authenticated users can view full approved ads" 
ON public.advertisements FOR SELECT 
USING (status = 'approved' AND auth.uid() IS NOT NULL);

-- Allow owners to view their own ads regardless of status
CREATE POLICY "Owners can view their own ads" 
ON public.advertisements FOR SELECT 
USING (auth.uid() = user_id);

-- Enable RLS on the public view (inherits from base table)
ALTER VIEW public.public_advertisements SET (security_invoker = true);