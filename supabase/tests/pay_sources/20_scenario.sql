\set ON_ERROR_STOP on
-- Fixture: Taunya (three open reports), Michael A (a deduction and an additional line).
INSERT INTO public.pay_stubs (id, person_name, person_id, period_start, period_end, gross_pay) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Taunya', '11111111-1111-1111-1111-111111111111', '2026-06-28', '2026-07-04', 630.78),
  ('00000000-0000-0000-0000-00000000000b', 'Taunya', '11111111-1111-1111-1111-111111111111', '2026-07-19', '2026-07-25', 678.08),
  ('00000000-0000-0000-0000-00000000000c', 'Taunya', '11111111-1111-1111-1111-111111111111', '2026-09-06', '2026-09-12', 391.32),
  ('00000000-0000-0000-0000-00000000000d', 'Michael A', NULL, '2026-04-26', '2026-05-02', 563.35),
  ('00000000-0000-0000-0000-00000000000e', 'Michael A', NULL, '2026-09-06', '2026-09-12', 666.19);
INSERT INTO public.pay_stub_payments (id, pay_stub_id, amount, paid_at, memo) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 300, '2026-07-29T17:00:00Z', 'Cashapp');
INSERT INTO public.pay_stub_deductions (pay_stub_id, amount, source, description) VALUES ('00000000-0000-0000-0000-00000000000d', 63.35, 'manual', 'garnishment');
INSERT INTO public.pay_stub_additional_lines (pay_stub_id, description, quantity, rate, line_total) VALUES ('00000000-0000-0000-0000-00000000000e', 'bonus', 1, 10, 10);
INSERT INTO public.cashapp_transactions (id, occurred_date, amount, counterparty, note, lane, person_name) VALUES
  ('#D-E5D2547JO', '2026-09-03', -700, 'Taunya Villarreal', 'Advance', 'review', 'Taunya'),
  ('#D-9E364VRM4', '2026-09-10', -1500, 'michael Archambault', 'Advance', 'review', 'Michael A'),
  ('#D-K1E736G97', '2026-07-20', -349.63, 'Taunya Villarreal', 'Last week', 'review', 'Taunya'),
  ('#D-XYZ', '2026-07-21', -25, 'Taunya Villarreal', 'Reimbursement', 'review', 'Taunya');

DO $t$
DECLARE r jsonb; a jsonb; n int; x numeric; e text;
BEGIN
  -- 1. pay_position reads net, not gross
  r := public.pay_position('Taunya');
  ASSERT jsonb_array_length(r->'reports') = 3, 'three reports';
  ASSERT (r->'reports'->0->>'remaining')::numeric = 630.78, 'A remaining';
  ASSERT (r->'reports'->1->>'remaining')::numeric = 378.08, 'B remaining after the 300';
  ASSERT (r->>'open_total')::numeric = 1400.18, 'open total ' || (r->>'open_total');
  ASSERT jsonb_array_length(r->'queue') = 3, 'queue rows';
  r := public.pay_position('Michael A');
  ASSERT (r->'reports'->0->>'net')::numeric = 500, 'deduction lowers net';
  ASSERT (r->'reports'->1->>'net')::numeric = 676.19, 'additional line raises net';

  -- 2. dry run plans oldest-open-first and writes nothing
  r := public.record_pay_send('cashapp', '#D-E5D2547JO', 'Taunya', 700, '2026-09-03', 'Advance', true);
  ASSERT r->>'status' = 'planned', 'planned';
  ASSERT jsonb_array_length(r->'allocations') = 2, 'two allocations';
  ASSERT (r->'allocations'->0->>'amount')::numeric = 630.78 AND (r->'allocations'->1->>'amount')::numeric = 69.22, 'split at the week edge';
  ASSERT (r->>'leftover_to_advance')::numeric = 0, 'no leftover';
  ASSERT r->>'cashapp_lane' = 'recorded', 'lane planned';
  ASSERT r->>'memo' = 'Cash App #D-E5D2547JO "Advance"', 'memo ' || (r->>'memo');
  SELECT count(*) INTO n FROM public.pay_stub_payments; ASSERT n = 1, 'dry run wrote nothing';

  -- 3. apply
  r := public.record_pay_send('cashapp', '#D-E5D2547JO', 'Taunya', 700, '2026-09-03', 'Advance', false);
  ASSERT r->>'status' = 'recorded', 'recorded';
  SELECT count(*), sum(amount) INTO n, x FROM public.pay_stub_payments WHERE source_kind = 'cashapp' AND source_id = '#D-E5D2547JO';
  ASSERT n = 2 AND x = 700, 'two rows summing 700';
  ASSERT public.pay_report_remaining('00000000-0000-0000-0000-00000000000a') = 0, 'A filled';
  ASSERT public.pay_report_remaining('00000000-0000-0000-0000-00000000000b') = 308.86, 'B partly';
  SELECT lane || '/' || match_rule || '/' || (pay_stub_payment_id IS NOT NULL)::text INTO e FROM public.cashapp_transactions WHERE id = '#D-E5D2547JO';
  ASSERT e = 'recorded/manual/true', 'queue row filed: ' || e;
  SELECT paid_at::text INTO e FROM public.pay_stub_payments WHERE source_id = '#D-E5D2547JO' LIMIT 1;
  ASSERT (SELECT paid_at AT TIME ZONE 'America/Chicago' FROM public.pay_stub_payments WHERE source_id = '#D-E5D2547JO' LIMIT 1) = '2026-09-03 12:00:00', 'noon Chicago: ' || e;

  -- 4. idempotent
  r := public.record_pay_send('cashapp', '#D-E5D2547JO', 'Taunya', 700, '2026-09-03', 'Advance', false);
  ASSERT r->>'status' = 'already_recorded', 'second call reports';
  SELECT count(*) INTO n FROM public.pay_stub_payments WHERE source_id = '#D-E5D2547JO'; ASSERT n = 2, 'no duplicate rows';

  -- 5. more than is owed: the leftover becomes an advance offset, lane stays recorded
  r := public.record_pay_send('cashapp', '#D-9E364VRM4', 'Michael A', 1500, '2026-09-10', 'Advance', false);
  ASSERT (r->>'leftover_to_advance')::numeric = 323.81, 'leftover ' || (r->>'leftover_to_advance');
  ASSERT r->>'offset_id' IS NOT NULL, 'offset created';
  SELECT amount INTO x FROM public.person_offsets WHERE id = (r->>'offset_id')::uuid;
  ASSERT x = 323.81, 'offset amount';
  SELECT lane || '/' || (person_offset_id IS NOT NULL)::text INTO e FROM public.cashapp_transactions WHERE id = '#D-9E364VRM4';
  ASSERT e = 'recorded/true', 'queue: ' || e;
  ASSERT public.pay_report_remaining('00000000-0000-0000-0000-00000000000d') = 0 AND public.pay_report_remaining('00000000-0000-0000-0000-00000000000e') = 0, 'both filled to net';

  -- 6. nothing open at all: the whole send is an advance
  r := public.record_pay_send('other', NULL, 'Michael A', 100, '2026-09-11', 'cash', false);
  ASSERT jsonb_array_length(r->'rows') = 0 AND (r->>'leftover_to_advance')::numeric = 100, 'all to advance';
  ASSERT r->>'memo' = 'Payment "cash"', 'other memo';
  ASSERT r->'cashapp_lane' = 'null'::jsonb, 'no queue row for other';

  -- 7. link an existing payment, correcting its amount and keeping the old memo as the note
  r := public.link_pay_send('00000000-0000-0000-0000-0000000000b1', 'cashapp', '#D-K1E736G97', 349.63);
  ASSERT r->>'memo_after' = 'Cash App #D-K1E736G97 "Cashapp"', 'memo ' || (r->>'memo_after');
  SELECT amount INTO x FROM public.pay_stub_payments WHERE id = '00000000-0000-0000-0000-0000000000b1'; ASSERT x = 349.63, 'amount corrected';
  SELECT lane INTO e FROM public.cashapp_transactions WHERE id = '#D-K1E736G97'; ASSERT e = 'recorded', 'queue recorded via link';
  r := public.link_pay_send('00000000-0000-0000-0000-0000000000b1', 'cashapp', '#D-K1E736G97', NULL);
  ASSERT r->>'memo_after' = 'Cash App #D-K1E736G97 "Cashapp"', 're-link is a no-op on the memo';
  BEGIN
    PERFORM public.link_pay_send('00000000-0000-0000-0000-0000000000b1', 'mercury', 'm-1', NULL);
    RAISE EXCEPTION 'should have refused a second source';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%already carries source%', SQLERRM; END;
  BEGIN
    PERFORM public.link_pay_send('00000000-0000-0000-0000-0000000000b1', 'cashapp', '#D-K1E736G97', 5000);
    RAISE EXCEPTION 'should have refused an amount over net';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%exceed%', SQLERRM; END;

  -- 8. split
  r := public.split_pay_payment('00000000-0000-0000-0000-0000000000b1', '[{"amount": 300, "source_kind": "cashapp", "source_id": "#D-P1"}, {"amount": 49.63, "source_kind": "cashapp", "source_id": "#D-P2", "memo": "Cash App #D-P2 \"rest\""}]'::jsonb);
  ASSERT jsonb_array_length(r->'payment_ids') = 2, 'two ids';
  SELECT count(*), sum(amount) INTO n, x FROM public.pay_stub_payments WHERE pay_stub_id = '00000000-0000-0000-0000-00000000000b' AND source_id IN ('#D-P1', '#D-P2');
  ASSERT n = 2 AND x = 349.63, 'split keeps the total';
  BEGIN
    PERFORM public.split_pay_payment((r->'payment_ids'->>0)::uuid, '[{"amount": 100}, {"amount": 100}]'::jsonb);
    RAISE EXCEPTION 'should have refused a bad sum';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%parts sum to%', SQLERRM; END;

  -- 9. lanes
  r := public.set_cashapp_lane('#D-XYZ', 'expense', NULL, 'Home Depot run');
  SELECT lane || '/' || decision_note INTO e FROM public.cashapp_transactions WHERE id = '#D-XYZ'; ASSERT e = 'expense/Home Depot run', e;
  BEGIN
    PERFORM public.set_cashapp_lane('#D-XYZ', 'recorded', NULL, NULL);
    RAISE EXCEPTION 'should have refused recorded';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%lane must be%', SQLERRM; END;

  -- 10. the unique index: one row per send per report
  BEGIN
    INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo, source_kind, source_id) VALUES ('00000000-0000-0000-0000-00000000000b', 1, now(), 'dup', 'cashapp', '#D-P1');
    RAISE EXCEPTION 'should have refused a duplicate source on the same report';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- 11. access: payroll off and not service → refused; service role → allowed
  PERFORM set_config('test.payroll', 'off', true);
  BEGIN
    PERFORM public.pay_position('Taunya');
    RAISE EXCEPTION 'should have refused without payroll access';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%payroll access required%', SQLERRM; END;
  PERFORM set_config('test.role', 'service_role', true);
  r := public.pay_position('Taunya');
  ASSERT (r->>'open_total')::numeric = 650.55, 'service role reads; Taunya left ' || (r->>'open_total');
  PERFORM set_config('test.payroll', 'on', true);
  PERFORM set_config('test.role', 'authenticated', true);

  RAISE NOTICE 'ALL SCENARIO ASSERTIONS PASSED';
END
$t$;
