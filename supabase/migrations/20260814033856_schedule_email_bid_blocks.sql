SET lock_timeout = '3s';

-- Bid blocks reach the schedule emails, share links, and the job->bid
-- migration (v2.1624) — the three deferrals from v2.1613's bid-anchored
-- schedule blocks:
--   1. list_job_schedule_blocks_for_schedule_email: bid rows included.
--   2. list_schedule_blocks_for_share: same.
--   3. migrate_job_ledger_costs_to_bid_and_delete: schedule blocks now FOLLOW
--      the bid (job_id -> NULL, bid_id -> target) instead of dying with the
--      job; reported under moved.schedule_blocks instead of dropped.
-- All bodies are copies of the LIVE definitions with only these changes;
-- return shapes unchanged, so deployed edge functions and clients need
-- nothing.


-- =====================================================================
-- Schedule email + share-link RPCs learn bid-anchored blocks (v2.1624).
-- Bodies are the LIVE definitions from 20260619160000 with:
--   INNER JOIN jobs_ledger -> LEFT JOIN, + LEFT JOIN bids;
--   display columns fall back to the bid (B<number> / project name / address);
--   a bid-visibility branch (assignee self, or the bids-read roles) ORed in.
-- Return shape unchanged, so the deployed schedule-day-email-dispatch and
-- schedule-share-dispatch edge functions render bid rows with zero changes
-- (they only read the display columns).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.list_job_schedule_blocks_for_schedule_email(p_recipient uuid, p_work_date date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    COALESCE(jl.job_name, b.project_name) AS job_name,
    COALESCE(jl.job_address, b.address) AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date = p_work_date
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient
                   AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'dev')
        OR jl.master_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_recipient
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_recipient))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_recipient AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_recipient
        )
        OR public.assistants_share_master(p_recipient, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_recipient
        )
      ))
    )
  ORDER BY jsb.time_start ASC, jsb.assignee_user_id ASC;
$function$;

CREATE OR REPLACE FUNCTION public.list_schedule_blocks_for_share(p_viewer uuid, p_start date, p_end date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    COALESCE(jl.job_name, b.project_name) AS job_name,
    COALESCE(jl.job_address, b.address) AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date BETWEEN p_start AND p_end
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer
                   AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'dev')
        OR jl.master_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_viewer
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_viewer))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_viewer AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_viewer
        )
        OR public.assistants_share_master(p_viewer, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_viewer
        )
      ))
    )
  ORDER BY assignee_name ASC, jsb.work_date ASC, jsb.time_start ASC;
$function$;

CREATE OR REPLACE FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(
  p_from uuid,
  p_to_bid uuid,
  p_allow_billed boolean DEFAULT false,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $fn$
DECLARE
  r RECORD;
  v_to_amt numeric(18,4);
  v_to_pct numeric(5,2);
  v_sum_pct numeric(5,2);
  v_new jsonb;
  v_blocked_reason text;
  v_revenue numeric;
  v_moved jsonb := '{}'::jsonb;
  v_dropped jsonb := '{}'::jsonb;
  v_n bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF p_from IS NULL OR p_to_bid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Invalid source job or target bid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_from) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bids WHERE id = p_to_bid) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Bid not found');
  END IF;

  -- Source-job authority: identical to migrate_job_ledger_costs_and_delete.
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_from
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to migrate this job');
  END IF;

  -- Billing guard on the source job — same rules and same opt-out as job -> job.
  IF NOT p_allow_billed THEN
    SELECT CASE
      WHEN (jl.status IS DISTINCT FROM 'working' AND jl.status IS DISTINCT FROM 'ready_to_bill') THEN
        'Job billing status must be Working or Ready to bill before migrate-delete.'
      WHEN COALESCE(jl.payments_made, 0) <> 0 THEN 'Clear or resolve recorded payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_from) THEN 'Remove or resolve invoices on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = p_from) THEN 'Remove or resolve payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_from) THEN 'Finish or cancel the in-app collect payment flow for this job before migrate-delete.'
      ELSE NULL
    END INTO v_blocked_reason
    FROM public.jobs_ledger jl
    WHERE jl.id = p_from;

    IF v_blocked_reason IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'billing_blocked', 'error', v_blocked_reason);
    END IF;
  END IF;

  BEGIN
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_from FOR UPDATE;
    PERFORM 1 FROM public.bids WHERE id = p_to_bid FOR UPDATE;

    -- Count what will be destroyed BEFORE anything moves, so the dry-run report
    -- and the real run agree exactly.
    SELECT jsonb_build_object(
      'fixtures',        (SELECT count(*) FROM public.jobs_ledger_fixtures WHERE job_id = p_from),
      'inspections',     (SELECT count(*) FROM public.inspections WHERE job_ledger_id = p_from),
      'thread_notes',    (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = p_from),
      'status_events',   (SELECT count(*) FROM public.job_status_events WHERE job_id = p_from),
      'team_members',    (SELECT count(*) FROM public.jobs_ledger_team_members WHERE job_id = p_from),
      'estimates',       (SELECT count(*) FROM public.estimates WHERE job_ledger_id = p_from),
      'invoices',        (SELECT count(*) FROM public.jobs_ledger_invoices WHERE job_id = p_from),
      'payments',        (SELECT count(*) FROM public.jobs_ledger_payments WHERE job_id = p_from)
    ) INTO v_dropped;

    SELECT COALESCE(revenue, 0) INTO v_revenue FROM public.jobs_ledger WHERE id = p_from;

    -- ---- Mercury card splits: UNIQUE (tx, bid) — merge amounts on collision.
    v_n := 0;
    FOR r IN SELECT id, mercury_transaction_id, amount, note, created_by
             FROM public.mercury_transaction_job_allocations WHERE job_id = p_from
    LOOP
      SELECT m.amount INTO v_to_amt
      FROM public.mercury_transaction_bid_allocations m
      WHERE m.mercury_transaction_id = r.mercury_transaction_id AND m.bid_id = p_to_bid;

      IF v_to_amt IS NULL THEN
        INSERT INTO public.mercury_transaction_bid_allocations
          (mercury_transaction_id, bid_id, amount, note, created_by, migrated_from_job_id)
        VALUES (r.mercury_transaction_id, p_to_bid, r.amount, r.note, r.created_by, p_from);
      ELSE
        UPDATE public.mercury_transaction_bid_allocations
        SET amount = v_to_amt + r.amount
        WHERE mercury_transaction_id = r.mercury_transaction_id AND bid_id = p_to_bid;
      END IF;
      DELETE FROM public.mercury_transaction_job_allocations WHERE id = r.id;
      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('mercury_allocations', v_n);

    -- ---- Supply-house invoice allocations. The 100% ceiling per invoice spans
    -- BOTH the job and bid tables now, so sum across both before accepting.
    v_n := 0;
    FOR r IN SELECT invoice_id, pct
             FROM public.supply_house_invoice_job_allocations WHERE job_id = p_from
    LOOP
      SELECT a.pct INTO v_to_pct
      FROM public.supply_house_invoice_bid_allocations a
      WHERE a.invoice_id = r.invoice_id AND a.bid_id = p_to_bid;

      v_sum_pct := COALESCE(v_to_pct, 0) + r.pct
                 + COALESCE((SELECT sum(j.pct) FROM public.supply_house_invoice_job_allocations j
                             WHERE j.invoice_id = r.invoice_id AND j.job_id <> p_from), 0)
                 + COALESCE((SELECT sum(b.pct) FROM public.supply_house_invoice_bid_allocations b
                             WHERE b.invoice_id = r.invoice_id AND b.bid_id <> p_to_bid), 0);

      IF v_sum_pct > 100 THEN
        RETURN jsonb_build_object(
          'ok', false, 'code', 'supply_alloc_overflow',
          'error', format('Moving supply invoice allocations would exceed 100%% for invoice %s.', r.invoice_id)
        );
      END IF;

      IF v_to_pct IS NULL THEN
        INSERT INTO public.supply_house_invoice_bid_allocations (invoice_id, bid_id, pct, migrated_from_job_id)
        VALUES (r.invoice_id, p_to_bid, r.pct, p_from);
      ELSE
        UPDATE public.supply_house_invoice_bid_allocations
        SET pct = v_to_pct + r.pct
        WHERE invoice_id = r.invoice_id AND bid_id = p_to_bid;
      END IF;
      DELETE FROM public.supply_house_invoice_job_allocations
      WHERE invoice_id = r.invoice_id AND job_id = p_from;
      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('supply_allocations', v_n);

    -- ---- Parts-style rows and billed materials: copy across, then drop.
    WITH moved AS (
      INSERT INTO public.bids_tally_parts
        (bid_id, fixture_name, part_id, quantity, sequence_order, created_by_user_id,
         created_at, purchase_order_id, fixture_cost, migrated_from_job_id)
      SELECT p_to_bid, t.fixture_name, t.part_id, t.quantity, t.sequence_order, t.created_by_user_id,
             t.created_at, t.purchase_order_id, t.fixture_cost, p_from
      FROM public.jobs_tally_parts t WHERE t.job_id = p_from
      RETURNING 1
    ) SELECT count(*) INTO v_n FROM moved;
    DELETE FROM public.jobs_tally_parts WHERE job_id = p_from;
    v_moved := v_moved || jsonb_build_object('tally_parts', v_n);

    WITH moved AS (
      INSERT INTO public.bids_materials
        (bid_id, description, amount, sequence_order, created_at, migrated_from_job_id)
      SELECT p_to_bid, m.description, m.amount, m.sequence_order, m.created_at, p_from
      FROM public.jobs_ledger_materials m WHERE m.job_id = p_from
      RETURNING 1
    ) SELECT count(*) INTO v_n FROM moved;
    DELETE FROM public.jobs_ledger_materials WHERE job_id = p_from;
    v_moved := v_moved || jsonb_build_object('materials', v_n);

    -- ---- Records that carry a bid anchor of their own: re-anchor in place.
    -- clock_sessions and reports both enforce "exactly one anchor", so
    -- job_ledger_id must be cleared in the same statement that sets bid_id.
    -- Keep the moved session ids: people_hours is resynced per session below,
    -- and after the UPDATE they can no longer be found by job_ledger_id.
    CREATE TEMP TABLE IF NOT EXISTS _migrated_sessions (id uuid) ON COMMIT DROP;
    DELETE FROM _migrated_sessions WHERE true;
    INSERT INTO _migrated_sessions (id)
    SELECT id FROM public.clock_sessions WHERE job_ledger_id = p_from;

    UPDATE public.clock_sessions SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('clock_sessions', v_n);

    UPDATE public.reports SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('reports', v_n);

    UPDATE public.dispatch_requests SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('dispatch_requests', v_n);

    UPDATE public.estimator_requests SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('estimator_requests', v_n);

    UPDATE public.salary_work_schedule_templates SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_templates SET segment_b_job_ledger_id = NULL WHERE segment_b_job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides SET segment_b_job_ledger_id = NULL WHERE segment_b_job_ledger_id = p_from;

    -- ---- Crew grid: lift this job's share of each person-day onto the bid,
    -- collapsing duplicates and renormalising both sides to 100, exactly as the
    -- job -> job version does within people_crew_jobs.
    v_n := 0;
    FOR r IN
      SELECT work_date, person_name, person_id, crew_lead_person_name, job_assignments
      FROM public.people_crew_jobs
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(job_assignments) e
                    WHERE (e->>'job_id')::uuid = p_from)
    LOOP
      INSERT INTO public.people_crew_bids (work_date, person_name, person_id, crew_lead_person_name, bid_assignments)
      VALUES (r.work_date, r.person_name, r.person_id, r.crew_lead_person_name, '[]'::jsonb)
      ON CONFLICT (work_date, person_name) DO NOTHING;

      SELECT COALESCE((
        WITH existing AS (
          SELECT (e->>'bid_id')::uuid AS bid, COALESCE((e->>'pct')::numeric, 0) AS pct
          FROM public.people_crew_bids b, jsonb_array_elements(b.bid_assignments) e
          WHERE b.work_date = r.work_date AND b.person_name = r.person_name
        ),
        incoming AS (
          SELECT p_to_bid AS bid, COALESCE(sum((e->>'pct')::numeric), 0) AS pct
          FROM jsonb_array_elements(r.job_assignments) e
          WHERE (e->>'job_id')::uuid = p_from
        ),
        collapsed AS (
          SELECT bid, sum(pct) AS sp FROM (SELECT * FROM existing UNION ALL SELECT * FROM incoming) u GROUP BY bid
        ),
        tot AS (SELECT COALESCE(sum(sp), 0)::numeric AS t FROM collapsed)
        SELECT jsonb_agg(jsonb_build_object('bid_id', c.bid::text,
                 'pct', CASE WHEN tot.t > 0 THEN round((c.sp * (100.0 / tot.t))::numeric, 6) ELSE 0::numeric END)
               ORDER BY c.bid)
        FROM collapsed c CROSS JOIN tot
      ), '[]'::jsonb) INTO v_new;

      UPDATE public.people_crew_bids SET bid_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;

      -- Drop this job from the crew-jobs row and renormalise what remains.
      SELECT COALESCE((
        WITH elems AS (
          SELECT (e->>'job_id')::uuid AS jid, COALESCE((e->>'pct')::numeric, 0) AS pct
          FROM jsonb_array_elements(r.job_assignments) e
          WHERE (e->>'job_id')::uuid <> p_from
        ),
        collapsed AS (SELECT jid, sum(pct) AS sp FROM elems GROUP BY jid),
        tot AS (SELECT COALESCE(sum(sp), 0)::numeric AS t FROM collapsed)
        SELECT jsonb_agg(jsonb_build_object('job_id', c.jid::text,
                 'pct', CASE WHEN tot.t > 0 THEN round((c.sp * (100.0 / tot.t))::numeric, 6) ELSE 0::numeric END)
               ORDER BY c.jid)
        FROM collapsed c CROSS JOIN tot
      ), '[]'::jsonb) INTO v_new;

      UPDATE public.people_crew_jobs SET job_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;

      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('crew_day_rows', v_n);

    -- ---- Schedule blocks follow the bid (v2.1624 — bid anchors exist since
    -- v2.1613). Repointed BEFORE the job row deletes so the FK cascade never
    -- sees them; dispatch keeps the visits under the bid.
    UPDATE public.job_schedule_blocks SET job_id = NULL, bid_id = p_to_bid WHERE job_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_moved := v_moved || jsonb_build_object('schedule_blocks', v_n);

    -- ---- Everything else dies with the job (counted above).
    DELETE FROM public.jobs_ledger_team_members WHERE job_id = p_from;
    DELETE FROM public.common_jobs WHERE job_id = p_from;
    DELETE FROM public.jobs_ledger WHERE id = p_from;

    -- ---- people_hours is incrementally maintained (approve adds, revoke
    -- subtracts), so every re-anchored session must be recomputed or the
    -- People -> Hours grid silently drifts. Takes a SESSION id, one call each.
    FOR r IN SELECT id FROM _migrated_sessions LOOP
      PERFORM public.recompute_people_hours_after_session_edit(r.id);
    END LOOP;

    IF p_dry_run THEN
      RAISE EXCEPTION '__DRY_RUN__' USING ERRCODE = 'raise_exception';
    END IF;

    RETURN jsonb_build_object('ok', true, 'dry_run', false, 'bid_id', p_to_bid,
                              'moved', v_moved, 'dropped', v_dropped, 'revenue_dropped', v_revenue);
  EXCEPTION WHEN OTHERS THEN
    -- plpgsql rolls back the block's DB writes but keeps variable values, so the
    -- dry-run report survives the deliberate abort.
    IF SQLERRM = '__DRY_RUN__' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'bid_id', p_to_bid,
                                'moved', v_moved, 'dropped', v_dropped, 'revenue_dropped', v_revenue);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'migrate_failed', 'error', SQLERRM);
  END;
END;
$fn$;

COMMENT ON FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) IS
  'Reassign a job''s costs, labor, schedule blocks, reports and dispatch/estimator requests to a bid, then delete the job. Schedule blocks follow the bid since v2.1624. Job-only records (fixtures, inspections, thread notes, status events, team members, estimates) and the job''s revenue are destroyed — call with p_dry_run => true first and show the returned "dropped" counts. Sibling of migrate_job_ledger_costs_and_delete (job -> job), which is unchanged.';
