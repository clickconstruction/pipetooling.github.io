SET lock_timeout = '3s';

-- GC difficulty rating, PR 5 (punch list #357, v2.7358): the ask at the end of a job.
--
-- The owner's call 7 of 2026-11-14: the master is asked at the end of a job with that GC, once, on the same
-- phone sheet a master rates from a bid. A job has no closed status; the work-done moment is its first move to
-- Ready to bill, which update_job_status already logs in job_status_events. So the open asks are derived, with no
-- new trigger on a table every crew writes:
--
--   1. gc_difficulty_asks — one row per job and person once the ask is settled: the rating that answered it, or
--      the day it was put away (Not now). A job with a row never asks that person again.
--   2. gc_difficulty_open_asks() — what is open for the person signed in: jobs they are the master on, moved to
--      Ready to bill on or after the day the ask began, with a GC on the job (a GC customer, a commercial
--      customer, or a job that came from a bid: the rule the GC's card uses), that GC not rated since the job
--      closed, and no row in (1). A dev is asked about ZZ test customers too, so the ask can be walked on the live
--      site without touching a real job.
--   3. The gates: a person reads and writes their own rows; the office reads all; a dev deletes a row made in a
--      walk.

-- 1. The settled asks.
CREATE TABLE IF NOT EXISTS public.gc_difficulty_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  asked_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  answered_rating_id uuid REFERENCES public.gc_difficulty_ratings(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_difficulty_asks_one_per_job_person UNIQUE (job_id, asked_user_id)
);

COMMENT ON TABLE public.gc_difficulty_asks IS
  'GC difficulty rating (punch list #357, PR 5): the ask at the end of a job, once settled. One row per job and person: answered_rating_id when they rated the GC from the ask, dismissed_at when they pressed Not now. The open asks are derived by gc_difficulty_open_asks() from job_status_events; a job with a row here never asks that person again.';
COMMENT ON COLUMN public.gc_difficulty_asks.customer_id IS 'The GC the job asked about: jobs_ledger.gc_customer_id, else its customer.';
COMMENT ON COLUMN public.gc_difficulty_asks.answered_rating_id IS 'The rating saved from the ask; NULL when the ask was put away, or when that rating was later deleted.';

CREATE INDEX IF NOT EXISTS gc_difficulty_asks_asked_user ON public.gc_difficulty_asks (asked_user_id);
CREATE INDEX IF NOT EXISTS gc_difficulty_asks_customer ON public.gc_difficulty_asks (customer_id);
CREATE INDEX IF NOT EXISTS gc_difficulty_asks_rating ON public.gc_difficulty_asks (answered_rating_id) WHERE answered_rating_id IS NOT NULL;

-- 2. What is open for the person signed in.
CREATE OR REPLACE FUNCTION public.gc_difficulty_open_asks()
RETURNS TABLE (job_id uuid, customer_id uuid, customer_name text, hcp_number text, click_number text, job_name text, closed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT j.id, c.id, c.name, j.hcp_number, j.click_number, j.job_name, e.closed_at
  FROM public.jobs_ledger j
  JOIN public.customers c ON c.id = COALESCE(j.gc_customer_id, j.customer_id)
  JOIN LATERAL (
    SELECT min(ev.changed_at) AS closed_at
    FROM public.job_status_events ev
    WHERE ev.job_id = j.id AND ev.to_status = 'ready_to_bill'
  ) e ON e.closed_at >= TIMESTAMPTZ '2026-11-15 00:00:00-06'
  WHERE (j.master_user_id = auth.uid() OR (public.is_dev() AND c.name ILIKE 'ZZ %'))
    AND (j.gc_customer_id IS NOT NULL OR c.customer_type = 'commercial' OR j.bid_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.gc_difficulty_asks a WHERE a.job_id = j.id AND a.asked_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.gc_difficulty_ratings r WHERE r.customer_id = c.id AND r.rated_at >= e.closed_at)
  ORDER BY e.closed_at DESC
  LIMIT 50
$fn$;

COMMENT ON FUNCTION public.gc_difficulty_open_asks() IS
  'GC difficulty rating (punch list #357, PR 5): the end-of-job asks open for the caller. Jobs they are the master on (a dev: ZZ test customers too) whose first move to Ready to bill is on or after 2026-11-15, with a GC on the job, that GC not rated since, and no row in gc_difficulty_asks. SECURITY INVOKER: it reads what the caller may read.';

REVOKE ALL ON FUNCTION public.gc_difficulty_open_asks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_difficulty_open_asks() TO authenticated;

-- 3. The gates.
ALTER TABLE public.gc_difficulty_asks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_difficulty_asks_select_own_or_office ON public.gc_difficulty_asks;
CREATE POLICY gc_difficulty_asks_select_own_or_office
  ON public.gc_difficulty_asks FOR SELECT TO authenticated
  USING (asked_user_id = auth.uid() OR public.is_office_staff());

DROP POLICY IF EXISTS gc_difficulty_asks_insert_own ON public.gc_difficulty_asks;
CREATE POLICY gc_difficulty_asks_insert_own
  ON public.gc_difficulty_asks FOR INSERT TO authenticated
  WITH CHECK (asked_user_id = auth.uid());

DROP POLICY IF EXISTS gc_difficulty_asks_delete_dev ON public.gc_difficulty_asks;
CREATE POLICY gc_difficulty_asks_delete_dev
  ON public.gc_difficulty_asks FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.gc_difficulty_asks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.gc_difficulty_asks TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
