SET lock_timeout = '3s';

-- Card refunds count in the card-charges window (punch list #52, PR 4b-1b).
--
-- The People → Spending comparison against the Job window (2026-10-05) found every difference
-- in one cause: Mercury files a refund to a card — a return at The Home Depot, a Shell or
-- Fuelman pre-authorization given back — as kind 'other', still carrying the card's
-- debitCardInfo. _card_charges_window_rows (20261005212106) kept only the card kinds, so those
-- refunds never reached Spending and its totals read high by them: 27 refunds, $1,083.34 over
-- the 90 days to 2026-10-05 (135 and $11,618.37 all time, every one money in). The Job window
-- and Job Summary count them, by their sign, through the job splits.
--
-- The filter becomes: a card kind, or any transaction that carries a card id. Duplicates stay
-- out. The window's rows are read once (w) and filtered (c), both MATERIALIZED, so `raw` is still
-- read once per row; a 90-day window is about 1,800 rows in, 1,132 out. Same signature, same
-- columns, still LANGUAGE sql (checked when created); list_card_charges_window, the wrapper, is
-- untouched. See docs/migrations/20261005235207_card_charges_window_refunds.md.

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
  WITH w AS MATERIALIZED (
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
      AND t.duplicate_of_transaction_id IS NULL
  ),
  -- A card charge is a card kind, or any transaction that carries a card: Mercury files a
  -- refund to a card (a return, a fuel pre-authorization given back) as kind 'other' with the
  -- card's debitCardInfo, and it must come off like the Job window takes it off.
  c AS MATERIALIZED (
    SELECT w.id, w.posted_at, w.amount, w.counterparty_name, w.kind, w.status, w.mercury_category, w.card_id
    FROM w
    WHERE w.kind IN ('debitCardTransaction', 'creditCardTransaction')
       OR w.card_id IS NOT NULL
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
  'The rows of list_card_charges_window for posted_at in [p_lo, p_hi): a card kind or any transaction carrying a card (card refunds are kind other), as the viewer p_viewer with payroll access p_payroll_access. LANGUAGE sql so the body is checked when created. Not callable by app roles: only the wrapper calls it.';
