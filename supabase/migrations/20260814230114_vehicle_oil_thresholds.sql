SET lock_timeout = '3s';

-- Oil change prompt thresholds (Vehicles fleet phase 7): two per-vehicle mile
-- settings driving the holder-facing Dashboard banners — "Oil change
-- suggested" when the latest reading is within the suggest window of the next
-- due mark, "Oil change required" once past due by the require threshold
-- (0 = required the moment it hits the interval). Additive columns with
-- defaults matching the previous hardcoded behavior; idempotent.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS oil_suggest_window_miles integer NOT NULL DEFAULT 1000;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS oil_require_past_due_miles integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.vehicles.oil_suggest_window_miles IS
  'Miles before the next oil-change due mark at which "Oil change suggested" prompts start (default 1000 — the pre-v2.1664 hardcoded window).';

COMMENT ON COLUMN public.vehicles.oil_require_past_due_miles IS
  'Miles past the due mark before "suggested" escalates to "Oil change required" (default 0 = required at the interval).';
