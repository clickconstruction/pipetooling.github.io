-- Write someone up, the photos (20261121143500, punch list #410): who adds a photo row and who reads it. Here: a
-- leader and a superintendent add rows under their own folder; a path in another person's folder, another person's
-- name and a helper are refused; the writer reads their own, a dev reads all, another leader and the person written
-- about read none; a photo is dropped while its write-up has not been sent and stays once it has. Made-up people and
-- words. Fixtures made as postgres; the writes run as signed-in users through RLS, inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "person_report_photos PASSED". See
-- scripts/pgtest-person-report-photos.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA wph;
CREATE FUNCTION wph.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION wph.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION wph.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION wph.count_all() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.person_report_photos $$;
GRANT USAGE ON SCHEMA wph TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA wph TO authenticated;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004105d1', 'leader@writeupphotos.test'),
  ('00000000-0000-0000-0000-0000004105d2', 'super@writeupphotos.test'),
  ('00000000-0000-0000-0000-0000004105d3', 'helper@writeupphotos.test'),
  ('00000000-0000-0000-0000-0000004105d4', 'leader2@writeupphotos.test'),
  ('00000000-0000-0000-0000-0000004105d7', 'dev@writeupphotos.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000004105d1', 'leader@writeupphotos.test', 'Marcus Leader', 'master_technician'),
  ('00000000-0000-0000-0000-0000004105d2', 'super@writeupphotos.test', 'Sal Super', 'superintendent'),
  ('00000000-0000-0000-0000-0000004105d3', 'helper@writeupphotos.test', 'Dana Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000004105d4', 'leader2@writeupphotos.test', 'Sam Leader', 'master_technician'),
  ('00000000-0000-0000-0000-0000004105d7', 'dev@writeupphotos.test', 'Photos Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000004105b3', '00000000-0000-0000-0000-0000004105d7', 'helper', 'Dana Helper', '00000000-0000-0000-0000-0000004105d3');

SET LOCAL ROLE authenticated;

-- ── who may ──────────────────────────────────────────────────────────────────────────────────
SELECT wph.as_user('00000000-0000-0000-0000-0000004105d1');
SELECT wph.same('a leader may write someone up', public.can_write_someone_up()::text, 'true');
INSERT INTO public.person_report_photos (id, press_id, author_user_id, storage_path) VALUES
  ('00000000-0000-0000-0000-00000041f001', '00000000-0000-0000-0000-00000041aaa1', '00000000-0000-0000-0000-0000004105d1',
   '00000000-0000-0000-0000-0000004105d1/00000000-0000-0000-0000-00000041aaa1/00000000-0000-0000-0000-00000041f001.jpg'),
  ('00000000-0000-0000-0000-00000041f002', '00000000-0000-0000-0000-00000041aaa1', '00000000-0000-0000-0000-0000004105d1',
   '00000000-0000-0000-0000-0000004105d1/00000000-0000-0000-0000-00000041aaa1/00000000-0000-0000-0000-00000041f002.jpg');
SELECT wph.same('a leader adds photos to a write-up and reads them', (SELECT count(*)::text FROM public.person_report_photos), '2');
SELECT wph.refused('a path in another person''s folder',
  $q$INSERT INTO public.person_report_photos (press_id, author_user_id, storage_path) VALUES ('00000000-0000-0000-0000-00000041aaa1', '00000000-0000-0000-0000-0000004105d1', '00000000-0000-0000-0000-0000004105d4/00000000-0000-0000-0000-00000041aaa1/x.jpg')$q$,
  'row-level security');
SELECT wph.refused('a path under another press',
  $q$INSERT INTO public.person_report_photos (press_id, author_user_id, storage_path) VALUES ('00000000-0000-0000-0000-00000041aaa1', '00000000-0000-0000-0000-0000004105d1', '00000000-0000-0000-0000-0000004105d1/00000000-0000-0000-0000-00000041aaa9/x.jpg')$q$,
  'row-level security');
SELECT wph.refused('a row under another person''s name',
  $q$INSERT INTO public.person_report_photos (press_id, author_user_id, storage_path) VALUES ('00000000-0000-0000-0000-00000041aaa1', '00000000-0000-0000-0000-0000004105d4', '00000000-0000-0000-0000-0000004105d4/00000000-0000-0000-0000-00000041aaa1/x.jpg')$q$,
  'row-level security');
SELECT wph.refused('a change to a row',
  $q$UPDATE public.person_report_photos SET taken_at = now() WHERE id = '00000000-0000-0000-0000-00000041f001'$q$,
  'permission denied');

SELECT wph.as_user('00000000-0000-0000-0000-0000004105d2');
SELECT wph.same('a superintendent may write someone up', public.can_write_someone_up()::text, 'true');
INSERT INTO public.person_report_photos (id, press_id, author_user_id, storage_path) VALUES
  ('00000000-0000-0000-0000-00000041f003', '00000000-0000-0000-0000-00000041bbb1', '00000000-0000-0000-0000-0000004105d2',
   '00000000-0000-0000-0000-0000004105d2/00000000-0000-0000-0000-00000041bbb1/00000000-0000-0000-0000-00000041f003.jpg');
SELECT wph.same('a superintendent reads only their own photo', (SELECT count(*)::text FROM public.person_report_photos), '1');

SELECT wph.as_user('00000000-0000-0000-0000-0000004105d3');
SELECT wph.same('a helper may not', public.can_write_someone_up()::text, 'false');
SELECT wph.refused('a helper adding a photo',
  $q$INSERT INTO public.person_report_photos (press_id, author_user_id, storage_path) VALUES ('00000000-0000-0000-0000-00000041ccc1', '00000000-0000-0000-0000-0000004105d3', '00000000-0000-0000-0000-0000004105d3/00000000-0000-0000-0000-00000041ccc1/x.jpg')$q$,
  'row-level security');
SELECT wph.same('the person written about reads none', (SELECT count(*)::text FROM public.person_report_photos), '0');

SELECT wph.as_user('00000000-0000-0000-0000-0000004105d4');
SELECT wph.same('another leader reads none', (SELECT count(*)::text FROM public.person_report_photos), '0');
DELETE FROM public.person_report_photos WHERE id = '00000000-0000-0000-0000-00000041f001';
SELECT wph.same('and drops none', wph.count_all(), '3');

SELECT wph.as_user('00000000-0000-0000-0000-0000004105d7');
SELECT wph.same('a dev reads all of them', (SELECT count(*)::text FROM public.person_report_photos), '3');

-- ── dropped before the send, kept after ─────────────────────────────────────────────────────────
SELECT wph.as_user('00000000-0000-0000-0000-0000004105d1');
DELETE FROM public.person_report_photos WHERE id = '00000000-0000-0000-0000-00000041f002';
SELECT wph.same('the writer drops a photo before the write-up is sent', wph.count_all(), '2');
SELECT wph.same('the write-up lands on the same press',
  (public.land_person_report(jsonb_build_object(
    'press_id', '00000000-0000-0000-0000-00000041aaa1', 'subject_person_id', '00000000-0000-0000-0000-0000004105b3',
    'kind', 'safety', 'content', 'The trench was open at lunch.',
    'occurred_date', (now() AT TIME ZONE 'America/Chicago')::date))->>'status'), 'pending');
DELETE FROM public.person_report_photos WHERE id = '00000000-0000-0000-0000-00000041f001';
SELECT wph.same('a photo of a write-up that has been sent stays', wph.count_all(), '2');
SELECT wph.same('the photos of a report are found by its press',
  (SELECT count(*)::text FROM public.person_report_photos ph JOIN public.person_reports r ON r.press_id = ph.press_id
    WHERE r.subject_person_id = '00000000-0000-0000-0000-0000004105b3'), '1');

DO $$ BEGIN RAISE NOTICE 'person_report_photos PASSED'; END $$;
ROLLBACK;
