-- A card dispute or a failed bank debit on a Stripe bill (v2.4950, punch list #76 piece 1):
-- record_ar_stripe_case, the self-closes, put_back_lost_dispute_bill, the office's close and reopen,
-- and the list rows. One transaction that rolls back; raises on the first failed assertion; ends with
-- "ar_stripe_cases PASSED". See scripts/pgtest-ar-stripe-cases.sh. Never against prod.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('bed.today', '2026-10-09', true);

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.case_of(o text) RETURNS public.ar_stripe_cases LANGUAGE sql AS
  $$ SELECT * FROM public.ar_stripe_cases WHERE stripe_object_id = o $$;
-- Signs in as a person for the office's calls; service role otherwise.
CREATE FUNCTION bedt.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', u::text, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
CREATE FUNCTION bedt.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'service_role', true)
$$;
CREATE FUNCTION bedt.record(kind text, obj text, mode text, inv text, amount numeric, status text, reason text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.record_ar_stripe_case(kind, obj, mode, 'ch_' || obj, inv, amount, reason, status, '2026-10-20T00:00:00Z'::timestamptz, '2026-10-08T15:00:00Z'::timestamptz)
$$;

INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test', 'Bed Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test', 'Bed Sub', 'subcontractor');
INSERT INTO public.customers (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Owner Person'),
  ('00000000-0000-0000-0000-0000000000c3', 'Heron Construction');
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, customer_name, customer_id, gc_customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000a0001', '878', 'Take 5 Seguin', 'Owner Person', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', 'gc', 1000, 1000, 'paid'),
  ('00000000-0000-0000-0000-0000000a0002', '901', 'Elm repipe', 'Owner Person', '00000000-0000-0000-0000-0000000000c1', NULL, 'customer', 3000, 1000, 'billed');

-- B1 and B2 are Stripe bills on #878, each paid by card ($500 + $480 and a $20 out-of-band mark on B1).
-- B3, B4 and B5 are billed on #901; B6 is paid there.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, stripe_mode, hosted_invoice_url, stripe_invoice_status, external_send_channel, sent_to_customer_at) VALUES
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', 0, 'paid', 520, 'in_b1', 'test', 'https://invoice.stripe.com/b1', 'paid', 'stripe', '2026-09-01T00:00:00Z'),
  ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-0000000a0001', 1, 'paid', 480, 'in_b2', 'test', 'https://invoice.stripe.com/b2', 'paid', 'stripe', '2026-09-01T00:00:00Z'),
  ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-0000000a0002', 0, 'billed', 1000, 'in_b3', 'test', NULL, 'open', 'stripe', NULL),
  ('00000000-0000-0000-0000-0000000b0004', '00000000-0000-0000-0000-0000000a0002', 1, 'billed', 500, 'in_b4', 'test', NULL, 'open', 'stripe', NULL),
  ('00000000-0000-0000-0000-0000000b0005', '00000000-0000-0000-0000-0000000a0002', 2, 'billed', 500, 'in_b5', 'test', NULL, 'open', 'stripe', NULL),
  ('00000000-0000-0000-0000-0000000b0006', '00000000-0000-0000-0000-0000000a0002', 3, 'paid', 1000, 'in_b6', 'test', NULL, 'paid', 'stripe', NULL);
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on, note, sequence_order, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000b0001', 500, '2026-09-24', 'Stripe', 0, '2026-09-24T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000b0001', 20, '2026-09-25', 'check', 1, '2026-09-25T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000b0002', 480, '2026-09-24', 'Stripe', 2, '2026-09-24T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000b0006', 1000, '2026-09-20', 'Stripe', 0, '2026-09-20T15:00:00Z');

-- 1. A dispute on B1 opens a case on the card payment of its amount, not the $20 mark beside it.
SELECT bedt.as_service();
DO $$ DECLARE r jsonb := bedt.record('dispute', 'dp_1', 'test', 'in_b1', 500, 'needs_response', 'fraudulent'); BEGIN
  PERFORM bedt.ok('a dispute on a paid Stripe bill opens a case', (r->>'opened')::boolean AND NOT (r->>'lost_now')::boolean);
END $$;
SELECT bedt.ok('the case keeps the bill, the job and the $500 card payment',
  (bedt.case_of('dp_1')).invoice_id = '00000000-0000-0000-0000-0000000b0001'
  AND (bedt.case_of('dp_1')).job_id = '00000000-0000-0000-0000-0000000a0001'
  AND (bedt.case_of('dp_1')).payment_id = '00000000-0000-0000-0000-0000000000f1'
  AND (bedt.case_of('dp_1')).amount = 500 AND (bedt.case_of('dp_1')).reason = 'fraudulent');

-- 2. Stripe's later word on the same dispute updates it and opens nothing.
DO $$ DECLARE r jsonb := bedt.record('dispute', 'dp_1', 'test', 'in_b1', 500, 'under_review'); BEGIN
  PERFORM bedt.ok('the same dispute again opens nothing', NOT (r->>'opened')::boolean AND (SELECT count(*) FROM public.ar_stripe_cases WHERE stripe_object_id = 'dp_1') = 1);
END $$;
SELECT bedt.ok('its status follows Stripe and its reason stays', (bedt.case_of('dp_1')).stripe_status = 'under_review' AND (bedt.case_of('dp_1')).reason = 'fraudulent');

-- 3. Not ours, or the other mode: no case.
SELECT bedt.ok('an invoice no bill carries is skipped', bedt.record('dispute', 'dp_x', 'test', 'in_nobody', 10, 'needs_response')->>'skipped' = 'unknown_invoice');
SELECT bedt.ok('a live event on a test bill is skipped', bedt.record('dispute', 'dp_y', 'live', 'in_b2', 480, 'needs_response')->>'skipped' = 'mode_mismatch');

-- 4. The list: the case rides beside the checks, with what Stripe said.
SELECT bedt.ok('the list carries the dispute as stripe_dispute with its payment and Stripe''s word',
  EXISTS (
    SELECT 1 FROM public.list_ar_return_cases(false) l
    WHERE l.mercury_transaction_id = (bedt.case_of('dp_1')).id
      AND l.source = 'stripe_dispute' AND l.kind = 'card' AND l.counterparty_name = 'Heron Construction'
      AND l.bank_reason = 'fraudulent' AND l.amount = 500
      AND l.recorded_payment->>'payment_id' = '00000000-0000-0000-0000-0000000000f1'
      AND l.stripe_case->>'object_id' = 'dp_1' AND l.stripe_case->>'mode' = 'test' AND l.stripe_case->>'status' = 'under_review'
      AND (l.stripe_case->>'invoice_sequence_order')::int = 0 AND (l.stripe_case->>'payment_live')::boolean
      AND l.stripe_case->>'lost_at' IS NULL
  ));

-- 5. Before Stripe decides, the bill does not go back.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT bedt.ok('put back refuses a dispute Stripe has not decided', public.put_back_lost_dispute_bill((bedt.case_of('dp_1')).id)->>'error' LIKE 'Stripe has not decided%');

-- 6. Lost: stamped once, the case stays open.
SELECT bedt.as_service();
SELECT bedt.ok('a lost dispute is told once', (bedt.record('dispute', 'dp_1', 'test', 'in_b1', 500, 'lost')->>'lost_now')::boolean);
SELECT bedt.ok('a second lost is not news', NOT (bedt.record('dispute', 'dp_1', 'test', 'in_b1', 500, 'lost')->>'lost_now')::boolean);
SELECT bedt.ok('a lost dispute stays open with lost_at', (bedt.case_of('dp_1')).closed_at IS NULL AND (bedt.case_of('dp_1')).lost_at IS NOT NULL);

-- 7. Put the bill back: the office only.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SELECT bedt.ok('a sub cannot put a bill back', public.put_back_lost_dispute_bill((bedt.case_of('dp_1')).id)->>'error' = 'Not authorized');
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
DO $$ DECLARE r jsonb := public.put_back_lost_dispute_bill((bedt.case_of('dp_1')).id); BEGIN
  PERFORM bedt.ok('the press goes through', (r->>'ok')::boolean AND r->>'bill_status' = 'billed' AND (r->>'payments_made')::numeric = 500);
END $$;
SELECT bedt.ok('the card payment is off the job, the $20 mark stays',
  NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000f1')
  AND EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000f2'));
SELECT bedt.ok('its history keeps a removed line that names the dispute and who pressed it',
  EXISTS (SELECT 1 FROM public.jobs_ledger_payment_events
          WHERE kind = 'removed' AND payment_id = '00000000-0000-0000-0000-0000000000f1' AND amount = 500
            AND reason = 'stripe_dispute_lost: dp_1 · fraudulent' AND actor_name = 'Bed Assistant'));
SELECT bedt.ok('the bill drops its Stripe link and, holding the $20, reads Billed',
  EXISTS (SELECT 1 FROM public.jobs_ledger_invoices
          WHERE id = '00000000-0000-0000-0000-0000000b0001' AND status = 'billed' AND stripe_invoice_id IS NULL
            AND hosted_invoice_url IS NULL AND stripe_invoice_status IS NULL AND external_send_channel IS NULL AND sent_to_customer_at IS NULL));
SELECT bedt.ok('the job owes it again: payments made 500, back to Billed',
  EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000000a0001' AND payments_made = 500 AND status = 'billed'));
SELECT bedt.ok('the case closes as put back, not taken off', (bedt.case_of('dp_1')).closed_reason = 'put_back' AND (bedt.case_of('dp_1')).closed_by = '00000000-0000-0000-0000-0000000000a1');
SELECT bedt.ok('a second press finds no open dispute', public.put_back_lost_dispute_bill((bedt.case_of('dp_1')).id)->>'error' = 'Only an open dispute puts its bill back.');
SELECT bedt.ok('a bill put back cannot be reopened as a case', NOT EXISTS (
  SELECT 1 FROM public.ar_stripe_cases WHERE stripe_object_id = 'dp_1' AND closed_at IS NULL));

-- 8. A dispute on B2 lost and put back: B2 holds nothing else, so it goes back to Ready to Bill.
SELECT bedt.as_service();
SELECT bedt.record('dispute', 'dp_2', 'test', 'in_b2', 480, 'lost', 'product_not_received');
SELECT bedt.ok('a dispute opened already lost is stamped lost', (bedt.case_of('dp_2')).lost_at IS NOT NULL AND (bedt.case_of('dp_2')).closed_at IS NULL);
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT bedt.ok('put back on a bill with nothing else on it says Ready to Bill', public.put_back_lost_dispute_bill((bedt.case_of('dp_2')).id)->>'bill_status' = 'ready_to_bill');
SELECT bedt.ok('and the bill reads Ready to Bill with no Stripe link',
  EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = '00000000-0000-0000-0000-0000000b0002' AND status = 'ready_to_bill' AND stripe_invoice_id IS NULL));

-- 9. A dispute won closes as won; one whose payment comes off the job closes as taken off.
SELECT bedt.as_service();
SELECT bedt.record('dispute', 'dp_3', 'test', 'in_b6', 1000, 'needs_response');
SELECT bedt.ok('a won dispute closes as won', (bedt.record('dispute', 'dp_3', 'test', 'in_b6', 1000, 'won')->>'closed')::boolean AND (bedt.case_of('dp_3')).closed_reason = 'won');
SELECT bedt.ok('a won dispute stays closed when lost comes late and is not told', NOT (bedt.record('dispute', 'dp_3', 'test', 'in_b6', 1000, 'lost')->>'lost_now')::boolean AND (bedt.case_of('dp_3')).closed_reason = 'won');
SELECT bedt.ok('an inquiry closed before we heard of it opens nothing', bedt.record('dispute', 'dp_4', 'test', 'in_b6', 1000, 'warning_closed')->>'skipped' = 'already_won');
SELECT bedt.record('dispute', 'dp_5', 'test', 'in_b6', 1000, 'needs_response');
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000f6';
SELECT bedt.ok('a dispute whose payment comes off the job closes as taken off', (bedt.case_of('dp_5')).closed_reason = 'taken_off');

-- 10. A failed bank debit: open on a billed bill, closed by the bill.
SELECT bedt.ok('a failed debit on a billed bill opens a case without a payment', (bedt.record('debit_failed', 'pi_3', 'test', 'in_b3', 1000, 'failed', 'Insufficient funds')->>'opened')::boolean AND (bedt.case_of('pi_3')).payment_id IS NULL);
SELECT bedt.ok('the list carries it as stripe_debit with no recorded payment',
  EXISTS (SELECT 1 FROM public.list_ar_return_cases(false) l WHERE l.mercury_transaction_id = (bedt.case_of('pi_3')).id AND l.source = 'stripe_debit' AND l.kind = 'bank debit' AND l.recorded_payment IS NULL AND l.stripe_case->>'kind' = 'debit_failed'));
UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = '00000000-0000-0000-0000-0000000b0003';
SELECT bedt.ok('the bill paid after all closes it as paid', (bedt.case_of('pi_3')).closed_reason = 'paid');
SELECT bedt.record('debit_failed', 'pi_4', 'test', 'in_b4', 500, 'failed');
UPDATE public.jobs_ledger_invoices SET stripe_invoice_status = 'void' WHERE id = '00000000-0000-0000-0000-0000000b0004';
SELECT bedt.ok('the Stripe bill voided closes it as voided', (bedt.case_of('pi_4')).closed_reason = 'voided');
SELECT bedt.record('debit_failed', 'pi_5', 'test', 'in_b5', 500, 'failed');
DELETE FROM public.jobs_ledger_invoices WHERE id = '00000000-0000-0000-0000-0000000b0005';
SELECT bedt.ok('the bill sent back closes it as voided', (bedt.case_of('pi_5')).closed_reason = 'voided');
SELECT bedt.ok('a failed debit on a bill already paid opens nothing', bedt.record('debit_failed', 'pi_6', 'test', 'in_b6', 1000, 'failed')->>'skipped' = 'already_paid');

-- 11. The office's close and reopen.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, stripe_mode)
  VALUES ('00000000-0000-0000-0000-0000000b0007', '00000000-0000-0000-0000-0000000a0002', 4, 'billed', 300, 'in_b7', 'test');
SELECT bedt.record('debit_failed', 'pi_7', 'test', 'in_b7', 300, 'failed');
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT public.close_ar_stripe_case((bedt.case_of('pi_7')).id, 'settled_other_way', 'Paid by check Oct 9');
SELECT bedt.ok('the office closes a case with a note', (bedt.case_of('pi_7')).closed_reason = 'settled_other_way' AND (bedt.case_of('pi_7')).closed_note = 'Paid by check Oct 9');
SELECT public.reopen_ar_stripe_case((bedt.case_of('pi_7')).id);
SELECT bedt.ok('and opens it again', (bedt.case_of('pi_7')).closed_at IS NULL AND (bedt.case_of('pi_7')).closed_note IS NULL);
DO $$ BEGIN
  PERFORM public.reopen_ar_stripe_case((bedt.case_of('pi_3')).id);
  PERFORM bedt.ok('a case Stripe closed reopens', false);
EXCEPTION WHEN raise_exception THEN
  PERFORM bedt.ok('a case its bill closed does not reopen', SQLERRM = 'This case cannot be opened again.');
END $$;
DO $$ BEGIN
  PERFORM public.close_ar_stripe_case((bedt.case_of('pi_7')).id, 'won', NULL);
  PERFORM bedt.ok('the office closes as won', false);
EXCEPTION WHEN raise_exception THEN
  PERFORM bedt.ok('the office closes only as settled or not coming', SQLERRM LIKE '%settled_other_way or not_coming%');
END $$;

-- 12. Closed cases only with p_include_closed; the record write is the service role's alone.
SELECT bedt.ok('the open list holds the one open case', (SELECT count(*) FROM public.list_ar_return_cases(false) WHERE source LIKE 'stripe%') = 1);
SELECT bedt.ok('the full list holds every case', (SELECT count(*) FROM public.list_ar_return_cases(true) WHERE source LIKE 'stripe%') = 8);
SELECT bedt.ok('record_ar_stripe_case is not the office''s to call', NOT has_function_privilege('authenticated', 'public.record_ar_stripe_case(text, text, text, text, text, numeric, text, text, timestamptz, timestamptz)', 'EXECUTE'));

DO $$ BEGIN RAISE NOTICE 'ar_stripe_cases PASSED'; END $$;
ROLLBACK;
