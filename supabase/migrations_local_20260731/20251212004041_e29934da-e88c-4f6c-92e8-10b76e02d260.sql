-- Create user_connections table for managing user relationships
CREATE TABLE public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (requester_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_user_connections_requester ON public.user_connections(requester_id);
CREATE INDEX idx_user_connections_receiver ON public.user_connections(receiver_id);
CREATE INDEX idx_user_connections_status ON public.user_connections(status);

-- RLS Policies for user_connections
CREATE POLICY "Users can view their own connections"
ON public.user_connections FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create connection requests"
ON public.user_connections FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update connections they received"
ON public.user_connections FOR UPDATE
USING (auth.uid() = receiver_id OR auth.uid() = requester_id);

CREATE POLICY "Users can delete their own connections"
ON public.user_connections FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Create helper function to check for accepted connections
CREATE OR REPLACE FUNCTION public.has_accepted_connection(_user1 uuid, _user2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_connections
    WHERE status = 'accepted'
    AND (
      (requester_id = _user1 AND receiver_id = _user2)
      OR (requester_id = _user2 AND receiver_id = _user1)
    )
  )
$$;

-- Create function to get connected user IDs
CREATE OR REPLACE FUNCTION public.get_connected_user_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN requester_id = _user_id THEN receiver_id
    ELSE requester_id
  END
  FROM public.user_connections
  WHERE status = 'accepted'
  AND (requester_id = _user_id OR receiver_id = _user_id)
$$;

-- Update RLS on calls table to require accepted connections
DROP POLICY IF EXISTS "Users see their own calls" ON public.calls;

CREATE POLICY "Users see calls with accepted connections"
ON public.calls FOR SELECT
USING (
  (auth.uid() = caller_id OR auth.uid() = callee_id)
  AND public.has_accepted_connection(caller_id, callee_id)
);

DROP POLICY IF EXISTS "Users insert their own outgoing calls" ON public.calls;

CREATE POLICY "Users can call connected users"
ON public.calls FOR INSERT
WITH CHECK (
  auth.uid() = caller_id
  AND public.has_accepted_connection(caller_id, callee_id)
);

-- Auto-create connections for existing conversations (preserves existing relationships)
INSERT INTO public.user_connections (requester_id, receiver_id, status)
SELECT DISTINCT 
  LEAST(user1_id, user2_id) as requester_id,
  GREATEST(user1_id, user2_id) as receiver_id,
  'accepted'
FROM public.conversations
ON CONFLICT (requester_id, receiver_id) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_user_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_connections_updated_at
BEFORE UPDATE ON public.user_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_user_connections_updated_at();