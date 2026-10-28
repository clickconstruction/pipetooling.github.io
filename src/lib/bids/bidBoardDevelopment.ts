/**
 * The development on the Bid Board (punch list #208, PR 1, v2.6019): the house line under a
 * row's customer, the search by name and the house filter beside the search. The Pipeline's
 * `developmentFilterOptionsFromJobs` / `filterJobsByDevelopment` (`jobsStagesBoard.ts`) are the
 * pattern; these are the bid versions over the board's own rows, so the two boards read a
 * development the same way.
 */

/** The embedded `development:development_id(id, name)` join a bid row carries. */
export type BidDevelopmentJoin = { id: string; name: string | null } | null | undefined

/** The slice of a bid row these helpers read. */
export type BidWithDevelopment = { development?: BidDevelopmentJoin }

/** Sentinel for the house filter: only bids WITHOUT a development (the fill-them-in worklist). */
export const BID_BOARD_DEVELOPMENT_FILTER_NONE = 'no-development'

/** A bid's development name as the row prints it: trimmed, or null when the bid has none. */
export function bidDevelopmentName(bid: BidWithDevelopment): string | null {
  const d = bid.development
  if (!d?.id) return null
  return (d.name ?? '').trim() || '—'
}

/** Distinct developments among the loaded bids, name-sorted, for the house filter's list. */
export function developmentFilterOptionsFromBids(bids: readonly BidWithDevelopment[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const b of bids) {
    const d = b.development
    if (d?.id && !byId.has(d.id)) byId.set(d.id, (d.name ?? '').trim() || '—')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** '' / null = every bid; BID_BOARD_DEVELOPMENT_FILTER_NONE = bids without a development; else one development's bids. */
export function filterBidsByDevelopment<T extends BidWithDevelopment>(bids: readonly T[], developmentFilter: string | null): T[] {
  if (!developmentFilter) return [...bids]
  if (developmentFilter === BID_BOARD_DEVELOPMENT_FILTER_NONE) return bids.filter((b) => !b.development?.id)
  return bids.filter((b) => b.development?.id === developmentFilter)
}

/** The board's search matches a bid by its development's name, as the Pipeline's does (v2.1199). */
export function bidMatchesDevelopmentQuery(bid: BidWithDevelopment, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  const name = (bid.development?.name ?? '').trim().toLowerCase()
  return name !== '' && name.includes(q)
}

/** What the house filter's chip and its clear press read: the development's name, or the no-development words. */
export function developmentFilterLabel(developmentFilter: string, options: ReadonlyArray<{ id: string; name: string }>): string {
  if (developmentFilter === BID_BOARD_DEVELOPMENT_FILTER_NONE) return 'No development set'
  return options.find((o) => o.id === developmentFilter)?.name ?? 'Development'
}
