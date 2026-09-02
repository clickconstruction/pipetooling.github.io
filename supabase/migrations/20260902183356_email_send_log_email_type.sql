SET lock_timeout = '3s';

-- Email catalog, PR 1 (v2.2656): give the send log a per-type key so
-- Settings → Email templates can show real last-sent/volume stats per
-- catalog row. Senders stamp `email_type` with their `EMAIL_CATALOG` id as
-- they adopt (starting with the five previously-unlogged senders this PR
-- fixes); rows without it are older sends or not-yet-adopted senders.
-- Idempotent; additive.

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS email_type text;

COMMENT ON COLUMN public.email_send_log.email_type IS
  'EMAIL_CATALOG id (src/lib/emailCatalog.ts) stamped by the sending function; null on pre-catalog or webhook/sync rows.';

CREATE INDEX IF NOT EXISTS email_send_log_type_sent_idx
  ON public.email_send_log (email_type, sent_at DESC)
  WHERE email_type IS NOT NULL;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
