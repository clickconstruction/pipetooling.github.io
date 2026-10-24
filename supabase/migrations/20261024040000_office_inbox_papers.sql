SET lock_timeout = '3s';

-- Office inbox papers (v2.5815, punch list #158): Quickfill's Physical inbox station as a
-- clarify deck in GTD's shape. The tray on the assistant's desk used to be one free box
-- retyped every morning (six months of marks with the same seven words). Now a paper that
-- takes more than two minutes is typed once with the day it came, and leaves the deck on one
-- press: done, trash, filed (where), a Checklist task, a dispatch or estimator request,
-- waiting for someone (until a day), someday, or a routine (a repeating Checklist task, so
-- the kind stops arriving). The station's count is the open rows; a waiting or someday
-- row sits in its fold out of the count; a closed row keeps its press as the record.

BEGIN;

CREATE TABLE IF NOT EXISTS public.office_inbox_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0 AND length(title) <= 200),
  detail text CHECK (detail IS NULL OR length(detail) <= 2000),
  came_on date NOT NULL DEFAULT public.app_today(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'waiting', 'someday', 'closed')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('done', 'trash', 'filed', 'task', 'request', 'waiting', 'someday', 'routine')),
  outcome_detail text CHECK (outcome_detail IS NULL OR length(outcome_detail) <= 200),
  follow_up_on date,
  outcome_at timestamptz,
  outcome_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  checklist_item_id uuid REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  dispatch_request_id uuid REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  estimator_request_id uuid REFERENCES public.estimator_requests(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_inbox_papers_state_matches_outcome CHECK (
    (state = 'open' AND outcome IS NULL)
    OR (state = 'waiting' AND outcome = 'waiting')
    OR (state = 'someday' AND outcome = 'someday')
    OR (state = 'closed' AND outcome IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS office_inbox_papers_state_came_on_idx
  ON public.office_inbox_papers (state, came_on);
CREATE INDEX IF NOT EXISTS office_inbox_papers_outcome_at_idx
  ON public.office_inbox_papers (outcome_at);

COMMENT ON TABLE public.office_inbox_papers IS 'Quickfill → Physical inbox as a clarify deck (v2.5815, punch list #158): one row per paper in the office tray that took more than two minutes. state open = on the deck, undecided (the station''s count); waiting / someday = in a fold with its press; closed = left the deck by a press (outcome), kept as the record. A press that made something links it (checklist_item_id, dispatch_request_id, estimator_request_id).';
COMMENT ON COLUMN public.office_inbox_papers.came_on IS 'The day the paper came, in the app''s calendar; the deck''s age counts from it.';
COMMENT ON COLUMN public.office_inbox_papers.outcome IS 'The press that took the paper off the deck: done, trash, filed, task, request, waiting, someday, routine. NULL while open.';
COMMENT ON COLUMN public.office_inbox_papers.outcome_detail IS 'Where it was filed, whom it waits for, or which inbox was asked.';
COMMENT ON COLUMN public.office_inbox_papers.follow_up_on IS 'A waiting paper''s day to check on it.';

DROP TRIGGER IF EXISTS office_inbox_papers_set_updated_at ON public.office_inbox_papers;
CREATE TRIGGER office_inbox_papers_set_updated_at
  BEFORE UPDATE ON public.office_inbox_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.office_inbox_papers ENABLE ROW LEVEL SECURITY;

-- The same office that marks a station up to date (quickfill_section_marks, quickfill_item_snoozes).
DROP POLICY IF EXISTS office_inbox_papers_office_select ON public.office_inbox_papers;
CREATE POLICY office_inbox_papers_office_select ON public.office_inbox_papers
  FOR SELECT TO authenticated USING (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS office_inbox_papers_office_insert ON public.office_inbox_papers;
CREATE POLICY office_inbox_papers_office_insert ON public.office_inbox_papers
  FOR INSERT TO authenticated WITH CHECK (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS office_inbox_papers_office_update ON public.office_inbox_papers;
CREATE POLICY office_inbox_papers_office_update ON public.office_inbox_papers
  FOR UPDATE TO authenticated USING (public.is_dev_or_master_or_assistant()) WITH CHECK (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS office_inbox_papers_office_delete ON public.office_inbox_papers;
CREATE POLICY office_inbox_papers_office_delete ON public.office_inbox_papers
  FOR DELETE TO authenticated USING (public.is_dev_or_master_or_assistant());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_inbox_papers TO authenticated;
GRANT ALL ON public.office_inbox_papers TO service_role;

COMMIT;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
