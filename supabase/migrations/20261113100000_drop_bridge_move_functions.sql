SET lock_timeout = '3s';

-- The Bridge's call is gone, and so are its two functions (docs/migrations/20261113100000_drop_bridge_move_functions.md).
--
-- bridge_my_moves() handed a signed-in account the moves of the standing call that carried its own id, and
-- bridge_mark_my_move_done(uuid, integer) stamped one of them done (20261110213000_bridge_moves_reach_people.sql).
-- The Needs you card read the first and its Done press called the second. The owner took the call off the Bridge and
-- the line off Needs you (punch list #334): no client calls either function any more, and no call was ever kept.
--
-- The table bridge_calls stays, with its policies. It is empty and nothing reads it.
-- Functions only, so no table is locked and no fence is needed. Idempotent: a second run finds nothing to drop.

DROP FUNCTION IF EXISTS public.bridge_my_moves();
DROP FUNCTION IF EXISTS public.bridge_mark_my_move_done(uuid, integer);
