-- Add mercury_account_nickname to list_my_linked_mercury_transactions_for_tally (Assign to jobs modal labels).
DROP FUNCTION IF EXISTS public.list_my_linked_mercury_transactions_for_tally();

CREATE OR REPLACE FUNCTION public.list_my_linked_mercury_transactions_for_tally()
RETURNS TABLE (
  mercury_transaction_id uuid,
  mercury_debit_card_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  person_label text,
  jobs_summary text,
  mercury_account_id uuid,
  mercury_account_nickname text,
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
    l.mercury_debit_card_id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    COALESCE(ppl.name, u_attr.name, u_self.name)::text AS person_label,
    jobs.jobs_summary,
    t.mercury_account_id,
    ann.nickname AS mercury_account_nickname,
    t.currency,
    t.mercury_id,
    t.raw,
    COALESCE(splits.job_splits, '[]'::jsonb) AS job_splits
  FROM public.mercury_transactions t
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.user_id = auth.uid()
    AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u_self ON u_self.id = auth.uid()
  LEFT JOIN public.mercury_account_nicknames ann
    ON ann.mercury_account_id = t.mercury_account_id
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
  'Linked-card transactions for Tally: debit card id, account nickname, raw, job_splits for allocation UI.';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() TO authenticated;
