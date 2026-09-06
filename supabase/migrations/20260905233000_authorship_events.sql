SET lock_timeout = '3s';

-- v2.2904 — Authorship & events (journey-map Phase 4, Tier-3 batch B20; findings cluster C43).
--
-- The standing rule "rework ships with event logging" applied to four old tables:
--
--   1. jobs_ledger  — an AFTER INSERT trigger writes the job's BIRTH to job_activity_events
--                     ('job_created': "Job opened" / "Job opened from bid B398"). Every existing
--                     activity trigger on jobs_ledger is AFTER UPDATE, so until now the one event a
--                     job's feed could never show was its own creation (J1-F10, J15-F7). Backfilled
--                     from created_at, idempotently.
--   2. bid_pricing_assignments + bid_count_row_custom_prices — gain updated_by / updated_at,
--                     stamped by a BEFORE INSERT OR UPDATE trigger, so "who dropped this to 38%?"
--                     is answerable (J11-F9; bid_count_row_custom_costs.applied_by/applied_at is
--                     the model).
--   3. bid_rfqs (+ bids_submission_entries) — created_by defaults to auth.uid() and a BEFORE INSERT
--                     trigger fills it when a client passes NULL, so no lane can mint an RFQ with no
--                     asker (J12-N3; the copy lane stamps it client-side since v2.2851, this is the
--                     floor beneath it).
--   4. bids         — an AFTER INSERT trigger turns a hand-typed New Bid "Last Contact" into a
--                     bids_submission_entries row, so the column a trigger otherwise owns never
--                     holds a value the notes ledger cannot explain (J10-F11).
--
-- Idempotent and additive: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER. No new table, so the read-only write-block
-- helpers are not re-applied. Apply order is free: the client never writes the new columns.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A job's birth is an event
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.jobs_ledger_birth_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_bid_number text;
  v_summary text := 'Job opened';
  v_source text := 'manual';
BEGIN
  -- Service-role creators (auto_create_job_from_signed_estimate) already write their own,
  -- richer birth row ('job_auto_created_from_estimate'); a second generic row would be noise.
  IF v_actor IS NULL THEN
    RETURN new;
  END IF;

  IF new.bid_id IS NOT NULL THEN
    SELECT NULLIF(btrim(b.bid_number), '') INTO v_bid_number FROM public.bids b WHERE b.id = new.bid_id;
    v_source := 'bid';
    v_summary := 'Job opened from bid' || COALESCE(' B' || v_bid_number, '');
  ELSIF new.project_id IS NOT NULL THEN
    v_source := 'project';
    v_summary := 'Job opened under a project';
  END IF;

  -- Best-effort: telemetry never fails the create.
  BEGIN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (
      new.id,
      'job_created',
      COALESCE(new.created_at, now()),
      v_actor,
      v_summary,
      jsonb_build_object(
        'source_id', new.id::text,
        'source', v_source,
        'bid_id', new.bid_id,
        'bid_number', v_bid_number,
        'project_id', new.project_id,
        'status', new.status
      ),
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_birth_to_activity() IS
  'v2.2904 (B20): AFTER INSERT on jobs_ledger → one job_activity_events row (event_type job_created, source_id = job id) naming the bid it was opened from when bid_id is set. Skips service-role inserts, which log their own birth row.';

DROP TRIGGER IF EXISTS jobs_ledger_birth_to_activity_ins ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_birth_to_activity_ins
  AFTER INSERT ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_birth_to_activity();

-- Backfill: every existing job gets its birth row at created_at (actor unknown → null),
-- except jobs whose birth is already told by the auto-create guard's row. Re-runnable:
-- guarded on (event_type, detail->>'source_id') like 20260608010100.
INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
SELECT j.id,
       'job_created',
       j.created_at,
       NULL,
       CASE
         WHEN j.bid_id IS NOT NULL THEN 'Job opened from bid' || COALESCE(' B' || NULLIF(btrim(b.bid_number), ''), '')
         WHEN j.project_id IS NOT NULL THEN 'Job opened under a project'
         ELSE 'Job opened'
       END,
       jsonb_build_object(
         'source_id', j.id::text,
         'source', CASE WHEN j.bid_id IS NOT NULL THEN 'bid' WHEN j.project_id IS NOT NULL THEN 'project' ELSE 'manual' END,
         'bid_id', j.bid_id,
         'bid_number', NULLIF(btrim(b.bid_number), ''),
         'project_id', j.project_id,
         'backfilled', true
       ),
       false
  FROM public.jobs_ledger j
  LEFT JOIN public.bids b ON b.id = j.bid_id
 WHERE j.created_at IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.job_activity_events e
      WHERE e.job_id = j.id
        AND e.event_type IN ('job_created', 'job_auto_created_from_estimate')
   );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Price / margin edits carry an author
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.stamp_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at := now();
  new.updated_by := COALESCE(auth.uid(), new.updated_by);
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.stamp_updated_by() IS
  'v2.2904 (B20): BEFORE INSERT OR UPDATE — sets updated_at = now() and updated_by = auth.uid() (keeps a client-supplied value only when there is no session user). Attach to any table with those two columns.';

ALTER TABLE public.bid_pricing_assignments
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.bid_pricing_assignments.updated_by IS 'Who last assigned / overrode this row''s price (trigger-stamped from auth.uid(); null for rows older than v2.2904 or service-role writes).';
COMMENT ON COLUMN public.bid_pricing_assignments.updated_at IS 'When this row''s price was last assigned / overridden (trigger-stamped).';

ALTER TABLE public.bid_count_row_custom_prices
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.bid_count_row_custom_prices.updated_by IS 'Who last typed this custom unit price (trigger-stamped from auth.uid(); null for rows older than v2.2904 or service-role writes).';
COMMENT ON COLUMN public.bid_count_row_custom_prices.updated_at IS 'When this custom unit price was last typed (trigger-stamped).';

-- Rows older than this migration: updated_at would otherwise read "now" for everything.
-- created_at is the honest last-known touch; leave updated_by null (unknown). Runs BEFORE
-- the stamp triggers are attached — a BEFORE UPDATE stamp would reset it to now() again.
UPDATE public.bid_pricing_assignments
   SET updated_at = created_at
 WHERE created_at IS NOT NULL
   AND updated_by IS NULL
   AND updated_at > created_at;

UPDATE public.bid_count_row_custom_prices
   SET updated_at = created_at
 WHERE created_at IS NOT NULL
   AND updated_by IS NULL
   AND updated_at > created_at;

DROP TRIGGER IF EXISTS bid_pricing_assignments_stamp_updated_by ON public.bid_pricing_assignments;
CREATE TRIGGER bid_pricing_assignments_stamp_updated_by
  BEFORE INSERT OR UPDATE ON public.bid_pricing_assignments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_updated_by();

DROP TRIGGER IF EXISTS bid_count_row_custom_prices_stamp_updated_by ON public.bid_count_row_custom_prices;
CREATE TRIGGER bid_count_row_custom_prices_stamp_updated_by
  BEFORE INSERT OR UPDATE ON public.bid_count_row_custom_prices
  FOR EACH ROW EXECUTE FUNCTION public.stamp_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Every RFQ (and every bid note) has a creator
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.stamp_created_by_if_missing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.stamp_created_by_if_missing() IS
  'v2.2904 (B20): BEFORE INSERT — fills created_by from auth.uid() when the client omitted it or passed NULL. An explicit value (the edge functions'' sender id) always wins.';

ALTER TABLE public.bid_rfqs ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP TRIGGER IF EXISTS bid_rfqs_stamp_created_by ON public.bid_rfqs;
CREATE TRIGGER bid_rfqs_stamp_created_by
  BEFORE INSERT ON public.bid_rfqs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_created_by_if_missing();

ALTER TABLE public.bids_submission_entries ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP TRIGGER IF EXISTS bids_submission_entries_stamp_created_by ON public.bids_submission_entries;
CREATE TRIGGER bids_submission_entries_stamp_created_by
  BEFORE INSERT ON public.bids_submission_entries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_created_by_if_missing();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. New Bid's hand-typed Last Contact leaves a ledger entry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bids_seed_last_contact_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.last_contact IS NULL THEN
    RETURN new;
  END IF;
  -- Only when the bid has no ledger at all (a brand-new bid). Restores / copies that
  -- bring their entries along keep those entries as the story.
  IF EXISTS (SELECT 1 FROM public.bids_submission_entries e WHERE e.bid_id = new.id) THEN
    RETURN new;
  END IF;
  BEGIN
    INSERT INTO public.bids_submission_entries (bid_id, contact_method, notes, occurred_at, created_by)
    VALUES (
      new.id,
      'Other',
      'Last contact entered by hand on the New Bid form (no method recorded).',
      new.last_contact,
      auth.uid()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.bids_seed_last_contact_entry() IS
  'v2.2904 (B20): AFTER INSERT on bids — when a new bid arrives with a hand-typed last_contact and no submission entries, writes one method-bearing bids_submission_entries row at that time so the derived last_contact has a ledger line behind it. sync_last_contact_from_entries then finds the same max and leaves the column alone.';

DROP TRIGGER IF EXISTS bids_seed_last_contact_entry_ins ON public.bids;
CREATE TRIGGER bids_seed_last_contact_entry_ins
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.bids_seed_last_contact_entry();
