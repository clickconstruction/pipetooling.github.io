SET lock_timeout = '3s';

-- Prospects → Subs, the board by trade (v2.5809, punch list #153, PR 3). The owner, 2026-10-23: "we can rank the
-- responsiveness of people or the priority of people", with Hiring's columns as the model. The board stores the two
-- things only a person knows and computes the rest: a card dragged by hand holds its place in one trade's column
-- (prospect_trade_ranks: one row a company a trade, since a sub can name two trades and sit in two columns; a row
-- means pinned, no row means the card flows by its record), and the office's priority on the company (prospects.priority:
-- 1 Call first, NULL Normal, 3 Later). The record itself (answers, hit or miss, new to us, often silent) is read from
-- the call log on load and never stored. Both ride the prospects' own door, user_has_prospects_staff_access().

BEGIN;

CREATE TABLE IF NOT EXISTS public.prospect_trade_ranks (
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  trade text NOT NULL CHECK (length(btrim(trade)) > 0),
  rank_order integer NOT NULL CHECK (rank_order >= 1),
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prospect_id, trade)
);

CREATE INDEX IF NOT EXISTS prospect_trade_ranks_trade_rank_idx ON public.prospect_trade_ranks (trade, rank_order);

COMMENT ON TABLE public.prospect_trade_ranks IS 'The Subs board (v2.5809): a card dragged by hand in one trade''s column. One row a company a trade; a row is a pin at rank_order (dense 1..n among the column''s pins), no row means the card flows by its record. trade is the bench''s spelling, compared case-blind by the app.';
COMMENT ON COLUMN public.prospect_trade_ranks.rank_order IS 'The pin''s place among the column''s pins, 1 at the top.';
COMMENT ON COLUMN public.prospect_trade_ranks.set_by IS 'Who dragged it; NULL once that user is gone.';

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS priority smallint;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_priority_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_priority_known CHECK (priority IS NULL OR priority IN (1, 3));
COMMENT ON COLUMN public.prospects.priority IS 'The office''s priority on the Subs board (v2.5809): 1 Call first, NULL Normal, 3 Later. Sorts a column over the record.';

ALTER TABLE public.prospect_trade_ranks ENABLE ROW LEVEL SECURITY;

-- The prospects' own door: the dev, the owner and the assistants (and an estimator with the grant).
DROP POLICY IF EXISTS prospect_trade_ranks_staff_select ON public.prospect_trade_ranks;
CREATE POLICY prospect_trade_ranks_staff_select ON public.prospect_trade_ranks
  FOR SELECT TO authenticated USING (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_trade_ranks_staff_insert ON public.prospect_trade_ranks;
CREATE POLICY prospect_trade_ranks_staff_insert ON public.prospect_trade_ranks
  FOR INSERT TO authenticated WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_trade_ranks_staff_update ON public.prospect_trade_ranks;
CREATE POLICY prospect_trade_ranks_staff_update ON public.prospect_trade_ranks
  FOR UPDATE TO authenticated USING (public.user_has_prospects_staff_access()) WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_trade_ranks_staff_delete ON public.prospect_trade_ranks;
CREATE POLICY prospect_trade_ranks_staff_delete ON public.prospect_trade_ranks
  FOR DELETE TO authenticated USING (public.user_has_prospects_staff_access());

REVOKE ALL ON public.prospect_trade_ranks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_trade_ranks TO authenticated;
GRANT ALL ON public.prospect_trade_ranks TO service_role;

COMMIT;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
