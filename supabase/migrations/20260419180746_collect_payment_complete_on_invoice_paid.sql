-- Hosted invoice collect payment: complete flow on invoice.paid; expose collect_invoice for step 3.

-- ---------------------------------------------------------------------------
-- RPC: complete collect payment flow when Stripe invoice is paid (webhook)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_job_collect_payment_flow_for_invoice(
  p_stripe_invoice_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sid text := NULLIF(trim(COALESCE(p_stripe_invoice_id, '')), '');
  v_updated int;
BEGIN
  IF v_sid IS NULL OR v_sid = '' THEN
    RETURN jsonb_build_object('error', 'missing stripe invoice id');
  END IF;

  UPDATE public.job_collect_payment_flows
  SET
    status = 'terminal_completed',
    last_error = NULL
  WHERE trim(stripe_invoice_id) = v_sid
    AND status = 'approved_for_terminal';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('error', 'no matching flow', 'applied', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'applied', true);
END;
$$;

COMMENT ON FUNCTION public.complete_job_collect_payment_flow_for_invoice(text) IS
  'Service role: mark job_collect_payment_flows terminal_completed when hosted Stripe invoice is paid.';

REVOKE ALL ON FUNCTION public.complete_job_collect_payment_flow_for_invoice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_job_collect_payment_flow_for_invoice(text) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: certify payload — add collect_invoice (flow jobs_ledger row, billed + hosted URL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_collect_payment_certify_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_fixtures jsonb;
  v_invoice jsonb;
  v_flow jsonb;
  v_collect_invoice jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS DISTINCT FROM 'subcontractor' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sf.id,
        'name', sf.name,
        'count', sf.count,
        'line_unit_price', sf.line_unit_price,
        'line_description', sf.line_description,
        'sequence_order', sf.sequence_order
      )
      ORDER BY sf.sequence_order
    ),
    '[]'::jsonb
  )
  INTO v_fixtures
  FROM public.jobs_ledger_fixtures sf
  WHERE sf.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', i.id,
    'amount', i.amount,
    'status', i.status,
    'sequence_order', i.sequence_order,
    'estimated_bill_date', i.estimated_bill_date
  )
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT to_jsonb(f.*)
  INTO v_flow
  FROM public.job_collect_payment_flows f
  WHERE f.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', i.id,
    'amount', i.amount,
    'status', i.status,
    'hosted_invoice_url', i.hosted_invoice_url,
    'stripe_invoice_id', i.stripe_invoice_id
  )
  INTO v_collect_invoice
  FROM public.jobs_ledger_invoices i
  INNER JOIN public.job_collect_payment_flows f2
    ON f2.jobs_ledger_invoice_id = i.id
   AND f2.job_id = p_job_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'fixtures', COALESCE(v_fixtures, '[]'::jsonb),
    'invoice', v_invoice,
    'flow', v_flow,
    'collect_invoice', v_collect_invoice
  );
END;
$$;

COMMENT ON FUNCTION public.get_collect_payment_certify_payload(uuid) IS
  'Subcontractor: billable fixtures + RTB invoice + flow + collect_invoice (hosted URL for dispatch-approved line).';
