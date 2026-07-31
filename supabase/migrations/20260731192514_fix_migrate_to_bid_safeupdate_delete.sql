SET lock_timeout = '3s';

-- migrate_job_ledger_costs_to_bid_and_delete (20260731180000) fails on prod
-- with "DELETE requires a WHERE clause": pg_safeupdate is loaded for the
-- PostgREST role and rejects the temp-table clear
--     DELETE FROM _migrated_sessions;
-- so EVERY call — dry-run preview and confirm alike — errors before doing
-- anything. (Same trap as the April 2026 dev_reset_estimates fix: safeupdate
-- is not loaded on direct DB connections, which is why validation missed it.)
-- Full re-create with the repo's established always-true-predicate idiom:
--     DELETE FROM _migrated_sessions WHERE true;
-- No other change; diff against 20260731180000 to verify.

-- migrate_job_ledger_costs_to_bid_and_delete: reassign a job's real costs to a
-- BID, then delete the job. Sibling of migrate_job_ledger_costs_and_delete
-- (job -> job), which is deliberately left untouched — it is load-bearing for
-- Combine/Separate as well as the Delete-job modal, and branching one function
-- on target type would put that at risk.
--
-- Three things differ from the job -> job version, and all three are why this is
-- a separate function rather than an overload:
--
--   1. Not everything can follow a bid. Anything with a bid anchor moves
--      (clock_sessions, reports, dispatch_requests, estimator_requests, the
--      salary schedule tables, and the four cost mirrors from 20260731170000).
--      Job-only records — schedule blocks, fixtures, inspections, thread notes,
--      status events, team members, estimates — have no bid equivalent and die
--      with the job. The caller MUST show the user what will be lost first,
--      which is what p_dry_run is for.
--   2. Revenue is dropped, not moved. A bid has no revenue column to add into,
--      so the job's revenue simply goes away. Reported explicitly.
--   3. people_hours is resynced. It is maintained incrementally (approve adds,
--      revoke subtracts), so re-anchoring approved clock sessions from a job to
--      a bid silently desyncs the People -> Hours grid unless
--      recompute_people_hours_after_session_edit runs afterwards. That bug has
--      been shipped once already (migration 20260616045050); not again.
--
-- p_dry_run = true does the entire migration, builds the report, then rolls the
-- whole thing back via a sentinel exception and returns the report — so the
-- modal can preview exact counts without a second, drift-prone code path. Same
-- technique as merge_user_accounts.

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
      'schedule_blocks', (SELECT count(*) FROM public.job_schedule_blocks WHERE job_id = p_from),
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

ALTER FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) OWNER TO postgres;
GRANT ALL ON FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) TO anon;
GRANT ALL ON FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) TO service_role;

COMMENT ON FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(uuid, uuid, boolean, boolean) IS
  'Reassign a job''s costs, labor, reports and dispatch/estimator requests to a bid, then delete the job. Job-only records (schedule blocks, fixtures, inspections, thread notes, status events, team members, estimates) and the job''s revenue are destroyed — call with p_dry_run => true first and show the returned "dropped" counts. Sibling of migrate_job_ledger_costs_and_delete (job -> job), which is unchanged.';
