SET lock_timeout = '3s';

-- v2.3778: the job-name plan runs read-only, and the import placeholder is not work.
--
-- 20260923220000's plan_job_names_from_work built a temp table, so the plan (p_apply = false)
-- failed inside a read-only transaction — including the dev-mcp seat's call_read, which is the
-- door the migration doc said to use. The plan is now one query; the apply is the same query
-- feeding an UPDATE and an INSERT in data-modifying CTEs. Same signature, same rows.
--
-- The first run of the plan on prod also listed "Job total (migrated)" eight times: the import's
-- placeholder line, never the work. specific_work_name() now refuses it and any name ending in
-- "(migrated)" — the twin of src/lib/estimates/jobNameFromWork.ts. auto_create_job_from_signed_estimate
-- calls specific_work_name and needs no rebuild.

CREATE OR REPLACE FUNCTION public.specific_work_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = public
AS $f$
  SELECT CASE
           WHEN s = '' OR length(s) > 60 THEN NULL
           WHEN lower(s) LIKE '%(migrated)' THEN NULL
           WHEN lower(s) IN ('item', 'service', 'service visit', 'custom service visit', 'service call',
                             'trip charge', 'labor', 'materials', 'misc', 'miscellaneous',
                             'job total', 'job total (migrated)') THEN NULL
           ELSE s
         END
    FROM (
      SELECT CASE WHEN t0 = '' THEN '' ELSE upper(left(t0, 1)) || substr(t0, 2) END AS s
        FROM (SELECT btrim(regexp_replace(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), '\.+$', '')) AS t0) t1
    ) t;
$f$;

COMMENT ON FUNCTION public.specific_work_name(text) IS
  'v2.3766/v2.3778: a Specific Work / estimate line name that can stand as the work in a job name (folded, trailing periods dropped, first letter capitalised, 1–60 chars, not a generic service word, not an import "(migrated)" placeholder), else NULL. Twin of src/lib/estimates/jobNameFromWork.ts.';

CREATE OR REPLACE FUNCTION public.plan_job_names_from_work(p_apply boolean DEFAULT false)
RETURNS TABLE (job_id uuid, hcp_number text, old_name text, new_name text, work text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'plan_job_names_from_work: not authenticated';
  END IF;
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('dev', 'controller') THEN
    RAISE EXCEPTION 'plan_job_names_from_work: not authorized';
  END IF;

  IF NOT p_apply THEN
    RETURN QUERY
      SELECT p.job_id, p.hcp_number, p.old_name, p.new_name, p.work
        FROM public.job_names_from_work_plan() p
       ORDER BY p.hcp_number NULLS LAST, p.old_name;
    RETURN;
  END IF;

  RETURN QUERY
    WITH p AS (
      SELECT * FROM public.job_names_from_work_plan()
    ), upd AS (
      UPDATE public.jobs_ledger j
         SET job_name = p.new_name
        FROM p
       WHERE j.id = p.job_id
       RETURNING j.id
    ), ins AS (
      INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
      SELECT p.job_id, 'job_renamed_from_work', v_uid,
             'Renamed from "' || p.old_name || '" to "' || p.new_name || '"',
             jsonb_build_object('old_name', p.old_name, 'new_name', p.new_name, 'work', p.work,
                                'source', 'plan_job_names_from_work'),
             false
        FROM p
      RETURNING job_activity_events.job_id
    )
    SELECT p.job_id, p.hcp_number, p.old_name, p.new_name, p.work
      FROM p
     ORDER BY p.hcp_number NULLS LAST, p.old_name;
END;
$$;

-- The plan itself: one query, no side effects. Private to the two callers above (no grant to
-- authenticated — the role check lives in plan_job_names_from_work).
CREATE OR REPLACE FUNCTION public.job_names_from_work_plan()
RETURNS TABLE (job_id uuid, hcp_number text, old_name text, new_name text, work text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.hcp_number, j.job_name,
         btrim(regexp_replace(c.name, '\s+', ' ', 'g')) || ' — ' || w.work,
         w.work
    FROM public.jobs_ledger j
    JOIN public.customers c ON c.id = j.customer_id
    JOIN LATERAL (
      SELECT public.specific_work_name(f.name) AS work
        FROM public.jobs_ledger_fixtures f
       WHERE f.job_id = j.id
    ) w ON TRUE
   WHERE NULLIF(btrim(c.name), '') IS NOT NULL
     AND w.work IS NOT NULL
     AND (SELECT count(*) FROM public.jobs_ledger_fixtures f2 WHERE f2.job_id = j.id) = 1
     AND (lower(regexp_replace(btrim(COALESCE(j.job_name, '')), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(c.name), '\s+', ' ', 'g'))
          OR btrim(COALESCE(j.job_name, '')) ~* '^(estimate|change order) for\s')
     AND btrim(COALESCE(j.job_name, '')) <> btrim(regexp_replace(c.name, '\s+', ' ', 'g')) || ' — ' || w.work;
$$;

COMMENT ON FUNCTION public.job_names_from_work_plan() IS
  'v2.3778: the rows plan_job_names_from_work lists or renames — jobs named with only the customer''s name (or still "Estimate for …") that have exactly one specific Specific Work line. No side effects. Called only by plan_job_names_from_work.';

REVOKE ALL ON FUNCTION public.job_names_from_work_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_names_from_work_plan() TO service_role;

COMMENT ON FUNCTION public.plan_job_names_from_work(boolean) IS
  'v2.3766/v2.3778: jobs named with only the customer''s name (or still "Estimate for …") that have exactly one specific Specific Work line — the plan (p_apply=false, one read-only query) or the rename (p_apply=true; one job_activity_events row per job, event_type job_renamed_from_work). Dev or controller.';
