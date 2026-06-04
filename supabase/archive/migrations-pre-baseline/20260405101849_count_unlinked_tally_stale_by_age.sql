-- Stale unlinked tally count: same scope as count_unlinked_mercury_transactions_for_tally, plus Chicago calendar-day age > min_age_days.
-- Key literal job_tally_min_posted_ymd must stay in sync with APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD in src/lib/appSettingsKeys.ts.

CREATE OR REPLACE FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(min_age_days integer DEFAULT 2)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  floor_ymd text;
  use_floor boolean;
  age_int integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'count_unlinked_mercury_transactions_for_tally_stale: not authenticated';
  END IF;

  age_int := GREATEST(0, min_age_days);

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
    AND t.posted_at IS NOT NULL
    AND (
      (now() AT TIME ZONE 'America/Chicago')::date
      - (t.posted_at AT TIME ZONE 'America/Chicago')::date
    ) > age_int
  );
END;
$$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) IS
  'Subset of count_unlinked_mercury_transactions_for_tally: only rows where posted_at Chicago calendar date is more than min_age_days before today (Chicago). min_age_days normalized with GREATEST(0, …).';

REVOKE ALL ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) TO authenticated;
