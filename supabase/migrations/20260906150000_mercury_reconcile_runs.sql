SET lock_timeout = '3s';

-- Tier 5 X4 (J33-F3 / N4 / N6, cluster C7), T5-06: reconciliation keeps a receipt.
-- One row per run of the mercury-reconcile edge function (written service-role by the
-- function itself), stating who ran it, when, what it compared and what it did not.
CREATE TABLE IF NOT EXISTS public.mercury_reconcile_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  ran_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  months_back integer NOT NULL,
  accounts_checked integer NOT NULL,
  statement_lines integer NOT NULL,
  statement_lines_present integer NOT NULL,
  months_with_missing integer NOT NULL DEFAULT 0,
  -- true = every account's live balance within $0.01; false = at least one off; null = none checkable
  current_within_epsilon boolean,
  -- the scope sentence: presence only, statement -> books, what is not checked
  scope text NOT NULL,
  -- per-account summary (see _shared/reconcileReceipt.ts ReceiptAccount)
  summary jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mercury_reconcile_runs_ran_at ON public.mercury_reconcile_runs (ran_at DESC);

ALTER TABLE public.mercury_reconcile_runs ENABLE ROW LEVEL SECURITY;

-- Banking staff read the run list (same cohort that can run it: is_banking_staff(), v2.2920).
DROP POLICY IF EXISTS mercury_reconcile_runs_select ON public.mercury_reconcile_runs;
CREATE POLICY mercury_reconcile_runs_select ON public.mercury_reconcile_runs
  FOR SELECT USING (public.is_banking_staff());
-- No INSERT/UPDATE/DELETE policies: rows are written only by the edge function (service role).

COMMENT ON TABLE public.mercury_reconcile_runs IS
  'One receipt per mercury-reconcile run (Tier 5 X4, v2.2949): who, when, N of M statement transactions present, months with something missing, live-balance check, and the scope sentence. Written by the edge function only.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
