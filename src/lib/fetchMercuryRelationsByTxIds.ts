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
