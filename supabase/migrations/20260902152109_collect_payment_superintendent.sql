SET lock_timeout = '3s';

-- Collect Payment for superintendents (v2.2637): the field collect flow's
-- three client-callable RPCs widen their role gates from
-- ('subcontractor','helpers') to include 'superintendent'. Owner decision
-- (2026-09-02, item 1 of the follow-up list): a super running a job is often
-- the one in front of the customer at collection time.
--
-- Deliberately NARROW: only the role arrays change. Every function keeps its
-- jobs_ledger_team_members requirement on the ready-to-bill job — the Collect
-- button only appears on assigned (team-member) rows, so no project-based
-- access path is added. The office approval step
-- (approve_collect_payment_for_terminal) is untouched: money still moves only
-- after office review. Companion edge-fn changes (send-stripe-invoice,
-- update-collect-payment-stripe-customer-email) ship in the same PR and keep
-- the same team-member + active-flow checks.
--
-- Bodies are VERBATIM from the baseline with the one-line gate change each.

CREATE OR REPLACE FUNCTION "public"."get_collect_payment_certify_payload"("p_job_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_fixtures jsonb;
  v_invoice jsonb;
  v_flow jsonb;
  v_collect_invoice jsonb;
  v_billing_customer jsonb;
  v_job_service_type_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers', 'superintendent') THEN
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

  SELECT b.service_type_id INTO v_job_service_type_id
  FROM public.jobs_ledger jl
  LEFT JOIN public.bids b ON b.id = jl.bid_id
  WHERE jl.id = p_job_id;

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
    'stripe_invoice_id', i.stripe_invoice_id,
    'sent_to_customer_at', i.sent_to_customer_at
  )
  INTO v_collect_invoice
  FROM public.jobs_ledger_invoices i
  INNER JOIN public.job_collect_payment_flows f2
    ON f2.jobs_ledger_invoice_id = i.id
   AND f2.job_id = p_job_id
  LIMIT 1;

  SELECT jsonb_build_object(
    'email', NULLIF(trim(COALESCE(jl.customer_email, '')), ''),
    'name', NULLIF(trim(COALESCE(jl.customer_name, '')), '')
  )
  INTO v_billing_customer
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  RETURN jsonb_build_object(
    'fixtures', COALESCE(v_fixtures, '[]'::jsonb),
    'invoice', v_invoice,
    'flow', v_flow,
    'collect_invoice', v_collect_invoice,
    'billing_customer', COALESCE(
      v_billing_customer,
      jsonb_build_object('email', NULL, 'name', NULL)
    ),
    'job_service_type_id', v_job_service_type_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."add_collect_payment_fixture_from_job_book"("p_job_id" "uuid", "p_job_book_entry_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_entry record;
  v_job_st uuid;
  v_next_seq int;
  v_rev numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers', 'superintendent') THEN
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

  SELECT b.service_type_id INTO v_job_st
  FROM public.jobs_ledger jl
  LEFT JOIN public.bids b ON b.id = jl.bid_id
  WHERE jl.id = p_job_id;

  SELECT jbe.id, jbe.work_label, jbe.unit_cost, jbe.service_type_id
  INTO v_entry
  FROM public.job_book_entries jbe
  WHERE jbe.id = p_job_book_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('error', 'job_book_entry_not_found');
  END IF;

  IF v_entry.service_type_id IS NOT NULL
     AND (v_job_st IS DISTINCT FROM v_entry.service_type_id) THEN
    RETURN jsonb_build_object('error', 'job_book_entry_service_type_mismatch');
  END IF;

  SELECT COALESCE(MAX(f.sequence_order), -1) + 1 INTO v_next_seq
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  INSERT INTO public.jobs_ledger_fixtures (
    job_id,
    name,
    count,
    line_unit_price,
    line_description,
    sequence_order
  ) VALUES (
    p_job_id,
    trim(v_entry.work_label),
    1,
    ROUND(v_entry.unit_cost::numeric, 2),
    NULL,
    v_next_seq
  );

  SELECT ROUND(COALESCE(SUM(
    CASE
      WHEN trim(COALESCE(f.name, '')) = '' THEN 0::numeric
      ELSE
        (CASE WHEN f.count > 0 THEN f.count::numeric ELSE 1::numeric END)
        * COALESCE(f.line_unit_price, 0::numeric)
    END
  ), 0::numeric), 2)
  INTO v_rev
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  UPDATE public.jobs_ledger jl
  SET revenue = v_rev
  WHERE jl.id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'revenue', v_rev);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."submit_collect_payment_certification"("p_job_id" "uuid", "p_mode" "text", "p_correction_notes" "text" DEFAULT NULL::"text", "p_per_line_notes" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_notes text;
  v_rtb_invoice_id uuid;
  v_row public.job_collect_payment_flows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers', 'superintendent') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('clean', 'correction_requested') THEN
    RETURN jsonb_build_object('error', 'Invalid certify mode');
  END IF;

  v_notes := NULLIF(trim(COALESCE(p_correction_notes, '')), '');
  IF p_mode = 'correction_requested' AND (v_notes IS NULL OR length(v_notes) < 3) THEN
    RETURN jsonb_build_object('error', 'Describe the correction needed (at least 3 characters).');
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

  SELECT i.id INTO v_rtb_invoice_id
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT * INTO v_row FROM public.job_collect_payment_flows WHERE job_id = p_job_id FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'approved_for_terminal' THEN
      RETURN jsonb_build_object('error', 'Payment is approved for terminal. Complete collection or ask office to reset.');
    END IF;
    IF v_row.status NOT IN (
      'draft',
      'pending_dispatch',
      'terminal_completed',
      'failed',
      'cancelled'
    ) THEN
      RETURN jsonb_build_object('error', 'Invalid flow state for submit');
    END IF;

    UPDATE public.job_collect_payment_flows
    SET
      initiated_by_user_id = v_uid,
      jobs_ledger_invoice_id = v_rtb_invoice_id,
      status = 'pending_dispatch',
      certify_mode = p_mode,
      correction_notes = CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
      per_line_notes = p_per_line_notes,
      certified_at = now(),
      dispatch_reviewed_at = NULL,
      dispatch_reviewed_by = NULL,
      dispatch_notes = NULL,
      stripe_payment_intent_id = NULL,
      stripe_invoice_id = NULL,
      last_error = NULL
    WHERE job_id = p_job_id;

    RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
  END IF;

  INSERT INTO public.job_collect_payment_flows (
    job_id,
    initiated_by_user_id,
    jobs_ledger_invoice_id,
    status,
    certify_mode,
    correction_notes,
    per_line_notes,
    certified_at
  )
  VALUES (
    p_job_id,
    v_uid,
    v_rtb_invoice_id,
    'pending_dispatch',
    p_mode,
    CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
    p_per_line_notes,
    now()
  );

  RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
END;
$$;

COMMENT ON FUNCTION "public"."submit_collect_payment_certification"("p_job_id" "uuid", "p_mode" "text", "p_correction_notes" "text", "p_per_line_notes" "jsonb") IS
  'Field roles (subcontractor/helpers; +superintendent v2.2637): certify or request correction; sets flow to pending_dispatch. Requires jobs_ledger_team_members on the ready_to_bill job.';

COMMENT ON FUNCTION "public"."get_collect_payment_certify_payload"("p_job_id" "uuid") IS
  'Collect Payment certify payload for the field modal (subcontractor/helpers; +superintendent v2.2637). Requires jobs_ledger_team_members on the job.';

COMMENT ON FUNCTION "public"."add_collect_payment_fixture_from_job_book"("p_job_id" "uuid", "p_job_book_entry_id" "uuid") IS
  'Collect Payment certify step: add a fixture line from the Job Book (subcontractor/helpers; +superintendent v2.2637). Requires jobs_ledger_team_members on the job.';
