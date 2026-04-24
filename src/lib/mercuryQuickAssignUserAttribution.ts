import { supabase } from './supabase'
import type { Database, Json } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchJobAllocationsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'
import { pushRecentPersonUserId } from './mercuryAllocRecentPersonUserIds'

type ReplaceArgs = Database['public']['Functions']['replace_mercury_transaction_splits']['Args']

/**
 * Sets Mercury user attribution for a transaction using current `mercury_transaction_job_allocations`
 * rows unchanged, via `replace_mercury_transaction_splits` (same as the full alloc modal).
 */
export async function mercuryQuickAssignUserAttribution(options: {
  mercuryTransactionId: string
  userId: string
  operationLabel: string
  /** If set, records this user in recent person picks (same as MercuryTransactionAllocationsModal). */
  recentPersonPicksStorageKey: string | null
}): Promise<void> {
  const { mercuryTransactionId, userId, operationLabel, recentPersonPicksStorageKey } = options
  const allocs = await fetchJobAllocationsByMercuryTxIds(
    [mercuryTransactionId],
    `${operationLabel} quick assign fetch splits`,
  )
  if (allocs.length === 0) {
    throw new Error('No job splits for this transaction.')
  }
  const p_rows: Array<{ job_id: string; amount: number; note?: string }> = allocs.map((r) => {
    const row: { job_id: string; amount: number; note?: string } = {
      job_id: r.job_id,
      amount: Number(r.amount),
    }
    const nt = r.note
    if (nt != null && String(nt).trim() !== '') row.note = String(nt)
    return row
  })

  const replaceMercurySplitsPayload = {
    p_mercury_transaction_id: mercuryTransactionId,
    p_rows: p_rows as unknown as Json,
    p_person_id: null,
    p_user_id: userId,
  }
  await withSupabaseRetry(
    async () =>
      supabase.rpc(
        'replace_mercury_transaction_splits',
        replaceMercurySplitsPayload as unknown as ReplaceArgs,
      ),
    `${operationLabel} replace_mercury_transaction_splits quick assign`,
  )
  if (recentPersonPicksStorageKey) {
    pushRecentPersonUserId(recentPersonPicksStorageKey, userId)
  }
}
