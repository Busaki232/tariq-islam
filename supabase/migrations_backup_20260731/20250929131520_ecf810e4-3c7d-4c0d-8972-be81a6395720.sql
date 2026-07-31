-- Create prayer time updates table
CREATE TABLE public.prayer_time_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mosque_name TEXT NOT NULL,
  prayer_times JSONB NOT NULL,
  notes TEXT,
  contact_email TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.prayer_time_updates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own prayer time updates" 
ON public.prayer_time_updates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own prayer time updates" 
ON public.prayer_time_updates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own prayer time updates" 
ON public.prayer_time_updates 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_prayer_time_updates_updated_at
BEFORE UPDATE ON public.prayer_time_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();