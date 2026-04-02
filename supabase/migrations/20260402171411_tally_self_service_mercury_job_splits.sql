-- Tally self-service: linked-card holders can replace job splits only (no attribution changes).
-- Extend list_my_linked_mercury_transactions_for_tally with raw + job_splits for the allocations modal.
-- Subcontractor job search restricted to team jobs.

CREATE OR REPLACE FUNCTION public.replace_mercury_job_splits_for_my_linked_card(
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
  v_role text;
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: not authenticated';
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: user not found';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: p_rows must be a JSON array';
  END IF;

  SELECT t.amount, t.raw INTO v_tx_amount, v_raw
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: transaction not found';
  END IF;

  v_card := public.mercury_debit_card_id_from_raw(v_raw);
  IF v_card IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: transaction has no debit card on file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_debit_card_user_links l
    WHERE l.user_id = auth.uid() AND l.mercury_debit_card_id = v_card
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: not authorized for this transaction';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: allocation sum must equal transaction amount';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_job := (elem->>'job_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_job) THEN
      RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: invalid job';
    END IF;
    IF v_role = 'subcontractor' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = v_job AND jtm.user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: job not on your team';
      END IF;
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

COMMENT ON FUNCTION public.replace_mercury_job_splits_for_my_linked_card(uuid, jsonb) IS
  'Card-linked user: replace job splits for a transaction on their linked debit card; does not change attributions. Subcontractors: jobs must be on their team.';

REVOKE ALL ON FUNCTION public.replace_mercury_job_splits_for_my_linked_card(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_job_splits_for_my_linked_card(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign(search_text text DEFAULT '')
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    COALESCE(jl.hcp_number, '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'subcontractor'
    )
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid()
    )
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) IS
  'Job search for Tally Mercury splits; subcontractors limited to jobs_ledger_team_members.';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) TO authenticated;

DROP FUNCTION IF EXISTS public.list_my_linked_mercury_transactions_for_tally();

CREATE OR REPLACE FUNCTION public.list_my_linked_mercury_transactions_for_tally()
RETURNS TABLE (
  mercury_transaction_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  person_label text,
  jobs_summary text,
  mercury_account_id uuid,
  currency text,
  mercury_id uuid,
  raw jsonb,
  job_splits jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_my_linked_mercury_transactions_for_tally: not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    COALESCE(ppl.name, u_attr.name, u_self.name)::text AS person_label,
    jobs.jobs_summary,
    t.mercury_account_id,
    t.currency,
    t.mercury_id,
    t.raw,
    COALESCE(splits.job_splits, '[]'::jsonb) AS job_splits
  FROM public.mercury_transactions t
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.user_id = auth.uid()
    AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u_self ON u_self.id = auth.uid()
  LEFT JOIN public.mercury_transaction_attributions a
    ON a.mercury_transaction_id = t.id
  LEFT JOIN public.people ppl ON ppl.id = a.person_id
  LEFT JOIN public.users u_attr ON u_attr.id = a.user_id
  LEFT JOIN LATERAL (
    SELECT
      string_agg(
        concat_ws(' · ', j.hcp_number, j.job_name),
        '; ' ORDER BY j.hcp_number NULLS LAST, j.job_name NULLS LAST
      ) AS jobs_summary
    FROM public.mercury_transaction_job_allocations m
    INNER JOIN public.jobs_ledger j ON j.id = m.job_id
    WHERE m.mercury_transaction_id = t.id
  ) jobs ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'job_id', m.job_id,
            'amount', m.amount,
            'note', m.note,
            'hcp_number', j.hcp_number,
            'job_name', j.job_name
          )
          ORDER BY j.hcp_number NULLS LAST, j.job_name NULLS LAST
        ),
        '[]'::jsonb
      ) AS job_splits
    FROM public.mercury_transaction_job_allocations m
    INNER JOIN public.jobs_ledger j ON j.id = m.job_id
    WHERE m.mercury_transaction_id = t.id
  ) splits ON true
  ORDER BY t.posted_at DESC NULLS LAST, t.id ASC;
END;
$$;

COMMENT ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() IS
  'Linked-card transactions for Tally: includes raw and job_splits json for self-service allocation UI.';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() TO authenticated;
