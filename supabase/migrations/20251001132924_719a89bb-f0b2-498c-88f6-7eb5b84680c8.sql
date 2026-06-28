-- Security Fix: Add search_path configuration to hash_sensitive_field function
-- This prevents search path injection attacks by ensuring the function
-- always uses functions from the public schema

CREATE OR REPLACE FUNCTION public.hash_sensitive_field(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Use pgcrypto extension for hashing
  RETURN encode(digest(_input, 'sha256'), 'hex');
END;
$$;