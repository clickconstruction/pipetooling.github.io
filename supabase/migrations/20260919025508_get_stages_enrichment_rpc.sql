SET lock_timeout = '3s';

-- Pipeline load speed PR 3 (v2.3602): one request for the Stages board's enrichment. The
-- client used to run three chunked passes (materials + fixtures, schedule work dates,
-- estimates) per board load — twelve requests across the three loads a visit makes. This
-- returns the four maps in one round trip, keyed by job id. SECURITY INVOKER: every table's
-- RLS applies exactly as it did to the client's own reads.

CREATE OR REPLACE FUNCTION public.get_stages_enrichment(p_job_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'materials', COALESCE((
      SELECT jsonb_object_agg(x.job_id, x.rows)
        FROM (
          SELECT m.job_id, jsonb_agg(to_jsonb(m) ORDER BY m.sequence_order) AS rows
            FROM public.jobs_ledger_materials m
           WHERE m.job_id = ANY (p_job_ids)
           GROUP BY m.job_id
        ) x
    ), '{}'::jsonb),
    'fixtures', COALESCE((
      SELECT jsonb_object_agg(x.job_id, x.rows)
        FROM (
          SELECT f.job_id, jsonb_agg(to_jsonb(f) ORDER BY f.sequence_order) AS rows
            FROM public.jobs_ledger_fixtures f
           WHERE f.job_id = ANY (p_job_ids)
           GROUP BY f.job_id
        ) x
    ), '{}'::jsonb),
    'schedule_max', COALESCE((
      SELECT jsonb_object_agg(x.job_id, x.max_date)
        FROM (
          SELECT b.job_id, max(b.work_date) AS max_date
            FROM public.job_schedule_blocks b
           WHERE b.job_id = ANY (p_job_ids) AND b.work_date IS NOT NULL
           GROUP BY b.job_id
        ) x
    ), '{}'::jsonb),
    'estimates', COALESCE((
      SELECT jsonb_object_agg(x.job_ledger_id, x.rows)
        FROM (
          SELECT e.job_ledger_id,
                 jsonb_agg(jsonb_build_object('estimate_number', e.estimate_number, 'title', e.title, 'status', e.status, 'updated_at', e.updated_at)) AS rows
            FROM public.estimates e
           WHERE e.job_ledger_id = ANY (p_job_ids)
           GROUP BY e.job_ledger_id
        ) x
    ), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_stages_enrichment(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_stages_enrichment(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_stages_enrichment(uuid[]) IS
  'v2.3602 Stages board enrichment in one round trip: {materials, fixtures, schedule_max, estimates} keyed by job id (materials/fixtures rows in sequence order; schedule_max = max work_date; estimates = the banner candidates). SECURITY INVOKER — the tables'' RLS applies. Client: lib/fetchJobsLedgerWithDetailsForStages.ts fetchStagesEnrichment, with the chunked passes as its fallback.';
