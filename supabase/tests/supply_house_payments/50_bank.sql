-- Supply house payments: the bank match (20261117060000). Runs after 40_interest, in the same
-- session, with its houses and helpers still here.

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

-- An ACH pull, a card charge, a failed attempt at it, money in, and a small line for the second block.
INSERT INTO public.mercury_transactions (id, amount, status, kind, posted_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1', -500.00, 'sent', 'other', '2026-11-13 02:00:00+00'),
  ('00000000-0000-0000-0000-0000000000d2', -75.50, 'sent', 'debitCardTransaction', '2026-11-10 18:00:00+00'),
  ('00000000-0000-0000-0000-0000000000d3', -75.50, 'failed', 'debitCardTransaction', '2026-11-10 17:00:00+00'),
  ('00000000-0000-0000-0000-0000000000d4', 100.00, 'sent', 'other', '2026-11-10 17:00:00+00'),
  ('00000000-0000-0000-0000-0000000000d5', -20.00, 'sent', 'other', '2026-11-15 02:00:00+00');

DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b1';
  t1 uuid := '00000000-0000-0000-0000-0000000000d1'; t2 uuid := '00000000-0000-0000-0000-0000000000d2';
  t3 uuid := '00000000-0000-0000-0000-0000000000d3'; t4 uuid := '00000000-0000-0000-0000-0000000000d4'; t5 uuid := '00000000-0000-0000-0000-0000000000d5';
  a uuid := pg_temp.bill('BANK-A', 500); b uuid := pg_temp.bill('BANK-B', 500); c uuid := pg_temp.bill('BANK-C', 75.50); d uuid := pg_temp.bill('BANK-D', 20);
  n uuid := pg_temp.bill('BANK-N', 40); cm uuid := pg_temp.bill('BANK-CM', -40);
  r jsonb; p uuid; q uuid; press uuid; small uuid; zero uuid; v record;
BEGIN
  r := public.record_supply_house_payment(h, '2026-11-12', 500, jsonb_build_array(jsonb_build_object('invoice_id', a, 'amount', 500)), 'ach', '88213');
  p := (r->>'payment_id')::uuid;
  PERFORM public.match_supply_house_payment(p, t1);
  SELECT * INTO v FROM public.supply_house_payments WHERE id = p;
  PERFORM pg_temp.expect(v.mercury_transaction_id = t1 AND v.bank_matched_at IS NOT NULL AND v.bank_matched_by_name = 'Dana Whitfield' AND v.paid_on = '2026-11-12' AND v.method = 'ach', 'a payment is tied to its bank line, and keeps its own day and method');

  -- A line never carries more than it is.
  r := public.record_supply_house_payment(h, '2026-11-12', 500, jsonb_build_array(jsonb_build_object('invoice_id', b, 'amount', 500)), 'ach');
  q := (r->>'payment_id')::uuid;
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', q, t1), 'that bank line is 500.00 and the payments on it would come to 1000.00');

  -- "Use this line" on a payment made by Mark paid: it takes the line's kind and day.
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = c;
  SELECT payment_id INTO press FROM public.supply_house_payment_lines WHERE invoice_id = c;
  PERFORM public.match_supply_house_payment(press, t2, true);
  SELECT * INTO v FROM public.supply_house_payments WHERE id = press;
  PERFORM pg_temp.expect(v.mercury_transaction_id = t2 AND v.method = 'card' AND v.paid_on = '2026-11-10' AND pg_temp.paid_day(c) = '2026-11-10', 'a press payment takes the card line''s kind and day, and its bill''s paid day follows');

  -- With the same press, a payment that already says how it was sent keeps its method and takes the line's day.
  r := public.record_supply_house_payment(h, '2026-11-16', 20, jsonb_build_array(jsonb_build_object('invoice_id', d, 'amount', 20)), 'check', '1187');
  small := (r->>'payment_id')::uuid;
  PERFORM public.match_supply_house_payment(small, t5, true);
  PERFORM pg_temp.expect((SELECT method = 'check' AND method_ref = '1187' AND paid_on = '2026-11-14' FROM public.supply_house_payments WHERE id = small), 'a payment with its method keeps it; the day is the line''s, in the company''s time zone');
  PERFORM public.unmatch_supply_house_payment(small);
  PERFORM pg_temp.expect((SELECT mercury_transaction_id IS NULL AND bank_matched_at IS NULL FROM public.supply_house_payments WHERE id = small), 'a person takes a payment off its bank line');

  -- The lines that are not a payment out, and the payments that sent nothing.
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', small, t3), 'that bank line failed and moved no money');
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', small, t4), 'money in, not a payment out');
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', small, gen_random_uuid()), 'that bank line was not found');
  r := public.record_supply_house_payment(h, '2026-11-16', 0, jsonb_build_array(jsonb_build_object('invoice_id', n, 'amount', 40), jsonb_build_object('invoice_id', cm, 'amount', -40)));
  zero := (r->>'payment_id')::uuid;
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', zero, t5), 'sent no money');

  -- A match lets go when the amount changes and when the payment is removed.
  PERFORM public.match_supply_house_payment(small, t5);
  UPDATE public.supply_house_payments SET amount = 20.01 WHERE id = small;
  PERFORM pg_temp.expect((SELECT mercury_transaction_id IS NULL AND bank_matched_at IS NULL AND bank_matched_by_name IS NULL FROM public.supply_house_payments WHERE id = small), 'a changed amount clears the match');
  UPDATE public.supply_house_payments SET amount = 20 WHERE id = small;
  PERFORM public.match_supply_house_payment(small, t5);
  PERFORM public.remove_supply_house_payment(small, 'a test');
  PERFORM pg_temp.expect((SELECT mercury_transaction_id IS NULL FROM public.supply_house_payments WHERE id = small), 'a removed payment lets go of its bank line');
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', small, t5), 'put it back before matching it');
  PERFORM public.restore_supply_house_payment(small);
  -- A bank line deleted leaves its payment, unmatched.
  PERFORM public.match_supply_house_payment(small, t5);
  DELETE FROM public.mercury_transactions WHERE id = t5;
  PERFORM pg_temp.expect((SELECT count(*) = 1 AND bool_and(mercury_transaction_id IS NULL) FROM public.supply_house_payments WHERE id = small), 'a bank line that goes leaves its payment');
  RAISE NOTICE 'N bank match PASSED';
END;
$$;

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
DO $$
DECLARE p uuid := (SELECT id FROM public.supply_house_payments WHERE amount > 0 AND removed_at IS NULL LIMIT 1);
BEGIN
  PERFORM pg_temp.refused(format('SELECT public.match_supply_house_payment(%L, %L)', p, '00000000-0000-0000-0000-0000000000d2'), 'only the office');
  PERFORM pg_temp.refused(format('SELECT public.unmatch_supply_house_payment(%L)', p), 'only the office');
  RAISE NOTICE 'supply house payments: ALL PASSED';
END;
$$;
