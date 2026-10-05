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
-- Two functions. The rows come from _card_charges_window_rows, LANGUAGE sql, so the database
-- checks every table, column and type when this migration creates it — a mistake fails the push
-- and rolls back instead of failing the first call. Nobody calls it but the wrapper: execute is
-- revoked from PUBLIC, anon and authenticated. list_card_charges_window, the wrapper the app
-- calls, holds what a sql body cannot: the role check, the day validation, the company day's
-- bounds and the caller's payroll access.
--
-- Read only. SECURITY DEFINER because the office roles cannot all read every piece through RLS
-- (the card-holder links are Banking-only), and the card id lives in `raw`, which this does not
-- return. The office roles (dev, master, assistant, controller — is_office_staff()) already read
-- the charges, attributions, splits, labels and invoice links, and the Team purchases definer
-- RPCs already name each charge's holder to them; this names it for every holder.
--
-- The payroll mark keeps its own rule, has_payroll_access() — the policy on
-- mercury_tally_payroll_flags (20260906130000). The Team purchases queue does not show the mark;
-- it leaves a payroll-marked charge off. So does this: a caller without payroll access does not
-- get a charge settled by a payroll mark alone, and reads payroll_marked false on every other
-- row. A marked charge that is also on a job or an invoice stays for everyone, so a job's card
-- spend reads the same for every role. Totals differ by role by exactly the charges settled by a
-- payroll mark alone. Widening is the one argument the wrapper passes.
--
-- Bounded so a poor plan stays small: at most 366 days, a range on posted_at
-- (mercury_transactions_posted_at_desc_idx), the kind and duplicate filters before anything per
-- row; `raw` is read once per row in the window for the card id (no stored card-id column exists;
-- every card-holder RPC reads it the same way), in a MATERIALIZED CTE; every other piece is a
-- primary-key or transaction-id index probe; the circle check runs once per holder. Card kinds
-- only (no ACH, no checks); duplicates out. Ordered by (posted_at, id) so callers page past
-- PostgREST's 1,000-row cap. See docs/migrations/20261005212106_card_charges_window.md.

CREATE OR REPLACE FUNCTION public._card_charges_window_rows(
  p_lo timestamp with time zone,
  p_hi timestamp with time zone,
  p_viewer uuid,
  p_payroll_access boolean
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH c AS MATERIALIZED (
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
    WHERE t.posted_at >= p_lo
      AND t.posted_at < p_hi
      AND t.kind IN ('debitCardTransaction', 'creditCardTransaction')
      AND t.duplicate_of_transaction_id IS NULL
  ),
  -- Can this viewer write the splits? A held card saves through
  -- replace_mercury_job_splits_for_linked_card_as_staff, which admits only the holder's circle
  -- (staff_can_view_user_for_tally_followup — asked here once per holder, with the same
  -- predicate); a card with no holder saves through replace_mercury_transaction_splits, which
  -- admits every office role.
  can_sort AS (
    SELECT h.user_id, public.staff_can_view_user_for_tally_followup(p_viewer, h.user_id) AS ok
    FROM (
      SELECT DISTINCT l0.user_id
      FROM c
      INNER JOIN public.mercury_debit_card_user_links l0 ON l0.mercury_debit_card_id = c.card_id
    ) h
  )
  SELECT
    c.id,
    c.posted_at,
    c.amount::numeric,
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
    hu.name,
    att.user_id,
    att.person_id,
    asg.label_id,
    lab.default_key,
    CASE WHEN p_payroll_access THEN COALESCE(pf.is_payroll, false) ELSE false END,
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
    sb.name,
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
  -- A charge settled by a payroll mark alone reaches only callers with payroll access, as the
  -- Team purchases queue leaves it off; a marked charge that is also on a job or an invoice stays
  -- for everyone.
  WHERE p_payroll_access
     OR pf.is_payroll IS NOT TRUE
     OR EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a3 WHERE a3.mercury_transaction_id = c.id)
     OR EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il3 WHERE il3.mercury_transaction_id = c.id)
  ORDER BY c.posted_at, c.id
$function$;

REVOKE ALL ON FUNCTION public._card_charges_window_rows(timestamp with time zone, timestamp with time zone, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._card_charges_window_rows(timestamp with time zone, timestamp with time zone, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public._card_charges_window_rows(timestamp with time zone, timestamp with time zone, uuid, boolean) FROM authenticated;

COMMENT ON FUNCTION public._card_charges_window_rows(timestamp with time zone, timestamp with time zone, uuid, boolean) IS
  'The rows of list_card_charges_window for posted_at in [p_lo, p_hi), as the viewer p_viewer with payroll access p_payroll_access. LANGUAGE sql so the body is checked when created. Not callable by app roles: only the wrapper calls it.';

CREATE OR REPLACE FUNCTION public.list_card_charges_window(
  p_start_ymd date,
  p_end_ymd date
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
  SELECT w.window_start_utc INTO v_lo FROM public.reporting_window_calendar_civil_day(NULL::text, p_start_ymd) w;
  SELECT w.window_end_utc INTO v_hi FROM public.reporting_window_calendar_civil_day(NULL::text, p_end_ymd) w;

  -- The payroll marks keep their table's own rule (has_payroll_access(), the policy on
  -- mercury_tally_payroll_flags since 20260906130000).
  RETURN QUERY
  SELECT * FROM public._card_charges_window_rows(v_lo, v_hi, auth.uid(), public.has_payroll_access());
END;
$function$;

REVOKE ALL ON FUNCTION public.list_card_charges_window(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_card_charges_window(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_card_charges_window(date, date) TO authenticated;

COMMENT ON FUNCTION public.list_card_charges_window(date, date) IS
  'Card charges posted in company days p_start_ymd..p_end_ymd (at most 366): attribution, card + holder, bank category, accounting label, payroll mark, job splits, invoice links, last sorted, and whether the viewer can write the splits. Office staff only; a charge settled by a payroll mark alone only with payroll access. Ordered by (posted_at, id) for paging. People → Spending (#52) and the Tally team queue history (#72).';
