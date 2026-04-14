-- Ready-to-Bill: allow multiple RTB rows; only the primary remainder line is auto-synced by ensure.

CREATE OR REPLACE FUNCTION public.ensure_single_ready_to_bill_invoice_for_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

  SELECT COALESCE(SUM(i.amount), 0)::numeric(12, 2)
  INTO v_allocated
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status IN ('ready_to_bill', 'billed');

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

  UPDATE public.jobs_ledger_invoices
  SET amount = v_unalloc,
      is_primary_rtb_bundle = true
  WHERE id = v_inv_id;

  IF v_unalloc > 0::numeric(12, 2) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'invoice_id', v_inv_id,
      'amount', v_unalloc,
      'created', false
    );
  END IF;

  RETURN jsonb_build_object('error', 'Nothing left to bill; invoice amount would be zero');
END;
$$;

COMMENT ON FUNCTION public.ensure_single_ready_to_bill_invoice_for_job(uuid) IS
  'Syncs the single primary remainder ready_to_bill row (is_primary_rtb_bundle true) to unallocated job balance. Partial RTB rows stay fixed; never updates their amounts. Creates the primary row when missing and balance remains. Errors if more than one primary RTB row.';

REVOKE ALL ON FUNCTION public.ensure_single_ready_to_bill_invoice_for_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_single_ready_to_bill_invoice_for_job(uuid) TO authenticated;
