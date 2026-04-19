-- AR Bank Payments: optional includeFullyApplied on list/count; RPC for per-payment allocation breakdown.

CREATE OR REPLACE FUNCTION public.list_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL)
RETURNS TABLE (
  mercury_transaction_id uuid,
  amount numeric,
  posted_at timestamptz,
  counterparty_name text,
  note text,
  external_memo text,
  kind text,
  mercury_account_id uuid,
  raw jsonb,
  mercury_id uuid,
  consumed numeric,
  remaining_available numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kinds text[] := ARRAY[]::text[];
  v_account_ids text[] := ARRAY[]::text[];
  v_debit_ids text[] := ARRAY[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := ARRAY[]::text[];
  v_exclude_note text[] := ARRAY[]::text[];
  v_include_fully_applied boolean := false;
  o jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authorized';
  END IF;

  IF p_filter IS NOT NULL AND jsonb_typeof(p_filter) = 'object' THEN
    o := p_filter;
    IF o ? 'kinds' AND jsonb_typeof(o->'kinds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_kinds
      FROM jsonb_array_elements_text(o->'kinds');
    END IF;
    IF o ? 'accountIds' AND jsonb_typeof(o->'accountIds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_account_ids
      FROM jsonb_array_elements_text(o->'accountIds');
    END IF;
    IF o ? 'debitCardIds' AND jsonb_typeof(o->'debitCardIds') = 'array' THEN
      SELECT coalesce(array_agg(lower(trim(value::text))), ARRAY[]::text[])
      INTO v_debit_ids
      FROM jsonb_array_elements_text(o->'debitCardIds');
    END IF;
    IF o ? 'startDateYmd' AND jsonb_typeof(o->'startDateYmd') = 'string' THEN
      v_start_ymd := trim(o->>'startDateYmd');
    END IF;
    IF o ? 'excludeCounterpartyContains' AND jsonb_typeof(o->'excludeCounterpartyContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeCounterpartyContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_cp
      FROM elements;
    END IF;
    IF o ? 'excludeNoteContains' AND jsonb_typeof(o->'excludeNoteContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeNoteContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_note
      FROM elements;
    END IF;
    IF o ? 'includeFullyApplied' AND jsonb_typeof(o->'includeFullyApplied') = 'boolean' THEN
      v_include_fully_applied := (o->>'includeFullyApplied')::boolean;
    END IF;
  END IF;

  IF v_start_ymd IS NULL OR v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ymd := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  END IF;

  RETURN QUERY
  SELECT
    t.id AS mercury_transaction_id,
    t.amount::numeric,
    t.posted_at,
    t.counterparty_name,
    t.note,
    t.external_memo,
    t.kind,
    t.mercury_account_id,
    t.raw,
    t.mercury_id,
    coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0)::numeric AS consumed,
    (abs(t.amount) - coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0))::numeric AS remaining_available
  FROM public.mercury_transactions t
  WHERE t.posted_at IS NOT NULL
    AND to_char((t.posted_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    AND (cardinality(v_kinds) = 0 OR t.kind = ANY (v_kinds))
    AND (cardinality(v_account_ids) = 0 OR t.mercury_account_id::text = ANY (v_account_ids))
    AND (
      cardinality(v_debit_ids) = 0
      OR public._mercury_raw_debit_card_id_lower(t.raw) = ANY (v_debit_ids)
    )
    AND abs(t.amount) > 0
    AND (
      v_include_fully_applied
      OR (
        abs(t.amount) - coalesce((
          SELECT sum(p.amount)
          FROM public.jobs_ledger_payments p
          WHERE p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    AND NOT (
      cardinality(v_exclude_cp) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_cp) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    AND NOT (
      cardinality(v_exclude_note) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_note) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.note, ''))) > 0
      )
    )
  ORDER BY t.posted_at DESC NULLS LAST, t.id DESC;
END;
$$;

COMMENT ON FUNCTION public.list_mercury_transactions_for_bank_payments(jsonb) IS
  'Lists Mercury transactions for Jobs Bank Payments modal (filter mirrors BankingSortingConfigV1; optional substring exclusions on counterparty/note; includeFullyApplied includes zero-remainder rows). Dev/master/assistant/primary only.';

CREATE OR REPLACE FUNCTION public.count_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kinds text[] := ARRAY[]::text[];
  v_account_ids text[] := ARRAY[]::text[];
  v_debit_ids text[] := ARRAY[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := ARRAY[]::text[];
  v_exclude_note text[] := ARRAY[]::text[];
  v_include_fully_applied boolean := false;
  o jsonb;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'count_mercury_transactions_for_bank_payments: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RAISE EXCEPTION 'count_mercury_transactions_for_bank_payments: not authorized';
  END IF;

  IF p_filter IS NOT NULL AND jsonb_typeof(p_filter) = 'object' THEN
    o := p_filter;
    IF o ? 'kinds' AND jsonb_typeof(o->'kinds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_kinds
      FROM jsonb_array_elements_text(o->'kinds');
    END IF;
    IF o ? 'accountIds' AND jsonb_typeof(o->'accountIds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_account_ids
      FROM jsonb_array_elements_text(o->'accountIds');
    END IF;
    IF o ? 'debitCardIds' AND jsonb_typeof(o->'debitCardIds') = 'array' THEN
      SELECT coalesce(array_agg(lower(trim(value::text))), ARRAY[]::text[])
      INTO v_debit_ids
      FROM jsonb_array_elements_text(o->'debitCardIds');
    END IF;
    IF o ? 'startDateYmd' AND jsonb_typeof(o->'startDateYmd') = 'string' THEN
      v_start_ymd := trim(o->>'startDateYmd');
    END IF;
    IF o ? 'excludeCounterpartyContains' AND jsonb_typeof(o->'excludeCounterpartyContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeCounterpartyContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_cp
      FROM elements;
    END IF;
    IF o ? 'excludeNoteContains' AND jsonb_typeof(o->'excludeNoteContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeNoteContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_note
      FROM elements;
    END IF;
    IF o ? 'includeFullyApplied' AND jsonb_typeof(o->'includeFullyApplied') = 'boolean' THEN
      v_include_fully_applied := (o->>'includeFullyApplied')::boolean;
    END IF;
  END IF;

  IF v_start_ymd IS NULL OR v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ymd := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  END IF;

  SELECT count(*)::bigint
  INTO v_count
  FROM public.mercury_transactions t
  WHERE t.posted_at IS NOT NULL
    AND to_char((t.posted_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    AND (cardinality(v_kinds) = 0 OR t.kind = ANY (v_kinds))
    AND (cardinality(v_account_ids) = 0 OR t.mercury_account_id::text = ANY (v_account_ids))
    AND (
      cardinality(v_debit_ids) = 0
      OR public._mercury_raw_debit_card_id_lower(t.raw) = ANY (v_debit_ids)
    )
    AND abs(t.amount) > 0
    AND (
      v_include_fully_applied
      OR (
        abs(t.amount) - coalesce((
          SELECT sum(p.amount)
          FROM public.jobs_ledger_payments p
          WHERE p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    AND NOT (
      cardinality(v_exclude_cp) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_cp) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    AND NOT (
      cardinality(v_exclude_note) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_note) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.note, ''))) > 0
      )
    );

  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.count_mercury_transactions_for_bank_payments(jsonb) IS
  'Count of Mercury transactions for Jobs Accounts Receivable (same p_filter, remainder rule unless includeFullyApplied, and counterparty/note substring exclusions as list_mercury_transactions_for_bank_payments). Dev/master/assistant/primary only.';

CREATE OR REPLACE FUNCTION public.list_ar_allocations_for_mercury_transaction(p_mercury_transaction_id uuid)
RETURNS TABLE (
  payment_id uuid,
  job_id uuid,
  amount numeric,
  paid_on date,
  invoice_id uuid,
  note text,
  hcp_number text,
  job_name text,
  invoice_sequence_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: mercury transaction required';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.job_id,
    p.amount::numeric,
    p.paid_on,
    p.invoice_id,
    nullif(trim(coalesce(p.note, '')), '') AS note,
    j.hcp_number,
    j.job_name,
    inv.sequence_order AS invoice_sequence_order
  FROM public.jobs_ledger_payments p
  INNER JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = p.invoice_id
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id;
END;
$$;

COMMENT ON FUNCTION public.list_ar_allocations_for_mercury_transaction(uuid) IS
  'AR Bank Payments: jobs_ledger_payments rows linked to a Mercury transaction, with job/invoice labels (job access same as apply_mercury_bank_payment_allocations). Dev/master/assistant/primary only.';

REVOKE ALL ON FUNCTION public.list_ar_allocations_for_mercury_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ar_allocations_for_mercury_transaction(uuid) TO authenticated;
