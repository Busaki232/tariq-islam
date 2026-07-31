-- Fix security vulnerability: Replace overly permissive SELECT policy on messages table
-- Drop the existing policy that allows anyone to view messages
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can view community messages" ON public.messages;

-- Create a secure policy that only allows users to view their own messages
CREATE POLICY "Users can only view their own messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id);

-- Note: If this is meant to be a community chat where all authenticated users
-- should see all messages, then a proper policy would be:
-- CREATE POLICY "Authenticated users can view community messages" 
-- ON public.messages 
-- FOR SELECT 
-- USING (auth.uid() IS NOT NULL);
-- 
-- However, the security scan flagged this as exposing private conversations,
-- so we're implementing the most secure approach where users only see their own messages.;
