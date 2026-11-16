-- Supply house payments, the ground (20261116230000). Each block raises on its first failed check.
-- Run after 00_schema, the baseline's two invoice triggers, 10_seed_before and the migration (twice).

CREATE OR REPLACE FUNCTION pg_temp.expect(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_what; END IF;
END;
$$;

-- A statement that must be refused, with words from the reason.
CREATE OR REPLACE FUNCTION pg_temp.refused(p_sql text, p_words text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(p_words IN SQLERRM) = 0 THEN RAISE EXCEPTION 'FAILED: refused with "%", wanted "%"', SQLERRM, p_words; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAILED: was not refused: %', p_sql;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.bill(p_number text, p_amount numeric, p_house uuid DEFAULT '00000000-0000-0000-0000-0000000000b1') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.supply_house_invoices (supply_house_id, invoice_number, amount, document_kind)
  VALUES (p_house, p_number, p_amount, CASE WHEN p_amount < 0 THEN 'credit' ELSE 'invoice' END) RETURNING id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.paid(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT is_paid FROM public.supply_house_invoices WHERE id = p_id $$;
CREATE OR REPLACE FUNCTION pg_temp.paid_day(p_id uuid) RETURNS date LANGUAGE sql AS $$ SELECT (paid_at AT TIME ZONE 'America/Chicago')::date FROM public.supply_house_invoices WHERE id = p_id $$;
CREATE OR REPLACE FUNCTION pg_temp.on_bill(p_id uuid) RETURNS numeric LANGUAGE sql AS $$
  SELECT COALESCE(SUM(l.amount), 0) FROM public.supply_house_payment_lines l JOIN public.supply_house_payments p ON p.id = l.payment_id WHERE l.invoice_id = p_id AND p.removed_at IS NULL $$;
CREATE OR REPLACE FUNCTION pg_temp.on_account(p_payment uuid) RETURNS numeric LANGUAGE sql AS $$
  SELECT p.amount - COALESCE((SELECT SUM(l.amount) FROM public.supply_house_payment_lines l WHERE l.payment_id = p.id), 0) FROM public.supply_house_payments p WHERE p.id = p_payment $$;

-- ── A. The backfill ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v record;
BEGIN
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments) = 3, 'three paid bills above zero, three payments, after two runs');
  SELECT p.* INTO v FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = '00000000-0000-0000-0000-000000000c07';
  PERFORM pg_temp.expect(v.amount = 12.00 AND v.paid_on = '2026-09-30', 'a paid bill with no paid day takes the day it was last changed, and its row is not written');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments WHERE source <> 'before' OR method IS NOT NULL OR created_by IS NOT NULL) = 0, 'each is from before, with no method and nobody''s name');
  SELECT p.* INTO v FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = '00000000-0000-0000-0000-000000000c01';
  PERFORM pg_temp.expect(v.amount = 100.00 AND v.paid_on = '2026-10-05' AND v.receipt_link IS NULL, 'OLD-1: its whole amount on its paid day');
  SELECT p.* INTO v FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = '00000000-0000-0000-0000-000000000c02';
  PERFORM pg_temp.expect(v.amount = 30.00 AND v.paid_on = '2026-10-06' AND v.receipt_link = 'https://example.test/receipt', 'OLD-2: the day in the company''s time zone, the link trimmed');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id IN ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05')) = 0, 'no line on the open bill, the paid credit or the $0.00 bill');
  -- The backfill changed nothing a reader already reads: what each bill said before, it says now.
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices WHERE amount_paid IS DISTINCT FROM pg_temp.on_bill(id)) = 0, 'and each bill''s amount_paid is what its payment put on it');
  PERFORM pg_temp.expect((SELECT amount_paid FROM public.supply_house_invoices WHERE id = '00000000-0000-0000-0000-000000000c01') = 100.00, 'OLD-1 reads 100 paid');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices i JOIN pg_temp.before b ON b.id = i.id WHERE i.is_paid IS DISTINCT FROM b.is_paid OR i.paid_at IS DISTINCT FROM b.paid_at OR i.updated_at IS DISTINCT FROM b.updated_at) = 0, 'no bill row was written by the backfill');
  RAISE NOTICE 'A backfill PASSED';
END;
$$;

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

-- ── B. Mark paid and Mark not paid, by hand ─────────────────────────────────────────────────────
DO $$
DECLARE b uuid := '00000000-0000-0000-0000-000000000c03'; v record;
BEGIN
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = b;
  SELECT p.* INTO v FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = b;
  PERFORM pg_temp.expect(v.source = 'mark_paid' AND v.amount = 50.00 AND v.method IS NULL AND v.created_by_name = 'Dana Whitfield', 'Mark paid makes a payment for the bill, with no method, in the person''s name');
  PERFORM pg_temp.expect(v.paid_on = (now() AT TIME ZONE 'America/Chicago')::date AND pg_temp.paid_day(b) = v.paid_on, 'on today, and the bill''s paid day agrees');
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id = b;
  PERFORM pg_temp.expect(NOT pg_temp.paid(b) AND pg_temp.paid_day(b) IS NULL AND pg_temp.on_bill(b) = 0, 'Mark not paid: not paid, no day, nothing on the bill');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments WHERE source = 'mark_paid') = 0, 'and its payment is gone');

  -- A typed paid day, then the day and the amount edited: the press payment follows its bill.
  UPDATE public.supply_house_invoices SET is_paid = true, paid_at = '2026-11-03 18:00:00+00' WHERE id = b;
  PERFORM pg_temp.expect((SELECT paid_on FROM public.supply_house_payments WHERE source = 'mark_paid') = '2026-11-03', 'the typed paid day is the payment''s day');
  UPDATE public.supply_house_invoices SET paid_at = '2026-11-05 18:00:00+00' WHERE id = b;
  PERFORM pg_temp.expect((SELECT paid_on FROM public.supply_house_payments WHERE source = 'mark_paid') = '2026-11-05' AND pg_temp.paid_day(b) = '2026-11-05', 'an edited paid day moves the payment');
  UPDATE public.supply_house_invoices SET amount = 60.00 WHERE id = b;
  PERFORM pg_temp.expect(pg_temp.paid(b) AND pg_temp.on_bill(b) = 60.00 AND (SELECT amount FROM public.supply_house_payments WHERE source = 'mark_paid') = 60.00, 'the amount raised: the payment follows and the bill stays paid');
  UPDATE public.supply_house_invoices SET amount = 40.00 WHERE id = b;
  PERFORM pg_temp.expect(pg_temp.paid(b) AND pg_temp.on_bill(b) = 40.00 AND (SELECT amount FROM public.supply_house_payments WHERE source = 'mark_paid') = 40.00, 'the amount lowered: the payment follows');
  -- A bill from before follows the same way.
  UPDATE public.supply_house_invoices SET amount = 110.00 WHERE id = '00000000-0000-0000-0000-000000000c01';
  PERFORM pg_temp.expect(pg_temp.paid('00000000-0000-0000-0000-000000000c01') AND pg_temp.on_bill('00000000-0000-0000-0000-000000000c01') = 110.00, 'a bill from before keeps reading paid when its amount is corrected');
  -- A bill typed in as already paid.
  INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, amount, is_paid, paid_at) VALUES ('00000000-0000-0000-0000-000000000c06', '00000000-0000-0000-0000-0000000000b1', 'NEW-PAID', 75.00, true, '2026-11-10 18:00:00+00');
  PERFORM pg_temp.expect(pg_temp.on_bill('00000000-0000-0000-0000-000000000c06') = 75.00 AND (SELECT p.paid_on FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = '00000000-0000-0000-0000-000000000c06') = '2026-11-10', 'a bill saved as paid gets its payment on the typed day');
  -- The credit and the $0.00 bill are marked by hand as they always were.
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id IN ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05');
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id IN ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05');
  PERFORM pg_temp.expect(pg_temp.paid('00000000-0000-0000-0000-000000000c04') AND pg_temp.paid('00000000-0000-0000-0000-000000000c05') AND (SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id IN ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05')) = 0, 'a credit and a $0.00 bill keep their by-hand state and get no payment');
  RAISE NOTICE 'B by hand PASSED';
END;
$$;

-- ── C. One payment over several bills, a part payment, and the refusals ─────────────────────────
DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b1';
  x uuid := pg_temp.bill('X-300', 300); y uuid := pg_temp.bill('Y-200', 200); z uuid := pg_temp.bill('Z-100', 100);
  other uuid := pg_temp.bill('OTHER', 80, '00000000-0000-0000-0000-0000000000b2');
  r jsonb; p1 uuid; p2 uuid;
BEGIN
  r := public.record_supply_house_payment(h, '2026-11-12', 450, jsonb_build_array(jsonb_build_object('invoice_id', x, 'amount', 300), jsonb_build_object('invoice_id', y, 'amount', 150)), 'ach', ' 88213 ', NULL, NULL);
  p1 := (r->>'payment_id')::uuid;
  PERFORM pg_temp.expect((r->>'lines')::int = 2 AND (r->>'placed')::numeric = 450 AND (r->>'on_account')::numeric = 0, 'the reply counts the lines and the money placed');
  PERFORM pg_temp.expect((SELECT method = 'ach' AND method_ref = '88213' AND source = 'recorded' AND created_by_name = 'Dana Whitfield' FROM public.supply_house_payments WHERE id = p1), 'the payment keeps how it was sent, its number trimmed');
  PERFORM pg_temp.expect(pg_temp.paid(x) AND pg_temp.paid_day(x) = '2026-11-12', 'the bill paid whole reads paid on the payment''s day');
  PERFORM pg_temp.expect(NOT pg_temp.paid(y) AND pg_temp.on_bill(y) = 150, 'the bill paid in part stays open with 150 on it');
  PERFORM pg_temp.expect((SELECT amount - amount_paid FROM public.supply_house_invoices WHERE id = y) = 50, 'and its row says 50 is open');
  r := public.record_supply_house_payment(h, '2026-11-14', 50, jsonb_build_array(jsonb_build_object('invoice_id', y, 'amount', 50)), 'card', '4410');
  p2 := (r->>'payment_id')::uuid;
  PERFORM pg_temp.expect(pg_temp.paid(y) AND pg_temp.paid_day(y) = '2026-11-14', 'the rest paid later: paid on the later day');

  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 50, %L::jsonb)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', z, 'amount', 60))), 'come to 60.00 and 50.00 was sent');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 90, %L::jsonb)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', z, 'amount', 60))), 'keep the 30.00 left on account');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 120, %L::jsonb)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', z, 'amount', 120))), 'bill Z-100 is for 100.00');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 80, %L::jsonb)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', other, 'amount', 80))), 'belongs to another supply house');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 10, %L::jsonb)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', x, 'amount', 10))), 'bill X-300 is for 300.00');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, NULL, 10, %L::jsonb)', h, '[]'), 'needs the day');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 10, %L::jsonb, %L)', h, '2026-11-14', jsonb_build_array(jsonb_build_object('invoice_id', z, 'amount', 10)), 'zelle'), 'one of card, ach, check, cash or other');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 0, %L::jsonb)', h, '2026-11-14', '[]'), 'needs an amount or a bill');
  PERFORM pg_temp.expect(NOT pg_temp.paid(z) AND pg_temp.on_bill(z) = 0, 'a refused payment leaves nothing behind');

  -- A typed payment's day moved: its bills follow. Removed: its bills read open. Put back: paid.
  UPDATE public.supply_house_payments SET paid_on = '2026-11-13' WHERE id = p1;
  PERFORM pg_temp.expect(pg_temp.paid_day(x) = '2026-11-13' AND pg_temp.paid_day(y) = '2026-11-14', 'the day moved on a payment moves its bill; a bill with a later payment keeps the later day');
  UPDATE public.supply_house_payments SET removed_at = now() WHERE id = p1;
  PERFORM pg_temp.expect(NOT pg_temp.paid(x) AND NOT pg_temp.paid(y) AND pg_temp.on_bill(y) = 50, 'a removed payment counts for nothing');
  UPDATE public.supply_house_payments SET removed_at = NULL WHERE id = p1;
  PERFORM pg_temp.expect(pg_temp.paid(x) AND pg_temp.paid(y), 'put back, its bills read paid again');
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_payments SET amount = 400 WHERE id = %L', p1), 'has 450.00 on its bills');

  -- The amount of a bill on a typed payment is corrected: the lines are what was sent, so it reads part paid.
  UPDATE public.supply_house_invoices SET amount = 320 WHERE id = x;
  PERFORM pg_temp.expect(NOT pg_temp.paid(x) AND pg_temp.on_bill(x) = 300, 'a bill raised past its typed payment reads open by the difference');
  UPDATE public.supply_house_invoices SET amount = 300 WHERE id = x;
  PERFORM pg_temp.expect(pg_temp.paid(x), 'and paid again when the amount comes back');

  -- Mark paid on a part-paid bill pays what is open; Mark not paid takes only that press away.
  UPDATE public.supply_house_payment_lines SET amount = 120 WHERE payment_id = p1 AND invoice_id = y;
  PERFORM pg_temp.expect(NOT pg_temp.paid(y) AND pg_temp.on_account(p1) = 30, 'a line lowered: the bill opens and the difference waits on account');
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = y;
  PERFORM pg_temp.expect((SELECT p.amount FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = y AND p.source = 'mark_paid') = 30, 'Mark paid on a part-paid bill makes a payment for the 30 open');
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id = y;
  PERFORM pg_temp.expect(NOT pg_temp.paid(y) AND pg_temp.on_bill(y) = 170, 'Mark not paid takes the press away and leaves the typed lines');

  -- Mark not paid on a bill a typed payment covers: refused with the reason, and nothing changes.
  -- (Letting it through, then Mark paid again, would count the same money twice.)
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET is_paid = false WHERE id = %L', x), 'was paid by a payment recorded for this supply house');
  PERFORM pg_temp.expect(pg_temp.paid(x) AND pg_temp.on_bill(x) = 300 AND pg_temp.on_account(p1) = 30, 'the typed payment and its bill stand as they were');
  PERFORM pg_temp.expect((SELECT amount FROM public.supply_house_payments WHERE id = p1) = 450, 'and it still reads 450 sent');

  -- A bill with a typed payment stays at its house; a bill with only a press payment takes it along.
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET supply_house_id = %L WHERE id = %L', '00000000-0000-0000-0000-0000000000b2', y), 'take the payment off before moving');
  UPDATE public.supply_house_invoices SET supply_house_id = '00000000-0000-0000-0000-0000000000b2' WHERE id = '00000000-0000-0000-0000-000000000c06';
  PERFORM pg_temp.expect((SELECT p.supply_house_id FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id = '00000000-0000-0000-0000-000000000c06') = '00000000-0000-0000-0000-0000000000b2', 'a press payment moves house with its bill');

  -- A bill deleted: a press payment goes with it, a typed payment keeps its money on account.
  DELETE FROM public.supply_house_invoices WHERE id = '00000000-0000-0000-0000-000000000c06';
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments WHERE supply_house_id = '00000000-0000-0000-0000-0000000000b2') = 0, 'a deleted bill takes its press payment');
  DELETE FROM public.supply_house_invoices WHERE id = y;
  PERFORM pg_temp.expect(pg_temp.on_account(p1) = 150 AND pg_temp.on_account(p2) = 50 AND pg_temp.paid(x), 'a deleted bill leaves a typed payment whole, its money on account');
  -- A typed payment deleted outright: its bills read open again.
  DELETE FROM public.supply_house_payments WHERE id = p1;
  PERFORM pg_temp.expect(NOT pg_temp.paid(x) AND pg_temp.on_bill(x) = 0, 'a deleted payment opens its bills');
  RAISE NOTICE 'C payments PASSED';
END;
$$;

-- ── D. Money on account, placed later ───────────────────────────────────────────────────────────
DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b2';
  a uuid := pg_temp.bill('A-100', 100, h); b uuid := pg_temp.bill('B-150', 150, h);
  r jsonb; p uuid;
BEGIN
  r := public.record_supply_house_payment(h, '2026-11-01', 500, jsonb_build_array(jsonb_build_object('invoice_id', a, 'amount', 100)), 'ach', NULL, NULL, NULL, true);
  p := (r->>'payment_id')::uuid;
  PERFORM pg_temp.expect((r->>'on_account')::numeric = 400 AND pg_temp.on_account(p) = 400 AND pg_temp.paid(a), '400 of a 500 payment waits on account');
  -- A round sum with no bill at all.
  r := public.record_supply_house_payment(h, '2026-11-02', 25, '[]'::jsonb, 'check', '1187', NULL, NULL, true);
  PERFORM pg_temp.expect((r->>'on_account')::numeric = 25, 'a round sum with no bill is kept on account');
  -- The money on account goes on a bill: a line of the earlier payment, and no new payment row.
  r := public.record_supply_house_payment(h, '2026-11-20', 0, '[]'::jsonb, NULL, NULL, NULL, NULL, false, jsonb_build_array(jsonb_build_object('payment_id', p, 'invoice_id', b, 'amount', 150)));
  PERFORM pg_temp.expect(r->>'payment_id' IS NULL AND (r->>'placed_from_account')::numeric = 150, 'no new payment when only money on account is placed');
  PERFORM pg_temp.expect(pg_temp.paid(b) AND pg_temp.paid_day(b) = '2026-11-01' AND pg_temp.on_account(p) = 250, 'the bill is paid by the earlier payment, on its day, and 250 still waits');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 0, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb)', h, '2026-11-20', '[]', jsonb_build_array(jsonb_build_object('payment_id', p, 'invoice_id', a, 'amount', 300))), 'has 250.00 on account and 300.00 was asked for');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 0, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb)', '00000000-0000-0000-0000-0000000000b1', '2026-11-20', '[]', jsonb_build_array(jsonb_build_object('payment_id', p, 'invoice_id', a, 'amount', 10))), 'not found at this supply house');
  RAISE NOTICE 'D on account PASSED';
END;
$$;

-- ── E. A credit memo as a line ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b2';
  m uuid := pg_temp.bill('M-300', 300, h); c uuid := pg_temp.bill('CM-50', -50, h);
  n uuid := pg_temp.bill('N-40', 40, h); c2 uuid := pg_temp.bill('CM-40', -40, h);
  r jsonb; p uuid;
BEGIN
  r := public.record_supply_house_payment(h, '2026-11-15', 250, jsonb_build_array(jsonb_build_object('invoice_id', m, 'amount', 300), jsonb_build_object('invoice_id', c, 'amount', -50)), 'ach');
  p := (r->>'payment_id')::uuid;
  PERFORM pg_temp.expect(pg_temp.paid(m) AND pg_temp.paid(c) AND pg_temp.on_account(p) = 0, '250 sent and a 50 credit pay a 300 bill; the credit reads used');
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET is_paid = false WHERE id = %L', c), 'was used on a payment');
  PERFORM pg_temp.refused(format('DELETE FROM public.supply_house_invoices WHERE id = %L', c), 'would come to 300.00 and 250.00 was sent');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 10, %L::jsonb)', h, '2026-11-15', jsonb_build_array(jsonb_build_object('invoice_id', c2, 'amount', 10))), 'a credit memo an amount below zero');
  -- A credit that covers a bill whole: nothing sent, both read settled.
  r := public.record_supply_house_payment(h, '2026-11-16', 0, jsonb_build_array(jsonb_build_object('invoice_id', n, 'amount', 40), jsonb_build_object('invoice_id', c2, 'amount', -40)));
  PERFORM pg_temp.expect(pg_temp.paid(n) AND pg_temp.paid(c2) AND (SELECT amount FROM public.supply_house_payments WHERE id = (r->>'payment_id')::uuid) = 0, 'a credit that covers a bill whole is a payment of $0.00');
  -- The payment removed: the bill and the credit both open again.
  UPDATE public.supply_house_payments SET removed_at = now() WHERE id = p;
  PERFORM pg_temp.expect(NOT pg_temp.paid(m) AND NOT pg_temp.paid(c), 'removing the payment opens the bill and the credit');
  RAISE NOTICE 'E credits PASSED';
END;
$$;

-- ── F. What the review of 2026-11-16 found, each closed ─────────────────────────────────────────
DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b1';
  h2 uuid := '00000000-0000-0000-0000-0000000000b2';
  r1 uuid := pg_temp.bill('R1-300', 300); t1 uuid := pg_temp.bill('T1-300', 300); t2 uuid := pg_temp.bill('T2-90', 90);
  g1 uuid := pg_temp.bill('G1-100', 100); g2 uuid := pg_temp.bill('G2-100', 100); g3 uuid := pg_temp.bill('G3-100', 100);
  m1 uuid := pg_temp.bill('MV-70', 70); k1 uuid := pg_temp.bill('K1-60', 60); a1 uuid := pg_temp.bill('AP-10', 10); a2 uuid := pg_temp.bill('AP-20', 20);
  uc uuid := pg_temp.bill('CM-USED', -50); ub uuid := pg_temp.bill('UB-50', 50);
  r jsonb; p uuid; pt uuid; pm uuid; pk uuid;
BEGIN
  -- A removed payment is put back only whole: its bill was paid by hand in the meantime.
  r := public.record_supply_house_payment(h, '2026-11-12', 300, jsonb_build_array(jsonb_build_object('invoice_id', r1, 'amount', 300)), 'ach');
  p := (r->>'payment_id')::uuid;
  UPDATE public.supply_house_payments SET removed_at = now() WHERE id = p;
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = r1;
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_payments SET removed_at = NULL WHERE id = %L', p), 'has been paid or changed since this payment was removed');
  PERFORM pg_temp.expect(pg_temp.on_bill(r1) = 300 AND pg_temp.paid(r1), 'the bill carries its 300 once');

  -- Not paid and a new amount in one statement, as the invoice form sends them: the press goes.
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = g1;
  UPDATE public.supply_house_invoices SET is_paid = false, amount = 150 WHERE id = g1;
  PERFORM pg_temp.expect(NOT pg_temp.paid(g1) AND (SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id = g1) = 0, 'not paid with a raised amount leaves no press behind');

  -- A bill lowered under its typed line: the line is trimmed and the difference waits on account.
  r := public.record_supply_house_payment(h, '2026-11-12', 390, jsonb_build_array(jsonb_build_object('invoice_id', t1, 'amount', 300), jsonb_build_object('invoice_id', t2, 'amount', 90)), 'check', '1187');
  pt := (r->>'payment_id')::uuid;
  UPDATE public.supply_house_invoices SET amount = 250 WHERE id = t1;
  PERFORM pg_temp.expect(pg_temp.paid(t1) AND pg_temp.on_bill(t1) = 250 AND pg_temp.on_account(pt) = 50, 'a bill lowered to 250 keeps 250 on it; 50 waits on account');
  -- Set to nothing: a typed line comes off whole, a press goes.
  UPDATE public.supply_house_invoices SET amount = 0 WHERE id = t2;
  PERFORM pg_temp.expect(pg_temp.on_bill(t2) = 0 AND pg_temp.on_account(pt) = 140 AND pg_temp.paid(t2), 'a bill set to $0.00 lets go of its typed line and keeps the state it was written with');
  PERFORM pg_temp.expect((SELECT amount_paid FROM public.supply_house_invoices WHERE id = t2) = 0, 'and its amount_paid is cleared');
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = g2;
  UPDATE public.supply_house_invoices SET amount = 0 WHERE id = g2;
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id = g2) = 0 AND pg_temp.paid(g2), 'a paid bill set to $0.00 loses its press and stays marked');
  -- A $0.00 bill marked paid, then given an amount: a payment is made for it.
  UPDATE public.supply_house_invoices SET amount = 25 WHERE id = g2;
  PERFORM pg_temp.expect(pg_temp.paid(g2) AND pg_temp.on_bill(g2) = 25, 'a paid $0.00 bill given an amount gets a payment for it');
  UPDATE public.supply_house_invoices SET amount = 25, is_paid = true WHERE id = '00000000-0000-0000-0000-000000000c05';
  PERFORM pg_temp.expect(pg_temp.paid('00000000-0000-0000-0000-000000000c05') AND pg_temp.on_bill('00000000-0000-0000-0000-000000000c05') = 25, 'so does the paid $0.00 bill from before');
  -- An invoice retyped as a credit memo: its press goes, and it keeps its by-hand state.
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = g3;
  UPDATE public.supply_house_invoices SET amount = -100, document_kind = 'credit' WHERE id = g3;
  PERFORM pg_temp.expect(pg_temp.paid(g3) AND (SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id = g3) = 0, 'an invoice retyped as a credit memo has no payment on it and stays marked');
  -- A credit memo marked used by hand, retyped as a paid invoice: a payment is made for it.
  UPDATE public.supply_house_invoices SET amount = 20, document_kind = 'invoice' WHERE id = '00000000-0000-0000-0000-000000000c04';
  PERFORM pg_temp.expect(pg_temp.paid('00000000-0000-0000-0000-000000000c04') AND pg_temp.on_bill('00000000-0000-0000-0000-000000000c04') = 20, 'a used credit memo retyped as a paid invoice gets its payment');

  -- A credit memo a payment has used cannot be lowered or turned into an invoice; one marked used by hand takes no line.
  PERFORM public.record_supply_house_payment(h, '2026-11-12', 0, jsonb_build_array(jsonb_build_object('invoice_id', ub, 'amount', 50), jsonb_build_object('invoice_id', uc, 'amount', -50)));
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET amount = -30 WHERE id = %L', uc), 'take it off the payment before lowering it');
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET amount = 30, document_kind = %L WHERE id = %L', 'invoice', uc), 'take it off the payment before changing it');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 80, %L::jsonb)', h, '2026-11-12', jsonb_build_array(jsonb_build_object('invoice_id', g1, 'amount', 150), jsonb_build_object('invoice_id', g3, 'amount', -70))), 'is already marked used');

  -- A bill whose only line belongs to a removed payment may move house; the payment then cannot come back.
  r := public.record_supply_house_payment(h, '2026-11-12', 70, jsonb_build_array(jsonb_build_object('invoice_id', m1, 'amount', 70)), 'cash');
  pm := (r->>'payment_id')::uuid;
  UPDATE public.supply_house_payments SET removed_at = now() WHERE id = pm;
  UPDATE public.supply_house_invoices SET supply_house_id = h2 WHERE id = m1;
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_payments SET removed_at = NULL WHERE id = %L', pm), 'has moved to another supply house');

  -- Mark not paid leaves a removed press where it is: its removal is a record.
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = k1;
  SELECT payment_id INTO pk FROM public.supply_house_payment_lines WHERE invoice_id = k1;
  UPDATE public.supply_house_payments SET removed_at = now() WHERE id = pk;
  PERFORM pg_temp.expect(NOT pg_temp.paid(k1), 'a removed press opens its bill');
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = k1;
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id = k1;
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments WHERE id = pk) = 1 AND (SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id = k1) = 1, 'the removed press is kept; the live one is gone');

  -- An older client's Apply Payment: several bills and a link in one statement.
  UPDATE public.supply_house_invoices SET is_paid = true, payment_link = 'https://example.test/apply' WHERE id IN (a1, a2);
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments p JOIN public.supply_house_payment_lines l ON l.payment_id = p.id WHERE l.invoice_id IN (a1, a2) AND p.source = 'mark_paid' AND p.receipt_link = 'https://example.test/apply' AND p.amount = l.amount) = 2, 'each bill of an Apply Payment gets its payment, with the link');
  RAISE NOTICE 'F review findings PASSED';
END;
$$;

-- ── G. Only the office, by the function's own check and by the tables' policies ─────────────────
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
DO $$
BEGIN
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 10, %L::jsonb, NULL, NULL, NULL, NULL, true)', '00000000-0000-0000-0000-0000000000b1', '2026-11-16', '[]'), 'only the office');
END;
$$;

-- As the API's role, with row-level security on. No helper here: the temp schema is the bed owner's.
SET ROLE authenticated;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.supply_house_payments;
  IF n <> 0 THEN RAISE EXCEPTION 'FAILED: a sub reads % payments', n; END IF;
  SELECT count(*) INTO n FROM public.supply_house_payment_lines;
  IF n <> 0 THEN RAISE EXCEPTION 'FAILED: a sub reads % lines', n; END IF;
  BEGIN
    INSERT INTO public.supply_house_payments (supply_house_id, paid_on, amount) VALUES ('00000000-0000-0000-0000-0000000000b1', '2026-11-16', 1);
    RAISE EXCEPTION 'FAILED: a sub inserted a payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.supply_house_invoice_sync_paid('00000000-0000-0000-0000-000000000c01');
    RAISE EXCEPTION 'FAILED: the sync is callable from the API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
DO $$
DECLARE n integer; b uuid; r jsonb;
BEGIN
  SELECT count(*) INTO n FROM public.supply_house_payments;
  IF n = 0 THEN RAISE EXCEPTION 'FAILED: the office reads no payments'; END IF;
  -- The office's own writes run the definer triggers: a Mark paid and a recorded payment both land.
  INSERT INTO public.supply_house_invoices (supply_house_id, invoice_number, amount) VALUES ('00000000-0000-0000-0000-0000000000b1', 'RLS-1', 40) RETURNING id INTO b;
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = b;
  IF (SELECT count(*) FROM public.supply_house_payment_lines WHERE invoice_id = b) <> 1 THEN RAISE EXCEPTION 'FAILED: Mark paid as the office made no payment'; END IF;
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id = b;
  r := public.record_supply_house_payment('00000000-0000-0000-0000-0000000000b1', '2026-11-16', 40, jsonb_build_array(jsonb_build_object('invoice_id', b, 'amount', 40)), 'card');
  IF NOT (SELECT is_paid FROM public.supply_house_invoices WHERE id = b) THEN RAISE EXCEPTION 'FAILED: a payment recorded as the office did not pay its bill'; END IF;
END;
$$;
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'G office only PASSED'; END; $$;

-- ── H. The whole bed agrees with itself, and a supply house deletes cleanly ─────────────────────
DO $$
BEGIN
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_invoices i
     WHERE i.amount > 0 AND i.is_paid IS DISTINCT FROM (pg_temp.on_bill(i.id) >= i.amount - 0.005)
  ) = 0, 'every bill above zero reads paid exactly when its lines cover it');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_invoices i
     WHERE (i.amount > 0 AND pg_temp.on_bill(i.id) > i.amount + 0.005) OR (i.amount < 0 AND pg_temp.on_bill(i.id) < i.amount - 0.005) OR (i.amount = 0 AND pg_temp.on_bill(i.id) <> 0)
  ) = 0, 'no bill carries more than it is for');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_invoices i
     WHERE i.amount < 0 AND pg_temp.on_bill(i.id) <> 0 AND i.is_paid IS DISTINCT FROM (pg_temp.on_bill(i.id) <= i.amount + 0.005)
  ) = 0, 'a credit memo a payment has used reads used exactly when its lines cover it');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_invoices i
     WHERE i.amount > 0 AND i.is_paid AND i.id <> '00000000-0000-0000-0000-000000000c07' AND pg_temp.paid_day(i.id) IS DISTINCT FROM (
       SELECT MAX(p.paid_on) FROM public.supply_house_payment_lines l JOIN public.supply_house_payments p ON p.id = l.payment_id WHERE l.invoice_id = i.id AND p.removed_at IS NULL)
  ) = 0, 'every paid bill''s paid day is its latest payment''s day');
  -- The one paid bill seeded with no paid day was left as it was by the backfill: no row of it was written.
  PERFORM pg_temp.expect((SELECT is_paid AND paid_at IS NULL FROM public.supply_house_invoices WHERE id = '00000000-0000-0000-0000-000000000c07'), 'the paid bill with no paid day still has none');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices WHERE amount_paid IS DISTINCT FROM pg_temp.on_bill(id)) = 0, 'every bill''s amount_paid is the sum of its live lines');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_payments p WHERE pg_temp.on_account(p.id) < -0.005
  ) = 0, 'no payment places more than it sent');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_payment_lines l
      JOIN public.supply_house_payments p ON p.id = l.payment_id
      JOIN public.supply_house_invoices i ON i.id = l.invoice_id
     WHERE p.removed_at IS NULL AND p.supply_house_id <> i.supply_house_id
  ) = 0, 'every live line''s bill is at its payment''s house');

  DELETE FROM public.supply_houses;
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments) = 0 AND (SELECT count(*) FROM public.supply_house_payment_lines) = 0 AND (SELECT count(*) FROM public.supply_house_invoices) = 0, 'deleting the houses takes their bills, payments and lines, with no refusal');
  RAISE NOTICE 'supply house payments: ALL PASSED';
END;
$$;
