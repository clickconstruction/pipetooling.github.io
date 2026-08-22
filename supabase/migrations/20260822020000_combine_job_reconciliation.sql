SET lock_timeout = '3s';

-- Combine-flow reconciliation (v2.2068). Investigated 2026-08-21 on job 877
-- "Johnny Ingram": migrate_job_ledger_costs_and_delete (Combine/Separate +
-- Delete-job modal) moves the source job's thread notes, reports and
-- job_status_events onto the target, then deletes the source — silently.
-- Two confirmed consequences:
--
--   1. The migrated job_status_events tell the SOURCE job's story on the
--      target (e.g. a working→ready_to_bill event on a job that is billed),
--      breaking the v2.1435 single-writer history assumption for consumers
--      like Weekly Money movement and the RTB notification payloads.
--   2. The field crew's completion signals vanish: a tech marks the duplicate
--      100% + Ready to bill, the combine keeps the target's old status/pct,
--      and the tech sees their work "reverted" with no explanation (root of
--      Abraham's 2026-08-21 complaint).
--
-- Three additive changes, everything else byte-for-byte 20260619130000:
--
--   a. job_status_events gains nullable source_job_id. Migrated events carry
--      the (now-deleted) source job's id so history consumers can tell native
--      events from migrated ones. No FK: the source row is deleted in the same
--      transaction, so the id is forensic, not relational.
--   b. The move now posts a thread note on the target, authored by the
--      operator (auth.uid()): `Combined "<name>" (Job #<number>) into this
--      job — source was <Status> at <pct>%`. Same fixed-format contract as
--      the v2.2065 send-back notes; compose/parse mirrored in
--      src/lib/jobs/jobCombineNote.ts — keep the two in sync.
--   c. The return payload reports source/target identity + status/pct and the
--      posted note body, so callers can confirm what was reconciled. Old
--      clients ignore the extra keys; the signature is unchanged.

ALTER TABLE public.job_status_events
  ADD COLUMN IF NOT EXISTS source_job_id uuid;

COMMENT ON COLUMN public.job_status_events.source_job_id IS
  'Set when this event was migrated from another job by migrate_job_ledger_costs_and_delete (Combine/Delete-migrate). Holds the deleted source job''s id; NULL for events written on this job. Migrated events describe the SOURCE job''s transitions — history consumers that assume single-writer order should skip rows where this is non-null.';

CREATE OR REPLACE FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_to
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
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
    UPDATE public.inspections SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.jobs_ledger_thread_notes SET job_id = p_to WHERE job_id = p_from;
    -- Migrated status events keep telling the SOURCE job's story — tag them so
    -- history consumers can tell them apart from the target's native events.
    UPDATE public.job_status_events SET job_id = p_to, source_job_id = p_from WHERE job_id = p_from;
    UPDATE public.estimates SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
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
$$;

ALTER FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean) TO "authenticated";

COMMENT ON FUNCTION "public"."migrate_job_ledger_costs_and_delete"("p_from" "uuid", "p_to" "uuid", "p_allow_billed" boolean) IS
  'Move a job''s costs, labor, notes, reports and status events onto another job, then delete the source. Migrated job_status_events are tagged with source_job_id, and a "Combined …" thread note (authored by the caller) is posted on the target recording the source''s name, number, status and % complete. Callers should surface source-vs-target status/pct conflicts before confirming (jobCombineNote.ts).';
