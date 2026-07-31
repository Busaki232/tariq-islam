-- Create storage buckets for message attachments and review photos

INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('message-attachments', 'message-attachments', false),
  ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for message attachments
CREATE POLICY "Users can upload message attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own message attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM message_attachments ma
      JOIN messages m ON m.id = ma.message_id
      WHERE ma.file_url = storage.objects.name
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  )
);

-- Storage policies for review photos
CREATE POLICY "Authenticated users can upload review photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view review photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'review-photos');