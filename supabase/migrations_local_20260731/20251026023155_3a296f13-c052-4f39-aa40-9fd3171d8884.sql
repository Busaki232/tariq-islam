-- Create group type enum
CREATE TYPE public.group_type AS ENUM ('community', 'mosque_official', 'study_circle', 'private');

-- Create group member role enum
CREATE TYPE public.group_member_role AS ENUM ('admin', 'moderator', 'member');

-- Create chat_groups table
CREATE TABLE public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  group_type public.group_type NOT NULL DEFAULT 'private'
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role public.group_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(group_id, user_id)
);

-- Add group_id to messages table
ALTER TABLE public.messages 
ADD COLUMN group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;

-- Add constraint: message must have either recipient_id OR group_id (not both)
ALTER TABLE public.messages
ADD CONSTRAINT message_target_check 
CHECK (
  (recipient_id IS NULL AND group_id IS NOT NULL) OR 
  (recipient_id IS NOT NULL AND group_id IS NULL) OR
  (recipient_id IS NULL AND group_id IS NULL)
);

-- Enable RLS on new tables
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_groups
CREATE POLICY "Users can view groups they are members of"
ON public.chat_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = chat_groups.id
      AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create groups"
ON public.chat_groups
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update their groups"
ON public.chat_groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = chat_groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
  )
);

CREATE POLICY "Group admins can delete their groups"
ON public.chat_groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = chat_groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
  )
);

-- RLS Policies for group_members
CREATE POLICY "Users can view members of groups they belong to"
ON public.group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can add members"
ON public.group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_members.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
  )
  OR
  -- Allow self-join for group creator during initial setup
  auth.uid() = user_id
);

CREATE POLICY "Group admins can update members"
ON public.group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);

CREATE POLICY "Users can leave groups"
ON public.group_members
FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);

-- RLS Policies for messages with group support
CREATE POLICY "Users can send messages to groups they are members of"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    group_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = messages.group_id
        AND group_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view messages from groups they belong to"
ON public.messages
FOR SELECT
USING (
  NOT is_deleted
  AND (
    recipient_id IS NULL AND group_id IS NULL  -- Public messages
    OR
    (auth.uid() = sender_id OR auth.uid() = recipient_id)  -- Private DMs
    OR
    EXISTS (  -- Group messages
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = messages.group_id
        AND group_members.user_id = auth.uid()
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_messages_group_id ON public.messages(group_id);
CREATE INDEX idx_chat_groups_created_by ON public.chat_groups(created_by);

-- Trigger for updated_at on chat_groups
CREATE TRIGGER update_chat_groups_updated_at
  BEFORE UPDATE ON public.chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;