-- Fix Realtime: Set REPLICA IDENTITY FULL for notification_queue
ALTER TABLE public.notification_queue REPLICA IDENTITY FULL;

-- Allow users to insert call_status notifications for other users (to notify caller of answer/decline)
CREATE POLICY "Users can insert call status notifications"
ON public.notification_queue
FOR INSERT
WITH CHECK (
  notification_type = 'call_status' 
  AND auth.uid() IS NOT NULL
);;
