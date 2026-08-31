SET lock_timeout = '3s';

-- Shadow bidding data spine (v2.2539, fleet roadmap Phase 1): one row per live bid
-- the twin shadow-estimates in parallel with the human estimator. Natural blindness:
-- a shadow opens only while the reference is unsent (no bid_value/date_sent yet);
-- the twin locks its total, and score_shadows computes the delta the moment the
-- human number lands. All writes go through twin-mcp (service role) — RLS below
-- grants staff read only.

CREATE TABLE IF NOT EXISTS public.twin_shadow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  reference_bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  twin_user_id uuid NOT NULL,
  axis text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','scored')),
  locked_total numeric,
  locked_at timestamptz,
  reference_value numeric,
  delta_pct numeric,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_bid_id)
);

COMMENT ON TABLE public.twin_shadow_runs IS
  'Fleet Phase-1 shadow bids: twin estimates a live bid in parallel (blind by nature — opened before the human number exists), locks its total, and is scored automatically when the human bid is sent. Writes via twin-mcp only.';

ALTER TABLE public.twin_shadow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS twin_shadow_runs_select ON public.twin_shadow_runs;
CREATE POLICY twin_shadow_runs_select ON public.twin_shadow_runs
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS twin_shadow_runs_status_idx ON public.twin_shadow_runs (status);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
