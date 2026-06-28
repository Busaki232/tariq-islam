-- Drop all existing RLS policies on chat_groups to eliminate conflicts
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Users can view their groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.chat_groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON public.chat_groups;

-- Create clean, single set of RLS policies targeting authenticated role only
CREATE POLICY "authenticated_users_can_create_groups"
ON public.chat_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "members_can_view_groups"
ON public.chat_groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = chat_groups.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "admins_can_update_groups"
ON public.chat_groups
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = chat_groups.id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = chat_groups.id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "creators_can_delete_groups"
ON public.chat_groups
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);