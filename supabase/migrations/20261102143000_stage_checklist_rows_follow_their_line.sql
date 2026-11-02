SET lock_timeout = '3s';

-- A stage's checklist follows its stage line through a split or a combine (punch list #237, v2.6350). Both doors move the
-- line, jobs_ledger_fixtures.job_id, and neither knew the checklist rows that name it: stage_checklist_answers since #164,
-- the job items on stage_checklist_templates since PR 1, stage_checklist_skips since PR 1b. The rows kept the old job. A
-- split left them where the new job's sheet never reads them, since every read filters on job_id. A combine deleted the
-- source job, and its cascade took them. The bed's supabase/tests/stage_checklist_items/40_follow_the_line.sql lists what
-- was lost on a run without this file.
--
--   1. jobs_ledger_fixtures_carry_checklist: when a line's job changes, the rows on that line in the three tables take the
--      new job, whatever door moved it. A trigger and not a line in each function, so a third door, or the next restatement
--      of these two long bodies, cannot forget it. Only job_id changes: the pick, the stamp, the photo and updated_at read
--      as they did. A retired item and a skip put back go too, since they are the record. SECURITY DEFINER: the person
--      moving a line holds no write on these columns (an adder's update is the retire, a skip's update is the put back).
--   2. stage_checklist_answers_on_stage_job: an answer's job is always its line's job, read on every write that names
--      either. A sheet opened before a split or a combine still writes the job it was opened on, so its press would strand
--      a new row on the old job, or fail on the deleted one, and an outbox replay would do the same. The gate then asks
--      about the line's real job, so naming your own job no longer answers another job's stage. Both doors lock the job
--      before they move a line, so the trigger takes the key lock the foreign key would take anyway, then reads the line
--      again: a press and a move take turns, and either order leaves the row on the line's job, with no deadlock since
--      the press holds nothing while it waits. Items and skips already refuse a stage that is not on the job they name
--      (That stage is not on this job.), which is the right answer for someone authoring.
--   3. migrate_job_ledger_costs_and_delete: 20261031020000's body with one line, report_photos goes with the reports. An
--      answer whose photo came from a field report kept its photo only while that row lived, and the source job's cascade
--      deleted it. A split leaves the report and its photo on the old job, as it leaves every report, and the answer keeps
--      naming it, so the trigger's mirror still reaches it.
--   4. Rows an earlier split already stranded rejoin their line. No office had typed a question when this was written, so
--      this should find nothing; a row a combine already deleted is gone.
--
-- A bucket path keeps the old job's folder, <job_id>/<id>.jpg: the sweeps read the row's path, and the job they file under
-- is now the right one. Until the sweep files a waiting shot, the sheet may draw no thumbnail for it, since the bucket's
-- gate reads the job from the path. The answer and the shot are both safe.
--
-- Additive and idempotent; no table is created, so no fence call. CREATE OR REPLACE TRIGGER takes SHARE ROW EXCLUSIVE, which
-- leaves readers alone, and the stage lines are locked first, as every delete of a line locks them before its cascade.
-- The client changes nothing but words, so this is harmless on either side of the Pages deploy. check:calls-ahead labels the
-- PR push right after the merge anyway, since this restates a function the client calls, so the deploy waits for the push.

-- 1. A moved line carries its checklist.
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
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.jobs_ledger_fixture_carries_checklist() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.jobs_ledger_fixture_carries_checklist() IS 'A stage line that moves to another job carries its checklist (#237): the answers, job items and skips that name the line take its new job, and nothing else on them changes.';

CREATE OR REPLACE TRIGGER jobs_ledger_fixtures_carry_checklist
  AFTER UPDATE OF job_id ON public.jobs_ledger_fixtures
  FOR EACH ROW
  WHEN (OLD.job_id IS DISTINCT FROM NEW.job_id)
  EXECUTE FUNCTION public.jobs_ledger_fixture_carries_checklist();

-- 2. An answer's job is its line's job.
CREATE OR REPLACE FUNCTION public.stage_checklist_answer_on_stage_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
BEGIN
  SELECT f.job_id INTO v_job FROM public.jobs_ledger_fixtures f WHERE f.id = NEW.fixture_id;
  PERFORM 1 FROM public.jobs_ledger j WHERE j.id = v_job FOR KEY SHARE;
  SELECT f.job_id INTO v_job FROM public.jobs_ledger_fixtures f WHERE f.id = NEW.fixture_id;
  NEW.job_id := COALESCE(v_job, NEW.job_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_answer_on_stage_job() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.stage_checklist_answer_on_stage_job() IS 'An answer''s job is its stage line''s job (#237): read on every write that names either, so a sheet opened before a split or a combine lands its press on the line''s job and the gate asks about that job.';

CREATE OR REPLACE TRIGGER stage_checklist_answers_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.stage_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_answer_on_stage_job();

-- 3. migrate_job_ledger_costs_and_delete: 20261031020000's body with report_photos moved after the reports.
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

-- 4. Rows an earlier split stranded rejoin their line.
UPDATE public.stage_checklist_answers a SET job_id = f.job_id FROM public.jobs_ledger_fixtures f WHERE f.id = a.fixture_id AND a.job_id IS DISTINCT FROM f.job_id;
UPDATE public.stage_checklist_templates t SET job_id = f.job_id FROM public.jobs_ledger_fixtures f WHERE f.id = t.fixture_id AND t.job_id IS DISTINCT FROM f.job_id;
UPDATE public.stage_checklist_skips s SET job_id = f.job_id FROM public.jobs_ledger_fixtures f WHERE f.id = s.fixture_id AND s.job_id IS DISTINCT FROM f.job_id;
