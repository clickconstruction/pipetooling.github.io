-- Supply house payments: moves, removals and putting back (20261117010000). Runs after 20_scenario,
-- in the same session, so its helpers (pg_temp.expect, refused, bill, paid, on_bill, on_account) are
-- still here. 20_scenario ends by deleting every house, so this starts from a clean table.

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Pecan Supply'),
  ('00000000-0000-0000-0000-0000000000b2', 'Cedar Fork Supply');

-- ── I. Move an amount to another bill, and take the move back ───────────────────────────────────
DO $$
DECLARE
  h uuid := '00000000-0000-0000-0000-0000000000b1';
  x uuid := pg_temp.bill('X-300', 300); y uuid := pg_temp.bill('Y-200', 200); z uuid := pg_temp.bill('Z-100', 100);
  other uuid := pg_temp.bill('OTHER', 80, '00000000-0000-0000-0000-0000000000b2');
  k uuid := pg_temp.bill('K-60', 60); m uuid := pg_temp.bill('M-60', 60);
  r jsonb; p uuid; pk uuid; ev uuid; back uuid; v record;
BEGIN
  r := public.record_supply_house_payment(h, '2026-11-12', 500, jsonb_build_array(jsonb_build_object('invoice_id', x, 'amount', 300), jsonb_build_object('invoice_id', y, 'amount', 200)), 'ach', '88213');
  p := (r->>'payment_id')::uuid;

  -- The house applied 100 of it to another bill.
  ev := public.move_supply_house_payment(p, y, z, 100, 'house_applied', ' they called ');
  PERFORM pg_temp.expect(pg_temp.on_bill(y) = 100 AND NOT pg_temp.paid(y), 'the bill it left has 100 on it and reads unpaid');
  PERFORM pg_temp.expect(pg_temp.on_bill(z) = 100 AND pg_temp.paid(z) AND pg_temp.paid_day(z) = '2026-11-12', 'the bill it reached is paid, on the payment''s day');
  PERFORM pg_temp.expect(pg_temp.on_account(p) = 0 AND (SELECT amount FROM public.supply_house_payments WHERE id = p) = 500, 'the payment still reads 500 sent, all of it on bills');
  SELECT * INTO v FROM public.supply_house_payment_events WHERE id = ev;
  PERFORM pg_temp.expect(v.kind = 'moved' AND v.from_invoice_id = y AND v.to_invoice_id = z AND v.from_invoice_number = 'Y-200' AND v.to_invoice_number = 'Z-100' AND v.amount = 100 AND v.reason = 'house_applied' AND v.note = 'they called' AND v.actor_name = 'Dana Whitfield' AND v.supply_house_id = h, 'the move is written down: from, to, how much, why, who');

  -- Taken back.
  back := public.undo_supply_house_payment_move(ev);
  PERFORM pg_temp.expect(pg_temp.on_bill(y) = 200 AND pg_temp.paid(y) AND pg_temp.on_bill(z) = 0 AND NOT pg_temp.paid(z), 'the undo puts both bills back');
  PERFORM pg_temp.expect((SELECT undone_by_event_id FROM public.supply_house_payment_events WHERE id = ev) = back AND (SELECT undoes_event_id = ev AND reason = 'undo' FROM public.supply_house_payment_events WHERE id = back), 'each event names the other');
  PERFORM pg_temp.refused(format('SELECT public.undo_supply_house_payment_move(%L)', ev), 'already taken back');
  PERFORM pg_temp.refused(format('SELECT public.undo_supply_house_payment_move(%L)', back), 'a move being taken back');

  -- The refusals, each with its reason.
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 300)', p, x, z), 'bill Z-100 is for 100.00');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 400)', p, x, y), 'has 300.00 on that bill and 400.00 was asked for');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 10)', p, x, other), 'belongs to another supply house');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 10)', p, z, x), 'no money on that bill to move');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 10)', p, x, x), 'already there');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 0)', p, x, z), 'above zero');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 10, %L)', p, x, z, 'because'), 'house_applied, wrong_bill or other');
  PERFORM pg_temp.expect(pg_temp.on_bill(x) = 300 AND pg_temp.on_bill(y) = 200 AND pg_temp.on_bill(z) = 0, 'a refused move changes nothing');

  -- To on account, and from it.
  PERFORM public.move_supply_house_payment(p, y, NULL, 50, 'wrong_bill');
  PERFORM pg_temp.expect(pg_temp.on_account(p) = 50 AND pg_temp.on_bill(y) = 150 AND NOT pg_temp.paid(y), '50 taken off a bill waits on account');
  PERFORM public.move_supply_house_payment(p, NULL, z, 50, 'other');
  PERFORM pg_temp.expect(pg_temp.on_account(p) = 0 AND pg_temp.on_bill(z) = 50, 'and goes on a bill from there');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, NULL, %L, 10)', p, z), 'has 0.00 on account and 10.00 was asked for');

  -- A whole line moves by changing its bill: a press payment is never left without a line.
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = k;
  SELECT payment_id INTO pk FROM public.supply_house_payment_lines WHERE invoice_id = k;
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, NULL, 60)', pk, k), 'only says its bill was paid');
  PERFORM public.move_supply_house_payment(pk, k, m, 60, 'wrong_bill');
  PERFORM pg_temp.expect(NOT pg_temp.paid(k) AND pg_temp.paid(m) AND (SELECT count(*) FROM public.supply_house_payments WHERE id = pk) = 1, 'a press payment moved whole stands on the other bill');

  -- ── J. Remove with a reason, and put back ─────────────────────────────────────────────────────
  ev := public.remove_supply_house_payment(p, ' typed twice ');
  SELECT * INTO v FROM public.supply_house_payments WHERE id = p;
  PERFORM pg_temp.expect(v.removed_at IS NOT NULL AND v.removed_by = '00000000-0000-0000-0000-0000000000a1' AND v.removed_by_name = 'Dana Whitfield' AND v.removed_reason = 'typed twice', 'the removal says who and why');
  PERFORM pg_temp.expect(NOT pg_temp.paid(x) AND pg_temp.on_bill(x) = 0 AND pg_temp.on_bill(z) = 0, 'its bills read unpaid, with nothing on them');
  PERFORM pg_temp.expect((SELECT kind = 'removed' AND amount = 500 AND reason = 'typed twice' FROM public.supply_house_payment_events WHERE id = ev), 'and the removal is written down');
  PERFORM pg_temp.refused(format('SELECT public.remove_supply_house_payment(%L)', p), 'already removed');
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, %L, %L, 10)', p, x, z), 'put it back before moving it');

  ev := public.restore_supply_house_payment(p);
  PERFORM pg_temp.expect(pg_temp.paid(x) AND pg_temp.on_bill(y) = 150 AND pg_temp.on_bill(z) = 50 AND (SELECT removed_at IS NULL AND removed_reason IS NULL FROM public.supply_house_payments WHERE id = p), 'put back, every line is where it was');
  PERFORM pg_temp.expect((SELECT kind = 'restored' AND reason = 'typed twice' FROM public.supply_house_payment_events WHERE id = ev), 'and that is written down, with why it had been removed');
  PERFORM pg_temp.refused(format('SELECT public.restore_supply_house_payment(%L)', p), 'is not removed');

  -- Not whole any more: a bill it paid was paid by hand while it was away.
  PERFORM public.remove_supply_house_payment(p, NULL);
  UPDATE public.supply_house_invoices SET is_paid = true WHERE id = x;
  PERFORM pg_temp.refused(format('SELECT public.restore_supply_house_payment(%L)', p), 'bill X-300 has been paid or changed since this payment was removed');
  UPDATE public.supply_house_invoices SET is_paid = false WHERE id = x;
  -- Too old.
  UPDATE public.supply_house_payments SET removed_at = now() - interval '31 days' WHERE id = p;
  PERFORM pg_temp.refused(format('SELECT public.restore_supply_house_payment(%L)', p), 'more than 30 days ago');
  RAISE NOTICE 'I-J moves and removals PASSED';
END;
$$;

-- ── K. Only the office ──────────────────────────────────────────────────────────────────────────
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
DO $$
DECLARE p uuid := (SELECT id FROM public.supply_house_payments LIMIT 1);
BEGIN
  PERFORM pg_temp.refused(format('SELECT public.move_supply_house_payment(%L, NULL, NULL, 1)', p), 'only the office');
  PERFORM pg_temp.refused(format('SELECT public.remove_supply_house_payment(%L)', p), 'only the office');
  PERFORM pg_temp.refused(format('SELECT public.restore_supply_house_payment(%L)', p), 'only the office');
END;
$$;
SET ROLE authenticated;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.supply_house_payment_events;
  IF n <> 0 THEN RAISE EXCEPTION 'FAILED: a sub reads % payment events', n; END IF;
END;
$$;
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
DO $$
DECLARE n integer; b uuid; b2 uuid; r jsonb;
BEGIN
  SELECT count(*) INTO n FROM public.supply_house_payment_events;
  IF n = 0 THEN RAISE EXCEPTION 'FAILED: the office reads no payment events'; END IF;
  -- The office's own move and removal run under row-level security.
  INSERT INTO public.supply_house_invoices (supply_house_id, invoice_number, amount) VALUES ('00000000-0000-0000-0000-0000000000b1', 'RLS-A', 40) RETURNING id INTO b;
  INSERT INTO public.supply_house_invoices (supply_house_id, invoice_number, amount) VALUES ('00000000-0000-0000-0000-0000000000b1', 'RLS-B', 40) RETURNING id INTO b2;
  r := public.record_supply_house_payment('00000000-0000-0000-0000-0000000000b1', '2026-11-16', 40, jsonb_build_array(jsonb_build_object('invoice_id', b, 'amount', 40)), 'card');
  PERFORM public.undo_supply_house_payment_move(public.move_supply_house_payment((r->>'payment_id')::uuid, b, b2, 40, 'wrong_bill'));
  PERFORM public.remove_supply_house_payment((r->>'payment_id')::uuid, 'a test');
  PERFORM public.restore_supply_house_payment((r->>'payment_id')::uuid);
  IF NOT (SELECT is_paid FROM public.supply_house_invoices WHERE id = b) THEN RAISE EXCEPTION 'FAILED: the office''s move, undo, removal and putting back did not end where they began'; END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_invoices WHERE amount_paid IS DISTINCT FROM pg_temp.on_bill(id)) = 0, 'every bill''s amount_paid is the sum of its live lines');
  PERFORM pg_temp.expect((
    SELECT count(*) FROM public.supply_house_invoices i
     WHERE (i.amount > 0 AND (pg_temp.on_bill(i.id) > i.amount + 0.005 OR i.is_paid IS DISTINCT FROM (pg_temp.on_bill(i.id) >= i.amount - 0.005)))
  ) = 0, 'every bill reads paid exactly when its lines cover it, and none carries more than it is for');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.supply_house_payments p WHERE pg_temp.on_account(p.id) < -0.005) = 0, 'no payment places more than it sent');
  RAISE NOTICE 'supply house payments: ALL PASSED';
END;
$$;
