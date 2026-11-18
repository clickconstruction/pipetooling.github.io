-- A salaried week of the person's own shape (v2.7826, migration *_salaried_week_hours): a pay row holds seven numbers,
-- Sunday first, and salaried_hours_on answers a day's paid hours from them. A new row reads 0, 8, 8, 8, 8, 8, 0. The
-- check takes seven numbers from 0 to 16 in quarter hours and refuses every other shape, an empty week among them.
-- Written as postgres; everything rolls back. Raises on the first failed assertion; ends with "salaried_week PASSED".
-- See scripts/pgtest-salaried-week.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA swk;
CREATE FUNCTION swk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A week the check must take: written to a row and read back.
CREATE FUNCTION swk.kept(label text, p_week numeric[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN
  UPDATE public.people_pay_config SET salaried_week_hours = p_week WHERE person_name = 'ZZ Bed Week' RETURNING salaried_week_hours::text INTO got;
  PERFORM swk.same(label, got, p_week::numeric(4,2)[]::text);
END $$;
-- A week the check must refuse. A write that lands raises, and that raise is not the one caught.
CREATE FUNCTION swk.refused(label text, p_week numeric[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    UPDATE public.people_pay_config SET salaried_week_hours = p_week WHERE person_name = 'ZZ Bed Week';
    RAISE EXCEPTION '% was taken, and must be refused', label USING ERRCODE = 'P0001';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    RAISE NOTICE 'ok: %', label;
  END;
END $$;

INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES ('ZZ Bed Week', 10, true);

SELECT swk.same('a new pay row reads 8 hours on the five weekdays',
  (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Bed Week'),
  '{0.00,8.00,8.00,8.00,8.00,8.00,0.00}');

SELECT swk.kept('six hours on five days', '{0,6,6,6,6,6,0}');
SELECT swk.kept('four tens', '{0,10,10,10,10,0,0}');
SELECT swk.kept('a short Friday', '{0,8,8,8,8,4,0}');
SELECT swk.kept('a Saturday worker', '{0,0,8,8,8,8,8}');
SELECT swk.kept('quarter hours', '{0,7.25,7.5,7.75,6,6,0}');
SELECT swk.kept('sixteen hours, the most a day holds', '{0,16,0,0,0,0,0}');
SELECT swk.kept('a week of all zeros', '{0,0,0,0,0,0,0}');

SELECT swk.refused('six days', '{0,8,8,8,8,8}');
SELECT swk.refused('eight days', '{0,8,8,8,8,8,0,0}');
SELECT swk.refused('an empty week', '{}');
SELECT swk.refused('no week', NULL);
SELECT swk.refused('a day missing', '{0,8,NULL,8,8,8,0}');
SELECT swk.refused('a day below zero', '{0,8,8,-1,8,8,0}');
SELECT swk.refused('a day over sixteen hours', '{0,16.25,8,8,8,8,0}');
SELECT swk.refused('a day off the quarter hour', '{0,6.1,8,8,8,8,0}');
SELECT swk.refused('a week in two rows', '{{0,8,8,8,8,8,0},{0,8,8,8,8,8,0}}');
SELECT swk.refused('a week that starts at another index', '[0:6]={0,8,8,8,8,8,0}');

-- 2026-11-15 is a Sunday.
SELECT swk.same('a day reads its own weekday, Sunday first',
  (SELECT string_agg(public.salaried_hours_on('{1,6,6.5,7,7.25,4,2}', d::date)::text, ' ' ORDER BY d)
   FROM generate_series('2026-11-15'::date, '2026-11-21'::date, '1 day') d),
  '1 6 6.5 7 7.25 4 2');
SELECT swk.same('a missing week reads as 8 on a weekday and 0 on a weekend',
  (SELECT string_agg(public.salaried_hours_on(NULL, d::date)::text, ' ' ORDER BY d)
   FROM generate_series('2026-11-15'::date, '2026-11-21'::date, '1 day') d),
  '0 8 8 8 8 8 0');
SELECT swk.same('the row''s own week, read through the rule',
  (SELECT string_agg(public.salaried_hours_on(c.salaried_week_hours, d::date)::text, ' ' ORDER BY d)
   FROM public.people_pay_config c, generate_series('2026-11-15'::date, '2026-11-21'::date, '1 day') d
   WHERE c.person_name = 'ZZ Bed Week'),
  '0.00 0.00 0.00 0.00 0.00 0.00 0.00');

SELECT swk.same('the check stands once, by name',
  (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.people_pay_config'::regclass AND conname = 'people_pay_config_salaried_week_hours_check'),
  '1');
SELECT swk.same('a signed-in person may ask the rule, and nobody signed out may',
  (SELECT string_agg(r || ':' || has_function_privilege(r, 'public.salaried_hours_on(numeric[], date)', 'EXECUTE')::text, ' ' ORDER BY r)
   FROM unnest(ARRAY['anon', 'authenticated']) r),
  'anon:false authenticated:true');

ROLLBACK;
SELECT 'salaried_week PASSED';
