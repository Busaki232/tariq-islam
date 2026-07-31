-- Create call_sessions table for tracking video/voice calls
CREATE TABLE public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_room_url TEXT NOT NULL,
  daily_room_name TEXT NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'audio')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  max_participants INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Either conversation_id OR group_id must be set, not both
  CONSTRAINT one_call_context CHECK (
    (conversation_id IS NOT NULL AND group_id IS NULL) OR
    (conversation_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_call_sessions_conversation ON public.call_sessions(conversation_id);
CREATE INDEX idx_call_sessions_group ON public.call_sessions(group_id);
CREATE INDEX idx_call_sessions_status ON public.call_sessions(status, expires_at);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view calls they're part of"
ON public.call_sessions FOR SELECT USING (
  -- Can see if part of conversation
  (conversation_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
  ))
  OR
  -- Can see if part of group
  (group_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = call_sessions.group_id AND user_id = auth.uid())
  ))
);

CREATE POLICY "Users can create calls for their conversations/groups"
ON public.call_sessions FOR INSERT WITH CHECK (
  initiated_by = auth.uid() AND (
    (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversations WHERE id = conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
    ))
    OR
    (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM group_members WHERE group_id = call_sessions.group_id AND user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Initiators can end their calls"
ON public.call_sessions FOR UPDATE USING (initiated_by = auth.uid());

-- Create call_participants table for tracking who joined calls
CREATE TABLE public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  
  UNIQUE(call_session_id, user_id)
);

-- Indexes
CREATE INDEX idx_call_participants_session ON public.call_participants(call_session_id);
CREATE INDEX idx_call_participants_user ON public.call_participants(user_id);

-- RLS
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of their calls"
ON public.call_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM call_sessions cs
    WHERE cs.id = call_session_id
    AND (
      (cs.conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM conversations WHERE id = cs.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
      ))
      OR
      (cs.group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM group_members WHERE group_id = cs.group_id AND user_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "Users can record their own participation"
ON public.call_participants FOR INSERT WITH CHECK (user_id = auth.uid());