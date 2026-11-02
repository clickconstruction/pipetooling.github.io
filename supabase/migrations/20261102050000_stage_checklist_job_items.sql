SET lock_timeout = '3s';

-- Stage checklists as documents on the job (punch list #237, PR 1, v2.6328). The office's questions live in
-- stage_checklist_templates once per stage kind (20261029210000_stage_checklists.sql, #164). The owner, 2026-11-01:
-- a superintendent adds items to a checklist, the office adds items and reads the checklist on the job's Documents
-- tab, and every answer stamps the row with the person's name and the time. This migration gives the questions a
-- second scope: a row for one job's stage, beside the company's rows. The answers table, the strict rule and the
-- sheet change nothing but their grouping (the card's call: items on the job are question rows with a job and a
-- stage, so an answer references one table and a job item counts toward ready like a company question).
--
--   1. job_id + fixture_id on stage_checklist_templates: NULL on the company's rows; both set on an item added for
--      one job's stage (jobs_ledger_fixtures), and a trigger holds the stage to that job. created_by_name is the
--      adder's name for the stamp the sheet shows (*Added by Pat Sample · Nov 1*); retired_by is who took the item
--      off (retired_at already says when). A job item taken off is retired, never deleted, so an answer it already
--      has keeps its words.
--   2. The gates: the company's rows read as before (everyone signed in); a job's items are read by whoever may
--      stamp the job's stages, can_report_stage_progress(job_id). A job item is added by the office
--      (is_master_or_dev() OR is_assistant()) or by a superintendent on their own job, in their own name
--      (superintendent_report_job_anchor_allowed(job_id): the assigned project, or the job's team). A job item is
--      retired by the office or by the person who added it, and retiring is the adder's only write: the row must
--      come out retired, by them, so an update can never move a live item onto a job that is not theirs. The
--      company's rows keep the office's write policies. The technician answers and notes; they do not add (the
--      card's call).
--
-- Additive and idempotent; no table is created, so no fence call: the read-only and twin fences on this table are
-- restrictive policies under their own names, and dropping the three gates below leaves them standing. The client
-- ahead of the push reads the new columns by name, so push right after the merge (check:calls-ahead cannot see a column).

ALTER TABLE public.stage_checklist_templates
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fixture_id uuid REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '' CHECK (length(created_by_name) <= 120),
  ADD COLUMN IF NOT EXISTS retired_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- A job item names its job and its stage together; the company's rows name neither.
ALTER TABLE public.stage_checklist_templates DROP CONSTRAINT IF EXISTS stage_checklist_templates_job_scope;
ALTER TABLE public.stage_checklist_templates
  ADD CONSTRAINT stage_checklist_templates_job_scope CHECK ((job_id IS NULL) = (fixture_id IS NULL));

CREATE INDEX IF NOT EXISTS stage_checklist_templates_job_live_idx
  ON public.stage_checklist_templates (job_id, fixture_id, sort_order) WHERE job_id IS NOT NULL AND retired_at IS NULL;

COMMENT ON TABLE public.stage_checklist_templates IS 'A checklist per stage (#164): the office''s questions for a stage kind (rough_in, top_out, trim_set), one per row in sort_order, job_id and fixture_id NULL. Since #237 PR 1 a row with job_id and fixture_id set is an item added for one job''s stage by the office or the job''s superintendent; it counts toward ready like a company question. A question taken off is retired, never deleted, so its answers keep their words. A kind with no live question and a stage with no job item has no checklist.';
COMMENT ON COLUMN public.stage_checklist_templates.job_id IS 'The job an item was added for (#237 PR 1); NULL on the company''s questions. Set together with fixture_id.';
COMMENT ON COLUMN public.stage_checklist_templates.fixture_id IS 'The job stage (jobs_ledger_fixtures) an item was added for (#237 PR 1); NULL on the company''s questions. The sheet shows these under *Added for this job*.';
COMMENT ON COLUMN public.stage_checklist_templates.created_by_name IS 'The adder''s name as the sheet stamps it: *Added by Pat Sample · Nov 1*.';
COMMENT ON COLUMN public.stage_checklist_templates.retired_by IS 'Who took a job item off; retired_at says when. NULL on a company question: the Settings editor retires those without naming anyone.';

-- The stage must be on the job the item names, or an item added on one job would count on another job's stage. A
-- trigger and not a policy: field roles cannot read jobs_ledger_fixtures, and the rule holds for the office too.
CREATE OR REPLACE FUNCTION public.stage_checklist_item_stage_on_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger_fixtures f WHERE f.id = NEW.fixture_id AND f.job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'That stage is not on this job.';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_item_stage_on_job() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_templates_stage_on_job ON public.stage_checklist_templates;
CREATE TRIGGER stage_checklist_templates_stage_on_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.stage_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_item_stage_on_job();

-- 2. The gates.
DROP POLICY IF EXISTS stage_checklist_templates_select ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_select ON public.stage_checklist_templates FOR SELECT TO authenticated
  USING (job_id IS NULL OR public.can_report_stage_progress(job_id));

DROP POLICY IF EXISTS stage_checklist_templates_insert ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_insert ON public.stage_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid() AND public.is_superintendent() AND public.superintendent_report_job_anchor_allowed(job_id))
  );

DROP POLICY IF EXISTS stage_checklist_templates_update ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_update ON public.stage_checklist_templates FOR UPDATE TO authenticated
  USING (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid() AND retired_at IS NOT NULL AND retired_by = auth.uid())
  );
