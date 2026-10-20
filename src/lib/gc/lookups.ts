/**
 * GC mode, the real build: lookups the kernels share, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcLookups.ts`) by the schedule's PR 1a.
 */
import type { GcProject, GcState, Partner, TradePackage } from './types'

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

export function planLabel(project: GcProject, rev: number | null): string {
  if (rev === null) return 'not opened'
  return project.planSets.find((s) => s.rev === rev)?.label ?? `Rev ${rev}`
}

export function currentRev(project: GcProject): number {
  return project.planSets.reduce((max, s) => Math.max(max, s.rev), 0)
}

export function find(state: GcState, projectId: string, packageId: string, inviteId?: string) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((p) => p.id === packageId)
  const invite = inviteId ? pkg?.invites.find((i) => i.id === inviteId) : undefined
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  return { project, pkg, invite, partner }
}

/** How many invited trade partners have opened the newest set. */
export function plansReach(project: GcProject): { have: number; of: number } {
  const rev = currentRev(project)
  const invites = project.packages.flatMap((p) => p.invites).filter((i) => i.status !== 'declined')
  return { have: invites.filter((i) => i.seenRev === rev).length, of: invites.length }
}
