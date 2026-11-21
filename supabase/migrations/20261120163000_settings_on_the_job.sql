SET lock_timeout = '3s';

-- Punch list #389, step 3: settings on the job, the ground (to-dos/sub-nda-builder/README.md, "The design under any
-- look", point 7). A paper built from settings went to nobody: step 1 refused every copy of one, made or signed, until a
-- job carried its settings. This file is what carries them, and it lifts that refusal for such a job's row alone.
--
--   1) job_required_papers gains the job's picks (settings), its typed blanks (fields), the Book revision they were set
--      against, the row's own number in its chain (settings_revision) and the row it replaced (revision_of). All null
--      on every paper a job requires today.
--   2) job_is_zz_test: the ZZ convention's rule in SQL, for the read-revision rule.
--   3) contract_paper_picks_change: which way a change of picks goes, by each choice's place in its list, the loosest
--      first. contract_paper_said: the picks in the list's own plain words. contract_paper_seal: a SHA-256 of a
--      paper's settings, blanks and clauses. Each has a twin in src/lib/contracts/jobPaperSettings.ts.
--   4) job_paper_clauses: the job's paper as the database puts it together, with its picks said in plain words and its
--      seal. The sign page reads it, the accept reads it again, and the copy keeps it.
--   5) job_papers_require takes p_settings, so a paper built from settings can be required with its picks. A new
--      parameter is a new function, so the old one is dropped here. The old two names still call it.
--   6) job_paper_set_settings: the office changes a required paper's settings. Until someone signs, in place. After
--      the first signature the row is locked: a change makes a new row that everyone signs again, and it may only
--      tighten. A trigger holds the lock whatever writes the table.
--   7) The read-revision rule: a job that is not a ZZ Test job takes a paper built from settings only at the revision
--      an attorney read. Held where it is required, where its settings change, and where it is read or signed.
--   8) contract_copy_refuses_bare_settings lets a job's own copy through, and a copy is signed only with the paper
--      frozen on it exactly as the database puts it together at that moment.
--
-- No clause wording is written here. No new table, so no closing calls. Nothing changes for a paper with no settings
-- list: its row, its copy and its signature take the paths they took before. Idempotent, and additive apart from the
-- one function replaced. See docs/migrations/20261120163000_settings_on_the_job.md.

-- 1) The job's settings on the gate's row.
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS settings jsonb;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS fields jsonb;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS book_revision integer;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS settings_revision integer;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES public.job_required_papers(id) ON DELETE SET NULL;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS settings_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS settings_set_at timestamptz;

CREATE INDEX IF NOT EXISTS job_required_papers_revision_of ON public.job_required_papers (revision_of) WHERE revision_of IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_required_papers_settings_whole') THEN
    ALTER TABLE public.job_required_papers ADD CONSTRAINT job_required_papers_settings_whole
      CHECK ((settings IS NULL AND fields IS NULL AND book_revision IS NULL AND settings_revision IS NULL AND revision_of IS NULL)
          OR (jsonb_typeof(settings) = 'object' AND (fields IS NULL OR jsonb_typeof(fields) = 'object')
              AND book_revision >= 1 AND settings_revision >= 1)) NOT VALID;
    ALTER TABLE public.job_required_papers VALIDATE CONSTRAINT job_required_papers_settings_whole;
  END IF;
END $$;

COMMENT ON COLUMN public.job_required_papers.settings IS
  'Punch list #389: the job''s picks for a paper built from settings, {setting: choice}, one for every setting on the Book entry''s list. Null on every other paper. Written only by job_papers_require and job_paper_set_settings, and kept as signed once a copy is signed (job_paper_settings_locked).';
COMMENT ON COLUMN public.job_required_papers.fields IS
  'Punch list #389: what the office typed for this job''s blanks, {field: words}. Null when nothing was typed. A choice fills the rest.';
COMMENT ON COLUMN public.job_required_papers.book_revision IS
  'Punch list #389: the Contract Book revision the settings were set against. A record: the paper is read and signed at the Book''s revision of the day.';
COMMENT ON COLUMN public.job_required_papers.settings_revision IS
  'Punch list #389: this row''s number in its chain, 1 for the first. A change after the first signature makes the next row and takes this one off (revision_of names it).';

-- 2) The ZZ convention in SQL (supabase/functions/_shared/zzTestJob.ts, isZzTestJob): the job's own name or its stored
-- customer name starts with ZZ, in any case and after trimming.
CREATE OR REPLACE FUNCTION public.job_is_zz_test(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id
      AND (btrim(coalesce(j.job_name, ''), E' \t\n\r') ~* '^zz' OR btrim(coalesce(j.customer_name, ''), E' \t\n\r') ~* '^zz')
  );
$$;

COMMENT ON FUNCTION public.job_is_zz_test(uuid) IS
  'The ZZ convention in SQL, as isZzTestJob says it: true when the job''s own name or its stored customer name starts with ZZ. Internal: the read-revision rule of punch list #389 asks it.';
REVOKE ALL ON FUNCTION public.job_is_zz_test(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Which way a change of picks goes (picksChange): same, stricter, looser or mixed. A choice's place in its list is
-- its strictness, the loosest first. A setting the old picks never had counts from the loosest. An old pick the list
-- no longer has cannot be placed, so the change reads as mixed.
CREATE OR REPLACE FUNCTION public.contract_paper_picks_change(p_def jsonb, p_from jsonb, p_to jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH moved AS (
    SELECT coalesce(p_from, '{}'::jsonb) ? (s.v ->> 'key') AS had,
           (SELECT c.at FROM jsonb_array_elements(s.v -> 'choices') WITH ORDINALITY AS c(v, at) WHERE c.v ->> 'key' = p_from ->> (s.v ->> 'key')) AS was,
           (SELECT c.at FROM jsonb_array_elements(s.v -> 'choices') WITH ORDINALITY AS c(v, at) WHERE c.v ->> 'key' = p_to ->> (s.v ->> 'key')) AS goes
    FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
  ), placed AS (
    SELECT CASE WHEN m.had THEN m.was ELSE 1 END AS was, m.goes FROM moved m
  )
  SELECT CASE
    WHEN coalesce(bool_or(p.was IS NULL OR p.goes IS NULL), false) THEN 'mixed'
    WHEN coalesce(bool_or(p.goes > p.was), false) AND coalesce(bool_or(p.goes < p.was), false) THEN 'mixed'
    WHEN coalesce(bool_or(p.goes > p.was), false) THEN 'stricter'
    WHEN coalesce(bool_or(p.goes < p.was), false) THEN 'looser'
    ELSE 'same'
  END
  FROM placed p;
$$;

-- The picks in the list's own plain words (summaryLines): a line a setting, in the list's order, in the paper's
-- language with the English where the Spanish is empty. A setting with no pick is left out.
CREATE OR REPLACE FUNCTION public.contract_paper_said(p_def jsonb, p_picks jsonb, p_lang text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'key', s.v ->> 'key',
    'label', CASE WHEN p_lang = 'es' AND btrim(coalesce(s.v ->> 'labelEs', ''), E' \t\n\r') <> '' THEN btrim(s.v ->> 'labelEs', E' \t\n\r') ELSE btrim(coalesce(s.v ->> 'label', ''), E' \t\n\r') END,
    'choice', CASE WHEN p_lang = 'es' AND btrim(coalesce(c.v ->> 'labelEs', ''), E' \t\n\r') <> '' THEN btrim(c.v ->> 'labelEs', E' \t\n\r') ELSE btrim(coalesce(c.v ->> 'label', ''), E' \t\n\r') END,
    'says', CASE WHEN p_lang = 'es' AND btrim(coalesce(c.v ->> 'saysEs', ''), E' \t\n\r') <> '' THEN btrim(c.v ->> 'saysEs', E' \t\n\r') ELSE btrim(coalesce(c.v ->> 'says', ''), E' \t\n\r') END,
    'out', coalesce(c.v -> 'out' = 'true'::jsonb, false)
  ) ORDER BY s.at), '[]'::jsonb)
  FROM jsonb_array_elements(p_def -> 'settings') WITH ORDINALITY AS s(v, at)
  CROSS JOIN LATERAL jsonb_array_elements(s.v -> 'choices') AS c(v)
  WHERE c.v ->> 'key' = p_picks ->> (s.v ->> 'key');
$$;

-- A paper's seal (paperSeal): a SHA-256 over its settings, its blanks and its clauses with their versions, each piece
-- written as its length in bytes, a colon, the piece and a comma, so no two papers share a text. The revision and the
-- heading are not in it: the same settings and the same clause versions seal the same.
CREATE OR REPLACE FUNCTION public.contract_paper_seal(p_paper jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text := '';
  v_piece text;
  r record;
BEGIN
  FOREACH v_piece IN ARRAY ARRAY['paper-seal-v1', coalesce(p_paper ->> 'paperId', ''), coalesce(p_paper ->> 'lang', '')] LOOP
    v_text := v_text || octet_length(convert_to(v_piece, 'UTF8')) || ':' || v_piece || ',';
  END LOOP;
  FOR r IN
    SELECT x.piece FROM (
      SELECT 1 AS part, 0::bigint AS at, 0 AS sub, 'settings ' || (SELECT count(*) FROM jsonb_each(coalesce(nullif(p_paper -> 'settings', 'null'::jsonb), '{}'::jsonb))) AS piece
      UNION ALL
      SELECT 1, row_number() OVER (ORDER BY e.key COLLATE "C"), k.sub, CASE k.sub WHEN 1 THEN e.key ELSE coalesce(e.value, '') END
      FROM jsonb_each_text(coalesce(nullif(p_paper -> 'settings', 'null'::jsonb), '{}'::jsonb)) AS e CROSS JOIN (VALUES (1), (2)) AS k(sub)
      UNION ALL
      SELECT 2, 0, 0, 'fields ' || (SELECT count(*) FROM jsonb_each(coalesce(nullif(p_paper -> 'fields', 'null'::jsonb), '{}'::jsonb)))
      UNION ALL
      SELECT 2, row_number() OVER (ORDER BY e.key COLLATE "C"), k.sub, CASE k.sub WHEN 1 THEN e.key ELSE coalesce(e.value, '') END
      FROM jsonb_each_text(coalesce(nullif(p_paper -> 'fields', 'null'::jsonb), '{}'::jsonb)) AS e CROSS JOIN (VALUES (1), (2)) AS k(sub)
      UNION ALL
      SELECT 3, 0, 0, 'clauses ' || jsonb_array_length(coalesce(p_paper -> 'clauses', '[]'::jsonb))
      UNION ALL
      SELECT 3, c.at, k.sub, CASE k.sub WHEN 1 THEN c.v ->> 'id' WHEN 2 THEN c.v ->> 'v' WHEN 3 THEN c.v ->> 'n' ELSE coalesce(c.v ->> 'text', '') END
      FROM jsonb_array_elements(coalesce(p_paper -> 'clauses', '[]'::jsonb)) WITH ORDINALITY AS c(v, at) CROSS JOIN (VALUES (1), (2), (3), (4)) AS k(sub)
      UNION ALL
      SELECT 4, 0, 0, 'exhibit ' || jsonb_array_length(coalesce(p_paper -> 'exhibit', '[]'::jsonb))
      UNION ALL
      SELECT 4, c.at, k.sub, CASE k.sub WHEN 1 THEN c.v ->> 'id' WHEN 2 THEN c.v ->> 'v' WHEN 3 THEN c.v ->> 'n' ELSE coalesce(c.v ->> 'text', '') END
      FROM jsonb_array_elements(coalesce(p_paper -> 'exhibit', '[]'::jsonb)) WITH ORDINALITY AS c(v, at) CROSS JOIN (VALUES (1), (2), (3), (4)) AS k(sub)
      UNION ALL
      SELECT 5, 0, 0, 'exhibitFor ' || jsonb_array_length(coalesce(p_paper -> 'exhibitFor', '[]'::jsonb))
      UNION ALL
      SELECT 5, t.at, 1, t.name FROM jsonb_array_elements_text(coalesce(p_paper -> 'exhibitFor', '[]'::jsonb)) WITH ORDINALITY AS t(name, at)
    ) AS x
    ORDER BY x.part, x.at, x.sub
  LOOP
    v_piece := coalesce(r.piece, '');
    v_text := v_text || octet_length(convert_to(v_piece, 'UTF8')) || ':' || v_piece || ',';
  END LOOP;
  RETURN encode(sha256(convert_to(v_text, 'UTF8')), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_picks_change(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_said(jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_seal(jsonb) FROM PUBLIC, anon, authenticated;

-- A job's picks and typed blanks as the row keeps them: a pick for each setting on the list and nothing else, and the
-- typed words of blanks on the list, trimmed, an empty one left out.
CREATE OR REPLACE FUNCTION public.job_paper_picks_clean(p_def jsonb, p_picks jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_object_agg(s.v ->> 'key', p_picks ->> (s.v ->> 'key')), '{}'::jsonb)
  FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
  WHERE jsonb_typeof(p_picks) = 'object' AND p_picks ? (s.v ->> 'key');
$$;

CREATE OR REPLACE FUNCTION public.job_paper_typed_clean(p_def jsonb, p_typed jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_object_agg(f.v ->> 'key', btrim(p_typed ->> (f.v ->> 'key'), E' \t\n\r'))
  FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS f(v)
  WHERE jsonb_typeof(p_typed) = 'object' AND jsonb_typeof(p_typed -> (f.v ->> 'key')) = 'string'
    AND btrim(p_typed ->> (f.v ->> 'key'), E' \t\n\r') <> '';
$$;

REVOKE ALL ON FUNCTION public.job_paper_picks_clean(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_paper_typed_clean(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- 7) The read-revision rule, in one place (readRuleProblem): why this job cannot take this paper as it reads today, or
-- null. A ZZ Test job takes any revision. Any other job takes only the revision an attorney read.
CREATE OR REPLACE FUNCTION public.job_paper_read_problem(p_job_id uuid, p_paper_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_name text;
  v_rev integer;
  v_read integer;
BEGIN
  SELECT btrim(d.document_name), d.revision, d.read_revision INTO v_name, v_rev, v_read
  FROM public.contract_template_documents d WHERE d.id = p_paper_id;
  IF NOT FOUND THEN
    RETURN 'That paper is not in the Contract Book.';
  END IF;
  IF coalesce(v_rev, 0) < 1 THEN
    RETURN v_name || ' has no clause yet. Write it in Contracts and clauses first.';
  END IF;
  IF v_read IS NOT DISTINCT FROM v_rev OR public.job_is_zz_test(p_job_id) THEN
    RETURN NULL;
  END IF;
  RETURN v_name || ' has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.';
END;
$$;

COMMENT ON FUNCTION public.job_paper_read_problem(uuid, uuid) IS
  'Punch list #389, the read-revision rule: why a job cannot take a paper built from settings as it reads today, or null. A ZZ Test job takes any revision; any other job only the one an attorney read (read_revision = revision). Internal: asked where a paper is required, where its settings change, and where it is read or signed.';
REVOKE ALL ON FUNCTION public.job_paper_read_problem(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- What a job's settings must pass before the row takes them: a pick for every setting, the read-revision rule, and a
-- paper that goes together. Raises the reason in words. Internal.
CREATE OR REPLACE FUNCTION public.job_paper_settings_check(p_job_id uuid, p_paper_id uuid, p_picks jsonb, p_typed jsonb)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_def jsonb;
  v_problem text;
  v_paper jsonb;
BEGIN
  SELECT d.settings_def INTO v_def FROM public.contract_template_documents d WHERE d.id = p_paper_id;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. It takes none.' USING ERRCODE = 'P0001';
  END IF;
  v_problem := public.contract_paper_picks_problem(v_def, p_picks);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
  END IF;
  v_problem := public.job_paper_read_problem(p_job_id, p_paper_id);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
  END IF;
  -- The assembly says in words what stops a paper: a place with no wording or two, a blank with no value.
  v_paper := public.contract_paper_clauses(p_paper_id, ARRAY[]::text[], 'en', p_picks, p_typed);
  IF jsonb_array_length(v_paper -> 'clauses') + jsonb_array_length(v_paper -> 'exhibit') = 0 THEN
    RAISE EXCEPTION 'These settings leave the paper with no clause.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.job_paper_settings_check(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- 4) The job's paper as the database puts it together, with no gate of its own: the sign path's check calls it.
CREATE OR REPLACE FUNCTION public.job_paper_clauses_now(p_required_paper_id uuid, p_lang text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.job_required_papers%ROWTYPE;
  v_def jsonb;
  v_lang text := CASE WHEN p_lang = 'es' THEN 'es' ELSE 'en' END;
  v_problem text;
  v_paper jsonb;
BEGIN
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id;
  IF NOT FOUND OR v_row.settings IS NULL THEN
    RAISE EXCEPTION 'This paper is built from settings. It goes from a job, with its settings.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.settings_def INTO v_def FROM public.contract_template_documents d WHERE d.id = v_row.book_document_id;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'That paper is no longer built from settings in the Contract Book. Take it off the job.' USING ERRCODE = 'P0001';
  END IF;
  v_problem := public.job_paper_read_problem(v_row.job_id, v_row.book_document_id);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
  END IF;
  v_paper := public.contract_paper_clauses(v_row.book_document_id, ARRAY[]::text[], v_lang, v_row.settings, v_row.fields);
  IF jsonb_array_length(v_paper -> 'clauses') + jsonb_array_length(v_paper -> 'exhibit') = 0 THEN
    RAISE EXCEPTION 'These settings leave the paper with no clause.' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_paper || jsonb_build_object(
    'jobPaperId', v_row.id,
    'settingsRevision', v_row.settings_revision,
    'said', public.contract_paper_said(v_def, v_row.settings, v_lang),
    'sha256', public.contract_paper_seal(v_paper));
END;
$$;

REVOKE ALL ON FUNCTION public.job_paper_clauses_now(uuid, text) FROM PUBLIC, anon, authenticated;

-- The same paper for whoever may read it: the service role (the sign page and the accept) and the office.
CREATE OR REPLACE FUNCTION public.job_paper_clauses(p_required_paper_id uuid, p_lang text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Sign in to read this paper.' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office reads a job''s paper here.' USING ERRCODE = '42501';
  END IF;
  RETURN public.job_paper_clauses_now(p_required_paper_id, p_lang);
END;
$$;

COMMENT ON FUNCTION public.job_paper_clauses(uuid, text) IS
  'Punch list #389: a job''s paper built from settings as the database puts it together now, in English or Spanish: contract_paper_clauses() for the row''s picks and typed blanks, with jobPaperId, settingsRevision, said (the picks in the list''s plain words) and sha256 (contract_paper_seal). Refuses in words a row with no settings, one taken off, a paper the job cannot take under the read-revision rule, and a paper that does not go together. The service role and the office.';
REVOKE ALL ON FUNCTION public.job_paper_clauses(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_clauses(uuid, text) TO authenticated, service_role;

-- 6) The lock. Once a copy is signed the row keeps its settings as they were signed, whatever writes the table. A row
-- is born with settings or without, and never changes kind.
CREATE OR REPLACE FUNCTION public.job_paper_settings_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (OLD.settings IS NULL) IS DISTINCT FROM (NEW.settings IS NULL) THEN
    RAISE EXCEPTION 'A required paper keeps its kind. Take it off the job and require it again.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.job_required_paper_id = OLD.id AND d.status = 'signed') THEN
    RAISE EXCEPTION 'People have signed this paper. Its settings stay as they signed them.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_paper_settings_locked() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_paper_settings_locked ON public.job_required_papers;
CREATE TRIGGER job_paper_settings_locked
  BEFORE UPDATE OF settings, fields, book_revision, settings_revision ON public.job_required_papers
  FOR EACH ROW
  WHEN (NEW.settings IS DISTINCT FROM OLD.settings OR NEW.fields IS DISTINCT FROM OLD.fields
     OR NEW.book_revision IS DISTINCT FROM OLD.book_revision OR NEW.settings_revision IS DISTINCT FROM OLD.settings_revision)
  EXECUTE FUNCTION public.job_paper_settings_locked();

-- 5) The office requires papers on a job, each picked from the Contract Book. Started from the function as
-- 20261117220000 left it. What is new: a paper built from settings is required with its picks, passed in p_settings
-- as {"<book document id>": {"settings": {...}, "fields": {...}}}. Every other paper takes the path it took before.
DROP FUNCTION IF EXISTS public.job_papers_require(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.job_papers_require(p_job_id uuid, p_book_document_ids uuid[], p_settings jsonb DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ids uuid[];
  v_book_id uuid;
  v_doc public.contract_template_documents%ROWTYPE;
  v_old uuid;
  v_added integer := 0;
  v_given jsonb := CASE WHEN jsonb_typeof(p_settings) = 'object' THEN p_settings ELSE '{}'::jsonb END;
  v_built boolean;
  v_picks jsonb;
  v_typed jsonb;
  v_live public.job_required_papers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'No job with that id.' USING ERRCODE = 'P0001';
  END IF;
  -- Each paper once, in the order the office picked them: the prompt lists them in that order.
  SELECT array_agg(t.x ORDER BY t.first_ord) INTO v_ids
  FROM (
    SELECT u.x, min(u.ord) AS first_ord
    FROM unnest(coalesce(p_book_document_ids, '{}'::uuid[])) WITH ORDINALITY AS u(x, ord)
    WHERE u.x IS NOT NULL
    GROUP BY u.x
  ) t;
  IF coalesce(cardinality(v_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Pick a paper from the Contract Book.' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(v_ids) > 20 THEN
    RAISE EXCEPTION 'A job takes twenty papers at most.' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_book_id IN ARRAY v_ids LOOP
    SELECT * INTO v_doc FROM public.contract_template_documents c WHERE c.id = v_book_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That paper is not in the Contract Book.' USING ERRCODE = 'P0001';
    END IF;
    v_built := v_doc.settings_def IS NOT NULL;
    v_picks := NULL;
    v_typed := NULL;
    IF v_built THEN
      -- A paper built from settings goes with its picks, and is checked whole before the job takes it.
      IF jsonb_typeof(v_given -> v_book_id::text -> 'settings') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION '% is built from settings. Require it with its settings.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      IF public.is_digital_twin() THEN
        RAISE EXCEPTION 'A digital twin cannot set a job''s paper settings.' USING ERRCODE = '42501';
      END IF;
      v_picks := public.job_paper_picks_clean(v_doc.settings_def, v_given -> v_book_id::text -> 'settings');
      v_typed := public.job_paper_typed_clean(v_doc.settings_def, v_given -> v_book_id::text -> 'fields');
      PERFORM public.job_paper_settings_check(p_job_id, v_book_id, v_picks, v_typed);
    ELSE
      IF v_given ? v_book_id::text THEN
        RAISE EXCEPTION '% is not built from settings. It takes none.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      IF btrim(coalesce(v_doc.book_body_html, '')) = '' AND v_doc.form_template_id IS NULL
         AND btrim(coalesce(v_doc.canonical_document_url, '')) = '' THEN
        RAISE EXCEPTION '% has no words yet. Write it in the Contract Book first.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
    END IF;
    SELECT * INTO v_live FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NULL;
    IF FOUND THEN
      IF v_built AND (v_live.settings IS DISTINCT FROM v_picks OR v_live.fields IS DISTINCT FROM v_typed) THEN
        RAISE EXCEPTION 'This job requires % already, with other settings. Change them on that paper.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      CONTINUE;
    END IF;

    IF v_built THEN
      -- One taken off earlier comes back with its signatures when its settings and the Book's revision are the same.
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.paper_name = btrim(v_doc.document_name)
        AND r.settings IS NOT DISTINCT FROM v_picks AND r.fields IS NOT DISTINCT FROM v_typed
        AND r.book_revision = v_doc.revision
      ORDER BY r.removed_at DESC
      LIMIT 1;
    ELSE
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.settings IS NULL
        AND r.paper_name = btrim(v_doc.document_name)
        AND r.body_html IS NOT DISTINCT FROM v_doc.book_body_html
        AND r.body_format = coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html')
        AND r.canonical_document_url IS NOT DISTINCT FROM nullif(btrim(coalesce(v_doc.canonical_document_url, '')), '')
        AND r.form_template_id IS NOT DISTINCT FROM v_doc.form_template_id
      ORDER BY r.removed_at DESC
      LIMIT 1;
    END IF;
    IF v_old IS NOT NULL THEN
      UPDATE public.job_required_papers SET removed_at = NULL, removed_by = NULL WHERE id = v_old;
    ELSIF v_built THEN
      -- The words are the Book's clauses, put together for the picks when the paper is read. The row keeps no body.
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_format, required_by, required_at,
        settings, fields, book_revision, settings_revision, settings_set_by, settings_set_at
      ) VALUES (
        p_job_id, v_book_id, btrim(v_doc.document_name), 'html', auth.uid(), clock_timestamp(),
        v_picks, v_typed, v_doc.revision, 1, auth.uid(), clock_timestamp()
      );
    ELSE
      -- The clock, not the transaction's start: papers saved in one press keep the order they were picked in.
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_html, body_format, canonical_document_url, form_template_id, required_by, required_at
      ) VALUES (
        p_job_id, v_book_id, btrim(v_doc.document_name), v_doc.book_body_html,
        coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html'),
        nullif(btrim(coalesce(v_doc.canonical_document_url, '')), ''), v_doc.form_template_id, auth.uid(), clock_timestamp()
      );
    END IF;
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

COMMENT ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) IS
  'Papers before a job opens: the office requires papers on a job, each a Contract Book entry, and gets back how many were added. The job keeps each paper''s words as they stand in the Book now. One the job already requires is left alone, and one taken off earlier comes back with its signatures when the Book''s words have not changed. Refuses a paper with no words, more than twenty, and anyone outside the office. Since punch list #389 step 3 a paper built from settings is required with its picks, p_settings as {"<book document id>": {"settings": {...}, "fields": {...}}}: a pick for every setting, a paper that goes together, and, on a job that is not a ZZ Test job, only at the revision an attorney read. Never a twin.';
REVOKE EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) TO authenticated, service_role;

-- 6) The office changes a required paper's settings. Until someone signs, the row changes in place: a page already
-- open shows the old seal and its signing is refused. After the first signature the row is locked. A change then may
-- only tighten, and it makes a new row in the old one's place, which everyone signs again. The old row is taken off
-- and keeps its signatures.
CREATE OR REPLACE FUNCTION public.job_paper_set_settings(p_required_paper_id uuid, p_settings jsonb, p_fields jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.job_required_papers%ROWTYPE;
  v_doc public.contract_template_documents%ROWTYPE;
  v_picks jsonb;
  v_typed jsonb;
  v_change text;
  v_signed integer;
  v_new uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  -- The row is the lock: a change and a signature on the same paper happen one after the other.
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.settings IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. It has none to set.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_doc FROM public.contract_template_documents d WHERE d.id = v_row.book_document_id;
  IF NOT FOUND OR v_doc.settings_def IS NULL THEN
    RAISE EXCEPTION 'That paper is no longer built from settings in the Contract Book. Take it off the job.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'This paper is built from settings. It goes with its settings.' USING ERRCODE = 'P0001';
  END IF;
  v_picks := public.job_paper_picks_clean(v_doc.settings_def, p_settings);
  v_typed := public.job_paper_typed_clean(v_doc.settings_def, p_fields);
  PERFORM public.job_paper_settings_check(v_row.job_id, v_doc.id, v_picks, v_typed);

  v_change := public.contract_paper_picks_change(v_doc.settings_def, v_row.settings, v_picks);
  IF v_change = 'same' AND v_row.fields IS NOT DISTINCT FROM v_typed AND v_row.book_revision = v_doc.revision THEN
    RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_signed FROM public.person_contract_documents d WHERE d.job_required_paper_id = v_row.id AND d.status = 'signed';

  IF v_signed = 0 THEN
    UPDATE public.job_required_papers
      SET settings = v_picks, fields = v_typed, book_revision = v_doc.revision, settings_set_by = v_uid, settings_set_at = v_now
      WHERE id = v_row.id;
    RETURN jsonb_build_object('state', 'saved', 'id', v_row.id, 'revision', v_row.settings_revision, 'change', v_change, 'sign_again', 0);
  END IF;

  IF v_change IN ('looser', 'mixed') THEN
    RAISE EXCEPTION 'People have signed this paper. A change now can only make it stricter. To loosen it, take the paper off the job and require it again.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.job_required_papers SET removed_at = v_now, removed_by = v_uid WHERE id = v_row.id;
  INSERT INTO public.job_required_papers (
    job_id, book_document_id, paper_name, body_format, required_by, required_at,
    settings, fields, book_revision, settings_revision, revision_of, settings_set_by, settings_set_at
  ) VALUES (
    v_row.job_id, v_row.book_document_id, btrim(v_doc.document_name), 'html', v_uid, v_row.required_at,
    v_picks, v_typed, v_doc.revision, v_row.settings_revision + 1, v_row.id, v_uid, v_now
  )
  RETURNING id INTO v_new;
  RETURN jsonb_build_object('state', 'revised', 'id', v_new, 'revision', v_row.settings_revision + 1, 'change', v_change, 'sign_again', v_signed);
END;
$$;

COMMENT ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) IS
  'Punch list #389: the office changes the settings of a paper a job requires, and gets back {state, id, revision, change, sign_again}. Until a copy is signed the row changes in place (state saved). After the first signature the row is locked: a change may only tighten (change stricter, or the same picks with new typed words or a new Book revision), and it makes a new row in the old one''s place that everyone signs again (state revised, sign_again the signatures the old row keeps). Checked like a first require: a pick for every setting, a paper that goes together, the read-revision rule. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) TO authenticated;

-- 8) A copy of a paper built from settings. Started from the function as 20261120050000 left it. It is still never
-- made bare and never signed bare. What is new: a job's own copy is let through, when its required paper is live,
-- carries settings and is that Book entry; and it is signed only with the paper frozen on it exactly as the database
-- puts it together at that moment, in the language it was read in. The sign path sends what it read; anything else,
-- or nothing, is refused here. Every other paper leaves at the first test, as before.
CREATE OR REPLACE FUNCTION public.contract_copy_refuses_bare_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_signing boolean;
  v_row public.job_required_papers%ROWTYPE;
  v_now jsonb;
BEGIN
  IF NEW.applied_contract_template_document_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_signing := TG_OP = 'UPDATE' AND NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed';
  IF NOT (TG_OP = 'INSERT'
          OR NEW.applied_contract_template_document_id IS DISTINCT FROM OLD.applied_contract_template_document_id
          OR v_signing) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_template_documents d WHERE d.id = NEW.applied_contract_template_document_id AND d.settings_def IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- The job's row carries the settings. The share lock holds them still until this signature is in.
  IF NEW.job_required_paper_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.job_required_papers r
    WHERE r.id = NEW.job_required_paper_id AND r.settings IS NOT NULL
      AND r.book_document_id = NEW.applied_contract_template_document_id
    FOR SHARE;
  END IF;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'This paper is built from settings. It goes from a job, with its settings.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_signing THEN
    v_now := public.job_paper_clauses_now(v_row.id, coalesce(NEW.clause_versions ->> 'lang', 'en'));
    IF NEW.clause_versions IS NULL
       OR (NEW.clause_versions - 'title' - 'between') IS DISTINCT FROM v_now
       OR NEW.paper_revision IS DISTINCT FROM (v_now ->> 'revision')::integer THEN
      RAISE EXCEPTION 'The paper changed since you opened it. Reload to read the new version.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_copy_refuses_bare_settings() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.person_contract_documents.clause_versions IS
  'Messages, cut 4c: the clause paper as it read when signed, contract_paper_clauses() frozen ({paperId, revision, lang, clauses, exhibit, exhibitFor}, each clause {id, v, n, text}). Never changed once written (contract_signed_clauses_frozen). Null on a paper signed before clauses, or not built from them. Since punch list #389 step 3 a job''s paper built from settings also keeps settings, fields, said, jobPaperId, settingsRevision and sha256, as job_paper_clauses() hands them back, and is signed only when they match it.';
