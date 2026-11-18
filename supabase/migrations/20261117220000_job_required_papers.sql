SET lock_timeout = '3s';

-- Papers before a job opens, step 1 of seven: the ground. The owner's ask of 2026-11-17: a job can require papers (an
-- NDA, site rules, a GC's own form, several of them), and nobody opens that job until they have signed each one. He
-- settled who must sign the same day: everyone, the office too.
--
-- This file makes the papers a job requires, a person's signed copy tied to that job, the one question every lock will
-- ask, and the functions the screens of steps 2 and 3 call. No screen calls any of it yet, and nothing here closes
-- anything: no policy on a table in use changes. The lock in the database is step 4.
--
--   * job_required_papers: one row per paper a job requires. It keeps the paper's words as they stood in the Contract
--     Book the day the office required it (name, body, format, link, form), so everyone on the job signs the same
--     words, and a Book entry edited or taken out of its packet later changes nothing a job already asks for.
--     removed_at keeps history: taking a paper off opens the job and keeps every signature.
--   * person_contract_documents.job_id and .job_required_paper_id: a person's own copy of one required paper. One per
--     person per required paper. Its document_name carries the job's number ("Site rules (job J100)"), so none of
--     the Book's name-keyed paths (a packet assigned, a Book save minting a new version, a rename) ever takes a job's
--     copy for the person's general one.
--   * job_closed_to_me(job) and jobs_closed_to_me(): does the caller still owe a paper on this job, and the jobs they
--     owe one on. Both begin with one look at job_required_papers' live rows, a partial index that is empty until the
--     office first requires a paper, and read nothing else when that look finds nothing.
--   * The person is found by people.account_user_id = auth.uid(), never by name. A login tied to no roster person
--     reads as owing, and the roster says so.
--
-- One CREATE TABLE, so the four fence calls close the file. Idempotent.

-- 1) The papers a job requires.
CREATE TABLE IF NOT EXISTS public.job_required_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The Book entry it was picked from. The words below are the job's own, so the entry may go.
  book_document_id uuid REFERENCES public.contract_template_documents(id) ON DELETE SET NULL,
  paper_name text NOT NULL CONSTRAINT job_required_papers_named CHECK (btrim(paper_name) <> ''),
  body_html text,
  body_format text NOT NULL DEFAULT 'html'
    CONSTRAINT job_required_papers_body_format_known CHECK (body_format IN ('html', 'plain', 'markdown')),
  canonical_document_url text,
  -- A form a job requires cannot be deleted from under it.
  form_template_id uuid REFERENCES public.contract_form_templates(id) ON DELETE RESTRICT,
  required_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  required_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- The look every lock begins with: live rows only, so it is empty while no job requires a paper.
CREATE INDEX IF NOT EXISTS job_required_papers_live_job ON public.job_required_papers (job_id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_required_papers_one_live
  ON public.job_required_papers (job_id, book_document_id) WHERE removed_at IS NULL AND book_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_required_papers_job ON public.job_required_papers (job_id);
CREATE INDEX IF NOT EXISTS job_required_papers_book_document ON public.job_required_papers (book_document_id) WHERE book_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_required_papers_form_template ON public.job_required_papers (form_template_id) WHERE form_template_id IS NOT NULL;

COMMENT ON TABLE public.job_required_papers IS
  'Papers before a job opens: one row per paper a job requires of everyone who opens it, with the paper''s words as they stood in the Contract Book the day it was required. removed_at takes it off and keeps history. Written only by job_papers_require and job_paper_remove; the office reads it.';

ALTER TABLE public.job_required_papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_required_papers_select ON public.job_required_papers;
CREATE POLICY job_required_papers_select ON public.job_required_papers FOR SELECT TO authenticated
  USING ((SELECT public.is_office_staff()));
REVOKE ALL ON public.job_required_papers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.job_required_papers FROM authenticated;

-- 2) A person's copy of a required paper.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS job_required_paper_id uuid REFERENCES public.job_required_papers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_job
  ON public.person_contract_documents (job_id) WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS person_contract_documents_one_per_job_paper
  ON public.person_contract_documents (job_required_paper_id, person_id) WHERE job_required_paper_id IS NOT NULL;

COMMENT ON COLUMN public.person_contract_documents.job_id IS
  'Papers before a job opens: the job this paper was signed for. Null on every other paper.';
COMMENT ON COLUMN public.person_contract_documents.job_required_paper_id IS
  'Papers before a job opens: the required paper (job_required_papers) this row is one person''s copy of. One per person per required paper. A signed copy is what opens the job to that person.';

-- 3) A job's number as the screens write it.
CREATE OR REPLACE FUNCTION public.job_paper_job_number(p_job_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT coalesce(
    (SELECT coalesce(nullif(btrim(j.hcp_number), ''), nullif(btrim(j.click_number), ''), '')
     FROM public.jobs_ledger j WHERE j.id = p_job_id),
    '');
$$;

COMMENT ON FUNCTION public.job_paper_job_number(uuid) IS
  'Papers before a job opens, internal: a job''s number as the screens write it (the HCP number, else the Click number, else nothing). Not granted to a signed-in user: the functions that may show a number call it.';
REVOKE EXECUTE ON FUNCTION public.job_paper_job_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_paper_job_number(uuid) TO service_role;

-- 4) The one question every lock asks. The CASE keeps the order: no login, then the cheap look (one probe of the
-- live rows' index for this job), and only a job that requires a paper reaches the caller's own papers. So a job that
-- requires nothing never reads person_contract_documents or people.
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
    )
  END;
$$;

COMMENT ON FUNCTION public.job_closed_to_me(uuid) IS
  'Papers before a job opens: true when the signed-in user still owes a paper this job requires (a live job_required_papers row with no signed copy of theirs, the person found by people.account_user_id). False for a job that requires nothing, and for a caller with no login (the service role). It reads job_required_papers'' live rows first and nothing else when there are none.';
REVOKE EXECUTE ON FUNCTION public.job_closed_to_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_closed_to_me(uuid) TO authenticated, service_role;

-- The same answer as a set, for a list's lock marks and for a policy that asks once a statement. The CASE keeps the
-- order: no login, then the cheap look, then the caller's own papers.
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
    ), '{}'::uuid[])
  END;
$$;

COMMENT ON FUNCTION public.jobs_closed_to_me() IS
  'Papers before a job opens: the ids of the jobs the signed-in user still owes a paper on, the same rule as job_closed_to_me(job). Empty for a caller with no login and while no job requires a paper.';
REVOKE EXECUTE ON FUNCTION public.jobs_closed_to_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jobs_closed_to_me() TO authenticated, service_role;

-- 5) One person's papers on one job: the job's number and each required paper with that person's copy. Internal: the
-- caller's own goes out through job_papers_mine, and the sub's page (step 6) reads it with the service key.
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
      LEFT JOIN public.person_contract_documents d ON d.job_required_paper_id = r.id AND d.person_id = p_person_id
      WHERE r.job_id = p_job_id AND r.removed_at IS NULL
    ), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.job_papers_for_person(uuid, uuid) IS
  'Papers before a job opens, internal: {job_number, papers[{id, paper_name, is_form, document_id, status, signed_at}]} for one roster person on one job, oldest requirement first. status is none until the person has a copy. The number comes only with a job that requires a paper. Service role only; a signed-in user reads their own through job_papers_mine.';
REVOKE EXECUTE ON FUNCTION public.job_papers_for_person(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_papers_for_person(uuid, uuid) TO service_role;

-- The caller's own, for the prompt. Before signing a person sees the job's number and the papers' names and no more
-- (the owner's call 2), so this hands back nothing else of the job.
CREATE OR REPLACE FUNCTION public.job_papers_mine(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH me AS (
    SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid() AND p.archived_at IS NULL LIMIT 1
  )
  SELECT CASE WHEN auth.uid() IS NULL OR p_job_id IS NULL THEN NULL
    ELSE public.job_papers_for_person(p_job_id, (SELECT id FROM me))
      || jsonb_build_object('linked', EXISTS (SELECT 1 FROM me))
  END;
$$;

COMMENT ON FUNCTION public.job_papers_mine(uuid) IS
  'Papers before a job opens: the signed-in user''s papers on one job for the prompt, {job_number, linked, papers[...]} as job_papers_for_person hands them back. linked is false when no roster person is tied to the login: every paper then reads as owed and none can be started. Nothing else of the job is returned.';
REVOKE EXECUTE ON FUNCTION public.job_papers_mine(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_mine(uuid) TO authenticated, service_role;

-- 6) A person's own copy of one required paper, made from the job's words. The caller's own by default. The office
-- makes one for someone else (the roster's Copy the signing link), and so does the service role (the sub's page).
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

COMMENT ON FUNCTION public.job_paper_start(uuid, uuid) IS
  'Papers before a job opens: the id of one person''s copy of a required paper, made from the job''s own words the first time and handed back as it is after that. With no person it is the caller''s own (people.account_user_id); the office and the service role may name someone else. The copy is a person_contract_documents row named with the job''s number, unsent, with job_id and job_required_paper_id set. Training mode refuses it like any write.';
REVOKE EXECUTE ON FUNCTION public.job_paper_start(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_start(uuid, uuid) TO authenticated, service_role;

-- 7) The office requires papers on a job, each picked from the Contract Book. A paper the job already requires is
-- left alone. One taken off earlier comes back with its signatures when the Book's words have not changed since.
CREATE OR REPLACE FUNCTION public.job_papers_require(p_job_id uuid, p_book_document_ids uuid[])
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
    IF btrim(coalesce(v_doc.book_body_html, '')) = '' AND v_doc.form_template_id IS NULL
       AND btrim(coalesce(v_doc.canonical_document_url, '')) = '' THEN
      RAISE EXCEPTION '% has no words yet. Write it in the Contract Book first.', v_doc.document_name USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NULL) THEN
      CONTINUE;
    END IF;

    SELECT r.id INTO v_old FROM public.job_required_papers r
    WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
      AND r.paper_name = btrim(v_doc.document_name)
      AND r.body_html IS NOT DISTINCT FROM v_doc.book_body_html
      AND r.body_format = coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html')
      AND r.canonical_document_url IS NOT DISTINCT FROM nullif(btrim(coalesce(v_doc.canonical_document_url, '')), '')
      AND r.form_template_id IS NOT DISTINCT FROM v_doc.form_template_id
    ORDER BY r.removed_at DESC
    LIMIT 1;
    IF v_old IS NOT NULL THEN
      UPDATE public.job_required_papers SET removed_at = NULL, removed_by = NULL WHERE id = v_old;
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

COMMENT ON FUNCTION public.job_papers_require(uuid, uuid[]) IS
  'Papers before a job opens: the office requires papers on a job, each a Contract Book entry, and gets back how many were added. The job keeps each paper''s words as they stand in the Book now. One the job already requires is left alone, and one taken off earlier comes back with its signatures when the Book''s words have not changed. Refuses a paper with no words, more than twenty, and anyone outside the office.';
REVOKE EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[]) TO authenticated, service_role;

-- Taking a paper off opens the job to whoever owed only that one, and keeps every signature.
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
  UPDATE public.job_required_papers SET removed_at = now(), removed_by = auth.uid()
  WHERE id = p_required_paper_id AND removed_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.job_paper_remove(uuid) IS
  'Papers before a job opens: the office takes a required paper off its job. The row stays with removed_at, and every signed copy stays on its person''s file. Office only.';
REVOKE EXECUTE ON FUNCTION public.job_paper_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_remove(uuid) TO authenticated, service_role;

-- 8) The roster, for the office: everyone who can open the job today against each paper. The office (dev, master
-- technician, assistant, controller, with a login, no twin and no sample account), the job's crew (its team and anyone
-- on its schedule since last Monday week), its subs (a labor sheet or a live work order on the job), and anyone who
-- already holds a copy of one of its papers. The count the save button states is the length of people.
CREATE OR REPLACE FUNCTION public.job_papers_roster(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office reads who has signed a job''s papers.' USING ERRCODE = '42501';
  END IF;

  WITH live AS (
    SELECT r.id, r.paper_name, r.form_template_id, r.required_at, r.book_document_id
    FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL
  ), by_user AS (
    SELECT u.id AS user_id, 'office'::text AS way
    FROM public.users u
    WHERE u.role::text IN ('dev', 'master_technician', 'assistant', 'controller')
      AND u.archived_at IS NULL AND u.login_attached_at IS NOT NULL
      AND NOT u.is_digital_twin AND NOT u.is_sample
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
      (u.id IS NOT NULL AND u.login_attached_at IS NOT NULL) AS has_login
    FROM folded f
    LEFT JOIN public.people p ON p.id = f.person_id
    LEFT JOIN public.users u ON u.id = f.user_id
  )
  SELECT jsonb_build_object(
    'job_number', public.job_paper_job_number(p_job_id),
    'papers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'paper_name', l.paper_name, 'is_form', l.form_template_id IS NOT NULL,
        'book_document_id', l.book_document_id, 'required_at', l.required_at
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
            'signed_at', CASE WHEN d.status = 'signed' THEN d.signed_at END
          ) ORDER BY l.required_at, l.id)
          FROM live l
          LEFT JOIN public.person_contract_documents d ON d.job_required_paper_id = l.id AND d.person_id = r.person_id
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

COMMENT ON FUNCTION public.job_papers_roster(uuid) IS
  'Papers before a job opens: for the office, {job_number, papers[...], people[{key, person_id, user_id, name, role, ways, has_login, linked, papers[{required_paper_id, document_id, status, signed_at}]}]}. people is everyone who can open the job today: the office, the job''s crew, its subs, and anyone already holding a copy of one of its papers. linked false means no roster person is tied to that login, so they cannot sign until the office links them. Office only.';
REVOKE EXECUTE ON FUNCTION public.job_papers_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_roster(uuid) TO authenticated, service_role;

-- 9) The jobs that wait on the caller's signature, for a Needs you line: the jobs closed to them that are theirs to
-- open. For the office that is every such job. For anyone else it is a job they are on: its team, its schedule since
-- last Monday week, or a sub's sheet or live work order through their roster person.
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
      )
    ) ORDER BY public.job_paper_job_number(m.job_id), m.job_id)
    FROM mine m
  ), '[]'::jsonb);
$$;

COMMENT ON FUNCTION public.job_papers_needing_me() IS
  'Papers before a job opens: [{job_id, job_number, total, owed}] for the jobs that wait on the signed-in user''s signature and are theirs to open: every closed job for the office, and for anyone else the closed jobs they are on (team, schedule since last Monday week, a sub''s sheet or live work order). Empty while no job requires a paper.';
REVOKE EXECUTE ON FUNCTION public.job_papers_needing_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_needing_me() TO authenticated, service_role;

-- 10) Training mode, digital twins and the archived seal: job_required_papers gets its blocks. All four create only
-- what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
