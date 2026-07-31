-- Enable Realtime for notification_queue table so callees receive incoming call notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notification_queue;