/**
 * Bids → Pricing: does the bid-wide labor estimate match the ACTIVE version's counts?
 * (punch list #135 PR 2.) Labor rows belong to the bid and are re-synced to a version's
 * counts only when Labor or Takeoffs loads, so on a bid whose versions carry different
 * counts the margin can silently read against the other version's labor. The detector is
 * `planLaborSync` itself with nothing parked: after any Labor visit the plan is empty by
 * construction, so a non-empty plan means exactly "Labor has not seen these counts".
 */
import { planLaborSync, type SyncCountRow, type SyncLaborRow } from './laborSyncPlan'

export function laborCountsOutOfStep(input: {
  countRows: ReadonlyArray<SyncCountRow>
  laborRows: ReadonlyArray<SyncLaborRow>
}): boolean {
  const { countRows, laborRows } = input
  // No labor yet is the setup story, not drift; with no counts the Workbench isn't here anyway.
  if (laborRows.length === 0 || countRows.length === 0) return false
  const plan = planLaborSync({ countRows, laborRows, parkedRows: [] })
  return plan.renames.length > 0 || plan.takeBacks.length > 0 || plan.mints.length > 0 || plan.countUpdates.length > 0 || plan.parks.length > 0
}
