SET lock_timeout = '3s';

-- A combine moves every row that would have gone with the source job's delete (punch list #252, v2.6423). The combine's
-- RPC moved a named list of tables and then deleted the source row, and ON DELETE CASCADE took the rest: 52 tables on
-- prod's catalog on 2026-11-02, read from the migrations here since the dev seat answered revoked. The guide said
-- everything real moves. The card at to-dos/combine-rows.md sorts every one of them into move, merge or let go with
-- its reason; this file does the move and merge rows that are not money or legal. Those wait on the owner's word and
-- keep today's behaviour until a second migration restates this body with them.
--
--   1. jobs_ledger_fixture_carries_checklist: 20261102143000's body with one more table. A stage's window
--      (job_stage_windows, one row per job and line) names the line and kept the old job through a split or a combine,
--      where no read on the new job found it. A trigger and not a line in each door, as the checklists are.
--   2. job_supply_house_words_stamp: 20261002140000's body with one gate. The stamp set noted_by and noted_at on every
--      write, so moving a word to another job re-stamped it as the combiner's, today. A write that changes the job
--      and nothing the house said keeps its stamp.
--   3. migrate_job_ledger_costs_and_delete: 20261102143000's body with the moves and merges after the team members,
--      one refusal before the write block (a sub both jobs hold a live work order for, work_order_collision, since
--      step_commitments_job_person_live_uniq allows one and neither order should be cancelled by a rule), and the
--      caller's name for the stamp the hours target takes. Each table's rule is the comment above its line.
--   4. Rows an earlier split stranded rejoin their line: a stage window on another job than its line.
--
-- Additive and idempotent; no table is created, so no fence call. CREATE OR REPLACE TRIGGER takes SHARE ROW EXCLUSIVE
-- on job_stage_windows for a moment and leaves readers alone. The client changes nothing but words, so this is harmless
-- on either side of the Pages deploy; check:calls-ahead labels the PR push right after the merge anyway, since this
-- restates a function the client calls, and the deploy waits for the push.

-- 1. A moved line carries its checklist and its window.
CREATE OR REPLACE FUNCTION public.jobs_ledger_fixture_carries_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stage_checklist_answers SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.stage_checklist_templates SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.stage_checklist_skips SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.job_stage_windows SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.jobs_ledger_fixture_carries_checklist() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.jobs_ledger_fixture_carries_checklist() IS 'A stage line that moves to another job carries its checklist (#237) and its window (#252): the answers, job items, skips and stage window that name the line take its new job, and nothing else on them changes.';

CREATE OR REPLACE TRIGGER jobs_ledger_fixtures_carry_checklist
  AFTER UPDATE OF job_id ON public.jobs_ledger_fixtures
  FOR EACH ROW
  WHEN (OLD.job_id IS DISTINCT FROM NEW.job_id)
  EXECUTE FUNCTION public.jobs_ledger_fixture_carries_checklist();

-- 2. A word moved to another job keeps who noted it and when.
CREATE OR REPLACE FUNCTION public.job_supply_house_words_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.job_id IS DISTINCT FROM OLD.job_id
     AND (NEW.their_balance, NEW.notice_on, NEW.said_by, NEW.note)
         IS NOT DISTINCT FROM (OLD.their_balance, OLD.notice_on, OLD.said_by, OLD.note) THEN
    NEW.noted_by := OLD.noted_by;
    NEW.noted_by_name := OLD.noted_by_name;
    NEW.noted_at := OLD.noted_at;
    RETURN NEW;
  END IF;
  NEW.noted_by := auth.uid();
  NEW.noted_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.job_supply_house_words_stamp() FROM PUBLIC, anon, authenticated;

-- 3. migrate_job_ledger_costs_and_delete: 20261102143000's body with every row that should move, and one refusal.
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
  v_label text;
  v_n int;
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
    -- plain move, or the merge its own unique key asks for. The money and legal rows are not here yet: the card
    -- lists them and the owner's word decides them. What is let go on purpose: the thread-note stats cache (the
    -- notes' move above recomputes the target's row), the drive-time cache between two jobs, and the paid-job mail
    -- queue, each a cache or a log about a card that is going.

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

    -- Materials on site. A place the target already has under the same name takes the source's containers and
    -- moves, and the source's place goes. A container with the same live label: the job's Unsorted row is the
    -- catch-all, so the source's folds into the target's (its movements, moves and photos re-pointed); a cage or a
    -- box keeps its own row, since its code is printed on its label, and takes a numbered label instead.
    FOR r IN
      SELECT s.id AS src_id, t.id AS tgt_id
      FROM public.job_places s
      JOIN public.job_places t ON t.job_id = p_to AND lower(trim(t.name)) = lower(trim(s.name))
      WHERE s.job_id = p_from
    LOOP
      UPDATE public.job_containers SET place_id = r.tgt_id WHERE place_id = r.src_id;
      UPDATE public.job_container_moves SET from_place_id = r.tgt_id WHERE from_place_id = r.src_id;
      UPDATE public.job_container_moves SET to_place_id = r.tgt_id WHERE to_place_id = r.src_id;
      DELETE FROM public.job_places WHERE id = r.src_id;
    END LOOP;
    UPDATE public.job_places SET job_id = p_to WHERE job_id = p_from;
    FOR r IN
      SELECT s.id AS src_id, s.kind, s.label, t.id AS tgt_id
      FROM public.job_containers s
      JOIN public.job_containers t
        ON t.job_id = p_to AND t.retired_at IS NULL AND lower(trim(t.label)) = lower(trim(s.label))
      WHERE s.job_id = p_from AND s.retired_at IS NULL
    LOOP
      IF r.kind = 'unsorted' THEN
        UPDATE public.job_material_movements SET from_container_id = r.tgt_id WHERE from_container_id = r.src_id;
        UPDATE public.job_material_movements SET to_container_id = r.tgt_id WHERE to_container_id = r.src_id;
        UPDATE public.job_container_moves SET container_id = r.tgt_id WHERE container_id = r.src_id;
        UPDATE public.job_box_photos SET container_id = r.tgt_id WHERE container_id = r.src_id;
        DELETE FROM public.job_containers WHERE id = r.src_id;
      ELSE
        v_n := 2;
        v_label := left(trim(r.label), 20) || ' (' || v_n || ')';
        WHILE v_n < 9 AND EXISTS (
          SELECT 1 FROM public.job_containers c
          WHERE c.job_id IN (p_from, p_to) AND c.retired_at IS NULL AND lower(trim(c.label)) = lower(v_label)
        ) LOOP
          v_n := v_n + 1;
          v_label := left(trim(r.label), 20) || ' (' || v_n || ')';
        END LOOP;
        UPDATE public.job_containers SET label = v_label WHERE id = r.src_id;
      END IF;
    END LOOP;
    UPDATE public.job_containers SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_material_movements SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.job_box_photos SET job_id = p_to WHERE job_id = p_from;

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

-- 4. A stage window an earlier split stranded rejoins its line.
UPDATE public.job_stage_windows w
  SET job_id = f.job_id
  FROM public.jobs_ledger_fixtures f
  WHERE f.id = w.fixture_id AND w.job_id IS DISTINCT FROM f.job_id
    AND NOT EXISTS (SELECT 1 FROM public.job_stage_windows x WHERE x.job_id = f.job_id AND x.fixture_id = f.id);
