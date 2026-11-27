SET lock_timeout = '3s';

-- THE MEND for 20261127052337_site_secrecy.sql (punch list #439, piece 4, the ground). Kept ready, not meant to be
-- pushed: push it only if a read or a save of a job misbehaves after the site's file and the cause is not found at
-- once. It puts the gate of punch list #389 back exactly as it ran before that file.
--
-- What it does, in order:
--   1. Every site that is on goes off, as site_secrecy_turn_off does it: the site's rows come off their jobs, which
--      open at once, and every signed copy stays on its person's file.
--   2. site_secrecy_turn_on refuses, with its reason, so no site goes on under the gate of before, which would read a
--      site's row as a paper each job requires by itself.
--   3. The two trigger functions return at once. The triggers stay: taking one off jobs_ledger needs a lock that
--      stops every read of a job, and a trigger whose function does nothing costs nothing.
--   4. The nine functions of the gate, each restated from its newest definition before the site's file. Each body is
--      byte for byte what prod ran on 2026-11-27 before that file: the md5 of each is on its line below, and it is
--      the md5 of prosrc read on prod then.
--
-- What it leaves: the table site_secrecy with its rows, each turned off; the column job_required_papers.site_secrecy_id
-- with what it holds; address_key; the internal helpers; the preview and the turn-off. None is read by the gate of
-- before. Putting the site's rule back is the site's file again, as a new migration.
--
-- What it locks: rows only, in step 1. No statement here takes a lock on a table, so no read and no save waits.
-- Safe to run twice. No table is made, so no fence call closes the file.

-- 1) Every site off. The rows first, so no job is left shut by a site that reads as off.
UPDATE public.job_required_papers SET removed_at = now()
WHERE site_secrecy_id IS NOT NULL AND removed_at IS NULL;
UPDATE public.site_secrecy SET turned_off_at = now()
WHERE turned_off_at IS NULL;

-- 2) No site goes on while the gate is the gate of before.
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
BEGIN
  RAISE EXCEPTION 'Secrecy on a site is switched off while it is mended. Nothing was changed.' USING ERRCODE = 'P0001';
END;
$$;

-- 3) The two triggers do nothing.
CREATE OR REPLACE FUNCTION public.site_secrecy_on_job_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_secrecy_on_answer_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN NULL;
END;
$$;

-- 4) The nine functions of the gate, as they ran before the site's file. CREATE OR REPLACE keeps each one's owner
-- and its grants, which the site's file did not change.

-- From 20261117220000_job_required_papers.sql. md5 of the body: 2895270825653d0a18f07b918449c695.
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

-- From 20261117220000_job_required_papers.sql. md5 of the body: 3b7f0f3d0a3f95c14ef398220d567db4.
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

-- From 20261118020000_job_papers_lists.sql. md5 of the body: e76aa921f4ba0595d55d53ee3d070dce.
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
    )
  END;
$$;

-- From 20261117220000_job_required_papers.sql. md5 of the body: ef41b8f29e19971bc951b754b206aa88.
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

-- From 20261117220000_job_required_papers.sql. md5 of the body: a9e67619c1c7a3a035ecdcc4a4c0c322.
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

-- From 20261117220000_job_required_papers.sql. md5 of the body: 6fe922f3c7b8f194cbd2bcf4a3b18679.
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

-- From 20261124160000_job_papers_gc_page.sql. md5 of the body: 37de3059e84f44d28edd9e72966d5114.
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
    SELECT r.id, r.paper_name, r.form_template_id, r.required_at, r.book_document_id
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

-- From 20261117220000_job_required_papers.sql. md5 of the body: 5140afbc7efee7a1f3fc216f47ef3a18.
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

-- From 20261121150000_settings_page_ground.sql. md5 of the body: 2f99efd8e048faba0fea4a2173923b75.
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
