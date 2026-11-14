-- Materials on site: what a teammate may change (v2.7240, punch list #344 PR 5). The gate says which job a person may
-- write; these triggers say which columns. Here, each through RLS as a signed-in helper on the job's team: a ledger
-- row and a box move that name a teammate and a time ahead are stamped with the caller and the server's time, and a
-- press that waited on the phone keeps its own earlier time beside the time it reached the office; a dev's agent label
-- is kept; a box photo cannot be filed by the phone, pointed at a Drive file, at another shot's place in the bucket,
-- or moved to another box or job, while the phone's own changes still land and the sweep's still do as the service
-- role; and a box's job cannot be changed by a direct update, while the office's own path still can. Fixtures made as
-- postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "on_site_guards PASSED". See scripts/pgtest-on-site-guards.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osg;
CREATE FUNCTION osg.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION osg.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION osg.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION osg.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT USAGE ON SCHEMA osg TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osg TO authenticated, service_role;

-- Who: a dev, a helper on both jobs' crews, a second helper on the first job's crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000609d1', 'dev@guards.test'),
  ('00000000-0000-0000-0000-0000000609d2', 'helper@guards.test'),
  ('00000000-0000-0000-0000-0000000609d3', 'other@guards.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000609d1', 'dev@guards.test', 'Guard Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000609d2', 'helper@guards.test', 'Guard Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000609d3', 'other@guards.test', 'Guard Other', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000609f1', 'On-site guards bed work', 'JG');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000609a1', '00000000-0000-0000-0000-0000000609d1', '00000000-0000-0000-0000-0000000609f1', 'Guards job A', '911'),
  ('00000000-0000-0000-0000-0000000609a2', '00000000-0000-0000-0000-0000000609d1', '00000000-0000-0000-0000-0000000609f1', 'Guards job B', '912');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000609a1', '00000000-0000-0000-0000-0000000609d2'),
  ('00000000-0000-0000-0000-0000000609a2', '00000000-0000-0000-0000-0000000609d2'),
  ('00000000-0000-0000-0000-0000000609a1', '00000000-0000-0000-0000-0000000609d3');

INSERT INTO public.job_places (id, job_id, name) VALUES ('00000000-0000-0000-0000-0000000609b1', '00000000-0000-0000-0000-0000000609a1', 'Yard');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a6090c01-0000-0000-0000-0000000609c1', '00000000-0000-0000-0000-0000000609a1', 'A1', 'cage'),
  ('a6090c02-0000-0000-0000-0000000609c2', '00000000-0000-0000-0000-0000000609a1', 'A2', 'box'),
  ('b6090c01-0000-0000-0000-0000000609c3', '00000000-0000-0000-0000-0000000609a2', 'B1', 'cage');
-- A photo the other helper took and the sweep filed, and one of theirs still waiting, both made as the office's own.
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, by_user_id, status, drive_file_id, filed_at) VALUES
  ('00000000-0000-0000-0000-000000060901', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'filed.jpg', '00000000-0000-0000-0000-0000000609d3', 'filed', 'drive-file-of-another', now());

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The ledger's who and when.
SELECT osg.as_user('00000000-0000-0000-0000-0000000609d2');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name, at)
  VALUES ('00000000-0000-0000-0000-000000060911', '00000000-0000-0000-0000-0000000609a1', 'guard elbow', 2, 'used', 'a6090c01-0000-0000-0000-0000000609c1', '00000000-0000-0000-0000-0000000609d3', 'Guard Other', now() + interval '1 hour');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name, at)
  VALUES ('00000000-0000-0000-0000-000000060912', '00000000-0000-0000-0000-0000000609a1', 'guard elbow', 1, 'used', 'a6090c01-0000-0000-0000-0000000609c1', NULL, '', now() - interval '2 days');
RESET ROLE;
SELECT osg.same('a row sent in a teammate''s name is the caller''s', osg.one($q$SELECT by_user_id::text || ' · ' || by_name FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000060911'$q$), '00000000-0000-0000-0000-0000000609d2 · Guard Helper');
SELECT osg.same('a time ahead of the server''s is the server''s', osg.one($q$SELECT (at = now())::text || ' ' || (recorded_at = now())::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000060911'$q$), 'true true');
SELECT osg.same('a press that waited keeps its own time, beside when it reached the office', osg.one($q$SELECT (at = now() - interval '2 days')::text || ' ' || (recorded_at = now())::text || ' ' || by_user_id::text || ' ' || by_name FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000060912'$q$), 'true true 00000000-0000-0000-0000-0000000609d2 Guard Helper');

-- A dev's label is kept (the dev seat writes "<agent> · MCP as <dev>" as the dev); the who is still the dev.
SELECT osg.as_user('00000000-0000-0000-0000-0000000609d1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, to_container_id, by_user_id, by_name)
  VALUES ('00000000-0000-0000-0000-000000060913', '00000000-0000-0000-0000-0000000609a1', 'guard elbow', 9, 'delivered', 'a6090c01-0000-0000-0000-0000000609c1', '00000000-0000-0000-0000-0000000609d3', 'Claude · MCP as Guard Dev');
RESET ROLE;
SELECT osg.same('a dev keeps the agent''s label, under the dev''s own id', osg.one($q$SELECT by_user_id::text || ' · ' || by_name FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000060913'$q$), '00000000-0000-0000-0000-0000000609d1 · Claude · MCP as Guard Dev');

-- The office's own writers (a definer function, the service role) are not direct callers: the row is as sent.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, to_container_id, by_user_id, by_name, at)
  VALUES ('00000000-0000-0000-0000-000000060914', '00000000-0000-0000-0000-0000000609a1', 'guard tee', 3, 'delivered', 'a6090c02-0000-0000-0000-0000000609c2', '00000000-0000-0000-0000-0000000609d3', 'Guard Other', now() + interval '1 hour');
SELECT osg.same('a row the office''s own code writes is as it was sent, with its landing stamped', osg.one($q$SELECT by_name || ' ' || (at > now())::text || ' ' || (recorded_at = now())::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000060914'$q$), 'Guard Other true true');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A box's own move.
SELECT osg.as_user('00000000-0000-0000-0000-0000000609d2');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_container_moves (id, container_id, from_place_id, to_place_id, by_user_id, by_name, at)
  VALUES ('00000000-0000-0000-0000-000000060921', 'a6090c01-0000-0000-0000-0000000609c1', NULL, '00000000-0000-0000-0000-0000000609b1', '00000000-0000-0000-0000-0000000609d3', 'Guard Other', now() + interval '3 hours');
RESET ROLE;
SELECT osg.same('a box move sent in a teammate''s name and ahead of time is the caller''s, now', osg.one($q$SELECT by_user_id::text || ' · ' || by_name || ' · ' || (at = now())::text FROM public.job_container_moves WHERE id = '00000000-0000-0000-0000-000000060921'$q$), '00000000-0000-0000-0000-0000000609d2 · Guard Helper · true');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A box photo.
SELECT osg.as_user('00000000-0000-0000-0000-0000000609d2');
SET LOCAL ROLE authenticated;
SELECT osg.refused('a photo made already pointing at a Drive file', $q$INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, drive_file_id) VALUES ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'x.jpg', 'any-drive-file')$q$, 'filed in Drive by the app');
SELECT osg.refused('a photo made already filed', $q$INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, status) VALUES ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'x.jpg', 'filed')$q$, 'filed in Drive by the app');
SELECT osg.refused('a photo made at another shot''s place in the bucket', $q$INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, storage_path) VALUES ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'x.jpg', '00000000-0000-0000-0000-0000000609a2/00000000-0000-0000-0000-000000060901.jpg')$q$, 'place in the bucket is its own');
SELECT osg.refused('a photo made at a place that is no job''s folder', $q$INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, storage_path) VALUES ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'x.jpg', '../00000000-0000-0000-0000-000000060931.jpg')$q$, 'place in the bucket is its own');
-- The phone's own two shapes: sent, at its own place; and kept on the phone, with no place yet.
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, by_user_id, by_name, status, storage_path, fail_why)
  VALUES ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-0000000609a1', 'a6090c01-0000-0000-0000-0000000609c1', 'A1.jpg', '00000000-0000-0000-0000-0000000609d3', 'Guard Other', 'sending', '00000000-0000-0000-0000-0000000609a1/00000000-0000-0000-0000-000000060931.jpg', 'made up');
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, status)
  VALUES ('00000000-0000-0000-0000-000000060932', '00000000-0000-0000-0000-0000000609a1', 'a6090c02-0000-0000-0000-0000000609c2', 'A2.jpg', 'on-phone');
RESET ROLE;
SELECT osg.same('a sent photo is the caller''s, with nothing of the sweep''s on it', osg.one($q$SELECT by_user_id::text || ' · ' || by_name || ' · ' || status || ' · ' || COALESCE(fail_why, 'no reason') || ' · ' || COALESCE(drive_file_id, 'no file') FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000060931'$q$), '00000000-0000-0000-0000-0000000609d2 · Guard Helper · sending · no reason · no file');
SELECT osg.same('a photo kept on the phone lands with no place', osg.one($q$SELECT status || ' · ' || COALESCE(storage_path, 'no place') || ' · ' || by_user_id::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000060932'$q$), 'on-phone · no place · 00000000-0000-0000-0000-0000000609d2');

SELECT osg.as_user('00000000-0000-0000-0000-0000000609d2');
SET LOCAL ROLE authenticated;
-- Send now, then Share instead: what the phone does to its own photo.
UPDATE public.job_box_photos SET status = 'sending', storage_path = '00000000-0000-0000-0000-0000000609a1/00000000-0000-0000-0000-000000060932.jpg' WHERE id = '00000000-0000-0000-0000-000000060932';
UPDATE public.job_box_photos SET status = 'shared' WHERE id = '00000000-0000-0000-0000-000000060931';
SELECT osg.refused('pointing a photo at a Drive file', $q$UPDATE public.job_box_photos SET drive_file_id = 'drive-file-of-another' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'filed in Drive by the app');
SELECT osg.refused('marking a photo filed', $q$UPDATE public.job_box_photos SET status = 'filed' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'filed in Drive by the app');
SELECT osg.refused('stamping a photo as filed at a time', $q$UPDATE public.job_box_photos SET filed_at = now() WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'filed in Drive by the app');
SELECT osg.refused('marking a photo due a move in Drive', $q$UPDATE public.job_box_photos SET refile_due_at = now() WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'filed in Drive by the app');
SELECT osg.refused('writing the sweep''s reason on a photo', $q$UPDATE public.job_box_photos SET fail_why = 'made up' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'filed in Drive by the app');
SELECT osg.refused('moving a photo to another job', $q$UPDATE public.job_box_photos SET job_id = '00000000-0000-0000-0000-0000000609a2' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'keeps its box, its job and who took it');
SELECT osg.refused('moving a photo to another box', $q$UPDATE public.job_box_photos SET container_id = 'a6090c02-0000-0000-0000-0000000609c2' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'keeps its box, its job and who took it');
SELECT osg.refused('handing a photo to a teammate', $q$UPDATE public.job_box_photos SET by_user_id = '00000000-0000-0000-0000-0000000609d3' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'keeps its box, its job and who took it');
SELECT osg.refused('pointing a photo at another shot''s place in the bucket', $q$UPDATE public.job_box_photos SET storage_path = '00000000-0000-0000-0000-0000000609a1/00000000-0000-0000-0000-000000060932.jpg' WHERE id = '00000000-0000-0000-0000-000000060931'$q$, 'place in the bucket is its own');
RESET ROLE;
SELECT osg.same('the phone''s own changes landed, and no refused one did', osg.one($q$SELECT string_agg(status || ' ' || COALESCE(storage_path, 'no place') || ' ' || COALESCE(drive_file_id, 'no file'), ' | ' ORDER BY id) FROM public.job_box_photos WHERE id IN ('00000000-0000-0000-0000-000000060931', '00000000-0000-0000-0000-000000060932')$q$), 'shared 00000000-0000-0000-0000-0000000609a1/00000000-0000-0000-0000-000000060931.jpg no file | sending 00000000-0000-0000-0000-0000000609a1/00000000-0000-0000-0000-000000060932.jpg no file');

-- The sweep, as the service role, still files a photo and clears its place in the bucket.
SET LOCAL ROLE service_role;
UPDATE public.job_box_photos SET status = 'filed', drive_file_id = 'drive-file-the-sweep-made', filed_at = now(), storage_path = NULL, fail_why = NULL WHERE id = '00000000-0000-0000-0000-000000060932';
RESET ROLE;
SELECT osg.same('the sweep files a photo as before', osg.one($q$SELECT status || ' · ' || drive_file_id || ' · ' || COALESCE(storage_path, 'no place') FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000060932'$q$), 'filed · drive-file-the-sweep-made · no place');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A box keeps its job. The helper is on both jobs' crews, so the gate would let the row through on either.
SELECT osg.as_user('00000000-0000-0000-0000-0000000609d2');
SET LOCAL ROLE authenticated;
SELECT osg.refused('moving a box to another job by a direct update', $q$UPDATE public.job_containers SET job_id = '00000000-0000-0000-0000-0000000609a2' WHERE id = 'a6090c02-0000-0000-0000-0000000609c2'$q$, 'changes job only when its job is combined or moved');
-- What the screens do to a box still lands: a new name, a retire, a pin.
UPDATE public.job_containers SET label = 'A2 FITTINGS', retired_at = now(), lat = 29.5, lng = -98.4 WHERE id = 'a6090c02-0000-0000-0000-0000000609c2';
RESET ROLE;
SELECT osg.same('the box is on its own job, renamed and retired', osg.one($q$SELECT job_id::text || ' · ' || label || ' · ' || (retired_at IS NOT NULL)::text FROM public.job_containers WHERE id = 'a6090c02-0000-0000-0000-0000000609c2'$q$), '00000000-0000-0000-0000-0000000609a1 · A2 FITTINGS · true');
-- The office's own path (on_site_carry_job runs inside a definer function, as its owner) still changes a box's job.
UPDATE public.job_containers SET job_id = '00000000-0000-0000-0000-0000000609a2' WHERE id = 'a6090c01-0000-0000-0000-0000000609c1';
SELECT osg.same('the office''s own code still moves a box to another job', osg.one($q$SELECT job_id::text FROM public.job_containers WHERE id = 'a6090c01-0000-0000-0000-0000000609c1'$q$), '00000000-0000-0000-0000-0000000609a2');

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
