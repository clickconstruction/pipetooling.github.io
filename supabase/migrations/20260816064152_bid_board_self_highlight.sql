SET lock_timeout = '3s';

-- Per-user Bid Board self-name highlight (v2.1710): how YOUR name is boxed on
-- the board when you are the bid's Estimator or Account Man, chosen per theme.
--
-- Shape (validated client-side by src/lib/bids/bidBoardSelfHighlight.ts):
--   { "light": { "bg": "#rrggbb", "text": "auto" | "#rrggbb" },
--     "dark":  { "bg": "#rrggbb", "text": "auto" | "#rrggbb" } }
-- NULL (or a missing theme key) means the theme-aware default.
--
-- Written only by the owner through the existing "Users can update own
-- profile" policy; readable wherever the users row already is. Additive and
-- idempotent — no RLS changes needed.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bid_board_self_highlight jsonb;
