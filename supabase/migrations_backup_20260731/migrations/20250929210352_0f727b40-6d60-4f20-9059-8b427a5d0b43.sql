-- Create security definer function for secure leadership application access
CREATE OR REPLACE FUNCTION public.get_leadership_applications_secure()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone_number text,
  location text,
  experience text,
  motivation text,
  availability text,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    la.id,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.full_name
      ELSE 'Application #' || substring(la.id::text from 1 for 8)
    END as full_name,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.email
      ELSE '[Protected Email]'
    END as email,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.phone_number
      ELSE '[Protected Phone]'
    END as phone_number,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.location
      ELSE '[Protected Location]'
    END as location,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.experience
      ELSE '[Protected Content]'
    END as experience,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.motivation
      ELSE '[Protected Content]'
    END as motivation,
    CASE 
      WHEN la.user_id = auth.uid() THEN la.availability
      ELSE '[Protected Content]'
    END as availability,
    la.status,
    la.created_at,
    la.updated_at
  FROM public.leadership_applications la
  WHERE la.user_id = auth.uid()
    AND auth.uid() IS NOT NULL;
$$;

-- Create audit logging table for leadership applications access
CREATE TABLE IF NOT EXISTS public.leadership_application_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.leadership_application_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs (only system can access)
CREATE POLICY "System can manage leadership audit logs"
ON public.leadership_application_audit_logs
FOR ALL
USING (is_system_user());

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_leadership_application_access(
  _application_id uuid,
  _action_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leadership_application_audit_logs (
    application_id,
    user_id,
    action_type,
    ip_address,
    user_agent
  ) VALUES (
    _application_id,
    auth.uid(),
    _action_type,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails
    NULL;
END;
$$;

-- Create trigger for automatic audit logging on leadership applications
CREATE OR REPLACE FUNCTION public.leadership_application_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_leadership_application_access(NEW.id, 'created');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_leadership_application_access(NEW.id, 'updated');
    RETURN NEW;
  ELSIF TG_OP = 'SELECT' THEN
    PERFORM log_leadership_application_access(OLD.id, 'viewed');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on leadership applications
CREATE TRIGGER leadership_application_audit
  AFTER INSERT OR UPDATE ON public.leadership_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.leadership_application_audit_trigger();

-- Enhanced RLS policy with additional security checks
CREATE POLICY "Enhanced user access to own leadership applications"
ON public.leadership_applications
FOR SELECT
USING (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL
  AND created_at > now() - interval '2 years'  -- Don't expose very old data
);

-- Rate limiting policy for leadership application creation
CREATE OR REPLACE FUNCTION public.check_leadership_application_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  recent_applications integer;
BEGIN
  -- Input validation
  IF NEW.user_id IS NULL OR NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Invalid user ID for leadership application';
  END IF;
  
  -- Check rate limit (max 1 application per week)
  SELECT COUNT(*) INTO recent_applications
  FROM public.leadership_applications
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '7 days';
    
  IF recent_applications >= 1 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 1 leadership application per week';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add rate limiting trigger
CREATE TRIGGER leadership_application_rate_limit
  BEFORE INSERT ON public.leadership_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_leadership_application_rate_limit();