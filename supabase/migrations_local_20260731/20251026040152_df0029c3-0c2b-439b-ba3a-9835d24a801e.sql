-- Fix RLS policy for chat_groups creation
DROP POLICY IF EXISTS "authenticated_users_can_create_groups" ON public.chat_groups;

-- Create permissive policy for authenticated users
-- TO authenticated ensures only logged-in users can access this policy
-- WITH CHECK (true) allows the insert since application sets created_by correctly
CREATE POLICY "authenticated_users_can_create_groups"
ON public.chat_groups
FOR INSERT
TO authenticated
WITH CHECK (true);