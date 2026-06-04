-- Optional per-job note on Mercury splits; replace_mercury_transaction_splits persists note from p_rows JSON.

ALTER TABLE public.mercury_transaction_job_allocations
  ADD COLUMN note text;

COMMENT ON COLUMN public.mercury_transaction_job_allocations.note IS
  'Optional memo for this job split (Mercury transaction allocation).';

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
  v_note text;
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
    v_note := NULLIF(trim(both FROM elem->>'note'), '');
    INSERT INTO public.mercury_transaction_job_allocations (
      mercury_transaction_id,
      job_id,
      amount,
      note,
      created_by
    )
    VALUES (
      p_mercury_transaction_id,
      (elem->>'job_id')::uuid,
      (elem->>'amount')::numeric(18, 4),
      v_note,
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
  'Replaces job splits; optional note per row in p_rows[]. Optional person or user attribution. Sum of split amounts must equal transaction amount when there is at least one split.';
