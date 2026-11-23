SET lock_timeout = '3s';

-- Bills sent, punch list #422 (v2.8371): the Stripe payments filed a day late before 20261123074206 go back to the
-- day they were made, on the owner's word (2026-11-23).
--
-- Until 20261123074206, mark_invoice_paid_from_stripe dated a customer's own Stripe payment with the UTC clock's
-- date, so a payment made in the evening, Central time, was filed on the next day. That migration files the
-- company's day (public.app_today()) from then on. This one moves the rows written before it.
--
-- A row moves only when it carries every mark of that function's own write for a customer's payment, made in the
-- evening, before the fix:
--   * it is on a bill, its note is the function's 'Stripe', and it has no payment type, number or recorder (a bill
--     marked paid outside Stripe names those, and its day was named by a person);
--   * its day is the UTC date of the moment it was written, and that is not the company's date of that moment;
--   * it was written before 2026-11-23, the company's day the fix went in.
-- It moves to the company's date of the moment it was written, in the zone public.app_today() reads: one day back.
-- No amount, bill or job changes. No trigger on the table reads paid_on, and none on an update writes an email,
-- an activity line or a payment event. A paper already sent keeps the day it said.
--
-- On prod six rows match (read 2026-11-23). The update refuses to move more than six, so a row nobody has read is
-- never moved: the refusal rolls the whole update back. On a fresh database (a SQL bed, a local reset) nothing
-- matches and nothing moves. A second run moves nothing, since a moved row's day is no longer the UTC date.
DO $$
DECLARE
  v_moved integer;
BEGIN
  UPDATE public.jobs_ledger_payments p
     SET paid_on = (p.created_at AT TIME ZONE 'America/Chicago')::date
   WHERE p.invoice_id IS NOT NULL
     AND p.note = 'Stripe'
     AND p.payment_type IS NULL
     AND p.reference_number IS NULL
     AND p.created_by IS NULL
     AND p.paid_on = (p.created_at AT TIME ZONE 'UTC')::date
     AND p.paid_on <> (p.created_at AT TIME ZONE 'America/Chicago')::date
     AND (p.created_at AT TIME ZONE 'America/Chicago')::date < DATE '2026-11-23';
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_moved > 6 THEN
    RAISE EXCEPTION 'stripe paid day: % rows match, more than the six read on 2026-11-23, so none is moved', v_moved
      USING HINT = 'Read the rows again and write a new migration for the ones found.';
  END IF;

  RAISE NOTICE 'stripe paid day: % Stripe payment row(s) moved back to the day they were made', v_moved;
END $$;
