import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'

export type WorkingBoardClockBidPick = Extract<UnifiedSearchResult, { source: 'bid' }>

type BidJoinRow = {
  id: string
  bid_number: string | null
  service_type_id: string | null
  project_name: string | null
  address: string | null
  customers: { name: string | null } | { name: string | null }[] | null
  bids_gc_builders: { name: string | null } | { name: string | null }[] | null
  service_type: { name: string | null } | { name: string | null }[] | null
}

function single<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? x[0] ?? null : x
}

/** Bids in the user's Working-board "working" column, ordered for Clock In quick picks. */
export async function fetchWorkingBoardClockBidPicks(userId: string | null | undefined): Promise<WorkingBoardClockBidPick[]> {
  if (!userId) return []
  try {
    const workingColRow = (await withSupabaseRetry(
      async () =>
        supabase.from('bid_working_board_columns').select('id').eq('user_id', userId).eq('system_key', 'working').maybeSingle(),
      'fetch working board working column',
    )) as { id: string } | null
    const colId = workingColRow?.id
    if (!colId) return []

    const placements = (await withSupabaseRetry(
      async () =>
        supabase
          .from('bid_working_board_placements')
          .select('bid_id, position')
          .eq('user_id', userId)
          .eq('column_id', colId)
          .order('position', { ascending: true }),
      'fetch working board working placements',
    )) as { bid_id: string; position: number }[] | null
    const pl = placements ?? []
    if (pl.length === 0) return []

    const orderedIds = pl.map((p) => p.bid_id)
    const bidRows = (await withSupabaseRetry(
      async () =>
        supabase
          .from('bids')
          .select(
            'id, bid_number, service_type_id, project_name, address, customers(name), bids_gc_builders(name), service_type:service_types(name)',
          )
          .in('id', orderedIds)
          .is('working_board_archived_at', null),
      'fetch bids for working board clock picks',
    )) as BidJoinRow[] | null
    const rows = bidRows ?? []
    const byId = new Map(rows.map((r) => [r.id, r]))

    const out: WorkingBoardClockBidPick[] = []
    for (const id of orderedIds) {
      const r = byId.get(id)
      if (!r) continue
      const cust = single(r.customers)
      const gc = single(r.bids_gc_builders)
      const st = single(r.service_type)
      const custName = (cust?.name ?? '').trim()
      const gcName = (gc?.name ?? '').trim()
      out.push({
        source: 'bid',
        id: r.id,
        bid_number: r.bid_number ?? '',
        project_name: r.project_name ?? '',
        address: r.address ?? '',
        customer_name: custName || gcName,
        service_type_name: st?.name ?? null,
        service_type_id: r.service_type_id ?? null,
      })
    }
    return out
  } catch {
    return []
  }
}
