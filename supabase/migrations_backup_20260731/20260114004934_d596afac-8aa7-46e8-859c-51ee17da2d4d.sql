-- Fix 1: Create get_all_public_profiles function (called by ConversationsList)
CREATE OR REPLACE FUNCTION public.get_all_public_profiles()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  location TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.location
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_public_profiles() TO authenticated;

-- Fix 2: Add expires_at column to call_invites table (used by pg_cron job)
ALTER TABLE public.call_invites 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 minute');

-- Set default expiry for existing pending invites
UPDATE public.call_invites 
SET expires_at = created_at + interval '1 minute'
WHERE expires_at IS NULL;

-- Create index for the cron job query
CREATE INDEX IF NOT EXISTS idx_call_invites_expires ON public.call_invites(status, expires_at) 
WHERE status = 'pending';