-- One-time backfill: copy legacy jobs_ledger.revenue onto the first jobs_ledger_fixtures row
-- when named Specific Work lines contribute $0 extended total (same rule as revenueDollarsFromFixtures).
-- Does not modify jobs_ledger.revenue.

DO $body$
DECLARE
  n_upd int := 0;
  n_ins int := 0;
BEGIN
  CREATE TEMP TABLE _mig_eligible_legacy_revenue (
    job_id uuid PRIMARY KEY,
    revenue numeric NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _mig_eligible_legacy_revenue (job_id, revenue)
  SELECT j.id, j.revenue
  FROM public.jobs_ledger j
  LEFT JOIN (
    SELECT
      f.job_id,
      COALESCE(
        SUM(ROUND(f.count::numeric * COALESCE(f.line_unit_price, 0), 2)),
        0
      ) AS ext
    FROM public.jobs_ledger_fixtures f
    WHERE trim(COALESCE(f.name, '')) <> ''
    GROUP BY f.job_id
  ) fe ON fe.job_id = j.id
  WHERE COALESCE(j.revenue, 0) > 0
    AND COALESCE(fe.ext, 0) = 0;

  UPDATE public.jobs_ledger_fixtures f
  SET
    count = GREATEST(COALESCE(f.count, 0), 1),
    line_unit_price = ROUND(
      e.revenue::numeric / GREATEST(COALESCE(f.count, 0), 1)::numeric,
      2
    )
  FROM (
    SELECT DISTINCT ON (f2.job_id)
      f2.id AS fixture_id,
      f2.job_id
    FROM public.jobs_ledger_fixtures f2
    INNER JOIN _mig_eligible_legacy_revenue e2 ON e2.job_id = f2.job_id
    ORDER BY f2.job_id, f2.sequence_order ASC, f2.created_at ASC NULLS LAST, f2.id ASC
  ) ff
  INNER JOIN _mig_eligible_legacy_revenue e ON e.job_id = ff.job_id
  WHERE f.id = ff.fixture_id
    AND f.job_id = ff.job_id;

  GET DIAGNOSTICS n_upd = ROW_COUNT;

  INSERT INTO public.jobs_ledger_fixtures (
    job_id,
    name,
    count,
    line_unit_price,
    line_description,
    sequence_order
  )
  SELECT
    e.job_id,
    'Job total (migrated)',
    1,
    ROUND(e.revenue::numeric, 2),
    NULL,
    0
  FROM _mig_eligible_legacy_revenue e
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_fixtures f3
    WHERE f3.job_id = e.job_id
  );

  GET DIAGNOSTICS n_ins = ROW_COUNT;

  RAISE NOTICE 'migrate_legacy_revenue_to_first_fixture: updated % row(s), inserted % row(s)', n_upd, n_ins;
END $body$;
