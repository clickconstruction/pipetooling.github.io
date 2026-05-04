-- Banking Accounting: bulk approve pending suggestions + bulk insert pending suggestions (single round trips).

CREATE OR REPLACE FUNCTION public.bulk_approve_accounting_label_suggestions(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_n_payload integer;
  v_n_valid integer;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  SELECT count(*)::integer INTO v_n_payload FROM jsonb_array_elements(p_items) AS _;

  IF v_n_payload = 0 THEN
    RETURN 0;
  END IF;

  IF v_n_payload > 500 THEN
    RAISE EXCEPTION 'At most 500 suggestions per request';
  END IF;

  CREATE TEMP TABLE _approve_acct_payload ON COMMIT DROP AS
  SELECT
    (elem->>'suggestion_id')::uuid AS suggestion_id,
    (elem->>'mercury_transaction_id')::uuid AS mercury_transaction_id,
    (elem->>'label_id')::uuid AS label_id
  FROM jsonb_array_elements(p_items) AS t(elem);

  IF EXISTS (
    SELECT 1 FROM _approve_acct_payload p
    WHERE p.suggestion_id IS NULL
       OR p.mercury_transaction_id IS NULL
       OR p.label_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Each item must include suggestion_id, mercury_transaction_id, and label_id';
  END IF;

  SELECT count(*)::integer INTO v_n_valid
  FROM _approve_acct_payload p
  INNER JOIN public.mercury_accounting_label_suggestions s
    ON s.id = p.suggestion_id
   AND s.mercury_transaction_id = p.mercury_transaction_id
   AND s.status = 'pending';

  IF v_n_valid IS DISTINCT FROM v_n_payload THEN
    RAISE EXCEPTION 'One or more suggestions are missing, not pending, or transaction id mismatch';
  END IF;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  SELECT p.mercury_transaction_id, p.label_id
  FROM _approve_acct_payload p
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  UPDATE public.mercury_accounting_label_suggestions s
  SET
    status = 'approved',
    final_label_id = p.label_id,
    resolved_at = now(),
    resolved_by = v_uid
  FROM _approve_acct_payload p
  WHERE s.id = p.suggestion_id
    AND s.status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$fn$;

COMMENT ON FUNCTION public.bulk_approve_accounting_label_suggestions(jsonb) IS
  'Banking staff: atomically upsert drag-sort assignments and mark accounting label suggestions approved (max 500).';

CREATE OR REPLACE FUNCTION public.bulk_insert_accounting_label_suggestions(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_n_payload integer;
  v_inserted integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT count(*)::integer INTO v_n_payload FROM jsonb_array_elements(p_rows) AS _;

  IF v_n_payload = 0 THEN
    RETURN 0;
  END IF;

  IF v_n_payload > 2000 THEN
    RAISE EXCEPTION 'At most 2000 suggestion rows per request';
  END IF;

  INSERT INTO public.mercury_accounting_label_suggestions (
    mercury_transaction_id,
    rule_id,
    suggested_label_id,
    status
  )
  SELECT
    (elem->>'mercury_transaction_id')::uuid,
    (elem->>'rule_id')::uuid,
    (elem->>'suggested_label_id')::uuid,
    'pending'::text
  FROM jsonb_array_elements(p_rows) AS t(elem)
  WHERE (elem->>'mercury_transaction_id') IS NOT NULL
    AND (elem->>'rule_id') IS NOT NULL
    AND (elem->>'suggested_label_id') IS NOT NULL
  ON CONFLICT (mercury_transaction_id) WHERE (status = 'pending') DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$fn$;

COMMENT ON FUNCTION public.bulk_insert_accounting_label_suggestions(jsonb) IS
  'Banking staff: insert pending accounting label suggestions in bulk; skips conflicts (max 2000).';

REVOKE ALL ON FUNCTION public.bulk_approve_accounting_label_suggestions(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_insert_accounting_label_suggestions(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bulk_approve_accounting_label_suggestions(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_insert_accounting_label_suggestions(jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bulk_approve_accounting_label_suggestions(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_insert_accounting_label_suggestions(jsonb) TO service_role;
