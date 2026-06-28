-- Add columns for message editing and deletion
ALTER TABLE public.messages 
ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policies to allow users to update and delete their own messages
CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- Create trigger for automatic timestamp updates on edit
CREATE TRIGGER update_messages_edited_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();