-- Dashboard tally badge: same org min posted date (America/Chicago calendar day) as Job Parts Tally list.
-- Key literal must stay in sync with APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD in src/lib/appSettingsKeys.ts.

CREATE OR REPLACE FUNCTION public.count_unlinked_mercury_transactions_for_tally()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  floor_ymd text;
  use_floor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'count_unlinked_mercury_transactions_for_tally: not authenticated';
  END IF;

  SELECT NULLIF(trim(both FROM value_text), '') INTO floor_ymd
  FROM public.app_settings
  WHERE key = 'job_tally_min_posted_ymd';

  use_floor := floor_ymd IS NOT NULL AND floor_ymd ~ '^\d{4}-\d{2}-\d{2}$';

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
    AND (
      NOT use_floor
      OR (
        t.posted_at IS NOT NULL
        AND to_char(t.posted_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= floor_ymd
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() IS
  'Linked-card Mercury transactions with no mercury_transaction_job_allocations (Job Tally Show all cards, unlinked). If app_settings job_tally_min_posted_ymd is valid YYYY-MM-DD, only counts rows with posted_at Chicago day on or after that date (matches Job Tally client filter).';

REVOKE ALL ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() TO authenticated;
