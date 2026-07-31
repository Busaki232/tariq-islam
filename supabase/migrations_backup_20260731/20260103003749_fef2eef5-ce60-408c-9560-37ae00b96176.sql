-- Create a secure function to send call notifications that bypasses RLS
CREATE OR REPLACE FUNCTION public.send_call_notification(
  _callee_id uuid,
  _caller_name text,
  _call_type text,
  _room_url text,
  _conversation_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid;
  _notification_id uuid;
BEGIN
  -- Get caller ID
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Prevent calling yourself
  IF _callee_id = _caller_id THEN
    RAISE EXCEPTION 'Cannot call yourself';
  END IF;
  
  -- Validate call type
  IF _call_type NOT IN ('video', 'audio') THEN
    RAISE EXCEPTION 'Invalid call type';
  END IF;
  
  -- Insert notification for callee
  INSERT INTO public.notification_queue (
    user_id,
    notification_type,
    title,
    body,
    priority,
    metadata
  ) VALUES (
    _callee_id,
    'call',
    'Incoming ' || INITCAP(_call_type) || ' Call',
    'Call from ' || _caller_name,
    5,
    jsonb_build_object(
      'type', 'call',
      'callUrl', _room_url,
      'callType', _call_type,
      'callerId', _caller_id,
      'callerName', _caller_name,
      'conversationId', _conversation_id
    )
  )
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$;