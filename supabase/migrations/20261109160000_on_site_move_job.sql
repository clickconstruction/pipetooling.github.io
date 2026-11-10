SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.6808): everything a job holds on site moved to another job — its places,
-- cages and boxes, the ledger, the boxes' own moves and their photos — with every container keeping its id and so the
-- code printed on its label. A count started on the phone under the wrong job had no way across: no screen, RPC or
-- dev-seat verb changed a row's job, the ledger takes no update under RLS, and the only code that carried these rows
-- sat inside the whole-job combine (20261103054522), which deletes the source job. Rebuilding the boxes by hand on
-- the right job would have changed every printed code, lost the history and written false shortfall rows.
--
--   1. on_site_carry_job(from, to)          — the combine's on-site block lifted out whole, so the rules live once:
--                                              a place of the same name becomes one, the source's Unsorted folds into
--                                              the target's, a live label the target already holds takes a numbered
--                                              label, then places, containers, movements and photos take the target's
--                                              job (a box's own moves name no job and follow their box). It returns
--                                              what it did. Not callable from a client: both callers are definers.
--   2. migrate_job_ledger_costs_and_delete   — 20261104130000's body with that block replaced by one PERFORM, and the
--                                              two declarations only the block used gone. Nothing else changes.
--   3. on_site_row_takes_container_job()     — a new ledger row or box photo takes its container's job. Before this a
--                                              row could name one job and a box on another; after a move the source
--                                              job still stands, so a phone that had it open would have kept writing
--                                              presses under it, where no screen reads them. The row lands on the
--                                              box's job, and the tables' own gate then decides on that job.
--   4. on_site_job_counts(job)               — a job's on-site rows counted, with the parts on hand: the figures a
--                                              move's plan commits to on both jobs. Runs as the caller.
--   5. dev_on_site_move_job(p, p_dry_run)    — the dev seat's door (plan_materials_move → apply_materials_move):
--                                              { from_job, to_job }. SECURITY DEFINER, unlike dev_on_site_write: the
--                                              ledger has no UPDATE policy for anyone, so no caller's own RLS could
--                                              make this write. Gated is_dev(), a training account and a twin refused
--                                              in words. A dry run (the default) does the move, reads both jobs, and
--                                              unwinds; the reply is the plan the apply must still match.
--
-- Additive and idempotent; no table is created, so no fence call. CREATE OR REPLACE TRIGGER takes SHARE ROW EXCLUSIVE
-- on job_material_movements and job_box_photos for a moment, as 20261103143000 did on job_containers.

-- 1. The carry, once. The rules are the combine's (20261103054522), word for word but for three things: the loops
--    read in a fixed order so the report reads the same on every run; a numbered label keeps counting past (8) and
--    shortens its stem to fit the stencil's 24 characters, where the combine stopped and then failed on the index;
--    and Unsorted folds only into the target's own Unsorted row (kind, not the word), so a cage someone stencilled
--    UNSORTED is a cage and the source's pile takes a numbered label beside it.
CREATE OR REPLACE FUNCTION public.on_site_carry_job(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
  v_n int;
  v_suffix text;
  v_label text;
  v_places_merged jsonb := '[]'::jsonb;
  v_labels jsonb := '[]'::jsonb;
  v_unsorted jsonb := NULL;
  v_places int := 0;
  v_containers int := 0;
  v_retired int := 0;
  v_movements int := 0;
  v_moves int := 0;
  v_photos int := 0;
  v_fold_movements int := 0;
  v_fold_moves int := 0;
  v_fold_photos int := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'on_site_carry_job: two different jobs are required';
  END IF;

  -- A box's own moves name no job: they go where their box goes. Counted before a fold re-points any.
  SELECT count(*) INTO v_moves
  FROM public.job_container_moves cm
  JOIN public.job_containers c ON c.id = cm.container_id
  WHERE c.job_id = p_from;
  SELECT count(*) INTO v_retired FROM public.job_containers WHERE job_id = p_from AND retired_at IS NOT NULL;

  -- A place the target already has under the same name takes the source's containers and moves, and the source's
  -- place goes.
  FOR r IN
    SELECT s.id AS src_id, t.id AS tgt_id, t.name AS tgt_name,
           (SELECT count(*) FROM public.job_containers c WHERE c.place_id = s.id) AS boxes
    FROM public.job_places s
    JOIN public.job_places t ON t.job_id = p_to AND lower(trim(t.name)) = lower(trim(s.name))
    WHERE s.job_id = p_from
    ORDER BY lower(trim(s.name)), s.id
  LOOP
    UPDATE public.job_containers SET place_id = r.tgt_id WHERE place_id = r.src_id;
    UPDATE public.job_container_moves SET from_place_id = r.tgt_id WHERE from_place_id = r.src_id;
    UPDATE public.job_container_moves SET to_place_id = r.tgt_id WHERE to_place_id = r.src_id;
    DELETE FROM public.job_places WHERE id = r.src_id;
    v_places_merged := v_places_merged || jsonb_build_object('name', r.tgt_name, 'containers', r.boxes);
  END LOOP;
  UPDATE public.job_places SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_places = ROW_COUNT;

  -- A container with the same live label: the job's Unsorted row is the catch-all, so the source's folds into the
  -- target's (its movements, moves and photos re-pointed); a cage or a box keeps its own row, since its code is
  -- printed on its label, and takes a numbered label instead.
  FOR r IN
    SELECT s.id AS src_id, s.kind, s.label, s.code, t.id AS tgt_id, t.kind AS tgt_kind, t.code AS tgt_code
    FROM public.job_containers s
    JOIN public.job_containers t
      ON t.job_id = p_to AND t.retired_at IS NULL AND lower(trim(t.label)) = lower(trim(s.label))
    WHERE s.job_id = p_from AND s.retired_at IS NULL
    ORDER BY lower(trim(s.label)), s.id
  LOOP
    IF r.kind = 'unsorted' AND r.tgt_kind = 'unsorted' THEN
      SELECT count(*) INTO v_fold_movements FROM public.job_material_movements
        WHERE from_container_id = r.src_id OR to_container_id = r.src_id;
      UPDATE public.job_material_movements SET from_container_id = r.tgt_id WHERE from_container_id = r.src_id;
      UPDATE public.job_material_movements SET to_container_id = r.tgt_id WHERE to_container_id = r.src_id;
      UPDATE public.job_container_moves SET container_id = r.tgt_id WHERE container_id = r.src_id;
      GET DIAGNOSTICS v_fold_moves = ROW_COUNT;
      UPDATE public.job_box_photos SET container_id = r.tgt_id WHERE container_id = r.src_id;
      GET DIAGNOSTICS v_fold_photos = ROW_COUNT;
      DELETE FROM public.job_containers WHERE id = r.src_id;
      v_unsorted := jsonb_build_object('code', r.code, 'into_code', r.tgt_code,
        'movements', v_fold_movements, 'container_moves', v_fold_moves, 'photos', v_fold_photos);
    ELSE
      v_n := 2;
      LOOP
        v_suffix := ' (' || v_n || ')';
        v_label := left(trim(r.label), 24 - length(v_suffix)) || v_suffix;
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.job_containers c
          WHERE c.job_id IN (p_from, p_to) AND c.retired_at IS NULL AND lower(trim(c.label)) = lower(trim(v_label))
        );
        v_n := v_n + 1;
        IF v_n > 99 THEN
          RAISE EXCEPTION 'on_site_carry_job: no free numbered label left for %', r.label;
        END IF;
      END LOOP;
      UPDATE public.job_containers SET label = v_label WHERE id = r.src_id;
      v_labels := v_labels || jsonb_build_object('code', r.code, 'kind', r.kind, 'from', r.label, 'to', v_label);
    END IF;
  END LOOP;
  UPDATE public.job_containers SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_containers = ROW_COUNT;
  UPDATE public.job_material_movements SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_movements = ROW_COUNT;
  UPDATE public.job_box_photos SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_photos = ROW_COUNT;

  RETURN jsonb_build_object(
    'places', v_places,
    'places_merged', v_places_merged,
    'containers', v_containers,
    'retired_containers', v_retired,
    'unsorted_folded', v_unsorted,
    'labels_renamed', v_labels,
    'movements', v_movements,
    'container_moves', v_moves,
    'photos', v_photos
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM authenticated;

COMMENT ON FUNCTION public.on_site_carry_job(uuid, uuid) IS 'Materials on site (#209, v2.6808): one job''s places, containers, ledger, box moves and box photos carried to another job, the rule both the whole-job combine and the dev seat''s move use — a same-name place becomes one, the source''s Unsorted folds into the target''s, a live label the target already holds takes a numbered label, every container keeps its id and code. Returns what it did. No gate of its own and no client grant: its callers are definers that gate first.';

-- 2. The combine, with the block above in place of its own copy.
CREATE OR REPLACE FUNCTION public.migrate_job_ledger_costs_and_delete(p_from uuid, p_to uuid, p_allow_billed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_to_amt numeric(18, 4);
  v_to_pct numeric(5, 2);
  v_sum_pct numeric(5, 2);
  v_new jsonb;
  v_blocked_reason text;
  v_from_master uuid;
  v_to_master uuid;
  v_src_name text;
  v_src_number text;
  v_src_status text;
  v_src_pct numeric;
  v_tgt_status text;
  v_tgt_pct numeric;
  v_src_label text;
  v_note_body text;
  v_estimate_unlinked boolean := false;
  v_collide text;
  v_actor_name text;
  v_src_part uuid;
  v_tgt_part uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Invalid source or target job');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_from)
     OR NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  -- Same visibility as "Devs, masters, assistants can delete jobs ledger" (20260228140000_assistants_delete_jobs_ledger.sql)
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_from
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_to
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to migrate these jobs');
  END IF;

  SELECT jl.master_user_id INTO v_from_master FROM public.jobs_ledger jl WHERE jl.id = p_from;
  SELECT jl.master_user_id INTO v_to_master FROM public.jobs_ledger jl WHERE jl.id = p_to;

  -- Snapshot both sides' identity and progress before anything moves: the note
  -- and the return payload are the only record of the source's status/pct once
  -- the row is deleted.
  SELECT jl.job_name,
         COALESCE(NULLIF(trim(jl.hcp_number), ''), NULLIF(trim(jl.click_number), ''), '—'),
         jl.status, jl.pct_complete
    INTO v_src_name, v_src_number, v_src_status, v_src_pct
    FROM public.jobs_ledger jl WHERE jl.id = p_from;
  SELECT jl.status, jl.pct_complete INTO v_tgt_status, v_tgt_pct
    FROM public.jobs_ledger jl WHERE jl.id = p_to;

  -- Billing guard on source: do not bypass invoices, payments, collect-payment flows, or advanced job billing status.
  -- Skipped when p_allow_billed = true (reassign-and-delete from the Delete-job modal): the source job's own
  -- invoices/payments are intentionally allowed to cascade-delete with it; only costs/labor/revenue move.
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
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'billing_blocked',
        'error', v_blocked_reason
      );
    END IF;
  END IF;

  -- One live work order per sub on a job (step_commitments_job_person_live_uniq). A sub both jobs hold a live
  -- order for has no merge rule a combine should pick, so the combine holds and says so, as it does for a supply
  -- allocation past 100%. Cancel one order, then combine.
  SELECT string_agg(DISTINCT s.display_name, ', ' ORDER BY s.display_name) INTO v_collide
  FROM public.step_commitments s
  JOIN public.step_commitments t
    ON t.job_id = p_to AND t.person_id = s.person_id
   AND t.step_id IS NULL AND t.labor_job_id IS NULL AND t.status <> 'cancelled'
  WHERE s.job_id = p_from AND s.step_id IS NULL AND s.labor_job_id IS NULL AND s.status <> 'cancelled';
  IF v_collide IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'work_order_collision',
      'error', format('Both jobs hold a live work order for %s. Cancel one of them, then combine.', v_collide)
    );
  END IF;

  -- One open agreement per job (job_contracts_one_live_per_job_idx: a draft or a sent one). A sent agreement's link
  -- is in the customer's hands and must not die by a rule, so two open agreements hold the combine (v2.6458).
  IF EXISTS (SELECT 1 FROM public.job_contracts c WHERE c.job_id = p_from AND c.status IN ('draft', 'sent'))
     AND EXISTS (SELECT 1 FROM public.job_contracts c WHERE c.job_id = p_to AND c.status IN ('draft', 'sent')) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'agreement_collision',
      'error', 'Both jobs hold an open agreement. Void one of them, then combine.'
    );
  END IF;

  -- Pay applications are numbered per job (job_pay_applications_job_number_live_uniq), and the numbers are on paper
  -- the GC holds, so no rule should renumber either run: two jobs with live applications hold the combine (v2.6458).
  IF EXISTS (SELECT 1 FROM public.job_pay_applications a WHERE a.job_id = p_from AND a.deleted_at IS NULL)
     AND EXISTS (SELECT 1 FROM public.job_pay_applications a WHERE a.job_id = p_to AND a.deleted_at IS NULL) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'pay_application_collision',
      'error', 'Both jobs hold pay applications. Delete one job''s applications, then combine.'
    );
  END IF;

  SELECT coalesce(u.name, '') INTO v_actor_name FROM public.users u WHERE u.id = auth.uid();

  BEGIN
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_from FOR UPDATE;
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_to FOR UPDATE;

    -- Mercury splits: UNIQUE (mercury_transaction_id, job_id) — merge amounts into target when both exist.
    FOR r IN
      SELECT id, mercury_transaction_id, amount
      FROM public.mercury_transaction_job_allocations
      WHERE job_id = p_from
    LOOP
      SELECT m.amount INTO v_to_amt
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = r.mercury_transaction_id AND m.job_id = p_to;

      IF v_to_amt IS NULL THEN
        UPDATE public.mercury_transaction_job_allocations
        SET job_id = p_to
        WHERE id = r.id;
      ELSE
        UPDATE public.mercury_transaction_job_allocations
        SET amount = v_to_amt + r.amount
        WHERE mercury_transaction_id = r.mercury_transaction_id AND job_id = p_to;
        DELETE FROM public.mercury_transaction_job_allocations WHERE id = r.id;
      END IF;
    END LOOP;

    -- Supply invoice allocations: PRIMARY KEY (invoice_id, job_id) — merge pct; cap at 100 per invoice line.
    FOR r IN
      SELECT invoice_id, pct
      FROM public.supply_house_invoice_job_allocations
      WHERE job_id = p_from
    LOOP
      SELECT a.pct INTO v_to_pct
      FROM public.supply_house_invoice_job_allocations a
      WHERE a.invoice_id = r.invoice_id AND a.job_id = p_to;

      IF v_to_pct IS NULL THEN
        UPDATE public.supply_house_invoice_job_allocations
        SET job_id = p_to
        WHERE invoice_id = r.invoice_id AND job_id = p_from;
      ELSE
        v_sum_pct := v_to_pct + r.pct;
        IF v_sum_pct > 100 THEN
          RETURN jsonb_build_object(
            'ok', false,
            'code', 'supply_alloc_overflow',
            'error',
            format('Merging supply invoice allocations would exceed 100%% for invoice %s.', r.invoice_id)
          );
        END IF;
        UPDATE public.supply_house_invoice_job_allocations
        SET pct = v_sum_pct
        WHERE invoice_id = r.invoice_id AND job_id = p_to;
        DELETE FROM public.supply_house_invoice_job_allocations
        WHERE invoice_id = r.invoice_id AND job_id = p_from;
      END IF;
    END LOOP;

    -- Crew grid: replace source job id with target; collapse duplicate job ids; renormalize percentages to 100.
    FOR r IN
      SELECT work_date, person_name, job_assignments
      FROM public.people_crew_jobs
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(job_assignments) AS e
        WHERE (e->>'job_id')::uuid = p_from
      )
    LOOP
      SELECT COALESCE(
        (
          WITH elems AS (
            SELECT
              CASE
                WHEN (e->>'job_id')::uuid = p_from THEN p_to
                ELSE (e->>'job_id')::uuid
              END AS jid,
              COALESCE((e->>'pct')::numeric, 0) AS pct
            FROM jsonb_array_elements(r.job_assignments) AS e
          ),
          collapsed AS (
            SELECT jid, SUM(pct) AS sp FROM elems GROUP BY jid
          ),
          tot AS (
            SELECT COALESCE(SUM(sp), 0)::numeric AS t FROM collapsed
          ),
          scaled AS (
            SELECT
              c.jid,
              CASE
                WHEN tot.t > 0 THEN ROUND((c.sp * (100.0 / tot.t))::numeric, 6)
                ELSE 0::numeric
              END AS pct
            FROM collapsed c
            CROSS JOIN tot
          )
          SELECT jsonb_agg(
            jsonb_build_object('job_id', scaled.jid::text, 'pct', scaled.pct)
            ORDER BY scaled.jid
          )
          FROM scaled
        ),
        '[]'::jsonb
      )
      INTO v_new;

      UPDATE public.people_crew_jobs
      SET job_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;
    END LOOP;

    UPDATE public.jobs_tally_parts SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.jobs_ledger_materials SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.clock_sessions SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.job_schedule_blocks SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.jobs_ledger_fixtures SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.reports SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    -- A report's photos go where the report goes. Left behind, the source's delete took them, and a question one of them
    -- answered read unanswered again (report_photos_mirror_checklist_answers_delete).
    UPDATE public.report_photos SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.inspections SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.jobs_ledger_thread_notes SET job_id = p_to WHERE job_id = p_from;
    -- Migrated status events keep telling the SOURCE job's story — tag them so
    -- history consumers can tell them apart from the target's native events.
    UPDATE public.job_status_events SET job_id = p_to, source_job_id = p_from WHERE job_id = p_from;
    -- The estimate that made the source job follows it to the target — unless the
    -- target was made from an estimate of its own. estimates_job_ledger_id_unique
    -- allows one estimate per job, so that move used to fail the whole call
    -- ("duplicate key value violates unique constraint") and both jobs stayed.
    -- The source's estimate then keeps its own record and drops its job link,
    -- exactly as a plain delete leaves it (the FK is ON DELETE SET NULL).
    IF EXISTS (SELECT 1 FROM public.estimates e WHERE e.job_ledger_id = p_from)
       AND EXISTS (SELECT 1 FROM public.estimates e WHERE e.job_ledger_id = p_to) THEN
      UPDATE public.estimates SET job_ledger_id = NULL WHERE job_ledger_id = p_from;
      v_estimate_unlinked := true;
    ELSE
      UPDATE public.estimates SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    END IF;
    UPDATE public.estimator_requests SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.dispatch_requests SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.stripe_oob_payment_reverts SET job_id = p_to WHERE job_id = p_from;

    UPDATE public.salary_work_schedule_templates
    SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_templates
    SET segment_b_job_ledger_id = p_to WHERE segment_b_job_ledger_id = p_from;

    UPDATE public.salary_work_schedule_day_overrides
    SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides
    SET segment_b_job_ledger_id = p_to WHERE segment_b_job_ledger_id = p_from;

    INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
    SELECT p_to, jtm.user_id
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = p_from
    ON CONFLICT (job_id, user_id) DO NOTHING;

    DELETE FROM public.jobs_ledger_team_members WHERE job_id = p_from;

    -- Every other row that names the source and went with its delete (punch list #252, v2.6423). Each table is a
    -- plain move, or the merge its own unique key asks for. The money and legal rows follow after the one-per-job
    -- rows (v2.6458). What is let go on purpose: the thread-note stats cache (the notes' move above recomputes the
    -- target's row), the drive-time cache between two jobs, and the paid-job mail queue, each a cache or a log about
    -- a card that is going.

    -- The job's history and its records: a plain move. An activity event keeps the job it told of in its detail,
    -- as a moved status event keeps source_job_id.
    UPDATE public.job_activity_events
      SET job_id = p_to, detail = detail || jsonb_build_object('combined_from_job_id', p_from::text)
      WHERE job_id = p_from;
    UPDATE public.job_pct_events SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_followup_reviews SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_test_reports SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_share_links SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_photo_notes SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_hazmat_incidents SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.hours_statements SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.material_po_generator_entries SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.nudge_sent SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.drive_links SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.email_tag_threads SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.supply_house_job_accounts SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.supply_house_invoice_move_requests SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.step_commitments SET job_id = p_to WHERE job_id = p_from;
    -- The job that made an as-built set (plan_sets.job_id is ON DELETE SET NULL, so a delete forgot it).
    UPDATE public.plan_sets SET job_id = p_to WHERE job_id = p_from;

    -- Materials on site: places, cages and boxes, the ledger, the boxes' moves and photos, by the one rule the dev
    -- seat's move uses too (on_site_carry_job, 20261109160000): a same-name place becomes one, the source's Unsorted
    -- folds into the target's, a live label the target already holds takes a numbered label.
    PERFORM public.on_site_carry_job(p_from, p_to);

    -- Messages. A contact's link the target already has stands once, and keeps the star if the source's had it.
    -- An open skip, an open call or an open hold the target already has for the same contact and step stands once,
    -- a hold until the later of the two days. Sends, done calls and undone skips are history and move.
    FOR r IN
      SELECT s.id AS src_id, s.is_default, t.id AS tgt_id
      FROM public.contact_jobs s
      JOIN public.contact_jobs t ON t.contact_id = s.contact_id AND t.jobs_ledger_id = p_to
      WHERE s.jobs_ledger_id = p_from
    LOOP
      DELETE FROM public.contact_jobs WHERE id = r.src_id;
      IF r.is_default THEN
        UPDATE public.contact_jobs SET is_default = true WHERE id = r.tgt_id;
      END IF;
    END LOOP;
    UPDATE public.contact_jobs SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    DELETE FROM public.contact_step_skips s
      WHERE s.jobs_ledger_id = p_from AND s.undone_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.contact_step_skips t
          WHERE t.jobs_ledger_id = p_to AND t.undone_at IS NULL AND t.contact_id = s.contact_id AND t.step_key = s.step_key
        );
    UPDATE public.contact_step_skips SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.nudge_holds t
      SET until_on = GREATEST(t.until_on, s.until_on)
      FROM public.nudge_holds s
      WHERE t.jobs_ledger_id = p_to AND t.released_at IS NULL
        AND s.jobs_ledger_id = p_from AND s.released_at IS NULL
        AND s.contact_id = t.contact_id AND s.step_key = t.step_key;
    DELETE FROM public.nudge_holds s
      WHERE s.jobs_ledger_id = p_from AND s.released_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.nudge_holds t
          WHERE t.jobs_ledger_id = p_to AND t.released_at IS NULL AND t.contact_id = s.contact_id AND t.step_key = s.step_key
        );
    UPDATE public.nudge_holds SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    DELETE FROM public.call_tasks s
      WHERE s.jobs_ledger_id = p_from AND s.done_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.call_tasks t
          WHERE t.jobs_ledger_id = p_to AND t.done_at IS NULL AND t.contact_id = s.contact_id
            AND coalesce(t.step_key, '') = coalesce(s.step_key, '')
        );
    UPDATE public.call_tasks SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    -- The tick to save every photo to Drive: the target's stands, else the source's comes over.
    UPDATE public.photo_saves SET jobs_ledger_id = p_to
      WHERE jobs_ledger_id = p_from AND NOT EXISTS (SELECT 1 FROM public.photo_saves WHERE jobs_ledger_id = p_to);

    -- Who hears about the job: a watcher the target lacks is added with their picks, as the team is.
    INSERT INTO public.job_watchers (job_id, user_id, hear_progress, hear_done, hear_dates, source, created_by)
    SELECT p_to, w.user_id, w.hear_progress, w.hear_done, w.hear_dates, w.source, w.created_by
    FROM public.job_watchers w
    WHERE w.job_id = p_from
    ON CONFLICT (job_id, user_id) DO NOTHING;
    DELETE FROM public.job_watchers WHERE job_id = p_from;

    -- Supply houses. One account per job and house: an open account on the source opens the target's row when the
    -- target's is not open; otherwise the target's stands. One word per job and house: the later word stands.
    UPDATE public.job_supply_house_accounts t
      SET status = s.status, account_ref = s.account_ref, opened_via = s.opened_via,
          opened_by = s.opened_by, opened_at = s.opened_at,
          rep_contact_id = coalesce(t.rep_contact_id, s.rep_contact_id)
      FROM public.job_supply_house_accounts s
      WHERE t.job_id = p_to AND s.job_id = p_from AND s.supply_house_id = t.supply_house_id
        AND s.status = 'open' AND t.status <> 'open';
    DELETE FROM public.job_supply_house_accounts s
      WHERE s.job_id = p_from
        AND EXISTS (SELECT 1 FROM public.job_supply_house_accounts t WHERE t.job_id = p_to AND t.supply_house_id = s.supply_house_id);
    UPDATE public.job_supply_house_accounts SET job_id = p_to WHERE job_id = p_from;
    DELETE FROM public.job_supply_house_words t
      WHERE t.job_id = p_to
        AND EXISTS (
          SELECT 1 FROM public.job_supply_house_words s
          WHERE s.job_id = p_from AND s.supply_house_id = t.supply_house_id AND s.noted_at > t.noted_at
        );
    DELETE FROM public.job_supply_house_words s
      WHERE s.job_id = p_from
        AND EXISTS (SELECT 1 FROM public.job_supply_house_words t WHERE t.job_id = p_to AND t.supply_house_id = s.supply_house_id);
    UPDATE public.job_supply_house_words SET job_id = p_to WHERE job_id = p_from;

    -- The Team board's Looks right marks: one per person, day and kind; the target's stands.
    DELETE FROM public.team_board_acks s
      WHERE s.job_ledger_id = p_from
        AND EXISTS (
          SELECT 1 FROM public.team_board_acks t
          WHERE t.job_ledger_id = p_to AND t.kind = s.kind AND t.work_date = s.work_date AND t.person_user_id = s.person_user_id
        );
    UPDATE public.team_board_acks SET job_ledger_id = p_to, target_key = 'job:' || p_to::text WHERE job_ledger_id = p_from;

    -- The hours target: one open per job. The target's number stands; the source's open row comes over closed,
    -- stamped by the person combining, so its history is kept.
    IF EXISTS (SELECT 1 FROM public.job_expected_hours WHERE job_id = p_to AND cleared_at IS NULL) THEN
      UPDATE public.job_expected_hours
        SET cleared_at = now(), cleared_by = auth.uid(), cleared_by_name = v_actor_name
        WHERE job_id = p_from AND cleared_at IS NULL;
    END IF;
    UPDATE public.job_expected_hours SET job_id = p_to WHERE job_id = p_from;

    -- Plans. A job has one plan part. The target with none takes the source's part and names it; the target with
    -- its own keeps it, and the source's sets join it as older sets, the target's current set standing.
    SELECT id INTO v_src_part FROM public.plan_parts WHERE job_id = p_from;
    IF v_src_part IS NOT NULL THEN
      SELECT id INTO v_tgt_part FROM public.plan_parts WHERE job_id = p_to;
      IF v_tgt_part IS NULL THEN
        UPDATE public.plan_parts SET job_id = p_to WHERE id = v_src_part;
        UPDATE public.jobs_ledger SET plan_part_id = v_src_part WHERE id = p_to AND plan_part_id IS NULL;
      ELSE
        UPDATE public.plan_sets SET part_id = v_tgt_part WHERE part_id = v_src_part;
        DELETE FROM public.plan_parts WHERE id = v_src_part;
      END IF;
    END IF;

    -- One row per job, kept as the target's when it has one: the labor baseline, the budget, the property owner.
    UPDATE public.job_baselines SET job_id = p_to
      WHERE job_id = p_from AND NOT EXISTS (SELECT 1 FROM public.job_baselines WHERE job_id = p_to);
    UPDATE public.job_budgets SET job_id = p_to
      WHERE job_id = p_from AND NOT EXISTS (SELECT 1 FROM public.job_budgets WHERE job_id = p_to);
    UPDATE public.job_property_owners SET job_id = p_to
      WHERE job_id = p_from AND NOT EXISTS (SELECT 1 FROM public.job_property_owners WHERE job_id = p_to);

    -- The money and legal rows (the owner's word, 2026-11-03; punch list #252 PR 2, v2.6458). Bills and payments
    -- stay under the billing guard above: a source with either is refused unless p_allow_billed, where they go with
    -- the source by design. Everything else that tells the money's or the paper's story moves, or merges as its own
    -- key asks.

    -- The trace of a payment moved off or onto the source keeps naming a job that exists.
    UPDATE public.jobs_ledger_payment_events SET from_job_id = p_to WHERE from_job_id = p_from;
    UPDATE public.jobs_ledger_payment_events SET to_job_id = p_to WHERE to_job_id = p_from;
    -- Promises, paid claims and the chase call log: the record of what the payer said and when we asked.
    UPDATE public.job_payment_promises SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_payment_chase_touches SET job_id = p_to WHERE job_id = p_from;
    -- The promised pay date: one per job, and the one marked later stands. The move keeps the date, so the log
    -- trigger (job_promised_pay_dates_log_promise) writes no second promise.
    DELETE FROM public.job_promised_pay_dates t
      WHERE t.job_id = p_to
        AND EXISTS (SELECT 1 FROM public.job_promised_pay_dates s WHERE s.job_id = p_from AND s.marked_at > t.marked_at);
    DELETE FROM public.job_promised_pay_dates s
      WHERE s.job_id = p_from AND EXISTS (SELECT 1 FROM public.job_promised_pay_dates t WHERE t.job_id = p_to);
    UPDATE public.job_promised_pay_dates SET job_id = p_to WHERE job_id = p_from;

    -- Lien paper: notices, affidavits, waivers and demand letters are the record of what went out. A waiver made
    -- on a bid names no job and is not here. A move changes no state, so the activity triggers write nothing.
    UPDATE public.job_lien_filings SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_lien_releases SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_demand_letters SET job_id = p_to WHERE job_id = p_from;
    -- The Lien desk's items: one live per job and kind (job_lien_desk_items_live_uniq: not voided, not sent or
    -- missed). A live item of a kind the target already holds live is set aside: it comes over voided and the
    -- target's stands. Every desk reader skips a voided item, so the target's job activity names the draft, its
    -- kind and its months (v2.6460); the row stays for a dev to restore. Nothing the desk tracks is lost: it works
    -- a job's due months out from the job's bills and work, and the notices on file and the missed months move as
    -- history. Sent, missed and voided items move as they are.
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT p_to, 'job_combined', now(), auth.uid(),
           CASE s.kind
             WHEN 'affidavit' THEN 'Lien affidavit'
             WHEN 'retainage_53_057' THEN 'Retainage notice'
             ELSE 'Lien notice'
           END || ' draft set aside in the combine — from Job #' || v_src_number
           || coalesce(' · ' || (
                SELECT string_agg(to_char(to_date(m.ym || '-01', 'YYYY-MM-DD'), 'Mon YYYY'), ', ' ORDER BY m.ym)
                FROM unnest(s.months) AS m(ym)
                WHERE m.ym ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
              ), ''),
           jsonb_build_object(
             'source_id', s.id::text || ':set_aside',
             'desk_item_id', s.id::text,
             'kind', s.kind,
             'months', to_jsonb(s.months),
             'combined_from_job_id', p_from::text
           ),
           true
    FROM public.job_lien_desk_items s
    WHERE s.job_id = p_from AND s.voided_at IS NULL AND s.status NOT IN ('sent', 'missed')
      AND EXISTS (
        SELECT 1 FROM public.job_lien_desk_items t
        WHERE t.job_id = p_to AND t.kind = s.kind AND t.voided_at IS NULL AND t.status NOT IN ('sent', 'missed')
      );
    UPDATE public.job_lien_desk_items s
      SET voided_at = now()
      WHERE s.job_id = p_from AND s.voided_at IS NULL AND s.status NOT IN ('sent', 'missed')
        AND EXISTS (
          SELECT 1 FROM public.job_lien_desk_items t
          WHERE t.job_id = p_to AND t.kind = s.kind AND t.voided_at IS NULL AND t.status NOT IN ('sent', 'missed')
        );
    UPDATE public.job_lien_desk_items SET job_id = p_to WHERE job_id = p_from;
    -- The claim correction: one per job; the target's stands, else the source's moves.
    UPDATE public.job_lien_claim_corrections SET job_id = p_to
      WHERE job_id = p_from AND NOT EXISTS (SELECT 1 FROM public.job_lien_claim_corrections WHERE job_id = p_to);
    -- A legal matter that named the source names the combined job once.
    INSERT INTO public.legal_matter_jobs (matter_id, job_id)
    SELECT m.matter_id, p_to FROM public.legal_matter_jobs m WHERE m.job_id = p_from
    ON CONFLICT (matter_id, job_id) DO NOTHING;
    DELETE FROM public.legal_matter_jobs WHERE job_id = p_from;
    -- Agreements and pay applications: the collisions were refused above, so these are plain moves. The
    -- pay-application stamp leaves a move's updated_by and updated_at alone (restated above).
    UPDATE public.job_contracts SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_pay_applications SET job_id = p_to WHERE job_id = p_from;

    -- The job links the source's delete would have set to null, and the plain-uuid job pointers no key reaches
    -- (punch list #252 PR 3, v2.6492). Each row stood after a combine with a job on it that no longer existed: a text
    -- or an email fell to the person, a sub sheet read unlinked, a mail piece lost its job. A plain move each; none
    -- has a key that asks for a merge.

    -- Messages: every text, call, email, team note and event tied to the source is tied to the target. A line's job is
    -- its own column (messages_one_job: at most one of a bid, a project, a Pipeline job), and the contact links merged
    -- above. A prepared text (Today's sends) goes the same way, open or sent.
    UPDATE public.messages SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.nudge_offers SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    -- Certified mail: the envelopes sent for the job and their USPS trail. mail_pieces_touch stamps updated_at only.
    UPDATE public.mail_pieces SET job_id = p_to WHERE job_id = p_from;
    -- Sub labor sheets: the sheet is on the target, and its number text, the display text every rollup still matches
    -- by, reads the target's number; the source's own stays on the target as a prior number. A write that sets both
    -- at once is one people_labor_jobs_link_job_ledger leaves alone; a target with no number keeps the text.
    UPDATE public.people_labor_jobs s
      SET job_ledger_id = p_to,
          job_number = coalesce(left(coalesce(NULLIF(btrim(jl.hcp_number), ''), NULLIF(btrim(jl.click_number), '')), 10), s.job_number)
      FROM public.jobs_ledger jl
      WHERE s.job_ledger_id = p_from AND jl.id = p_to;
    -- A development's History line kept about the job; the file index rows whose home was the job (the sweep keeps
    -- them current from here); a bid's submittal package made for the job.
    UPDATE public.development_history_entries SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.file_index SET jobs_ledger_id = p_to WHERE jobs_ledger_id = p_from;
    UPDATE public.bid_submittals SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    -- Records for an owner: the job the window was opened on, and the source among the jobs the packet covered, once
    -- and in its place. The row's stamp then reads the person combining.
    UPDATE public.lien_owner_record_requests SET seed_job_id = p_to WHERE seed_job_id = p_from;
    UPDATE public.lien_owner_record_requests q
      SET job_ids = (
        SELECT coalesce(array_agg(d.j ORDER BY d.ord), '{}'::uuid[])
        FROM (
          SELECT CASE WHEN u.x = p_from THEN p_to ELSE u.x END AS j, min(u.ord) AS ord
          FROM unnest(q.job_ids) WITH ORDINALITY AS u(x, ord)
          GROUP BY 1
        ) d)
      WHERE p_from = ANY (q.job_ids);
    -- A partner's profit-share posting names the job the share came from; a partnership's farm job.
    UPDATE public.person_offsets SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.partnerships SET farm_job_ledger_id = p_to WHERE farm_job_ledger_id = p_from;
    -- Why a bank deposit's Income label was set. Its payment is the billing guard's; under p_allow_billed the payment
    -- goes with the source and the label keeps naming the job that stands.
    UPDATE public.mercury_transaction_ar_income_labels SET job_id = p_to WHERE job_id = p_from;
    -- A try-out verdict's day job.
    UPDATE public.team_prospect_trial_verdicts SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    -- GC mode's three Pipeline-job pointers: a project's billing job, the job a trade our own crew runs on, the
    -- general conditions job. The first two are guarded against a person's plain write, so the combine's own goes
    -- under each guard's flag for its one statement, as gc_link_crew_job's does.
    PERFORM set_config('gc.combine_write', 'on', true);
    UPDATE public.gc_projects SET billing_job_id = p_to WHERE billing_job_id = p_from;
    PERFORM set_config('gc.combine_write', '', true);
    PERFORM set_config('gc.crew_job_write', 'on', true);
    UPDATE public.gc_trade_packages SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    PERFORM set_config('gc.crew_job_write', '', true);
    UPDATE public.gc_project_money SET general_conditions_job_id = p_to WHERE general_conditions_job_id = p_from;
    -- The pointers with no key at all: the AR cases on the job's payments (a dispute, a returned check), a rating ask
    -- about the job, the watcher emails that went out (the hour's fold then reads the source's too, which is right:
    -- the watcher heard), the schedule's change log. History a reader joins by job.
    UPDATE public.ar_stripe_cases SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.ar_unbanked_check_cases SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.customer_ratings SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_watcher_notices SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.schedule_block_events SET job_id = p_to WHERE job_id = p_from;
    -- The Charges window's rows (punch list #254, made after the card's catalog read and on the cascade): the office's
    -- adjustments and the statements of charges, each numbered SC-<job number>-<n>, a paper like an hours statement.
    UPDATE public.job_charge_adjustments SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_charge_statements SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    -- Let go on purpose: job_status_events.source_job_id and the bid tables' migrated_from_job_id name the job a move
    -- came from, by design, and the move to a bid deletes its job, so a combine never meets a live one.

    -- The source's numbers stay on the target as prior numbers (2026-10-31, the owner: the House Call Pro
    -- numbers from the old system must not be lost in a combine): its HCP #, its C#, and the prior numbers
    -- it carried itself, each once, after the target's own.
    UPDATE public.jobs_ledger AS jl_to
    SET prior_numbers = (
      SELECT COALESCE(array_agg(n ORDER BY ord), '{}')
      FROM (
        SELECT n, min(ord) AS ord
        FROM unnest(
          jl_to.prior_numbers
          || CASE WHEN NULLIF(trim(jl_from.hcp_number), '') IS NOT NULL THEN ARRAY['HCP ' || trim(jl_from.hcp_number)] ELSE '{}'::text[] END
          || CASE WHEN NULLIF(trim(jl_from.click_number), '') IS NOT NULL THEN ARRAY['C# ' || trim(jl_from.click_number)] ELSE '{}'::text[] END
          || jl_from.prior_numbers
        ) WITH ORDINALITY AS u(n, ord)
        WHERE n IS NOT NULL AND n <> ''
        GROUP BY n
      ) d
    )
    FROM public.jobs_ledger AS jl_from
    WHERE jl_to.id = p_to AND jl_from.id = p_from;

    -- Add source job revenue to target job total before removing source row.
    UPDATE public.jobs_ledger AS jl_to
    SET revenue = COALESCE(jl_to.revenue, 0) + COALESCE(jl_from.revenue, 0)
    FROM public.jobs_ledger AS jl_from
    WHERE jl_to.id = p_to AND jl_from.id = p_from;

    -- Visible record of the combine on the target's activity thread, authored
    -- by the operator. Body format is a contract with jobCombineNote.ts
    -- (compose/parse) — change them together.
    v_src_label := CASE v_src_status
      WHEN 'waiting' THEN 'Waiting'
      WHEN 'working' THEN 'Working'
      WHEN 'ready_to_bill' THEN 'Ready to bill'
      WHEN 'billed' THEN 'Billed'
      WHEN 'paid' THEN 'Paid'
      ELSE NULLIF(trim(COALESCE(v_src_status, '')), '')
    END;
    v_note_body := format('Combined "%s" (Job #%s) into this job', COALESCE(v_src_name, ''), v_src_number);
    IF v_src_label IS NOT NULL THEN
      v_note_body := v_note_body || ' — source was ' || v_src_label;
      IF v_src_pct IS NOT NULL THEN
        v_note_body := v_note_body || ' at ' || rtrim(to_char(v_src_pct, 'FM999999990.##'), '.') || '%';
      END IF;
    END IF;
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (p_to, auth.uid(), v_note_body);

    DELETE FROM public.common_jobs WHERE job_id = p_from;

    DELETE FROM public.jobs_ledger WHERE id = p_from;

    RETURN jsonb_build_object(
      'ok', true,
      'from_master_user_id', v_from_master,
      'to_master_user_id', v_to_master,
      'note_body', v_note_body,
      'estimate_unlinked', v_estimate_unlinked,
      'source', jsonb_build_object(
        'job_name', v_src_name, 'number', v_src_number,
        'status', v_src_status, 'pct_complete', v_src_pct
      ),
      'target', jsonb_build_object('status', v_tgt_status, 'pct_complete', v_tgt_pct)
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'migrate_failed', 'error', SQLERRM);
  END;
END;
$function$;

-- 3. A ledger row and a box photo take their container's job. SECURITY DEFINER so the lookup sees a box the caller
--    cannot (one that moved to a job they are not on); the row then names that job, and the table's own INSERT
--    policy, on_site_can_touch_job(job_id), decides on it — so a press under a job the box has left lands on the
--    box's job when the caller may write there, and is refused in the open when they may not.
CREATE OR REPLACE FUNCTION public.on_site_row_takes_container_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_container uuid;
  v_job uuid;
BEGIN
  IF TG_TABLE_NAME = 'job_box_photos' THEN
    v_container := NEW.container_id;
  ELSE
    v_container := COALESCE(NEW.to_container_id, NEW.from_container_id);
  END IF;
  IF v_container IS NULL THEN RETURN NEW; END IF;
  SELECT c.job_id INTO v_job FROM public.job_containers c WHERE c.id = v_container;
  IF v_job IS NOT NULL AND v_job IS DISTINCT FROM NEW.job_id THEN
    NEW.job_id := v_job;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.on_site_row_takes_container_job() IS 'Materials on site (#209, v2.6808): a new job_material_movements or job_box_photos row takes the job of the container it names, so a press from a phone that still holds a job the boxes have left lands with the boxes. The INSERT policy then judges the row on that job.';

CREATE OR REPLACE TRIGGER job_material_movements_take_container_job BEFORE INSERT ON public.job_material_movements
  FOR EACH ROW EXECUTE FUNCTION public.on_site_row_takes_container_job();
CREATE OR REPLACE TRIGGER job_box_photos_take_container_job BEFORE INSERT ON public.job_box_photos
  FOR EACH ROW EXECUTE FUNCTION public.on_site_row_takes_container_job();

-- 4. A job's on-site rows, counted. SECURITY INVOKER: the tables' own RLS decides what the caller counts, as
--    on_site_job_summary does, whose lines give the parts on hand.
CREATE OR REPLACE FUNCTION public.on_site_job_counts(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'places', (SELECT count(*) FROM public.job_places WHERE job_id = p_job_id),
    'containers', (SELECT count(*) FROM public.job_containers WHERE job_id = p_job_id),
    'retired_containers', (SELECT count(*) FROM public.job_containers WHERE job_id = p_job_id AND retired_at IS NOT NULL),
    'movements', (SELECT count(*) FROM public.job_material_movements WHERE job_id = p_job_id),
    'container_moves', (SELECT count(*) FROM public.job_container_moves cm JOIN public.job_containers c ON c.id = cm.container_id WHERE c.job_id = p_job_id),
    'photos', (SELECT count(*) FROM public.job_box_photos WHERE job_id = p_job_id),
    'lines_on_hand', (SELECT count(*) FROM jsonb_array_elements(s.summary->'lines') l WHERE (l->>'on_hand')::int <> 0),
    'parts_on_hand', (SELECT COALESCE(sum((l->>'on_hand')::int), 0) FROM jsonb_array_elements(s.summary->'lines') l)
  )
  FROM (SELECT public.on_site_job_summary(p_job_id) AS summary) s
$fn$;

REVOKE ALL ON FUNCTION public.on_site_job_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_job_counts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_job_counts(uuid) TO authenticated;

COMMENT ON FUNCTION public.on_site_job_counts(uuid) IS 'Materials on site (#209, v2.6808): a job''s on-site rows counted — places, containers (and the retired among them), ledger rows, box moves, photos — with the lines and parts on hand from on_site_job_summary. The figures a move''s plan commits to on both jobs. Runs as the caller.';

-- 5. The dev seat's move.
CREATE OR REPLACE FUNCTION public.dev_on_site_move_job(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from uuid;
  v_to uuid;
  v_from_label text;
  v_from_name text;
  v_to_label text;
  v_to_name text;
  v_dev_name text;
  v_before_from jsonb;
  v_before_to jsonb;
  v_after_from jsonb;
  v_after_to jsonb;
  v_carried jsonb;
  v_folded int := 0;
  v_photos_in_drive int := 0;
  v_photos_waiting int := 0;
  v_photo_words text;
  v_what text;
  v_holds boolean;
  v_note_from text;
  v_note_to text;
  v_key text;
  v_out jsonb;
BEGIN
  -- Who may move: a dev, with their own key, not in training mode, not a twin.
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: devs only' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: a training account (read_only) cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: a digital twin cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email, 'the dev') INTO v_dev_name FROM public.users u WHERE u.id = auth.uid();

  IF COALESCE(p->>'from_job', '') !~ '^[0-9a-fA-F-]{36}$' OR COALESCE(p->>'to_job', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_on_site_move_job: from_job and to_job are required (each a jobs_ledger.id — find_job)';
  END IF;
  v_from := (p->>'from_job')::uuid;
  v_to := (p->>'to_job')::uuid;
  IF v_from = v_to THEN
    RAISE EXCEPTION 'dev_on_site_move_job: from_job and to_job are the same job — nothing to move';
  END IF;

  -- Each job as the app names it (JP972): the service type's job prefix, else J, then the HCP number, else the Click
  -- number — src/lib/ledgerDisplayPrefixes.ts formatJobLedgerNumberLabel, as dev_on_site_write names a job.
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_from_label, v_from_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = v_from;
  IF v_from_label IS NULL THEN RAISE EXCEPTION 'dev_on_site_move_job: from_job % not found', v_from; END IF;
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_to_label, v_to_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = v_to;
  IF v_to_label IS NULL THEN RAISE EXCEPTION 'dev_on_site_move_job: to_job % not found', v_to; END IF;

  v_before_from := public.on_site_job_counts(v_from);
  v_before_to := public.on_site_job_counts(v_to);
  IF (v_before_from->>'places')::int = 0 AND (v_before_from->>'containers')::int = 0
     AND (v_before_from->>'movements')::int = 0 AND (v_before_from->>'photos')::int = 0 THEN
    RAISE EXCEPTION 'dev_on_site_move_job: % has nothing on site to move — no place, cage, box, ledger row or photo', v_from_label;
  END IF;

  -- Where the photos' files are. A row moves with its box; a file already in Drive stays in the folder it was filed in.
  SELECT count(*) FILTER (WHERE drive_file_id IS NOT NULL),
         count(*) FILTER (WHERE drive_file_id IS NULL AND storage_path IS NOT NULL)
    INTO v_photos_in_drive, v_photos_waiting
  FROM public.job_box_photos WHERE job_id = v_from;

  BEGIN
    v_carried := public.on_site_carry_job(v_from, v_to);
    v_folded := CASE WHEN v_carried->'unsorted_folded' IS NULL OR jsonb_typeof(v_carried->'unsorted_folded') = 'null' THEN 0 ELSE 1 END;

    v_after_from := public.on_site_job_counts(v_from);
    v_after_to := public.on_site_job_counts(v_to);

    -- The rows must add up, or nothing is written: the source ends empty, and the target holds both jobs' rows less
    -- the places that became one and an Unsorted row that folded.
    FOREACH v_key IN ARRAY ARRAY['places', 'containers', 'movements', 'container_moves', 'photos'] LOOP
      IF (v_after_from->>v_key)::int <> 0 THEN
        RAISE EXCEPTION 'dev_on_site_move_job: % still holds % % after the move — nothing written', v_from_label, v_after_from->>v_key, v_key;
      END IF;
    END LOOP;
    IF (v_after_to->>'movements')::int <> (v_before_from->>'movements')::int + (v_before_to->>'movements')::int
       OR (v_after_to->>'container_moves')::int <> (v_before_from->>'container_moves')::int + (v_before_to->>'container_moves')::int
       OR (v_after_to->>'photos')::int <> (v_before_from->>'photos')::int + (v_before_to->>'photos')::int
       OR (v_after_to->>'containers')::int <> (v_before_from->>'containers')::int + (v_before_to->>'containers')::int - v_folded
       OR (v_after_to->>'places')::int <> (v_before_from->>'places')::int + (v_before_to->>'places')::int - jsonb_array_length(v_carried->'places_merged') THEN
      RAISE EXCEPTION 'dev_on_site_move_job: the rows on % after the move do not add up to both jobs'' rows — nothing written', v_to_label;
    END IF;
    -- The parts on hand are the same parts, so the sums should add up. They can read differently only where a count
    -- now resets a line that rows from the other job fed: two Unsorted piles that became one, or a row that named
    -- the other job's box. The reply says which way it went and the reader decides; nothing is refused for it.
    v_holds := (v_after_to->>'parts_on_hand')::int = (v_before_from->>'parts_on_hand')::int + (v_before_to->>'parts_on_hand')::int;

    v_what := (v_carried->>'containers') || CASE WHEN (v_carried->>'containers')::int = 1 THEN ' cage or box' ELSE ' cages and boxes' END
      || CASE WHEN (v_carried->>'retired_containers')::int > 0 THEN ' (' || (v_carried->>'retired_containers') || ' retired)' ELSE '' END
      || ', ' || (v_before_from->>'places') || CASE WHEN (v_before_from->>'places')::int = 1 THEN ' place' ELSE ' places' END
      || ', ' || (v_carried->>'movements') || CASE WHEN (v_carried->>'movements')::int = 1 THEN ' ledger row' ELSE ' ledger rows' END
      || ', ' || (v_carried->>'container_moves') || CASE WHEN (v_carried->>'container_moves')::int = 1 THEN ' box move' ELSE ' box moves' END
      || ', ' || (v_carried->>'photos') || CASE WHEN (v_carried->>'photos')::int = 1 THEN ' photo' ELSE ' photos' END;

    v_photo_words := CASE
      WHEN (v_carried->>'photos')::int = 0 THEN 'No photos to move.'
      ELSE 'Every photo''s row moves with its box.'
        || CASE WHEN v_photos_in_drive > 0 THEN ' ' || v_photos_in_drive || CASE WHEN v_photos_in_drive = 1 THEN ' file is' ELSE ' files are' END
             || ' already in Drive and ' || CASE WHEN v_photos_in_drive = 1 THEN 'stays' ELSE 'stay' END || ' in ' || v_from_label
             || '''s photo folder: each row keeps its own Drive id, so a photo that showed on its box still does, but '
             || v_to_label || '''s Drive folder will not list ' || CASE WHEN v_photos_in_drive = 1 THEN 'it' ELSE 'them' END || '.'
           ELSE '' END
        || CASE WHEN v_photos_waiting > 0 THEN ' ' || v_photos_waiting || CASE WHEN v_photos_waiting = 1 THEN ' is' ELSE ' are' END
             || ' still waiting for the photo sweep, which files by the row''s job: into ' || v_to_label || '''s photo folder.'
           ELSE '' END
    END;

    -- A line on each job's notes, as a combine leaves one, so the office reads where the boxes went and came from.
    v_note_to := left('Materials on site moved here from ' || v_from_label || CASE WHEN v_from_name <> '' THEN ' (' || v_from_name || ')' ELSE '' END
      || ', where the count was recorded: ' || v_what || '. Every box keeps its printed code.'
      || CASE WHEN jsonb_array_length(v_carried->'labels_renamed') > 0
           THEN ' ' || jsonb_array_length(v_carried->'labels_renamed') || ' took a numbered label because this job already had that stencil: '
             || (SELECT string_agg((l->>'from') || ' is now ' || (l->>'to'), ', ') FROM jsonb_array_elements(v_carried->'labels_renamed') l) || '.'
           ELSE '' END, 2000);
    v_note_from := left('Materials on site moved to ' || v_to_label || CASE WHEN v_to_name <> '' THEN ' (' || v_to_name || ')' ELSE '' END
      || ', the job the material belongs to: ' || v_what || '. Nothing on site is left on this job.', 2000);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (v_to, auth.uid(), v_note_to);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (v_from, auth.uid(), v_note_from);

    v_out := jsonb_build_object(
      'ok', true,
      'dry_run', p_dry_run,
      'from', jsonb_build_object('id', v_from, 'label', v_from_label, 'name', v_from_name),
      'to', jsonb_build_object('id', v_to, 'label', v_to_label, 'name', v_to_name),
      'by', v_dev_name,
      'words', 'Everything on site on ' || v_from_label || ' moves to ' || v_to_label || ': ' || v_what
        || '. Every cage and box keeps its id and the code printed on its label; no ledger row is rewritten, only the job it sits under.',
      'moved', v_carried - 'places_merged' - 'unsorted_folded' - 'labels_renamed',
      'places_merged', v_carried->'places_merged',
      'unsorted_folded', v_carried->'unsorted_folded',
      'labels_renamed', v_carried->'labels_renamed',
      'photos', jsonb_build_object('rows', (v_carried->>'photos')::int, 'in_drive', v_photos_in_drive, 'waiting', v_photos_waiting, 'words', v_photo_words),
      'on_hand', jsonb_build_object(
        'holds', v_holds,
        'words', CASE WHEN v_holds THEN 'The parts on hand add up: ' || (v_before_from->>'parts_on_hand') || ' from ' || v_from_label || ' and ' || (v_before_to->>'parts_on_hand') || ' already on ' || v_to_label || ' read ' || (v_after_to->>'parts_on_hand') || ' after.'
                      ELSE 'The parts on hand do not add up: ' || (v_before_from->>'parts_on_hand') || ' from ' || v_from_label || ' and ' || (v_before_to->>'parts_on_hand') || ' already on ' || v_to_label || ' read ' || (v_after_to->>'parts_on_hand') || ' after. A count now resets a line that rows from the other job fed: two Unsorted piles that became one, or a row that named the other job''s box. Read both jobs with read_on_site before applying.' END),
      'before', jsonb_build_object('from', v_before_from, 'to', v_before_to),
      'after', jsonb_build_object('from', v_after_from, 'to', v_after_to),
      'notes', jsonb_build_object('from', v_note_from, 'to', v_note_to),
      'next', 'A phone that still has ' || v_from_label || ' open on the On site tab should open ' || v_to_label || ' instead: a press it sends lands on the box''s job now, and is refused for anyone who is not on ' || v_to_label || '''s team.'
    );
    IF p_dry_run THEN
      -- unwind every write above; v_out survives the exception
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) IS 'dev-mcp (v2.6808, punch list #209): a signed-in dev moves everything one job holds on site to another job — { from_job, to_job } — through on_site_carry_job, the rule the whole-job combine uses, every container keeping its id and printed code; a note lands on both jobs. p_dry_run = true (default) performs the move, reads both jobs and unwinds, returning the plan: the counts moved, the places that became one, the labels renumbered, where the photos'' files are, and the row counts and parts on hand on both jobs before and after. Devs only; a training account and a twin are refused.';
