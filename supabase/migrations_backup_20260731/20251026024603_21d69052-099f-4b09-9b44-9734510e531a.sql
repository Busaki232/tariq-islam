-- Drop existing problematic policies on group_members
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Create security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Create security definer function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'admin'
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view members of groups they belong to"
ON group_members FOR SELECT
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can add members"
ON group_members FOR INSERT
WITH CHECK (
  public.is_group_admin(auth.uid(), group_id) OR 
  auth.uid() = user_id
);

CREATE POLICY "Group admins can update members"
ON group_members FOR UPDATE
USING (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Users can leave groups"
ON group_members FOR DELETE
USING (
  auth.uid() = user_id OR 
  public.is_group_admin(auth.uid(), group_id)
);