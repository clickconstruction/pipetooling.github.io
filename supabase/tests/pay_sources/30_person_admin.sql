\set ON_ERROR_STOP on
-- v2.3584: Mike Z's shape — hourly placeholders while not working, real Mercury payouts recorded against them.
INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage, show_in_hours) VALUES ('Mike Z', '22222222-2222-2222-2222-222222222222', 37.5, false);
INSERT INTO public.pay_stubs (id, person_name, person_id, period_start, period_end, gross_pay, hours_total) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'Mike Z', '22222222-2222-2222-2222-222222222222', '2026-04-05', '2026-04-11', 1500, 40),
  ('00000000-0000-0000-0000-0000000000f2', 'Mike Z', '22222222-2222-2222-2222-222222222222', '2026-04-12', '2026-04-18', 1500, 40);
INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 1500, '2026-04-17T17:00:00Z', 'Mercury'),
  ('00000000-0000-0000-0000-0000000000f2', 1500, '2026-04-20T17:00:00Z', 'Mercury');
INSERT INTO public.pay_stub_days (pay_stub_id, work_date, hours) VALUES ('00000000-0000-0000-0000-0000000000f1', '2026-04-06', 8);
INSERT INTO public.people_hours (person_name, person_id, work_date, hours) VALUES
  ('Mike Z', '22222222-2222-2222-2222-222222222222', '2026-04-06', 8), ('Mike Z', '22222222-2222-2222-2222-222222222222', '2026-04-07', 8), ('Mike Z', '22222222-2222-2222-2222-222222222222', '2026-04-13', 4);

DO $t$
DECLARE r jsonb; n int; e text;
BEGIN
  -- reasons are required everywhere
  BEGIN
    PERFORM public.set_person_hours('Mike Z', '2026-04-01', '2026-04-30', 0, '  ');
    RAISE EXCEPTION 'should have required a reason';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%reason is required%', SQLERRM; END;

  -- 1. clear hours in a range: rows gone, before/after recorded
  r := public.set_person_hours('Mike Z', '2026-04-01', '2026-04-30', 0, 'listed hourly while not working');
  ASSERT r->>'status' = 'cleared' AND (r->>'removed')::int = 3, 'cleared 3: ' || r::text;
  ASSERT jsonb_array_length(r->'before') = 3 AND jsonb_array_length(r->'after') = 0, 'before/after';
  SELECT count(*) INTO n FROM public.people_hours WHERE person_name = 'Mike Z'; ASSERT n = 0, 'no rows left';
  -- and set hours on a range
  r := public.set_person_hours('Mike Z', '2026-05-04', '2026-05-05', 6, 'two days back');
  ASSERT (r->>'set')::int = 2 AND jsonb_array_length(r->'after') = 2, 'set two days';
  SELECT hours INTO n FROM public.people_hours WHERE person_name = 'Mike Z' AND work_date = '2026-05-05'; ASSERT n = 6, 'six hours';
  BEGIN
    PERFORM public.set_person_hours('Mike Z', '2026-05-04', '2026-05-05', 25, 'x');
    RAISE EXCEPTION 'should have refused 25 hours';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%between 0 and 24%', SQLERRM; END;

  -- 2. void a report: cascade rows go, the audit keeps the payment rows; a sourced payment blocks it
  r := public.void_pay_report('00000000-0000-0000-0000-0000000000f1', 'placeholder hourly report; payout was not wages');
  ASSERT r->>'status' = 'voided' AND (r->>'paid')::numeric = 1500 AND (r->>'payments')::int = 1, 'voided: ' || r::text;
  SELECT count(*) INTO n FROM public.pay_stubs WHERE id = '00000000-0000-0000-0000-0000000000f1'; ASSERT n = 0, 'report gone';
  SELECT count(*) INTO n FROM public.pay_stub_payments WHERE pay_stub_id = '00000000-0000-0000-0000-0000000000f1'; ASSERT n = 0, 'payments gone with it';
  SELECT count(*) INTO n FROM public.pay_stub_days WHERE pay_stub_id = '00000000-0000-0000-0000-0000000000f1'; ASSERT n = 0, 'days gone with it';
  SELECT count(*) INTO n FROM public.pay_admin_events WHERE person_name = 'Mike Z' AND action = 'void_report' AND payload->'payment_rows'->0->>'amount' = '1500'; ASSERT n = 1, 'audit row with the payment snapshot';
  UPDATE public.pay_stub_payments SET source_kind = 'mercury', source_id = 'm-real' WHERE pay_stub_id = '00000000-0000-0000-0000-0000000000f2';
  BEGIN
    PERFORM public.void_pay_report('00000000-0000-0000-0000-0000000000f2', 'x');
    RAISE EXCEPTION 'should have refused a report with a sourced payment';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%tied to a real send%', SQLERRM; END;
  BEGIN
    PERFORM public.void_pay_report('00000000-0000-0000-0000-00000000dead', 'x');
    RAISE EXCEPTION 'should have said not found';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%not found%', SQLERRM; END;

  -- 3. pay config: only the keys given change; unknown keys refused; a missing row is created
  r := public.set_pay_config('Mike Z', '{"hourly_wage": null, "show_in_hours": false}'::jsonb, 'not hourly');
  ASSERT r->'after'->>'hourly_wage' IS NULL AND (r->'after'->>'show_in_hours')::boolean = false AND (r->'before'->>'hourly_wage')::numeric = 37.5, 'config: ' || r::text;
  ASSERT (r->'after'->>'is_salary')::boolean = false, 'untouched key kept';
  BEGIN
    PERFORM public.set_pay_config('Mike Z', '{"wage": 1}'::jsonb, 'x');
    RAISE EXCEPTION 'should have refused an unknown key';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%unknown pay config key%', SQLERRM; END;
  r := public.set_pay_config('Newbie', '{"is_salary": true}'::jsonb, 'new row');
  ASSERT r->'before' IS NULL OR r->'before' = 'null'::jsonb, 'no row before';
  ASSERT (r->'after'->>'is_salary')::boolean = true, 'row created';

  -- 4. alias: not staff, then a person, key normalised
  r := public.set_cashapp_alias('  Michael   Zinna ', NULL, true, 'payouts were not wages');
  ASSERT r->'after'->>'counterparty_key' = 'michael zinna' AND (r->'after'->>'not_staff')::boolean = true, 'alias not staff: ' || r::text;
  r := public.set_cashapp_alias('Jessie Lopez', 'Jesse', false, 'nickname');
  ASSERT r->'after'->>'person_name' = 'Jesse' AND (r->'after'->>'not_staff')::boolean = false, 'alias person';
  BEGIN
    PERFORM public.set_cashapp_alias('Somebody', NULL, false, 'x');
    RAISE EXCEPTION 'should have required a person or not_staff';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM LIKE '%give a person%', SQLERRM; END;

  SELECT count(*) INTO n FROM public.pay_admin_events; ASSERT n = 7, 'seven audit rows, got ' || n;
  RAISE NOTICE 'PERSON ADMIN ASSERTIONS PASSED';
END
$t$;
