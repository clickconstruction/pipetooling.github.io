SET lock_timeout = '3s';

-- Punch list #389, step 7: the GC's own form. A GC that requires its own secrecy form hands it to the office, which
-- keeps it as a Form Studio form and requires it on the job as any paper. Settled on 2026-11-25: the office says a
-- required form is the GC's own with a tick on that form's line.
--
-- One column on the gate's row, gc_own, false on every row there is. Two more say who set it and when. Only a form
-- with no settings can carry it. One setter for the office, job_paper_set_gc_own. The mark changes what the GC's page
-- says and never the form, so it is set and taken off in place whoever has signed, and nobody signs again.
--
-- job_papers_gc_page is replaced once more, started from the function as 20261125023655 left it. A job is no longer
-- skipped when a form on it is marked, and each job's answer gains a second list, own_forms: the form's name, how many
-- have signed, and each sub business with its day. papers is as it was. A second list and not one more kind of paper:
-- the portal function that is live between this push and its own deploy reads a key it knows and leaves the rest, so
-- it never draws a form as a paper built from settings.
--
-- No table and no policy, so no fence call. Every statement is safe to run twice.

-- 1) The columns.
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_own boolean NOT NULL DEFAULT false;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_own_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_own_set_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_required_papers_gc_own_is_a_form' AND conrelid = 'public.job_required_papers'::regclass) THEN
    ALTER TABLE public.job_required_papers ADD CONSTRAINT job_required_papers_gc_own_is_a_form CHECK (NOT gc_own OR (form_template_id IS NOT NULL AND settings IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.job_required_papers.gc_own IS
  'Punch list #389 step 7: true when this required form is the GC''s own form, which the GC handed the office. The GC''s portal page then says the subs sign the GC''s own form, with how many have signed. Only a form with no settings can carry it. Set by job_paper_set_gc_own.';
COMMENT ON COLUMN public.job_required_papers.gc_own_set_by IS 'Who last set gc_own. Null on a row nobody set.';
COMMENT ON COLUMN public.job_required_papers.gc_own_set_at IS 'When gc_own was last set.';

-- 2) The office sets it. Guarded as job_paper_set_gc_view is. It answers the mark as it now stands.
CREATE OR REPLACE FUNCTION public.job_paper_set_gc_own(p_required_paper_id uuid, p_own boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.job_required_papers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to set a job''s papers.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot set a job''s papers.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  IF p_own IS NULL THEN
    RAISE EXCEPTION 'Say whether this is the GC''s own form.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.form_template_id IS NULL OR v_row.settings IS NOT NULL THEN
    RAISE EXCEPTION '% is not a form. Only a form can be the GC''s own form.', v_row.paper_name USING ERRCODE = 'P0001';
  END IF;
  IF v_row.gc_own = p_own THEN
    RETURN p_own;
  END IF;
  UPDATE public.job_required_papers
    SET gc_own = p_own, gc_own_set_by = v_uid, gc_own_set_at = clock_timestamp()
    WHERE id = v_row.id;
  RETURN p_own;
END;
$$;

COMMENT ON FUNCTION public.job_paper_set_gc_own(uuid, boolean) IS
  'Punch list #389 step 7: the office says a form a job requires is the GC''s own form, or takes that back, and gets the mark back as it now stands. It refuses a paper that is not a form. It marks the GC''s page and never the form, so nobody signs again. The row keeps who set it and when. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_set_gc_own(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_set_gc_own(uuid, boolean) TO authenticated;

-- 3) What a GC reads, as 20261125023655 left it. What is new: a job with a form marked as the GC's own is no longer
-- skipped, and each job answers own_forms beside papers, each form as {id, paper_name, signed, total, businesses}.
-- signed, total and businesses are counted as a paper's are. A job is answered when either list holds something, and
-- both are always arrays.
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
  v_own jsonb;
  v_out jsonb := '[]'::jsonb;
BEGIN
  FOR v_job IN
    SELECT DISTINCT x FROM unnest(coalesce(p_job_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL LIMIT 500
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = v_job AND r.removed_at IS NULL AND (r.settings IS NOT NULL OR r.gc_own)) THEN
      CONTINUE;
    END IF;
    v_roster := public.job_papers_roster_now(v_job);
    SELECT jsonb_agg(t.paper ORDER BY t.required_at, t.id) INTO v_papers
    FROM (
      SELECT r.id, r.required_at, jsonb_build_object(
        'id', r.id,
        'paper_name', r.paper_name,
        'settings_revision', r.settings_revision,
        'view', coalesce(r.gc_view, 'businesses'),
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
        'businesses', CASE WHEN r.gc_view = 'count' THEN '[]'::jsonb ELSE (
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
        ) END,
        'signers', CASE WHEN r.gc_view = 'names' THEN (
          SELECT coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'business', s.business, 'signed_on', s.signed_at)
            ORDER BY s.signed_at, lower(s.name), s.name), '[]'::jsonb)
          FROM (
            SELECT coalesce(nullif(btrim(p.v ->> 'name'), ''), 'No name') AS name,
              CASE WHEN p.v -> 'ways' ? 'sub' OR p.v ->> 'role' IN ('subcontractor', 'sub')
                THEN public.person_signs_for(nullif(p.v ->> 'person_id', '')::uuid) END AS business,
              (SELECT x.v ->> 'signed_at' FROM jsonb_array_elements(p.v -> 'papers') AS x(v)
               WHERE x.v ->> 'required_paper_id' = r.id::text AND x.v ->> 'status' = 'signed' LIMIT 1) AS signed_at
            FROM jsonb_array_elements(v_roster -> 'people') AS p(v)
          ) s
          WHERE s.signed_at IS NOT NULL
        ) ELSE '[]'::jsonb END,
        'picks', r.settings,
        'basis', r.basis,
        'def', d.settings_def,
        'proposal', (
          SELECT jsonb_build_object(
            'state', x.state, 'by_name', x.proposed_by_name, 'proposed_at', x.proposed_at,
            'decided_at', x.decided_at, 'why', x.decline_why, 'settings', x.settings
          )
          FROM public.job_paper_proposals x
          JOIN public.jobs_ledger j ON j.id = r.job_id AND j.gc_customer_id = x.customer_id
          WHERE x.required_paper_id = r.id OR x.taken_as = r.id
          ORDER BY x.proposed_at DESC, x.id LIMIT 1
        )
      ) AS paper
      FROM public.job_required_papers r
      JOIN public.contract_template_documents d ON d.id = r.book_document_id
      WHERE r.job_id = v_job AND r.removed_at IS NULL AND r.settings IS NOT NULL AND d.settings_def IS NOT NULL
    ) t;
    SELECT jsonb_agg(t.form ORDER BY t.required_at, t.id) INTO v_own
    FROM (
      SELECT r.id, r.required_at, jsonb_build_object(
        'id', r.id,
        'paper_name', r.paper_name,
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
      ) AS form
      FROM public.job_required_papers r
      WHERE r.job_id = v_job AND r.removed_at IS NULL AND r.gc_own AND r.settings IS NULL AND r.form_template_id IS NOT NULL
    ) t;
    IF v_papers IS NOT NULL OR v_own IS NOT NULL THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'job_id', v_job, 'papers', coalesce(v_papers, '[]'::jsonb), 'own_forms', coalesce(v_own, '[]'::jsonb)
      ));
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.job_papers_gc_page(uuid[]) IS
  'Punch list #389, steps 5 to 7: what a GC reads about the papers a job requires, for the customer-portal function. Answers [{job_id, papers: [{id, paper_name, settings_revision, view, level: {key, label, aligned_with} or null, said: [{key, label, choice, says, out}], signed, total, businesses: [{name, people, signed, signed_on}], signers: [{name, business, signed_on}], picks, basis, def, proposal: {state, by_name, proposed_at, decided_at, why, settings} or null}], own_forms: [{id, paper_name, signed, total, businesses: [{name, people, signed, signed_on}]}]}] for each job asked about that requires a paper built from settings or a form marked as the GC''s own. papers holds the papers built from settings and own_forms the marked forms, and either can be empty. signed and total count the office''s own roster. view is the office''s setting for a paper''s row: under ''count'' businesses is empty, and signers is filled only under ''names''. picks, basis and def (the Book entry''s whole settings list) are for the portal function to shape the GC''s sliders from; it hands the page only names, plain words and the notice. proposal is the last one by the job''s GC on the row, or taken as it. The service key only.';
REVOKE ALL ON FUNCTION public.job_papers_gc_page(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_papers_gc_page(uuid[]) TO service_role;
