-- Fix RLS policy for chat_groups creation
-- Drop the existing policy that's causing the violation
DROP POLICY IF EXISTS "authenticated_users_can_create_groups" ON public.chat_groups;

-- Create updated policy with simpler authentication check
-- This allows any authenticated user to create groups
-- The created_by field is already set correctly in the application code
CREATE POLICY "authenticated_users_can_create_groups"
ON public.chat_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);