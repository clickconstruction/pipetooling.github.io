import type { Database } from '../types/database'

type BidWorkingColumn = Database['public']['Tables']['bid_working_board_columns']['Row']
type BidWorkingPlacement = Database['public']['Tables']['bid_working_board_placements']['Row']

/** Minimal bid fields used by the Working board column map (matches `BidsWorkingBoardBid` core). */
export type BidWorkingBoardMapBid = Pick<
  Database['public']['Tables']['bids']['Row'],
  'id' | 'project_name' | 'address' | 'bid_number' | 'estimator_id' | 'account_manager_id'
>

function sortBidIdsImplicit(aId: string, bId: string, bidMap: Map<string, BidWorkingBoardMapBid>): number {
  const a = bidMap.get(aId)
  const b = bidMap.get(bId)
  const an = (a?.project_name ?? '').toLowerCase()
  const bn = (b?.project_name ?? '').toLowerCase()
  if (an !== bn) return an.localeCompare(bn)
  return aId.localeCompare(bId)
}

/**
 * Content signature of the bids that feed a Working-board load: membership (id),
 * the assignment fields the loads filter by, and `project_name` — the only field
 * `buildColumnBidMap` sorts implicit inbox cards by. Order-insensitive, so a
 * re-sorted or identity-replaced bids array with the same content yields the
 * same signature.
 */
export function workingBoardBidsSignature(
  bids: readonly Pick<BidWorkingBoardMapBid, 'id' | 'project_name' | 'estimator_id' | 'account_manager_id'>[]
): string {
  return bids
    .map((b) => `${b.id}\u0000${b.project_name ?? ''}\u0000${b.estimator_id ?? ''}\u0000${b.account_manager_id ?? ''}`)
    .sort()
    .join('\u0001')
}

export function buildColumnBidMap(
  columns: BidWorkingColumn[],
  placements: BidWorkingPlacement[],
  assignedBids: BidWorkingBoardMapBid[]
): Record<string, string[]> {
  const assignedIds = new Set(assignedBids.map((b) => b.id))
  const bidMap = new Map(assignedBids.map((b) => [b.id, b]))
  const placedIds = new Set(placements.map((p) => p.bid_id))
  const inboxCol = columns.find((c) => c.system_key === 'inbox')

  const byCol: Record<string, { bidId: string; position: number }[]> = {}
  for (const p of placements) {
    if (!assignedIds.has(p.bid_id)) continue
    const key = p.column_id
    let bucket = byCol[key]
    if (!bucket) {
      bucket = []
      byCol[key] = bucket
    }
    bucket.push({ bidId: p.bid_id, position: p.position })
  }
  for (const k of Object.keys(byCol)) {
    const bucket = byCol[k]
    if (bucket) bucket.sort((x, y) => x.position - y.position)
  }

  const result: Record<string, string[]> = {}
  for (const c of columns) {
    result[c.id] = (byCol[c.id] ?? []).map((x) => x.bidId)
  }

  if (inboxCol) {
    const implicit = assignedBids.filter((b) => !placedIds.has(b.id)).map((b) => b.id)
    implicit.sort((a, b) => sortBidIdsImplicit(a, b, bidMap))
    const explicitInbox = result[inboxCol.id] ?? []
    const explicitSet = new Set(explicitInbox)
    const onlyImplicit = implicit.filter((id) => !explicitSet.has(id))
    result[inboxCol.id] = [...explicitInbox, ...onlyImplicit]
  }

  return result
}
