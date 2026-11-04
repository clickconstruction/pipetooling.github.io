-- Employment stints (v2.6481, migration *_employment_stints): the backfill gives each seeded row one stint from its pair;
-- from then on the people trigger keeps them. End employment closes the open stint; Bring back (end cleared, a new start
-- on or after the old end) opens a new one and keeps the old; an edit moves the current stint; Ended by mistake (end
-- cleared, start kept) reopens it; the sub bench's same-day Reactivate opens a new one; a new row with dates opens its
-- first; a name change touches nothing. Reads follow the people row's own visibility; nobody writes a stint directly.
-- Written as postgres, then as roles through RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "employment_stints PASSED". See scripts/pgtest-employment-stints.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA est;
CREATE FUNCTION est.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A person's stints, oldest first: start→end, '-' for unknown, 'now' for open.
CREATE FUNCTION est.stints(p_person uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(coalesce(s.start_date::text, '-') || '→' || coalesce(s.end_date::text, 'now'), ' | '
    ORDER BY s.start_date NULLS FIRST, s.created_at), '')
  FROM public.employment_stints s WHERE s.person_id = p_person
$$;
CREATE FUNCTION est.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA est TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA est TO authenticated;

-- 1 · The backfill, after the migration ran twice over the seeded roster.
SELECT est.same('backfill: still working', est.stints('00000000-0000-0000-0000-000000005b01'), '2024-03-04→now');
SELECT est.same('backfill: left', est.stints('00000000-0000-0000-0000-000000005b02'), '2025-01-06→2026-10-01');
SELECT est.same('backfill: no dates, no stint', est.stints('00000000-0000-0000-0000-000000005b03'), '');
SELECT est.same('backfill: end only', est.stints('00000000-0000-0000-0000-000000005b04'), '-→2026-06-30');
SELECT est.same('backfill: one stint a seeded row, after two runs',
  (SELECT count(*)::text FROM public.employment_stints WHERE person_id IN (
    '00000000-0000-0000-0000-000000005b01', '00000000-0000-0000-0000-000000005b02',
    '00000000-0000-0000-0000-000000005b03', '00000000-0000-0000-0000-000000005b04')), '3');

-- 2 · Corinne: End employment, then Bring back three years later, then an edit of the day back.
UPDATE public.people SET end_date = '2026-11-03' WHERE id = '00000000-0000-0000-0000-000000005b01';
SELECT est.same('end employment closes the open stint', est.stints('00000000-0000-0000-0000-000000005b01'), '2024-03-04→2026-11-03');
UPDATE public.people SET name = 'Corinne A. Vela' WHERE id = '00000000-0000-0000-0000-000000005b01';
SELECT est.same('a name change touches nothing', est.stints('00000000-0000-0000-0000-000000005b01'), '2024-03-04→2026-11-03');
UPDATE public.people SET end_date = NULL, start_date = '2029-11-05' WHERE id = '00000000-0000-0000-0000-000000005b01';
SELECT est.same('bring back keeps the old stint and opens a new one', est.stints('00000000-0000-0000-0000-000000005b01'),
  '2024-03-04→2026-11-03 | 2029-11-05→now');
UPDATE public.people SET start_date = '2029-11-06' WHERE id = '00000000-0000-0000-0000-000000005b01';
SELECT est.same('an edit moves only the current stint', est.stints('00000000-0000-0000-0000-000000005b01'),
  '2024-03-04→2026-11-03 | 2029-11-06→now');
UPDATE public.people SET end_date = '2031-02-27' WHERE id = '00000000-0000-0000-0000-000000005b01';
SELECT est.same('a second end closes the second stint', est.stints('00000000-0000-0000-0000-000000005b01'),
  '2024-03-04→2026-11-03 | 2029-11-06→2031-02-27');

-- 3 · Ben: Ended by mistake — the end cleared, the start kept — reopens the old stint.
UPDATE public.people SET end_date = NULL WHERE id = '00000000-0000-0000-0000-000000005b02';
SELECT est.same('an end undone reopens the stint', est.stints('00000000-0000-0000-0000-000000005b02'), '2025-01-06→now');

-- 4 · A sub benched and reactivated the same day (the bench re-stamps the start to that day): a new stint.
INSERT INTO public.people (id, master_user_id, kind, name, start_date) VALUES
  ('00000000-0000-0000-0000-000000005b05', '00000000-0000-0000-0000-000000005a01', 'sub', 'Sal Sameday', '2026-01-05');
SELECT est.same('a new row with a start opens its first stint', est.stints('00000000-0000-0000-0000-000000005b05'), '2026-01-05→now');
UPDATE public.people SET end_date = '2026-11-03' WHERE id = '00000000-0000-0000-0000-000000005b05';
UPDATE public.people SET end_date = NULL, start_date = '2026-11-03' WHERE id = '00000000-0000-0000-0000-000000005b05';
SELECT est.same('same-day reactivate opens a new stint', est.stints('00000000-0000-0000-0000-000000005b05'),
  '2026-01-05→2026-11-03 | 2026-11-03→now');

-- 5 · Nora gets her first dates later.
UPDATE public.people SET start_date = '2026-11-10' WHERE id = '00000000-0000-0000-0000-000000005b03';
SELECT est.same('first dates on an old row open its first stint', est.stints('00000000-0000-0000-0000-000000005b03'), '2026-11-10→now');

-- 6 · Deleting the row takes its stints.
DELETE FROM public.people WHERE id = '00000000-0000-0000-0000-000000005b04';
SELECT est.same('a deleted row takes its stints',
  (SELECT count(*)::text FROM public.employment_stints WHERE person_id = '00000000-0000-0000-0000-000000005b04'), '0');

-- 7 · Reads follow the people row; nobody writes a stint.
SET LOCAL ROLE authenticated;
SELECT est.as_user('00000000-0000-0000-0000-000000005a01');
SELECT est.same('the lead sees the stints of their roster',
  (SELECT count(*)::text FROM public.employment_stints WHERE person_id IN (
    '00000000-0000-0000-0000-000000005b01', '00000000-0000-0000-0000-000000005b02', '00000000-0000-0000-0000-000000005b03',
    '00000000-0000-0000-0000-000000005b05')), '6');
SELECT est.as_user('00000000-0000-0000-0000-000000005d01');
SELECT est.same('a dev sees them too', (SELECT count(*)::text FROM public.employment_stints WHERE person_id = '00000000-0000-0000-0000-000000005b01'), '2');
SELECT est.as_user('00000000-0000-0000-0000-000000005a02');
SELECT est.same('a tech who cannot see the row sees no stint',
  (SELECT count(*)::text FROM public.employment_stints WHERE person_id = '00000000-0000-0000-0000-000000005b01'), '0');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.employment_stints (person_id, start_date) VALUES ('00000000-0000-0000-0000-000000005b01', '2020-01-01');
    RAISE EXCEPTION 'a direct insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: a direct insert is refused';
  END;
END $$;
SELECT est.as_user('00000000-0000-0000-0000-000000005a01');
-- The lead may change their roster's dates; the trigger writes the stint for them.
UPDATE public.people SET end_date = '2026-12-31' WHERE id = '00000000-0000-0000-0000-000000005b03';
RESET ROLE;
SELECT est.same('a lead''s own date change still writes the stint', est.stints('00000000-0000-0000-0000-000000005b03'), '2026-11-10→2026-12-31');

-- 8 · The trigger function is the database's alone.
SELECT est.same('nobody on the API may call the trigger function',
  (SELECT string_agg(r, ',' ORDER BY r) FROM unnest(ARRAY['anon', 'authenticated']) r
   WHERE has_function_privilege(r, 'public.people_stints_follow_dates()', 'EXECUTE')), NULL);

ROLLBACK;
SELECT 'employment_stints PASSED';
