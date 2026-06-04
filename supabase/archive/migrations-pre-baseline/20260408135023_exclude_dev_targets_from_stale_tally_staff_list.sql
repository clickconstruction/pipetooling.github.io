-- Stale tally staff follow-up: omit rows where the linked-card owner has users.role = 'dev'
-- (office queue / banner counts). Personal "stale tally transactions" counts are unchanged.

CREATE OR REPLACE FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(
  min_age_days integer DEFAULT 2,
  include_all_unlinked boolean DEFAULT false
)
RETURNS TABLE (
  target_user_id uuid,
  target_name text,
  target_email text,
  target_phone text,
  mercury_transaction_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  mercury_account_id uuid,
  currency text,
  mercury_id uuid,
  raw jsonb,
  job_splits jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  floor_ymd text;
  use_floor boolean;
  age_int integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_stale_unlinked_mercury_transactions_for_tally_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ) THEN
    RETURN;
  END IF;

  age_int := GREATEST(0, min_age_days);

  SELECT NULLIF(trim(both FROM value_text), '') INTO floor_ymd
  FROM public.app_settings
  WHERE key = 'job_tally_min_posted_ymd';

  use_floor := floor_ymd IS NOT NULL AND floor_ymd ~ '^\d{4}-\d{2}-\d{2}$';

  RETURN QUERY
  SELECT
    u.id AS target_user_id,
    u.name::text AS target_name,
    COALESCE(NULLIF(trim(both FROM u.email), ''), pp.p_email)::text AS target_email,
    COALESCE(NULLIF(trim(both FROM u.phone), ''), pp.p_phone)::text AS target_phone,
    t.id AS mercury_transaction_id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    t.mercury_account_id,
    t.currency,
    t.mercury_id,
    t.raw,
    '[]'::jsonb AS job_splits
  FROM public.mercury_transactions t
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u ON u.id = l.user_id
  LEFT JOIN LATERAL (
    SELECT
      p.email::text AS p_email,
      p.phone::text AS p_phone
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND lower(trim(both FROM p.name)) = lower(trim(both FROM u.name))
    ORDER BY p.id
    LIMIT 1
  ) pp ON true
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), l.user_id)
    AND u.role IS DISTINCT FROM 'dev'
    AND NOT EXISTS (
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
      include_all_unlinked
      OR (
        (now() AT TIME ZONE 'America/Chicago')::date
        - (t.posted_at AT TIME ZONE 'America/Chicago')::date
      ) > age_int
    )
  ORDER BY u.name ASC, t.posted_at DESC NULLS LAST, t.id ASC
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) IS
  'Dev/master/assistant: unlinked Mercury rows for linked-card users in staff_can_view_user_for_tally_followup, excluding dev-role card owners. When include_all_unlinked, no min-age filter (still job_tally_min_posted_ymd floor).';

REVOKE ALL ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) TO authenticated;
