SET lock_timeout = '3s';

-- v2.4287 — Bid marks: hold a bid row to mark it, and find it marked everywhere.
--
-- WHY. On the nine bid workflow tabs (Counts … Lien Release) and the Bid Board an estimator
-- working a handful of bids out of two hundred had no way to say "these are mine today" that
-- survived a tab change, a search or a refresh. A mark is that: a private, per-person flag on a
-- bid, stored on the account so the iPad at the site and the desk agree. It says nothing about
-- the bid itself — no column on bids, no change to any count, invisible to everyone else.
--
-- One row per (person, bid). marked_at prints as "marked Fri" on the row so a stale mark is
-- visible. Deleting the bid or the person deletes the mark.

CREATE TABLE IF NOT EXISTS public.bid_marks (
  user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_id    uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bid_id)
);

COMMENT ON TABLE public.bid_marks IS
  'A person''s own marks on bids (hold a row to mark it): private, per account, one row per (person, bid). Says nothing about the bid. v2.4287.';

CREATE INDEX IF NOT EXISTS idx_bid_marks_bid ON public.bid_marks (bid_id);

ALTER TABLE public.bid_marks ENABLE ROW LEVEL SECURITY;

-- Yours and only yours: read, mark, clear. No UPDATE — a mark is made or cleared, never edited.
DROP POLICY IF EXISTS bid_marks_select_own ON public.bid_marks;
CREATE POLICY bid_marks_select_own ON public.bid_marks
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bid_marks_insert_own ON public.bid_marks;
CREATE POLICY bid_marks_insert_own ON public.bid_marks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bid_marks_delete_own ON public.bid_marks;
CREATE POLICY bid_marks_delete_own ON public.bid_marks
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.bid_marks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.bid_marks TO authenticated;
GRANT ALL ON public.bid_marks TO service_role;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
