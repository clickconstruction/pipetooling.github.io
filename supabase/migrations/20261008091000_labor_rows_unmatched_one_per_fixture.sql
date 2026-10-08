SET lock_timeout = '3s';

-- v2.4903: one set-aside labor row per fixture on a cost estimate. The night PR 0b
-- (20261008071000) shipped, a version switch on ZZ Test started four Labor syncs at once and each
-- set the same three rows aside, so cost_estimate_labor_rows_unmatched held four copies of each.
-- The client now runs one sync at a time per estimate and claims a row by deleting it before it
-- copies it; this index is the database's own guard, whatever a client does: a second copy of a
-- fixture is refused, as cost_estimate_labor_rows already refuses a second live row of one
-- (cost_estimate_labor_rows_cost_estimate_id_fixture_key, in the baseline).
--
-- The key is the exact fixture name, the live table's own key: a set-aside row only ever comes from
-- a live row, so one name per estimate is what the live table guarantees. Not the sync's loose key
-- (case, spacing, a [Group] prefix): seven estimates on prod carry two live names on one loose key.
--
-- First the copies go: the oldest row of each (estimate, fixture) stays, the rest are deleted (on
-- prod, ZZ Test's nine, all identical to the row kept; the delete archive and the ledger keep them).

DELETE FROM public.cost_estimate_labor_rows_unmatched u
 USING public.cost_estimate_labor_rows_unmatched keep
 WHERE keep.cost_estimate_id = u.cost_estimate_id
   AND keep.fixture = u.fixture
   AND (keep.parked_at, keep.id) < (u.parked_at, u.id);

CREATE UNIQUE INDEX IF NOT EXISTS cost_estimate_labor_rows_unmatched_estimate_fixture_key
  ON public.cost_estimate_labor_rows_unmatched (cost_estimate_id, fixture);
