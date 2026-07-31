-- Add metadata column for voice messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries on voice messages
CREATE INDEX IF NOT EXISTS idx_messages_type_voice 
ON messages(message_type) 
WHERE message_type = 'voice';

COMMENT ON COLUMN messages.metadata IS 'Stores voice message duration, waveform data, and other metadata';