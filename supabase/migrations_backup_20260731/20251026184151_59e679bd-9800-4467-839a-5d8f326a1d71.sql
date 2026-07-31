-- Enhance message_attachments table for rich media support
ALTER TABLE public.message_attachments
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS compression_ratio numeric,
ADD COLUMN IF NOT EXISTS original_file_size integer;

-- Add index for faster queries by file type
CREATE INDEX IF NOT EXISTS idx_message_attachments_file_type 
ON public.message_attachments(file_type);

-- Add index for message_id lookups
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id 
ON public.message_attachments(message_id);

-- Add helpful comment
COMMENT ON COLUMN public.message_attachments.metadata IS 
'Stores additional metadata: width, height for images; duration for videos; coordinates for locations';