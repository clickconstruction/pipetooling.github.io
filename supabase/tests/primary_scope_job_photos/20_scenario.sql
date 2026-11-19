-- A primary reads the photo notes, the first looks and the crew's position of the jobs they have a claim on (punch
-- list #400 PR 3, migration *_primary_scope_job_photos). Luis is a primary and the account manager of J1. Pat is a
-- primary on nothing. Kim is a primary on J3's crew and nothing more. J3 is the office's. Each job has a photo note
-- by Sam with its file, a first look with its file, and a clock session. Pat also took one shot on J3, and one look
-- with no job asks Pat for a read. Luis reads J1's. Kim reads J3's notes and look as its crew, and no position.
-- Pat reads his own shot and the look that asks him, and nothing else, and still adds a shot on any job. Rosa the
-- assistant reads all. Sam, a helper who clocked on both jobs, reads what he read before. Everything rolls back. Raises on the
-- first failed assertion; ends with "primary_scope_job_photos PASSED". See
-- scripts/pgtest-primary-scope-job-photos.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fea04', 'luis@jobphotos.test'),
  ('00000000-0000-0000-0000-0000000fea05', 'pat@jobphotos.test'),
  ('00000000-0000-0000-0000-0000000fea06', 'kim@jobphotos.test'),
  ('00000000-0000-0000-0000-0000000fea03', 'rosa@jobphotos.test'),
  ('00000000-0000-0000-0000-0000000fea07', 'mo@jobphotos.test'),
  ('00000000-0000-0000-0000-0000000fea08', 'sam@jobphotos.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fea04', 'luis@jobphotos.test', 'Photos Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fea05', 'pat@jobphotos.test', 'Photos Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fea06', 'kim@jobphotos.test', 'Photos Kim', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fea03', 'rosa@jobphotos.test', 'Photos Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fea07', 'mo@jobphotos.test', 'Photos Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000fea08', 'sam@jobphotos.test', 'Photos Sam', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000feb01', 'Job Photos Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fec01', '00000000-0000-0000-0000-0000000fea07', 'Dana Whitfield');
-- J1 is Luis's. J3 is nobody's but the office's, with Kim and Sam on its crew.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000fef01', '00000000-0000-0000-0000-0000000fea07', '00000000-0000-0000-0000-0000000feb01', '8101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fec01', 'customer', 0, 0, 'working', '00000000-0000-0000-0000-0000000fea04', 'primary'),
  ('00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea07', '00000000-0000-0000-0000-0000000feb01', '8103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fec01', 'customer', 0, 0, 'working', NULL, NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea06'),
  ('00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea08') ON CONFLICT DO NOTHING;
-- Sam's note on each job, and Pat's own shot on the job that is not his. Each has its file.
INSERT INTO public.job_photo_notes (id, job_id, by_user_id, by_name, caption, storage_path, added_at) VALUES
  ('00000000-0000-0000-0000-0000000fe101', '00000000-0000-0000-0000-0000000fef01', '00000000-0000-0000-0000-0000000fea08', 'Photos Sam', 'N1', '00000000-0000-0000-0000-0000000fef01/n1.jpg', now()),
  ('00000000-0000-0000-0000-0000000fe103', '00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea08', 'Photos Sam', 'N3', '00000000-0000-0000-0000-0000000fef03/n3.jpg', now()),
  ('00000000-0000-0000-0000-0000000fe105', '00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea05', 'Photos Pat', 'N3pat', '00000000-0000-0000-0000-0000000fef03/np.jpg', now());
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('job-photo-notes', '00000000-0000-0000-0000-0000000fef01/n1.jpg', '00000000-0000-0000-0000-0000000fea08'),
  ('job-photo-notes', '00000000-0000-0000-0000-0000000fef03/n3.jpg', '00000000-0000-0000-0000-0000000fea08'),
  ('job-photo-notes', '00000000-0000-0000-0000-0000000fef03/np.jpg', '00000000-0000-0000-0000-0000000fea05');
-- A first look on each job, and one with no job that asks Pat for a read. Each has one file.
INSERT INTO public.first_looks (id, label, code_hash, expires_at, job_id, asked_tech_ids) VALUES
  ('00000000-0000-0000-0000-0000000fe201', 'L1', repeat('0', 63) || '1', now() + interval '7 days', '00000000-0000-0000-0000-0000000fef01', '{}'),
  ('00000000-0000-0000-0000-0000000fe203', 'L3', repeat('0', 63) || '3', now() + interval '7 days', '00000000-0000-0000-0000-0000000fef03', '{}'),
  ('00000000-0000-0000-0000-0000000fe209', 'L9', repeat('0', 63) || '9', now() + interval '7 days', NULL, ARRAY['00000000-0000-0000-0000-0000000fea05']::uuid[]);
INSERT INTO public.first_look_files (look_id, kind, mime, storage_path, declared_bytes) VALUES
  ('00000000-0000-0000-0000-0000000fe201', 'photo', 'image/jpeg', '00000000-0000-0000-0000-0000000fe201/a.jpg', 10),
  ('00000000-0000-0000-0000-0000000fe203', 'photo', 'image/jpeg', '00000000-0000-0000-0000-0000000fe203/a.jpg', 10),
  ('00000000-0000-0000-0000-0000000fe209', 'photo', 'image/jpeg', '00000000-0000-0000-0000-0000000fe209/a.jpg', 10);
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('first-look-files', '00000000-0000-0000-0000-0000000fe201/a.jpg'),
  ('first-look-files', '00000000-0000-0000-0000-0000000fe203/a.jpg'),
  ('first-look-files', '00000000-0000-0000-0000-0000000fe209/a.jpg');
INSERT INTO public.clock_sessions (user_id, clocked_in_at, work_date, job_ledger_id) VALUES
  ('00000000-0000-0000-0000-0000000fea08', now() - interval '1 day', current_date - 1, '00000000-0000-0000-0000-0000000fef01'),
  ('00000000-0000-0000-0000-0000000fea08', now() - interval '2 days', current_date - 2, '00000000-0000-0000-0000-0000000fef03');

CREATE SCHEMA pjp;
CREATE FUNCTION pjp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pjp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Everything the signed-in person reads, door by door. Invoker: the policies and the function decide.
CREATE FUNCTION pjp.reads() RETURNS text LANGUAGE sql AS $$
  SELECT 'notes ' || coalesce((SELECT string_agg(caption, ' ' ORDER BY caption) FROM public.job_photo_notes WHERE caption LIKE 'N%' AND job_id IN ('00000000-0000-0000-0000-0000000fef01', '00000000-0000-0000-0000-0000000fef03')), 'none')
      || ' · note files ' || coalesce((SELECT string_agg(right(name, 6), ' ' ORDER BY name) FROM storage.objects WHERE bucket_id = 'job-photo-notes' AND name LIKE '00000000-0000-0000-0000-0000000fef0%'), 'none')
      || ' · looks ' || coalesce((SELECT string_agg(label, ' ' ORDER BY label) FROM public.first_looks WHERE id IN ('00000000-0000-0000-0000-0000000fe201', '00000000-0000-0000-0000-0000000fe203', '00000000-0000-0000-0000-0000000fe209')), 'none')
      || ' · look files ' || (SELECT count(*) FROM public.first_look_files WHERE look_id IN ('00000000-0000-0000-0000-0000000fe201', '00000000-0000-0000-0000-0000000fe203', '00000000-0000-0000-0000-0000000fe209'))::text
      || '+' || (SELECT count(*) FROM storage.objects WHERE bucket_id = 'first-look-files' AND name LIKE '00000000-0000-0000-0000-0000000fe20%')::text
      || ' · position ' || coalesce((SELECT string_agg(right(job_ledger_id::text, 2), ' ' ORDER BY job_ledger_id) FROM public.list_job_crew_position(ARRAY['00000000-0000-0000-0000-0000000fef01', '00000000-0000-0000-0000-0000000fef03']::uuid[], current_date)), 'none')
      || ' · report gate ' || public.can_report_stage_progress('00000000-0000-0000-0000-0000000fef03')::text
$$;
-- A write in a few words: "ok", "no row" when the policy hid the row, or "refused" when the policy refused it.
CREATE FUNCTION pjp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN RETURN 'refused';
  END;
  RETURN CASE WHEN n = 0 THEN 'no row' ELSE 'ok' END;
END $$;
GRANT USAGE ON SCHEMA pjp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pjp TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing: his own shot and the look that asks him, and the report gate still open.
SELECT pjp.as_user('00000000-0000-0000-0000-0000000fea05');
SELECT pjp.same('Pat reads his own shot and the look that asks him', pjp.reads(), 'notes N3pat · note files np.jpg · looks L9 · look files 1+1 · position none · report gate true');
SELECT pjp.same('Pat adds a shot on a job that is not his and reads it back', pjp.try($$WITH made AS (INSERT INTO public.job_photo_notes (job_id, by_user_id, by_name, caption) VALUES ('00000000-0000-0000-0000-0000000fef01', auth.uid(), 'Photos Pat', 'N1pat') RETURNING id) SELECT id FROM made$$), 'ok');
SELECT pjp.same('Pat changes his own shot''s words', pjp.try($$UPDATE public.job_photo_notes SET description = 'under the sink' WHERE id = '00000000-0000-0000-0000-0000000fe105'$$), 'ok');
SELECT pjp.same('Pat cannot change Sam''s shot', pjp.try($$UPDATE public.job_photo_notes SET description = 'x' WHERE id = '00000000-0000-0000-0000-0000000fe103'$$), 'no row');
SELECT pjp.same('Pat cannot file a shot under another name', pjp.try($$INSERT INTO public.job_photo_notes (job_id, by_user_id, by_name, caption) VALUES ('00000000-0000-0000-0000-0000000fef03', '00000000-0000-0000-0000-0000000fea08', 'Photos Sam', 'N3fake')$$), 'refused');

-- 2 · Luis reads his own job's and none of the office's. Pat's new shot on J1 is on his job, so he reads it.
SELECT pjp.as_user('00000000-0000-0000-0000-0000000fea04');
SELECT pjp.same('Luis reads J1', pjp.reads(), 'notes N1 N1pat · note files n1.jpg · looks L1 · look files 1+1 · position 01 · report gate true');

-- 3 · Kim, a primary on J3's crew, reads its notes and its look, and no position.
SELECT pjp.as_user('00000000-0000-0000-0000-0000000fea06');
SELECT pjp.same('Kim reads J3 as its crew does', pjp.reads(), 'notes N3 N3pat · note files n3.jpg np.jpg · looks L3 · look files 1+1 · position none · report gate true');

-- 4 · The office and the helper read as before.
SELECT pjp.as_user('00000000-0000-0000-0000-0000000fea03');
SELECT pjp.same('Rosa reads all', pjp.reads(), 'notes N1 N1pat N3 N3pat · note files n1.jpg n3.jpg np.jpg · looks L1 L3 L9 · look files 3+3 · position 01 03 · report gate true');
SELECT pjp.as_user('00000000-0000-0000-0000-0000000fea08');
SELECT pjp.same('Sam reads the two jobs he clocked on, as before', pjp.reads(), 'notes N1 N1pat N3 N3pat · note files n1.jpg n3.jpg np.jpg · looks L1 L3 · look files 2+2 · position none · report gate true');

DO $$ BEGIN RAISE NOTICE 'primary_scope_job_photos PASSED'; END $$;
ROLLBACK;
