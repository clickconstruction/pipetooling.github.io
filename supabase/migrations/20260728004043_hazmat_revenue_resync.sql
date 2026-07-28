-- One-time revenue resync for hazmat-fee jobs (v2.1033).
--
-- Before v2.1029, Edit Job's save (and the billing autosave) recomputed
-- jobs_ledger.revenue from fixtures alone, silently wiping the fee's revenue
-- bump — so the Stages board's "bid" / "Left on Job" under-counted by the fee
-- (seen live on job 857: revenue 4,210 while fixtures 4,210 + fee 500 = 4,710).
-- The client now always writes fixtures + rider fees; this backfill repairs
-- the rows damaged earlier.
--
-- Scope: ONLY jobs that have hazmat incidents (1 job in prod today). The
-- fixtures sum mirrors revenueDollarsFromFixtures: named rows only, qty =
-- count when > 0 else 1, unit = line_unit_price else 0. Idempotent.

WITH fx AS (
  SELECT
    job_id,
    ROUND(SUM(
      (CASE WHEN COALESCE(count, 0) > 0 THEN count ELSE 1 END)
      * COALESCE(line_unit_price, 0)
    )::numeric, 2) AS fixtures_sum
  FROM public.jobs_ledger_fixtures
  WHERE COALESCE(btrim(name), '') <> ''
  GROUP BY job_id
),
fees AS (
  SELECT job_id, ROUND(SUM(fee_amount)::numeric, 2) AS fee_sum
  FROM public.job_hazmat_incidents
  GROUP BY job_id
)
UPDATE public.jobs_ledger jl
SET revenue = COALESCE(fx.fixtures_sum, 0) + fees.fee_sum,
    updated_at = NOW()
FROM fees
LEFT JOIN fx ON fx.job_id = fees.job_id
WHERE jl.id = fees.job_id
  AND COALESCE(jl.revenue, 0) <> COALESCE(fx.fixtures_sum, 0) + fees.fee_sum;
