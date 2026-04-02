-- Maps Mercury debit card UUIDs (from mercury_transactions.raw) to app users for Tally / cardholder visibility.
-- Staff (dev, master_technician, assistant) manage links; linked users SELECT own rows.
-- RPC list_my_linked_mercury_transactions_for_tally: SECURITY DEFINER, returns rows for caller's linked card(s).

CREATE OR REPLACE FUNCTION public.mercury_debit_card_id_from_raw(p_raw jsonb)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_raw IS NULL THEN NULL
    WHEN v IS NULL OR v = '' OR v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN NULL
    ELSE v::uuid
  END
  FROM (
    SELECT lower(trim(both FROM COALESCE(
      NULLIF(trim(both FROM p_raw #>> '{details,debitCardInfo,id}'), ''),
      NULLIF(trim(both FROM p_raw #>> '{debitCardInfo,id}'), '')
    ))) AS v
  ) x
$$;

COMMENT ON FUNCTION public.mercury_debit_card_id_from_raw(jsonb) IS
  'Resolves Mercury debit card id from raw JSON (details.debitCardInfo.id or debitCardInfo.id); mirrors app mercuryDebitCardIdFromRaw.';

CREATE TABLE public.mercury_debit_card_user_links (
  mercury_debit_card_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id)
);

CREATE INDEX mercury_debit_card_user_links_user_id_idx
  ON public.mercury_debit_card_user_links (user_id);

COMMENT ON TABLE public.mercury_debit_card_user_links IS
  'One Mercury debit card maps to one app user; staff edit on Banking Sorting; cardholders see matching transactions on Tally via RPC.';

ALTER TABLE public.mercury_debit_card_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_debit_card_user_links staff select"
  ON public.mercury_debit_card_user_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_debit_card_user_links linked user select"
  ON public.mercury_debit_card_user_links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mercury_debit_card_user_links staff insert"
  ON public.mercury_debit_card_user_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_debit_card_user_links staff update"
  ON public.mercury_debit_card_user_links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_debit_card_user_links staff delete"
  ON public.mercury_debit_card_user_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

-- RLS: estimator, subcontractor, primary, superintendent have no matching policy on this table (no direct access).
-- dev, master_technician, assistant: staff policies; any user may use linked user select for rows they own.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_debit_card_user_links TO authenticated;
GRANT ALL ON public.mercury_debit_card_user_links TO service_role;

CREATE OR REPLACE FUNCTION public.list_my_linked_mercury_transactions_for_tally()
RETURNS TABLE (
  mercury_transaction_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  person_label text,
  jobs_summary text
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
    jobs.jobs_summary
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
  ORDER BY t.posted_at DESC NULLS LAST, t.id ASC;
END;
$$;

COMMENT ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() IS
  'Returns Mercury transactions whose debit card is linked to auth.uid(); person_label prefers attribution (person or user) then linked user name; jobs_summary from job allocations.';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() TO authenticated;

REVOKE ALL ON FUNCTION public.mercury_debit_card_id_from_raw(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mercury_debit_card_id_from_raw(jsonb) TO authenticated;
