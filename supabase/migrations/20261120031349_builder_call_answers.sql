-- v2.7982 — Permits, Market: the answer on a name the call list offers (punch list #405, step two).
-- Market's call list offers a few builders to call each week. A name leaves the list when a
-- person answers it, the way a permit leaves the skim. The answer is kept here, append-only,
-- with who gave it and when:
--   pursue      we are going after them. `prospect_id` is the lead the press made, and
--               `permit_id` the permit the lead was made from, when there is one.
--   not_for_us  not a company to call. `reason` says why in a line, when the person gave one.
--   back        an earlier answer is undone, and the name may be offered again.
-- `look_again_on` is the day a pursued or passed name may be offered again. Null is not again.
-- The newest row per name is the state; `src/lib/research/permitCallList.ts` folds them. A name
-- is a builder's key, as `permits.builder_key` and `builders.key` hold it, so the answer stands
-- in every city the name pulls permits in. `city` is only where it was given.
-- A builder's mark (Good, Avoid) stays in `builder_marks`. This table says nothing of it.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.builder_call_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL CHECK (length(btrim(builder_key)) > 0),
  answer text NOT NULL CHECK (answer IN ('pursue', 'not_for_us', 'back')),
  reason text NOT NULL DEFAULT '',
  look_again_on date,
  -- The city whose list the answer was given on.
  city text NOT NULL DEFAULT '',
  -- The lead a pursue made, and the permit it was made from.
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  permit_id uuid REFERENCES public.permits(id) ON DELETE SET NULL,
  answered_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS builder_call_answers_key_idx ON public.builder_call_answers (builder_key, answered_at);
COMMENT ON TABLE public.builder_call_answers IS 'Permits, Market (punch list #405): what a person said of a builder the call list offered — pursue (with the lead it made), not_for_us or back (an answer undone) — append-only, with who and when and the day the name may be offered again. The newest row per builder key is the state.';

ALTER TABLE public.builder_call_answers ENABLE ROW LEVEL SECURITY;
-- The people who read permits (the office and every estimator) read and give answers, each as themself.
-- The rule sits in a scalar subquery so it is read once per statement, as 20261111013000 set the others.
DROP POLICY IF EXISTS builder_call_answers_select ON public.builder_call_answers;
CREATE POLICY builder_call_answers_select ON public.builder_call_answers
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_research_permits()));
DROP POLICY IF EXISTS builder_call_answers_insert ON public.builder_call_answers;
CREATE POLICY builder_call_answers_insert ON public.builder_call_answers
  FOR INSERT TO authenticated
  WITH CHECK (answered_by = auth.uid() AND (SELECT public.user_can_research_permits()));
REVOKE ALL ON TABLE public.builder_call_answers FROM anon;
REVOKE ALL ON TABLE public.builder_call_answers FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.builder_call_answers TO authenticated;
GRANT ALL ON TABLE public.builder_call_answers TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
