-- Create partnership_inquiries table
CREATE TABLE public.partnership_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  inquiry_type TEXT NOT NULL DEFAULT 'partnership',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.partnership_inquiries ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting inquiries (anyone can submit)
CREATE POLICY "Anyone can submit partnership inquiries"
ON public.partnership_inquiries
FOR INSERT
WITH CHECK (true);

-- Create policy for viewing inquiries (only admins)
CREATE POLICY "Admins can view all partnership inquiries"
ON public.partnership_inquiries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_partnership_inquiries_updated_at
BEFORE UPDATE ON public.partnership_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for status queries
CREATE INDEX idx_partnership_inquiries_status ON public.partnership_inquiries(status);
CREATE INDEX idx_partnership_inquiries_created_at ON public.partnership_inquiries(created_at DESC);