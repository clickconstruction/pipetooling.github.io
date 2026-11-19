-- v2.7940 — Permit news on Followup: the answer on a line (punch list #401, PR 2).
-- A bid's address can carry a permit, and the app shows it as news on the bid. Until now the only
-- thing a person could do with a line was mark the bid lost, so a line that was true but not yet an
-- outcome, or not about this job at all, stood for good. An answer is kept here, append-only, with
-- who gave it and when:
--   this_job      the permit is on the job we bid. The line is answered and stays on the bid as a chip.
--   not_this_job  the permit is another job on the same address. It is off this bid, for everyone.
--   taken_back    an earlier answer is undone; the line is new again.
-- The newest row per (bid, city, permit number, permit type) is the state; `foldPermitAnswers` in
-- `src/lib/research/bidPermitAnswers.ts` folds them. A permit is named by the city's own number
-- and type, as `permitsOnSite` counts one: the application and the issued permit share both and
-- are one permit, whichever feed's row was on the screen. Losing a bid is the bid's own outcome
-- and is not written here.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.bid_permit_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  city text NOT NULL CHECK (length(btrim(city)) > 0),
  permit_number text NOT NULL CHECK (length(btrim(permit_number)) > 0),
  permit_type text NOT NULL DEFAULT '',
  answer text NOT NULL CHECK (answer IN ('this_job', 'not_this_job', 'taken_back')),
  answered_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_permit_answers_bid_idx ON public.bid_permit_answers (bid_id, answered_at);
COMMENT ON TABLE public.bid_permit_answers IS 'Permit news (punch list #401): what a person said of a permit on a bid''s address — this_job, not_this_job (off the bid for everyone) or taken_back — append-only, with who and when. The newest row per bid, city, permit number and permit type is the state.';

ALTER TABLE public.bid_permit_answers ENABLE ROW LEVEL SECURITY;
-- The people who read permits (the office and every estimator) read and give answers, each as themself.
-- The rule sits in a scalar subquery so it is read once per statement, as 20261111013000 set the others.
DROP POLICY IF EXISTS bid_permit_answers_select ON public.bid_permit_answers;
CREATE POLICY bid_permit_answers_select ON public.bid_permit_answers
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_research_permits()));
DROP POLICY IF EXISTS bid_permit_answers_insert ON public.bid_permit_answers;
CREATE POLICY bid_permit_answers_insert ON public.bid_permit_answers
  FOR INSERT TO authenticated
  WITH CHECK (answered_by = auth.uid() AND (SELECT public.user_can_research_permits()));
REVOKE ALL ON TABLE public.bid_permit_answers FROM anon;
REVOKE ALL ON TABLE public.bid_permit_answers FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.bid_permit_answers TO authenticated;
GRANT ALL ON TABLE public.bid_permit_answers TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
