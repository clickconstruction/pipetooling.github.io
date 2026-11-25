SET lock_timeout = '3s';

-- Punch list #389, step 6: the GC proposes a stricter setting for a job's paper, and the office takes it or declines.
-- Settled with the owner on 2026-11-17: the GC proposes, the office confirms, nothing a GC presses reaches a sub before
-- the office's confirm, and a GC may move a setting toward stricter only.
--
-- One table, job_paper_proposals: a proposal against one row of job_required_papers, with the picks it asks for, the
-- picks the job had, the name the GC typed and the day. It writes nothing to the paper. One proposal waits on a paper
-- at a time: a newer one, a change of the paper's settings, or the paper coming off the job overtakes it.
--
-- job_paper_propose is the service key's alone, for the portal function. It holds the job to the customer as its GC
-- and refuses a proposal that loosens any topic or changes nothing. job_paper_proposal_decide is the office's: decline
-- with a reason the GC reads, or take it, which saves the proposed picks through job_paper_set_settings, so a paper
-- somebody has signed becomes a new version that everyone signs again. job_papers_gc_page is replaced to hand the
-- portal function what the GC's sliders need, and the last proposal with its state.
--
-- Every statement is safe to run twice.

-- 1) The table.
CREATE TABLE IF NOT EXISTS public.job_paper_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  required_paper_id uuid NOT NULL REFERENCES public.job_required_papers(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  portal_link_id uuid REFERENCES public.customer_portal_links(id) ON DELETE SET NULL,
  -- The job's picks the day it was proposed, and the picks asked for: one choice a setting, whole.
  from_settings jsonb NOT NULL,
  settings jsonb NOT NULL,
  proposed_by_name text NOT NULL CONSTRAINT job_paper_proposals_named CHECK (btrim(proposed_by_name) <> '' AND char_length(proposed_by_name) <= 120),
  notice_read boolean NOT NULL DEFAULT false,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'waiting' CONSTRAINT job_paper_proposals_state_known CHECK (state IN ('waiting', 'taken', 'declined', 'overtaken')),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_by_name text,
  decided_at timestamptz,
  decline_why text,
  -- The row that holds the taken picks: the same row, or the new version when somebody had signed.
  taken_as uuid REFERENCES public.job_required_papers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS job_paper_proposals_row_idx ON public.job_paper_proposals (required_paper_id, proposed_at DESC);
CREATE INDEX IF NOT EXISTS job_paper_proposals_taken_as_idx ON public.job_paper_proposals (taken_as) WHERE taken_as IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_paper_proposals_customer_idx ON public.job_paper_proposals (customer_id, proposed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS job_paper_proposals_one_waiting ON public.job_paper_proposals (required_paper_id) WHERE state = 'waiting';

COMMENT ON TABLE public.job_paper_proposals IS
  'Punch list #389 step 6: a GC''s proposal of stricter settings for a paper a job requires. It changes no paper. state is waiting, taken, declined or overtaken (a newer proposal, a change of the paper''s settings, or the paper coming off the job). Written only by job_paper_propose (the service key, for the portal function), job_paper_proposal_decide (the office) and the trigger on job_required_papers. The office reads it.';
COMMENT ON COLUMN public.job_paper_proposals.from_settings IS 'The job''s picks the day the proposal was made.';
COMMENT ON COLUMN public.job_paper_proposals.settings IS 'The picks the GC asks for: one choice a setting, each as strict as the job''s or stricter.';
COMMENT ON COLUMN public.job_paper_proposals.proposed_by_name IS 'The name the GC typed on their page.';
COMMENT ON COLUMN public.job_paper_proposals.decline_why IS 'The office''s reason for a decline, which the GC reads on their page.';
COMMENT ON COLUMN public.job_paper_proposals.taken_as IS 'The job_required_papers row that holds the taken picks.';

ALTER TABLE public.job_paper_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_paper_proposals_select ON public.job_paper_proposals;
CREATE POLICY job_paper_proposals_select ON public.job_paper_proposals FOR SELECT TO authenticated
  USING ((SELECT public.is_office_staff()));
REVOKE ALL ON public.job_paper_proposals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.job_paper_proposals FROM authenticated;

-- 2) A change of a paper's settings, or the paper coming off the job, overtakes the proposal that waits on it.
CREATE OR REPLACE FUNCTION public.job_paper_proposals_overtaken()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL) OR NEW.settings IS DISTINCT FROM OLD.settings THEN
    UPDATE public.job_paper_proposals
      SET state = 'overtaken', decided_at = clock_timestamp()
      WHERE required_paper_id = NEW.id AND state = 'waiting';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.job_paper_proposals_overtaken() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_paper_proposals_overtaken ON public.job_required_papers;
CREATE TRIGGER job_paper_proposals_overtaken
  AFTER UPDATE OF settings, removed_at ON public.job_required_papers
  FOR EACH ROW
  EXECUTE FUNCTION public.job_paper_proposals_overtaken();

-- 3) The GC proposes. The portal function has already read the link; this holds the job to the customer as its GC.
CREATE OR REPLACE FUNCTION public.job_paper_propose(
  p_required_paper_id uuid,
  p_customer_id uuid,
  p_link_id uuid,
  p_settings jsonb,
  p_name text,
  p_notice_read boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.job_required_papers%ROWTYPE;
  v_def jsonb;
  v_picks jsonb;
  v_problem text;
  v_change text;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_now timestamptz := clock_timestamp();
  v_id uuid;
BEGIN
  -- The row is the lock, as it is for a change of settings and for a signature.
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF p_customer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = v_row.job_id AND j.gc_customer_id = p_customer_id) THEN
    RAISE EXCEPTION 'That job is not one you are the general contractor on.' USING ERRCODE = '42501';
  END IF;
  IF v_row.settings IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. It has none to propose.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.settings_def INTO v_def FROM public.contract_template_documents d WHERE d.id = v_row.book_document_id;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'That paper is no longer built from settings. Ask our office.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A proposal goes with its settings.' USING ERRCODE = 'P0001';
  END IF;
  v_picks := public.job_paper_picks_clean(v_def, p_settings);
  v_problem := public.contract_paper_picks_problem(v_def, v_picks);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
  END IF;
  v_change := public.contract_paper_picks_change(v_def, v_row.settings, v_picks);
  IF v_change = 'same' THEN
    RAISE EXCEPTION 'Nothing is stricter yet. Move a topic to a stricter stop first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_change <> 'stricter' THEN
    RAISE EXCEPTION 'A proposal can only make the paper stricter.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Type your name first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.contract_paper_has_notice(v_def) AND NOT coalesce(p_notice_read, false) THEN
    RAISE EXCEPTION 'Tick the box under the notice first.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.job_paper_proposals x WHERE x.customer_id = p_customer_id AND x.proposed_at > v_now - interval '1 hour') >= 6 THEN
    RAISE EXCEPTION 'That is many proposals in one hour. Try again later, or call our office.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.job_paper_proposals SET state = 'overtaken', decided_at = v_now WHERE required_paper_id = v_row.id AND state = 'waiting';
  INSERT INTO public.job_paper_proposals (required_paper_id, job_id, customer_id, portal_link_id, from_settings, settings, proposed_by_name, notice_read, proposed_at)
  VALUES (v_row.id, v_row.job_id, p_customer_id, p_link_id, v_row.settings, v_picks, v_name, coalesce(p_notice_read, false), v_now)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'proposed_at', v_now);
END;
$$;

COMMENT ON FUNCTION public.job_paper_propose(uuid, uuid, uuid, jsonb, text, boolean) IS
  'Punch list #389 step 6: a GC proposes stricter settings for a paper a job requires, for the portal function. It holds the job to the customer as its GC, refuses picks that loosen any topic or change nothing, asks for a typed name and the notice''s tick where the list has a notice, and takes six an hour from one customer. A proposal already waiting on the paper is overtaken. It changes no paper. Answers {id, proposed_at}. The service key only.';
REVOKE ALL ON FUNCTION public.job_paper_propose(uuid, uuid, uuid, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_paper_propose(uuid, uuid, uuid, jsonb, text, boolean) TO service_role;

-- 4) The office takes it or declines. Guarded as job_paper_set_settings is, which a take runs.
CREATE OR REPLACE FUNCTION public.job_paper_proposal_decide(p_proposal_id uuid, p_take boolean, p_why text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.job_paper_proposals%ROWTYPE;
  v_row public.job_required_papers%ROWTYPE;
  v_name text;
  v_now timestamptz := clock_timestamp();
  v_saved jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to answer a proposal.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a proposal.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  IF p_take IS NULL THEN
    RAISE EXCEPTION 'Take it or decline it.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_p FROM public.job_paper_proposals x WHERE x.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That proposal is gone.' USING ERRCODE = 'P0001';
  END IF;
  -- The paper's row first, as every other change of it locks, then the proposal.
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = v_p.required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_p FROM public.job_paper_proposals x WHERE x.id = p_proposal_id FOR UPDATE;
  IF v_p.state <> 'waiting' THEN
    RAISE EXCEPTION 'That proposal is no longer waiting.' USING ERRCODE = 'P0001';
  END IF;
  SELECT nullif(btrim(u.name), '') INTO v_name FROM public.users u WHERE u.id = v_uid;

  IF NOT p_take THEN
    UPDATE public.job_paper_proposals
      SET state = 'declined', decided_by = v_uid, decided_by_name = v_name, decided_at = v_now,
          decline_why = nullif(left(btrim(coalesce(p_why, '')), 500), '')
      WHERE id = v_p.id;
    RETURN jsonb_build_object('proposal', 'declined', 'id', v_row.id);
  END IF;

  -- Marked first, so the change of settings below does not overtake it. A refusal there undoes the mark with it.
  UPDATE public.job_paper_proposals
    SET state = 'taken', decided_by = v_uid, decided_by_name = v_name, decided_at = v_now
    WHERE id = v_p.id;
  v_saved := public.job_paper_set_settings(v_row.id, v_p.settings, v_row.fields);
  UPDATE public.job_paper_proposals SET taken_as = (v_saved ->> 'id')::uuid WHERE id = v_p.id;
  RETURN v_saved || jsonb_build_object('proposal', 'taken');
END;
$$;

COMMENT ON FUNCTION public.job_paper_proposal_decide(uuid, boolean, text) IS
  'Punch list #389 step 6: the office answers a GC''s proposal that waits. A decline keeps the reason, which the GC reads. A take saves the proposed picks through job_paper_set_settings with the blanks the job already has: in place while nobody has signed, and as a new version that everyone signs again once somebody has. Answers {proposal: declined, id} or what job_paper_set_settings answers with proposal: taken. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_proposal_decide(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_proposal_decide(uuid, boolean, text) TO authenticated;

-- 5) What a GC reads, as 20261124170000 left it. What is new, for the portal function alone to shape: picks and basis,
-- the row's own; def, the Book entry's settings list; and proposal, the last proposal by the job's GC on this row or
-- taken as it, as {state, by_name, proposed_at, decided_at, why, settings}, or null.
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
    IF v_papers IS NOT NULL THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('job_id', v_job, 'papers', v_papers));
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.job_papers_gc_page(uuid[]) IS
  'Punch list #389, steps 5 and 6: what a GC reads about the papers a job requires, for the customer-portal function. Answers [{job_id, papers: [{id, paper_name, settings_revision, view, level: {key, label, aligned_with} or null, said: [{key, label, choice, says, out}], signed, total, businesses: [{name, people, signed, signed_on}], signers: [{name, business, signed_on}], picks, basis, def, proposal: {state, by_name, proposed_at, decided_at, why, settings} or null}]}] for each job asked about that requires a paper built from settings. signed and total count the office''s own roster. view is the office''s setting for the row: under ''count'' businesses is empty, and signers is filled only under ''names''. picks, basis and def (the Book entry''s whole settings list) are for the portal function to shape the GC''s sliders from; it hands the page only names, plain words and the notice. proposal is the last one by the job''s GC on the row, or taken as it. The service key only.';
REVOKE ALL ON FUNCTION public.job_papers_gc_page(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_papers_gc_page(uuid[]) TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
