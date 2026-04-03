-- Count linked-card Mercury transactions with no job allocations (Job Tally "unlinked" scope).
CREATE OR REPLACE FUNCTION public.count_unlinked_mercury_transactions_for_tally()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'count_unlinked_mercury_transactions_for_tally: not authenticated';
  END IF;

  RETURN (
    SELECT COUNT(*)::bigint
    FROM public.mercury_transactions t
    INNER JOIN public.mercury_debit_card_user_links l
      ON l.user_id = auth.uid()
      AND l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = t.id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() IS
  'Count of Mercury transactions on the caller''s linked debit card(s) with no mercury_transaction_job_allocations rows (matches Job Tally Show unlinked).';

REVOKE ALL ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() TO authenticated;
