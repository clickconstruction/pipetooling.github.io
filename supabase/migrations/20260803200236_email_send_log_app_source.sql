SET lock_timeout = '3s';

-- v2.1341: app-side email logging — the 13 sender edge functions now write
-- their own email_send_log rows at send time (source 'app'), so the log no
-- longer depends on querying Resend. Extend the source CHECK accordingly.

ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_source_check;
ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_source_check CHECK (source IN ('sync', 'webhook', 'app'));
