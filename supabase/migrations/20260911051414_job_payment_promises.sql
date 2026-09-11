SET lock_timeout = '3s';

-- "Their Word" PR 1: customer payment promises as an append-only event log.
--
-- job_promised_pay_dates (v2.1926) keeps ONE promise per job and overwrites
-- it on every edit, so "they promised three times on this bill" was lost the
-- moment the second date went in. This table keeps every promise ever made:
-- who at the customer said it, who on our side heard it (NULL when the
-- customer named the date themselves — PR 2's reminder-email self-promise),
-- through what channel, and when. Outcomes (kept / late by N / broken /
-- re-promised) are never stored — the client kernel derives them from the
-- payments ledger every time they're read (src/lib/jobs/paymentPromises.ts).
--
-- The one-per-job table stays as the "latest open promise" the board chips
-- and the chase loop already read. Two write paths keep the two in step:
--   * add_job_payment_promise (new) writes the event, then upserts the
--     latest table under a session flag so the trigger below stays quiet;
--   * set_job_promised_pay_date (existing, the modal + chase call mode) is
--     unchanged — the AFTER INSERT/UPDATE trigger logs an event for it.
-- Clearing a promise (NULL date) deletes the latest row but leaves the
-- event: a cleared promise is still a promise that was made. "They never
-- said that" is a separate, explicit void.
--
-- Access mirrors the two promise tables before it: dev-only RLS for
-- debugging, all traffic through gated SECURITY DEFINER RPCs (office writers
-- = dev / master / assistant-like; readers add primary). Read-only training
-- accounts are stopped by the statement trigger.

CREATE TABLE IF NOT EXISTS public.job_payment_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The payer at promise time: the GC when the job has one, else the
  -- customer. Snapshotted so a later reassignment doesn't rewrite history.
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  promised_date date NOT NULL,
  -- Who at the customer named the date ("Tanya, their office"). Free text.
  said_by text,
  -- Who on our side recorded it. NULL = the customer recorded it themselves.
  heard_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  channel text CHECK (channel IS NULL OR channel IN ('phone', 'text', 'email', 'in_person', 'portal', 'backfill')),
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'customer')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- "They never said that." The only update the table accepts.
  voided_at timestamptz,
  voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS job_payment_promises_job_created_idx
  ON public.job_payment_promises (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_payment_promises_customer_created_idx
  ON public.job_payment_promises (customer_id, created_at DESC);

COMMENT ON TABLE public.job_payment_promises IS
  'Append-only log of customer payment promises ("we will pay by <date>") per job: who said it, who heard it, channel, source (office | customer). Outcomes are derived from payments by the client kernel, never stored. Written via add_job_payment_promise and the job_promised_pay_dates trigger; voided via void_job_payment_promise; read via list_job_payment_promises / list_payment_promise_records.';

ALTER TABLE public.job_payment_promises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs manage job payment promises" ON public.job_payment_promises;
CREATE POLICY "Devs manage job payment promises" ON public.job_payment_promises
  FOR ALL USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_payment_promises TO authenticated;

-- ---------------------------------------------------------------------------
-- Shared gates (same roles as set_job_promised_pay_date / list_job_promised_pay_dates).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_write_payment_promises()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
         );
$$;

CREATE OR REPLACE FUNCTION public.can_read_payment_promises()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
         );
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_payment_promises() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_payment_promises() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_payment_promises() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_payment_promises() TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: the legacy upsert path logs an event too.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.job_promised_pay_dates_log_promise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- add_job_payment_promise already wrote the event; don't double-log.
  IF current_setting('app.promise_event_written', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- An UPDATE that keeps the same date is a re-stamp, not a new promise.
  IF TG_OP = 'UPDATE' AND OLD.promised_date = NEW.promised_date THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, heard_by, channel, source, created_at)
  SELECT NEW.job_id,
         COALESCE(j.gc_customer_id, j.customer_id),
         NEW.promised_date,
         NEW.marked_by,
         NULL,
         'office',
         COALESCE(NEW.marked_at, now())
  FROM public.jobs_ledger j
  WHERE j.id = NEW.job_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_promised_pay_dates_log_promise_trg ON public.job_promised_pay_dates;
CREATE TRIGGER job_promised_pay_dates_log_promise_trg
  AFTER INSERT OR UPDATE ON public.job_promised_pay_dates
  FOR EACH ROW EXECUTE FUNCTION public.job_promised_pay_dates_log_promise();

-- Backfill: the promises marked before this log existed (one row per job,
-- so at most one event each). Idempotent — skips jobs that already have an event.
INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, heard_by, channel, source, created_at)
SELECT p.job_id,
       COALESCE(j.gc_customer_id, j.customer_id),
       p.promised_date,
       p.marked_by,
       NULL,
       'office',
       p.marked_at
FROM public.job_promised_pay_dates p
JOIN public.jobs_ledger j ON j.id = p.job_id
WHERE NOT EXISTS (SELECT 1 FROM public.job_payment_promises e WHERE e.job_id = p.job_id);

-- ---------------------------------------------------------------------------
-- add_job_payment_promise: the full-detail write (PR 2's "They said…").
-- Writes the event, then keeps the one-per-job table (the chips) in step.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_job_payment_promise(
  p_job_id uuid,
  p_date date,
  p_said_by text DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_customer uuid;
BEGIN
  IF NOT public.can_write_payment_promises() THEN
    RAISE EXCEPTION 'Not allowed to record payment promises';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'A promise needs a date';
  END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('phone', 'text', 'email', 'in_person', 'backfill') THEN
    RAISE EXCEPTION 'Unknown channel %', p_channel;
  END IF;
  SELECT COALESCE(j.gc_customer_id, j.customer_id) INTO v_customer
  FROM public.jobs_ledger j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, said_by, heard_by, channel, source, note)
  VALUES (p_job_id, v_customer, p_date, NULLIF(trim(p_said_by), ''), auth.uid(), p_channel, 'office', NULLIF(trim(p_note), ''))
  RETURNING id INTO v_id;

  PERFORM set_config('app.promise_event_written', 'on', true);
  INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_by, marked_at)
  VALUES (p_job_id, p_date, auth.uid(), now())
  ON CONFLICT (job_id)
  DO UPDATE SET promised_date = EXCLUDED.promised_date,
                marked_by = EXCLUDED.marked_by,
                marked_at = now();
  PERFORM set_config('app.promise_event_written', 'off', true);

  RETURN jsonb_build_object('id', v_id, 'promisedDate', p_date);
END;
$$;

COMMENT ON FUNCTION public.add_job_payment_promise(uuid, date, text, text, text) IS
  'Record a customer payment promise on a job (who said it, channel, note) as an event, and set it as the job''s current promised date. Dev/master/assistant-like only.';

-- ---------------------------------------------------------------------------
-- void_job_payment_promise: "they never said that".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_job_payment_promise(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_write_payment_promises() THEN
    RAISE EXCEPTION 'Not allowed to void payment promises';
  END IF;
  UPDATE public.job_payment_promises
     SET voided_at = now(), voided_by = auth.uid()
   WHERE id = p_id AND voided_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promise not found or already voided';
  END IF;
  RETURN jsonb_build_object('voided', true);
END;
$$;

COMMENT ON FUNCTION public.void_job_payment_promise(uuid) IS
  'Mark a payment promise as never made (voided). Dev/master/assistant-like only.';

-- ---------------------------------------------------------------------------
-- list_job_payment_promises: every live event, newest first.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_job_payment_promises()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE WHEN NOT public.can_read_payment_promises() THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'jobId', e.job_id,
                'customerId', e.customer_id,
                'promisedYmd', to_char(e.promised_date, 'YYYY-MM-DD'),
                'saidBy', e.said_by,
                'heardByName', CASE WHEN e.heard_by IS NULL THEN NULL ELSE COALESCE(NULLIF(trim(u.name), ''), 'office') END,
                'channel', e.channel,
                'source', e.source,
                'note', e.note,
                'createdAt', e.created_at
              ) ORDER BY e.created_at DESC)
       FROM public.job_payment_promises e
       LEFT JOIN public.users u ON u.id = e.heard_by
       WHERE e.voided_at IS NULL),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_payment_promises() IS
  'All live (non-voided) payment promise events, newest first. NULL outside dev/master/assistant-like/primary.';

-- ---------------------------------------------------------------------------
-- list_payment_promise_records: the inputs the outcome kernel needs, one row
-- per live promise — what was billed on the job when the promise was made,
-- and every payment on the job (the kernel finds the paid-off date itself).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_payment_promise_records()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE WHEN NOT public.can_read_payment_promises() THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'jobId', e.job_id,
                'customerId', e.customer_id,
                'promisedYmd', to_char(e.promised_date, 'YYYY-MM-DD'),
                'createdAt', e.created_at,
                'source', e.source,
                'billedTotal', COALESCE((
                  SELECT SUM(i.amount) FROM public.jobs_ledger_invoices i
                  WHERE i.job_id = e.job_id
                    AND i.status IN ('billed', 'paid')
                    AND COALESCE(i.billed_at, i.created_at) <= e.created_at
                ), 0),
                'payments', COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('paidOn', to_char(p.paid_on, 'YYYY-MM-DD'), 'amount', p.amount) ORDER BY p.paid_on)
                  FROM public.jobs_ledger_payments p
                  WHERE p.job_id = e.job_id AND p.paid_on IS NOT NULL
                ), '[]'::jsonb)
              ) ORDER BY e.created_at)
       FROM public.job_payment_promises e
       WHERE e.voided_at IS NULL),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_payment_promise_records() IS
  'Per live promise: what was billed on the job at promise time and the job''s payment dates/amounts — the inputs for the client''s kept/late/broken derivation. NULL outside dev/master/assistant-like/primary.';

REVOKE EXECUTE ON FUNCTION public.add_job_payment_promise(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_job_payment_promise(uuid, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.void_job_payment_promise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_job_payment_promise(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_job_payment_promises() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_payment_promises() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_payment_promise_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_payment_promise_records() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.job_promised_pay_dates_log_promise() FROM PUBLIC, anon;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
