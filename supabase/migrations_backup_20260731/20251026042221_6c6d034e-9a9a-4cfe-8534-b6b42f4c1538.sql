-- Fix the chat_groups INSERT policy to properly check created_by
DROP POLICY IF EXISTS "authenticated_users_can_create_groups" ON public.chat_groups;

CREATE POLICY "authenticated_users_can_create_groups"
ON public.chat_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);