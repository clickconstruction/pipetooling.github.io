SET lock_timeout = '3s';

-- gc_statement_email_requests + cron dispatcher registration (v2.1426) —
-- Phase 2 of the gc_statement Report Subscriptions stream
-- (docs/REPORT_SUBSCRIPTIONS.md). One row per requested SCHEDULED send of a
-- GC statement; the gc-statement-email-dispatch edge function (pg_cron */5)
-- rebuilds the statement at send time via get_gc_statement_email_payload
-- (v2.1425) and emails it via Resend. Immediate sends keep using the
-- send-gc-statement-email function and do NOT create rows here.
--
-- Shape mirrors billed_report_email_requests (v2.1315) with one deliberate
-- difference: recipients are a free-text `sent_to` email — GC statements go
-- to outside AP inboxes, not app users (REPORT_SUBSCRIPTIONS.md design rule).
--
-- Entity semantics (drives the payload RPC):
--   group_by 'gc'          + gc_customer_id  → one GC's statement
--   group_by 'development' + development_id  → one development's statement
--   either group_by, both entity ids NULL    → the whole report ("Share all"),
--     audited as group_by 'all' in gc_statement_emails.

CREATE TABLE IF NOT EXISTS public.gc_statement_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  sent_to text NOT NULL CHECK (sent_to ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  group_by text NOT NULL DEFAULT 'gc' CHECK (group_by IN ('gc', 'development')),
  gc_customer_id uuid REFERENCES public.customers (id) ON DELETE CASCADE,
  development_id uuid REFERENCES public.developments (id) ON DELETE CASCADE,
  entity_name text NOT NULL DEFAULT '',
  include_collections boolean NOT NULL DEFAULT false,
  send_at timestamptz NOT NULL,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0,
  CONSTRAINT gc_statement_email_requests_entity_dim CHECK (
    NOT (gc_customer_id IS NOT NULL AND development_id IS NOT NULL)
    AND (gc_customer_id IS NULL OR group_by = 'gc')
    AND (development_id IS NULL OR group_by = 'development')
  )
);

COMMENT ON TABLE public.gc_statement_email_requests IS
  'Requested SCHEDULED sends of GC statements (v2.1426, gc_statement Report Subscriptions stream). Staff insert; the gc-statement-email-dispatch edge function (pg_cron */5) processes rows with send_at <= now(), rebuilds the statement fresh via get_gc_statement_email_payload, emails via Resend, stamps sent_at, audits into gc_statement_emails, and re-enqueues repeat_weekly chains. Rows carry no snapshot. entity_name is a display snapshot for pending lists.';

CREATE INDEX IF NOT EXISTS idx_gc_statement_email_requests_due
  ON public.gc_statement_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.gc_statement_email_requests ENABLE ROW LEVEL SECURITY;

-- Sender cohort = the GC Review cohort (send-gc-statement-email ALLOWED_ROLES):
-- dev / master_technician / assistant-like (controller rides is_assistant()) / primary.
DROP POLICY IF EXISTS "Staff insert own gc statement email requests" ON public.gc_statement_email_requests;
CREATE POLICY "Staff insert own gc statement email requests" ON public.gc_statement_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
      )
    )
  );

DROP POLICY IF EXISTS "Creators and devs read gc statement email requests" ON public.gc_statement_email_requests;
CREATE POLICY "Creators and devs read gc statement email requests" ON public.gc_statement_email_requests
  FOR SELECT USING (requested_by = (SELECT auth.uid()) OR public.is_dev());

DROP POLICY IF EXISTS "Creators cancel own unsent gc statement email requests" ON public.gc_statement_email_requests;
CREATE POLICY "Creators cancel own unsent gc statement email requests" ON public.gc_statement_email_requests
  FOR DELETE USING (
    (requested_by = (SELECT auth.uid()) AND sent_at IS NULL) OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── pg_cron: dispatch every 5 minutes (Vault PROJECT_URL + CRON_SECRET,
-- same pattern as billed-report-email, 20260803100000). ──

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gc-statement-email-dispatch';

SELECT cron.schedule(
  'gc-statement-email-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gc-statement-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
