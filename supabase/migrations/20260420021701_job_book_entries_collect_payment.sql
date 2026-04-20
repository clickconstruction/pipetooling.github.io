-- Job Book: catalog rows for Collect Payment Step 1 (optional service_type_id).
-- RLS: all authenticated can read; dev / master_technician / assistant can write.
-- RPC: subcontractor adds a fixture from Job Book + sync jobs_ledger.revenue.

CREATE TABLE public.job_book_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_label text NOT NULL,
  unit_cost numeric NOT NULL,
  service_type_id uuid REFERENCES public.service_types (id) ON DELETE SET NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT job_book_entries_work_label_not_blank CHECK (trim(work_label) <> ''),
  CONSTRAINT job_book_entries_unit_cost_non_negative CHECK (unit_cost >= 0::numeric)
);

CREATE INDEX idx_job_book_entries_service_type_sequence
  ON public.job_book_entries (service_type_id, sequence_order);
CREATE INDEX idx_job_book_entries_sequence
  ON public.job_book_entries (sequence_order);

COMMENT ON TABLE public.job_book_entries IS
  'Org-wide Job Book (Work + Cost) for field Collect Payment; optional service_type_id (NULL = all types).';

ALTER TABLE public.job_book_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job book entries"
ON public.job_book_entries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Devs masters assistants can insert job book entries"
ON public.job_book_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs masters assistants can update job book entries"
ON public.job_book_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs masters assistants can delete job book entries"
ON public.job_book_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ---------------------------------------------------------------------------
-- Certify payload: job_service_type_id for client-side Job Book filtering
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
  v_billing_customer jsonb;
  v_job_service_type_id uuid;
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

COMMENT ON FUNCTION public.get_collect_payment_certify_payload(uuid) IS
  'Subcontractor: billable fixtures + RTB invoice + flow + collect_invoice (incl. sent_to_customer_at) + billing_customer + job_service_type_id (Job Book filter).';

-- ---------------------------------------------------------------------------
-- Subcontractor: append fixture from Job Book; recompute revenue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_collect_payment_fixture_from_job_book(
  p_job_id uuid,
  p_job_book_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) IS
  'Subcontractor on RTB team job: insert one jobs_ledger_fixtures row from job_book_entries and sync jobs_ledger.revenue.';

REVOKE ALL ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) TO authenticated;
