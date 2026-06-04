-- Per-user scratch notes on Mercury transactions in Job Parts Tally (separate from mercury_transactions.note).
-- Writes via upsert_mercury_tally_transaction_note (visibility matches tally list); direct INSERT/UPDATE/DELETE revoked from authenticated.

CREATE TABLE public.mercury_tally_transaction_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT ''::text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mercury_tally_transaction_notes_body_len CHECK (char_length(body) <= 2000),
  CONSTRAINT mercury_tally_transaction_notes_tx_user_unique UNIQUE (mercury_transaction_id, user_id)
);

CREATE INDEX mercury_tally_transaction_notes_user_id_idx
  ON public.mercury_tally_transaction_notes (user_id);

COMMENT ON TABLE public.mercury_tally_transaction_notes IS
  'User-owned Tally note per Mercury transaction; not synced to Mercury memo.';

ALTER TABLE public.mercury_tally_transaction_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_tally_transaction_notes select own"
  ON public.mercury_tally_transaction_notes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mercury_tally_transaction_notes insert own visible tx"
  ON public.mercury_tally_transaction_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.mercury_transactions t
      INNER JOIN public.mercury_debit_card_user_links l
        ON l.user_id = auth.uid()
        AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
      WHERE t.id = mercury_transaction_id
    )
  );

CREATE POLICY "mercury_tally_transaction_notes update own visible tx"
  ON public.mercury_tally_transaction_notes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.mercury_transactions t
      INNER JOIN public.mercury_debit_card_user_links l
        ON l.user_id = auth.uid()
        AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
      WHERE t.id = mercury_transaction_id
    )
  );

CREATE POLICY "mercury_tally_transaction_notes delete own"
  ON public.mercury_tally_transaction_notes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.mercury_tally_transaction_notes TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_tally_transaction_notes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_tally_transaction_notes FROM anon;

GRANT ALL ON public.mercury_tally_transaction_notes TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_mercury_tally_transaction_note(
  p_mercury_transaction_id uuid,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_body text := trim(both FROM coalesce(p_body, ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'upsert_mercury_tally_transaction_note: not authenticated';
  END IF;

  IF char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'upsert_mercury_tally_transaction_note: note too long';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mercury_transactions t
    INNER JOIN public.mercury_debit_card_user_links l
      ON l.user_id = uid
      AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    WHERE t.id = p_mercury_transaction_id
  ) THEN
    RAISE EXCEPTION 'upsert_mercury_tally_transaction_note: transaction not visible for tally';
  END IF;

  IF v_body = '' THEN
    DELETE FROM public.mercury_tally_transaction_notes
    WHERE mercury_transaction_id = p_mercury_transaction_id
      AND user_id = uid;
    RETURN;
  END IF;

  INSERT INTO public.mercury_tally_transaction_notes (
    mercury_transaction_id,
    user_id,
    body,
    updated_at
  )
  VALUES (p_mercury_transaction_id, uid, v_body, now())
  ON CONFLICT (mercury_transaction_id, user_id)
  DO UPDATE SET
    body = excluded.body,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_mercury_tally_transaction_note(uuid, text) IS
  'Insert/update/delete (empty body) current user Tally note for a Mercury transaction they can see via linked debit card.';

REVOKE ALL ON FUNCTION public.upsert_mercury_tally_transaction_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_mercury_tally_transaction_note(uuid, text) TO authenticated;

-- Extend tally list with per-user note (LEFT JOIN).
DROP FUNCTION IF EXISTS public.list_my_linked_mercury_transactions_for_tally();

CREATE OR REPLACE FUNCTION public.list_my_linked_mercury_transactions_for_tally()
RETURNS TABLE (
  mercury_transaction_id uuid,
  mercury_debit_card_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  tally_user_note text,
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
    n.body AS tally_user_note,
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
  LEFT JOIN public.mercury_tally_transaction_notes n
    ON n.mercury_transaction_id = t.id
    AND n.user_id = auth.uid()
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
  'Linked-card transactions for Tally: debit card id, account nickname, raw, job_splits, Mercury memo (note), user Tally note (tally_user_note).';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() TO authenticated;
