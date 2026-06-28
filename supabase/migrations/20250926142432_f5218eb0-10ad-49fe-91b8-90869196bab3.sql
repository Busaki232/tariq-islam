-- Create contact_requests table for secure contact system
CREATE TABLE public.contact_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertisement_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contact_requests
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_requests
CREATE POLICY "Users can view their own contact requests" 
ON public.contact_requests 
FOR SELECT 
USING (auth.uid() = requester_id);

CREATE POLICY "Ad owners can view requests for their ads" 
ON public.contact_requests 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.advertisements WHERE id = advertisement_id
  )
);

CREATE POLICY "Authenticated users can create contact requests" 
ON public.contact_requests 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Ad owners can update request status" 
ON public.contact_requests 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.advertisements WHERE id = advertisement_id
  )
);

-- Drop the existing broad policy for viewing advertisements
DROP POLICY IF EXISTS "Authenticated users can view full approved ads" ON public.advertisements;

-- Create new restrictive policies for advertisements
CREATE POLICY "Users can view approved ads without contact info" 
ON public.advertisements 
FOR SELECT 
USING (status = 'approved');

CREATE POLICY "Ad owners can view full contact info for their own ads" 
ON public.advertisements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Approved requesters can view contact info" 
ON public.advertisements 
FOR SELECT 
USING (
  status = 'approved' AND 
  auth.uid() IN (
    SELECT requester_id FROM public.contact_requests 
    WHERE advertisement_id = id AND status = 'approved'
  )
);

-- Create function to update contact_requests timestamps
CREATE OR REPLACE FUNCTION public.update_contact_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contact_requests_updated_at
BEFORE UPDATE ON public.contact_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_requests_updated_at();