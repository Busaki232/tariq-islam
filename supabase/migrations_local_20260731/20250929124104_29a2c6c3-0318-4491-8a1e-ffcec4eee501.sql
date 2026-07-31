-- Add location field for community posts
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS location text;

-- Update RLS policy for community posts - anyone can view community posts
CREATE POLICY "Anyone can view community posts" 
ON public.messages 
FOR SELECT 
USING (message_type = 'community_post' AND NOT is_deleted);

-- Add index for better performance when filtering by message type
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON public.messages(message_type) WHERE NOT is_deleted;