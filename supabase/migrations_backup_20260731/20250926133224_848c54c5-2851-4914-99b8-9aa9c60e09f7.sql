-- Create categories table
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create advertisements table
CREATE TABLE public.advertisements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id),
  location text,
  contact_phone text,
  contact_email text,
  website text,
  image_url text,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- RLS policies for categories (public read access)
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- RLS policies for advertisements
CREATE POLICY "Anyone can view approved ads" 
ON public.advertisements 
FOR SELECT 
USING (status = 'approved');

CREATE POLICY "Users can create their own ads" 
ON public.advertisements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ads" 
ON public.advertisements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ads" 
ON public.advertisements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_advertisements_updated_at
BEFORE UPDATE ON public.advertisements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name, description, slug) VALUES
('Restaurant', 'Halal restaurants and food services', 'restaurant'),
('Education', 'Islamic education and schools', 'education'),
('Shopping', 'Halal shopping and retail', 'shopping'),
('Services', 'Community and professional services', 'services'),
('Travel', 'Halal travel and tourism', 'travel'),
('Healthcare', 'Medical and health services', 'healthcare'),
('Real Estate', 'Property and housing', 'real-estate'),
('Technology', 'Tech services and solutions', 'technology');

-- Create storage bucket for advertisement images
INSERT INTO storage.buckets (id, name, public) VALUES ('advertisements', 'advertisements', true);

-- Create storage policies for advertisement images
CREATE POLICY "Anyone can view advertisement images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'advertisements');

CREATE POLICY "Authenticated users can upload advertisement images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'advertisements' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own advertisement images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'advertisements' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own advertisement images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'advertisements' AND auth.uid() IS NOT NULL);

-- Enable realtime for advertisements
ALTER TABLE public.advertisements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.advertisements;