SET lock_timeout = '3s';

-- v2.3766: a job made from an estimate is named for the work too, and a plan-then-apply
-- backfill for jobs already named with only the customer's name.
--
-- The office names jobs for the work ("Montolongo- Pretest", "Pool Work", "Gas Line") so a
-- second job at the same house can be told from the first. v2.3748 named the job for the
-- customer when the estimate's title was still "Estimate for <customer>"; this adds the work
-- when the estimate has exactly one line whose name is specific — the twin of
-- src/lib/estimates/jobNameFromWork.ts. Keep the three in step: specific_work_name() below,
-- specificWorkFromLines() in the kernel, and the rule text in docs/recent-features/v2.3766.md.

-- 1. The rule, once: a line name that can stand as the work in a job name — whitespace-folded,
--    trailing periods dropped, first letter capitalised, 1–60 characters, not a generic service
--    word. NULL otherwise.
CREATE OR REPLACE FUNCTION public.specific_work_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = public
AS $f$
  SELECT CASE
           WHEN s = '' OR length(s) > 60 THEN NULL
           WHEN lower(s) IN ('item', 'service', 'service visit', 'custom service visit', 'service call',
                             'trip charge', 'labor', 'materials', 'misc', 'miscellaneous') THEN NULL
           ELSE s
         END
    FROM (
      SELECT CASE WHEN t0 = '' THEN '' ELSE upper(left(t0, 1)) || substr(t0, 2) END AS s
        FROM (SELECT btrim(regexp_replace(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), '\.+$', '')) AS t0) t1
    ) t;
$f$;

COMMENT ON FUNCTION public.specific_work_name(text) IS
  'v2.3766: a Specific Work / estimate line name that can stand as the work in a job name (folded, 1–60 chars, not a generic service word), else NULL. Twin of src/lib/estimates/jobNameFromWork.ts.';

REVOKE ALL ON FUNCTION public.specific_work_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.specific_work_name(text) TO authenticated, service_role;

-- 2. auto_create_job_from_signed_estimate: the 20260923120000 body, with the work added to the
--    name when the title is still the app default. Everything else is unchanged.

CREATE OR REPLACE FUNCTION public.auto_create_job_from_signed_estimate(p_estimate_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  v_job uuid;
  v_twin record;
  v_fixtures jsonb;
  v_name text;
  v_cust_name text;
  v_work text;
  v_folded text;
BEGIN
  SELECT id, status, doc_kind, estimate_number, job_ledger_id, bid_id, master_user_id, customer_id,
         title, for_address, total_cents, line_items_snapshot
    INTO e
    FROM public.estimates
   WHERE id = p_estimate_id;
  IF e.id IS NULL THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;
  IF e.status <> 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  -- Guard 1: a change order is applied to a job (apply_estimate_to_job, by the office, from the
  -- record's "Apply to job" window) — it never becomes a job of its own.
  IF e.doc_kind = 'change_order' THEN
    RAISE EXCEPTION 'auto_create_job_guard: change order #% is applied to a job by the office, never auto-created', e.estimate_number
      USING ERRCODE = 'check_violation';
  END IF;

  -- A job someone already made for this bid by hand: link it, never duplicate it.
  IF e.bid_id IS NOT NULL THEN
    SELECT id INTO v_job FROM public.jobs_ledger WHERE bid_id = e.bid_id ORDER BY created_at DESC LIMIT 1;
    IF v_job IS NOT NULL THEN
      UPDATE public.estimates SET job_ledger_id = v_job WHERE id = e.id;
      RETURN v_job;
    END IF;
  END IF;

  -- The job's name (v2.3748). The estimate's title is the heading on the paper the customer
  -- signed, so its default reads "Estimate for <customer>"; a job should not. When the title
  -- still has that shape — the twin of src/lib/estimates/estimateTitle.ts#isAppDefaultEstimateTitle —
  -- the job is named for the customer. A title someone typed for the work is kept.
  IF e.customer_id IS NOT NULL THEN
    SELECT NULLIF(btrim(c.name), '') INTO v_cust_name FROM public.customers c WHERE c.id = e.customer_id;
  END IF;
  IF v_cust_name IS NOT NULL
     AND (NULLIF(btrim(COALESCE(e.title, '')), '') IS NULL
          OR btrim(e.title) IN ('New estimate', 'Estimate', 'Change order', 'Estimate for customer', 'Change Order for customer')
          OR btrim(e.title) ~* '^(estimate|change order) for\s') THEN
    -- v2.3766: plus the work, when the estimate's one line names it — the twin of
    -- src/lib/estimates/jobNameFromWork.ts#specificWorkFromLines.
    SELECT public.specific_work_name(COALESCE(NULLIF(btrim(l->>'line_item'), ''), NULLIF(btrim(l->>'description'), '')))
      INTO v_work
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(e.line_items_snapshot::jsonb) = 'array' THEN e.line_items_snapshot::jsonb ELSE '[]'::jsonb END
           ) AS l
     WHERE jsonb_array_length(
             CASE WHEN jsonb_typeof(e.line_items_snapshot::jsonb) = 'array' THEN e.line_items_snapshot::jsonb ELSE '[]'::jsonb END
           ) = 1;
    v_name := CASE WHEN v_work IS NOT NULL THEN v_cust_name || ' — ' || v_work ELSE v_cust_name END;
  ELSE
    v_name := COALESCE(NULLIF(btrim(e.title), ''), 'Job from signed agreement');
  END IF;

  -- Guard 2: the hand-typed twin — same customer (either customer column), same case/whitespace-
  -- folded name (the name the job would get), revenue within ±1% or ±$1 of the signed total,
  -- created in the last 90 days.
  v_folded := lower(regexp_replace(btrim(v_name), '\s+', ' ', 'g'));
  IF e.customer_id IS NOT NULL AND v_folded <> '' THEN
    SELECT j.id, j.hcp_number INTO v_twin
      FROM public.jobs_ledger j
     WHERE (j.customer_id = e.customer_id OR j.gc_customer_id = e.customer_id)
       AND j.created_at >= now() - interval '90 days'
       AND lower(regexp_replace(btrim(COALESCE(j.job_name, '')), '\s+', ' ', 'g')) = v_folded
       AND abs(round(COALESCE(j.revenue, 0) * 100) - COALESCE(e.total_cents, 0))
             <= greatest(100, abs(COALESCE(e.total_cents, 0)) * 0.01)
     ORDER BY j.created_at DESC
     LIMIT 1;
    IF v_twin.id IS NOT NULL THEN
      RAISE EXCEPTION 'auto_create_job_guard: job % already matches estimate #% (same customer, name and value, created in the last 90 days) — link it instead of creating another',
        v_twin.hcp_number, e.estimate_number
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Specific Work from the accepted lines — the same mapping as
  -- src/lib/createJobFromEstimateSubmit.ts#fixturesPayloadForCreateJobFromEstimate.
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object(
             'name', s.name,
             'count', s.qty,
             'line_unit_price', s.unit_price,
             'line_description', s.line_description,
             'sequence_order', s.ord - 1
           ) ORDER BY s.ord),
           '[]'::jsonb)
    INTO v_fixtures
    FROM (
      SELECT t.ord,
             COALESCE(NULLIF(btrim(t.li->>'line_item'), ''),
                      NULLIF(btrim(t.li->>'description'), ''),
                      CASE WHEN COALESCE((t.li->>'amount_cents')::numeric, 0) > 0 THEN 'Item' END) AS name,
             COALESCE((t.li->>'quantity')::numeric, 1) AS qty,
             round(COALESCE((t.li->>'unit_price_cents')::numeric, (t.li->>'amount_cents')::numeric, 0) / 100.0, 2) AS unit_price,
             CASE WHEN NULLIF(btrim(t.li->>'line_item'), '') IS NOT NULL THEN NULLIF(btrim(t.li->>'description'), '') END AS line_description
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(e.line_items_snapshot::jsonb) = 'array' THEN e.line_items_snapshot::jsonb ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS t(li, ord)
    ) s
   WHERE s.name IS NOT NULL;

  -- Act as the estimate's owner so create_job_from_estimate's authorization and job-owner
  -- rules apply exactly as if they had pressed Create job themselves (transaction-local).
  PERFORM set_config('request.jwt.claim.sub', e.master_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e.master_user_id, 'role', 'authenticated')::text, true);

  v_job := public.create_job_from_estimate(
    p_estimate_id,
    public.next_job_number_suggestion(),
    v_name,
    e.for_address,
    NULL::numeric,
    e.customer_id,
    v_fixtures
  );

  -- Telemetry: one activity row on the new job. Best-effort; never fails the create.
  BEGIN
    INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
    VALUES (
      v_job,
      'job_auto_created_from_estimate',
      e.master_user_id,
      'Job opened automatically from signed ' || CASE WHEN e.doc_kind = 'bid_proposal' THEN 'bid room proposal' ELSE 'estimate' END
        || ' #' || e.estimate_number::text,
      jsonb_build_object(
        'source_id', e.id::text,
        'estimate_id', e.id::text,
        'estimate_number', e.estimate_number,
        'doc_kind', e.doc_kind,
        'bid_id', e.bid_id,
        'total_cents', e.total_cents
      ),
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_job;
END;
$$;

COMMENT ON FUNCTION public.auto_create_job_from_signed_estimate(uuid) IS
  'Signed estimate → job (Settings → Signed agreements → Create jobs automatically). Named for the customer, plus the work when the one line names it, when the title is still the app default (v2.3748, v2.3766); guards: never a change order, never a twin of a bid job or a same-customer/name/value job from the last 90 days.';

-- 3. The backfill, as a plan first. One row per job whose name is just the customer's name (or
--    still "Estimate for …") that has exactly one Specific Work line naming the work. With
--    p_apply the rows are renamed and each gets one activity row; a renamed job no longer
--    matches, so a second apply is a no-op. Dev or controller only.
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

  IF to_regclass('pg_temp._job_name_plan') IS NOT NULL THEN
    DROP TABLE _job_name_plan;
  END IF;
  CREATE TEMP TABLE _job_name_plan (
    job_id uuid PRIMARY KEY, hcp_number text, old_name text, new_name text, work text
  ) ON COMMIT DROP;

  INSERT INTO _job_name_plan (job_id, hcp_number, old_name, new_name, work)
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

  IF p_apply THEN
    UPDATE public.jobs_ledger j
       SET job_name = p.new_name
      FROM _job_name_plan p
     WHERE j.id = p.job_id;

    INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
    SELECT p.job_id, 'job_renamed_from_work', v_uid,
           'Renamed from "' || p.old_name || '" to "' || p.new_name || '"',
           jsonb_build_object('old_name', p.old_name, 'new_name', p.new_name, 'work', p.work,
                              'source', 'plan_job_names_from_work'),
           false
      FROM _job_name_plan p;
  END IF;

  RETURN QUERY SELECT p.job_id, p.hcp_number, p.old_name, p.new_name, p.work
                 FROM _job_name_plan p ORDER BY p.hcp_number NULLS LAST, p.old_name;
END;
$$;

COMMENT ON FUNCTION public.plan_job_names_from_work(boolean) IS
  'v2.3766: jobs named with only the customer''s name (or still "Estimate for …") that have exactly one specific Specific Work line — the plan (p_apply=false, writes nothing) or the rename (p_apply=true; one job_activity_events row per job, event_type job_renamed_from_work). Dev or controller.';

REVOKE ALL ON FUNCTION public.plan_job_names_from_work(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_job_names_from_work(boolean) TO authenticated, service_role;
