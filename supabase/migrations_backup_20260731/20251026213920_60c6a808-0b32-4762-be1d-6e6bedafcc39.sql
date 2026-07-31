-- Create mosque_groups junction table for linking mosques to official groups
CREATE TABLE public.mosque_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id UUID NOT NULL REFERENCES public.mosques(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mosque_id, group_id)
);

-- Create mosque_followers table for tracking users following mosques
CREATE TABLE public.mosque_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mosque_id UUID NOT NULL REFERENCES public.mosques(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT now(),
  notifications_enabled BOOLEAN DEFAULT true,
  auto_join_groups BOOLEAN DEFAULT true,
  UNIQUE(user_id, mosque_id)
);

-- Create group_files table for file library
CREATE TABLE public.group_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  category TEXT DEFAULT 'other',
  description TEXT,
  uploaded_by UUID NOT NULL,
  tags TEXT[],
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create scheduled_messages table for recurring messages
CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB,
  schedule_type TEXT NOT NULL,
  schedule_time TIME NOT NULL,
  schedule_days INTEGER[],
  start_date DATE NOT NULL,
  end_date DATE,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create group_polls table for community polls
CREATE TABLE public.group_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  poll_type TEXT DEFAULT 'single',
  allows_multiple_votes BOOLEAN DEFAULT false,
  is_anonymous BOOLEAN DEFAULT false,
  closes_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create group_poll_votes table for tracking votes
CREATE TABLE public.group_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_ids TEXT[],
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Create class_attendance table for study circles
CREATE TABLE public.class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id),
  class_date DATE NOT NULL,
  class_time TIME NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  marked_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, class_date, user_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.mosque_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosque_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mosque_groups
CREATE POLICY "Anyone can view mosque groups"
  ON public.mosque_groups FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage mosque groups"
  ON public.mosque_groups FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for mosque_followers
CREATE POLICY "Users can view mosque followers"
  ON public.mosque_followers FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own follows"
  ON public.mosque_followers FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for group_files
CREATE POLICY "Group members can view files"
  ON public.group_files FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can upload files"
  ON public.group_files FOR INSERT
  WITH CHECK (is_group_member(auth.uid(), group_id) AND auth.uid() = uploaded_by);

CREATE POLICY "Admins and uploaders can delete files"
  ON public.group_files FOR DELETE
  USING (is_group_admin(auth.uid(), group_id) OR auth.uid() = uploaded_by);

CREATE POLICY "File uploaders can update their files"
  ON public.group_files FOR UPDATE
  USING (auth.uid() = uploaded_by);

-- RLS Policies for scheduled_messages
CREATE POLICY "Group members can view scheduled messages"
  ON public.scheduled_messages FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can manage scheduled messages"
  ON public.scheduled_messages FOR ALL
  USING (is_group_admin(auth.uid(), group_id));

-- RLS Policies for group_polls
CREATE POLICY "Group members can view polls"
  ON public.group_polls FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Group members can create polls"
  ON public.group_polls FOR INSERT
  WITH CHECK (is_group_member(auth.uid(), group_id) AND auth.uid() = created_by);

CREATE POLICY "Poll creators can update their polls"
  ON public.group_polls FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Admins and creators can delete polls"
  ON public.group_polls FOR DELETE
  USING (is_group_admin(auth.uid(), group_id) OR auth.uid() = created_by);

-- RLS Policies for group_poll_votes
CREATE POLICY "Group members can view votes"
  ON public.group_poll_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_polls
    WHERE group_polls.id = group_poll_votes.poll_id
    AND is_group_member(auth.uid(), group_polls.group_id)
  ));

CREATE POLICY "Users can manage their own votes"
  ON public.group_poll_votes FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for class_attendance
CREATE POLICY "Group members can view attendance"
  ON public.class_attendance FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Users can check themselves in"
  ON public.class_attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.class_attendance FOR UPDATE
  USING (auth.uid() = user_id OR is_group_admin(auth.uid(), group_id));

CREATE POLICY "Admins can manage all attendance"
  ON public.class_attendance FOR ALL
  USING (is_group_admin(auth.uid(), group_id));

-- Create indexes for performance
CREATE INDEX idx_mosque_groups_mosque_id ON public.mosque_groups(mosque_id);
CREATE INDEX idx_mosque_groups_group_id ON public.mosque_groups(group_id);
CREATE INDEX idx_mosque_followers_user_id ON public.mosque_followers(user_id);
CREATE INDEX idx_mosque_followers_mosque_id ON public.mosque_followers(mosque_id);
CREATE INDEX idx_group_files_group_id ON public.group_files(group_id);
CREATE INDEX idx_scheduled_messages_group_id ON public.scheduled_messages(group_id);
CREATE INDEX idx_scheduled_messages_next_send ON public.scheduled_messages(next_send_at) WHERE is_active = true;
CREATE INDEX idx_group_polls_group_id ON public.group_polls(group_id);
CREATE INDEX idx_group_poll_votes_poll_id ON public.group_poll_votes(poll_id);
CREATE INDEX idx_class_attendance_group_id ON public.class_attendance(group_id);
CREATE INDEX idx_class_attendance_user_id ON public.class_attendance(user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_group_files_updated_at
  BEFORE UPDATE ON public.group_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_polls_updated_at
  BEFORE UPDATE ON public.group_polls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.mosque_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mosque_followers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_attendance;