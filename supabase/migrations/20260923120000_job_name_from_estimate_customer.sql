SET lock_timeout = '3s';

-- v2.3748: a job made from a signed estimate is named for the customer, not "Estimate for …".
--
-- The estimate's title is the heading on the document the customer signs, so its default is
-- "Estimate for <customer>". auto_create_job_from_signed_estimate passed that title through as
-- the job's name, so every job the signature made was called "Estimate for Kimberly Coe"
-- (Taunya, 2026-09-22). The Create job window's seed changed the same way on the client
-- (src/lib/jobFromEstimateDefaults.ts); this is the SQL twin for jobs made without the window.
--
-- Change: when the title is still the app's own default shape (empty, a placeholder, or
-- "Estimate for … / Change Order for …", case-insensitive) and the linked customer has a name,
-- the job is named for the customer. A title someone typed for the work is kept, as before.
-- The hand-typed-twin guard now folds the name the job would get rather than the raw title.
-- Everything else in the function is the 20260905110000 body, unchanged.

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
    v_name := v_cust_name;
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
  'Signed estimate → job (Settings → Signed agreements → Create jobs automatically). Named for the customer when the title is still the app default (v2.3748); guards: never a change order, never a twin of a bid job or a same-customer/name/value job from the last 90 days.';
