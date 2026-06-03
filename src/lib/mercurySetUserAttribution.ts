import { supabase } from './supabase'
import type { Database, Json } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchJobAllocationsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'
import { pushRecentPersonUserId } from './mercuryAllocRecentPersonUserIds'

type ReplaceArgs = Database['public']['Functions']['replace_mercury_transaction_splits']['Args']

export type MercuryJobSplitPayloadRow = { job_id: string; amount: number; note?: string }

/**
 * Pure: map fetched job-allocation rows to the `replace_mercury_transaction_splits`
 * `p_rows` payload. Empty input → `[]`. Mirrors the mapping in
 * mercuryQuickAssignUserAttribution so re-passing splits preserves them unchanged.
 */
export function mercuryJobSplitsToPayload(
  allocs: ReadonlyArray<{ job_id: string; amount: number | string; note?: unknown }>,
): MercuryJobSplitPayloadRow[] {
  return allocs.map((r) => {
    const row: MercuryJobSplitPayloadRow = { job_id: r.job_id, amount: Number(r.amount) }
    const nt = r.note
    if (nt != null && String(nt).trim() !== '') row.note = String(nt)
    return row
  })
}

/**
 * Set or clear the Mercury attribution (a user XOR a roster person) for a single transaction,
 * preserving any existing job splits. Unlike `mercuryQuickAssignUserAttribution`, this does NOT
 * require splits to exist (no splits → `p_rows: []`). Pass both `userId` and `personId` null to
 * clear the attribution (move the transaction to "Unassigned"). At most one of userId/personId
 * should be set (the RPC enforces the XOR).
 */
export async function mercurySetTransactionAttribution(options: {
  mercuryTransactionId: string
  userId: string | null
  personId: string | null
  operationLabel: string
  /** Operator's auth user id; records the pick in recent person quick-picks when a user is set. */
  recentPersonPicksStorageKey: string | null
}): Promise<void> {
  const { mercuryTransactionId, userId, personId, operationLabel, recentPersonPicksStorageKey } = options

  const allocs = await fetchJobAllocationsByMercuryTxIds(
    [mercuryTransactionId],
    `${operationLabel} set-attr fetch splits`,
  )
  const p_rows = mercuryJobSplitsToPayload(allocs)

  const payload = {
    p_mercury_transaction_id: mercuryTransactionId,
    p_rows: p_rows as unknown as Json,
    // null/null clears: the RPC deletes the attribution row when both person and user are null.
    p_person_id: personId,
    p_user_id: userId,
  }
  await withSupabaseRetry(
    async () =>
      supabase.rpc('replace_mercury_transaction_splits', payload as unknown as ReplaceArgs),
    `${operationLabel} replace_mercury_transaction_splits set-attr`,
  )

  if (userId && recentPersonPicksStorageKey) {
    pushRecentPersonUserId(recentPersonPicksStorageKey, userId)
  }
}
