SET lock_timeout = '3s';

-- GC mode, Owner Billing's O8a (v2.5113; to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md → PR 11, O8; the SQL is
-- mockups/owner-billing-o8.md's block, byte for byte, on branch spike/gc-mode): the customer turns a certified bill
-- into a card payment from their portal, and the turn adds a 3% credit card fee (the owner's word, 2026-10-09; counsel
-- said the surcharge is okay the same day). Staff never turn a bill to card.
--
-- 1. gc_owner_card_bills: one row per bill turned to card, with its base (what the bill asked), its rate and its fee.
--    It is pending while gc-card-bill makes the Stripe invoice, on_card once it is made, and undone once the office
--    takes the bill back to a check bill. The money team reads the rows; only the three functions write them.
-- 2. gc_card_bill_begin and gc_card_bill_finish, the service role only (gc-card-bill's portal door, which checks the
--    portal link's customer first). begin checks the bill may turn and writes the pending row. finish writes what
--    Stripe made onto the bill: its total, the Stripe columns, and the fee as a rider in fee_lines.
-- 3. gc_card_bill_undo: the money team takes a bill on card back to a check bill, once gc-card-bill has voided its
--    Stripe invoice. The service role clears a pending row whose Stripe invoice was never made.
-- 4. The fee is a recovery of Stripe's processing cost, not the project's revenue (the lead's call): every GC figure
--    reads a card bill at its amount less its fee. It rides on the bill the way v2.5033's returned check fee does, so
--    job_rider_fees counts it, and gc_owner_billing_revenue becomes the contract, the interest billed and the billing
--    job's riders. Without the rider the billing job would read paid before its last bill is paid, since a card
--    payment carries its fee. gc_owner_billing_revenue's only readers are the three functions that set the billing
--    job's revenue, so none of them changes. It now also counts a returned check fee on a GC bill, which v2.5091 left
--    to the GC crew.
-- Every function is SECURITY INVOKER. The table ends with the three fences.

-- 1 ---------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gc_owner_card_bills (
  invoice_id uuid PRIMARY KEY REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- What the bill asked before the fee: the certified amount, since a bill with a payment never turns.
  base numeric NOT NULL
    CONSTRAINT gc_owner_card_bills_base_counted CHECK (base > 0),
  -- The rate the fee took, kept on the row so a later rate never rewrites a bill. At most 3 (counsel's okay).
  fee_pct numeric NOT NULL DEFAULT 3
    CONSTRAINT gc_owner_card_bills_fee_pct_known CHECK (fee_pct > 0 AND fee_pct <= 3),
  fee numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT gc_owner_card_bills_status_known CHECK (status IN ('pending', 'on_card', 'undone')),
  stripe_invoice_id text,
  chosen_on date NOT NULL,
  -- Only the customer turns a bill to card, in their portal (the owner's word).
  chosen_how text NOT NULL DEFAULT 'portal'
    CONSTRAINT gc_owner_card_bills_chosen_in_portal CHECK (chosen_how = 'portal'),
  started_at timestamptz NOT NULL DEFAULT now(),
  on_card_at timestamptz,
  undone_on date,
  undone_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_owner_card_bills_fee_is_its_rate CHECK (fee = round(base * fee_pct / 100, 2)),
  CONSTRAINT gc_owner_card_bills_made_on_stripe CHECK (status = 'pending' OR (stripe_invoice_id IS NOT NULL AND on_card_at IS NOT NULL)),
  CONSTRAINT gc_owner_card_bills_undone_dated CHECK ((status = 'undone') = (undone_on IS NOT NULL))
);

COMMENT ON TABLE public.gc_owner_card_bills IS
  'GC mode (O8a, v2.5113): a certified bill the customer turned to card in their portal, with the 3% credit card fee the turn added. pending while gc-card-bill makes the Stripe invoice, on_card once it is made, undone once the office took it back to a check bill. The fee rides on the bill in jobs_ledger_invoices.fee_lines; every GC figure reads the bill at its amount less this fee.';

-- The money team reads the rows, and takes a bill back to a check bill through gc_card_bill_undo. Nobody signed in
-- writes one any other way: the service role writes them for the portal.
ALTER TABLE public.gc_owner_card_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_owner_card_bills_money_read ON public.gc_owner_card_bills;
CREATE POLICY gc_owner_card_bills_money_read ON public.gc_owner_card_bills FOR SELECT TO authenticated
  USING ((SELECT public.gc_money_team()));
DROP POLICY IF EXISTS gc_owner_card_bills_money_undo ON public.gc_owner_card_bills;
CREATE POLICY gc_owner_card_bills_money_undo ON public.gc_owner_card_bills FOR UPDATE TO authenticated
  USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()));

REVOKE ALL ON TABLE public.gc_owner_card_bills FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_owner_card_bills FROM authenticated;
GRANT SELECT ON TABLE public.gc_owner_card_bills TO authenticated;
GRANT UPDATE (status, undone_on, undone_by) ON TABLE public.gc_owner_card_bills TO authenticated;

-- 2 ---------------------------------------------------------------------------------------------------------

-- The customer turns a certified bill to card (gc-card-bill's portal door, as the service role, once it has checked
-- the portal link's customer). It locks the bill, checks it may turn, and writes the pending row with the base, the
-- rate and the fee. A bill on card already answers with its card page, so a second press opens it. Returns what the
-- Stripe invoice needs.
CREATE OR REPLACE FUNCTION public.gc_card_bill_begin(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inv public.jobs_ledger_invoices%ROWTYPE;
  v_app public.gc_owner_pay_apps%ROWTYPE;
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_pay_days integer;
  v_base numeric;
  v_fee numeric;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal turns a bill to card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not there.';
  END IF;
  SELECT * INTO v_app FROM public.gc_owner_pay_apps WHERE invoice_id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a certified bill goes on card.';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF v_card.invoice_id IS NOT NULL AND v_card.status = 'on_card' THEN
    RETURN jsonb_build_object('state', 'on_card', 'hosted_invoice_url', v_inv.hosted_invoice_url,
      'base', v_card.base, 'fee', v_card.fee, 'total', v_card.base + v_card.fee);
  END IF;
  IF v_card.invoice_id IS NOT NULL AND v_card.status = 'undone' THEN
    RAISE EXCEPTION 'This bill went back to a check bill. Call our office to pay it by card.';
  END IF;
  IF v_inv.status <> 'billed' THEN
    RAISE EXCEPTION 'This bill is paid already.';
  END IF;
  IF v_inv.stripe_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is on Stripe already.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'A payment is on this bill already, so it cannot move to card.';
  END IF;
  -- A pending row is a card page being made. One older than ten minutes never came back, and may be begun again.
  IF v_card.invoice_id IS NOT NULL AND v_card.started_at > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'This bill is being set up for card. Try again in a minute.';
  END IF;
  v_base := round(v_inv.amount, 2);
  IF v_base IS NULL OR v_base <= 0 THEN
    RAISE EXCEPTION 'There is nothing to pay on this bill.';
  END IF;
  v_fee := round(v_base * 3 / 100, 2);
  INSERT INTO public.gc_owner_card_bills (invoice_id, project_id, base, fee_pct, fee, status, chosen_on, chosen_how, started_at)
  VALUES (p_invoice_id, v_app.project_id, v_base, 3, v_fee, 'pending', public.app_today(), 'portal', now())
  ON CONFLICT (invoice_id) DO UPDATE
    SET base = EXCLUDED.base, fee_pct = EXCLUDED.fee_pct, fee = EXCLUDED.fee, chosen_on = EXCLUDED.chosen_on,
        started_at = EXCLUDED.started_at;
  SELECT owner_pay_days INTO v_pay_days FROM public.gc_projects WHERE project_id = v_app.project_id;
  RETURN jsonb_build_object('state', 'pending', 'base', v_base, 'fee_pct', 3, 'fee', v_fee, 'total', v_base + v_fee,
    'project_id', v_app.project_id, 'job_id', v_inv.job_id, 'number', v_app.number, 'final', v_app.final,
    'certified_on', v_app.certified_on, 'owner_pay_days', v_pay_days);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_begin(uuid) IS
  'GC mode (O8a, v2.5113): the customer turns a certified bill to card, as the service role for gc-card-bill''s portal door. Refused for an interest bill, a paid bill, a bill on Stripe, a bill with a payment, and a bill taken back to a check bill. Writes the pending card row at 3% of what the bill asks, rounded to the cent; a bill on card answers with its card page. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_begin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_begin(uuid) TO service_role;

-- What Stripe made, written onto the bill: its total (the base and the fee), the Stripe columns, and the fee as a
-- rider in fee_lines, so the printed bill shows it as its own row and job_rider_fees counts it. Then the billing
-- job's revenue is laid again.
CREATE OR REPLACE FUNCTION public.gc_card_bill_finish(p_invoice_id uuid, p_stripe_invoice_id text, p_hosted_url text, p_stripe_status text, p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal turns a bill to card.';
  END IF;
  IF COALESCE(p_stripe_invoice_id, '') !~ '^in_[A-Za-z0-9]+$' OR COALESCE(p_hosted_url, '') !~ '^https://\S+$'
     OR p_mode IS NULL OR p_mode NOT IN ('live', 'test') THEN
    RAISE EXCEPTION 'The card page did not come back whole.';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_card.status <> 'pending' THEN
    RAISE EXCEPTION 'That bill is not being set up for card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'billed' OR v_inv.stripe_invoice_id IS NOT NULL OR round(v_inv.amount, 2) <> v_card.base
     OR EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'The bill changed while its card page was made. Call our office.';
  END IF;
  UPDATE public.jobs_ledger_invoices
  SET amount = v_card.base + v_card.fee,
      stripe_invoice_id = p_stripe_invoice_id,
      hosted_invoice_url = p_hosted_url,
      stripe_invoice_status = NULLIF(btrim(COALESCE(p_stripe_status, '')), ''),
      stripe_mode = p_mode,
      external_send_channel = 'stripe',
      fee_lines = CASE WHEN jsonb_typeof(fee_lines) = 'array' THEN fee_lines ELSE '[]'::jsonb END
        || jsonb_build_array(jsonb_build_object(
             'description', format('Credit card fee (%s%%)', trim_scale(v_card.fee_pct)),
             'amount', v_card.fee,
             'card_bill', p_invoice_id,
             'added_at', now()))
  WHERE id = p_invoice_id;
  UPDATE public.gc_owner_card_bills
  SET status = 'on_card', stripe_invoice_id = p_stripe_invoice_id, on_card_at = now()
  WHERE invoice_id = p_invoice_id;
  UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(v_card.project_id), updated_at = now()
  WHERE id = v_inv.job_id AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(v_card.project_id);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) IS
  'GC mode (O8a, v2.5113): the Stripe invoice gc-card-bill made for a pending card bill, written onto the bill (its total, the Stripe columns, the fee as a fee_lines rider) as the service role; the billing job''s revenue laid again. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) TO service_role;

-- 3 ---------------------------------------------------------------------------------------------------------

-- Back to a check bill: the money team (never a training account or a digital twin, each told in words), once
-- gc-card-bill has voided the Stripe invoice, while no payment is on the bill. The bill goes back to its base, the Stripe columns are cleared, the rider comes off, and the revenue is laid
-- again. The row stays, undone, so the offer does not come back on that bill. As the service role it clears a
-- pending row whose Stripe invoice was never made, and nothing else.
CREATE OR REPLACE FUNCTION public.gc_card_bill_undo(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
BEGIN
  IF current_user = 'service_role' THEN
    SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
    IF NOT FOUND OR v_card.status <> 'pending' THEN
      RAISE EXCEPTION 'Only the office takes a bill off card.';
    END IF;
    DELETE FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id;
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a bill off card.';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a bill off card.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a bill off card.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_card.status <> 'on_card' THEN
    RAISE EXCEPTION 'That bill is not on card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not there.';
  END IF;
  IF v_inv.status <> 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'A payment is on this bill, so it stays on card.';
  END IF;
  UPDATE public.jobs_ledger_invoices
  SET amount = v_card.base,
      stripe_invoice_id = NULL,
      hosted_invoice_url = NULL,
      stripe_invoice_status = NULL,
      stripe_mode = NULL,
      external_send_channel = NULL,
      fee_lines = (
        SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_agg(e.l ORDER BY e.o) END
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(fee_lines) = 'array' THEN fee_lines ELSE '[]'::jsonb END)
          WITH ORDINALITY AS e(l, o)
        WHERE (e.l ->> 'card_bill') IS DISTINCT FROM p_invoice_id::text)
  WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.';
  END IF;
  UPDATE public.gc_owner_card_bills
  SET status = 'undone', undone_on = public.app_today(), undone_by = auth.uid()
  WHERE invoice_id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.';
  END IF;
  UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(v_card.project_id), updated_at = now()
  WHERE id = v_inv.job_id AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(v_card.project_id);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_undo(uuid) IS
  'GC mode (O8a, v2.5113): back to a check bill, by the money team once gc-card-bill voided the Stripe invoice and while no payment is on the bill: the base, no Stripe columns, the rider off, the revenue laid again, the row kept undone. As the service role, clears a pending row only. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_undo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_undo(uuid) TO authenticated, service_role;

-- 4 ---------------------------------------------------------------------------------------------------------

-- job_rider_fees, restated byte for byte from 20261010023000 but for one more kind of fee_lines entry it sums: one
-- that names its card bill (O8a's card fee), beside one that names its case (v2.5033's returned check fee).
CREATE OR REPLACE FUNCTION public.job_rider_fees(p_job_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sum(h.fee_amount)
              FROM public.job_hazmat_incidents h
              WHERE h.job_id = p_job_id AND h.voided_at IS NULL), 0)
    + coalesce((SELECT sum(CASE
                             WHEN ((jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '')
                                   OR (jsonb_typeof(l->'card_bill') = 'string' AND btrim(l->>'card_bill') <> ''))
                              AND (jsonb_typeof(l->'amount') = 'number'
                                   OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'))
                             THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                           END)
                FROM public.jobs_ledger_invoices i
                CROSS JOIN LATERAL jsonb_array_elements(
                  CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END
                ) AS l
                WHERE i.job_id = p_job_id), 0)
$function$;

COMMENT ON FUNCTION public.job_rider_fees(uuid) IS
  'v2.5091, widened by v2.5113: the riders, the fees that ride on a job beyond its line items: its un-voided hazmat fees, every returned check fee on its bills (a jobs_ledger_invoices.fee_lines entry that names its case), and every GC card fee (an entry that names its card bill). Every rewrite of jobs_ledger.revenue from the line items adds it. The client twin is jobFormRiderFeesDollars.';

-- The billing job's revenue: our price to the customer today, every interest bill, and the billing job's riders (the
-- card fees, and a returned check fee on a GC bill). It is the billing job's Pipeline total, which decides when the
-- job reads paid; no GC figure reads it. The three functions that set the revenue call it, so none of them changes.
CREATE OR REPLACE FUNCTION public.gc_owner_billing_revenue(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.gc_owner_contract_now(p_project_id)
    + COALESCE((SELECT sum(amount) FROM public.gc_owner_interest_bills WHERE project_id = p_project_id), 0)
    + COALESCE((SELECT public.job_rider_fees(g.billing_job_id) FROM public.gc_projects g
                WHERE g.project_id = p_project_id AND g.billing_job_id IS NOT NULL), 0)
$$;

COMMENT ON FUNCTION public.gc_owner_billing_revenue(uuid) IS
  'GC mode (O6b-2, widened by O8a): the billing job''s revenue, our price to the customer today (gc_owner_contract_now), every interest bill, and the billing job''s riders (job_rider_fees: the card fees and any returned check fee), so a payment marks the job paid only when all of them are in. The billing job''s Pipeline total; no GC figure reads it.';

-- finish and undo lay the revenue as the service role and the money team; the money team could already.
GRANT EXECUTE ON FUNCTION public.gc_owner_billing_revenue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_now(uuid) TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
