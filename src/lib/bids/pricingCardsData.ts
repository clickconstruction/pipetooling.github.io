/**
 * Bids → Pricing: what the price cards row reads (region P2, the Pricing / Labor map's step 9,
 * part 1) — the pure half of the three reads the row runs. `useGcNamesById`,
 * `useScenarioCardRevenues` and `useAlternateVersionData` do the reading.
 */
import { bidVersionRowsKey } from './scenarioCardRevenues'

type BidVersionLike = { id: string; customer_id: string | null }
type BidGcLike = { customers?: { name?: string | null } | null; bids_gc_builders?: { name?: string | null } | null }

/** The GCs named on the bid's versions whose names are not loaded yet — each once. */
export function gcIdsToLoad(bidVersions: ReadonlyArray<Pick<BidVersionLike, 'customer_id'>>, known: Readonly<Record<string, string>>): string[] {
  return [...new Set(bidVersions.map((v) => v.customer_id).filter((id): id is string => !!id))].filter((id) => known[id] === undefined)
}

/**
 * The GC a version's letter goes to: its own GC when it names one (an ellipsis while that name
 * loads), else the bid's GC, else its builder, else "the GC". No version (null, or one not on
 * the bid) reads the bid's GC.
 */
export function gcNameForVersion(args: {
  bidVersions: ReadonlyArray<BidVersionLike>
  gcNamesById: Readonly<Record<string, string>>
  bid: BidGcLike | null
  versionId: string | null
}): string {
  const { bidVersions, gcNamesById, bid, versionId } = args
  const v = versionId ? bidVersions.find((x) => x.id === versionId) : undefined
  if (v?.customer_id) return gcNamesById[v.customer_id] ?? '…'
  return bid?.customers?.name ?? bid?.bids_gc_builders?.name ?? 'the GC'
}

/** True when some scenario lives on another bid version than the one on screen — its rows must be read. */
export function needsOtherBidVersionRows(scenarios: ReadonlyArray<{ bid_version_id: string | null }>, activeBidVersionId: string | null): boolean {
  const activeKey = bidVersionRowsKey(activeBidVersionId)
  return scenarios.some((v) => bidVersionRowsKey(v.bid_version_id) !== activeKey)
}

/** The bid's count rows grouped by version, leaving out the version on screen (its rows are already loaded). */
export function countRowsByOtherBidVersion<R extends { bid_version_id: string | null }>(rows: ReadonlyArray<R>, activeBidVersionId: string | null): Map<string, R[]> {
  const activeKey = bidVersionRowsKey(activeBidVersionId)
  const out = new Map<string, R[]>()
  for (const r of rows) {
    const key = bidVersionRowsKey(r.bid_version_id)
    if (key === activeKey) continue
    const list = out.get(key)
    if (list) list.push(r)
    else out.set(key, [r])
  }
  return out
}
