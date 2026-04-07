-- Staff Mercury split save: align with search (20270408152000). Dev/master/assistant assigning on a
-- subcontractor's linked card may save splits to any jobs_ledger row; jobs_ledger_team_members is not
-- required per job. staff_can_view_user_for_tally_followup, card link, sum = amount, and valid job_id remain.

CREATE OR REPLACE FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(
  p_for_user_id uuid,
  p_mercury_transaction_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_amount numeric(18, 4);
  v_raw jsonb;
  v_card uuid;
  v_sum numeric(18, 4);
  v_len int;
  elem jsonb;
  v_note text;
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized';
  END IF;

  IF NOT public.staff_can_view_user_for_tally_followup(auth.uid(), p_for_user_id) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized for this user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_for_user_id) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: target user not found';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: p_rows must be a JSON array';
  END IF;

  SELECT t.amount, t.raw INTO v_tx_amount, v_raw
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: transaction not found';
  END IF;

  v_card := public.mercury_debit_card_id_from_raw(v_raw);
  IF v_card IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: transaction has no debit card on file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_debit_card_user_links l
    WHERE l.user_id = p_for_user_id AND l.mercury_debit_card_id = v_card
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized for this transaction';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: allocation sum must equal transaction amount';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_job := (elem->>'job_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_job) THEN
      RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: invalid job';
    END IF;
  END LOOP;

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
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) IS
  'Dev/master/assistant: replace job splits for a Mercury tx on p_for_user_id''s linked card if staff_can_view_user_for_tally_followup. Any jobs_ledger job_id is allowed (subcontractor targets are not team-gated).';

REVOKE ALL ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) TO authenticated;
