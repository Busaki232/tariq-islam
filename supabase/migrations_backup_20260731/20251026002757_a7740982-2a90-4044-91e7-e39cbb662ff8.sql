-- Fix: "record new has no field updated_at" errors

-- 1. Fix messages table trigger (should update edited_at, not updated_at)
DROP TRIGGER IF EXISTS update_messages_edited_at ON public.messages;

CREATE OR REPLACE FUNCTION public.update_messages_edited_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.edited_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_messages_edited_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted)
EXECUTE FUNCTION public.update_messages_edited_at();

-- 2. Fix user_reputation trigger (table already has last_updated, so remove trigger)
DROP TRIGGER IF EXISTS update_user_reputation_updated_at ON public.user_reputation;