-- Create a function to send call status notifications (answered/declined)
-- This bypasses RLS so the callee can notify the caller
CREATE OR REPLACE FUNCTION public.send_call_status_notification(
  _caller_id uuid,
  _status text,
  _conversation_id text,
  _room_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _callee_id uuid;
  _notification_id uuid;
BEGIN
  -- Get callee ID (current user)
  _callee_id := auth.uid();
  IF _callee_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate status
  IF _status NOT IN ('answered', 'declined') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  
  -- Insert notification for caller
  INSERT INTO public.notification_queue (
    user_id,
    notification_type,
    title,
    body,
    priority,
    metadata
  ) VALUES (
    _caller_id,
    'call_status',
    CASE WHEN _status = 'answered' THEN 'Call Answered' ELSE 'Call Declined' END,
    CASE WHEN _status = 'answered' THEN 'Your call was answered' ELSE 'Your call was declined' END,
    5,
    jsonb_build_object(
      'status', _status,
      'conversationId', _conversation_id,
      'roomUrl', _room_url,
      'respondedBy', _callee_id
    )
  )
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$;;
