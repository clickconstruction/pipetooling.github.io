SET lock_timeout = '3s';

-- Punch list #389, step 5, its first part: what a GC reads about the papers a job requires. One function for the
-- service key, job_papers_gc_page, read by the customer-portal function for the jobs a GC is the GC on. For each
-- paper built from settings it answers the job's settings in the list's own plain words, the level they come to,
-- how many of the people who can open the job have signed, and each sub business with its day. No worker is named.
--
-- The count is the office's own roster, so the two can never disagree. job_papers_roster was the office's alone: it
-- refuses a caller with no login, which the service key is. Its body moves into job_papers_roster_now, word for
-- word, granted to nobody, and job_papers_roster keeps its guard and calls it. Nothing the office reads changes.
--
-- No table, no column, no policy. Three functions: one new and internal, one replaced with the same answer, one new.

-- 1) The roster's body, as 20261118020000 left it, with its guard taken off. Internal: granted to nobody.
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

COMMENT ON FUNCTION public.job_papers_roster_now(uuid) IS
  'Papers before a job opens: the roster of a job, everyone who can open it against each paper it requires, with no question about who asks. The body of job_papers_roster, read by it and by job_papers_gc_page. Granted to nobody.';
REVOKE ALL ON FUNCTION public.job_papers_roster_now(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 2) The office's roster: the same guard, the same answer.
CREATE OR REPLACE FUNCTION public.job_papers_roster(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office reads who has signed a job''s papers.' USING ERRCODE = '42501';
  END IF;
  RETURN public.job_papers_roster_now(p_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.job_papers_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_roster(uuid) TO authenticated, service_role;

-- 3) What a GC reads. For each job asked about that requires a paper built from settings: the paper's name, the
-- revision of its settings on this job, the level (the first level of the Book's list whose picks are the job's, or
-- null for a mix of its own), the picks in the list's plain words, signed and total over the roster, and the sub
-- businesses. A sub's business is the trade company they work for, or their own roster name when none is on file.
-- A business reads signed_on, the last day one of its people signed, only when all of them have.
-- A job that requires no such paper is left out, and costs one look at the gate's table.
CREATE OR REPLACE FUNCTION public.job_papers_gc_page(p_job_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_job uuid;
  v_roster jsonb;
  v_papers jsonb;
  v_out jsonb := '[]'::jsonb;
BEGIN
  FOR v_job IN
    SELECT DISTINCT x FROM unnest(coalesce(p_job_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL LIMIT 500
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = v_job AND r.removed_at IS NULL AND r.settings IS NOT NULL) THEN
      CONTINUE;
    END IF;
    v_roster := public.job_papers_roster_now(v_job);
    SELECT jsonb_agg(t.paper ORDER BY t.required_at, t.id) INTO v_papers
    FROM (
      SELECT r.id, r.required_at, jsonb_build_object(
        'id', r.id,
        'paper_name', r.paper_name,
        'settings_revision', r.settings_revision,
        'level', (
          SELECT jsonb_build_object('key', l.v ->> 'key', 'label', btrim(coalesce(l.v ->> 'label', '')), 'aligned_with', btrim(coalesce(l.v ->> 'alignedWith', '')))
          FROM jsonb_array_elements(coalesce(d.settings_def -> 'levels', '[]'::jsonb)) WITH ORDINALITY AS l(v, at)
          WHERE l.v -> 'picks' = r.settings
          ORDER BY l.at LIMIT 1
        ),
        'said', public.contract_paper_said(d.settings_def, r.settings, 'en'),
        'signed', (
          SELECT count(*) FROM jsonb_array_elements(v_roster -> 'people') AS p(v)
          WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(p.v -> 'papers') AS x(v) WHERE x.v ->> 'required_paper_id' = r.id::text AND x.v ->> 'status' = 'signed')
        ),
        'total', jsonb_array_length(v_roster -> 'people'),
        'businesses', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', b.name, 'people', b.people, 'signed', b.signed,
            'signed_on', CASE WHEN b.signed = b.people THEN b.last_signed END
          ) ORDER BY lower(b.name), b.name), '[]'::jsonb)
          FROM (
            SELECT s.name, count(*) AS people, count(s.signed_at) AS signed, max(s.signed_at) AS last_signed
            FROM (
              SELECT coalesce(public.person_signs_for(nullif(p.v ->> 'person_id', '')::uuid), nullif(btrim(p.v ->> 'name'), ''), 'No name') AS name,
                (SELECT x.v ->> 'signed_at' FROM jsonb_array_elements(p.v -> 'papers') AS x(v)
                 WHERE x.v ->> 'required_paper_id' = r.id::text AND x.v ->> 'status' = 'signed' LIMIT 1) AS signed_at
              FROM jsonb_array_elements(v_roster -> 'people') AS p(v)
              WHERE p.v -> 'ways' ? 'sub' OR p.v ->> 'role' IN ('subcontractor', 'sub')
            ) s
            GROUP BY s.name
          ) b
        )
      ) AS paper
      FROM public.job_required_papers r
      JOIN public.contract_template_documents d ON d.id = r.book_document_id
      WHERE r.job_id = v_job AND r.removed_at IS NULL AND r.settings IS NOT NULL AND d.settings_def IS NOT NULL
    ) t;
    IF v_papers IS NOT NULL THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('job_id', v_job, 'papers', v_papers));
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.job_papers_gc_page(uuid[]) IS
  'Punch list #389, step 5: what a GC reads about the papers a job requires, for the customer-portal function. Answers [{job_id, papers: [{id, paper_name, settings_revision, level: {key, label, aligned_with} or null, said: [{key, label, choice, says, out}], signed, total, businesses: [{name, people, signed, signed_on}]}]}] for each job asked about that requires a paper built from settings. signed and total count the office''s own roster. A sub business is the trade company a sub works for, or their own roster name with none on file, and no worker is named. The service key only.';
REVOKE ALL ON FUNCTION public.job_papers_gc_page(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_papers_gc_page(uuid[]) TO service_role;
