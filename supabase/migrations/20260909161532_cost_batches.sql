SET lock_timeout = '3s';

-- v2.3196 (cost batches — audited, reversible cost reallocation for agents).
--
-- Why: moving job cost around (allocating bank transactions to jobs, repointing
-- supply-house invoices and clock sessions, adding an ESTIMATE "other charge")
-- used to mean raw SQL from an agent session — invisible intent, undo living in
-- a CSV somewhere, nothing in the app showing what moved or why. This is the
-- HR-files pattern (v2.2232) applied to job cost:
--
--   1. cost_batches / cost_batch_ops — one row per batch, one row per operation,
--      with the BEFORE image of every row the op touched. The before-image IS
--      the undo. Dev read-only; rows are written only by the definer RPCs.
--   2. cost_batch_apply(p jsonb, p_dry_run boolean) — validates and applies a
--      batch in ONE transaction. Dry run performs every write, builds the
--      summary, then rolls the writes back (nested-block exception) and
--      returns the summary — so a dry run exercises exactly the code that the
--      real apply will run. Five operation types, nothing else:
--        allocate        bank transaction → job (with an optional from_job to
--                        replace); the allocation set on a transaction can
--                        never exceed the transaction
--        supply_repoint  supply-house invoice allocation → another job
--        clock_repoint   clock session → another job (never onto a bid)
--        other_charge    an Other job charge whose description MUST start with
--                        "ESTIMATE" — the only way an estimate enters a job
--        thread_note     a dated note on the job's thread
--      Explicitly out of reach: every payments table, deletes other than the
--      allocation being replaced, any table not named above.
--   3. cost_batch_revert(p_batch_id, p_reason) — restores the before-images in
--      reverse order, marks the batch reverted, leaves a note on each touched
--      job. A batch reverts exactly once.
--   4. cost_agent role — least privilege: SELECT on the tables an agent needs
--      to PLAN a batch, EXECUTE on the two RPCs, no direct write on anything.
--      Created WITHOUT a password; set one out-of-band (never in git):
--        ALTER ROLE cost_agent WITH LOGIN PASSWORD '<generated>';
--
-- Gate inside both RPCs: a signed-in caller must be a dev (is_dev()); a
-- database-role caller (auth.uid() IS NULL — cost_agent, postgres) is allowed.
-- Read-only (training) mode is enforced by the standard statement/row blocks,
-- which fire inside SECURITY DEFINER too.
--
-- Additive and idempotent. Nothing in the client calls these yet.

-- ── 1: the audit tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 4000),
  -- where the plan came from (a file path, a doc name) — free text
  source_ref text,
  author_label text NOT NULL DEFAULT 'Cost agent',
  -- the app user the batch writes thread notes as (NULL = no notes written)
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  revert_reason text,
  op_count integer NOT NULL CHECK (op_count >= 1),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.cost_batches IS
  'Cost batches (v2.3196): one row per applied cost-reallocation batch (agent or dev). Dev read-only; written only by cost_batch_apply / cost_batch_revert. reverted_at set ⇒ every op was restored from its before-image.';

CREATE TABLE IF NOT EXISTS public.cost_batch_ops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.cost_batches(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  op_type text NOT NULL CHECK (op_type IN ('allocate','supply_repoint','clock_repoint','other_charge','thread_note')),
  -- the op as requested (ids, amounts, text)
  target jsonb NOT NULL,
  -- row images: what was there before the op (NULL for pure inserts) and what the op left
  before_image jsonb,
  after_image jsonb,
  reverted_at timestamptz,
  UNIQUE (batch_id, seq)
);

COMMENT ON TABLE public.cost_batch_ops IS
  'Cost batch operations (v2.3196): one row per op with the before-image of every row it touched — the undo. Dev read-only; written only by the definer RPCs.';

CREATE INDEX IF NOT EXISTS idx_cost_batch_ops_batch ON public.cost_batch_ops (batch_id, seq);
CREATE INDEX IF NOT EXISTS idx_cost_batches_applied ON public.cost_batches (applied_at DESC);

ALTER TABLE public.cost_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_batch_ops ENABLE ROW LEVEL SECURITY;

-- Devs read; nobody writes through the app (no INSERT/UPDATE/DELETE policies by design).
DROP POLICY IF EXISTS "Devs can read cost batches" ON public.cost_batches;
CREATE POLICY "Devs can read cost batches" ON public.cost_batches
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "Devs can read cost batch ops" ON public.cost_batch_ops;
CREATE POLICY "Devs can read cost batch ops" ON public.cost_batch_ops
  FOR SELECT USING (public.is_dev());

-- ── 2: apply ────────────────────────────────────────────────────────────────
-- Payload:
--   { "label": text, "reason": text, "source_ref"?: text,
--     "author_label"?: text (default 'Cost agent'),
--     "author_user_id"?: uuid (required when any op is a thread_note),
--     "ops": [
--       { "op": "allocate", "tx_id": uuid, "job_id": uuid, "amount": number (> 0, in dollars of the
--         transaction; stored with the transaction's sign), "note"?: text, "from_job_id"?: uuid },
--       { "op": "supply_repoint", "invoice_id": uuid, "from_job_id": uuid, "to_job_id": uuid },
--       { "op": "clock_repoint", "session_id": uuid, "to_job_id": uuid },
--       { "op": "other_charge", "job_id": uuid, "description": text (starts with "ESTIMATE"), "amount": number (>= 0) },
--       { "op": "thread_note", "job_id": uuid, "body": text (1..2000) } ] }
-- Returns the summary jsonb: { batch_id (NULL on dry run), dry_run, op_count,
--   by_job: { <job_id>: { allocated, supply, clock_sessions, other_charges, notes } },
--   ops: [ { seq, op, before, after } ] }
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
        IF upper(left(v_desc, 8)) <> 'ESTIMATE' THEN
          RAISE EXCEPTION 'op %: an other_charge from a batch must be described as an ESTIMATE (description starts with "ESTIMATE")', v_seq;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job) THEN
          RAISE EXCEPTION 'op %: job % not found', v_seq, v_job;
        END IF;
        SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_seq_order
          FROM public.jobs_ledger_materials WHERE job_id = v_job;
        INSERT INTO public.jobs_ledger_materials (job_id, description, amount, sequence_order)
          VALUES (v_job, v_desc, v_amount, v_seq_order)
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

COMMENT ON FUNCTION public.cost_batch_apply(jsonb, boolean) IS
  'Cost batches (v2.3196): validate + apply a cost-reallocation batch atomically; p_dry_run=true (default) performs and rolls back every write, returning the same summary the real apply would. Devs or database roles only.';

-- ── 3: revert ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cost_batch_revert(p_batch_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_batch record;
  v_op record;
  v_img jsonb;
  v_rep jsonb;
  n integer := 0;
  v_jobs uuid[] := ARRAY[]::uuid[];
  v_job uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'cost_batch_revert: devs only';
  END IF;
  SELECT * INTO v_batch FROM public.cost_batches WHERE id = p_batch_id;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'cost_batch_revert: batch % not found', p_batch_id;
  END IF;
  IF v_batch.reverted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cost_batch_revert: batch % was already reverted at %', p_batch_id, v_batch.reverted_at;
  END IF;

  FOR v_op IN SELECT * FROM public.cost_batch_ops WHERE batch_id = p_batch_id ORDER BY seq DESC LOOP
    IF v_op.op_type = 'allocate' THEN
      v_img := v_op.after_image->'allocation';
      IF v_op.after_image->>'action' = 'insert' THEN
        DELETE FROM public.mercury_transaction_job_allocations WHERE id = (v_img->>'id')::uuid;
      ELSE
        UPDATE public.mercury_transaction_job_allocations
          SET amount = (v_op.before_image->'allocation'->>'amount')::numeric,
              note = v_op.before_image->'allocation'->>'note'
          WHERE id = (v_img->>'id')::uuid;
      END IF;
      v_rep := v_op.before_image->'replaced';
      IF v_rep IS NOT NULL AND jsonb_typeof(v_rep) = 'object' THEN
        INSERT INTO public.mercury_transaction_job_allocations (id, mercury_transaction_id, job_id, amount, created_at, created_by, note)
          VALUES ((v_rep->>'id')::uuid, (v_rep->>'mercury_transaction_id')::uuid, (v_rep->>'job_id')::uuid,
                  (v_rep->>'amount')::numeric, COALESCE((v_rep->>'created_at')::timestamptz, now()),
                  (v_rep->>'created_by')::uuid, v_rep->>'note')
          ON CONFLICT (mercury_transaction_id, job_id) DO UPDATE
            SET amount = EXCLUDED.amount, note = EXCLUDED.note;
      END IF;
      v_job := (v_img->>'job_id')::uuid;
    ELSIF v_op.op_type = 'supply_repoint' THEN
      UPDATE public.supply_house_invoice_job_allocations
        SET job_id = (v_op.before_image->>'job_id')::uuid
        WHERE invoice_id = (v_op.after_image->>'invoice_id')::uuid
          AND job_id = (v_op.after_image->>'job_id')::uuid;
      v_job := (v_op.after_image->>'job_id')::uuid;
    ELSIF v_op.op_type = 'clock_repoint' THEN
      UPDATE public.clock_sessions
        SET job_ledger_id = (v_op.before_image->>'job_ledger_id')::uuid
        WHERE id = (v_op.after_image->>'id')::uuid;
      v_job := (v_op.after_image->>'job_ledger_id')::uuid;
    ELSIF v_op.op_type = 'other_charge' THEN
      DELETE FROM public.jobs_ledger_materials WHERE id = (v_op.after_image->>'id')::uuid;
      v_job := (v_op.after_image->>'job_id')::uuid;
    ELSIF v_op.op_type = 'thread_note' THEN
      DELETE FROM public.jobs_ledger_thread_notes WHERE id = (v_op.after_image->>'id')::uuid;
      v_job := (v_op.after_image->>'job_id')::uuid;
    END IF;
    UPDATE public.cost_batch_ops SET reverted_at = now() WHERE id = v_op.id;
    n := n + 1;
    IF v_job IS NOT NULL AND NOT (v_job = ANY (v_jobs)) THEN
      v_jobs := v_jobs || v_job;
    END IF;
  END LOOP;

  UPDATE public.cost_batches SET reverted_at = now(), revert_reason = p_reason WHERE id = p_batch_id;

  -- leave a trace on each touched job's thread (only when the batch has an author to write as)
  IF v_batch.author_user_id IS NOT NULL THEN
    FOREACH v_job IN ARRAY v_jobs LOOP
      IF EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job) THEN
        INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
          VALUES (v_job, v_batch.author_user_id,
                  left('Cost batch "' || v_batch.label || '" reverted ' || to_char(now(), 'YYYY-MM-DD') ||
                       COALESCE(' — ' || p_reason, '') || '. Every row it touched is back to its prior state.', 2000));
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('batch_id', p_batch_id, 'ops_reverted', n, 'jobs_touched', to_jsonb(v_jobs));
END
$fn$;

COMMENT ON FUNCTION public.cost_batch_revert(uuid, text) IS
  'Cost batches (v2.3196): restore every before-image of an applied batch in reverse order, mark it reverted, note each touched job. Reverts exactly once. Devs or database roles only.';

-- ── 4: grants — authenticated devs (gate inside), the agent role, nobody else ─
REVOKE ALL ON FUNCTION public.cost_batch_apply(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_batch_apply(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cost_batch_apply(jsonb, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.cost_batch_revert(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_batch_revert(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cost_batch_revert(uuid, text) TO authenticated;

-- ── 5: the least-privilege agent role ───────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cost_agent') THEN
    CREATE ROLE cost_agent LOGIN NOINHERIT;
  END IF;
END
$do$;

GRANT USAGE ON SCHEMA public TO cost_agent;
GRANT EXECUTE ON FUNCTION public.cost_batch_apply(jsonb, boolean) TO cost_agent;
GRANT EXECUTE ON FUNCTION public.cost_batch_revert(uuid, text) TO cost_agent;

-- Reads needed to PLAN a batch and to audit one. No direct write on any table:
-- every mutation goes through the two RPCs above.
GRANT SELECT ON public.cost_batches, public.cost_batch_ops TO cost_agent;
GRANT SELECT ON public.mercury_transactions, public.mercury_transaction_job_allocations TO cost_agent;
GRANT SELECT ON public.jobs_ledger, public.jobs_ledger_payments, public.jobs_ledger_invoices,
                public.jobs_ledger_materials, public.jobs_ledger_thread_notes TO cost_agent;
GRANT SELECT ON public.supply_houses, public.supply_house_invoices, public.supply_house_invoice_job_allocations TO cost_agent;
GRANT SELECT ON public.clock_sessions, public.users, public.people, public.customers TO cost_agent;

-- RLS binds cost_agent like anyone else; give it SELECT on exactly those tables.
DO $pol$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cost_batches','cost_batch_ops',
    'mercury_transactions','mercury_transaction_job_allocations',
    'jobs_ledger','jobs_ledger_payments','jobs_ledger_invoices','jobs_ledger_materials','jobs_ledger_thread_notes',
    'supply_houses','supply_house_invoices','supply_house_invoice_job_allocations',
    'clock_sessions','users','people','customers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'cost_agent reads ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO cost_agent USING (true)', 'cost_agent reads ' || t, t);
  END LOOP;
END
$pol$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
