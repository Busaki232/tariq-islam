-- Drop the inefficient RLS policy
DROP POLICY IF EXISTS "Users can access message attachments for their messages" ON storage.objects;

-- Create optimized RLS policy using message_attachments join
-- This is much faster and works for both sender and recipient
CREATE POLICY "Users can access their message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' 
  AND (
    -- User uploaded the file
    owner_id::text = auth.uid()::text
    OR
    -- User is involved in a message that has this attachment
    EXISTS (
      SELECT 1 
      FROM public.message_attachments ma
      INNER JOIN public.messages m ON m.id = ma.message_id
      WHERE ma.file_url = storage.objects.name
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  )
);