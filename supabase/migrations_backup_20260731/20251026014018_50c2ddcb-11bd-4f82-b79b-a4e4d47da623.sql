-- Add RLS policies for message-attachments storage bucket
-- Allow authenticated users to read files from message-attachments they're involved with

CREATE POLICY "Users can access message attachments for their messages"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' 
  AND (
    -- User is the owner of the file (uploaded by them)
    owner_id::text = auth.uid()::text
    OR
    -- User is sender or recipient of a message that references this file
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.content LIKE '%' || name || '%'
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  )
);