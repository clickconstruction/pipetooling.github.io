import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { BidWithBuilder, EstimatorUser } from '../types/bidWithBuilder'

type Bid = Database['public']['Tables']['bids']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']

const BID_DETAIL_SELECT =
  '*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email), account_manager:users!bids_account_manager_id_fkey(id, name, email), service_type:service_types(id, name, color)'

type RawBidJoin = Bid & {
  customers: Customer | Customer[] | null
  bids_gc_builders: GcBuilder | GcBuilder[] | null
  estimator?: EstimatorUser | EstimatorUser[] | null
  account_manager?: EstimatorUser | EstimatorUser[] | null
}

function normalizeBidRow(b: RawBidJoin): BidWithBuilder {
  const est = b.estimator
  const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
  const am = b.account_manager
  const accountManagerNorm = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
  return {
    ...b,
    customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers,
    bids_gc_builders: Array.isArray(b.bids_gc_builders) ? b.bids_gc_builders[0] ?? null : b.bids_gc_builders,
    estimator: estimatorNorm,
    account_manager: accountManagerNorm,
  }
}

export async function fetchBidForPreview(bidId: string): Promise<{
  bid: BidWithBuilder | null
  error: string | null
}> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        supabase.from('bids').select(BID_DETAIL_SELECT).eq('id', bidId).maybeSingle(),
      'fetch bid for preview'
    )
    if (!data) {
      return { bid: null, error: null }
    }
    return { bid: normalizeBidRow(data as unknown as RawBidJoin), error: null }
  } catch (e: unknown) {
    return { bid: null, error: formatErrorMessage(e, 'Failed to load bid') }
  }
}
