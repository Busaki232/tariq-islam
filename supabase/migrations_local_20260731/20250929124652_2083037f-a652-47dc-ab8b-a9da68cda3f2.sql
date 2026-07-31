-- Create events table for community events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  location TEXT NOT NULL,
  organizer_id UUID NOT NULL,
  attendees_count INTEGER NOT NULL DEFAULT 0,
  max_attendees INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_category CHECK (category IN ('religious', 'educational', 'cultural', 'social', 'general')),
  CONSTRAINT valid_status CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled'))
);

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for events
CREATE POLICY "Anyone can view approved events" 
ON public.events 
FOR SELECT 
USING (status IN ('upcoming', 'ongoing'));

CREATE POLICY "Authenticated users can create events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Event organizers can update their events" 
ON public.events 
FOR UPDATE 
USING (auth.uid() = organizer_id);

CREATE POLICY "Event organizers can delete their events" 
ON public.events 
FOR DELETE 
USING (auth.uid() = organizer_id);

-- Create RSVPs table
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'attending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id),
  CONSTRAINT valid_rsvp_status CHECK (status IN ('attending', 'maybe', 'not_attending'))
);

-- Enable RLS on event_rsvps table
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for RSVPs
CREATE POLICY "Users can manage their own RSVPs" 
ON public.event_rsvps 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event organizers can view RSVPs for their events" 
ON public.event_rsvps 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = event_rsvps.event_id 
    AND organizer_id = auth.uid()
  )
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_events_status ON public.events(status);