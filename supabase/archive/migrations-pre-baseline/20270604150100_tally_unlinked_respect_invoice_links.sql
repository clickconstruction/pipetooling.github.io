-- Treat a Mercury transaction linked to supply-house invoice(s) as "resolved" for the
-- Job Tally unlinked/stale surfaces, alongside transactions that have job allocations.
-- Recreates the four "unlinked" readers with an added NOT EXISTS invoice-link guard, and
-- extends list_my_linked with an invoices_summary column for the Tally UI.

-- ----------------------------------------------------------------------------
-- count_unlinked_mercury_transactions_for_tally
-- ----------------------------------------------------------------------------
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_supply_house_invoice_links il
      WHERE il.mercury_transaction_id = t.id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() IS
  'Count of Mercury transactions on the caller''s linked debit card(s) with no job allocations and no supply-house invoice links (matches Job Tally Show unlinked).';

REVOKE ALL ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unlinked_mercury_transactions_for_tally() TO authenticated;

-- ----------------------------------------------------------------------------
-- count_unlinked_mercury_transactions_for_tally_stale
-- ----------------------------------------------------------------------------
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
      (now() AT TIME ZONE 'America/Chicago')::date
      - (t.posted_at AT TIME ZONE 'America/Chicago')::date
    ) > age_int
  );
END;
$$;

COMMENT ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) IS
  'Subset of count_unlinked_mercury_transactions_for_tally (no job allocations and no invoice links): only rows where posted_at Chicago calendar date is more than min_age_days before today (Chicago).';

REVOKE ALL ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unlinked_mercury_transactions_for_tally_stale(integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days, include_all_unlinked)
-- ----------------------------------------------------------------------------
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
$$;

COMMENT ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) IS
  'Dev/master/assistant: unlinked Mercury rows (no job allocations and no supply-house invoice links) for linked-card users in staff_can_view_user_for_tally_followup. include_all_unlinked skips the min-age filter (still job_tally_min_posted_ymd floor).';

REVOKE ALL ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- list_my_linked_mercury_transactions_for_tally: add invoices_summary
-- ----------------------------------------------------------------------------
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
  invoices_summary text,
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
    inv.invoices_summary,
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
      string_agg(
        concat_ws(' · ', sh.name, si.invoice_number),
        '; ' ORDER BY si.invoice_date DESC NULLS LAST, si.invoice_number ASC
      ) AS invoices_summary
    FROM public.mercury_transaction_supply_house_invoice_links il
    INNER JOIN public.supply_house_invoices si ON si.id = il.invoice_id
    INNER JOIN public.supply_houses sh ON sh.id = si.supply_house_id
    WHERE il.mercury_transaction_id = t.id
  ) inv ON true
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
  'Linked-card transactions for Tally: debit card id, account nickname, raw, job_splits, Mercury memo (note), user Tally note, jobs_summary, and invoices_summary (linked supply-house invoices).';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_transactions_for_tally() TO authenticated;
