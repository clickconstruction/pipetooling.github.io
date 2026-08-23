SET lock_timeout = '3s';

-- v2.2159 — CC recipients on GC statement emails (GC Review → Draft Message).
-- Nullable text[] on the scheduled-send request (the dispatcher passes it to
-- Resend `cc` and carries it onto the next weekly row) and on the audit table
-- (what the immediate and scheduled sends actually cc'd). Additive + idempotent.

ALTER TABLE public.gc_statement_email_requests ADD COLUMN IF NOT EXISTS cc_emails text[];
COMMENT ON COLUMN public.gc_statement_email_requests.cc_emails IS
  'Optional CC recipients for this statement send (lower-cased, validated by the client); NULL/empty = none. Carried onto the next weekly row by gc-statement-email-dispatch.';

ALTER TABLE public.gc_statement_emails ADD COLUMN IF NOT EXISTS cc_emails text[];
COMMENT ON COLUMN public.gc_statement_emails.cc_emails IS
  'CC recipients the statement email was actually sent with (send-gc-statement-email / gc-statement-email-dispatch); NULL/empty = none.';
