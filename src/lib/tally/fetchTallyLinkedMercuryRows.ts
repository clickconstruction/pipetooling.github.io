import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { TallyLinkedMercuryRow } from '../mercuryTxRowFromTally'

/** The one method the fetcher needs; tests hand in a stub. */
export type TallyRpcClient = Pick<typeof supabase, 'rpc'>

export const TALLY_LINKED_ROWS_RPC = 'list_my_linked_mercury_transactions_for_tally' as const

/**
 * Every charge on the signed-in user's linked cards, paged past PostgREST's
 * silent 1,000-row cap (v2.4259). The RPC orders by `posted_at DESC, id`, so
 * `.range()` pages are stable. Un-ranged, a card with more than 1,000 charges
 * came back as its newest 1,000 with no error — the date floor and the payroll
 * merge then ran over a truncated list, and the page's counts and the
 * *Payroll: N · $X* chip read only what survived. Each page keeps the retry
 * the callers had; a failed page throws, never an empty list.
 */
export async function fetchTallyLinkedMercuryRows(
  client: TallyRpcClient = supabase,
  label = 'list tally linked mercury transactions',
): Promise<TallyLinkedMercuryRow[]> {
  return fetchAllRows<TallyLinkedMercuryRow>(
    (from, to) =>
      withSupabaseRetry(() => client.rpc(TALLY_LINKED_ROWS_RPC).range(from, to), label).then((data) => ({
        data: (data ?? []) as TallyLinkedMercuryRow[],
        error: null,
      })),
    label,
  )
}
