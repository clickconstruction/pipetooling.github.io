SET lock_timeout = '3s';

-- v2.3367 — job baselines: what a job actually took, kept for the labor book.
-- Owner (2026-09-12): "start focusing on collecting labor baselines instead of
-- just guessing." 7 of 187 bids sent in 180 days carry hours; every finished
-- job carries recorded hours. So a baseline is TAKEN from the job, not typed:
--   • kept automatically when a job's status moves to billed or paid,
--   • or kept now from the Costs tab (keep_job_baseline_now) mid-job.
-- Two grades: hours per $1k of price for every job; hours per fixture when the
-- bid carried a count sheet (recorded hours allocated across the count rows by
-- the bid's predicted hours where any, else by count). Nothing here changes
-- the job; it teaches the next bid.

CREATE TABLE IF NOT EXISTS public.job_baselines (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  kept_at timestamptz NOT NULL DEFAULT now(),
  -- NULL = the billing trigger; a user id = Keep now on the Costs tab.
  kept_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kept_on text NOT NULL CHECK (kept_on IN ('billed', 'kept')),
  job_status text,
  price_usd numeric,
  team_hours numeric NOT NULL DEFAULT 0,
  team_usd numeric NOT NULL DEFAULT 0,
  people_count integer NOT NULL DEFAULT 0,
  materials_usd numeric NOT NULL DEFAULT 0,
  hours_per_thousand numeric GENERATED ALWAYS AS (CASE WHEN price_usd > 0 THEN team_hours / (price_usd / 1000) END) STORED,
  avg_wage_usd numeric GENERATED ALWAYS AS (CASE WHEN team_hours > 0 THEN team_usd / team_hours END) STORED,
  -- 'fixture' when the bid had count rows (see job_baseline_rows), else 'per_thousand'.
  grade text NOT NULL CHECK (grade IN ('per_thousand', 'fixture')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.job_baselines IS 'v2.3367: what a job actually took (hours, wages, materials, price), kept on billing or by hand, for the labor book. One per job; re-keeping replaces it.';

CREATE TABLE IF NOT EXISTS public.job_baseline_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_baselines(job_id) ON DELETE CASCADE,
  fixture text NOT NULL,
  unit text,
  count numeric NOT NULL DEFAULT 0,
  -- The job's recorded hours attributed to this row, by the weight named below.
  hours numeric NOT NULL DEFAULT 0,
  weight_source text NOT NULL CHECK (weight_source IN ('predicted', 'count')),
  predicted_hours numeric
);
CREATE INDEX IF NOT EXISTS job_baseline_rows_job_idx ON public.job_baseline_rows(job_id);
COMMENT ON TABLE public.job_baseline_rows IS 'v2.3367: a job baseline by fixture — recorded hours allocated across the bid''s count rows (by predicted hours where the bid had them, else by count).';

CREATE INDEX IF NOT EXISTS job_baselines_bid_idx ON public.job_baselines(bid_id);
CREATE INDEX IF NOT EXISTS job_baselines_kept_at_idx ON public.job_baselines(kept_at);

-- ---------------------------------------------------------------- the keeper
-- Internal: no auth check (the billing trigger runs as whoever billed). Not
-- granted to the API roles; the RPC below is the door.
CREATE OR REPLACE FUNCTION public.keep_job_baseline(p_job_id uuid, p_kept_by uuid, p_kept_on text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs_ledger%ROWTYPE;
  v_hours numeric := 0;
  v_usd numeric := 0;
  v_people integer := 0;
  v_materials numeric := 0;
  v_version uuid;
  v_has_counts boolean := false;
  v_pred_total numeric := 0;
  v_count_total numeric := 0;
BEGIN
  SELECT * INTO v_job FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Recorded team hours and wages on the job (the same fold as get_man_hours_by_job, one job, with the wage).
  WITH crew AS (
    SELECT cj.work_date, cj.person_name,
           jsonb_array_elements(CASE WHEN jsonb_typeof(cj.job_assignments) = 'array' THEN cj.job_assignments ELSE '[]'::jsonb END) AS assignment
      FROM public.people_crew_jobs cj
  ),
  alloc AS (
    SELECT c.person_name,
           (CASE WHEN coalesce(pc.is_salary, false)
                 THEN CASE WHEN extract(dow FROM c.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
                 ELSE coalesce(ph.hours, 0) END)
           * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) AS hrs,
           coalesce(pc.hourly_wage, 0) AS wage
      FROM crew c
      LEFT JOIN public.people_pay_config pc ON pc.person_name = c.person_name
      LEFT JOIN public.people_hours_recorded ph ON ph.person_name = c.person_name AND ph.work_date = c.work_date
     WHERE c.assignment->>'job_id' = p_job_id::text
  )
  SELECT coalesce(sum(hrs), 0), coalesce(sum(hrs * wage), 0), count(DISTINCT person_name) FILTER (WHERE hrs > 0)
    INTO v_hours, v_usd, v_people
    FROM alloc;

  IF v_hours <= 0 THEN
    RETURN false; -- nothing to keep
  END IF;

  -- Materials the job side counts: supply-house splits and card charges (absolute; the bank signs debits negative).
  SELECT coalesce((SELECT sum(coalesce(i.amount, 0) * coalesce(a.pct, 0) / 100.0)
                     FROM public.supply_house_invoice_job_allocations a
                     JOIN public.supply_house_invoices i ON i.id = a.supply_house_invoice_id
                    WHERE a.job_id = p_job_id), 0)
       + coalesce((SELECT sum(abs(coalesce(m.amount, 0))) FROM public.mercury_transaction_job_allocations m WHERE m.job_id = p_job_id), 0)
    INTO v_materials;

  -- The bid's count sheet, if any (the active version's rows, else the unversioned ones).
  IF v_job.bid_id IS NOT NULL THEN
    SELECT selected_bid_version_id INTO v_version FROM public.bids WHERE id = v_job.bid_id;
    SELECT EXISTS (SELECT 1 FROM public.bids_count_rows r WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0)
      INTO v_has_counts;
  END IF;

  INSERT INTO public.job_baselines (job_id, bid_id, kept_at, kept_by, kept_on, job_status, price_usd, team_hours, team_usd, people_count, materials_usd, grade, updated_at)
  VALUES (p_job_id, v_job.bid_id, now(), p_kept_by, p_kept_on, v_job.status, v_job.revenue, v_hours, v_usd, v_people, v_materials, CASE WHEN v_has_counts THEN 'fixture' ELSE 'per_thousand' END, now())
  ON CONFLICT (job_id) DO UPDATE
    SET bid_id = EXCLUDED.bid_id, kept_at = EXCLUDED.kept_at, kept_by = EXCLUDED.kept_by, kept_on = EXCLUDED.kept_on, job_status = EXCLUDED.job_status,
        price_usd = EXCLUDED.price_usd, team_hours = EXCLUDED.team_hours, team_usd = EXCLUDED.team_usd, people_count = EXCLUDED.people_count,
        materials_usd = EXCLUDED.materials_usd, grade = EXCLUDED.grade, updated_at = now();

  DELETE FROM public.job_baseline_rows WHERE job_id = p_job_id;

  IF v_has_counts THEN
    -- Weights: the bid's predicted hours per count row where the estimate has any, else the counts themselves.
    WITH counts AS (
      SELECT lower(trim(r.fixture)) AS key, max(r.fixture) AS fixture, max(r.unit) AS unit, sum(coalesce(r.count, 0)) AS cnt
        FROM public.bids_count_rows r
       WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0
       GROUP BY lower(trim(r.fixture))
    ),
    predicted AS (
      SELECT lower(trim(l.fixture)) AS key,
             sum((coalesce(l.rough_in_hrs_per_unit, 0) + coalesce(l.top_out_hrs_per_unit, 0) + coalesce(l.trim_set_hrs_per_unit, 0))
                 * CASE WHEN l.kind = 'sub' THEN 0
                        WHEN coalesce(l.is_fixed, false) OR l.kind = 'task' THEN 1
                        WHEN coalesce(l.unit, '') ILIKE '%100%' THEN coalesce(l.count, 0) / 100.0
                        ELSE coalesce(l.count, 0) END) AS hrs
        FROM public.cost_estimate_labor_rows l
        JOIN public.cost_estimates e ON e.id = l.cost_estimate_id
       WHERE e.bid_id = v_job.bid_id
       GROUP BY lower(trim(l.fixture))
    ),
    joined AS (
      SELECT c.key, c.fixture, c.unit, c.cnt, coalesce(p.hrs, 0) AS pred
        FROM counts c LEFT JOIN predicted p ON p.key = c.key
    )
    SELECT coalesce(sum(pred), 0), coalesce(sum(cnt), 0) INTO v_pred_total, v_count_total FROM joined;

    INSERT INTO public.job_baseline_rows (job_id, fixture, unit, count, hours, weight_source, predicted_hours)
    SELECT p_job_id, j.fixture, j.unit, j.cnt,
           CASE WHEN v_pred_total > 0 THEN v_hours * j.pred / v_pred_total
                WHEN v_count_total > 0 THEN v_hours * j.cnt / v_count_total
                ELSE 0 END,
           CASE WHEN v_pred_total > 0 THEN 'predicted' ELSE 'count' END,
           CASE WHEN j.pred > 0 THEN j.pred END
      FROM (
        WITH counts AS (
          SELECT lower(trim(r.fixture)) AS key, max(r.fixture) AS fixture, max(r.unit) AS unit, sum(coalesce(r.count, 0)) AS cnt
            FROM public.bids_count_rows r
           WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0
           GROUP BY lower(trim(r.fixture))
        ),
        predicted AS (
          SELECT lower(trim(l.fixture)) AS key,
                 sum((coalesce(l.rough_in_hrs_per_unit, 0) + coalesce(l.top_out_hrs_per_unit, 0) + coalesce(l.trim_set_hrs_per_unit, 0))
                     * CASE WHEN l.kind = 'sub' THEN 0
                            WHEN coalesce(l.is_fixed, false) OR l.kind = 'task' THEN 1
                            WHEN coalesce(l.unit, '') ILIKE '%100%' THEN coalesce(l.count, 0) / 100.0
                            ELSE coalesce(l.count, 0) END) AS hrs
            FROM public.cost_estimate_labor_rows l
            JOIN public.cost_estimates e ON e.id = l.cost_estimate_id
           WHERE e.bid_id = v_job.bid_id
           GROUP BY lower(trim(l.fixture))
        )
        SELECT c.key, c.fixture, c.unit, c.cnt, coalesce(p.hrs, 0) AS pred FROM counts c LEFT JOIN predicted p ON p.key = c.key
      ) j;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_job_baseline(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.keep_job_baseline(uuid, uuid, text) IS 'v2.3367: internal keeper — recorded hours, wages, people, materials, price, and the per-fixture rows when the bid has counts. Called by the billing trigger and keep_job_baseline_now.';

-- The door: Keep now from the Costs tab (wage roles).
CREATE OR REPLACE FUNCTION public.keep_job_baseline_now(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'keep_job_baseline_now: not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')) THEN
    RAISE EXCEPTION 'keep_job_baseline_now: not allowed';
  END IF;
  RETURN public.keep_job_baseline(p_job_id, auth.uid(), 'kept');
END;
$$;
COMMENT ON FUNCTION public.keep_job_baseline_now(uuid) IS 'v2.3367: keep this job''s baseline now (dev / master / assistant / controller). Billing keeps one on its own.';

-- Billing keeps a baseline on its own.
CREATE OR REPLACE FUNCTION public.jobs_ledger_keep_baseline_on_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('billed', 'paid') AND (OLD.status IS DISTINCT FROM NEW.status) AND coalesce(OLD.status, '') NOT IN ('billed', 'paid') THEN
    PERFORM public.keep_job_baseline(NEW.id, NULL, 'billed');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jobs_ledger_keep_baseline_on_billing ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_keep_baseline_on_billing
  AFTER UPDATE OF status ON public.jobs_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_keep_baseline_on_billing();

-- Hours-only reading for the Labor tab (estimators included): no wages leave the table this way.
CREATE OR REPLACE FUNCTION public.job_baseline_rates()
RETURNS TABLE(job_id uuid, bid_id uuid, kept_at timestamptz, kept_on text, price_usd numeric, team_hours numeric, hours_per_thousand numeric, people_count integer, grade text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.job_id, b.bid_id, b.kept_at, b.kept_on, b.price_usd, b.team_hours, b.hours_per_thousand, b.people_count, b.grade
    FROM public.job_baselines b
   WHERE auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator'))
     AND b.price_usd > 0 AND b.team_hours > 0;
$$;
COMMENT ON FUNCTION public.job_baseline_rates() IS 'v2.3367: every kept baseline as hours per $1k of price — no wages — for the Labor tab''s per-$1k reading (dev / master / assistant / controller / estimator).';

-- ---------------------------------------------------------------- RLS
ALTER TABLE public.job_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_baseline_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_baselines_select_wage_roles ON public.job_baselines;
CREATE POLICY job_baselines_select_wage_roles ON public.job_baselines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')));
DROP POLICY IF EXISTS job_baseline_rows_select_wage_roles ON public.job_baseline_rows;
CREATE POLICY job_baseline_rows_select_wage_roles ON public.job_baseline_rows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')));
-- Writes go through the keeper only.

-- ---------------------------------------------------------------- back-fill: every billed or paid job with recorded hours
DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.jobs_ledger WHERE status IN ('billed', 'paid') LOOP
    IF public.keep_job_baseline(r.id, NULL, 'billed') THEN n := n + 1; END IF;
  END LOOP;
  RAISE NOTICE 'job_baselines: % billed/paid job(s) back-filled', n;
END $$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
