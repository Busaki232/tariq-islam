-- Fix security issue: Update RLS policy for community posts to require authentication
DROP POLICY IF EXISTS "Anyone can view community posts" ON public.messages;

-- Create new policy that requires authentication but allows all authenticated users to view community posts
CREATE POLICY "Authenticated users can view community posts" 
ON public.messages 
FOR SELECT 
USING (message_type = 'community_post' AND NOT is_deleted AND auth.uid() IS NOT NULL);