import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Ids of `users` flagged `is_digital_twin` — the set `isRobotBid` /
 * `partitionBidsByScope` (bidBoardScope.ts) key on. Loaded without an
 * archived filter: a bid assigned to a retired twin is still a robot bid.
 * Fail-soft: an empty set means "everything is people", the pre-scope
 * behaviour, never a crash (estimators may not be allowed to read twin rows).
 */
export async function fetchTwinUserIds(): Promise<ReadonlySet<string>> {
  try {
    const data = await withSupabaseRetry(
      async () => supabase.from('users').select('id').eq('is_digital_twin', true),
      'load twin user ids',
    )
    return new Set(((data as Array<{ id: string }> | null) ?? []).map((r) => r.id))
  } catch {
    return new Set()
  }
}
