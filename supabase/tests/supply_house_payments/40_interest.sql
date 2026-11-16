-- Supply house payments: interest and late fees (20261117020000). Runs after 30_moves, in the same
-- session, with its houses and helpers still here. The scenarios before this one already ran against
-- the eleven-argument record_supply_house_payment with their old ten-argument calls.

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b1';
  late uuid := pg_temp.bill('LATE-500', 500); q uuid := pg_temp.bill('Q-300', 300); onjob uuid := pg_temp.bill('ONJOB-90', 90); plain uuid := pg_temp.bill('PLAIN-20', 20);
  other uuid := pg_temp.bill('OTHER-2', 80, '00000000-0000-0000-0000-0000000000b2');
  r jsonb; i uuid; i2 uuid; v record;
BEGIN
  -- The house added interest to a payment: a bill of its own, tied to the late bill, paid by the payment.
  r := public.record_supply_house_payment(h, '2026-11-16', 318.60, jsonb_build_array(jsonb_build_object('invoice_id', q, 'amount', 300)), 'ach', '90112', NULL, NULL, false, '[]'::jsonb, jsonb_build_object('amount', 18.60, 'late_invoice_id', late));
  i := (r->>'interest_invoice_id')::uuid;
  SELECT * INTO v FROM public.supply_house_invoices WHERE id = i;
  PERFORM pg_temp.expect(v.is_interest AND v.late_invoice_id = late AND v.amount = 18.60 AND v.document_kind = 'invoice' AND v.supply_house_id = h AND v.invoice_number = 'Interest 2026-11-16' AND v.invoice_date = '2026-11-16', 'the interest is a bill of its own, marked and tied to the late bill');
  PERFORM pg_temp.expect(v.is_paid AND pg_temp.paid_day(i) = '2026-11-16' AND pg_temp.on_bill(i) = 18.60 AND pg_temp.paid(q), 'paid whole by the same payment, beside the bill');
  PERFORM pg_temp.expect((r->>'lines')::int = 2 AND (r->>'placed')::numeric = 318.60 AND (r->>'on_account')::numeric = 0 AND pg_temp.on_account((r->>'payment_id')::uuid) = 0, 'the payment''s lines add up to what was sent');

  -- Interest alone, with its own number and no late bill named.
  r := public.record_supply_house_payment(h, '2026-11-17', 5, '[]'::jsonb, 'card', NULL, NULL, NULL, false, '[]'::jsonb, jsonb_build_object('amount', 5, 'invoice_number', ' FC-1108 '));
  i2 := (r->>'interest_invoice_id')::uuid;
  PERFORM pg_temp.expect((SELECT is_interest AND late_invoice_id IS NULL AND invoice_number = 'FC-1108' AND is_paid FROM public.supply_house_invoices WHERE id = i2), 'a late fee with no bill named is still a paid bill of its own');

  -- The refusals.
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 10, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb, %L::jsonb)', h, '2026-11-16', '[]', '[]', jsonb_build_object('amount', 0)), 'needs an amount above zero');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 20, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb, %L::jsonb)', h, '2026-11-16', jsonb_build_array(jsonb_build_object('invoice_id', plain, 'amount', 20)), '[]', jsonb_build_object('amount', 3)), 'come to 23.00 and 20.00 was sent');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 3, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb, %L::jsonb)', h, '2026-11-16', '[]', '[]', jsonb_build_object('amount', 3, 'late_invoice_id', other)), 'tied only to a bill from the same supply house');
  PERFORM pg_temp.refused(format('SELECT public.record_supply_house_payment(%L, %L, 3, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::jsonb, %L::jsonb)', h, '2026-11-16', '[]', '[]', jsonb_build_object('amount', 3, 'late_invoice_id', i)), 'tied only to a bill from the same supply house');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices WHERE is_interest) = 2, 'a refused payment leaves no interest bill behind');

  -- Kept off every job's cost: interest takes no job and no bid.
  PERFORM pg_temp.refused(format('INSERT INTO public.supply_house_invoice_job_allocations (invoice_id, job_id, pct) VALUES (%L, gen_random_uuid(), 100)', i), 'not put on a job');
  PERFORM pg_temp.refused(format('INSERT INTO public.supply_house_invoice_bid_allocations (invoice_id, bid_id, pct) VALUES (%L, gen_random_uuid(), 100)', i), 'not put on a job');
  -- A bill on a job cannot be marked interest until the job is off; a bill on no job can.
  INSERT INTO public.supply_house_invoice_job_allocations (invoice_id, job_id, pct) VALUES (onjob, gen_random_uuid(), 100);
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET is_interest = true WHERE id = %L', onjob), 'take the job off before marking it interest');
  UPDATE public.supply_house_invoices SET is_interest = true, late_invoice_id = late WHERE id = plain;
  PERFORM pg_temp.expect((SELECT is_interest AND late_invoice_id = late AND NOT is_paid FROM public.supply_house_invoices WHERE id = plain), 'an unpaid bill is marked interest by hand and tied to the late bill');
  -- Only interest names a late bill, and never itself or a credit memo.
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET late_invoice_id = %L WHERE id = %L', late, onjob), 'supply_house_invoices_interest_check');
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET late_invoice_id = %L WHERE id = %L', plain, plain), 'tied only to a bill from the same supply house');
  PERFORM pg_temp.refused(format('UPDATE public.supply_house_invoices SET amount = -20, document_kind = %L WHERE id = %L', 'credit', plain), 'supply_house_invoices_interest_check');
  -- The late bill deleted: the interest stays, untied.
  DELETE FROM public.supply_house_invoices WHERE id = late;
  PERFORM pg_temp.expect((SELECT is_interest AND late_invoice_id IS NULL AND is_paid FROM public.supply_house_invoices WHERE id = i), 'the interest outlives its late bill');
  RAISE NOTICE 'M interest PASSED';
END;
$$;

DO $$
BEGIN
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices WHERE amount_paid IS DISTINCT FROM pg_temp.on_bill(id)) = 0, 'every bill''s amount_paid is the sum of its live lines');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments p WHERE pg_temp.on_account(p.id) < -0.005) = 0, 'no payment places more than it sent');
  RAISE NOTICE 'supply house payments: ALL PASSED';
END;
$$;
