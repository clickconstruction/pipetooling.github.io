-- Materials on site: who changed a box, an answer taken off, and a watch only devs read.
-- Here, each through RLS as the person named: a helper on the job's crew retires a box, brings it back and edits
-- its kind, where line and words, and each lands as one row in the helper's name with the old and new value; a
-- rename lands in the names log and not here; nobody signed in can write, change or remove a row of the log; a
-- dev's part tie and site price, deleted, are kept as they stood with who
-- took them off, and a helper reads none of that; answers that go with their job are not kept; a dev turns a watch
-- on and the claimed setter is replaced with the caller; the watched helper cannot read or write a watch; a box
-- the watched helper opens is logged once in ten minutes, a second box again, and a teammate's open is not; a
-- lifted watch is closed, stops the log, and lets a new watch start. Fixtures made as postgres; everything runs
-- inside one transaction that rolls back. Raises on the first failed assertion; ends with "on_site_guards PASSED".
-- See scripts/pgtest-on-site-guards.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osw;
CREATE FUNCTION osw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION osw.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() and auth.role() read).
CREATE FUNCTION osw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION osw.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- A box's changes on one line, oldest first: what, old → new, the last two characters of who, the name.
CREATE FUNCTION osw.changes(p_box uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(what || ' ' || old_value || '>' || new_value || ' ' || COALESCE(right(by_user_id::text, 2), 'nobody') || ' ' || by_name, ' | ' ORDER BY at, what), 'none')
    FROM public.job_container_changes WHERE container_id = p_box
$$;
GRANT USAGE ON SCHEMA osw TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osw TO authenticated, service_role;

-- Who: a dev, a helper on the job's crew, a second helper on the crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000825d1', 'dev@watch.test'),
  ('00000000-0000-0000-0000-0000000825d2', 'helper@watch.test'),
  ('00000000-0000-0000-0000-0000000825d3', 'mate@watch.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000825d1', 'dev@watch.test', 'Watch Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000825d2', 'helper@watch.test', 'Watch Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000825d3', 'mate@watch.test', 'Watch Mate', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000825f1', 'Watch bed work', 'JW');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000825a1', '00000000-0000-0000-0000-0000000825d1', '00000000-0000-0000-0000-0000000825f1', 'Watch job', '8251'),
  ('00000000-0000-0000-0000-0000000825a2', '00000000-0000-0000-0000-0000000825d1', '00000000-0000-0000-0000-0000000825f1', 'Watch job that goes', '8252');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000825a1', '00000000-0000-0000-0000-0000000825d2'),
  ('00000000-0000-0000-0000-0000000825a1', '00000000-0000-0000-0000-0000000825d3');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a8250c01-0000-0000-0000-0000000825c1', '00000000-0000-0000-0000-0000000825a1', 'A1', 'cage'),
  ('a8250c02-0000-0000-0000-0000000825c2', '00000000-0000-0000-0000-0000000825a1', 'A2', 'box');
SELECT osw.same('a new box has no changes on record', osw.changes('a8250c01-0000-0000-0000-0000000825c1'), 'none');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The helper changes a box, one thing at a time.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d2');
SET LOCAL ROLE authenticated;
UPDATE public.job_containers SET retired_at = now() WHERE id = 'a8250c01-0000-0000-0000-0000000825c1';
SELECT osw.same('a retire is one row in the caller''s name', osw.changes('a8250c01-0000-0000-0000-0000000825c1'), 'retired > d2 Watch Helper');
UPDATE public.job_containers SET retired_at = NULL WHERE id = 'a8250c01-0000-0000-0000-0000000825c1';
SELECT osw.same('a bring-back is a second row', osw.one($q$SELECT count(*)::text || ' · ' || string_agg(what, ',' ORDER BY what) FROM public.job_container_changes WHERE container_id = 'a8250c01-0000-0000-0000-0000000825c1'$q$), '2 · brought_back,retired');
-- A rename is the names log's, not this one's.
UPDATE public.job_containers SET label = 'A5' WHERE id = 'a8250c01-0000-0000-0000-0000000825c1';
SELECT osw.same('a rename adds nothing here and one row to the names log', osw.one($q$SELECT (SELECT count(*) FROM public.job_container_changes WHERE container_id = 'a8250c01-0000-0000-0000-0000000825c1')::text || ' · ' || (SELECT count(*) FROM public.job_container_names WHERE container_id = 'a8250c01-0000-0000-0000-0000000825c1')::text$q$), '2 · 1');
-- The second box: its kind and its where line in one save are two rows, then its words.
UPDATE public.job_containers SET kind = 'cage', where_note = 'by the north fence' WHERE id = 'a8250c02-0000-0000-0000-0000000825c2';
UPDATE public.job_containers SET description = 'drain fittings' WHERE id = 'a8250c02-0000-0000-0000-0000000825c2';
SELECT osw.same('a kind, a where line and the words each keep the old value and the new', osw.one($q$SELECT string_agg(what || ' ' || old_value || '>' || new_value, ' | ' ORDER BY what) FROM public.job_container_changes WHERE container_id = 'a8250c02-0000-0000-0000-0000000825c2'$q$), 'kind box>cage | said >drain fittings | where >by the north fence');
-- A save that changes none of the four writes nothing.
UPDATE public.job_containers SET where_note = 'by the north fence', lat = 29.5, lng = -98.4 WHERE id = 'a8250c02-0000-0000-0000-0000000825c2';
SELECT osw.same('a save that moves none of the four adds no row', osw.one($q$SELECT count(*)::text FROM public.job_container_changes WHERE container_id = 'a8250c02-0000-0000-0000-0000000825c2'$q$), '3');

-- The log is the trigger's alone.
SELECT osw.refused('a helper cannot write a line of the log', $q$INSERT INTO public.job_container_changes (container_id, what) VALUES ('a8250c01-0000-0000-0000-0000000825c1', 'retired')$q$, 'permission denied');
SELECT osw.refused('a helper cannot change a line of the log', $q$UPDATE public.job_container_changes SET by_name = 'Watch Mate'$q$, 'permission denied');
SELECT osw.refused('a helper cannot remove a line of the log', $q$DELETE FROM public.job_container_changes$q$, 'permission denied');
SELECT osw.same('a helper on the crew reads the box''s changes', (SELECT count(*)::text FROM public.job_container_changes), '5');


-- ---------------------------------------------------------------------------------------------------------------
-- 2. An answer taken off: a dev's tie and price on the job, then deleted.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d1');
INSERT INTO public.on_site_part_ties (job_id, a_key, b_key, a_name, b_name, verdict) VALUES
  ('00000000-0000-0000-0000-0000000825a1', 'words:2 pvc 90', 'words:2 inch 90', '2 PVC 90', '2 inch 90', 'same');
INSERT INTO public.on_site_prices (job_id, row_key, row_name, kind, unit_price) VALUES
  ('00000000-0000-0000-0000-0000000825a1', 'words:2 pvc 90', '2 PVC 90', 'price', 4.5);
SELECT osw.same('an answer that stands is not in the log', osw.one($q$SELECT count(*)::text FROM public.on_site_removed_answers$q$), '0');
DELETE FROM public.on_site_part_ties WHERE job_id = '00000000-0000-0000-0000-0000000825a1';
DELETE FROM public.on_site_prices WHERE job_id = '00000000-0000-0000-0000-0000000825a1';
SELECT osw.same('a tie and a price deleted are kept as they stood, with who took them off', osw.one($q$SELECT string_agg(answer || ' ' || COALESCE(was->>'a_name', was->>'row_name') || ' ' || COALESCE(was->>'verdict', was->>'unit_price') || ' ' || right(by_user_id::text, 2) || ' ' || by_name, ' | ' ORDER BY answer) FROM public.on_site_removed_answers WHERE job_id = '00000000-0000-0000-0000-0000000825a1'$q$), 'price 2 PVC 90 4.5000 d1 Watch Dev | tie 2 PVC 90 same d1 Watch Dev');
SELECT osw.same('a dev reads the answers taken off', (SELECT count(*)::text FROM public.on_site_removed_answers), '2');
SELECT osw.refused('a dev cannot write a line of that log', $q$INSERT INTO public.on_site_removed_answers (answer, job_id, was) VALUES ('tie', '00000000-0000-0000-0000-0000000825a1', '{}'::jsonb)$q$, 'permission denied');
-- A helper reads none of it: the answers are the desk's.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d2');
SELECT osw.same('a helper reads no answer taken off', (SELECT count(*)::text FROM public.on_site_removed_answers), '0');

-- Answers that go with their job are not a person's act and are not kept.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d1');
INSERT INTO public.on_site_part_ties (job_id, a_key, b_key, a_name, b_name, verdict) VALUES
  ('00000000-0000-0000-0000-0000000825a2', 'words:a', 'words:b', 'A', 'B', 'different');
RESET ROLE;
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000000825a2';
SELECT osw.same('a job deleted takes its answers and leaves no line', osw.one($q$SELECT (SELECT count(*) FROM public.on_site_part_ties WHERE job_id = '00000000-0000-0000-0000-0000000825a2')::text || ' · ' || (SELECT count(*) FROM public.on_site_removed_answers)::text$q$), '0 · 2');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A watch.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d1');
SET LOCAL ROLE authenticated;
-- The dev turns a watch on for the helper and claims a teammate set it.
INSERT INTO public.person_watches (id, user_id, why, tell_user_ids, set_by, set_by_name, lifted_at) VALUES
  ('b8250000-0000-0000-0000-0000000825e1', '00000000-0000-0000-0000-0000000825d2', 'back on site alone', ARRAY['00000000-0000-0000-0000-0000000825d1']::uuid[], '00000000-0000-0000-0000-0000000825d3', 'Watch Mate', now());
SELECT osw.same('who set a watch is the caller, and a new watch is live', osw.one($q$SELECT right(set_by::text, 2) || ' ' || set_by_name || ' ' || (lifted_at IS NULL)::text FROM public.person_watches WHERE id = 'b8250000-0000-0000-0000-0000000825e1'$q$), 'd1 Watch Dev true');
SELECT osw.refused('a person has one live watch', $q$INSERT INTO public.person_watches (user_id) VALUES ('00000000-0000-0000-0000-0000000825d2')$q$, 'person_watches_live_key');
SELECT osw.same('a dev reads the watch', (SELECT count(*)::text FROM public.person_watches), '1');

-- The watched helper reads nothing and writes nothing.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d2');
SELECT osw.same('the watched person reads no watch', (SELECT count(*)::text FROM public.person_watches), '0');
SELECT osw.refused('the watched person cannot turn a watch on', $q$INSERT INTO public.person_watches (user_id) VALUES ('00000000-0000-0000-0000-0000000825d3')$q$, 'row-level security');
UPDATE public.person_watches SET lifted_at = now(), lifted_why = 'by me';
SELECT osw.same('the watched person cannot lift the watch', osw.one($q$SELECT (lifted_at IS NULL)::text FROM public.person_watches WHERE id = 'b8250000-0000-0000-0000-0000000825e1'$q$), 'true');

-- The helper opens a box, the same box again, then a second box.
SELECT public.on_site_note_box_open('a8250c01-0000-0000-0000-0000000825c1');
SELECT public.on_site_note_box_open('a8250c01-0000-0000-0000-0000000825c1');
SELECT osw.same('a box a watched person opens is logged once in ten minutes', osw.one($q$SELECT count(*)::text FROM public.watched_box_opens$q$), '1');
SELECT public.on_site_note_box_open('a8250c02-0000-0000-0000-0000000825c2');
SELECT public.on_site_note_box_open('a8250c99-0000-0000-0000-0000000825c9');
SELECT osw.same('a second box is a second row, and a box that is not there is none', osw.one($q$SELECT count(*)::text || ' · ' || count(DISTINCT watch_id)::text || ' · ' || string_agg(DISTINCT right(user_id::text, 2), ',') FROM public.watched_box_opens$q$), '2 · 1 · d2');
SELECT osw.same('the watched person reads no row of the log', (SELECT count(*)::text FROM public.watched_box_opens), '0');
-- A teammate who is not watched opens the same box.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d3');
SELECT public.on_site_note_box_open('a8250c01-0000-0000-0000-0000000825c1');
SELECT osw.same('a person who is not watched leaves no row', osw.one($q$SELECT count(*)::text FROM public.watched_box_opens$q$), '2');

-- The dev lifts the watch, and it is closed.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d1');
SELECT osw.same('a dev reads the boxes opened', (SELECT count(*)::text FROM public.watched_box_opens), '2');
UPDATE public.person_watches SET lifted_at = now() - interval '3 days', lifted_why = 'the job is done', lifted_by = '00000000-0000-0000-0000-0000000825d3', user_id = '00000000-0000-0000-0000-0000000825d3'
  WHERE id = 'b8250000-0000-0000-0000-0000000825e1';
SELECT osw.same('who lifted a watch is the caller, now, and the watched person stands', osw.one($q$SELECT right(lifted_by::text, 2) || ' ' || lifted_by_name || ' ' || (lifted_at > now() - interval '1 minute')::text || ' ' || lifted_why || ' ' || right(user_id::text, 2) FROM public.person_watches WHERE id = 'b8250000-0000-0000-0000-0000000825e1'$q$), 'd1 Watch Dev true the job is done d2');
SELECT osw.refused('a lifted watch is closed', $q$UPDATE public.person_watches SET why = 'again' WHERE id = 'b8250000-0000-0000-0000-0000000825e1'$q$, 'This watch was lifted');
SELECT osw.refused('a watch cannot be deleted', $q$DELETE FROM public.person_watches$q$, 'permission denied');

-- With the watch lifted the log stops, and a new watch can start.
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d2');
SELECT public.on_site_note_box_open('a8250c02-0000-0000-0000-0000000825c2');
SELECT osw.same('a lifted watch logs no open', osw.one($q$SELECT count(*)::text FROM public.watched_box_opens$q$), '2');
SELECT osw.as_user('00000000-0000-0000-0000-0000000825d1');
INSERT INTO public.person_watches (user_id, why) VALUES ('00000000-0000-0000-0000-0000000825d2', 'a second visit');
SELECT osw.same('a new watch starts after the old one was lifted', osw.one($q$SELECT count(*)::text || ' · ' || (count(*) FILTER (WHERE lifted_at IS NULL))::text FROM public.person_watches WHERE user_id = '00000000-0000-0000-0000-0000000825d2'$q$), '2 · 1');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
