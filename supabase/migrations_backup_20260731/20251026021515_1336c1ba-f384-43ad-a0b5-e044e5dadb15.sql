-- Fix message deletion RLS issue
-- The error occurs because users can't UPDATE their own messages for soft delete

-- Add UPDATE policy for messages (allows users to soft delete their own messages)
CREATE POLICY "Users can update their own messages for deletion" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Ensure the audit trigger exists and is properly attached
DROP TRIGGER IF EXISTS audit_message_deletion_trigger ON public.messages;

CREATE TRIGGER audit_message_deletion_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_message_deletion();

-- The audit_message_deletion function already has SECURITY DEFINER and error handling,
-- so it will log to security_logs without RLS issues