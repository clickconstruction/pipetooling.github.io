-- A person matter's text documents are a dev's alone (20261112030000): the fence on `documents` and
-- `document_revisions` that the five older legal tables already carry. Here: a dev reads and writes every document;
-- a master, an assistant and a controller read and write an ACCOUNT matter's text document and its history as before,
-- and see nothing of a PERSON matter's — not the row, not its prior version, not through an update or an insert; an
-- estimator reads none; a person's own document stays a dev's. Made-up people and words. Fixtures made as postgres;
-- every probe runs as a signed-in user through RLS, inside one transaction that rolls back. Raises on the first
-- failed assertion; ends with "person_matter_document_fence PASSED". See
-- scripts/pgtest-person-matter-document-fence.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;
CREATE SCHEMA pmf;
CREATE FUNCTION pmf.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmf.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pmf.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What a signed-in user reads through RLS of this bed's own documents: the titles, in order.
CREATE FUNCTION pmf.docs() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(string_agg(d.title, ', ' ORDER BY d.title), 'none') FROM public.documents d WHERE d.id::text LIKE '00000000-0000-0000-0000-0000000966a%' $$;
CREATE FUNCTION pmf.revs() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(string_agg(r.title, ', ' ORDER BY r.title), 'none') FROM public.document_revisions r WHERE r.document_id::text LIKE '00000000-0000-0000-0000-0000000966a%' $$;
-- How many rows an UPDATE touched, as the caller.
CREATE FUNCTION pmf.retitle(p_id uuid, p_title text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE public.documents SET title = p_title WHERE id = p_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
GRANT USAGE ON SCHEMA pmf TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmf TO authenticated;

-- Who: one of each role the office policies name, and one they do not.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000966d1', 'dev@fence.test'),
  ('00000000-0000-0000-0000-0000000966d2', 'master@fence.test'),
  ('00000000-0000-0000-0000-0000000966d3', 'assistant@fence.test'),
  ('00000000-0000-0000-0000-0000000966d4', 'controller@fence.test'),
  ('00000000-0000-0000-0000-0000000966d5', 'estimator@fence.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000966d1', 'dev@fence.test', 'Fence Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000966d2', 'master@fence.test', 'Fence Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000966d3', 'assistant@fence.test', 'Fence Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000966d4', 'controller@fence.test', 'Fence Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000966d5', 'estimator@fence.test', 'Fence Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A person with a document of their own, a matter standing on them with a text document, and an account matter with one.
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000966b1', '00000000-0000-0000-0000-0000000966d1', 'helper', 'Pat Sample');
INSERT INTO public.legal_matters (id, payer_key, kind, person_id) VALUES
  ('00000000-0000-0000-0000-000000096601', 'bed:fence-person', 'person', '00000000-0000-0000-0000-0000000966b1'),
  ('00000000-0000-0000-0000-000000096602', 'bed:fence-account', 'account', NULL);
INSERT INTO public.documents (id, person_id, matter_id, title, content) VALUES
  ('00000000-0000-0000-0000-0000000966a1', NULL, '00000000-0000-0000-0000-000000096601', 'Person matter notes', 'The gate was left open.'),
  ('00000000-0000-0000-0000-0000000966a2', NULL, '00000000-0000-0000-0000-000000096602', 'Account matter notes', 'The invoice went out in March.'),
  ('00000000-0000-0000-0000-0000000966a3', '00000000-0000-0000-0000-0000000966b1', NULL, 'Person file memo', 'Started in February.');
-- One edit each, so each has a prior version in document_revisions (the archive trigger writes it).
UPDATE public.documents SET content = content || ' Twice.' WHERE id IN ('00000000-0000-0000-0000-0000000966a1', '00000000-0000-0000-0000-0000000966a2');

SELECT pmf.same('both tables carry the fence, restrictive, on every verb',
  (SELECT string_agg(tablename || ':' || permissive || ':' || cmd, ' ' ORDER BY tablename) FROM pg_policies
    WHERE schemaname = 'public' AND policyname IN ('documents_person_matter_dev_only', 'document_revisions_person_matter_dev_only')),
  'document_revisions:RESTRICTIVE:ALL documents:RESTRICTIVE:ALL');

-- ── a dev: everything ────────────────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pmf.as_user('00000000-0000-0000-0000-0000000966d1');
SELECT pmf.same('a dev reads every document', pmf.docs(), 'Account matter notes, Person file memo, Person matter notes');
SELECT pmf.same('a dev reads both prior versions', pmf.revs(), 'Account matter notes, Person matter notes');
SELECT pmf.same('a dev changes the person matter''s document', pmf.retitle('00000000-0000-0000-0000-0000000966a1', 'Person matter notes'), '1');
INSERT INTO public.documents (id, matter_id, title, content) VALUES
  ('00000000-0000-0000-0000-0000000966a4', '00000000-0000-0000-0000-000000096601', 'Person matter second', 'Written by the dev.');
SELECT pmf.same('a dev adds a document on the person matter', pmf.docs(), 'Account matter notes, Person file memo, Person matter notes, Person matter second');

-- ── the office roles: the account matter as before, nothing of the person matter ─────────────────
SELECT pmf.as_user('00000000-0000-0000-0000-0000000966d2');
SELECT pmf.same('a master reads the account matter''s document alone', pmf.docs(), 'Account matter notes');
SELECT pmf.same('a master reads the account matter''s prior version alone', pmf.revs(), 'Account matter notes');
SELECT pmf.as_user('00000000-0000-0000-0000-0000000966d4');
SELECT pmf.same('a controller reads the account matter''s document alone', pmf.docs(), 'Account matter notes');
SELECT pmf.same('a controller reads the account matter''s prior version alone', pmf.revs(), 'Account matter notes');
SELECT pmf.as_user('00000000-0000-0000-0000-0000000966d3');
SELECT pmf.same('an assistant reads the account matter''s document alone', pmf.docs(), 'Account matter notes');
SELECT pmf.same('an assistant reads the account matter''s prior version alone', pmf.revs(), 'Account matter notes');
SELECT pmf.same('an assistant''s update of the person matter''s document touches nothing', pmf.retitle('00000000-0000-0000-0000-0000000966a1', 'Retitled by the office'), '0');
SELECT pmf.same('an assistant still changes the account matter''s document', pmf.retitle('00000000-0000-0000-0000-0000000966a2', 'Account matter notes'), '1');
SELECT pmf.refused('an assistant cannot add a document on the person matter',
  $q$INSERT INTO public.documents (matter_id, title, content) VALUES ('00000000-0000-0000-0000-000000096601', 'Slipped in', 'x')$q$, 'row-level security');
SELECT pmf.refused('an assistant cannot move the account matter''s document onto the person matter',
  $q$UPDATE public.documents SET matter_id = '00000000-0000-0000-0000-000000096601' WHERE id = '00000000-0000-0000-0000-0000000966a2'$q$, 'row-level security');
INSERT INTO public.documents (id, matter_id, title, content) VALUES
  ('00000000-0000-0000-0000-0000000966a5', '00000000-0000-0000-0000-000000096602', 'Account matter second', 'Written by the office.');
SELECT pmf.same('an assistant still adds a document on the account matter', pmf.docs(), 'Account matter notes, Account matter second');

-- ── a role outside the office: nothing ───────────────────────────────────────────────────────────
SELECT pmf.as_user('00000000-0000-0000-0000-0000000966d5');
SELECT pmf.same('an estimator reads no document', pmf.docs(), 'none');
SELECT pmf.same('an estimator reads no prior version', pmf.revs(), 'none');
RESET ROLE;

-- The office's failed update left the person matter's document as it was.
SELECT pmf.same('the person matter''s document kept its title', (SELECT title FROM public.documents WHERE id = '00000000-0000-0000-0000-0000000966a1'), 'Person matter notes');

DO $$ BEGIN RAISE NOTICE 'person_matter_document_fence PASSED'; END $$;
ROLLBACK;
