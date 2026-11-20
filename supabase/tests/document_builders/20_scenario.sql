-- The Document builder's table (punch list #404 step 2, migration *_document_builders): a dev alone reads and
-- writes a builder. A builder starts as a draft whatever the client sent, a revision goes up one at a time and only
-- with its published copy, a published copy changes only with its revision, only the published revision can be
-- marked as read, and who made, published and marked it is the caller. A dev in training, a dev's twin and a dev who
-- left are held by the fences. Every name and every word here is made up, and no line is clause wording.
-- Everything rolls back. Raises on the first failed assertion; ends with "document_builders PASSED". See
-- scripts/pgtest-document-builders.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is a dev. The other eight roles are one person each. Tara is a dev in training, Tess a dev's twin and Gwen a
-- dev who left: each would pass is_dev(), so only the fence stands between her and a builder.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004040a1', 'dana@builder.test'),
  ('00000000-0000-0000-0000-0000004040a2', 'marcus@builder.test'),
  ('00000000-0000-0000-0000-0000004040a3', 'ana@builder.test'),
  ('00000000-0000-0000-0000-0000004040a4', 'carol@builder.test'),
  ('00000000-0000-0000-0000-0000004040a5', 'priya@builder.test'),
  ('00000000-0000-0000-0000-0000004040a6', 'pat@builder.test'),
  ('00000000-0000-0000-0000-0000004040a7', 'luis@builder.test'),
  ('00000000-0000-0000-0000-0000004040a8', 'hector@builder.test'),
  ('00000000-0000-0000-0000-0000004040a9', 'sam@builder.test'),
  ('00000000-0000-0000-0000-0000004040b1', 'tara@builder.test'),
  ('00000000-0000-0000-0000-0000004040b2', 'tess@builder.test'),
  ('00000000-0000-0000-0000-0000004040b3', 'gwen@builder.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000004040a1', 'dana@builder.test', 'Dana Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a2', 'marcus@builder.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a3', 'ana@builder.test', 'Ana Assistant', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a4', 'carol@builder.test', 'Carol Controller', 'controller', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a5', 'priya@builder.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a6', 'pat@builder.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a7', 'luis@builder.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a8', 'hector@builder.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040a9', 'sam@builder.test', 'Sam Sub', 'subcontractor', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040b1', 'tara@builder.test', 'Tara Training', 'dev', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040b2', 'tess@builder.test', 'Tess Twin', 'dev', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004040b3', 'gwen@builder.test', 'Gwen Gone', 'dev', false, false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA dbb;
CREATE FUNCTION dbb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Refused with these words; an empty want takes any refusal (a fence's own words are the fence's to choose).
CREATE FUNCTION dbb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION dbb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Run a write as the caller and say how it went: the rows it touched, or "refused".
CREATE FUNCTION dbb.touched(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
  RETURN n::text;
END $$;
-- How many builders the caller reads.
CREATE FUNCTION dbb.reads() RETURNS text LANGUAGE sql AS $$ SELECT count(*)::text FROM public.document_builders $$;
-- Past row-level security: one fact of one builder, as text. VOLATILE, so it reads a write made a statement before.
CREATE FUNCTION dbb.fact(p_key text, p_what text) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.document_builders;
BEGIN
  SELECT * INTO r FROM public.document_builders WHERE key = p_key;
  IF NOT FOUND THEN RETURN 'no row'; END IF;
  RETURN CASE p_what
    WHEN 'kind' THEN r.kind
    WHEN 'revision' THEN r.revision::text
    WHEN 'published' THEN coalesce(r.published::text, 'null')
    WHEN 'draft' THEN r.draft::text
    WHEN 'published_by' THEN coalesce(r.published_by::text, 'null')
    WHEN 'published_at' THEN CASE WHEN r.published_at IS NULL THEN 'null' ELSE 'set' END
    WHEN 'created_by' THEN coalesce(r.created_by::text, 'null')
    WHEN 'updated_by' THEN coalesce(r.updated_by::text, 'null')
    WHEN 'read' THEN coalesce(r.read_revision::text, 'null') || '|' || r.read_by_name || '|' || coalesce(r.read_on::text, 'null')
    WHEN 'read_marked_by' THEN coalesce(r.read_marked_by::text, 'null')
    ELSE 'unknown fact'
  END;
END $$;
CREATE FUNCTION dbb.every() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT count(*)::text FROM public.document_builders $$;
GRANT USAGE ON SCHEMA dbb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dbb TO authenticated, anon;

-- 0 · The table carries its fences, and a second run of the migration left one of each policy.
SELECT dbb.same('the table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_builders' AND policyname = 'archived_fence')::text, '1');
SELECT dbb.same('the table has its training-mode policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_builders' AND policyname LIKE 'read_only_users_cannot_%')::text, '3');
SELECT dbb.same('the table has its twin fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_builders' AND policyname LIKE 'digital_twin_write_fence_%')::text, '3');
SELECT dbb.same('the table has its training-mode statement trigger', (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.document_builders'::regclass AND tgname = 'read_only_block_stmt' AND NOT tgisinternal)::text, '1');
SELECT dbb.same('one of each policy of its own', (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_builders' AND policyname LIKE 'document_builders_%'), 'document_builders_delete, document_builders_insert, document_builders_select, document_builders_update');
SELECT dbb.same('anon holds nothing on the table', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builders' AND grantee = 'anon')::text, '0');
SELECT dbb.same('a signed-in person holds the four row grants, and no more', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builders' AND grantee = 'authenticated'), 'DELETE, INSERT, SELECT, UPDATE');
SELECT dbb.same('nobody signed in may call the stamp', has_function_privilege('authenticated', 'public.document_builders_stamp()', 'EXECUTE')::text, 'false');

-- 1 · Dana, a dev, loads a first draft. It starts as a draft whatever she sent.
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a dev loads a first draft',
  dbb.touched($q$INSERT INTO public.document_builders (key, kind, draft, published, revision, published_by, read_revision, read_by_name, read_on, created_by)
    VALUES ('sub-nda', 'walked', '{"title": "A made-up paper"}', '{"title": "Sent as published"}', 5, '00000000-0000-0000-0000-0000004040a2', 5, 'Nobody', '2026-11-01', '00000000-0000-0000-0000-0000004040a2')$q$), '1');
RESET ROLE;
SELECT dbb.same('it starts on revision 0', dbb.fact('sub-nda', 'revision'), '0');
SELECT dbb.same('with nothing published', dbb.fact('sub-nda', 'published'), 'null');
SELECT dbb.same('and nobody has read it', dbb.fact('sub-nda', 'read'), 'null||null');
SELECT dbb.same('who made it is the caller', dbb.fact('sub-nda', 'created_by'), '00000000-0000-0000-0000-0000004040a1');
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('she reads her builder', dbb.reads(), '1');
SELECT dbb.refused('a name that is not a builder''s name', $q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('Sub NDA', 'walked', '{}')$q$, 'document_builders_key_check');
SELECT dbb.refused('a kind that is neither walked nor filled', $q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('other', 'drawn', '{}')$q$, 'document_builders_kind_check');
SELECT dbb.refused('a draft that is a list', $q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('other', 'filled', '[]')$q$, 'document_builders_draft_check');
SELECT dbb.refused('the same builder twice', $q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('sub-nda', 'walked', '{}')$q$, 'document_builders_pkey');

-- 2 · The draft changes freely, and the revision stands.
SELECT dbb.same('she saves the draft', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "A made-up paper, second pass"}' WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('the draft is saved', dbb.fact('sub-nda', 'draft'), '{"title": "A made-up paper, second pass"}');
SELECT dbb.same('the revision stands', dbb.fact('sub-nda', 'revision'), '0');
SELECT dbb.same('who changed it is the caller', dbb.fact('sub-nda', 'updated_by'), '00000000-0000-0000-0000-0000004040a1');

-- 3 · Publishing: one step at a time, and only with the copy.
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.refused('a published copy with no new revision', $q$UPDATE public.document_builders SET published = draft WHERE key = 'sub-nda'$q$, 'A published copy changes only with a new revision.');
SELECT dbb.refused('a new revision with no copy', $q$UPDATE public.document_builders SET revision = 1 WHERE key = 'sub-nda'$q$, 'A new revision needs its published copy.');
SELECT dbb.refused('a revision two steps on', $q$UPDATE public.document_builders SET published = draft, revision = 2 WHERE key = 'sub-nda'$q$, 'A revision goes up one at a time.');
SELECT dbb.same('she publishes revision 1', dbb.touched($q$UPDATE public.document_builders SET published = draft, revision = 1, published_by = '00000000-0000-0000-0000-0000004040a2' WHERE key = 'sub-nda' AND revision = 0$q$), '1');
RESET ROLE;
SELECT dbb.same('revision 1 is published', dbb.fact('sub-nda', 'revision'), '1');
SELECT dbb.same('the copy is the draft as it stood', dbb.fact('sub-nda', 'published'), '{"title": "A made-up paper, second pass"}');
SELECT dbb.same('who published is the caller', dbb.fact('sub-nda', 'published_by'), '00000000-0000-0000-0000-0000004040a1');
SELECT dbb.same('and the minute is kept', dbb.fact('sub-nda', 'published_at'), 'set');
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a publish from a stale page touches nothing', dbb.touched($q$UPDATE public.document_builders SET published = draft, revision = 1 WHERE key = 'sub-nda' AND revision = 0$q$), '0');
SELECT dbb.refused('a revision going back', $q$UPDATE public.document_builders SET revision = 0, published = NULL WHERE key = 'sub-nda'$q$, 'A revision goes up one at a time.');
SELECT dbb.same('the draft moves on while revision 1 stands', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "A made-up paper, third pass"}' WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('everyone outside still sees revision 1''s words', dbb.fact('sub-nda', 'published'), '{"title": "A made-up paper, second pass"}');
SELECT dbb.same('the name and the kind stand against an update', dbb.fact('sub-nda', 'kind'), 'walked');

-- 4 · The read mark names the published revision, with a name and a day.
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.refused('a mark on a revision not yet published', $q$UPDATE public.document_builders SET read_revision = 2, read_by_name = 'Avery Stone', read_on = '2026-11-20' WHERE key = 'sub-nda'$q$, 'Only the published revision can be marked as read.');
SELECT dbb.refused('a mark with no name', $q$UPDATE public.document_builders SET read_revision = 1, read_by_name = '   ', read_on = '2026-11-20' WHERE key = 'sub-nda'$q$, 'document_builders_read_mark_whole');
SELECT dbb.refused('a mark with no day', $q$UPDATE public.document_builders SET read_revision = 1, read_by_name = 'Avery Stone' WHERE key = 'sub-nda'$q$, 'document_builders_read_mark_whole');
SELECT dbb.same('she marks revision 1 as read', dbb.touched($q$UPDATE public.document_builders SET read_revision = 1, read_by_name = '  Avery Stone ', read_on = '2026-11-20', read_marked_by = '00000000-0000-0000-0000-0000004040a2' WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('the mark is kept, the name trimmed', dbb.fact('sub-nda', 'read'), '1|Avery Stone|2026-11-20');
SELECT dbb.same('who marked it is the caller', dbb.fact('sub-nda', 'read_marked_by'), '00000000-0000-0000-0000-0000004040a1');
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('she publishes revision 2', dbb.touched($q$UPDATE public.document_builders SET published = draft, revision = 2 WHERE key = 'sub-nda' AND revision = 1$q$), '1');
RESET ROLE;
SELECT dbb.same('the mark still names revision 1, so revision 2 is unread', dbb.fact('sub-nda', 'read') || ' on revision ' || dbb.fact('sub-nda', 'revision'), '1|Avery Stone|2026-11-20 on revision 2');
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('she takes the mark off', dbb.touched($q$UPDATE public.document_builders SET read_revision = NULL WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('the name and the day go with it', dbb.fact('sub-nda', 'read'), 'null||null');
SELECT dbb.same('and so does who marked it', dbb.fact('sub-nda', 'read_marked_by'), 'null');
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a builder''s name and kind do not change', dbb.touched($q$UPDATE public.document_builders SET key = 'renamed', kind = 'filled' WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('it is still the Sub NDA, walked', dbb.fact('sub-nda', 'kind'), 'walked');

-- 5 · Every other role: reads nothing, and no write lands.
DO $$
DECLARE who record;
BEGIN
  FOR who IN SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-0000004040a2'::uuid, 'the owner'),
    ('00000000-0000-0000-0000-0000004040a3'::uuid, 'an assistant'),
    ('00000000-0000-0000-0000-0000004040a4'::uuid, 'the controller'),
    ('00000000-0000-0000-0000-0000004040a5'::uuid, 'an estimator'),
    ('00000000-0000-0000-0000-0000004040a6'::uuid, 'a primary'),
    ('00000000-0000-0000-0000-0000004040a7'::uuid, 'a superintendent'),
    ('00000000-0000-0000-0000-0000004040a8'::uuid, 'a helper'),
    ('00000000-0000-0000-0000-0000004040a9'::uuid, 'a sub')) AS t(id, label)
  LOOP
    PERFORM dbb.as_user(who.id);
    SET LOCAL ROLE authenticated;
    PERFORM dbb.same(who.label || ' reads no builder', dbb.reads(), '0');
    PERFORM dbb.same(who.label || ' loads no builder', dbb.touched($q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('theirs', 'filled', '{}')$q$), 'refused');
    PERFORM dbb.same(who.label || ' changes no builder', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "Changed"}'$q$), '0');
    PERFORM dbb.same(who.label || ' deletes no builder', dbb.touched($q$DELETE FROM public.document_builders$q$), '0');
    RESET ROLE;
  END LOOP;
END $$;
SELECT dbb.same('one builder stands, as the dev left it', dbb.every() || ' ' || dbb.fact('sub-nda', 'draft'), '1 {"title": "A made-up paper, third pass"}');

-- 6 · The fences. Each of the three is a dev, so nothing but the fence refuses her.
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040b1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a dev in training reads the builder', dbb.reads(), '1');
SELECT dbb.same('and loads none', dbb.touched($q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('training', 'filled', '{}')$q$), 'refused');
SELECT dbb.same('and changes none', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "Changed in training"}' WHERE key = 'sub-nda'$q$), 'refused');
SELECT dbb.same('and deletes none', dbb.touched($q$DELETE FROM public.document_builders WHERE key = 'sub-nda'$q$), 'refused');
RESET ROLE;
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040b2'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a dev''s twin loads none', dbb.touched($q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('twin', 'filled', '{}')$q$), 'refused');
SELECT dbb.same('and changes none', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "Changed by a twin"}' WHERE key = 'sub-nda'$q$) IN ('0', 'refused')::text, 'true');
SELECT dbb.same('and deletes none', dbb.touched($q$DELETE FROM public.document_builders WHERE key = 'sub-nda'$q$) IN ('0', 'refused')::text, 'true');
RESET ROLE;
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040b3'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a dev who left reads no builder', dbb.reads(), '0');
SELECT dbb.same('and loads none', dbb.touched($q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('gone', 'filled', '{}')$q$), 'refused');
SELECT dbb.same('and changes none', dbb.touched($q$UPDATE public.document_builders SET draft = '{"title": "Changed after leaving"}' WHERE key = 'sub-nda'$q$) IN ('0', 'refused')::text, 'true');
RESET ROLE;
SELECT dbb.same('the builder is as the dev left it', dbb.every() || ' ' || dbb.fact('sub-nda', 'draft'), '1 {"title": "A made-up paper, third pass"}');

-- 7 · Someone not signed in holds no grant at all.
SET LOCAL ROLE anon;
SELECT dbb.refused('someone not signed in reading', $q$SELECT count(*) FROM public.document_builders$q$, 'permission denied');
RESET ROLE;

-- 8 · A dev takes a builder away, to load it again.
SELECT dbb.as_user('00000000-0000-0000-0000-0000004040a1'); SET LOCAL ROLE authenticated;
SELECT dbb.same('a dev deletes the builder', dbb.touched($q$DELETE FROM public.document_builders WHERE key = 'sub-nda'$q$), '1');
RESET ROLE;
SELECT dbb.same('no builder is left', dbb.every(), '0');

DO $$ BEGIN RAISE NOTICE 'document_builders PASSED'; END $$;
ROLLBACK;
