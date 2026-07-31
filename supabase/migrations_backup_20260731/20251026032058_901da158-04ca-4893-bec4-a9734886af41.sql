-- Enable RLS on chat_groups
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create groups
CREATE POLICY "Users can create groups"
ON public.chat_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow users to view groups they are members of
CREATE POLICY "Users can view their groups"
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

-- Allow group admins to update group details
CREATE POLICY "Group admins can update groups"
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

-- Allow group creators to delete groups
CREATE POLICY "Group creators can delete groups"
ON public.chat_groups
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);