-- v2.6872 — Bids and permits: the answer on a name (punch list #307, PR 6 and 7).
-- A permit lists one contact, and it is not always the builder. When a bid's site carries a
-- permit, the app asks once whether the name the city lists works for the bid's GC. The answer
-- is kept here, append-only, with who gave it and when, so the question is never asked twice
-- and a wrong answer can be taken back:
--   works_for     the name is the GC's. `scope` says how far: `all` (every permit under the
--                 name shows under the GC) or `this_permit` (only the one it was asked on).
--   someone_else  the name is not the GC's. What it is instead is the builder's kind, on `builders`.
--   not_sure      this person does not know. The question stays for everyone else.
--   taken_back    an earlier works_for or someone_else is undone; the question comes back.
-- The newest decisive row per (name, customer) is the state; `src/lib/research/nameAnswers.ts`
-- folds them. `builders.customer_id` (v2.6835) stays as it is and stays unwritten.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.builder_customer_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL CHECK (length(btrim(builder_key)) > 0),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (answer IN ('works_for', 'someone_else', 'not_sure', 'taken_back')),
  scope text CHECK (scope IS NULL OR scope IN ('all', 'this_permit')),
  -- The permit the question was asked on.
  permit_id uuid REFERENCES public.permits(id) ON DELETE SET NULL,
  -- The name as the city lists it, for the screen.
  name text NOT NULL DEFAULT '',
  answered_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT builder_customer_answers_scope_check CHECK ((answer = 'works_for') = (scope IS NOT NULL)),
  CONSTRAINT builder_customer_answers_permit_check CHECK (scope IS DISTINCT FROM 'this_permit' OR permit_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS builder_customer_answers_customer_idx ON public.builder_customer_answers (customer_id, builder_key, answered_at);
CREATE INDEX IF NOT EXISTS builder_customer_answers_key_idx ON public.builder_customer_answers (builder_key, answered_at);
COMMENT ON TABLE public.builder_customer_answers IS 'Bids and permits (punch list #307): whether a name the city lists on permits works for a customer — works_for (all of the name''s permits, or the one asked on), someone_else, not_sure (that person only) or taken_back — append-only, with who and when. The newest decisive row per name and customer is the state.';

ALTER TABLE public.builder_customer_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS builder_customer_answers_select ON public.builder_customer_answers;
CREATE POLICY builder_customer_answers_select ON public.builder_customer_answers
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
DROP POLICY IF EXISTS builder_customer_answers_insert ON public.builder_customer_answers;
CREATE POLICY builder_customer_answers_insert ON public.builder_customer_answers
  FOR INSERT TO authenticated
  WITH CHECK (answered_by = auth.uid() AND public.user_can_research_permits());
REVOKE ALL ON TABLE public.builder_customer_answers FROM anon;
GRANT SELECT, INSERT ON TABLE public.builder_customer_answers TO authenticated;
GRANT ALL ON TABLE public.builder_customer_answers TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
