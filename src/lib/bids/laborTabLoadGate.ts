/**
 * Labor tab load gate (journey-map J11-F1 / T1 / N1).
 *
 * Count rows are per bid Version (v2.2132), and the engine's takeoff loaders read the
 * active version synchronously from a bid-tagged ref. The Labor/Takeoffs cost-estimate
 * effect used to call `loadCostEstimateData` the moment a bid was picked — before that
 * ref pointed at the new bid — so the count-rows query ran as `bid_version_id IS NULL`
 * and came back empty on every versioned bid: "Add fixtures in the Counts tab first."
 * on a bid full of fixtures, healed only by a tab round-trip. These pure helpers make
 * the two decisions that effect and the tab now take.
 */

export type TaggedVersionRef = { bidId: string; versionId: string | null } | null

/**
 * Should the cost-estimate load run now? Only once the active-version ref belongs to the
 * bid being loaded — otherwise the query would filter on the wrong version (or Base) and
 * return a false empty set. `versionId` is the committed React state the effect re-runs
 * on; when the ref and the state disagree a re-run is already scheduled, so the caller
 * should wait for it rather than load twice.
 */
export function shouldLoadCostEstimate(args: { bidId: string | null; resolvedFor: TaggedVersionRef; versionId: string | null }): boolean {
  const { bidId, resolvedFor, versionId } = args
  if (!bidId || !resolvedFor) return false
  return resolvedFor.bidId === bidId && resolvedFor.versionId === versionId
}

/**
 * After the effect resolved the version itself (`loadBidVersions` → `pickActiveVersion`),
 * does it have to load directly, or will the state change re-run it? Setting the same
 * value React already holds (Base → Base across two unsplit bids) schedules no re-render,
 * so waiting would leave the tab on the skeleton forever.
 */
export function loadAfterResolve(args: { picked: string | null; versionId: string | null }): boolean {
  return args.picked === args.versionId
}

export type LaborTabPanel = 'skeleton' | 'empty' | 'table'

/**
 * What the Labor tab renders under the bid header. The empty sentence is allowed only
 * once the load for THIS bid has settled with zero rows — never while the version is
 * still resolving, where it reads as deleted work.
 */
export function laborEmptyState(args: { resolved: boolean; rowCount: number }): LaborTabPanel {
  if (!args.resolved) return 'skeleton'
  return args.rowCount > 0 ? 'table' : 'empty'
}

/**
 * Should opening the tab mint a `cost_estimates` row? Only when the resolved version has
 * count rows: the HOURS table is made of `cost_estimate_labor_rows`, which need the parent
 * row to exist (and Pricing reads those rows for its margins). A bid with no fixtures —
 * including the false-empty frame this module exists to prevent — gets no row until a
 * user writes something (decision 17, 2026-09-05: records follow an explicit commit).
 */
export function shouldMintCostEstimateOnLoad(args: { rowCount: number }): boolean {
  return args.rowCount > 0
}
