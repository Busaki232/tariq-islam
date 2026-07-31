-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule automated cleanup of expired contact access
-- Runs every hour at minute 0
SELECT cron.schedule(
  'cleanup-expired-contact-access',
  '0 * * * *',
  $$SELECT cleanup_expired_contact_access();$$
);

-- Add helpful comment
COMMENT ON EXTENSION pg_cron IS 'Automated task scheduling for security cleanup operations';