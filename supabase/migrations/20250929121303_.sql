-- Update the messages policy for community chat functionality
-- Drop the restrictive policy we just created
DROP POLICY "Users can only view their own messages" ON public.messages;

-- Create a policy that allows authenticated users to view community messages
-- This is secure because:
-- 1. Only authenticated users can access the messages
-- 2. Anonymous users cannot see any messages
-- 3. This is appropriate for a community chat feature
CREATE POLICY "Authenticated users can view community messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL);;
