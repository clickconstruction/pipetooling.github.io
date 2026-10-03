/**
 * GC mode — design spike. Small lookups many areas read: a plan set's label, the newest set, a company by id.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Partner, TradePackage } from './gcTypes'

export function planLabel(project: GcProject, rev: number | null): string {
  if (rev === null) return 'not opened'
  return project.planSets.find((s) => s.rev === rev)?.label ?? `Rev ${rev}`
}

export function currentRev(project: GcProject): number {
  return project.planSets.reduce((max, s) => Math.max(max, s.rev), 0)
}

export function partnerById(state: GcState, id: string): Partner | undefined {
  return state.partners.find((p) => p.id === id)
}

/**
 * Our own trade has a real number: its bid in Trades mode is priced. A missing `priced` means
 * priced, so projects written before it are unchanged. False for a trade we hire out.
 */
export function ownBidPriced(pkg: TradePackage): boolean {
  return pkg.selfPerform !== null && pkg.selfPerform.priced !== false
}
