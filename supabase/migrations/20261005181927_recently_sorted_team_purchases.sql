SET lock_timeout = '3s';

-- Team purchases follow-up → Sorted (v2.4566): the card charges the office already sorted, so a
-- charge that left the To sort list can be opened again (a second invoice, a different job).
-- Read only; same viewers and the same card-holder rule as
-- list_stale_unlinked_mercury_transactions_for_tally_staff.

CREATE OR REPLACE FUNCTION public.list_recently_sorted_mercury_transactions_for_tally_staff(p_days integer DEFAULT 30)
 RETURNS TABLE(
   target_user_id uuid,
   target_name text,
   mercury_transaction_id uuid,
   posted_at timestamp with time zone,
   amount numeric,
   counterparty_name text,
   note text,
   mercury_account_id uuid,
   currency text,
   mercury_id uuid,
   raw jsonb,
   job_splits jsonb,
   invoice_links jsonb,
   sorted_at timestamp with time zone,
   sorted_by_name text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 120);
  hide_dev boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_recently_sorted_mercury_transactions_for_tally_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
  ) THEN
    RETURN;
  END IF;

  SELECT (NULLIF(trim(both FROM value_text), '') = 'true') INTO hide_dev
  FROM public.app_settings
  WHERE key = 'hide_dev_tally_transactions';
  hide_dev := COALESCE(hide_dev, false);

  RETURN QUERY
  WITH touched AS (
    SELECT a.mercury_transaction_id AS tx_id, a.created_at, a.created_by
    FROM public.mercury_transaction_job_allocations a
    WHERE a.created_at >= now() - make_interval(days => v_days)
    UNION ALL
    SELECT il.mercury_transaction_id, il.created_at, il.created_by
    FROM public.mercury_transaction_supply_house_invoice_links il
    WHERE il.created_at >= now() - make_interval(days => v_days)
  ),
  latest AS (
    SELECT DISTINCT ON (x.tx_id) x.tx_id, x.created_at AS sorted_at, x.created_by AS sorted_by
    FROM touched x
    ORDER BY x.tx_id, x.created_at DESC
  )
  SELECT
    u.id AS target_user_id,
    u.name::text AS target_name,
    t.id AS mercury_transaction_id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    t.mercury_account_id,
    t.currency,
    t.mercury_id,
    t.raw,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'job_id', a.job_id,
          'amount', a.amount,
          'note', a.note,
          'hcp_number', j.hcp_number,
          'click_number', j.click_number,
          'job_name', j.job_name,
          'service_type_id', j.service_type_id
        ) ORDER BY abs(a.amount) DESC, a.id
      )
      FROM public.mercury_transaction_job_allocations a
      LEFT JOIN public.jobs_ledger j ON j.id = a.job_id
      WHERE a.mercury_transaction_id = t.id
    ), '[]'::jsonb) AS job_splits,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'invoice_id', si.id,
          'invoice_number', si.invoice_number,
          'invoice_date', si.invoice_date,
          'amount', si.amount,
          'supply_house_name', sh.name
        ) ORDER BY si.invoice_date NULLS LAST, si.invoice_number
      )
      FROM public.mercury_transaction_supply_house_invoice_links il
      INNER JOIN public.supply_house_invoices si ON si.id = il.invoice_id
      LEFT JOIN public.supply_houses sh ON sh.id = si.supply_house_id
      WHERE il.mercury_transaction_id = t.id
    ), '[]'::jsonb) AS invoice_links,
    latest.sorted_at,
    sb.name::text AS sorted_by_name
  FROM latest
  INNER JOIN public.mercury_transactions t ON t.id = latest.tx_id
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u ON u.id = l.user_id
  LEFT JOIN public.users sb ON sb.id = latest.sorted_by
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), l.user_id)
    AND (NOT hide_dev OR u.role <> 'dev')
  ORDER BY latest.sorted_at DESC, t.id ASC
  LIMIT 300;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_recently_sorted_mercury_transactions_for_tally_staff(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recently_sorted_mercury_transactions_for_tally_staff(integer) TO authenticated;

COMMENT ON FUNCTION public.list_recently_sorted_mercury_transactions_for_tally_staff(integer) IS
  'Team purchases follow-up → Sorted: linked-card charges whose job splits or invoice links were written in the last p_days (1–120), with where each went, when and by whom. Staff only.';
