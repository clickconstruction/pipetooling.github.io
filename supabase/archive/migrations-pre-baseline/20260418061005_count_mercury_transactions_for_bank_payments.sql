-- Count Mercury rows eligible for Jobs Accounts Receivable modal (same filter + remainder rule as list_mercury_transactions_for_bank_payments).

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
      abs(t.amount) - coalesce((
        SELECT sum(p.amount)
        FROM public.jobs_ledger_payments p
        WHERE p.mercury_transaction_id = t.id
      ), 0)
    ) > 0.0005;

  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.count_mercury_transactions_for_bank_payments(jsonb) IS
  'Count of Mercury transactions for Jobs Accounts Receivable (same p_filter and remainder rule as list_mercury_transactions_for_bank_payments). Dev/master/assistant/primary only.';

REVOKE ALL ON FUNCTION public.count_mercury_transactions_for_bank_payments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_mercury_transactions_for_bank_payments(jsonb) TO authenticated;
