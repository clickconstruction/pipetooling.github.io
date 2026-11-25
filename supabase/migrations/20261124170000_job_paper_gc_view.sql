SET lock_timeout = '3s';

-- Punch list #389, step 5, its last part: the office sets what a GC sees of who has signed a job's paper. Settled
-- with the owner on 2026-11-19: the count and each sub business with its day, and a job can be set to the count
-- only, or to every signer by name.
--
-- One column on the gate's row, gc_view: null for the count and the businesses, 'count' or 'names'. Two more say
-- who set it and when. One setter for the office, job_paper_set_gc_view. The setting marks the GC's page and never
-- the paper, so it changes in place whoever has signed, and nobody signs again. A change of settings after a
-- signature makes a new row: a trigger hands the new row the old row's setting, whatever writes the table.
-- job_papers_gc_page is replaced to honour it: it sends no business under 'count', and the signers only under 'names'.
--
-- No table and no policy, so no fence call. Every statement is safe to run twice.

-- 1) The columns.
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_view text;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_view_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS gc_view_set_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_required_papers_gc_view_check' AND conrelid = 'public.job_required_papers'::regclass) THEN
    ALTER TABLE public.job_required_papers ADD CONSTRAINT job_required_papers_gc_view_check CHECK (gc_view IS NULL OR gc_view IN ('count', 'names'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_required_papers.gc_view IS
  'Punch list #389 step 5: what the GC sees of who has signed this paper, on their portal page. Null shows the count and each sub business with its day. ''count'' shows the count alone. ''names'' adds every signer by name. Set by job_paper_set_gc_view, and kept by the next row when a change of settings makes one.';
COMMENT ON COLUMN public.job_required_papers.gc_view_set_by IS 'Who last set gc_view. Null on a row nobody set.';
COMMENT ON COLUMN public.job_required_papers.gc_view_set_at IS 'When gc_view was last set.';

-- 2) A row made in another's place keeps what the GC sees. A trigger, so it holds whatever makes the row.
CREATE OR REPLACE FUNCTION public.job_required_paper_keeps_gc_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  SELECT o.gc_view, o.gc_view_set_by, o.gc_view_set_at INTO NEW.gc_view, NEW.gc_view_set_by, NEW.gc_view_set_at
  FROM public.job_required_papers o WHERE o.id = NEW.revision_of;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_required_paper_keeps_gc_view() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_required_paper_keeps_gc_view ON public.job_required_papers;
CREATE TRIGGER job_required_paper_keeps_gc_view
  BEFORE INSERT ON public.job_required_papers
  FOR EACH ROW
  WHEN (NEW.revision_of IS NOT NULL AND NEW.gc_view IS NULL)
  EXECUTE FUNCTION public.job_required_paper_keeps_gc_view();

-- 3) The office sets it. Guarded as job_paper_set_basis is. It answers the view as the page words it.
CREATE OR REPLACE FUNCTION public.job_paper_set_gc_view(p_required_paper_id uuid, p_view text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.job_required_papers%ROWTYPE;
  v_view text := lower(btrim(coalesce(p_view, '')));
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
  IF v_view = '' THEN
    v_view := 'businesses';
  END IF;
  IF v_view NOT IN ('count', 'businesses', 'names') THEN
    RAISE EXCEPTION 'That is not one of the three ways a GC can see who has signed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.settings IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. A GC reads nothing about it.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(v_row.gc_view, 'businesses') = v_view THEN
    RETURN v_view;
  END IF;
  UPDATE public.job_required_papers
    SET gc_view = nullif(v_view, 'businesses'), gc_view_set_by = v_uid, gc_view_set_at = clock_timestamp()
    WHERE id = v_row.id;
  RETURN v_view;
END;
$$;

COMMENT ON FUNCTION public.job_paper_set_gc_view(uuid, text) IS
  'Punch list #389 step 5: the office sets what the GC sees of who has signed a paper a job requires, and gets the view back: ''count'' for the count alone, ''businesses'' for the count and each sub business with its day (the way every row starts, and what an empty view means), ''names'' for those and every signer by name. It marks the GC''s page and never the paper, so nobody signs again. The row keeps who set it and when. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_set_gc_view(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_set_gc_view(uuid, text) TO authenticated;

-- 4) What a GC reads, as 20261124160000 left it. What is new: view, the row's setting in the page's word. businesses
-- is empty under 'count'. signers, each person on the roster who has signed as {name, business, signed_on} in the
-- order they signed, is filled only under 'names', and business is the trade company of a sub and null for anyone else.
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
        ) ELSE '[]'::jsonb END
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
  'Punch list #389, step 5: what a GC reads about the papers a job requires, for the customer-portal function. Answers [{job_id, papers: [{id, paper_name, settings_revision, view, level: {key, label, aligned_with} or null, said: [{key, label, choice, says, out}], signed, total, businesses: [{name, people, signed, signed_on}], signers: [{name, business, signed_on}]}]}] for each job asked about that requires a paper built from settings. signed and total count the office''s own roster. view is the office''s setting for the row: under ''count'' businesses is empty, and signers is filled only under ''names''. A sub business is the trade company a sub works for, or their own roster name with none on file. The service key only.';
REVOKE ALL ON FUNCTION public.job_papers_gc_page(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_papers_gc_page(uuid[]) TO service_role;
