SET lock_timeout = '3s';

-- Punch list #439, piece 4, the ground: secrecy on a site (to-dos/site-nda-for-vendors/README.md).
--
-- Papers before a job opens (punch list #389) is set one job at a time: job_required_papers is one row a job, a
-- person holds one copy a row, and job_closed_to_me asks whether the caller holds a signed copy of each. A site is a
-- development, which carries all its jobs, or an address, by its cleaned key. Nothing could require a paper of a
-- site, and the database could not tell which jobs are at an address: the cleaning rule lived in the app alone.
--
-- This file feeds the gate that is there. Turning secrecy on for a site writes that gate's own row on every job at
-- the site, so the chip, the prompt, clock-in, Needs you and the emails work as they do. A trigger adds the row to a
-- job that is made at, or moved to, a site that is on. And the lock counts a person as signed for every job of a
-- site once they signed for one: one signature a person for the whole site (the person's call, 2026-11-27).
--
-- What it makes:
--   1. address_key(text): the app's address rule in SQL (normalizeAddressKey, src/lib/developments/notInIt.ts).
--   2. site_secrecy: one row a site and a paper, on or off, with the paper's words as they stood when it went on.
--   3. job_required_papers.site_secrecy_id: the site a job's row was written for. Null on every row there is.
--   4. site_secrecy_keys, site_secrecy_sync, site_paper_covers_user: internal.
--   5. site_secrecy_preview, site_secrecy_turn_on, site_secrecy_turn_off: the office's three presses.
--   6. Two triggers: a job made at or moved to or from a site, and a Same place answer kept or undone.
--   7. Nine functions of the gate restated, each from its newest definition, each with the site's rule added.
--
-- The person's calls (2026-11-27, relayed): one signature a person for the whole site; the office picks our own
-- people's paper from the Contract Book; a sub with a login is an outside company, is not asked this paper and is not
-- shut out by it; the four office roles turn it on and off and the estimator reads; turning it off opens the jobs at
-- once and keeps every signature, and turning it on again asks only those who never signed.
--
-- What it does not change. No row is written: no site is on until an office press. A job whose rows name no site
-- reads exactly as before for everyone: each restated function reaches the site's rule only on a row whose
-- site_secrecy_id is set. The fence policies, jobs_shut_to_me, job_shut_to_me, jobs_shut_to_user and job_papers_mine
-- are not restated: they call the functions below. Sends to outside companies are not held (piece 6), and no email
-- carries a code name (piece 7): the code name is kept here for then.
--
-- One table is made, so the four fence calls close the file. Everything is IF NOT EXISTS or OR REPLACE.
-- Doc: docs/migrations/20261127052337_site_secrecy.md.

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 1) The address rule, in SQL. The same steps in the same order as normalizeAddressKey: lowercase; anything that is
-- not a letter, a digit, a space or a hyphen becomes a space; runs of spaces become one; trimmed; a trailing zip code
-- (12345 or 12345-6789) dropped; hyphens become spaces; each word that is a street suffix or a compass letter is
-- spelled out. Empty for a blank address. supabase/tests/site_secrecy holds it to the app's rule over a list of
-- addresses whose keys the app wrote (src/lib/addresses/addressKeyParity.ts).
CREATE OR REPLACE FUNCTION public.address_key(p_address text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  WITH flat AS (
    SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(p_address, '')), '[^a-z0-9[:space:]-]', ' ', 'g'), '[[:space:]]+', ' ', 'g')) AS s
  ), cut AS (
    SELECT regexp_replace(f.s, ' [0-9]{5}(-[0-9]{4})?$', '') AS s FROM flat f
  ), words AS (
    SELECT t.w, t.ord
    FROM cut c, regexp_split_to_table(replace(c.s, '-', ' '), ' ') WITH ORDINALITY AS t(w, ord)
    WHERE t.w <> ''
  )
  SELECT coalesce(string_agg(coalesce(m.word, w.w), ' ' ORDER BY w.ord), '')
  FROM words w
  LEFT JOIN (VALUES
    ('rd', 'road'), ('st', 'street'), ('dr', 'drive'), ('ln', 'lane'), ('trl', 'trail'), ('tr', 'trail'),
    ('ave', 'avenue'), ('av', 'avenue'), ('blvd', 'boulevard'), ('hwy', 'highway'), ('ct', 'court'), ('cir', 'circle'),
    ('pkwy', 'parkway'), ('pl', 'place'), ('ter', 'terrace'), ('terr', 'terrace'), ('way', 'way'), ('loop', 'loop'),
    ('n', 'north'), ('s', 'south'), ('e', 'east'), ('w', 'west')
  ) AS m(short, word) ON m.short = w.w;
$$;

COMMENT ON FUNCTION public.address_key(text) IS
  'Punch list #439: an address as a comparison key, the app''s normalizeAddressKey in SQL. Lowercase, letters and digits only, one space between words, a trailing zip code dropped, street suffixes and compass letters spelled out. Empty for a blank address. The key address_place_answers and a paper''s site_address_key hold. Immutable.';
REVOKE EXECUTE ON FUNCTION public.address_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.address_key(text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 2) A site's secrecy. One row a site and a paper. It is on while turned_off_at is null. The paper's words are kept
-- as they stood in the Contract Book when it went on, so a job that joins the site later takes the same words the
-- others signed.
CREATE TABLE IF NOT EXISTS public.site_secrecy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The site: a development, or an address by its cleaned key with the address as written. Never both, never neither.
  development_id uuid REFERENCES public.developments(id) ON DELETE RESTRICT,
  address_key text,
  address text,
  -- The paper our own people sign, picked from the Contract Book, and its words as they stood.
  book_document_id uuid REFERENCES public.contract_template_documents(id) ON DELETE SET NULL,
  paper_name text NOT NULL,
  body_html text,
  body_format text NOT NULL DEFAULT 'html',
  canonical_document_url text,
  form_template_id uuid REFERENCES public.contract_form_templates(id) ON DELETE RESTRICT,
  -- What an outside company is to see in place of the site until it signs. Kept here; used from piece 7.
  code_name text,
  turned_on_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  turned_on_at timestamptz NOT NULL DEFAULT now(),
  turned_off_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  turned_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_secrecy_one_kind CHECK ((development_id IS NULL) <> (address_key IS NULL)),
  CONSTRAINT site_secrecy_key_words CHECK (address_key IS NULL OR (btrim(address_key) <> '' AND char_length(address_key) <= 300)),
  CONSTRAINT site_secrecy_address_words CHECK (
    (address IS NULL AND address_key IS NULL)
    OR (address IS NOT NULL AND address_key IS NOT NULL AND btrim(address) <> '' AND char_length(address) <= 500)
  ),
  CONSTRAINT site_secrecy_paper_words CHECK (btrim(paper_name) <> ''),
  CONSTRAINT site_secrecy_body_format CHECK (body_format IN ('html', 'plain', 'markdown')),
  CONSTRAINT site_secrecy_code_name_words CHECK (code_name IS NULL OR (btrim(code_name) <> '' AND char_length(code_name) <= 120))
);

COMMENT ON TABLE public.site_secrecy IS
  'Punch list #439, piece 4: secrecy on a site. One row a site (a development, or an address by its cleaned key) and a paper, on while turned_off_at is null. Turning it on writes a job_required_papers row, with site_secrecy_id, on every job at the site; our own people then sign once for the whole site before a job there opens. The paper''s words are kept as they stood. The office and the estimator read; every write goes through site_secrecy_turn_on and site_secrecy_turn_off.';

-- One site is on once: a development, or an address key.
CREATE UNIQUE INDEX IF NOT EXISTS site_secrecy_one_on_development
  ON public.site_secrecy (development_id) WHERE turned_off_at IS NULL AND development_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_secrecy_one_on_address
  ON public.site_secrecy (address_key) WHERE turned_off_at IS NULL AND address_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_secrecy_development_idx ON public.site_secrecy (development_id) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_secrecy_address_key_idx ON public.site_secrecy (address_key) WHERE address_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_secrecy_book_document_idx ON public.site_secrecy (book_document_id) WHERE book_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_secrecy_form_template_idx ON public.site_secrecy (form_template_id) WHERE form_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_secrecy_turned_on_by_idx ON public.site_secrecy (turned_on_by);
CREATE INDEX IF NOT EXISTS site_secrecy_turned_off_by_idx ON public.site_secrecy (turned_off_by) WHERE turned_off_by IS NOT NULL;

ALTER TABLE public.site_secrecy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_secrecy_read ON public.site_secrecy;
CREATE POLICY site_secrecy_read ON public.site_secrecy FOR SELECT TO authenticated
  USING ((SELECT public.is_office_or_estimator()));

-- No write policy: the three functions below are the only way in.
REVOKE ALL ON public.site_secrecy FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.site_secrecy FROM authenticated;
GRANT SELECT ON public.site_secrecy TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 3) The site a job's required paper was written for. Null on every row there is, and on every row a job requires
-- by itself.
ALTER TABLE public.job_required_papers
  ADD COLUMN IF NOT EXISTS site_secrecy_id uuid REFERENCES public.site_secrecy(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_required_papers.site_secrecy_id IS
  'Punch list #439, piece 4: the site whose secrecy wrote this row. Null on a paper the job requires by itself. A signed copy of any row of one site counts for every row of that site.';

CREATE INDEX IF NOT EXISTS job_required_papers_site_secrecy_idx
  ON public.job_required_papers (site_secrecy_id) WHERE site_secrecy_id IS NOT NULL;
-- A job carries a site's paper once.
CREATE UNIQUE INDEX IF NOT EXISTS job_required_papers_one_live_site
  ON public.job_required_papers (job_id, site_secrecy_id) WHERE removed_at IS NULL AND site_secrecy_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 4) Internal helpers. None is granted to a signed-in user.

-- The keys that are one place with a key, itself included, by the answers kept in Addresses that look alike: Same
-- place joins two keys, and a place joined to a second is joined to everything the second is joined to
-- (samePlaceKeys, src/lib/addresses/lookAlikes.ts).
CREATE OR REPLACE FUNCTION public.site_secrecy_keys(p_key text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH RECURSIVE place(k) AS (
    SELECT p_key WHERE coalesce(btrim(p_key), '') <> ''
    UNION
    SELECT CASE WHEN a.key_a = p.k THEN a.key_b ELSE a.key_a END
    FROM place p
    JOIN public.address_place_answers a ON a.same AND (a.key_a = p.k OR a.key_b = p.k)
  )
  SELECT coalesce(array_agg(k), '{}'::text[]) FROM place;
$$;

COMMENT ON FUNCTION public.site_secrecy_keys(text) IS
  'Punch list #439, internal: the address keys that are one place with a key, itself included, by the Same place answers kept, chains followed. Granted to nobody.';
REVOKE ALL ON FUNCTION public.site_secrecy_keys(text) FROM PUBLIC, anon, authenticated, service_role;

-- True when a site's paper asks nothing more of a user: they are a sub, who is an outside company and is not asked
-- this paper, or they hold a signed copy of the paper on any job of the site, a job since moved away among them.
CREATE OR REPLACE FUNCTION public.site_paper_covers_user(p_site_secrecy_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_site_secrecy_id IS NOT NULL AND p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.role::text = 'subcontractor')
    OR EXISTS (
      SELECT 1
      FROM public.job_required_papers s
      JOIN public.person_contract_documents d ON d.job_required_paper_id = s.id AND d.status = 'signed'
      JOIN public.people p ON p.id = d.person_id
      WHERE s.site_secrecy_id = p_site_secrecy_id
        AND p.account_user_id = p_user_id AND p.archived_at IS NULL
    )
  );
$$;

COMMENT ON FUNCTION public.site_paper_covers_user(uuid, uuid) IS
  'Punch list #439, internal: true when a site''s paper asks nothing more of a user. A sub with a login is an outside company and is not asked it. Anyone else is covered once they hold a signed copy on any job of the site: one signature a person for the whole site. Granted to nobody.';
REVOKE ALL ON FUNCTION public.site_paper_covers_user(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Bring a site's rows in line with its jobs: every job at the site carries the site's paper, and a job that is no
-- longer at it does not. With a job named, that one job alone. A job is at a development's site by its development,
-- and at an address's site by its own address cleaned to one of the site's keys. A row taken off earlier comes back
-- with its signatures. A job that already requires the same Contract Book paper by itself keeps its own row and takes
-- no second one. Returns how many rows it put on.
CREATE OR REPLACE FUNCTION public.site_secrecy_sync(p_site_secrecy_id uuid, p_job_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_site public.site_secrecy%ROWTYPE;
  v_keys text[];
  v_job uuid;
  v_at uuid[];
  v_added integer := 0;
  v_rows integer;
BEGIN
  SELECT * INTO v_site FROM public.site_secrecy s WHERE s.id = p_site_secrecy_id;
  IF NOT FOUND OR v_site.turned_off_at IS NOT NULL THEN
    RETURN 0;
  END IF;
  v_keys := CASE WHEN v_site.address_key IS NOT NULL THEN public.site_secrecy_keys(v_site.address_key) ELSE '{}'::text[] END;

  SELECT coalesce(array_agg(j.id), '{}'::uuid[]) INTO v_at
  FROM public.jobs_ledger j
  WHERE (p_job_id IS NULL OR j.id = p_job_id)
    AND (
      (v_site.development_id IS NOT NULL AND j.development_id = v_site.development_id)
      OR (v_site.address_key IS NOT NULL AND btrim(coalesce(j.job_address, '')) <> '' AND public.address_key(j.job_address) = ANY (v_keys))
    );

  -- A job that left the site: its row comes off. Every signed copy stays, and still counts for the site.
  UPDATE public.job_required_papers r
    SET removed_at = now(), removed_by = auth.uid()
  WHERE r.site_secrecy_id = v_site.id AND r.removed_at IS NULL
    AND (p_job_id IS NULL OR r.job_id = p_job_id)
    AND NOT (r.job_id = ANY (v_at));

  FOREACH v_job IN ARRAY v_at LOOP
    IF EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = v_job AND r.site_secrecy_id = v_site.id AND r.removed_at IS NULL) THEN
      CONTINUE;
    END IF;
    -- A job that already requires this Contract Book paper by itself keeps its own row.
    IF v_site.book_document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.job_required_papers r
      WHERE r.job_id = v_job AND r.book_document_id = v_site.book_document_id AND r.removed_at IS NULL
    ) THEN
      CONTINUE;
    END IF;
    -- The newest row of this site taken off this job earlier comes back, with its signatures.
    UPDATE public.job_required_papers r
      SET removed_at = NULL, removed_by = NULL
    WHERE r.id = (
      SELECT o.id FROM public.job_required_papers o
      WHERE o.job_id = v_job AND o.site_secrecy_id = v_site.id AND o.removed_at IS NOT NULL
      ORDER BY o.removed_at DESC, o.id LIMIT 1
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_html, body_format, canonical_document_url, form_template_id,
        required_by, required_at, site_secrecy_id
      ) VALUES (
        v_job, v_site.book_document_id, v_site.paper_name, v_site.body_html, v_site.body_format,
        v_site.canonical_document_url, v_site.form_template_id, auth.uid(), clock_timestamp(), v_site.id
      );
    END IF;
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_sync(uuid, uuid) IS
  'Punch list #439, internal: brings a site''s rows in line with its jobs. Every job at a site that is on carries the site''s paper as a job_required_papers row, a row taken off earlier coming back with its signatures, and a job no longer at the site loses its row. With a job named, that job alone. Returns how many rows it put on. Granted to nobody: the turn-on function and the two triggers call it.';
REVOKE ALL ON FUNCTION public.site_secrecy_sync(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 5) The office's three presses.

-- What turning secrecy on for a site would reach, before the press: the jobs it would shut and our own people it
-- would ask. Our own people are the office and the jobs' crews. A sub is an outside company and is not counted.
CREATE OR REPLACE FUNCTION public.site_secrecy_preview(p_development_id uuid, p_address text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_key text;
  v_keys text[];
  v_jobs uuid[];
  v_people integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office turns on secrecy for a site.' USING ERRCODE = '42501';
  END IF;
  IF (p_development_id IS NULL) = (coalesce(btrim(p_address), '') = '') THEN
    RAISE EXCEPTION 'Name one site: a development, or an address.' USING ERRCODE = 'P0001';
  END IF;
  IF p_development_id IS NULL THEN
    v_key := public.address_key(p_address);
    IF v_key = '' THEN
      RAISE EXCEPTION 'That address has nothing to match a job by.' USING ERRCODE = 'P0001';
    END IF;
    v_keys := public.site_secrecy_keys(v_key);
  END IF;

  SELECT coalesce(array_agg(j.id), '{}'::uuid[]) INTO v_jobs
  FROM public.jobs_ledger j
  WHERE (p_development_id IS NOT NULL AND j.development_id = p_development_id)
     OR (v_key IS NOT NULL AND btrim(coalesce(j.job_address, '')) <> '' AND public.address_key(j.job_address) = ANY (v_keys));

  SELECT count(*) INTO v_people FROM (
    SELECT u.id
    FROM public.users u
    WHERE u.role::text IN ('dev', 'master_technician', 'assistant', 'controller')
      AND u.archived_at IS NULL AND u.login_attached_at IS NOT NULL
      AND NOT u.is_digital_twin AND NOT u.is_sample AND NOT u.is_walk_tester
    UNION
    SELECT c.user_id FROM (
      SELECT m.user_id FROM public.jobs_ledger_team_members m WHERE m.job_id = ANY (v_jobs)
      UNION
      SELECT b.assignee_user_id FROM public.job_schedule_blocks b
      WHERE b.job_id = ANY (v_jobs) AND b.work_date >= date_trunc('week', public.app_today())::date - 7
    ) c
    JOIN public.users cu ON cu.id = c.user_id
    WHERE cu.archived_at IS NULL AND NOT cu.is_digital_twin AND cu.role::text <> 'subcontractor'
  ) asked;

  RETURN jsonb_build_object('jobs', coalesce(cardinality(v_jobs), 0), 'people', v_people, 'address_key', v_key);
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_preview(uuid, text) IS
  'Punch list #439, piece 4: what turning secrecy on for a site would reach, {jobs, people, address_key}: the jobs at the site and our own people who would be asked to sign (the office and the jobs'' crews; a sub is an outside company and is not counted). Name a development or an address, never both. Office only. Writes nothing.';
REVOKE EXECUTE ON FUNCTION public.site_secrecy_preview(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_secrecy_preview(uuid, text) TO authenticated, service_role;

-- Turn secrecy on for a site, with the paper our own people sign. The paper is one of plain words, clauses or a form:
-- one built from settings takes its settings a job at a time, and is refused. A site that is on already with the same
-- paper is left on and brought in line. One turned off earlier with the same paper and the same words comes back, so
-- everyone who signed then is still signed.
CREATE OR REPLACE FUNCTION public.site_secrecy_turn_on(
  p_development_id uuid,
  p_address text,
  p_book_document_id uuid,
  p_code_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_doc public.contract_template_documents%ROWTYPE;
  v_key text;
  v_address text;
  v_code text := nullif(btrim(coalesce(p_code_name, '')), '');
  v_name text;
  v_format text;
  v_url text;
  v_site uuid;
  v_live public.site_secrecy%ROWTYPE;
  v_added integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office turns on secrecy for a site.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot turn on secrecy for a site.' USING ERRCODE = '42501';
  END IF;
  IF (p_development_id IS NULL) = (coalesce(btrim(p_address), '') = '') THEN
    RAISE EXCEPTION 'Name one site: a development, or an address.' USING ERRCODE = 'P0001';
  END IF;
  IF p_development_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.developments d WHERE d.id = p_development_id) THEN
      RAISE EXCEPTION 'No development with that id.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_address := left(btrim(regexp_replace(p_address, '[[:space:]]+', ' ', 'g')), 500);
    v_key := public.address_key(v_address);
    IF v_key = '' OR char_length(v_key) > 300 THEN
      RAISE EXCEPTION 'That address has nothing to match a job by.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_code IS NOT NULL AND char_length(v_code) > 120 THEN
    RAISE EXCEPTION 'A code name is 120 characters at most.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_doc FROM public.contract_template_documents c WHERE c.id = p_book_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick a paper from the Contract Book.' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc.settings_def IS NOT NULL THEN
    RAISE EXCEPTION '% is built from settings, which are set a job at a time. Pick a paper of plain words for a site.', v_doc.document_name USING ERRCODE = 'P0001';
  END IF;
  IF btrim(coalesce(v_doc.book_body_html, '')) = '' AND v_doc.form_template_id IS NULL
     AND btrim(coalesce(v_doc.canonical_document_url, '')) = '' THEN
    RAISE EXCEPTION '% has no words yet. Write it in the Contract Book first.', v_doc.document_name USING ERRCODE = 'P0001';
  END IF;
  v_name := btrim(v_doc.document_name);
  v_format := coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html');
  v_url := nullif(btrim(coalesce(v_doc.canonical_document_url, '')), '');

  -- On already: the same paper is left on, another paper is refused until this one is turned off.
  SELECT * INTO v_live FROM public.site_secrecy s
  WHERE s.turned_off_at IS NULL
    AND ((p_development_id IS NOT NULL AND s.development_id = p_development_id) OR (v_key IS NOT NULL AND s.address_key = v_key));
  IF FOUND THEN
    IF v_live.book_document_id IS DISTINCT FROM p_book_document_id THEN
      RAISE EXCEPTION 'Secrecy is on for this site already, with %. Turn it off before you pick another paper.', v_live.paper_name USING ERRCODE = 'P0001';
    END IF;
    v_site := v_live.id;
  ELSE
    -- Turned off earlier with this paper and these words: it comes back, and so does every signature.
    SELECT s.id INTO v_site FROM public.site_secrecy s
    WHERE s.turned_off_at IS NOT NULL
      AND ((p_development_id IS NOT NULL AND s.development_id = p_development_id) OR (v_key IS NOT NULL AND s.address_key = v_key))
      AND s.book_document_id = p_book_document_id
      AND s.paper_name = v_name
      AND s.body_html IS NOT DISTINCT FROM v_doc.book_body_html
      AND s.body_format = v_format
      AND s.canonical_document_url IS NOT DISTINCT FROM v_url
      AND s.form_template_id IS NOT DISTINCT FROM v_doc.form_template_id
    ORDER BY s.turned_off_at DESC, s.id
    LIMIT 1;
    IF v_site IS NOT NULL THEN
      UPDATE public.site_secrecy
        SET turned_off_at = NULL, turned_off_by = NULL, turned_on_at = now(), turned_on_by = auth.uid(),
            code_name = coalesce(v_code, code_name)
      WHERE id = v_site;
    ELSE
      INSERT INTO public.site_secrecy (
        development_id, address_key, address, book_document_id, paper_name, body_html, body_format,
        canonical_document_url, form_template_id, code_name, turned_on_by, turned_on_at
      ) VALUES (
        p_development_id, v_key, v_address, p_book_document_id, v_name, v_doc.book_body_html, v_format,
        v_url, v_doc.form_template_id, v_code, auth.uid(), now()
      )
      RETURNING id INTO v_site;
    END IF;
  END IF;

  v_added := public.site_secrecy_sync(v_site, NULL);
  RETURN jsonb_build_object(
    'id', v_site,
    'added', v_added,
    'jobs', (SELECT count(*) FROM public.job_required_papers r WHERE r.site_secrecy_id = v_site AND r.removed_at IS NULL)
  );
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_turn_on(uuid, text, uuid, text) IS
  'Punch list #439, piece 4: the office turns secrecy on for a site (a development, or an address) with the Contract Book paper our own people sign, and gets back {id, added, jobs}. Every job at the site takes the paper as a required paper; one signature a person covers them all. Refuses a paper built from settings, a paper with no words, a second paper on a site that is on, a twin and anyone outside the office. A site turned off earlier with the same paper and words comes back with its signatures.';
REVOKE EXECUTE ON FUNCTION public.site_secrecy_turn_on(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_secrecy_turn_on(uuid, text, uuid, text) TO authenticated, service_role;

-- Turn it off. The site's rows come off its jobs, which open at once to whoever owed only that paper. Every signed
-- copy stays on its person's file.
CREATE OR REPLACE FUNCTION public.site_secrecy_turn_off(p_site_secrecy_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office turns off secrecy for a site.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot turn off secrecy for a site.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.site_secrecy SET turned_off_at = now(), turned_off_by = auth.uid()
  WHERE id = p_site_secrecy_id AND turned_off_at IS NULL;
  UPDATE public.job_required_papers SET removed_at = now(), removed_by = auth.uid()
  WHERE site_secrecy_id = p_site_secrecy_id AND removed_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_turn_off(uuid) IS
  'Punch list #439, piece 4: the office turns secrecy off for a site. The site''s rows come off its jobs, which open at once, and every signed copy stays on its person''s file. Office only, never a twin.';
REVOKE EXECUTE ON FUNCTION public.site_secrecy_turn_off(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_secrecy_turn_off(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 6) The two triggers.

-- A job made at, moved to or moved away from a site. It reads nothing while no site is on, and it never refuses a
-- job's save: a sync that fails is logged, and the next turn-on or answer brings the site in line.
CREATE OR REPLACE FUNCTION public.site_secrecy_on_job_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_site uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.job_address IS NOT DISTINCT FROM OLD.job_address AND NEW.development_id IS NOT DISTINCT FROM OLD.development_id THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_secrecy s WHERE s.turned_off_at IS NULL) THEN
    RETURN NULL;
  END IF;
  BEGIN
    FOR v_site IN SELECT s.id FROM public.site_secrecy s WHERE s.turned_off_at IS NULL LOOP
      PERFORM public.site_secrecy_sync(v_site, NEW.id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'site_secrecy: job % was not brought in line: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_on_job_change() IS
  'Punch list #439, piece 4: after a job is made, or its address or development changes, each site that is on is brought in line for that one job. It reads one small table and stops while no site is on. It never refuses the job''s save.';
REVOKE ALL ON FUNCTION public.site_secrecy_on_job_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS site_secrecy_job_sync ON public.jobs_ledger;
CREATE TRIGGER site_secrecy_job_sync
  AFTER INSERT OR UPDATE OF job_address, development_id ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.site_secrecy_on_job_change();

-- A Same place answer kept, changed or undone: the keys of a site may have changed, so each address site that is on
-- is brought in line with every job.
CREATE OR REPLACE FUNCTION public.site_secrecy_on_answer_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_site uuid;
BEGIN
  BEGIN
    FOR v_site IN SELECT s.id FROM public.site_secrecy s WHERE s.turned_off_at IS NULL AND s.address_key IS NOT NULL LOOP
      PERFORM public.site_secrecy_sync(v_site, NULL);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'site_secrecy: the sites were not brought in line after an answer: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.site_secrecy_on_answer_change() IS
  'Punch list #439, piece 4: after a Same place answer is kept, changed or undone, each address site that is on is brought in line with every job. It never refuses the answer.';
REVOKE ALL ON FUNCTION public.site_secrecy_on_answer_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS site_secrecy_answer_sync ON public.address_place_answers;
CREATE TRIGGER site_secrecy_answer_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.address_place_answers
  FOR EACH STATEMENT EXECUTE FUNCTION public.site_secrecy_on_answer_change();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 7) The gate's functions, each restated from its newest definition with the site's rule added. A row whose
-- site_secrecy_id is null takes the path it always took: the added condition ends at that null.

-- From 20261117220000_job_required_papers.sql. Added: a row a site wrote is not owed by a user the site's paper
-- covers.
CREATE OR REPLACE FUNCTION public.job_closed_to_me(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_job_id IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.removed_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.person_contract_documents d
          JOIN public.people p ON p.id = d.person_id
          WHERE d.job_required_paper_id = r.id AND d.status = 'signed'
            AND p.account_user_id = auth.uid() AND p.archived_at IS NULL
        )
        AND NOT (r.site_secrecy_id IS NOT NULL AND public.site_paper_covers_user(r.site_secrecy_id, auth.uid()))
    )
  END;
$$;

-- From 20261117220000_job_required_papers.sql. Added: the same condition.
CREATE OR REPLACE FUNCTION public.jobs_closed_to_me()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.removed_at IS NULL) THEN '{}'::uuid[]
    ELSE coalesce((
      SELECT array_agg(DISTINCT r.job_id)
      FROM public.job_required_papers r
      WHERE r.removed_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.person_contract_documents d
          JOIN public.people p ON p.id = d.person_id
          WHERE d.job_required_paper_id = r.id AND d.status = 'signed'
            AND p.account_user_id = auth.uid() AND p.archived_at IS NULL
        )
        AND NOT (r.site_secrecy_id IS NOT NULL AND public.site_paper_covers_user(r.site_secrecy_id, auth.uid()))
    ), '{}'::uuid[])
  END;
$$;

-- From 20261118020000_job_papers_lists.sql. Added: the same condition, about the named user.
CREATE OR REPLACE FUNCTION public.job_shut_to_user(p_job_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN p_job_id IS NULL OR p_user_id IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_user_id AND u.role::text IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.removed_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.person_contract_documents d
          JOIN public.people p ON p.id = d.person_id
          WHERE d.job_required_paper_id = r.id AND d.status = 'signed'
            AND p.account_user_id = p_user_id AND p.archived_at IS NULL
        )
        AND NOT (r.site_secrecy_id IS NOT NULL AND public.site_paper_covers_user(r.site_secrecy_id, p_user_id))
    )
  END;
$$;

-- From 20261117220000_job_required_papers.sql. Changed: a site's paper reads the person's copy from any job of the
-- site, the signed one first, so a person who signed for the site reads signed on every job of it. And a sub is not
-- shown a site's paper: it is not theirs to sign.
CREATE OR REPLACE FUNCTION public.job_papers_for_person(p_job_id uuid, p_person_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT jsonb_build_object(
    'job_number', CASE WHEN EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL)
      THEN public.job_paper_job_number(p_job_id) ELSE '' END,
    'papers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'paper_name', r.paper_name,
        'is_form', r.form_template_id IS NOT NULL,
        'document_id', d.id,
        'status', coalesce(d.status, 'none'),
        'signed_at', CASE WHEN d.status = 'signed' THEN d.signed_at END
      ) ORDER BY r.required_at, r.id)
      FROM public.job_required_papers r
      LEFT JOIN LATERAL (
        SELECT c.id, c.status, c.signed_at
        FROM public.person_contract_documents c
        WHERE c.person_id = p_person_id
          AND (
            c.job_required_paper_id = r.id
            OR (r.site_secrecy_id IS NOT NULL AND c.job_required_paper_id IN (
              SELECT s.id FROM public.job_required_papers s WHERE s.site_secrecy_id = r.site_secrecy_id
            ))
          )
        ORDER BY (c.status = 'signed') DESC, (c.job_required_paper_id = r.id) DESC, c.created_at, c.id
        LIMIT 1
      ) d ON true
      WHERE r.job_id = p_job_id AND r.removed_at IS NULL
        AND NOT (r.site_secrecy_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.people sp WHERE sp.id = p_person_id AND sp.kind = 'sub'
        ))
    ), '[]'::jsonb)
  );
$$;

-- From 20261117220000_job_required_papers.sql. Added: a site's paper is one copy a person. A person who already
-- holds a copy on any job of the site gets that copy back, signed or not, and no second one is made.
CREATE OR REPLACE FUNCTION public.job_paper_start(p_required_paper_id uuid, p_person_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_paper public.job_required_papers%ROWTYPE;
  v_person_id uuid;
  v_person_name text;
  v_number text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Sign in to read this paper.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_paper FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT p.id INTO v_person_id FROM public.people p WHERE p.account_user_id = auth.uid() AND p.archived_at IS NULL LIMIT 1;
  END IF;
  IF p_person_id IS NOT NULL AND p_person_id IS DISTINCT FROM v_person_id THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_office_staff() THEN
      RAISE EXCEPTION 'Only the office starts a paper for someone else.' USING ERRCODE = '42501';
    END IF;
    v_person_id := p_person_id;
  END IF;
  IF v_person_id IS NULL THEN
    RAISE EXCEPTION 'Your login is not tied to your file yet. Ask the office to link it on People.' USING ERRCODE = 'P0001';
  END IF;
  SELECT p.name INTO v_person_name FROM public.people p WHERE p.id = v_person_id AND p.archived_at IS NULL;
  IF v_person_name IS NULL OR btrim(v_person_name) = '' THEN
    RAISE EXCEPTION 'No person on the roster with that id.' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.job_required_paper_id = v_paper.id AND d.person_id = v_person_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  -- A site's paper: the copy this person holds on another job of the site is their copy here too.
  IF v_paper.site_secrecy_id IS NOT NULL THEN
    SELECT d.id INTO v_id
    FROM public.person_contract_documents d
    JOIN public.job_required_papers s ON s.id = d.job_required_paper_id
    WHERE s.site_secrecy_id = v_paper.site_secrecy_id AND d.person_id = v_person_id
    ORDER BY (d.status = 'signed') DESC, d.created_at, d.id
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  v_number := public.job_paper_job_number(v_paper.job_id);
  INSERT INTO public.person_contract_documents (
    person_name, person_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
    status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id,
    form_template_id, job_id, job_required_paper_id
  ) VALUES (
    v_person_name, v_person_id,
    v_paper.paper_name || ' (job ' || CASE WHEN v_number <> '' THEN v_number ELSE left(v_paper.job_id::text, 8) END || ')',
    gen_random_uuid(), 1, NULL,
    'unsent', nullif(btrim(coalesce(v_paper.canonical_document_url, '')), ''), v_paper.body_html, v_paper.body_format,
    v_paper.book_document_id, v_paper.form_template_id, v_paper.job_id, v_paper.id
  )
  ON CONFLICT (job_required_paper_id, person_id) WHERE job_required_paper_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    -- Two presses at once: the other one made it.
    SELECT d.id INTO v_id FROM public.person_contract_documents d
    WHERE d.job_required_paper_id = v_paper.id AND d.person_id = v_person_id;
  END IF;
  RETURN v_id;
END;
$$;

-- From 20261117220000_job_required_papers.sql. Added: a row a site wrote is taken off by turning the site's secrecy
-- off, never one job at a time, which would open one job of a site that is still on.
CREATE OR REPLACE FUNCTION public.job_paper_remove(p_required_paper_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.job_required_papers r
    WHERE r.id = p_required_paper_id AND r.removed_at IS NULL AND r.site_secrecy_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This paper is the site''s. Turn off secrecy for the site to take it off its jobs.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.job_required_papers SET removed_at = now(), removed_by = auth.uid()
  WHERE id = p_required_paper_id AND removed_at IS NULL;
END;
$$;

-- From 20261124160000_job_papers_gc_page.sql. Changed: each paper says the site that wrote it; a site's paper reads
-- a person's copy from any job of the site, the signed one first; and each cell says whether the person is asked: a
-- person who is on the job as a sub alone is not asked a site's paper.
CREATE OR REPLACE FUNCTION public.job_papers_roster_now(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_out jsonb;
BEGIN
  WITH live AS (
    SELECT r.id, r.paper_name, r.form_template_id, r.required_at, r.book_document_id, r.site_secrecy_id
    FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL
  ), by_user AS (
    SELECT u.id AS user_id, 'office'::text AS way
    FROM public.users u
    WHERE u.role::text IN ('dev', 'master_technician', 'assistant', 'controller')
      AND u.archived_at IS NULL AND u.login_attached_at IS NOT NULL
      AND NOT u.is_digital_twin AND NOT u.is_sample AND NOT u.is_walk_tester
    UNION
    SELECT m.user_id, 'crew' FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id
    UNION
    SELECT b.assignee_user_id, 'crew' FROM public.job_schedule_blocks b
    WHERE b.job_id = p_job_id AND b.work_date >= date_trunc('week', public.app_today())::date - 7
  ), by_person AS (
    SELECT a.person_id, 'sub'::text AS way
    FROM public.people_labor_job_assignees a
    JOIN public.people_labor_jobs lj ON lj.id = a.labor_job_id
    WHERE lj.job_ledger_id = p_job_id
    UNION
    SELECT c.person_id, 'sub' FROM public.step_commitments c
    WHERE c.job_id = p_job_id AND c.status NOT IN ('draft', 'declined', 'cancelled')
    UNION
    SELECT d.person_id, 'paper' FROM public.person_contract_documents d
    JOIN live ON live.id = d.job_required_paper_id
    WHERE d.person_id IS NOT NULL
  ), members AS (
    SELECT bu.user_id,
      (SELECT p.id FROM public.people p WHERE p.account_user_id = bu.user_id AND p.archived_at IS NULL LIMIT 1) AS person_id,
      bu.way
    FROM by_user bu
    JOIN public.users u ON u.id = bu.user_id
    WHERE u.archived_at IS NULL AND NOT u.is_digital_twin
    UNION ALL
    SELECT p.account_user_id, p.id, bp.way
    FROM by_person bp
    JOIN public.people p ON p.id = bp.person_id
    WHERE p.archived_at IS NULL
  ), folded AS (
    SELECT coalesce(m.person_id, m.user_id) AS key,
      max(m.person_id::text)::uuid AS person_id,
      max(m.user_id::text)::uuid AS user_id,
      array_agg(DISTINCT m.way) FILTER (WHERE m.way <> 'paper') AS ways
    FROM members m
    WHERE coalesce(m.person_id, m.user_id) IS NOT NULL
    GROUP BY coalesce(m.person_id, m.user_id)
  ), rows AS (
    SELECT f.key, f.person_id, f.user_id, coalesce(f.ways, '{}'::text[]) AS ways,
      coalesce(nullif(btrim(p.name), ''), nullif(btrim(u.name), ''), 'No name') AS name,
      coalesce(u.role::text, p.kind, '') AS role,
      (u.id IS NOT NULL AND u.login_attached_at IS NOT NULL) AS has_login,
      -- A sub is an outside company: someone who is a sub by their login or their file is not asked a site's paper.
      (coalesce(u.role::text, '') = 'subcontractor' OR coalesce(p.kind, '') = 'sub') AS is_sub
    FROM folded f
    LEFT JOIN public.people p ON p.id = f.person_id
    LEFT JOIN public.users u ON u.id = f.user_id
  )
  SELECT jsonb_build_object(
    'job_number', public.job_paper_job_number(p_job_id),
    'papers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'paper_name', l.paper_name, 'is_form', l.form_template_id IS NOT NULL,
        'book_document_id', l.book_document_id, 'required_at', l.required_at,
        'site_secrecy_id', l.site_secrecy_id
      ) ORDER BY l.required_at, l.id) FROM live l
    ), '[]'::jsonb),
    'people', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'key', r.key, 'person_id', r.person_id, 'user_id', r.user_id, 'name', r.name, 'role', r.role,
        'ways', to_jsonb(r.ways), 'has_login', r.has_login,
        'linked', r.person_id IS NOT NULL,
        'papers', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'required_paper_id', l.id, 'document_id', d.id, 'status', coalesce(d.status, 'none'),
            'signed_at', CASE WHEN d.status = 'signed' THEN d.signed_at END,
            'asked', NOT (l.site_secrecy_id IS NOT NULL AND r.is_sub)
          ) ORDER BY l.required_at, l.id)
          FROM live l
          LEFT JOIN LATERAL (
            SELECT c.id, c.status, c.signed_at
            FROM public.person_contract_documents c
            WHERE c.person_id = r.person_id
              AND (
                c.job_required_paper_id = l.id
                OR (l.site_secrecy_id IS NOT NULL AND c.job_required_paper_id IN (
                  SELECT s.id FROM public.job_required_papers s WHERE s.site_secrecy_id = l.site_secrecy_id
                ))
              )
            ORDER BY (c.status = 'signed') DESC, (c.job_required_paper_id = l.id) DESC, c.created_at, c.id
            LIMIT 1
          ) d ON true
        ), '[]'::jsonb)
      ) ORDER BY
        CASE WHEN 'office' = ANY (r.ways) THEN 0 WHEN 'crew' = ANY (r.ways) THEN 1 WHEN 'sub' = ANY (r.ways) THEN 2 ELSE 3 END,
        lower(r.name), r.key)
      FROM rows r
    ), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;

-- From 20261117220000_job_required_papers.sql. Added to the count of papers owed: a row a site wrote is not owed by a
-- user the site's paper covers.
CREATE OR REPLACE FUNCTION public.job_papers_needing_me()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH closed AS (
    SELECT unnest(public.jobs_closed_to_me()) AS job_id
  ), me AS (
    SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid() AND p.archived_at IS NULL LIMIT 1
  ), mine AS (
    SELECT c.job_id FROM closed c
    WHERE public.is_office_staff()
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = c.job_id AND m.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.job_schedule_blocks b
        WHERE b.job_id = c.job_id AND b.assignee_user_id = auth.uid()
          AND b.work_date >= date_trunc('week', public.app_today())::date - 7
      )
      OR EXISTS (
        SELECT 1 FROM public.people_labor_job_assignees a
        JOIN public.people_labor_jobs lj ON lj.id = a.labor_job_id
        JOIN me ON me.id = a.person_id
        WHERE lj.job_ledger_id = c.job_id
      )
      OR EXISTS (
        SELECT 1 FROM public.step_commitments sc JOIN me ON me.id = sc.person_id
        WHERE sc.job_id = c.job_id AND sc.status NOT IN ('draft', 'declined', 'cancelled')
      )
  )
  SELECT coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'job_id', m.job_id,
      'job_number', public.job_paper_job_number(m.job_id),
      'total', (SELECT count(*) FROM public.job_required_papers r WHERE r.job_id = m.job_id AND r.removed_at IS NULL),
      'owed', (
        SELECT count(*) FROM public.job_required_papers r
        WHERE r.job_id = m.job_id AND r.removed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.person_contract_documents d JOIN me ON me.id = d.person_id
            WHERE d.job_required_paper_id = r.id AND d.status = 'signed'
          )
          AND NOT (r.site_secrecy_id IS NOT NULL AND public.site_paper_covers_user(r.site_secrecy_id, auth.uid()))
      )
    ) ORDER BY public.job_paper_job_number(m.job_id), m.job_id)
    FROM mine m
  ), '[]'::jsonb);
$$;

-- From 20261121150000_settings_page_ground.sql. Added, twice: the row taken off earlier that comes back with its
-- signatures is one the job required by itself, never one a site wrote. A site's row comes back only through the
-- site, so a job that left a site is never handed the site's row again by a paper it requires by itself.
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
  v_basis text;
  v_notice boolean;
  v_now timestamptz;
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
    v_basis := NULL;
    v_notice := false;
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
      v_basis := public.job_paper_basis_clean(v_doc.settings_def, v_given -> v_book_id::text ->> 'basis');
      v_notice := public.contract_paper_has_notice(v_doc.settings_def);
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
    -- A paper whose settings list opens on a notice is required only by someone who ticked its box. Once for the
    -- paper on this job: a later change of its settings asks for no second tick.
    IF v_notice AND (v_given -> v_book_id::text -> 'notice_read') IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION '% opens on a notice. Tick its box before you require it.', v_doc.document_name USING ERRCODE = 'P0001';
    END IF;
    v_now := clock_timestamp();

    IF v_built THEN
      -- One taken off earlier comes back with its signatures when its settings and the Book's revision are the same.
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.site_secrecy_id IS NULL
        AND r.paper_name = btrim(v_doc.document_name)
        AND r.settings IS NOT DISTINCT FROM v_picks AND r.fields IS NOT DISTINCT FROM v_typed
        AND r.book_revision = v_doc.revision
      ORDER BY r.removed_at DESC
      LIMIT 1;
    ELSE
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.site_secrecy_id IS NULL
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
      UPDATE public.job_required_papers
        SET removed_at = NULL, removed_by = NULL,
            basis = CASE WHEN v_built THEN coalesce(v_basis, basis) ELSE basis END,
            notice_read_by = CASE WHEN v_notice THEN auth.uid() ELSE notice_read_by END,
            notice_read_at = CASE WHEN v_notice THEN v_now ELSE notice_read_at END
        WHERE id = v_old;
    ELSIF v_built THEN
      -- The words are the Book's clauses, put together for the picks when the paper is read. The row keeps no body.
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_format, required_by, required_at,
        settings, fields, book_revision, settings_revision, settings_set_by, settings_set_at,
        basis, notice_read_by, notice_read_at
      ) VALUES (
        p_job_id, v_book_id, btrim(v_doc.document_name), 'html', auth.uid(), v_now,
        v_picks, v_typed, v_doc.revision, 1, auth.uid(), v_now,
        v_basis, CASE WHEN v_notice THEN auth.uid() END, CASE WHEN v_notice THEN v_now END
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

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 8) Training mode, digital twins and the archived seal: site_secrecy gets its blocks. All four create only what is
-- missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
