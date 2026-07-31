-- Create leadership applications table
CREATE TABLE public.leadership_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  location TEXT NOT NULL,
  experience TEXT NOT NULL,
  motivation TEXT NOT NULL,
  availability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leadership_applications ENABLE ROW LEVEL SECURITY;

-- Create policies for leadership applications
CREATE POLICY "Users can create their own leadership applications" 
ON public.leadership_applications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own leadership applications" 
ON public.leadership_applications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own leadership applications" 
ON public.leadership_applications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leadership_applications_updated_at
BEFORE UPDATE ON public.leadership_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_leadership_applications_user_id ON public.leadership_applications(user_id);
CREATE INDEX idx_leadership_applications_status ON public.leadership_applications(status);