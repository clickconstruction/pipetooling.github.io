SET lock_timeout = '3s';

-- ensure_single_ready_to_bill_invoice_for_job: a fully-allocated remainder is
-- success, not an error.
--
-- The primary-resync branch (an is_primary_rtb_bundle row already exists)
-- handled v_unalloc = 0 by UPDATEing the primary to $0.00 and returning
--   {error: 'Nothing left to bill; invoice amount would be zero'}
-- Reached whenever a segment/partial invoice consumes the whole remainder
-- (Taunya, job 978, 2026-08-28): the caller's invoice was already written, but
-- the client threw on the envelope — error banner, no refetch, and a zombie
-- $0.00 "auto" draft left in the invoice list.
--
-- Fix: when the remainder hits zero and the primary is a never-sent draft
-- (the Stripe-finalized guard above already returned for sent ones), DELETE it
-- and return {ok: true, fully_allocated: true, amount: 0, primary_deleted:
-- true}. A plain DELETE is exactly what delete_ready_to_bill_invoice does for
-- RTB drafts — FKs release references (payments SET NULL, fixtures unbill).
--
-- The primary-absent zero-remainder branches keep their error envelopes —
-- Bill Customer's ensure-on-open relies on them, and the client's
-- ensureRemainderResyncOutcome treats them as benign where a resync follows an
-- invoice write. Everything else is byte-identical to the previous definition
-- (20260730221500_ensure_rtb_primary_resync_math.sql).

CREATE OR REPLACE FUNCTION "public"."ensure_single_ready_to_bill_invoice_for_job"("p_job_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  j RECORD;
  v_allocated numeric(12, 2);
  v_unalloc numeric(12, 2);
  v_primary_count integer;
  v_rtb_count integer;
  v_max_seq integer;
  v_inv_id uuid;
  v_inv_amount numeric(12, 2);
  v_stripe_id text;
  v_hosted text;
  v_est date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.id,
         jl.status,
         jl.revenue,
         jl.payments_made,
         jl.last_bill_date,
         jl.master_user_id
  INTO j
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF j.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF j.status IS DISTINCT FROM 'ready_to_bill' THEN
    RETURN jsonb_build_object('error', 'Job must be in Ready to Bill');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = auth.uid() AND ma.assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = j.master_user_id AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- v2.1134: the never-sent primary remainder bundle is the row this function
  -- RESIZES — it must not count against the remainder it is being resized to.
  SELECT COALESCE(SUM(i.amount), 0)::numeric(12, 2)
  INTO v_allocated
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status IN ('ready_to_bill', 'billed')
    AND NOT (i.status = 'ready_to_bill' AND i.is_primary_rtb_bundle IS TRUE);

  v_unalloc := GREATEST(
    0::numeric(12, 2),
    COALESCE(j.revenue, 0)::numeric(12, 2)
      - COALESCE(j.payments_made, 0)::numeric(12, 2)
      - v_allocated
  );

  SELECT COUNT(*)::integer
  INTO v_primary_count
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
    AND i.is_primary_rtb_bundle IS TRUE;

  IF v_primary_count > 1 THEN
    RETURN jsonb_build_object(
      'error',
      'Multiple primary remainder Ready-to-Bill rows exist for this job; fix is_primary_rtb_bundle so only one is true.'
    );
  END IF;

  IF v_primary_count = 0 THEN
    IF v_unalloc > 0::numeric(12, 2) THEN
      SELECT COUNT(*)::integer
      INTO v_rtb_count
      FROM public.jobs_ledger_invoices i
      WHERE i.job_id = p_job_id
        AND i.status = 'ready_to_bill';

      IF v_rtb_count = 1 THEN
        SELECT i.id, i.amount, i.stripe_invoice_id, i.hosted_invoice_url
        INTO v_inv_id, v_inv_amount, v_stripe_id, v_hosted
        FROM public.jobs_ledger_invoices i
        WHERE i.job_id = p_job_id
          AND i.status = 'ready_to_bill'
        LIMIT 1;

        IF v_inv_amount = v_unalloc THEN
          IF v_stripe_id IS NOT NULL AND trim(v_stripe_id) <> '' AND v_hosted IS NOT NULL AND trim(v_hosted) <> '' THEN
            UPDATE public.jobs_ledger_invoices
            SET is_primary_rtb_bundle = true
            WHERE id = v_inv_id;

            RETURN jsonb_build_object(
              'ok', true,
              'invoice_id', v_inv_id,
              'amount', v_inv_amount,
              'created', false
            );
          END IF;

          UPDATE public.jobs_ledger_invoices
          SET amount = v_unalloc,
              is_primary_rtb_bundle = true
          WHERE id = v_inv_id;

          RETURN jsonb_build_object(
            'ok', true,
            'invoice_id', v_inv_id,
            'amount', v_unalloc,
            'created', false
          );
        END IF;
      END IF;

      SELECT COALESCE(MAX(i.sequence_order), -1) + 1
      INTO v_max_seq
      FROM public.jobs_ledger_invoices i
      WHERE i.job_id = p_job_id;

      v_est := NULL;
      IF j.last_bill_date IS NOT NULL AND trim(j.last_bill_date::text) <> '' THEN
        BEGIN
          v_est := j.last_bill_date::date;
        EXCEPTION WHEN OTHERS THEN
          v_est := NULL;
        END;
      END IF;

      INSERT INTO public.jobs_ledger_invoices (
        job_id,
        amount,
        status,
        sequence_order,
        estimated_bill_date,
        is_primary_rtb_bundle
      )
      VALUES (
        p_job_id,
        v_unalloc,
        'ready_to_bill',
        v_max_seq,
        v_est,
        true
      )
      RETURNING id INTO v_inv_id;

      RETURN jsonb_build_object(
        'ok', true,
        'invoice_id', v_inv_id,
        'amount', v_unalloc,
        'created', true
      );
    END IF;

    SELECT COUNT(*)::integer
    INTO v_rtb_count
    FROM public.jobs_ledger_invoices i
    WHERE i.job_id = p_job_id
      AND i.status = 'ready_to_bill';

    IF v_rtb_count > 0 THEN
      RETURN jsonb_build_object(
        'error',
        'No remainder to bill on the job bundle; use Bill Customer from a partial invoice row or adjust amounts.'
      );
    END IF;

    RETURN jsonb_build_object('error', 'Nothing left to bill for this job');
  END IF;

  SELECT i.id, i.amount, i.stripe_invoice_id, i.hosted_invoice_url
  INTO v_inv_id, v_inv_amount, v_stripe_id, v_hosted
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
    AND i.is_primary_rtb_bundle IS TRUE
  LIMIT 1;

  IF v_stripe_id IS NOT NULL AND trim(v_stripe_id) <> '' AND v_hosted IS NOT NULL AND trim(v_hosted) <> '' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'invoice_id', v_inv_id,
      'amount', v_inv_amount,
      'created', false
    );
  END IF;

  IF v_unalloc > 0::numeric(12, 2) THEN
    UPDATE public.jobs_ledger_invoices
    SET amount = v_unalloc,
        is_primary_rtb_bundle = true
    WHERE id = v_inv_id;

    RETURN jsonb_build_object(
      'ok', true,
      'invoice_id', v_inv_id,
      'amount', v_unalloc,
      'created', false
    );
  END IF;

  -- Remainder fully allocated to real invoices: the never-sent elastic
  -- primary has nothing left to carry. Delete it instead of parking a $0.00
  -- draft and calling the caller's successful invoice write an error.
  DELETE FROM public.jobs_ledger_invoices
  WHERE id = v_inv_id
    AND status = 'ready_to_bill';

  RETURN jsonb_build_object(
    'ok', true,
    'fully_allocated', true,
    'amount', 0,
    'primary_deleted', true
  );
END;
$$;

COMMENT ON FUNCTION "public"."ensure_single_ready_to_bill_invoice_for_job"("p_job_id" "uuid") IS
  'Keeps the elastic primary Ready-to-Bill remainder bundle in sync: resizes it to revenue − payments − other RTB/billed rows, creates it when missing and a remainder exists, and (since 20260828170937) DELETES a never-sent primary when the remainder is fully allocated, returning {ok, fully_allocated} instead of an error.';
