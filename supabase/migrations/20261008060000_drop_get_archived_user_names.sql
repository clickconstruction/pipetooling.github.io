-- v2.4859 · Punch list #29 (People spine residuals), item 3b.
--
-- Drops public.get_archived_user_names(). Since v2.4671 the five People surfaces it served
-- (Offsets, Contracts, Review, the Teams member filter, the Hours grid) take who is archived
-- from the roster_people view, so nothing calls it: no client code, edge function, view,
-- function body or trigger. A client older than v2.4671 still calls it and ignores the error
-- (no archived fold for that load), so dropping it breaks no screen.
--
-- The DROP takes the function's grants with it, so no REVOKE comes first. It locks the
-- function only, never a table.

SET lock_timeout = '3s';

DROP FUNCTION IF EXISTS public.get_archived_user_names();
