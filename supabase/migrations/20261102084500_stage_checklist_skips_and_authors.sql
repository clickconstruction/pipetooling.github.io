SET lock_timeout = '3s';

-- What the walks settled for stage checklists (punch list #237 PR 1b, v2.6347), on top of the job items of
-- 20261102050000_stage_checklist_job_items.sql. Every job is a little different, so a company question can be skipped on
-- one job with a reason; a check for one job can be added to the company's list, one at a time; a check can name the plan
-- sheet it came from and why it is there; the checks added for a job go in the order someone puts them; and the
-- estimator authors too, on the jobs he priced.
--
--   1. plan_sheet and why on stage_checklist_templates: what the add box takes beside the words. promoted_from: the job
--      item a company row was promoted from, so PR 4's source line can say which job a list came from.
--   2. stage_checklist_may_author(job): who authors on a job, in one place. The office anywhere; a superintendent on their
--      own job (superintendent_report_job_anchor_allowed, the assigned project or the job's team); an estimator on a job
--      they priced (jobs_ledger.bid_id to bids.estimator_id). Never a digital twin. The client reads it to draw the
--      presses, so a superintendent or an estimator meets no press the database would refuse.
--   3. The add gate: the office as before, or an author in their own name. An adder's only update is the retire, and now it
--      is held to that. PR 1's gate let the adder of a retired item rewrite it, and let a retire rewrite the words in the
--      same statement, under the answer the item keeps. The policy now wants a live row, and a trigger compares the row
--      before and after, which a policy cannot.
--   4. stage_checklist_skips: a company question left off one job's stage, with who and why. A live row hides the question
--      on that stage alone; the company's list stays whole. Put it back closes the row, never deletes it, so the record of
--      what was skipped stands, and the two columns it writes are the only ones an update may touch. Authors skip and put
--      back; whoever may stamp the job's stages reads.
--   5. reorder_stage_checklist_items(stage, ids): the job's own checks in the order given, one transaction. SECURITY
--      DEFINER, since an adder's own update is the retire alone and a superintendent moves a check the office added. It
--      asks stage_checklist_may_author, which refuses a twin; the read-only statement trigger fires inside it.
--   6. promote_stage_checklist_item(item): the office adds one job item to the company's list, one transaction. The card's
--      call: the row is copied to the company's scope and the job's row retired. Its answer moves to the copy, or the
--      stage this job already answered would read not ready. The plan sheet and the why stay on the job's row: they were
--      written for this job's plans, and the company's row asks every job. SECURITY INVOKER, so the office's own policies
--      and both fences hold.
--
-- Additive and idempotent. One table is created, so the file ends with the three fence calls, which lock only that table.
-- The client reads the new columns and the new table by name, so the deploy waits for the push (check:calls-ahead sees the
-- table and the three functions; it cannot see the two columns).

-- 1. What the add box takes beside the words.
ALTER TABLE public.stage_checklist_templates
  ADD COLUMN IF NOT EXISTS plan_sheet text CHECK (plan_sheet IS NULL OR length(plan_sheet) <= 40),
  ADD COLUMN IF NOT EXISTS why text CHECK (why IS NULL OR length(why) <= 80),
  ADD COLUMN IF NOT EXISTS promoted_from uuid REFERENCES public.stage_checklist_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stage_checklist_templates.plan_sheet IS 'The plan sheet or detail a check came from, as typed: P-201 detail 4. The sheet draws it as a chip that opens the job''s Plans folder (#237 PR 1b).';
COMMENT ON COLUMN public.stage_checklist_templates.why IS 'Why a check is here, in one line: the slab pours Thursday (#237 PR 1b).';
COMMENT ON COLUMN public.stage_checklist_templates.promoted_from IS 'On a company row: the job item it was added to the company''s list from, retired since (#237 PR 1b). NULL on a question the office wrote.';

-- 2. Who authors on a job.
CREATE OR REPLACE FUNCTION public.stage_checklist_may_author(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.is_digital_twin()
    AND (
      public.is_master_or_dev()
      OR public.is_assistant()
      OR (public.is_superintendent() AND public.superintendent_report_job_anchor_allowed(p_job_id))
      OR (
        public.is_estimator()
        AND EXISTS (
          SELECT 1
          FROM public.jobs_ledger j
          JOIN public.bids b ON b.id = j.bid_id
          WHERE j.id = p_job_id AND b.estimator_id = auth.uid()
        )
      )
    );
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_may_author(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_checklist_may_author(uuid) TO authenticated;
COMMENT ON FUNCTION public.stage_checklist_may_author(uuid) IS 'Who authors a job''s stage checklist (#237 PR 1b): the office, a superintendent on their own job, an estimator on a job they priced. Never a digital twin. The add, the skip and the reorder all ask it, and the client reads it to draw those presses.';

-- 3. The add gate and the adder's retire. Reading a job's items stays can_report_stage_progress (the estimator already reads
--    them). The office's own branches are as 20261102050000 wrote them.
DROP POLICY IF EXISTS stage_checklist_templates_insert ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_insert ON public.stage_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid() AND public.stage_checklist_may_author(job_id))
  );
DROP POLICY IF EXISTS stage_checklist_templates_update ON public.stage_checklist_templates;
CREATE POLICY stage_checklist_templates_update ON public.stage_checklist_templates FOR UPDATE TO authenticated
  USING (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid() AND retired_at IS NULL)
  )
  WITH CHECK (
    public.is_master_or_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND created_by = auth.uid() AND retired_at IS NOT NULL AND retired_by = auth.uid())
  );

-- A policy cannot compare a row before and after, so this holds the adder to the retire: the row comes out the same but for
-- who took it off and when. The office is exempt, and reorder_stage_checklist_items runs as the table's owner.
CREATE OR REPLACE FUNCTION public.stage_checklist_item_adder_only_retires()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NOT (public.is_master_or_dev() OR public.is_assistant())
     AND (to_jsonb(NEW) - ARRAY['retired_at', 'retired_by', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['retired_at', 'retired_by', 'updated_at']) THEN
    RAISE EXCEPTION 'The person who added a check only takes it off.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_item_adder_only_retires() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_templates_adder_only_retires ON public.stage_checklist_templates;
CREATE TRIGGER stage_checklist_templates_adder_only_retires
  BEFORE UPDATE ON public.stage_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_item_adder_only_retires();

-- 4. The skips.
CREATE TABLE IF NOT EXISTS public.stage_checklist_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.stage_checklist_templates(id) ON DELETE CASCADE,
  why text NOT NULL CHECK (length(btrim(why)) BETWEEN 3 AND 200),
  skipped_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  skipped_by_name text NOT NULL DEFAULT '' CHECK (length(skipped_by_name) <= 120),
  skipped_at timestamptz NOT NULL DEFAULT now(),
  put_back_at timestamptz,
  put_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS stage_checklist_skips_one_live_idx ON public.stage_checklist_skips (fixture_id, question_id) WHERE put_back_at IS NULL;
CREATE INDEX IF NOT EXISTS stage_checklist_skips_job_live_idx ON public.stage_checklist_skips (job_id) WHERE put_back_at IS NULL;
COMMENT ON TABLE public.stage_checklist_skips IS 'A company question left off one job''s stage (#237 PR 1b), with who and why. A row with put_back_at NULL hides the question on that stage alone: it leaves the list and the count, and the company''s list stays whole. An answer the question already had stays in its table and reads again if the question is put back. Put it back closes the row and never deletes it.';

-- A skip names a stage on its job and a live question on the company's list: a check added for one job is taken off, not
-- skipped. A trigger and not a policy: field roles cannot read jobs_ledger_fixtures, and the rule holds for the office too.
CREATE OR REPLACE FUNCTION public.stage_checklist_skip_names_a_company_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_fixtures f WHERE f.id = NEW.fixture_id AND f.job_id = NEW.job_id) THEN
    RAISE EXCEPTION 'That stage is not on this job.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stage_checklist_templates t WHERE t.id = NEW.question_id AND t.job_id IS NULL AND t.retired_at IS NULL) THEN
    RAISE EXCEPTION 'Only a question on the company''s list is skipped on a job.';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_skip_names_a_company_question() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_skips_names_a_company_question ON public.stage_checklist_skips;
CREATE TRIGGER stage_checklist_skips_names_a_company_question
  BEFORE INSERT ON public.stage_checklist_skips
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_skip_names_a_company_question();

ALTER TABLE public.stage_checklist_skips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stage_checklist_skips_select ON public.stage_checklist_skips;
CREATE POLICY stage_checklist_skips_select ON public.stage_checklist_skips FOR SELECT TO authenticated
  USING (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS stage_checklist_skips_insert ON public.stage_checklist_skips;
CREATE POLICY stage_checklist_skips_insert ON public.stage_checklist_skips FOR INSERT TO authenticated
  WITH CHECK (skipped_by = auth.uid() AND put_back_at IS NULL AND public.stage_checklist_may_author(job_id));
-- A live row's only update is the put back, in the presser's own name. A policy cannot compare a row before and after, so
-- the grant holds the update to the put back's two columns, and the reason and the stamp stand as they were written.
DROP POLICY IF EXISTS stage_checklist_skips_update ON public.stage_checklist_skips;
CREATE POLICY stage_checklist_skips_update ON public.stage_checklist_skips FOR UPDATE TO authenticated
  USING (put_back_at IS NULL AND public.stage_checklist_may_author(job_id))
  WITH CHECK (put_back_at IS NOT NULL AND put_back_by = auth.uid() AND public.stage_checklist_may_author(job_id));
REVOKE UPDATE ON public.stage_checklist_skips FROM anon, authenticated;
GRANT UPDATE (put_back_at, put_back_by) ON public.stage_checklist_skips TO authenticated;
DROP POLICY IF EXISTS stage_checklist_skips_delete ON public.stage_checklist_skips;
CREATE POLICY stage_checklist_skips_delete ON public.stage_checklist_skips FOR DELETE TO authenticated
  USING (public.is_dev());

-- 5. The order of a stage's own checks. Ids the list does not name keep their order after the ones it does, and ids from
--    another stage or job match nothing, so a list read a moment ago can never move another job's check or lose a new one.
CREATE OR REPLACE FUNCTION public.reorder_stage_checklist_items(p_fixture_id uuid, p_item_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
  v_moved integer;
BEGIN
  SELECT f.job_id INTO v_job FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'That stage is not on a job.';
  END IF;
  IF NOT public.stage_checklist_may_author(v_job) THEN
    RAISE EXCEPTION 'Only the office, the job''s superintendent or the estimator who priced it moves a check.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.stage_checklist_templates t WHERE t.fixture_id = p_fixture_id AND t.job_id = v_job AND t.retired_at IS NULL ORDER BY t.id FOR UPDATE;
  UPDATE public.stage_checklist_templates t
     SET sort_order = r.place, updated_at = now()
    FROM (
      SELECT i.id, (row_number() OVER (ORDER BY COALESCE(array_position(p_item_ids, i.id), 2147483647), i.sort_order, i.created_at, i.id))::integer AS place
      FROM public.stage_checklist_templates i
      WHERE i.fixture_id = p_fixture_id AND i.job_id = v_job AND i.retired_at IS NULL
    ) r
   WHERE t.id = r.id AND t.sort_order IS DISTINCT FROM r.place;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END
$$;
REVOKE ALL ON FUNCTION public.reorder_stage_checklist_items(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_stage_checklist_items(uuid, uuid[]) TO authenticated;
COMMENT ON FUNCTION public.reorder_stage_checklist_items(uuid, uuid[]) IS 'Puts one stage''s own checks in the order given (#237 PR 1b), for whoever may author on the job. Returns how many rows moved.';

-- 6. One check onto the company's list. The retire comes first: it locks the row, a second press then finds it retired,
--    and the read-only statement trigger answers before anything is written.
CREATE OR REPLACE FUNCTION public.promote_stage_checklist_item(p_item_id uuid)
RETURNS public.stage_checklist_templates
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item public.stage_checklist_templates;
  v_company public.stage_checklist_templates;
BEGIN
  IF public.is_digital_twin() OR NOT (public.is_master_or_dev() OR public.is_assistant()) THEN
    RAISE EXCEPTION 'Only the office adds a check to the company''s list.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.stage_checklist_templates
     SET retired_at = now(), retired_by = auth.uid(), updated_at = now()
   WHERE id = p_item_id AND job_id IS NOT NULL AND retired_at IS NULL
  RETURNING * INTO v_item;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That check is no longer on the job.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.stage_checklist_templates t
    WHERE t.job_id IS NULL AND t.retired_at IS NULL AND t.stage_kind = v_item.stage_kind AND lower(btrim(t.words)) = lower(btrim(v_item.words))
  ) THEN
    RAISE EXCEPTION 'The company''s list already asks that.';
  END IF;
  INSERT INTO public.stage_checklist_templates (stage_kind, sort_order, words, asks_photo, created_by, promoted_from)
  VALUES (
    v_item.stage_kind,
    (SELECT COALESCE(MAX(t.sort_order), 0) + 1 FROM public.stage_checklist_templates t WHERE t.job_id IS NULL AND t.retired_at IS NULL AND t.stage_kind = v_item.stage_kind),
    v_item.words,
    v_item.asks_photo,
    auth.uid(),
    v_item.id
  )
  RETURNING * INTO v_company;
  UPDATE public.stage_checklist_answers SET question_id = v_company.id, updated_at = now() WHERE question_id = v_item.id;
  RETURN v_company;
END
$$;
REVOKE ALL ON FUNCTION public.promote_stage_checklist_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_stage_checklist_item(uuid) TO authenticated;
COMMENT ON FUNCTION public.promote_stage_checklist_item(uuid) IS 'Adds one job item to the company''s list (#237 PR 1b), the office alone: copies its words and its photo ask to a new company row, retires the job''s row and moves the job''s answer to the copy. Returns the company''s row.';

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
