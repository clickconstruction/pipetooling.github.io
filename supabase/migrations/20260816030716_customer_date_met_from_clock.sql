SET lock_timeout = '3s';

-- customers.date_met defaults to the date of the first clock session on any
-- of the customer's jobs; a human-entered date always wins (v2.1696).
--
-- date_met_source records who set date_met:
--   'manual' — a person typed it; automation never overwrites it.
--   'clock'  — filled from clock sessions; may move EARLIER if a backdated
--              session shows up, and a manual edit overrides it.
--   NULL     — legacy/unknown. Treated as manual when date_met is set (never
--              clobber what someone may have typed); fillable when date_met
--              is null.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS date_met_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_date_met_source_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_date_met_source_check
      CHECK (date_met_source IS NULL OR date_met_source IN ('manual', 'clock'));
  END IF;
END $$;

-- Shared fill rule: set date_met when it's empty, or lower a clock-sourced
-- value when an earlier date appears. SECURITY DEFINER because the writer is
-- whoever clocked in — crew roles can insert clock_sessions but can't UPDATE
-- customers under RLS. (Training-mode read_only users never reach this: their
-- clock_sessions INSERT is already blocked.)
CREATE OR REPLACE FUNCTION public.customer_date_met_apply(p_customer_id uuid, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_customer_id IS NULL OR p_work_date IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.customers c
     SET date_met = p_work_date,
         date_met_source = 'clock'
   WHERE c.id = p_customer_id
     AND (
       c.date_met IS NULL
       OR (c.date_met_source = 'clock' AND p_work_date < c.date_met)
     );
END;
$$;

-- Every clock-in on a customer-linked job offers its work_date as the
-- customer's first-met date. Insert-only: editing or rejecting a session
-- later doesn't retract the date (it was still a real first visit).
CREATE OR REPLACE FUNCTION public.clock_session_fills_customer_date_met()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_ledger_id IS NULL OR NEW.rejected_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.customer_date_met_apply(
    (SELECT jl.customer_id FROM public.jobs_ledger jl WHERE jl.id = NEW.job_ledger_id),
    NEW.work_date
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_session_fills_customer_date_met ON public.clock_sessions;
CREATE TRIGGER clock_session_fills_customer_date_met
  AFTER INSERT ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.clock_session_fills_customer_date_met();

-- Linking a customer to a job AFTER crews already clocked on it fills from
-- that job's earliest surviving session.
CREATE OR REPLACE FUNCTION public.job_customer_link_fills_date_met()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL OR NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
    RETURN NEW;
  END IF;
  PERFORM public.customer_date_met_apply(
    NEW.customer_id,
    (SELECT MIN(cs.work_date)
       FROM public.clock_sessions cs
      WHERE cs.job_ledger_id = NEW.id
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_customer_link_fills_date_met ON public.jobs_ledger;
CREATE TRIGGER job_customer_link_fills_date_met
  AFTER UPDATE OF customer_id ON public.jobs_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.job_customer_link_fills_date_met();

-- One-time backfill: customers with no date_met get their earliest surviving
-- clock-session date. Idempotent — fills NULLs only, so re-running (or a
-- later db push replay) touches nothing a person or the triggers already set.
UPDATE public.customers c
   SET date_met = s.first_work_date,
       date_met_source = 'clock'
  FROM (
    SELECT jl.customer_id, MIN(cs.work_date) AS first_work_date
      FROM public.clock_sessions cs
      JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
     WHERE jl.customer_id IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL
     GROUP BY jl.customer_id
  ) s
 WHERE c.id = s.customer_id
   AND c.date_met IS NULL;
