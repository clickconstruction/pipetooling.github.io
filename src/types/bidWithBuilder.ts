import type { Database } from './database'

type Bid = Database['public']['Tables']['bids']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']

/** Users join shape from `bids` estimator / account_manager FK selects */
export type EstimatorUser = { id: string; name: string | null; email: string }

/** `service_types` join from bid list / preview select */
export type BidServiceTypeJoin = Pick<
  Database['public']['Tables']['service_types']['Row'],
  'id' | 'name' | 'color'
>

export type BidWithBuilder = Bid & {
  customers: Customer | null
  bids_gc_builders: GcBuilder | null
  estimator?: EstimatorUser | EstimatorUser[] | null
  account_manager?: EstimatorUser | EstimatorUser[] | null
  service_type?: BidServiceTypeJoin | null
}
