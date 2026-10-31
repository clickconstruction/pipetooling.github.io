import { supabase } from '../supabase'

/**
 * The names of a bid's versions by id (v2.6230), for the chip beside a plan set or a CountTooling project an
 * adopted bid brought along. Fail-soft: a read that fails gives an empty map and the chip stays off.
 */
export async function fetchBidVersionNames(bidId: string): Promise<ReadonlyMap<string, string>> {
  try {
    const { data, error } = await supabase.from('bid_versions').select('id, name').eq('bid_id', bidId)
    if (error) throw error
    return new Map((data ?? []).map((v) => [v.id as string, (v.name as string) ?? '']))
  } catch {
    return new Map()
  }
}
