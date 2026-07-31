-- Create mosque_submissions table for user-submitted mosque information
CREATE TABLE public.mosque_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mosque_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  imam_name TEXT,
  languages TEXT[], -- Array of languages spoken
  services TEXT[], -- Array of services offered
  prayer_times JSONB, -- Store prayer times as JSON
  description TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mosque_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can create their own mosque submissions" 
ON public.mosque_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own mosque submissions" 
ON public.mosque_submissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own mosque submissions" 
ON public.mosque_submissions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mosque_submissions_updated_at
BEFORE UPDATE ON public.mosque_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();