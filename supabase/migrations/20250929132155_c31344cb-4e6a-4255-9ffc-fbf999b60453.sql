-- Add recipient_id column to messages table for private messaging
ALTER TABLE public.messages ADD COLUMN recipient_id UUID;

-- Update RLS policies for private messaging
DROP POLICY IF EXISTS "Authenticated users can view community messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can view community posts" ON public.messages;

-- Create comprehensive RLS policies for both public and private messages
CREATE POLICY "Users can view public messages" 
ON public.messages 
FOR SELECT 
TO authenticated
USING (recipient_id IS NULL AND NOT is_deleted);

CREATE POLICY "Users can view private messages they are part of" 
ON public.messages 
FOR SELECT 
TO authenticated
USING (recipient_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id) AND NOT is_deleted);

-- Update insert policy to handle both public and private messages
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;

CREATE POLICY "Users can send public messages" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sender_id AND recipient_id IS NULL);

CREATE POLICY "Users can send private messages" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sender_id AND recipient_id IS NOT NULL);