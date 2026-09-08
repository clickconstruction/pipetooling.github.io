SET lock_timeout = '3s';

-- v2.3142 — "Don't let robots shadow this bid": the one opt-out in a program
-- where every live plumbing bid with readable plans is shadowed by default.
-- The dispatcher (twin-mcp get_shadow_queue / next_shadow / open_shadow) and
-- the coverage math skip an opted-out bid; it leaves the coverage count so a
-- deliberate exception never reads as a gap. Additive, idempotent.

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS robot_opt_out boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bids.robot_opt_out IS
  'Set from the bid form: robots never shadow this bid (twin-mcp skips it; coverage ignores it). Default false — shadowing is the default.';
