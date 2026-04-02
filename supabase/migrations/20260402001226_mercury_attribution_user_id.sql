-- Mercury attribution: optional auth user (Direction C), XOR with legacy person_id.

ALTER TABLE public.mercury_transaction_attributions
  ADD COLUMN user_id uuid REFERENCES auth.users (id);

CREATE INDEX mercury_transaction_attributions_user_id_idx
  ON public.mercury_transaction_attributions (user_id);

ALTER TABLE public.mercury_transaction_attributions
  ADD CONSTRAINT mercury_transaction_attributions_person_xor_user
  CHECK (NOT (person_id IS NOT NULL AND user_id IS NOT NULL));

COMMENT ON COLUMN public.mercury_transaction_attributions.user_id IS
  'Optional auth user attribution (alternative to person_id).';

COMMENT ON TABLE public.mercury_transaction_attributions IS
  'Optional person or user attribution for a Mercury transaction (person_id XOR user_id).';

DROP FUNCTION IF EXISTS public.replace_mercury_transaction_splits(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.replace_mercury_transaction_splits(
  p_mercury_transaction_id uuid,
  p_rows jsonb,
  p_person_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_amount numeric(18, 4);
  v_sum numeric(18, 4);
  v_len int;
  elem jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: not authorized';
  END IF;

  IF p_person_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: set at most one of person_id or user_id';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: p_rows must be a JSON array';
  END IF;

  SELECT t.amount INTO v_tx_amount
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: transaction not found';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: allocation sum must equal transaction amount';
  END IF;

  DELETE FROM public.mercury_transaction_job_allocations
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.mercury_transaction_job_allocations (
      mercury_transaction_id,
      job_id,
      amount,
      created_by
    )
    VALUES (
      p_mercury_transaction_id,
      (elem->>'job_id')::uuid,
      (elem->>'amount')::numeric(18, 4),
      auth.uid()
    );
  END LOOP;

  IF p_person_id IS NULL AND p_user_id IS NULL THEN
    DELETE FROM public.mercury_transaction_attributions
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  ELSE
    INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
    VALUES (p_mercury_transaction_id, p_person_id, p_user_id)
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET
      person_id = EXCLUDED.person_id,
      user_id = EXCLUDED.user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid, uuid) IS
  'Replaces job splits; optional person or user attribution (mutually exclusive). Sum of split amounts must equal transaction amount when there is at least one split.';

REVOKE ALL ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_users_for_banking_attribution()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.archived_at IS NULL
    AND u.role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'subcontractor',
      'primary',
      'superintendent',
      'master',
      'owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.users caller
      WHERE caller.id = auth.uid()
        AND caller.role IN ('dev', 'master_technician', 'assistant')
    )
  ORDER BY u.name;
$$;

REVOKE ALL ON FUNCTION public.list_users_for_banking_attribution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_for_banking_attribution() TO authenticated;

COMMENT ON FUNCTION public.list_users_for_banking_attribution() IS
  'Returns non-archived users for Mercury attribution (dev, master, assistant callers). SECURITY DEFINER.';
