-- Create admin user actions audit table
CREATE TABLE IF NOT EXISTS public.admin_user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_user_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view
CREATE POLICY "Admins can view user actions"
  ON public.admin_user_actions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: System can insert
CREATE POLICY "System can log user actions"
  ON public.admin_user_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_system_user());

-- Function for audit logging
CREATE OR REPLACE FUNCTION public.log_admin_user_action(
  _action_type text,
  _target_user_id uuid,
  _target_email text,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_user_actions (
    admin_user_id,
    action_type,
    target_user_id,
    target_email,
    details
  ) VALUES (
    auth.uid(),
    _action_type,
    _target_user_id,
    _target_email,
    _details
  );
EXCEPTION
  WHEN others THEN
    -- Don't block operations if logging fails
    RAISE WARNING 'Failed to log admin user action: %', SQLERRM;
END;
$$;