-- Stale tally follow-up: org-wide "hide dev-role staff transactions" toggle.
-- Adds an app_settings-driven filter to the follow-up RPC: when
-- app_settings.hide_dev_tally_transactions = 'true', exclude transactions whose linked
-- staff member has role 'dev'. The flag is read here (SECURITY DEFINER) so the modal list
-- AND its banner count (both call this RPC) honor it for all users. Signature unchanged.
CREATE OR REPLACE FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days integer DEFAULT 2, include_all_unlinked boolean DEFAULT false)
 RETURNS TABLE(target_user_id uuid, target_name text, target_email text, target_phone text, mercury_transaction_id uuid, posted_at timestamp with time zone, amount numeric, counterparty_name text, note text, mercury_account_id uuid, currency text, mercury_id uuid, raw jsonb, job_splits jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  floor_ymd text;
  use_floor boolean;
  age_int integer;
  hide_dev boolean;
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

  SELECT (NULLIF(trim(both FROM value_text), '') = 'true') INTO hide_dev
  FROM public.app_settings
  WHERE key = 'hide_dev_tally_transactions';
  hide_dev := COALESCE(hide_dev, false);

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
    AND (NOT hide_dev OR u.role <> 'dev')
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_supply_house_invoice_links il
      WHERE il.mercury_transaction_id = t.id
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
$function$;
