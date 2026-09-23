SET lock_timeout = '3s';

-- ensure_single_ready_to_bill_invoice_for_job: the remainder nets each open
-- line to what is still unpaid on it (v2.3775).
--
-- v_allocated summed the FACE amount of every ready_to_bill + billed line (the
-- never-sent primary excluded), and v_unalloc subtracted that AND the job's
-- payments_made. payments_made holds every payment on the job — including the
-- ones applied to a billed line that is still open — so a partly paid line
-- was subtracted twice: once as a payment, once as a bill.
--
-- Taunya, job 978 (Springtown HVAC), 2026-09-23: $3,630 bid, $2,999 paid,
-- one $1,072.50 billed line with $1,018.87 applied to it. 3,630 − 2,999 −
-- 1,072.50 < 0 → GREATEST(0, …) = 0 → "Nothing left to bill for this job",
-- with $577.37 actually unbilled (the line's unpaid $53.63 is all that stands
-- against the job).
--
-- Fix: v_allocated sums GREATEST(0, amount − Σ payments applied to that line)
-- over the same rows. Unlinked payments and payments on paid lines still
-- reduce the remainder once, through payments_made. Everything else is
-- byte-identical to the previous definition (20260828170937). The client
-- twins (src/lib/billing/openLineAllocation.ts and its callers) net the same
-- way; change one, change the other.

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
  -- v2.3775: each open line counts for what is still UNPAID on it. payments_made
  -- already holds every payment on the job, the ones applied to a still-open
  -- billed line included, so a line's face amount would subtract the paid part
  -- twice (job 978: $1,072.50 billed, $1,018.87 applied → read "Nothing left").
  SELECT COALESCE(
           SUM(
             GREATEST(
               0::numeric(12, 2),
               COALESCE(i.amount, 0)::numeric(12, 2)
                 - COALESCE((
                     SELECT SUM(p.amount)
                     FROM public.jobs_ledger_payments p
                     WHERE p.invoice_id = i.id
                       AND p.job_id = i.job_id
                   ), 0)::numeric(12, 2)
             )
           ),
           0
         )::numeric(12, 2)
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
  'Keeps the elastic primary Ready-to-Bill remainder bundle in sync: resizes it to revenue − payments − other RTB/billed rows (each net of the payments applied to it, since 20260923233000), creates it when missing and a remainder exists, and (since 20260828170937) DELETES a never-sent primary when the remainder is fully allocated, returning {ok, fully_allocated} instead of an error.';
