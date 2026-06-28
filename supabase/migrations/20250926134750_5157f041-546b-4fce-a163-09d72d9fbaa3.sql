-- Fix security issue: Restrict message viewing to authenticated users only
-- Remove the insecure policy that allows anyone to view messages
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;

-- Create secure policy requiring authentication for community chat
CREATE POLICY "Authenticated users can view community messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL);