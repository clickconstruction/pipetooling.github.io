SET lock_timeout = '3s';

-- A bill written down twice keeps the amount it stood at before its FIRST write-down (punch list #85, a residual of
-- the legal portal's review; the fault is in the money, not in the portal).
--
-- jobs_ledger_invoices.agreed_write_down_previous_amount is read everywhere as "what the bill was": the job's summary
-- and the legal desk take written off as that amount less the bill's amount, and the legal portal prints the bill
-- from it. Both writers set it to the bill's amount on EVERY write-down, so a second one replaced the first amount
-- with the amount in between: a bill of 500 written down to 450 and then to 400 read "was 450, written off 50".
--
-- Each function below is its live definition (md5 of pg_proc.prosrc on prod held against the repo's newest copy on
-- 2026-11-22: apply_agreed_write_down_to_billed_invoice from 20261119100000, a0546ee8...; service_apply_agreed_write_
-- down_from_stripe from the baseline, 66c0e234...) with ONE changed line:
--
--     agreed_write_down_previous_amount = GREATEST(COALESCE(agreed_write_down_previous_amount, v_old), v_old)
--
-- A first write-down stores the bill's amount, as before. A later one leaves the column alone. The one case where it
-- moves: a fee added after a write-down (a returned check fee, a card fee, a hazmat fee) has taken the bill above
-- the kept amount, and then the column takes the amount the bill stands at, since a "was" below the bill's own
-- amount reads as no write-down at all. The note, the time, the person and the Stripe credit note id still take the
-- newest write-down's.
--
-- No name, argument, returned shape or grant changes (CREATE OR REPLACE keeps grants and owner), and no reader
-- changes. The activity trigger (jobs_ledger_invoices_to_activity, 20260922100000) is untouched: it logs a bill's
-- first write-down, where the column and the amount before it are the same. No table is created. Idempotent.
-- On prod that day: four bills written down, none more than once, so no row needs its first amount put back.

-- ---------- apply_agreed_write_down_to_billed_invoice(uuid,numeric,text): the first amount is kept ----------

CREATE OR REPLACE FUNCTION public.apply_agreed_write_down_to_billed_invoice(p_invoice_id uuid, p_new_amount numeric, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_applied numeric;
  v_old numeric;
  v_note_trim text;
  v_eps constant numeric := 0.005;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  v_note_trim := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note_trim IS NULL OR length(v_note_trim) < 3 THEN
    RETURN jsonb_build_object('error', 'Note is required (at least 3 characters)');
  END IF;

  IF p_new_amount IS NULL OR p_new_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'New amount must be positive');
  END IF;

  SELECT
    i.id,
    i.job_id,
    i.amount,
    i.status,
    i.stripe_invoice_id
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status');
  END IF;

  IF COALESCE(trim(v_invoice.stripe_invoice_id), '') <> '' THEN
    RETURN jsonb_build_object(
      'error',
      'Stripe-hosted invoices must use the write-down flow (credit note).'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = v_invoice.job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary') AND public.is_job_people(j.id))
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to update this job');
  END IF;

  v_old := round(coalesce(v_invoice.amount, 0), 2);
  IF p_new_amount > v_old + v_eps THEN
    RETURN jsonb_build_object('error', 'New amount cannot exceed the current billed amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  IF p_new_amount + v_eps < round(v_applied, 2) THEN
    RETURN jsonb_build_object(
      'error',
      'New amount cannot be less than payments already applied to this invoice'
    );
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET
    amount = round(p_new_amount, 2),
    agreed_write_down_previous_amount = GREATEST(COALESCE(agreed_write_down_previous_amount, v_old), v_old),
    agreed_write_down_note = v_note_trim,
    agreed_write_down_at = now(),
    agreed_write_down_by = auth.uid(),
    agreed_write_down_stripe_credit_note_id = NULL,
    status = CASE
      WHEN round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN 'paid'::text
      ELSE status
    END
  WHERE id = p_invoice_id;

  IF round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN
    UPDATE public.jobs_ledger j
    SET
      status = CASE
        WHEN coalesce(j.revenue, 0) <= coalesce(j.payments_made, 0) + v_eps THEN 'paid'::text
        ELSE j.status
      END,
      updated_at = now()
    WHERE j.id = v_invoice.job_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- service_apply_agreed_write_down_from_stripe(uuid,numeric,text,text,uuid): the first amount is kept ----------

CREATE OR REPLACE FUNCTION public.service_apply_agreed_write_down_from_stripe(p_invoice_id uuid, p_new_amount numeric, p_note text, p_stripe_credit_note_id text, p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_applied numeric;
  v_old numeric;
  v_note_trim text;
  v_cn_trim text;
  v_eps constant numeric := 0.005;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing actor user id');
  END IF;

  v_note_trim := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note_trim IS NULL OR length(v_note_trim) < 3 THEN
    RETURN jsonb_build_object('error', 'Note is required (at least 3 characters)');
  END IF;

  v_cn_trim := NULLIF(trim(COALESCE(p_stripe_credit_note_id, '')), '');
  IF v_cn_trim IS NULL OR v_cn_trim !~ '^cn_' THEN
    RETURN jsonb_build_object('error', 'Valid Stripe credit note id (cn_…) is required');
  END IF;

  IF p_new_amount IS NULL OR p_new_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'New amount must be positive');
  END IF;

  SELECT
    i.id,
    i.job_id,
    i.amount,
    i.status,
    i.stripe_invoice_id
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status');
  END IF;

  IF COALESCE(trim(v_invoice.stripe_invoice_id), '') = '' THEN
    RETURN jsonb_build_object('error', 'Invoice has no Stripe invoice');
  END IF;

  v_old := round(coalesce(v_invoice.amount, 0), 2);
  IF p_new_amount > v_old + v_eps THEN
    RETURN jsonb_build_object('error', 'New amount cannot exceed the current billed amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  IF p_new_amount + v_eps < round(v_applied, 2) THEN
    RETURN jsonb_build_object(
      'error',
      'New amount cannot be less than payments already applied to this invoice'
    );
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET
    amount = round(p_new_amount, 2),
    agreed_write_down_previous_amount = GREATEST(COALESCE(agreed_write_down_previous_amount, v_old), v_old),
    agreed_write_down_note = v_note_trim,
    agreed_write_down_at = now(),
    agreed_write_down_by = p_actor_user_id,
    agreed_write_down_stripe_credit_note_id = v_cn_trim,
    status = CASE
      WHEN round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN 'paid'::text
      ELSE status
    END
  WHERE id = p_invoice_id;

  IF round(v_applied, 2) >= round(p_new_amount, 2) - v_eps THEN
    UPDATE public.jobs_ledger j
    SET
      status = CASE
        WHEN coalesce(j.revenue, 0) <= coalesce(j.payments_made, 0) + v_eps THEN 'paid'::text
        ELSE j.status
      END,
      updated_at = now()
    WHERE j.id = v_invoice.job_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

COMMENT ON COLUMN public.jobs_ledger_invoices.agreed_write_down_previous_amount IS
  'The bill''s amount (USD) before its first agreed write-down. A later write-down leaves it alone (v2.8305), so amount less than this is everything written off; it moves up only when fees have taken the bill above it.';
