import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { chunkIds } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { TakeoffFixtureHistoryParams, TakeoffFixtureHistoryRow } from '../../types/database-functions'

/**
 * Client for `takeoff_fixture_history` (migration 20260904202321, v2.2774):
 * "what this fixture usually gets". Keys go in 150-key chunks so a long bid
 * never builds an oversized request; the RPC itself is bounded by
 * `bidsPerKey` (server-clamped to 1–10), so no paging is needed.
 *
 * Typed through the manual `database-functions.ts` interfaces until the
 * generated types pick the function up after `db push`.
 */
export async function fetchTakeoffFixtureHistory(
  supabase: SupabaseClient<Database>,
  args: { serviceTypeId: string; keys: string[]; excludeBidId?: string | null; bidsPerKey?: number },
): Promise<TakeoffFixtureHistoryRow[]> {
  const unique = Array.from(new Set(args.keys.map((k) => k.trim()).filter(Boolean)))
  if (unique.length === 0) return []
  const rpc = supabase as unknown as {
    rpc: (fn: string, params: TakeoffFixtureHistoryParams) => PromiseLike<{ data: unknown; error: { message: string; code?: string; details?: string } | null }>
  }
  const out: TakeoffFixtureHistoryRow[] = []
  for (const chunk of chunkIds(unique)) {
    const data = await withSupabaseRetry(
      () =>
        rpc.rpc('takeoff_fixture_history', {
          p_service_type_id: args.serviceTypeId,
          p_keys: chunk,
          p_exclude_bid_id: args.excludeBidId ?? null,
          p_bids_per_key: args.bidsPerKey ?? 3,
        }) as PromiseLike<{ data: TakeoffFixtureHistoryRow[] | null; error: { message: string; code?: string; details?: string } | null }>,
      'load takeoff fixture history',
    )
    out.push(...(Array.isArray(data) ? data : []))
  }
  return out
}
