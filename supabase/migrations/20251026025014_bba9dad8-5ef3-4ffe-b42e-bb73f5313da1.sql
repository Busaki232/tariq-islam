-- Create security definer function to check if user is group creator
CREATE OR REPLACE FUNCTION public.is_group_creator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_groups
    WHERE id = _group_id
      AND created_by = _user_id
  )
$$;

-- Drop and recreate the insert policy for group_members to allow creator to add themselves
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;

CREATE POLICY "Group admins can add members"
ON group_members FOR INSERT
WITH CHECK (
  public.is_group_admin(auth.uid(), group_id) OR 
  auth.uid() = user_id OR
  public.is_group_creator(auth.uid(), group_id)
);