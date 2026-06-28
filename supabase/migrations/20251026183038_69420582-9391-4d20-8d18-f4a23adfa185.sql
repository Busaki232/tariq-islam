-- Add status field to messages table for tracking delivery
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read'));

-- Add index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);

-- Create function to update message status to delivered when recipient is online
CREATE OR REPLACE FUNCTION public.mark_message_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For private messages, mark as delivered when inserted
  IF NEW.recipient_id IS NOT NULL THEN
    NEW.status := 'delivered';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-mark messages as delivered
DROP TRIGGER IF EXISTS on_message_insert_mark_delivered ON public.messages;
CREATE TRIGGER on_message_insert_mark_delivered
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_message_delivered();

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  _sender_id uuid,
  _recipient_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update private messages to read status
  UPDATE public.messages
  SET 
    status = 'read',
    read_by = CASE 
      WHEN read_by IS NULL THEN jsonb_build_array(jsonb_build_object('user_id', _recipient_id, 'read_at', now()))
      WHEN NOT read_by @> jsonb_build_array(jsonb_build_object('user_id', _recipient_id)) THEN 
        read_by || jsonb_build_array(jsonb_build_object('user_id', _recipient_id, 'read_at', now()))
      ELSE read_by
    END
  WHERE sender_id = _sender_id
    AND recipient_id = _recipient_id
    AND status != 'read'
    AND auth.uid() = _recipient_id;
END;
$$;

-- Create function to mark group messages as read
CREATE OR REPLACE FUNCTION public.mark_group_message_as_read(
  _message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  -- Add user to read_by array if not already there
  UPDATE public.messages
  SET 
    read_by = CASE 
      WHEN read_by IS NULL THEN jsonb_build_array(jsonb_build_object('user_id', _user_id, 'read_at', now()))
      WHEN NOT read_by @> jsonb_build_array(jsonb_build_object('user_id', _user_id)) THEN 
        read_by || jsonb_build_array(jsonb_build_object('user_id', _user_id, 'read_at', now()))
      ELSE read_by
    END
  WHERE id = _message_id
    AND group_id IS NOT NULL;
END;
$$;