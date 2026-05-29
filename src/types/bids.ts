import type { Database } from './database'

/**
 * Shared Bids DB row aliases, extracted from `src/pages/Bids.tsx` so the pure helper modules in
 * `src/lib/bids/` can reference them without importing the page component. Only the aliases used
 * outside `Bids.tsx` live here; the rest remain local to the page for now.
 */
export type Bid = Database['public']['Tables']['bids']['Row']
export type BidCountRow = Database['public']['Tables']['bids_count_rows']['Row']
