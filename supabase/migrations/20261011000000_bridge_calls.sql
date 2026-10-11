SET lock_timeout = '3s';

-- The Bridge's calls (the weakest-link build, PR 2; v2.5233).
--
-- The Bridge reads the company as five stages and lights the weakest link. The
-- loop the page exists for is: Monday names the link and the moves on it, with
-- an owner each; Friday asks whether it moved. This table is that record. One
-- row per call; a week may be called again (the newest row for a week is the
-- call). `measures` is a snapshot of the page's reading at call time — the
-- link's weeks to clear, every stage's weeks, and the numbers behind the moves
-- (finished-unbilled dollars, late dollars, pending hours, unpriced jobs, jobs
-- assumed half done) — so the scorecard's then → now is the page's own reading
-- then, not a memory. `outcome` is Friday's answer; null until someone answers.
--
-- Dev only, like the page: read and written by devs, and nobody else.

CREATE TABLE IF NOT EXISTS public.bridge_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  called_on date NOT NULL,
  called_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  called_by_name text NOT NULL DEFAULT '',
  link text NOT NULL CHECK (link IN ('market', 'sales', 'build', 'bill', 'collect', 'decision', 'capital', 'talent')),
  moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  measures jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  outcome text CHECK (outcome IN ('moved', 'did_not_move')),
  outcome_at timestamptz,
  outcome_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bridge_calls IS
  'The Bridge''s weekly call: the link named for a pay week, the moves on it with owners, a snapshot of the page''s reading at call time, and Friday''s answer. Dev only. v2.5233.';

CREATE INDEX IF NOT EXISTS idx_bridge_calls_week ON public.bridge_calls (week_start DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_calls_called_by ON public.bridge_calls (called_by);

ALTER TABLE public.bridge_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bridge_calls_dev ON public.bridge_calls;
CREATE POLICY bridge_calls_dev ON public.bridge_calls FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
