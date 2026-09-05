import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from './supabasePaging'

/** Keeps `.in('mercury_transaction_id', …)` URL/request size small; large batches cause `Failed to fetch`. */
export const MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE = 200

type AllocRow = Database['public']['Tables']['mercury_transaction_job_allocations']['Row']
type AttrRow = Database['public']['Tables']['mercury_transaction_attributions']['Row']

const ALLOC_COLUMNS = 'mercury_transaction_id, job_id, amount, note'
const ATTR_COLUMNS = 'mercury_transaction_id, person_id, user_id'

/**
 * Every read in this file is PAGED (`.range()` under a stable `.order()`), never
 * un-ranged. PostgREST silently caps an un-ranged response at `max_rows` (1000)
 * — a `.limit(100000)` does NOT lift it (J33-N1: `mercury_transaction_job_allocations`
 * had 2,060 rows and the "fetch all" read returned 1,000, so the Banking relation
 * maps were short 1,060 splits and the Link… modal seeded empty for the missing
 * transactions — one Save away from erasing them). Chunked-by-id reads page each
 * chunk too: a 200-id chunk can in principle carry >1000 allocation rows.
 */

/** Job allocations for a fixed list of transaction ids (chunked `.in()`, each chunk paged). */
export async function fetchJobAllocationsByMercuryTxIds(ids: string[], operationLabel: string): Promise<AllocRow[]> {
  const label = `${operationLabel} mercury_transaction_job_allocations`
  return fetchAllRowsChunkedIn<AllocRow, string>(
    ids,
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transaction_job_allocations')
            .select(ALLOC_COLUMNS)
            .in('mercury_transaction_id', chunk)
            .order('mercury_transaction_id')
            .order('id')
            .range(from, to),
        label,
      )) as AllocRow[] | null,
      error: null,
    }),
    label,
    { chunkSize: MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE },
  )
}

/** Person/user attributions for a fixed list of transaction ids (chunked `.in()`, each chunk paged). */
export async function fetchAttributionsByMercuryTxIds(ids: string[], operationLabel: string): Promise<AttrRow[]> {
  const label = `${operationLabel} mercury_transaction_attributions`
  return fetchAllRowsChunkedIn<AttrRow, string>(
    ids,
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transaction_attributions')
            .select(ATTR_COLUMNS)
            .in('mercury_transaction_id', chunk)
            .order('mercury_transaction_id')
            .range(from, to),
        label,
      )) as AttrRow[] | null,
      error: null,
    }),
    label,
    { chunkSize: MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE },
  )
}

/**
 * Paged fetch of EVERY job allocation row. Use when the caller holds the whole
 * transaction table (Banking's master list, Visuals): the relation tables are a
 * few thousand rows, so ~3 paged requests beat chunking ~13k ids into ~66
 * `.in()` batches. Complete by construction — pages until a short page.
 */
export async function fetchAllJobAllocations(operationLabel: string): Promise<AllocRow[]> {
  const label = `${operationLabel} mercury_transaction_job_allocations (all)`
  return fetchAllRows<AllocRow>(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transaction_job_allocations')
            .select(ALLOC_COLUMNS)
            .order('mercury_transaction_id')
            .order('id')
            .range(from, to),
        label,
      )) as AllocRow[] | null,
      error: null,
    }),
    label,
  )
}

/** Paged fetch of EVERY attribution row (see {@link fetchAllJobAllocations}). */
export async function fetchAllAttributions(operationLabel: string): Promise<AttrRow[]> {
  const label = `${operationLabel} mercury_transaction_attributions (all)`
  return fetchAllRows<AttrRow>(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transaction_attributions')
            .select(ATTR_COLUMNS)
            .order('mercury_transaction_id')
            .range(from, to),
        label,
      )) as AttrRow[] | null,
      error: null,
    }),
    label,
  )
}
