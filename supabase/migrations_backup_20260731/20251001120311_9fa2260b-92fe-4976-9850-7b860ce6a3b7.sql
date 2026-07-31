-- Fix permissions for get_public_advertisements function
GRANT EXECUTE ON FUNCTION public.get_public_advertisements() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_advertisements() TO authenticated;

-- Update existing advertisements to approved status so they show in marketplace
UPDATE public.advertisements 
SET status = 'approved' 
WHERE status = 'pending';

-- Add RLS policy to allow anonymous users to call the RPC function
CREATE POLICY "Anonymous users can view approved advertisements via RPC"
ON public.advertisements
FOR SELECT
TO anon
USING (status = 'approved');