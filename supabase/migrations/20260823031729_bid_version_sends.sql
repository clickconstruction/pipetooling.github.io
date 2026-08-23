SET lock_timeout = '3s';

-- v2.2124 (Send or Compare F5, decision D5): each bid VERSION records its own sends — when it went
-- out and at what ★ value — so Followup, hit rate and the Bid Board can see a package of bids as one
-- event with a per-bid breakdown. The bid-level columns (bids.bid_date_sent / bid_value) stay the
-- roll-up every existing reader uses; the client keeps them in sync ("Mark sent" on the Cover Letter).
-- History table (append-only from the app): the latest row per version is its current send.

CREATE TABLE IF NOT EXISTS public.bid_version_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  bid_version_id uuid NOT NULL REFERENCES public.bid_versions(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  -- The version's ★ scenario revenue at send time (null when it had no prices yet).
  value numeric(14,2) NULL,
  is_alternate boolean NOT NULL DEFAULT false,
  -- Free label for the round ("Revised", "VE") — optional; adoption (F6) seeds it from the source bid.
  round_label text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS bid_version_sends_bid_idx ON public.bid_version_sends (bid_id, sent_on DESC);
CREATE INDEX IF NOT EXISTS bid_version_sends_version_idx ON public.bid_version_sends (bid_version_id, sent_on DESC);

COMMENT ON TABLE public.bid_version_sends IS
  'Per-version send records (date + ★ value). Latest row per bid_version_id = its current send. bids.bid_date_sent/bid_value remain the bid-level roll-up.';

ALTER TABLE public.bid_version_sends ENABLE ROW LEVEL SECURITY;

-- Same gate as bid_versions: whoever can price the bid can see/record its sends.
DROP POLICY IF EXISTS "bid_version_sends_select" ON public.bid_version_sends;
CREATE POLICY "bid_version_sends_select" ON public.bid_version_sends
  FOR SELECT USING (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_version_sends_insert" ON public.bid_version_sends;
CREATE POLICY "bid_version_sends_insert" ON public.bid_version_sends
  FOR INSERT WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_version_sends_update" ON public.bid_version_sends;
CREATE POLICY "bid_version_sends_update" ON public.bid_version_sends
  FOR UPDATE USING (public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_version_sends_delete" ON public.bid_version_sends;
CREATE POLICY "bid_version_sends_delete" ON public.bid_version_sends
  FOR DELETE USING (public.can_access_bid_for_pricing(bid_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_version_sends TO authenticated;
GRANT ALL ON public.bid_version_sends TO service_role;

-- Read-only (training mode) users: restrictive write policies + statement trigger (CLAUDE.md rule).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
