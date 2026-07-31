-- Fix the chat_groups SELECT policy to allow creators to view their own groups
-- This is needed so the is_group_creator() function can work during group_members INSERT
DROP POLICY IF EXISTS "members_can_view_groups" ON public.chat_groups;

CREATE POLICY "members_can_view_groups"
ON public.chat_groups
FOR SELECT
TO authenticated
USING (
  -- Allow if user is a member of the group
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = chat_groups.id 
    AND user_id = auth.uid()
  )
  OR
  -- Allow if user is the creator of the group
  auth.uid() = created_by
);