-- Add debug RLS policy to help identify authentication issues with message inserts
-- This policy will log security violations and allow authenticated inserts where auth.uid() = sender_id

CREATE POLICY "Debug: Allow authenticated message insert with logging"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  -- Log when auth.uid() is null (shouldn't happen for authenticated users)
  CASE 
    WHEN auth.uid() IS NULL THEN 
      (SELECT log_security_violation('null_auth_uid', 'messages', NULL::uuid)) IS NOT NULL
    WHEN auth.uid() != sender_id THEN
      (SELECT log_security_violation('sender_id_mismatch', 'messages', auth.uid())) IS NOT NULL
    ELSE
      -- Allow the insert if auth.uid exists and matches sender_id
      auth.uid() IS NOT NULL AND auth.uid() = sender_id
  END
);