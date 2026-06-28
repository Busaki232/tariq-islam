-- Create Jumuah poll responses table
CREATE TABLE IF NOT EXISTS public.jumuah_poll_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('going', 'not_going', 'maybe')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE public.jumuah_poll_responses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view poll responses in their groups"
  ON public.jumuah_poll_responses
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can submit responses"
  ON public.jumuah_poll_responses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON public.jumuah_poll_responses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE jumuah_poll_responses;