SET lock_timeout = '3s';

-- A stage check sent to Dispatch closes itself when the check is settled (punch list #245 PR 2a, v2.6494). PR 1
-- (20261102113000_stage_check_dispatch.sql) put the stage and the check on the request in fixture_id and
-- checklist_question_id. Three things settle a check on the sheet: an answer (Yes, No or Not here, by the crew or by
-- Dispatch under their own name), a skip on this job, and a take off (a job item retired, or a company question retired
-- for every job). Each closes every open stage_check request on that stage and check, in the settler's name, with a note
-- that says how, so nobody closes by hand what the row already settled and the inbox never holds a row the crew answered.
--
-- The crew cannot update dispatch_requests (dispatch_requests_update_dispatch_or_dev: the dispatch group and a dev), so
-- the close runs in SECURITY DEFINER trigger functions, search_path pinned, owned by postgres. The guard trigger
-- dispatch_requests_guard_update (baseline) admits it: it holds the content columns and leaves status, closed_at,
-- closed_by_user_id and closed_note alone.
--
--   1. stage_check_close_settled(fixture, question, who, note): the one close the three triggers share. A NULL stage
--      closes the request on every stage (a company question taken off), otherwise only that stage's.
--   2. stage_check_settler_name(name, user): the stamped name, else the user's name, else "someone".
--   3. On stage_checklist_answers, after an insert or an update of pick or answered_at with a pick on the row: a note
--      save or a photo alone settles nothing, and a pick already there re-pressed still counts (answered_at moves).
--      Note: *Answered on the sheet by Luis Ortega · Yes*.
--   4. On stage_checklist_skips, after an insert of a live skip. Note: *Skipped on this job by Sal Super: the reason*.
--   5. On stage_checklist_templates, after retired_at is set: a job item closes its stage's request, *Taken off by Sal
--      Super*; a company question closes the request on every stage, *Taken off the company's list by Dee Dev*. A job
--      item promoted to the company's list is retired by promote_stage_checklist_item, which now says so first through
--      the transaction-local setting stage_check.settle_note, so that close reads *Added to the company's list by Dee
--      Dev* and not as a take off.
--
-- Additive and idempotent. No table is created, so no fence call. Nothing in the client reads a new name, so the push
-- can follow the merge at any time; until it lands a settled check leaves its request open for Dispatch to close by hand,
-- as PR 1 shipped.

-- 1. The close.
CREATE OR REPLACE FUNCTION public.stage_check_close_settled(p_fixture_id uuid, p_question_id uuid, p_closed_by uuid, p_note text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed integer;
BEGIN
  UPDATE public.dispatch_requests r
     SET status = 'closed',
         closed_at = now(),
         closed_by_user_id = p_closed_by,
         closed_note = left(p_note, 2000)
   WHERE r.pending_action = 'stage_check'
     AND r.status = 'open'
     AND r.checklist_question_id = p_question_id
     AND (p_fixture_id IS NULL OR r.fixture_id = p_fixture_id);
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END
$$;
REVOKE ALL ON FUNCTION public.stage_check_close_settled(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.stage_check_close_settled(uuid, uuid, uuid, text) IS 'Closes every open stage_check dispatch request on a stage and check (punch list #245 PR 2a), in the settler''s name with the note that says how; a NULL stage means every stage. Called by the three settle triggers only.';

-- 2. The settler's name.
CREATE OR REPLACE FUNCTION public.stage_check_settler_name(p_name text, p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(btrim(COALESCE(p_name, '')), ''),
    (SELECT NULLIF(btrim(u.name), '') FROM public.users u WHERE u.id = p_user),
    'someone'
  );
$$;
REVOKE ALL ON FUNCTION public.stage_check_settler_name(text, uuid) FROM PUBLIC, anon, authenticated;

-- 3. An answer.
CREATE OR REPLACE FUNCTION public.stage_check_closes_on_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_who uuid;
BEGIN
  IF NEW.pick IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pick IS NOT DISTINCT FROM NEW.pick AND OLD.answered_at IS NOT DISTINCT FROM NEW.answered_at THEN
    RETURN NEW;
  END IF;
  v_who := COALESCE(NEW.answered_by, auth.uid());
  PERFORM public.stage_check_close_settled(
    NEW.fixture_id,
    NEW.question_id,
    v_who,
    'Answered on the sheet by ' || public.stage_check_settler_name(NEW.answered_by_name, v_who) || ' · '
      || CASE NEW.pick WHEN 'yes' THEN 'Yes' WHEN 'no' THEN 'No' ELSE 'Not here' END
  );
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_check_closes_on_answer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_answers_close_stage_check ON public.stage_checklist_answers;
CREATE TRIGGER stage_checklist_answers_close_stage_check
  AFTER INSERT OR UPDATE OF pick, answered_at ON public.stage_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.stage_check_closes_on_answer();

-- 4. A skip.
CREATE OR REPLACE FUNCTION public.stage_check_closes_on_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_who uuid;
BEGIN
  IF NEW.put_back_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_who := COALESCE(NEW.skipped_by, auth.uid());
  PERFORM public.stage_check_close_settled(
    NEW.fixture_id,
    NEW.question_id,
    v_who,
    'Skipped on this job by ' || public.stage_check_settler_name(NEW.skipped_by_name, v_who) || ': ' || btrim(NEW.why)
  );
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_check_closes_on_skip() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_skips_close_stage_check ON public.stage_checklist_skips;
CREATE TRIGGER stage_checklist_skips_close_stage_check
  AFTER INSERT ON public.stage_checklist_skips
  FOR EACH ROW EXECUTE FUNCTION public.stage_check_closes_on_skip();

-- 5. A take off.
CREATE OR REPLACE FUNCTION public.stage_check_closes_on_retire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_who uuid;
  v_name text;
  v_said text;
BEGIN
  IF OLD.retired_at IS NOT NULL OR NEW.retired_at IS NULL THEN
    RETURN NEW;
  END IF;
  v_who := COALESCE(NEW.retired_by, auth.uid());
  v_name := public.stage_check_settler_name(NULL, v_who);
  -- promote_stage_checklist_item says what its retire is before it runs; anything else is a take off.
  v_said := NULLIF(btrim(COALESCE(current_setting('stage_check.settle_note', true), '')), '');
  IF NEW.job_id IS NOT NULL THEN
    PERFORM public.stage_check_close_settled(NEW.fixture_id, NEW.id, v_who, COALESCE(v_said, 'Taken off') || ' by ' || v_name);
  ELSE
    PERFORM public.stage_check_close_settled(NULL, NEW.id, v_who, 'Taken off the company''s list by ' || v_name);
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_check_closes_on_retire() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stage_checklist_templates_close_stage_check ON public.stage_checklist_templates;
CREATE TRIGGER stage_checklist_templates_close_stage_check
  AFTER UPDATE OF retired_at ON public.stage_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.stage_check_closes_on_retire();

-- The promote (20261102084500_stage_checklist_skips_and_authors.sql), restated verbatim but for the setting it leaves
-- for the retire trigger around its own UPDATE: the job's row is retired because it moved to the company's list, and
-- the request on it closes saying so.
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
  PERFORM set_config('stage_check.settle_note', 'Added to the company''s list', true);
  UPDATE public.stage_checklist_templates
     SET retired_at = now(), retired_by = auth.uid(), updated_at = now()
   WHERE id = p_item_id AND job_id IS NOT NULL AND retired_at IS NULL
  RETURNING * INTO v_item;
  PERFORM set_config('stage_check.settle_note', '', true);
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
COMMENT ON FUNCTION public.promote_stage_checklist_item(uuid) IS 'Adds one job item to the company''s list (#237 PR 1b), the office alone: copies its words and its photo ask to a new company row, retires the job''s row and moves the job''s answer to the copy. Returns the company''s row. Since #245 PR 2a it says so to the retire trigger first, so a stage check open on the item closes as added to the company''s list, not taken off.';

COMMENT ON COLUMN public.dispatch_requests.checklist_question_id IS 'The check a stage_check request is about (punch list #245): the sheet opens with that row open, and the request closes itself when the row is settled (PR 2a: answered, skipped on the job, or taken off, each with a note that says how). NULL on every other request.';
