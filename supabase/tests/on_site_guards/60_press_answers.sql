-- Materials on site: an answer to a press.
-- Here, each through RLS as the person named: a helper on the job's crew delivers, takes and counts, and cannot
-- send a press already taken back, set the switch, give an answer or read one; a dev takes the count back, and
-- every reader then sums the box as if the count was never made, while the row itself is kept; a press takes one
-- live answer; a dev marks the take and the numbers keep it; the office reads the rows taken back and the answers,
-- and a helper reads neither; an answer's press, kind and reason cannot be changed; a withdrawal needs its reason,
-- brings the row back into every sum and closes the answer; a new answer may follow; nobody deletes an answer; and
-- only a dev gives one. Fixtures made as postgres; everything runs inside one transaction that rolls back. Raises
-- on the first failed assertion; ends with "on_site_guards PASSED". See scripts/pgtest-on-site-guards.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osa;
CREATE FUNCTION osa.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION osa.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION osa.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION osa.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- What the caller reads of the job: how many ledger rows, and what the database's own summary says is in the box.
CREATE FUNCTION osa.reads() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM public.job_material_movements WHERE job_id = '00000000-0000-0000-0000-0000000827a1')::text
      || ' rows · ' || COALESCE(public.on_site_job_summary('00000000-0000-0000-0000-0000000827a1')->'lines'->0->>'on_hand', 'no line') || ' on hand'
$$;
GRANT USAGE ON SCHEMA osa TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osa TO authenticated, service_role;

-- Who: a dev, a helper on the job's crew, a master in the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000827d1', 'dev@answer.test'),
  ('00000000-0000-0000-0000-0000000827d2', 'helper@answer.test'),
  ('00000000-0000-0000-0000-0000000827d5', 'master@answer.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000827d1', 'dev@answer.test', 'Answer Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000827d2', 'helper@answer.test', 'Answer Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000827d5', 'master@answer.test', 'Answer Master', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000827f1', 'Answer bed work', 'JA');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000827a1', '00000000-0000-0000-0000-0000000827d1', '00000000-0000-0000-0000-0000000827f1', 'Answer job', '8271');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000827a1', '00000000-0000-0000-0000-0000000827d2');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a8270c01-0000-0000-0000-0000000827c1', '00000000-0000-0000-0000-0000000827a1', 'A1', 'cage');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The helper's presses: 40 delivered, 10 taken, then a count of 5.
SELECT osa.as_user('00000000-0000-0000-0000-0000000827d2');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, to_container_id, at) VALUES
  ('e8270000-0000-0000-0000-0000000827b1', '00000000-0000-0000-0000-0000000827a1', '2 PVC 90', 40, 'delivered', 'a8270c01-0000-0000-0000-0000000827c1', now() - interval '3 hours');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, at) VALUES
  ('e8270000-0000-0000-0000-0000000827b2', '00000000-0000-0000-0000-0000000827a1', '2 PVC 90', 10, 'taken', 'a8270c01-0000-0000-0000-0000000827c1', now() - interval '2 hours'),
  ('e8270000-0000-0000-0000-0000000827b3', '00000000-0000-0000-0000-0000000827a1', '2 PVC 90', 5, 'counted', 'a8270c01-0000-0000-0000-0000000827c1', now() - interval '1 hour');
SELECT osa.same('three presses stand and the count sets the line', osa.reads(), '3 rows · 5 on hand');
-- A press cannot arrive already taken back, and a direct caller cannot set the switch.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, taken_back_at) VALUES
  ('e8270000-0000-0000-0000-0000000827b4', '00000000-0000-0000-0000-0000000827a1', '2 PVC 90', 1, 'used', 'a8270c01-0000-0000-0000-0000000827c1', now());
SELECT osa.same('a press sent as taken back arrives standing', osa.reads(), '4 rows · 4 on hand');
-- Refused outright or touching no row, either way nothing changes.
DO $$ BEGIN
  UPDATE public.job_material_movements SET taken_back_at = now() WHERE job_id = '00000000-0000-0000-0000-0000000827a1';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
SELECT osa.same('a direct caller cannot set the switch', osa.reads(), '4 rows · 4 on hand');
SELECT osa.refused('a helper cannot give an answer', $q$INSERT INTO public.job_movement_answers (movement_id, answer, why) VALUES ('e8270000-0000-0000-0000-0000000827b3', 'taken_back', 'mine')$q$, 'row-level security');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The dev takes the count back, and claims the helper gave the answer.
SELECT osa.as_user('00000000-0000-0000-0000-0000000827d1');
INSERT INTO public.job_movement_answers (id, movement_id, answer, why, by_user_id, by_name) VALUES
  ('f8270000-0000-0000-0000-0000000827e1', 'e8270000-0000-0000-0000-0000000827b3', 'taken_back', 'counted without the office', '00000000-0000-0000-0000-0000000827d2', 'Answer Helper');
SELECT osa.same('who answered is the caller, and the switch is set on the row', osa.one($q$SELECT right(a.by_user_id::text, 2) || ' ' || a.by_name || ' ' || (m.taken_back_at IS NOT NULL)::text FROM public.job_movement_answers a JOIN public.job_material_movements m ON m.id = a.movement_id WHERE a.id = 'f8270000-0000-0000-0000-0000000827e1'$q$), 'd1 Answer Dev true');
SELECT osa.same('the dev sums the box as if the count was never made', osa.reads(), '3 rows · 29 on hand');
SELECT osa.same('the row itself is kept', osa.one($q$SELECT count(*)::text FROM public.job_material_movements WHERE job_id = '00000000-0000-0000-0000-0000000827a1'$q$), '4');
SELECT osa.refused('a press takes one live answer', $q$INSERT INTO public.job_movement_answers (movement_id, answer, why) VALUES ('e8270000-0000-0000-0000-0000000827b3', 'marked', 'again')$q$, 'job_movement_answers_live_key');
-- The dev marks the take: the numbers keep it.
INSERT INTO public.job_movement_answers (id, movement_id, answer, why) VALUES
  ('f8270000-0000-0000-0000-0000000827e2', 'e8270000-0000-0000-0000-0000000827b2', 'marked', 'taken with no note');
SELECT osa.same('a marked press stays in every sum', osa.reads() || ' · ' || osa.one($q$SELECT (taken_back_at IS NULL)::text FROM public.job_material_movements WHERE id = 'e8270000-0000-0000-0000-0000000827b2'$q$), '3 rows · 29 on hand · true');
SELECT osa.same('a dev reads the row taken back and both answers', (SELECT count(*)::text || ' · ' || min(reason) FROM public.on_site_taken_back_rows(ARRAY['00000000-0000-0000-0000-0000000827a1']::uuid[])) || ' · ' || (SELECT count(*)::text FROM public.job_movement_answers), '1 · counted · 2');

-- The helper sums the same and reads neither the row nor an answer.
SELECT osa.as_user('00000000-0000-0000-0000-0000000827d2');
SELECT osa.same('the helper sums the box the same way', osa.reads(), '3 rows · 29 on hand');
SELECT osa.same('a helper reads no row taken back and no answer', (SELECT count(*)::text FROM public.on_site_taken_back_rows(ARRAY['00000000-0000-0000-0000-0000000827a1']::uuid[])) || ' · ' || (SELECT count(*)::text FROM public.job_movement_answers), '0 · 0');
-- A new press still lands and reads back.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id) VALUES
  ('e8270000-0000-0000-0000-0000000827b5', '00000000-0000-0000-0000-0000000827a1', '2 PVC 90', 2, 'used', 'a8270c01-0000-0000-0000-0000000827c1');
SELECT osa.same('a new press lands beside a row taken back', osa.reads(), '4 rows · 27 on hand');

-- The office reads what was taken back and the answers, and gives none.
SELECT osa.as_user('00000000-0000-0000-0000-0000000827d5');
SELECT osa.same('a master reads the row taken back and both answers', (SELECT count(*)::text FROM public.on_site_taken_back_rows(ARRAY['00000000-0000-0000-0000-0000000827a1']::uuid[])) || ' · ' || (SELECT count(*)::text FROM public.job_movement_answers), '1 · 2');
SELECT osa.refused('a master cannot give an answer', $q$INSERT INTO public.job_movement_answers (movement_id, answer, why) VALUES ('e8270000-0000-0000-0000-0000000827b5', 'marked', 'mine')$q$, 'row-level security');
UPDATE public.job_movement_answers SET withdrawn_at = now(), withdrawn_why = 'by the master';
SELECT osa.same('a master cannot withdraw an answer', osa.one($q$SELECT count(*)::text FROM public.job_movement_answers WHERE withdrawn_at IS NULL$q$), '2');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. An answer does not change; it is withdrawn.
SELECT osa.as_user('00000000-0000-0000-0000-0000000827d1');
UPDATE public.job_movement_answers SET answer = 'marked', why = 'changed', movement_id = 'e8270000-0000-0000-0000-0000000827b1' WHERE id = 'f8270000-0000-0000-0000-0000000827e1';
SELECT osa.same('an answer''s press, kind and reason stand', osa.one($q$SELECT answer || ' · ' || why || ' · ' || right(movement_id::text, 2) FROM public.job_movement_answers WHERE id = 'f8270000-0000-0000-0000-0000000827e1'$q$), 'taken_back · counted without the office · b3');
SELECT osa.refused('a withdrawal needs its reason', $q$UPDATE public.job_movement_answers SET withdrawn_at = now() WHERE id = 'f8270000-0000-0000-0000-0000000827e1'$q$, 'Say why the answer is withdrawn');
UPDATE public.job_movement_answers SET withdrawn_at = now() - interval '2 days', withdrawn_why = 'the count was right', withdrawn_by = '00000000-0000-0000-0000-0000000827d2'
  WHERE id = 'f8270000-0000-0000-0000-0000000827e1';
SELECT osa.same('who withdrew is the caller, now, and the switch is clear', osa.one($q$SELECT right(a.withdrawn_by::text, 2) || ' ' || a.withdrawn_by_name || ' ' || (a.withdrawn_at > now() - interval '1 minute')::text || ' ' || (m.taken_back_at IS NULL)::text FROM public.job_movement_answers a JOIN public.job_material_movements m ON m.id = a.movement_id WHERE a.id = 'f8270000-0000-0000-0000-0000000827e1'$q$), 'd1 Answer Dev true true');
-- The count stands again: 40 − 10, counted to 5, then 1 and 2 used.
SELECT osa.same('the row is back in every sum', osa.reads(), '5 rows · 2 on hand');
SELECT osa.refused('a withdrawn answer is closed', $q$UPDATE public.job_movement_answers SET withdrawn_why = 'again' WHERE id = 'f8270000-0000-0000-0000-0000000827e1'$q$, 'This answer was withdrawn');
SELECT osa.refused('nobody deletes an answer', $q$DELETE FROM public.job_movement_answers$q$, 'permission denied');
-- A new answer may follow a withdrawn one.
INSERT INTO public.job_movement_answers (movement_id, answer, why) VALUES ('e8270000-0000-0000-0000-0000000827b3', 'taken_back', 'counted again by the office');
SELECT osa.same('a new answer follows a withdrawn one', osa.reads() || ' · ' || osa.one($q$SELECT count(*)::text FROM public.job_movement_answers WHERE movement_id = 'e8270000-0000-0000-0000-0000000827b3'$q$), '4 rows · 27 on hand · 2');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
