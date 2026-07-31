-- CRITICAL SECURITY FIX: Restrict security_logs access to system only

-- First, drop the existing problematic policy
DROP POLICY IF EXISTS "System access only for security logs" ON public.security_logs;

-- Create explicit RESTRICTIVE policies that DENY access to all user roles
CREATE POLICY "Deny all access to authenticated users" 
ON public.security_logs 
AS RESTRICTIVE
FOR ALL 
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all access to anonymous users" 
ON public.security_logs 
AS RESTRICTIVE
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all access to public role" 
ON public.security_logs 
AS RESTRICTIVE
FOR ALL 
TO public
USING (false)
WITH CHECK (false);

-- Create a single permissive policy for service_role only
CREATE POLICY "Service role system access only" 
ON public.security_logs 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Additional security: Create a function to check if current user is system
CREATE OR REPLACE FUNCTION public.is_system_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only service_role or specific system operations should return true
  SELECT current_setting('role') = 'service_role' 
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
$$;

-- Update the log_security_violation function to be more restrictive
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
  -- Only allow system operations to log security violations
  -- This prevents potential abuse of the logging system
  IF NOT public.is_system_user() THEN
    -- Silently fail for non-system users to prevent information disclosure
    RETURN;
  END IF;
  
  -- Log security violations for monitoring
  INSERT INTO public.security_logs (
    violation_type,
    table_name,
    user_id,
    timestamp,
    details
  ) VALUES (
    violation_type,
    table_name,
    COALESCE(user_id, auth.uid()),
    now(),
    jsonb_build_object(
      'user_agent', current_setting('request.headers', true)::json->>'user-agent',
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    )
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails, but don't expose errors
    NULL;
END;
$$;