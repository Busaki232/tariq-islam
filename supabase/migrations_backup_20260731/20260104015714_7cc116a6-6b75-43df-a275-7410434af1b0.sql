-- Enable full row data for realtime events on notification_queue
ALTER TABLE public.notification_queue REPLICA IDENTITY FULL;