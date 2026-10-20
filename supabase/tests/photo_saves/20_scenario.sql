-- A job's tick to save its photos to Drive (Messages, cut 10, migration *_photo_saves): the office turns it on and off for
-- a bid, a GC project or a Pipeline job through set_photo_save, stamped with who and when; on keeps the time it first went
-- on, off clears it, the same press twice changes nothing, and turning off a job never ticked writes nothing; nobody
-- outside the office, nor training mode, a twin or anyone signed out, can press it, and nobody writes the table by hand;
-- the office reads the ticks and nobody else does; the three fences are on the table; and a text's picture the webhook
-- could not copy is marked quo_not_copied, which the column's CHECK now takes. Presses run as each user; the webhook's
-- writes are made as postgres, standing in for the service role; everything rolls back. Raises on the first failed
-- assertion; ends with "photo_saves PASSED". See scripts/pgtest-photo-saves.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant), a superintendent outside it, an estimator in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@photos.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'assistant@photos.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'super@photos.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'training@photos.test'),
  ('00000000-0000-0000-0000-0000000009d5', 'twin@photos.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@photos.test', 'Photos Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000009d2', 'assistant@photos.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000009d3', 'super@photos.test', 'Photos Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000009d4', 'training@photos.test', 'Photos Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000009d5', 'twin@photos.test', 'Photos Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The prototype's Helotes Dental Office, a GC project; a Pipeline job; and a bid. Priya Raman texts the office.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c9', 'Photos Helotes Dental', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000009a1', 'Photos Helotes Dental Office', '00000000-0000-0000-0000-0000000009c9');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000009a1', 'bidding');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000009a9', 'Photos Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name)
  VALUES ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009a9', 'Photos Pipeline job');
INSERT INTO public.bids (id, created_by, service_type_id, project_name)
  VALUES ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009a9', 'Photos Boerne Retail');
INSERT INTO public.contacts (id, kind, customer_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'customer', '00000000-0000-0000-0000-0000000009c9');
INSERT INTO public.messages (id, contact_id, project_id, channel, direction, who_text, body) VALUES
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009a1', 'text', 'in',
   'Priya Raman', 'Here''s the stain above operatory 3, and the old sink cabinet I want gone before you start.');

CREATE SCHEMA phs;
CREATE FUNCTION phs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION phs.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION phs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION phs.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END $$;
-- Somewhere to keep a time between statements that run as different roles.
CREATE TABLE phs.kept (label text PRIMARY KEY, at timestamptz);
GRANT USAGE ON SCHEMA phs TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA phs TO anon, authenticated, service_role;
GRANT ALL ON phs.kept TO authenticated;

-- 1 · Rosa ticks Helotes on: one row, stamped with her and the time; the same press again keeps that time.
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
INSERT INTO phs.kept VALUES ('first on', public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, true));
SELECT phs.same('the tick goes on, and says since when', (SELECT (at IS NOT NULL)::text FROM phs.kept WHERE label = 'first on'), 'true');
SELECT phs.same('on again keeps the time it first went on', (
  SELECT (public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, true) = at)::text FROM phs.kept WHERE label = 'first on'), 'true');
SELECT phs.same('the office reads the tick, stamped with who', (
  SELECT count(*)::text || ' · ' || min(set_by::text) FROM public.photo_saves WHERE project_id = '00000000-0000-0000-0000-0000000009a1'),
  '1 · 00000000-0000-0000-0000-0000000009d2');
RESET ROLE;

-- 2 · Off clears it; on again starts a new time, later than the first.
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT phs.same('off says no time', (SELECT coalesce(public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)::text, 'off')), 'off');
SELECT phs.same('off keeps the row, stamped with who turned it off', (
  SELECT (on_since IS NULL)::text || ' · ' || set_by::text FROM public.photo_saves WHERE project_id = '00000000-0000-0000-0000-0000000009a1'),
  'true · 00000000-0000-0000-0000-0000000009d1');
SELECT phs.same('off again changes nothing', (SELECT coalesce(public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)::text, 'off')), 'off');
SELECT phs.same('on again starts after the first time', (
  SELECT (public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, true) > at)::text FROM phs.kept WHERE label = 'first on'), 'true');
RESET ROLE;

-- 3 · Every job starts off: turning off a job never ticked writes nothing. A Pipeline job and a bid tick the same way.
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT phs.same('off on a job never ticked says no time', (SELECT coalesce(public.set_photo_save(NULL, NULL, '00000000-0000-0000-0000-0000000009a2', false)::text, 'off')), 'off');
SELECT phs.same('and writes no row', (SELECT count(*)::text FROM public.photo_saves WHERE jobs_ledger_id = '00000000-0000-0000-0000-0000000009a2'), '0');
SELECT public.set_photo_save(NULL, NULL, '00000000-0000-0000-0000-0000000009a2', true);
SELECT public.set_photo_save('00000000-0000-0000-0000-0000000009a3', NULL, NULL, true);
SELECT phs.same('a Pipeline job and a bid tick on too', (
  SELECT string_agg(k, ', ' ORDER BY k) FROM (
    SELECT CASE WHEN bid_id IS NOT NULL THEN 'bid' WHEN project_id IS NOT NULL THEN 'project' ELSE 'pipeline' END AS k
    FROM public.photo_saves WHERE on_since IS NOT NULL) ticked), 'bid, pipeline, project');
SELECT phs.refused('a press names one job', $q$SELECT public.set_photo_save('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009a1', NULL, true)$q$,
  'Name one job');
SELECT phs.refused('a press names a job', $q$SELECT public.set_photo_save(NULL, NULL, NULL, true)$q$, 'Name one job');
SELECT phs.refused('a press says on or off', $q$SELECT public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, NULL)$q$, 'Say on or off');
SELECT phs.refused('the office writes no tick by hand', $q$INSERT INTO public.photo_saves (project_id, on_since) VALUES ('00000000-0000-0000-0000-0000000009a1', now())$q$,
  'permission denied');
SELECT phs.refused('nor changes one by hand', $q$UPDATE public.photo_saves SET on_since = NULL$q$, 'permission denied');
RESET ROLE;

-- 4 · Nobody outside the office presses it, nor training mode, a twin or anyone signed out; and nobody else reads the ticks.
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT phs.refused('a superintendent changes no job''s photos', $q$SELECT public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)$q$,
  'Only the office');
SELECT phs.same('a superintendent reads no tick', (SELECT count(*)::text FROM public.photo_saves), '0');
RESET ROLE;
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT phs.refused('training mode changes no job''s photos', $q$SELECT public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)$q$,
  'training account');
RESET ROLE;
SELECT phs.as_user('00000000-0000-0000-0000-0000000009d5');
SET LOCAL ROLE authenticated;
SELECT phs.refused('a twin changes no job''s photos', $q$SELECT public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)$q$,
  'digital twin');
RESET ROLE;
SELECT phs.as_anon();
SET LOCAL ROLE anon;
SELECT phs.refused('nobody signed out presses it', $q$SELECT public.set_photo_save(NULL, '00000000-0000-0000-0000-0000000009a1', NULL, false)$q$, 'permission denied');
SELECT phs.refused('nor reads the ticks', $q$SELECT count(*) FROM public.photo_saves$q$, 'permission denied');
RESET ROLE;
SELECT phs.same('the tick is still on after every refusal', (
  SELECT (on_since IS NOT NULL)::text FROM public.photo_saves WHERE project_id = '00000000-0000-0000-0000-0000000009a1'), 'true');

-- 5 · The table keeps one row per job, and a row names one job.
SELECT phs.refused('a row names one job', $q$INSERT INTO public.photo_saves (bid_id, project_id) VALUES ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009a1')$q$,
  'photo_saves_one_job');
SELECT phs.refused('one row a job', $q$INSERT INTO public.photo_saves (project_id) VALUES ('00000000-0000-0000-0000-0000000009a1')$q$, 'photo_saves_project');

-- 6 · The three fences are on the table: training mode's policies and its statement trigger, and the twins' fence.
SELECT phs.same('training mode''s and the twins'' policies are on the table', (
  SELECT (count(*) FILTER (WHERE permissive = 'RESTRICTIVE') >= 2)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_saves'), 'true');
SELECT phs.same('the twins'' fence is one of them', (
  SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_saves' AND policyname = 'digital_twin_write_fence_insert'), '1');
SELECT phs.same('training mode''s statement trigger is on the table', (
  SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.photo_saves'::regclass AND tgname = 'read_only_block_stmt'), '1');

-- 7 · A text's picture the webhook could not copy is marked quo_not_copied; an email's marks stay; nothing else is a mark.
INSERT INTO public.message_attachments (message_id, sort_order, kind, name, mime, bucket_path) VALUES
  ('00000000-0000-0000-0000-0000000009f1', 0, 'file', 'picture-1.jpg', 'image/jpeg', 'quo/MS-1/1.jpg');
INSERT INTO public.message_attachments (message_id, sort_order, kind, name, mime, left_in_gmail) VALUES
  ('00000000-0000-0000-0000-0000000009f1', 1, 'file', 'picture-2.jpg', 'image/jpeg', 'quo_not_copied');
SELECT phs.same('a text''s picture is kept, or marked as not copied from Quo', (
  SELECT string_agg(coalesce(bucket_path, left_in_gmail), ', ' ORDER BY sort_order) FROM public.message_attachments WHERE message_id = '00000000-0000-0000-0000-0000000009f1'),
  'quo/MS-1/1.jpg, quo_not_copied');
SELECT phs.same('an email''s marks are still marks', (
  SELECT pg_get_constraintdef(oid) LIKE '%too_big%not_copied%quo_not_copied%' FROM pg_constraint WHERE conname = 'message_attachments_left_known')::text, 'true');
SELECT phs.same('and the CHECK is checked', (SELECT convalidated::text FROM pg_constraint WHERE conname = 'message_attachments_left_known'), 'true');
SELECT phs.refused('nothing else is a mark', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, left_in_gmail) VALUES ('00000000-0000-0000-0000-0000000009f1', 2, 'file', 'picture-3.jpg', 'lost')$q$,
  'message_attachments_left_known');

DO $$ BEGIN RAISE NOTICE 'photo_saves PASSED'; END $$;
ROLLBACK;
