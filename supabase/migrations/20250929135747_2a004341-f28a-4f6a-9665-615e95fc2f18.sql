-- Phase 1 Security Refinements: Strengthen RLS Policies

-- Add explicit authentication requirements where appropriate
-- Update profiles table to require authentication for all operations
DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Strengthen message policies with explicit authentication
DROP POLICY IF EXISTS "Users can send public messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send private messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Authenticated users can send public messages" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id AND recipient_id IS NULL);

CREATE POLICY "Authenticated users can send private messages" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id AND recipient_id IS NOT NULL);

CREATE POLICY "Authenticated users can update their own messages" 
ON public.messages 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = sender_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

-- Add security logging function for policy violations
CREATE OR REPLACE FUNCTION public.log_security_violation(
  violation_type text,
  table_name text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log security violations for monitoring
  INSERT INTO public.security_logs (
    violation_type,
    table_name,
    user_id,
    timestamp
  ) VALUES (
    violation_type,
    table_name,
    COALESCE(user_id, auth.uid()),
    now()
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails
    NULL;
END;
$$;

-- Create security logs table for monitoring
CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_type text NOT NULL,
  table_name text NOT NULL,
  user_id uuid,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb
);

-- Enable RLS on security logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only allow system/admin access to security logs
CREATE POLICY "System access only for security logs" 
ON public.security_logs 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);