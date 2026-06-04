-- Link Mercury card transactions to supply-house invoices (alternative to job splits).
-- When a card charge pays one or more supply-house invoices, the operator links the
-- transaction to those invoices instead of splitting it across jobs. The invoice's own
-- job allocations (supply_house_invoice_job_allocations) remain the source of truth for
-- job costing, so we do NOT write mercury_transaction_job_allocations rows here (no
-- double-counting). An invoice-linked transaction counts as "resolved" for the Job Tally
-- unlinked/stale surfaces, mirroring how a job allocation resolves it.

-- ============================================================================
-- Table
-- ============================================================================

CREATE TABLE public.mercury_transaction_supply_house_invoice_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mtshil_tx_invoice_unique UNIQUE (mercury_transaction_id, invoice_id)
);

CREATE INDEX mtshil_mercury_transaction_id_idx
  ON public.mercury_transaction_supply_house_invoice_links (mercury_transaction_id);
CREATE INDEX mtshil_invoice_id_idx
  ON public.mercury_transaction_supply_house_invoice_links (invoice_id);

COMMENT ON TABLE public.mercury_transaction_supply_house_invoice_links IS
  'Links a Mercury card transaction to one or more supply_house_invoices it paid. Resolves the transaction for Job Tally without writing job allocations (invoice carries its own job allocations).';

ALTER TABLE public.mercury_transaction_supply_house_invoice_links ENABLE ROW LEVEL SECURITY;

-- SELECT: dev/master/assistant (Supply Houses scope), or the linked-card holder of the tx.
CREATE POLICY "mtshil staff select"
  ON public.mercury_transaction_supply_house_invoice_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mtshil linked user select"
  ON public.mercury_transaction_supply_house_invoice_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mercury_transactions t
      INNER JOIN public.mercury_debit_card_user_links l
        ON l.user_id = auth.uid()
        AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
      WHERE t.id = mercury_transaction_id
    )
  );

-- Writes only via SECURITY DEFINER RPCs below.
GRANT SELECT ON public.mercury_transaction_supply_house_invoice_links TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_transaction_supply_house_invoice_links FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_transaction_supply_house_invoice_links FROM anon;
GRANT ALL ON public.mercury_transaction_supply_house_invoice_links TO service_role;

-- ============================================================================
-- Helper: replace links for a transaction (shared body, caller pre-authorizes)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._replace_mercury_transaction_invoice_links(
  p_mercury_transaction_id uuid,
  p_invoice_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ids uuid[] := COALESCE(p_invoice_ids, ARRAY[]::uuid[]);
BEGIN
  -- Validate every invoice exists before mutating.
  FOREACH v_id IN ARRAY v_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.supply_house_invoices si WHERE si.id = v_id) THEN
      RAISE EXCEPTION '_replace_mercury_transaction_invoice_links: invalid invoice %', v_id;
    END IF;
  END LOOP;

  DELETE FROM public.mercury_transaction_supply_house_invoice_links
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.mercury_transaction_supply_house_invoice_links (
    mercury_transaction_id,
    invoice_id,
    created_by
  )
  SELECT p_mercury_transaction_id, d.invoice_id, auth.uid()
  FROM (SELECT DISTINCT unnest(v_ids) AS invoice_id) d;
END;
$$;

REVOKE ALL ON FUNCTION public._replace_mercury_transaction_invoice_links(uuid, uuid[]) FROM PUBLIC;

-- ============================================================================
-- Self-service: cardholder links invoices on their own linked-card transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_mercury_transaction_invoice_links_for_my_linked_card(
  p_mercury_transaction_id uuid,
  p_invoice_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw jsonb;
  v_card uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_for_my_linked_card: not authenticated';
  END IF;

  SELECT t.raw INTO v_raw FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_for_my_linked_card: transaction not found';
  END IF;

  v_card := public.mercury_debit_card_id_from_raw(v_raw);
  IF v_card IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_for_my_linked_card: transaction has no debit card on file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_debit_card_user_links l
    WHERE l.user_id = auth.uid() AND l.mercury_debit_card_id = v_card
  ) THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_for_my_linked_card: not authorized for this transaction';
  END IF;

  PERFORM public._replace_mercury_transaction_invoice_links(p_mercury_transaction_id, p_invoice_ids);
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_transaction_invoice_links_for_my_linked_card(uuid, uuid[]) IS
  'Card-linked user: replace the supply-house invoice links for a transaction on their linked debit card.';

REVOKE ALL ON FUNCTION public.replace_mercury_transaction_invoice_links_for_my_linked_card(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_transaction_invoice_links_for_my_linked_card(uuid, uuid[]) TO authenticated;

-- ============================================================================
-- Staff: dev/master/assistant links invoices on any transaction (stale follow-up
-- and Banking admin flows). Invoices are a back-office concept gated to these roles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_mercury_transaction_invoice_links_as_staff(
  p_mercury_transaction_id uuid,
  p_invoice_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_as_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ) THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_as_staff: not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'replace_mercury_transaction_invoice_links_as_staff: transaction not found';
  END IF;

  PERFORM public._replace_mercury_transaction_invoice_links(p_mercury_transaction_id, p_invoice_ids);
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_transaction_invoice_links_as_staff(uuid, uuid[]) IS
  'Dev/master/assistant: replace the supply-house invoice links for any Mercury transaction.';

REVOKE ALL ON FUNCTION public.replace_mercury_transaction_invoice_links_as_staff(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_transaction_invoice_links_as_staff(uuid, uuid[]) TO authenticated;

-- ============================================================================
-- Search supply-house invoices to link to a transaction.
-- Authorized for staff or the transaction's linked-card holder. Orders invoices
-- whose supply house matches the transaction counterparty first, then unpaid, then
-- newest. already_linked marks invoices currently linked to this transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_supply_house_invoices_for_tally_link(
  p_mercury_transaction_id uuid,
  search_text text DEFAULT ''
)
RETURNS TABLE (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric,
  is_paid boolean,
  purchase_order_number text,
  link text,
  supply_house_id uuid,
  supply_house_name text,
  counterparty_match boolean,
  already_linked boolean,
  job_allocation_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_counterparty text;
  v_authorized boolean := false;
  v_search text := NULLIF(trim(both FROM COALESCE(search_text, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_supply_house_invoices_for_tally_link: not authenticated';
  END IF;

  SELECT t.counterparty_name INTO v_counterparty
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'list_supply_house_invoices_for_tally_link: transaction not found';
  END IF;

  -- Authorize: staff role, or linked-card holder of this transaction.
  v_authorized := EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  ) OR EXISTS (
    SELECT 1
    FROM public.mercury_transactions t
    INNER JOIN public.mercury_debit_card_user_links l
      ON l.user_id = auth.uid()
      AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    WHERE t.id = p_mercury_transaction_id
  );

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'list_supply_house_invoices_for_tally_link: not authorized';
  END IF;

  RETURN QUERY
  SELECT
    si.id AS invoice_id,
    si.invoice_number,
    si.invoice_date,
    si.due_date,
    si.amount,
    si.is_paid,
    si.purchase_order_number,
    si.link,
    sh.id AS supply_house_id,
    sh.name::text AS supply_house_name,
    (
      v_counterparty IS NOT NULL
      AND v_counterparty <> ''
      AND (
        sh.name ILIKE '%' || v_counterparty || '%'
        OR v_counterparty ILIKE '%' || sh.name || '%'
      )
    ) AS counterparty_match,
    EXISTS (
      SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il
      WHERE il.mercury_transaction_id = p_mercury_transaction_id
        AND il.invoice_id = si.id
    ) AS already_linked,
    alloc.job_allocation_summary
  FROM public.supply_house_invoices si
  INNER JOIN public.supply_houses sh ON sh.id = si.supply_house_id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(' ', concat_ws(' · ', j.hcp_number, j.job_name), '(' || round(a.pct)::text || '%)'),
      '; ' ORDER BY a.pct DESC NULLS LAST
    ) AS job_allocation_summary
    FROM public.supply_house_invoice_job_allocations a
    INNER JOIN public.jobs_ledger j ON j.id = a.job_id
    WHERE a.invoice_id = si.id
  ) alloc ON true
  WHERE (
    v_search IS NULL
    OR si.invoice_number ILIKE '%' || v_search || '%'
    OR sh.name ILIKE '%' || v_search || '%'
    OR COALESCE(si.purchase_order_number, '') ILIKE '%' || v_search || '%'
  )
  ORDER BY
    EXISTS (
      SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il
      WHERE il.mercury_transaction_id = p_mercury_transaction_id AND il.invoice_id = si.id
    ) DESC,
    (
      v_counterparty IS NOT NULL
      AND v_counterparty <> ''
      AND (sh.name ILIKE '%' || v_counterparty || '%' OR v_counterparty ILIKE '%' || sh.name || '%')
    ) DESC,
    si.is_paid ASC,
    si.invoice_date DESC NULLS LAST,
    si.invoice_number ASC
  LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.list_supply_house_invoices_for_tally_link(uuid, text) IS
  'Search supply-house invoices to link to a Mercury transaction (staff or the linked-card holder). Counterparty-matched and unpaid invoices first; already_linked flags current links.';

REVOKE ALL ON FUNCTION public.list_supply_house_invoices_for_tally_link(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_supply_house_invoices_for_tally_link(uuid, text) TO authenticated;
