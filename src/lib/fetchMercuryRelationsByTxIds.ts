import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

/** Keeps `.in('mercury_transaction_id', …)` URL/request size small; large batches cause `Failed to fetch`. */
export const MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE = 200

type AllocRow = Database['public']['Tables']['mercury_transaction_job_allocations']['Row']
type AttrRow = Database['public']['Tables']['mercury_transaction_attributions']['Row']

export async function fetchJobAllocationsByMercuryTxIds(ids: string[], operationLabel: string): Promise<AllocRow[]> {
  const all: AllocRow[] = []
  for (let i = 0; i < ids.length; i += MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE)
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transaction_job_allocations')
          .select('mercury_transaction_id, job_id, amount, note')
          .in('mercury_transaction_id', chunk),
      `${operationLabel} mercury_transaction_job_allocations`,
    )
    all.push(...((rows ?? []) as AllocRow[]))
  }
  return all
}

export async function fetchAttributionsByMercuryTxIds(ids: string[], operationLabel: string): Promise<AttrRow[]> {
  const all: AttrRow[] = []
  for (let i = 0; i < ids.length; i += MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE)
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transaction_attributions')
          .select('mercury_transaction_id, person_id, user_id')
          .in('mercury_transaction_id', chunk),
      `${operationLabel} mercury_transaction_attributions`,
    )
    all.push(...((rows ?? []) as AttrRow[]))
  }
  return all
}

/**
 * Upper bound for "fetch the whole (small) relation table" reads. These tables are far
 * smaller than the transaction list (allocations ~1k, attributions ~5k), so when the page
 * has loaded *all* transactions, one unfiltered select is dramatically cheaper than chunking
 * by ~10k ids in 200-id batches. Must exceed PostgREST's 1000-row default.
 */
export const MERCURY_RELATION_FETCH_ALL_LIMIT = 100000

/** Single-request fetch of ALL job allocations (use when the page loads the full tx list). */
export async function fetchAllJobAllocations(operationLabel: string): Promise<AllocRow[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase
        .from('mercury_transaction_job_allocations')
        .select('mercury_transaction_id, job_id, amount, note')
        .limit(MERCURY_RELATION_FETCH_ALL_LIMIT),
    `${operationLabel} mercury_transaction_job_allocations (all)`,
  )
  return (rows ?? []) as AllocRow[]
}

/** Single-request fetch of ALL attributions (use when the page loads the full tx list). */
export async function fetchAllAttributions(operationLabel: string): Promise<AttrRow[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase
        .from('mercury_transaction_attributions')
        .select('mercury_transaction_id, person_id, user_id')
        .limit(MERCURY_RELATION_FETCH_ALL_LIMIT),
    `${operationLabel} mercury_transaction_attributions (all)`,
  )
  return (rows ?? []) as AttrRow[]
}
