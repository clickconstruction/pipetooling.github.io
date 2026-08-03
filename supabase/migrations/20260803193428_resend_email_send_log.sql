SET lock_timeout = '3s';

-- Org-wide outbound email log (Settings → Notifications → "Most recent emails sent").
-- Rows are written ONLY by edge functions using the service role:
--   * resend-webhook      (Resend email.* events keep rows fresh going forward)
--   * sync-resend-emails  (dev-triggered pull of Resend's recent-emails list; backfill + gap repair)
-- No client INSERT/UPDATE/DELETE policies on purpose. SELECT is dev-only.

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id text UNIQUE,
  sent_at timestamptz,
  from_email text,
  to_emails text[] NOT NULL DEFAULT '{}',
  subject text,
  last_event text,
  last_event_at timestamptz,
  source text NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'webhook')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_send_log_dev_select ON public.email_send_log;
CREATE POLICY email_send_log_dev_select ON public.email_send_log
  FOR SELECT USING (public.is_dev());

CREATE INDEX IF NOT EXISTS email_send_log_sent_at_idx
  ON public.email_send_log (sent_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS update_email_send_log_updated_at ON public.email_send_log;
CREATE TRIGGER update_email_send_log_updated_at
  BEFORE UPDATE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
