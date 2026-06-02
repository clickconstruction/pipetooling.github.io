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
 * Set or clear the Mercury *user* attribution for a single transaction, preserving any
 * existing job splits. Unlike `mercuryQuickAssignUserAttribution`, this does NOT require
 * splits to exist (no splits → `p_rows: []`). Pass `userId: null` to clear the attribution
 * (i.e. move the transaction to "Unassigned").
 */
export async function mercurySetTransactionUserAttribution(options: {
  mercuryTransactionId: string
  userId: string | null
  operationLabel: string
  /** Operator's auth user id; records the pick in recent person quick-picks when set. */
  recentPersonPicksStorageKey: string | null
}): Promise<void> {
  const { mercuryTransactionId, userId, operationLabel, recentPersonPicksStorageKey } = options

  const allocs = await fetchJobAllocationsByMercuryTxIds(
    [mercuryTransactionId],
    `${operationLabel} set-attr fetch splits`,
  )
  const p_rows = mercuryJobSplitsToPayload(allocs)

  const payload = {
    p_mercury_transaction_id: mercuryTransactionId,
    p_rows: p_rows as unknown as Json,
    p_person_id: null,
    // null clears: the RPC deletes the attribution row when both person and user are null.
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
