SET lock_timeout = '3s';

-- Punch list #426, step 6 (v2.8369): a bid hidden on the Dashboard's My Bids is kept in the person's own row,
-- so it follows them to every device. Until now the hidden ids lived in one browser's localStorage
-- (`dashboard_my_bids_hidden_<user>`): a bid hidden on the phone was back on the desk.
--
-- user_bid_notes_read_state already holds one row per person and bid, open to that person alone (the baseline's
-- four own-row policies: select, insert, update, delete where auth.uid() = user_id). A hidden bid is that row
-- with hidden_at set; Show again sets it back to null. A row made only to hold hidden_at has no read marks, and
-- both readers of the marks (My Bids and the Bid Board's unread counts) read a null mark as they read no row.
--
-- Additive and idempotent. Adding a nullable column with no default rewrites nothing. The client on prod reads
-- this table with select('*') or by named columns and never names hidden_at, so it is untouched.

ALTER TABLE public.user_bid_notes_read_state
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

COMMENT ON COLUMN public.user_bid_notes_read_state.hidden_at IS
  'When the person hid this bid on the Dashboard''s My Bids (punch list #426); null when it is shown. The person''s own, like the row''s read marks.';
