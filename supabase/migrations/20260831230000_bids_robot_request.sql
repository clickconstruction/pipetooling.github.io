SET lock_timeout = '3s';

-- Robot request queue (v2.2542): clicking a yellow robot icon on the Bid Board
-- REQUESTS a robot bid — the icon turns green and the bid sorts to the top of
-- the dev-only Queue lens (and, later, twin-mcp get_shadow_queue's priority).
-- Additive; withdrawing a request nulls both columns.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS robot_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS robot_requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.robot_requested_at IS
  'When someone clicked the yellow robot icon to request a robot bid (green state). Null = not requested / withdrawn.';
COMMENT ON COLUMN public.bids.robot_requested_by IS
  'Who requested the robot bid — shown on the dev Queue lens.';
