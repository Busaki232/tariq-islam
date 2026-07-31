-- Create user_feedback table for general feedback and contact messages
CREATE TABLE public.user_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add check constraint for feedback_type
ALTER TABLE public.user_feedback
ADD CONSTRAINT valid_feedback_type 
CHECK (feedback_type IN ('general', 'bug_report', 'feature_request', 'help_support', 'other'));

-- Add check constraint for status
ALTER TABLE public.user_feedback
ADD CONSTRAINT valid_status 
CHECK (status IN ('new', 'in_progress', 'resolved'));

-- Enable Row Level Security
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can submit feedback (authenticated or anonymous)
CREATE POLICY "Anyone can submit feedback"
ON public.user_feedback
FOR INSERT
TO public
WITH CHECK (true);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.user_feedback
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.user_feedback
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can update feedback status
CREATE POLICY "Admins can update feedback"
ON public.user_feedback
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX idx_user_feedback_created_at ON public.user_feedback(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_user_feedback_updated_at
BEFORE UPDATE ON public.user_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();