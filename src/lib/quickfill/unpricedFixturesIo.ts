/**
 * The read behind Quickfill → Unpriced fixtures and its count (punch list #184 sweep B): only the
 * fixtures nothing prices, oldest first, paged past PostgREST's 1,000-row cap. The RPC's own
 * ORDER BY is newest first, so the un-ranged read it replaces kept the newest 1,000 tally rows and
 * dropped the oldest. Throws on a failed page (`fetchAllRows`); the callers stay fail-soft.
 *
 * PostgREST orders an RPC read only on columns its select returns (a filter may name any), so `id`
 * is selected for the tiebreak that keeps the pages stable. Without it every load answered 400
 * "column record.id does not exist" (v2.5964 to v2.6125).
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import type { UnpricedFixtureRow } from './unpricedFixtures'

export function loadUnpricedFixtureRows(): Promise<UnpricedFixtureRow[]> {
  return fetchAllRows<UnpricedFixtureRow>(
    (from, to) =>
      supabase
        .rpc('list_tally_parts_with_po')
        .select('id, job_id, part_id, fixture_cost, created_at')
        .is('part_id', null)
        .or('fixture_cost.is.null,fixture_cost.eq.0')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'load unpriced fixtures',
  )
}
