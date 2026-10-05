SET lock_timeout = '3s';

-- Card charges in a window (punch list #52 PR 4b-1; also the history read of #72's team queue).
--
-- One row per card charge posted in the company days p_start_ymd..p_end_ymd: who it belongs to
-- (the attribution, the card and its holder), what it is (the bank category, the accounting
-- label), and where it went (the real job splits, the supply-house invoice links, a payroll mark,
-- and who sorted it last), plus whether this viewer can write its splits (viewer_can_sort, the
-- same check the split writes make). People → Spending adds these up by person with the Job
-- window's own card rule; the Tally team queue reads each holder's sorted charges for its
-- suggestions. job_splits and invoice_links carry the keys of the Sorted RPC (v2.4566).
--
-- Read only. SECURITY DEFINER because the office roles cannot all read every piece through RLS
-- (the card-holder links are Banking-only; the payroll marks follow payroll access), and the card
-- id lives in `raw`, which this does not return. The office roles (dev, master, assistant,
-- controller — is_office_staff()) already read the charges, attributions, splits, labels and
-- invoice links; the holder per card and the payroll mark per charge are what the Team purchases
-- definer RPCs already show the same roles. Card kinds only (no ACH, no checks); duplicates out.
-- The window is the company's civil day by posted_at (reporting_window_calendar_civil_day owns
-- the zone), at most 366 days, ordered by (posted_at, id) so callers page past PostgREST's
-- 1,000-row cap. See docs/migrations/20261005212106_card_charges_window.md.

CREATE OR REPLACE FUNCTION public.list_card_charges_window(
  p_start_ymd date,
  p_end_ymd date,
  p_holder_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  mercury_transaction_id uuid,
  posted_at timestamp with time zone,
  amount numeric,
  counterparty_name text,
  kind text,
  status text,
  bank_category text,
  debit_card_id uuid,
  card_nickname text,
  card_role text,
  holder_user_id uuid,
  holder_name text,
  attributed_user_id uuid,
  attributed_person_id uuid,
  label_id uuid,
  label_default_key text,
  payroll_marked boolean,
  job_splits jsonb,
  invoice_links jsonb,
  sorted_at timestamp with time zone,
  sorted_by_name text,
  viewer_can_sort boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  v_lo timestamp with time zone;
  v_hi timestamp with time zone;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'list_card_charges_window: not authorized';
  END IF;

  IF p_start_ymd IS NULL OR p_end_ymd IS NULL OR p_end_ymd < p_start_ymd THEN
    RAISE EXCEPTION 'list_card_charges_window: a start day on or before the end day is required';
  END IF;

  IF p_end_ymd - p_start_ymd > 365 THEN
    RAISE EXCEPTION 'list_card_charges_window: at most 366 days at a time';
  END IF;

  -- The company's civil day; the helper owns the zone (America/Chicago when given none).
  SELECT w.window_start_utc INTO v_lo FROM public.reporting_window_calendar_civil_day(NULL, p_start_ymd) w;
  SELECT w.window_end_utc INTO v_hi FROM public.reporting_window_calendar_civil_day(NULL, p_end_ymd) w;

  RETURN QUERY
  WITH c AS (
    SELECT
      t.id,
      t.posted_at,
      t.amount,
      t.counterparty_name,
      t.kind,
      t.status,
      t.mercury_category,
      public.mercury_debit_card_id_from_raw(t.raw) AS card_id
    FROM public.mercury_transactions t
    WHERE t.posted_at >= v_lo
      AND t.posted_at < v_hi
      AND t.kind IN ('debitCardTransaction', 'creditCardTransaction')
      AND t.duplicate_of_transaction_id IS NULL
  ),
  -- Can this viewer write the splits? A held card saves through
  -- replace_mercury_job_splits_for_linked_card_as_staff, which admits only the holder's
  -- circle (staff_can_view_user_for_tally_followup — asked once per holder here, with the
  -- same predicate); a card with no holder saves through replace_mercury_transaction_splits,
  -- which admits every office role.
  can_sort AS (
    SELECT h.user_id, public.staff_can_view_user_for_tally_followup(auth.uid(), h.user_id) AS ok
    FROM (
      SELECT DISTINCT l0.user_id
      FROM c
      INNER JOIN public.mercury_debit_card_user_links l0 ON l0.mercury_debit_card_id = c.card_id
    ) h
  )
  SELECT
    c.id,
    c.posted_at,
    c.amount,
    c.counterparty_name,
    c.kind,
    c.status,
    CASE jsonb_typeof(c.mercury_category)
      WHEN 'string' THEN c.mercury_category #>> '{}'
      WHEN 'object' THEN c.mercury_category ->> 'name'
    END,
    c.card_id,
    n.nickname,
    n.card_role,
    l.user_id,
    hu.name::text,
    att.user_id,
    att.person_id,
    asg.label_id,
    lab.default_key,
    COALESCE(pf.is_payroll, false),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'job_id', a.job_id,
          'amount', a.amount,
          'note', a.note,
          'hcp_number', j.hcp_number,
          'click_number', j.click_number,
          'job_name', j.job_name,
          'service_type_id', j.service_type_id,
          'created_at', a.created_at,
          'created_by', a.created_by
        ) ORDER BY abs(a.amount) DESC, a.id
      )
      FROM public.mercury_transaction_job_allocations a
      LEFT JOIN public.jobs_ledger j ON j.id = a.job_id
      WHERE a.mercury_transaction_id = c.id
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'invoice_id', si.id,
          'invoice_number', si.invoice_number,
          'invoice_date', si.invoice_date,
          'amount', si.amount,
          'supply_house_name', sh.name,
          'created_at', il.created_at
        ) ORDER BY si.invoice_date NULLS LAST, si.invoice_number
      )
      FROM public.mercury_transaction_supply_house_invoice_links il
      INNER JOIN public.supply_house_invoices si ON si.id = il.invoice_id
      LEFT JOIN public.supply_houses sh ON sh.id = si.supply_house_id
      WHERE il.mercury_transaction_id = c.id
    ), '[]'::jsonb),
    srt.created_at,
    sb.name::text,
    CASE WHEN l.user_id IS NULL THEN true ELSE COALESCE(cs.ok, false) END
  FROM c
  LEFT JOIN public.mercury_debit_card_user_links l ON l.mercury_debit_card_id = c.card_id
  LEFT JOIN public.users hu ON hu.id = l.user_id
  LEFT JOIN can_sort cs ON cs.user_id = l.user_id
  LEFT JOIN public.mercury_debit_card_nicknames n ON n.mercury_debit_card_id = c.card_id
  LEFT JOIN public.mercury_transaction_attributions att ON att.mercury_transaction_id = c.id
  LEFT JOIN public.mercury_transaction_drag_sort_assignments asg ON asg.mercury_transaction_id = c.id
  LEFT JOIN public.mercury_drag_sort_labels lab ON lab.id = asg.label_id
  LEFT JOIN public.mercury_tally_payroll_flags pf ON pf.mercury_transaction_id = c.id
  LEFT JOIN LATERAL (
    SELECT x.created_at, x.created_by
    FROM (
      SELECT a2.created_at, a2.created_by
      FROM public.mercury_transaction_job_allocations a2
      WHERE a2.mercury_transaction_id = c.id
      UNION ALL
      SELECT il2.created_at, il2.created_by
      FROM public.mercury_transaction_supply_house_invoice_links il2
      WHERE il2.mercury_transaction_id = c.id
    ) x
    ORDER BY x.created_at DESC
    LIMIT 1
  ) srt ON true
  LEFT JOIN public.users sb ON sb.id = srt.created_by
  WHERE p_holder_user_id IS NULL OR l.user_id = p_holder_user_id
  ORDER BY c.posted_at, c.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_card_charges_window(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_card_charges_window(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_card_charges_window(date, date, uuid) TO authenticated;

COMMENT ON FUNCTION public.list_card_charges_window(date, date, uuid) IS
  'Card charges posted in company days p_start_ymd..p_end_ymd (at most 366): attribution, card + holder, bank category, accounting label, payroll mark, job splits, invoice links, last sorted, and whether the viewer can write the splits. Office staff only. Ordered by (posted_at, id) for paging. People → Spending (#52) and the Tally team queue history (#72).';
