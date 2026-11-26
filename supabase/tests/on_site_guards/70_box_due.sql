-- A box's own screen (punch list #398, v2.8612): what makes a box due a count, in the database as on the phone. Plays
-- on_site_door_facts and on_site_job_summary over one job's ledger, as the dev through RLS: an added part's own count
-- (the note *counted as added*, src/lib/materials/addPart.ts ADD_COUNT_NOTE) is left out of a box's last count and
-- kept as its line's; an empty box is due nowhere; a box with a Can't find and none left is still due; a fresh count
-- by hand clears a box; a count taken back does not count. Fixtures made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "on_site_guards PASSED". See
-- scripts/pgtest-on-site-guards.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA obd;
CREATE FUNCTION obd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Sign in as someone (the claims auth.uid() and auth.role() read).
CREATE FUNCTION obd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the Job Mode card's line reads: the site's boxes and the ones due a count.
CREATE FUNCTION obd.door() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (f->>'boxes') || ' boxes · ' || (f->>'due') || ' due'
  FROM public.on_site_door_facts('00000000-0000-0000-0000-0000000398a1') AS f
$$;
-- What the office's summary reads of a box's last count: its day, or none.
CREATE FUNCTION obd.last_count(p_box uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT (lc->>'at')::timestamptz::date::text || ' by ' || (lc->>'by_name')
    FROM jsonb_array_elements(public.on_site_job_summary('00000000-0000-0000-0000-0000000398a1')->'last_counts') AS lc
    WHERE (lc->>'container_id')::uuid = p_box
  ), 'none')
$$;
-- What the summary reads of one line: on hand, Can't find since the count, and the line's own last count.
CREATE FUNCTION obd.line(p_box uuid, p_part text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT (l->>'on_hand') || ' on hand · ' || (l->>'cannot_find_since_count') || ' cannot find · counted ' || COALESCE((l->>'last_count_at')::timestamptz::date::text, 'never')
    FROM jsonb_array_elements(public.on_site_job_summary('00000000-0000-0000-0000-0000000398a1')->'lines') AS l
    WHERE (l->>'container_id')::uuid = p_box AND l->>'part_name' = p_part
  ), 'no line')
$$;
GRANT USAGE ON SCHEMA obd TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA obd TO authenticated, service_role;

-- Who: a dev, who reads every job. One job on no site, so the site is the job itself.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000398d1', 'dev@boxdue.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000398d1', 'dev@boxdue.test', 'Due Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000398f1', 'Box due bed work', 'JD');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000398a1', '00000000-0000-0000-0000-0000000398d1', '00000000-0000-0000-0000-0000000398f1', 'Box due job', '3981');
-- Six boxes and Unsorted.
--   E1 empty, never counted.               A1 a part, counted 20 days ago.              F1 a part, counted today.
--   N1 a part, never counted, then added.  Z1 counted 20 days ago, used down to none.  C1 counted 20 days ago, Can't find to none.
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a3980c00-0000-0000-0000-0000000398c0', '00000000-0000-0000-0000-0000000398a1', 'Unsorted', 'unsorted'),
  ('a3980c01-0000-0000-0000-0000000398c1', '00000000-0000-0000-0000-0000000398a1', 'E1', 'box'),
  ('a3980c02-0000-0000-0000-0000000398c2', '00000000-0000-0000-0000-0000000398a1', 'A1', 'cage'),
  ('a3980c03-0000-0000-0000-0000000398c3', '00000000-0000-0000-0000-0000000398a1', 'F1', 'box'),
  ('a3980c04-0000-0000-0000-0000000398c4', '00000000-0000-0000-0000-0000000398a1', 'N1', 'box'),
  ('a3980c05-0000-0000-0000-0000000398c5', '00000000-0000-0000-0000-0000000398a1', 'Z1', 'box'),
  ('a3980c06-0000-0000-0000-0000000398c6', '00000000-0000-0000-0000-0000000398a1', 'C1', 'box');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, to_container_id, note, by_user_id, by_name, at) VALUES
  -- Unsorted holds a delivery nobody put away: never due, whatever it holds.
  ('e3980000-0000-0000-0000-000000039801', '00000000-0000-0000-0000-0000000398a1', 'wax ring', 6, 'delivered', NULL, 'a3980c00-0000-0000-0000-0000000398c0', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  -- A1: delivered 30 days ago, counted 20 days ago.
  ('e3980000-0000-0000-0000-000000039811', '00000000-0000-0000-0000-0000000398a1', '2 PVC 90', 40, 'delivered', NULL, 'a3980c02-0000-0000-0000-0000000398c2', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  ('e3980000-0000-0000-0000-000000039812', '00000000-0000-0000-0000-0000000398a1', '2 PVC 90', 40, 'counted', 'a3980c02-0000-0000-0000-0000000398c2', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '20 days'),
  -- F1: delivered 30 days ago, counted an hour ago.
  ('e3980000-0000-0000-0000-000000039821', '00000000-0000-0000-0000-0000000398a1', '3/4 copper 90', 25, 'delivered', NULL, 'a3980c03-0000-0000-0000-0000000398c3', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  ('e3980000-0000-0000-0000-000000039822', '00000000-0000-0000-0000-0000000398a1', '3/4 copper 90', 25, 'counted', 'a3980c03-0000-0000-0000-0000000398c3', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '1 hour'),
  -- N1: a part delivered 30 days ago and never counted; then today's Add a part, the two rows the Tally writes.
  ('e3980000-0000-0000-0000-000000039831', '00000000-0000-0000-0000-0000000398a1', 'hangers', 20, 'delivered', NULL, 'a3980c04-0000-0000-0000-0000000398c4', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  ('e3980000-0000-0000-0000-000000039832', '00000000-0000-0000-0000-0000000398a1', 'pipe strap', 12, 'delivered', NULL, 'a3980c04-0000-0000-0000-0000000398c4', 'added on site', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '10 minutes'),
  ('e3980000-0000-0000-0000-000000039833', '00000000-0000-0000-0000-0000000398a1', 'pipe strap', 12, 'counted', 'a3980c04-0000-0000-0000-0000000398c4', NULL, 'counted as added', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '10 minutes' + interval '1 millisecond'),
  -- Z1: counted 20 days ago, then every piece used: nothing left to count.
  ('e3980000-0000-0000-0000-000000039841', '00000000-0000-0000-0000-0000000398a1', 'closet bolt', 4, 'delivered', NULL, 'a3980c05-0000-0000-0000-0000000398c5', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  ('e3980000-0000-0000-0000-000000039842', '00000000-0000-0000-0000-0000000398a1', 'closet bolt', 4, 'counted', 'a3980c05-0000-0000-0000-0000000398c5', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '20 days'),
  ('e3980000-0000-0000-0000-000000039843', '00000000-0000-0000-0000-0000000398a1', 'closet bolt', 4, 'used', 'a3980c05-0000-0000-0000-0000000398c5', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '15 days'),
  -- C1: counted 20 days ago, then Can't find pressed down to none: a line a count still visits.
  ('e3980000-0000-0000-0000-000000039851', '00000000-0000-0000-0000-0000000398a1', 'ball valve', 2, 'delivered', NULL, 'a3980c06-0000-0000-0000-0000000398c6', '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '30 days'),
  ('e3980000-0000-0000-0000-000000039852', '00000000-0000-0000-0000-0000000398a1', 'ball valve', 2, 'counted', 'a3980c06-0000-0000-0000-0000000398c6', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '20 days'),
  ('e3980000-0000-0000-0000-000000039853', '00000000-0000-0000-0000-0000000398a1', 'ball valve', 2, 'cannot_find', 'a3980c06-0000-0000-0000-0000000398c6', NULL, '', '00000000-0000-0000-0000-0000000398d1', 'Due Dev', now() - interval '15 days');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The dev reads the job. Six live boxes; due: A1 (old count), N1 (the add is the line's count, not the box's) and
--    C1 (a Can't find with none left). Not due: E1 (empty), F1 (counted today), Z1 (nothing left to count).
SELECT obd.as_user('00000000-0000-0000-0000-0000000398d1');
SET LOCAL ROLE authenticated;
SELECT obd.same('six boxes, three due a count', obd.door(), '6 boxes · 3 due');
SELECT obd.same('an empty box never counted has no last count', obd.last_count('a3980c01-0000-0000-0000-0000000398c1'), 'none');
SELECT obd.same('an old count is the box''s last count', obd.last_count('a3980c02-0000-0000-0000-0000000398c2'), (now() - interval '20 days')::date::text || ' by Due Dev');
SELECT obd.same('an added part''s own count is not the box''s last count', obd.last_count('a3980c04-0000-0000-0000-0000000398c4'), 'none');
SELECT obd.same('the added line keeps its own count', obd.line('a3980c04-0000-0000-0000-0000000398c4', 'pipe strap'), '12 on hand · 0 cannot find · counted ' || (now() - interval '10 minutes')::date::text);
SELECT obd.same('the older line in the same box was never counted', obd.line('a3980c04-0000-0000-0000-0000000398c4', 'hangers'), '20 on hand · 0 cannot find · counted never');
SELECT obd.same('a box used down to none keeps its old count and is not due', obd.last_count('a3980c05-0000-0000-0000-0000000398c5'), (now() - interval '20 days')::date::text || ' by Due Dev');
SELECT obd.same('a Can''t find with none left is a line to count', obd.line('a3980c06-0000-0000-0000-0000000398c6', 'ball valve'), '0 on hand · 2 cannot find · counted ' || (now() - interval '20 days')::date::text);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A count by hand of N1's two lines clears the box. One count of the hangers line alone is already the box's count.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, note, by_name, at) VALUES
  ('e3980000-0000-0000-0000-000000039834', '00000000-0000-0000-0000-0000000398a1', 'hangers', 20, 'counted', 'a3980c04-0000-0000-0000-0000000398c4', '', 'Due Dev', now() - interval '5 minutes');
SELECT obd.same('a count by hand of one line counts the box', obd.last_count('a3980c04-0000-0000-0000-0000000398c4'), (now() - interval '5 minutes')::date::text || ' by Due Dev');
SELECT obd.same('the box leaves the due count', obd.door(), '6 boxes · 2 due');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. An add into a box that holds the part writes no count (the Tally's rule); the box's state does not move. And an add
--    into the empty box E1 counts its line, so E1 now holds a line to count and was never counted: due.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, to_container_id, from_container_id, note, by_name, at) VALUES
  ('e3980000-0000-0000-0000-000000039813', '00000000-0000-0000-0000-0000000398a1', '2 PVC 90', 10, 'delivered', 'a3980c02-0000-0000-0000-0000000398c2', NULL, 'added on site', 'Due Dev', now() - interval '4 minutes'),
  ('e3980000-0000-0000-0000-000000039861', '00000000-0000-0000-0000-0000000398a1', 'flange', 3, 'delivered', 'a3980c01-0000-0000-0000-0000000398c1', NULL, 'added on site', 'Due Dev', now() - interval '3 minutes'),
  ('e3980000-0000-0000-0000-000000039862', '00000000-0000-0000-0000-0000000398a1', 'flange', 3, 'counted', NULL, 'a3980c01-0000-0000-0000-0000000398c1', 'counted as added', 'Due Dev', now() - interval '3 minutes' + interval '1 millisecond');
SELECT obd.same('an add into a stocked box leaves its old count', obd.last_count('a3980c02-0000-0000-0000-0000000398c2'), (now() - interval '20 days')::date::text || ' by Due Dev');
SELECT obd.same('the once-empty box now holds a line and was never counted: due', obd.last_count('a3980c01-0000-0000-0000-0000000398c1') || ' · ' || obd.door(), 'none · 6 boxes · 3 due');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A count taken back does not count (the dev answers the press, as 60_press_answers.sql plays it).
SELECT obd.as_user('00000000-0000-0000-0000-0000000398d1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_movement_answers (movement_id, answer, why) VALUES ('e3980000-0000-0000-0000-000000039822', 'taken_back', 'counted the wrong box');
SELECT obd.same('a count taken back leaves the box never counted, and due', obd.last_count('a3980c03-0000-0000-0000-0000000398c3') || ' · ' || obd.door(), 'none · 6 boxes · 4 due');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
