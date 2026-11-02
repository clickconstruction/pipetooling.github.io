SET lock_timeout = '3s';

-- Papers on a part (punch list #239, the papers train, PR A). The owner, 2026-11-01, on the documents that travel with
-- a set of plans: specs, submittals, schedules, scope and change orders, meeting notes, the owner's task list — "each
-- one needs either an action item or an event description". The read-out's answer: a paper is a document on a part,
-- kept in the same register as the sets, beside the set it goes with; it carries the question it raised and an "owed"
-- state for a paper that has not come; keeping one writes the History line, so nobody types the event twice.
-- See docs/migrations/20261102010000_plan_sets_papers.md.

-- ── the kinds: drawings and papers ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.plan_sets DROP CONSTRAINT IF EXISTS plan_sets_kind_known;
ALTER TABLE public.plan_sets ADD CONSTRAINT plan_sets_kind_known CHECK (kind IN (
  -- drawings: what a part builds from
  'issued', 'addendum', 'bulletin', 'revised', 'permit', 'construction', 'assembled', 'as_built',
  -- papers: what goes with the drawings
  'spec', 'submittal', 'schedule', 'scope', 'change_order', 'meeting_notes', 'task_list', 'report', 'sheet', 'other'
));

-- Who a paper is from: the engineer and a supplier join the GC, the architect and us.
ALTER TABLE public.plan_sets DROP CONSTRAINT IF EXISTS plan_sets_source_known;
ALTER TABLE public.plan_sets ADD CONSTRAINT plan_sets_source_known CHECK (source IN ('gc', 'architect', 'engineer', 'supplier', 'ours'));

-- A paper may have no link yet: '' was already allowed. The set it goes with is marks_up_set_id, which an as-built
-- already uses for the set it marks up; a paper travels with the set it names there.
COMMENT ON COLUMN public.plan_sets.marks_up_set_id IS 'The set this one goes with: an as-built marks it up, a paper travels with it. Null for a set that stands on its own.';

-- ── the ask and the owed state ───────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.plan_sets ADD COLUMN IF NOT EXISTS owed boolean NOT NULL DEFAULT false;
ALTER TABLE public.plan_sets ADD COLUMN IF NOT EXISTS ask_lane text;
ALTER TABLE public.plan_sets ADD COLUMN IF NOT EXISTS ask_request_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_sets_ask_lane_known') THEN
    ALTER TABLE public.plan_sets ADD CONSTRAINT plan_sets_ask_lane_known CHECK (ask_lane IS NULL OR ask_lane IN ('estimators', 'dispatch'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_sets_ask_pair') THEN
    ALTER TABLE public.plan_sets ADD CONSTRAINT plan_sets_ask_pair CHECK ((ask_lane IS NULL) = (ask_request_id IS NULL));
  END IF;
END $$;
COMMENT ON COLUMN public.plan_sets.owed IS 'Papers (#239): true for a paper we are waiting on — no file yet, and the ask says who owes it. False once it comes.';
COMMENT ON COLUMN public.plan_sets.ask_lane IS 'Papers (#239): the lane of the question this paper raised — estimators (estimator_requests) or dispatch (dispatch_requests); null when it asked nothing.';
COMMENT ON COLUMN public.plan_sets.ask_request_id IS 'Papers (#239): the id of the question in its lane''s table (no FK, since there are two tables); the row reads the answer back from it.';

CREATE INDEX IF NOT EXISTS plan_sets_ask ON public.plan_sets (ask_request_id) WHERE ask_request_id IS NOT NULL;

-- ── only a drawing can be what a part builds from ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plan_set_is_drawing(p_kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_kind IN ('issued', 'addendum', 'bulletin', 'revised', 'permit', 'construction', 'assembled', 'as_built')
$$;
COMMENT ON FUNCTION public.plan_set_is_drawing(text) IS 'Papers (#239): true for the kinds a part can build from; false for a paper.';

CREATE OR REPLACE FUNCTION public.plan_parts_current_is_drawing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_kind text;
BEGIN
  IF NEW.current_set_id IS NULL THEN RETURN NEW; END IF;
  SELECT kind INTO v_kind FROM public.plan_sets WHERE id = NEW.current_set_id;
  IF v_kind IS NOT NULL AND NOT public.plan_set_is_drawing(v_kind) THEN
    RAISE EXCEPTION 'A part builds from a set of drawings, not a % — pick a drawing set', v_kind USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plan_parts_current_is_drawing ON public.plan_parts;
CREATE TRIGGER plan_parts_current_is_drawing
  BEFORE INSERT OR UPDATE OF current_set_id ON public.plan_parts
  FOR EACH ROW EXECUTE FUNCTION public.plan_parts_current_is_drawing();

-- ── keeping a paper writes the History line ──────────────────────────────────────────────────────────────────────
-- The site's History (development_history_entries) gains one line the day the paper came (happened_at = came_at), as
-- the person who kept it, with the file's link when there is one and the job it was kept on. A part owned by a job
-- outside any development has no site to write on; the job's own Plans section still shows the paper. SECURITY
-- DEFINER, since the entries table lets only the office keep lines via the app and the writer may be a robot.
CREATE OR REPLACE FUNCTION public.plan_set_paper_words(p public.plan_sets, p_goes_with text, p_replaces text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p.owed THEN 'Owed: ' || p.name || ' from ' || CASE p.source WHEN 'ours' THEN 'us' WHEN 'architect' THEN 'the architect' WHEN 'engineer' THEN 'the engineer' WHEN 'supplier' THEN 'the supplier' ELSE 'the owner' END
      || CASE WHEN p.memo <> '' THEN ' · ' || p.memo ELSE '' END
    ELSE 'Kept ' || replace(p.kind, '_', ' ') || ' ' || p.name || ', '
      || CASE p.source WHEN 'ours' THEN 'ours' WHEN 'architect' THEN 'the architect' WHEN 'engineer' THEN 'the engineer' WHEN 'supplier' THEN 'the supplier' ELSE 'the owner' END
      || CASE WHEN p_goes_with IS NOT NULL THEN ', on ' || p_goes_with ELSE '' END
      || CASE WHEN p.memo <> '' THEN ': ' || p.memo ELSE '' END
      || CASE WHEN p_replaces IS NOT NULL THEN ' · replaces ' || p_replaces ELSE '' END
  END
$$;

CREATE OR REPLACE FUNCTION public.plan_sets_paper_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dev uuid;
  v_goes text;
  v_repl text;
BEGIN
  IF public.plan_set_is_drawing(NEW.kind) THEN RETURN NEW; END IF;
  SELECT COALESCE(pp.development_id, j.development_id) INTO v_dev
  FROM public.plan_parts pp
  LEFT JOIN public.jobs_ledger j ON j.id = pp.job_id
  WHERE pp.id = NEW.part_id;
  IF v_dev IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_goes FROM public.plan_sets WHERE id = NEW.marks_up_set_id;
  SELECT name INTO v_repl FROM public.plan_sets WHERE id = NEW.replaces_set_id;
  INSERT INTO public.development_history_entries (development_id, job_id, happened_at, source, body, author_user_id, via, link_url)
  VALUES (v_dev, NEW.job_id, NEW.came_at, 'note', public.plan_set_paper_words(NEW, v_goes, v_repl), NEW.created_by, 'app', NULLIF(NEW.link, ''));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plan_sets_paper_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plan_sets_paper_history ON public.plan_sets;
CREATE TRIGGER plan_sets_paper_history
  AFTER INSERT ON public.plan_sets
  FOR EACH ROW EXECUTE FUNCTION public.plan_sets_paper_history();

-- ── a crew member may keep a paper on their job's part, as they may an as-built ───────────────────────────────────
DROP POLICY IF EXISTS plan_sets_insert ON public.plan_sets;
CREATE POLICY plan_sets_insert ON public.plan_sets
  FOR INSERT TO authenticated WITH CHECK (
    public.plan_part_can_write(part_id)
    OR (
      (kind = 'as_built' OR NOT public.plan_set_is_drawing(kind)) AND job_id IS NOT NULL
      AND public.plan_part_can_see(part_id)
      AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = plan_sets.job_id AND m.user_id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = plan_sets.job_id AND j.plan_part_id = plan_sets.part_id)
    )
  );
