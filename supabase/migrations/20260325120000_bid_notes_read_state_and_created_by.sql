-- Bid submission entries: who created the row (for "unread from others" on My Bids)
ALTER TABLE public.bids_submission_entries
  ADD COLUMN created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids_submission_entries.created_by IS 'User who created this entry; null for legacy rows.';

-- Per-user read watermarks for dashboard My Bids note notifications
CREATE TABLE public.user_bid_notes_read_state (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  last_seen_bid_submission_at timestamptz,
  last_seen_customer_contact_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bid_id)
);

CREATE INDEX idx_user_bid_notes_read_state_bid_id ON public.user_bid_notes_read_state(bid_id);

COMMENT ON TABLE public.user_bid_notes_read_state IS 'Dashboard My Bids: last time each user acknowledged bid submission / customer contact notes per bid.';

ALTER TABLE public.user_bid_notes_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own bid notes read state"
  ON public.user_bid_notes_read_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bid notes read state"
  ON public.user_bid_notes_read_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bid notes read state"
  ON public.user_bid_notes_read_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own bid notes read state"
  ON public.user_bid_notes_read_state FOR DELETE
  USING (auth.uid() = user_id);
