/**
 * GC mode — design spike. Small lookups many areas read: a plan set's label, the newest set, a company by id.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject } from './gcTypes'
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { ownBidPriced, partnerById } from '../gc/lookups'

export function planLabel(project: GcProject, rev: number | null): string {
  if (rev === null) return 'not opened'
  return project.planSets.find((s) => s.rev === rev)?.label ?? `Rev ${rev}`
}
export function currentRev(project: GcProject): number {
  return project.planSets.reduce((max, s) => Math.max(max, s.rev), 0)
}
