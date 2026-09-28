import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A deep link to a bid the loaded list does not hold: the bid may live under another trade.
 * Reads the bid's trade and answers the trade to switch to — `null` when the bid is already
 * under the trade on screen, cannot be read (not found, no access), or the read fails. Never
 * throws: a link that cannot be followed leaves the page where it is.
 *
 * Stage A of the Bids.tsx second pass (`docs/BIDS_TABS_ARCHITECTURE.md`, step 2): the page's
 * router wrote this read five times.
 */
export async function bidTradeToSwitchTo(
  client: Pick<SupabaseClient, 'from'>,
  bidId: string,
  currentTradeId: string | null | undefined,
): Promise<string | null> {
  try {
    const { data } = await client.from('bids').select('service_type_id').eq('id', bidId).single()
    const tradeId = (data as { service_type_id: string | null } | null)?.service_type_id
    return tradeId && tradeId !== currentTradeId ? tradeId : null
  } catch {
    return null
  }
}
