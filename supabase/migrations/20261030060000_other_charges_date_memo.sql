SET lock_timeout = '3s';

-- Punch list #215, PR 2 (to-dos/other-job-charges-date-memo/): an Other job charge carries
-- the date it applies to and a memo.
--
--   charged_on  the date the charge applies to. The job form fills it with the day the row
--               is added; it can be cleared. Null on every row written before this.
--               It is NOT created_at: created_at is when the row was typed, and the job
--               form's materials save rewrote every row on each save (until PR 3).
--   memo        the basis and the source: the plan the number came from, what would
--               replace it. The description stays the short printed label.
--
-- Both nullable and additive; the table's RLS policies are row-level and cover them.
-- cost_batch_apply (20260909161532) is re-created below so an other_charge op may carry
-- "charged_on" and "memo" (both optional); the rest of the function is verbatim.

ALTER TABLE public.jobs_ledger_materials
  ADD COLUMN IF NOT EXISTS charged_on date,
  ADD COLUMN IF NOT EXISTS memo text;

COMMENT ON COLUMN public.jobs_ledger_materials.charged_on IS
  'The date the charge applies to (punch list #215). Set by the job form (defaults to the day the row is added) or by a cost batch; null on rows from before 2026-10-29.';
COMMENT ON COLUMN public.jobs_ledger_materials.memo IS
  'The basis and the source of the charge: the plan it came from, what would replace it (punch list #215). The description stays the printed label.';

CREATE OR REPLACE FUNCTION public.cost_batch_apply(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_label text;
  v_reason text;
  v_source text;
  v_author_label text;
  v_author uuid;
  v_batch uuid;
  v_ops jsonb;
  v_op jsonb;
  v_seq integer := 0;
  v_kind text;
  v_tx record;
  v_job uuid;
  v_from uuid;
  v_to uuid;
  v_amount numeric;
  v_signed numeric;
  v_existing record;
  v_replaced jsonb;
  v_before jsonb;
  v_after jsonb;
  v_sum numeric;
  v_new_id uuid;
  v_seq_order integer;
  v_ops_out jsonb := '[]'::jsonb;
  v_by_job jsonb := '{}'::jsonb;
  v_jobrow jsonb;
  v_key text;
  v_summary jsonb;
  v_desc text;
  v_charged_on date;
  v_memo text;
  v_body text;
  v_note text;
BEGIN
  -- caller gate: signed-in callers must be devs; database roles (no auth.uid()) pass
  IF auth.uid() IS NOT NULL AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'cost_batch_apply: devs only';
  END IF;

  v_label := NULLIF(btrim(COALESCE(p->>'label', '')), '');
  v_reason := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
  v_source := NULLIF(btrim(COALESCE(p->>'source_ref', '')), '');
  v_author_label := COALESCE(NULLIF(btrim(p->>'author_label'), ''), 'Cost agent');
  v_author := (p->>'author_user_id')::uuid;
  v_ops := COALESCE(p->'ops', '[]'::jsonb);

  IF v_label IS NULL THEN RAISE EXCEPTION 'cost_batch_apply: label is required'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'cost_batch_apply: reason is required'; END IF;
  IF jsonb_typeof(v_ops) <> 'array' OR jsonb_array_length(v_ops) = 0 THEN
    RAISE EXCEPTION 'cost_batch_apply: ops must be a non-empty array';
  END IF;
  IF v_author IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_author) THEN
    RAISE EXCEPTION 'cost_batch_apply: author_user_id % is not a user', v_author;
  END IF;

  -- Everything below runs inside one block. On a dry run the block ends with a
  -- deliberate RAISE that unwinds every write; the summary variable survives.
  BEGIN
    FOR v_op IN SELECT * FROM jsonb_array_elements(v_ops) LOOP
      v_seq := v_seq + 1;
      v_kind := v_op->>'op';
      v_before := NULL; v_after := NULL; v_replaced := NULL;

      IF v_kind = 'allocate' THEN
        v_job := (v_op->>'job_id')::uuid;
        v_from := (v_op->>'from_job_id')::uuid;
        v_amount := (v_op->>'amount')::numeric;
        v_note := NULLIF(btrim(COALESCE(v_op->>'note', '')), '');
        IF v_job IS NULL OR v_amount IS NULL THEN
          RAISE EXCEPTION 'op %: allocate needs job_id and amount', v_seq;
        END IF;
        IF v_amount <= 0 THEN
          RAISE EXCEPTION 'op %: allocate amount must be > 0 (got %)', v_seq, v_amount;
        END IF;
        SELECT id, amount INTO v_tx FROM public.mercury_transactions WHERE id = (v_op->>'tx_id')::uuid;
        IF v_tx.id IS NULL THEN
          RAISE EXCEPTION 'op %: transaction % not found', v_seq, v_op->>'tx_id';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_job;
        END IF;
        -- stored with the transaction's sign (outflows are negative in the app)
        v_signed := CASE WHEN v_tx.amount < 0 THEN -v_amount ELSE v_amount END;

        -- the allocation being replaced (e.g. the catch-all job's) — recorded, then removed
        IF v_from IS NOT NULL THEN
          SELECT * INTO v_existing FROM public.mercury_transaction_job_allocations
            WHERE mercury_transaction_id = v_tx.id AND job_id = v_from;
          IF v_existing.id IS NULL THEN
            RAISE EXCEPTION 'op %: no allocation of transaction % on from_job %', v_seq, v_tx.id, v_from;
          END IF;
          v_replaced := to_jsonb(v_existing);
          DELETE FROM public.mercury_transaction_job_allocations WHERE id = v_existing.id;
        END IF;

        SELECT * INTO v_existing FROM public.mercury_transaction_job_allocations
          WHERE mercury_transaction_id = v_tx.id AND job_id = v_job;
        IF v_existing.id IS NOT NULL THEN
          v_before := jsonb_build_object('allocation', to_jsonb(v_existing), 'replaced', v_replaced);
          UPDATE public.mercury_transaction_job_allocations
            SET amount = v_signed, note = COALESCE(v_note, note)
            WHERE id = v_existing.id
            RETURNING to_jsonb(mercury_transaction_job_allocations.*) INTO v_after;
          v_after := jsonb_build_object('action', 'update', 'allocation', v_after);
        ELSE
          v_before := CASE WHEN v_replaced IS NULL THEN NULL ELSE jsonb_build_object('replaced', v_replaced) END;
          INSERT INTO public.mercury_transaction_job_allocations (mercury_transaction_id, job_id, amount, note)
            VALUES (v_tx.id, v_job, v_signed, v_note)
            RETURNING to_jsonb(mercury_transaction_job_allocations.*) INTO v_after;
          v_after := jsonb_build_object('action', 'insert', 'allocation', v_after);
        END IF;

        -- the allocation set on a transaction can never exceed the transaction
        SELECT COALESCE(SUM(amount), 0) INTO v_sum FROM public.mercury_transaction_job_allocations
          WHERE mercury_transaction_id = v_tx.id;
        IF abs(v_sum) > abs(v_tx.amount) + 0.005 THEN
          RAISE EXCEPTION 'op %: allocations on transaction % would total % against a transaction of %',
            v_seq, v_tx.id, v_sum, v_tx.amount;
        END IF;
        v_key := v_job::text;
        v_jobrow := COALESCE(v_by_job->v_key, '{}'::jsonb);
        v_jobrow := jsonb_set(v_jobrow, '{allocated}', to_jsonb(COALESCE((v_jobrow->>'allocated')::numeric, 0) + v_amount));

      ELSIF v_kind = 'supply_repoint' THEN
        v_from := (v_op->>'from_job_id')::uuid;
        v_to := (v_op->>'to_job_id')::uuid;
        IF v_from IS NULL OR v_to IS NULL OR v_op->>'invoice_id' IS NULL THEN
          RAISE EXCEPTION 'op %: supply_repoint needs invoice_id, from_job_id, to_job_id', v_seq;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_to) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_to;
        END IF;
        SELECT * INTO v_existing FROM public.supply_house_invoice_job_allocations
          WHERE invoice_id = (v_op->>'invoice_id')::uuid AND job_id = v_from;
        IF v_existing.invoice_id IS NULL THEN
          RAISE EXCEPTION 'op %: invoice % is not allocated to job %', v_seq, v_op->>'invoice_id', v_from;
        END IF;
        IF EXISTS (SELECT 1 FROM public.supply_house_invoice_job_allocations
                   WHERE invoice_id = v_existing.invoice_id AND job_id = v_to) THEN
          RAISE EXCEPTION 'op %: invoice % is already allocated to job % — merge by hand', v_seq, v_existing.invoice_id, v_to;
        END IF;
        v_before := to_jsonb(v_existing);
        UPDATE public.supply_house_invoice_job_allocations SET job_id = v_to
          WHERE invoice_id = v_existing.invoice_id AND job_id = v_from
          RETURNING to_jsonb(supply_house_invoice_job_allocations.*) INTO v_after;
        v_key := v_to::text;
        v_jobrow := COALESCE(v_by_job->v_key, '{}'::jsonb);
        v_jobrow := jsonb_set(v_jobrow, '{supply}', to_jsonb(COALESCE((v_jobrow->>'supply')::integer, 0) + 1));

      ELSIF v_kind = 'clock_repoint' THEN
        v_to := (v_op->>'to_job_id')::uuid;
        IF v_to IS NULL OR v_op->>'session_id' IS NULL THEN
          RAISE EXCEPTION 'op %: clock_repoint needs session_id and to_job_id', v_seq;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_to) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_to;
        END IF;
        SELECT id, user_id, work_date, job_ledger_id, bid_id INTO v_existing
          FROM public.clock_sessions WHERE id = (v_op->>'session_id')::uuid;
        IF v_existing.id IS NULL THEN
          RAISE EXCEPTION 'op %: clock session % not found', v_seq, v_op->>'session_id';
        END IF;
        IF v_existing.bid_id IS NOT NULL THEN
          RAISE EXCEPTION 'op %: clock session % is bid time, not job time', v_seq, v_existing.id;
        END IF;
        v_before := to_jsonb(v_existing);
        UPDATE public.clock_sessions SET job_ledger_id = v_to WHERE id = v_existing.id;
        v_after := jsonb_build_object('id', v_existing.id, 'job_ledger_id', v_to);
        v_key := v_to::text;
        v_jobrow := COALESCE(v_by_job->v_key, '{}'::jsonb);
        v_jobrow := jsonb_set(v_jobrow, '{clock_sessions}', to_jsonb(COALESCE((v_jobrow->>'clock_sessions')::integer, 0) + 1));

      ELSIF v_kind = 'other_charge' THEN
        v_job := (v_op->>'job_id')::uuid;
        v_desc := btrim(COALESCE(v_op->>'description', ''));
        v_amount := (v_op->>'amount')::numeric;
        IF v_job IS NULL OR v_amount IS NULL OR v_desc = '' THEN
          RAISE EXCEPTION 'op %: other_charge needs job_id, description, amount', v_seq;
        END IF;
        IF v_amount < 0 THEN
          RAISE EXCEPTION 'op %: other_charge amount must be >= 0', v_seq;
        END IF;
        -- #215 (PR 2): the date the charge applies to and the memo (basis, source) ride the op.
        BEGIN
          v_charged_on := NULLIF(btrim(COALESCE(v_op->>'charged_on', '')), '')::date;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'op %: other_charge charged_on must be a date (YYYY-MM-DD)', v_seq;
        END;
        v_memo := NULLIF(btrim(COALESCE(v_op->>'memo', '')), '');
        IF upper(left(v_desc, 8)) <> 'ESTIMATE' THEN
          RAISE EXCEPTION 'op %: an other_charge from a batch must be described as an ESTIMATE (description starts with "ESTIMATE")', v_seq;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_job;
        END IF;
        SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq_order
          FROM public.jobs_ledger_materials WHERE job_id = v_job;
        INSERT INTO public.jobs_ledger_materials (job_id, description, amount, sequence_order, charged_on, memo)
          VALUES (v_job, v_desc, v_amount, v_seq_order, v_charged_on, v_memo)
          RETURNING to_jsonb(jobs_ledger_materials.*) INTO v_after;
        v_key := v_job::text;
        v_jobrow := COALESCE(v_by_job->v_key, '{}'::jsonb);
        v_jobrow := jsonb_set(v_jobrow, '{other_charges}', to_jsonb(COALESCE((v_jobrow->>'other_charges')::numeric, 0) + v_amount));

      ELSIF v_kind = 'thread_note' THEN
        v_job := (v_op->>'job_id')::uuid;
        v_body := btrim(COALESCE(v_op->>'body', ''));
        IF v_job IS NULL OR v_body = '' THEN
          RAISE EXCEPTION 'op %: thread_note needs job_id and body', v_seq;
        END IF;
        IF v_author IS NULL THEN
          RAISE EXCEPTION 'op %: thread_note needs author_user_id on the batch', v_seq;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_job;
        END IF;
        INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
          VALUES (v_job, v_author, left(v_body, 2000))
          RETURNING to_jsonb(jobs_ledger_thread_notes.*) INTO v_after;
        v_key := v_job::text;
        v_jobrow := COALESCE(v_by_job->v_key, '{}'::jsonb);
        v_jobrow := jsonb_set(v_jobrow, '{notes}', to_jsonb(COALESCE((v_jobrow->>'notes')::integer, 0) + 1));

      ELSE
        RAISE EXCEPTION 'op %: unknown op "%"', v_seq, COALESCE(v_kind, '(null)');
      END IF;

      v_by_job := jsonb_set(v_by_job, ARRAY[v_key], v_jobrow);
      v_ops_out := v_ops_out || jsonb_build_object('seq', v_seq, 'op', v_kind, 'before', v_before, 'after', v_after);
    END LOOP;

    v_summary := jsonb_build_object(
      'batch_id', NULL, 'dry_run', p_dry_run, 'op_count', v_seq,
      'by_job', v_by_job, 'ops', v_ops_out);

    IF p_dry_run THEN
      -- unwind every write above; v_summary survives the exception
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;

    INSERT INTO public.cost_batches (label, reason, source_ref, author_label, author_user_id, op_count, summary)
      VALUES (v_label, v_reason, v_source, v_author_label, v_author, v_seq,
              jsonb_build_object('by_job', v_by_job))
      RETURNING id INTO v_batch;
    INSERT INTO public.cost_batch_ops (batch_id, seq, op_type, target, before_image, after_image)
      SELECT v_batch, (o->>'seq')::integer, o->>'op', v_ops->((o->>'seq')::integer - 1), o->'before', o->'after'
      FROM jsonb_array_elements(v_ops_out) AS o;
    v_summary := jsonb_set(v_summary, '{batch_id}', to_jsonb(v_batch));
    RETURN v_summary;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_summary;
  END;
END
$fn$;
