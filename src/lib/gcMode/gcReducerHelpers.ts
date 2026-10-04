/**
 * GC mode — design spike. The reducer's small helpers: change one project, trade, invite or statement of work; add a log line.
 * Split out of gcModel.ts verbatim. Only the reducer reads these; the barrel (gcModel.ts) leaves them out.
 */
import type { GcProject, GcState, Invite, LogEntry, Partner, Sow, TradePackage } from './gcTypes'
import { currentRev, partnerById } from './gcLookups'
import { leveledTotal } from './gcBids'
import { sowExcluded } from './gcExclusions'

// ---------------------------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------------------------

export function mapProject(state: GcState, projectId: string, fn: (p: GcProject) => GcProject): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id === projectId ? fn(p) : p)) }
}

export function mapPackage(project: GcProject, packageId: string, fn: (p: TradePackage) => TradePackage): GcProject {
  return { ...project, packages: project.packages.map((p) => (p.id === packageId ? fn(p) : p)) }
}

export function mapInvite(pkg: TradePackage, inviteId: string, fn: (i: Invite) => Invite): TradePackage {
  return { ...pkg, invites: pkg.invites.map((i) => (i.id === inviteId ? fn(i) : i)) }
}

export function mapSow(pkg: TradePackage, fn: (s: Sow) => Sow): TradePackage {
  return pkg.sow ? { ...pkg, sow: fn(pkg.sow) } : pkg
}

export function logged(state: GcState, who: LogEntry['who'], text: string): GcState {
  const id = (state.log[0]?.id ?? 0) + 1
  return { ...state, log: [{ id, who, text }, ...state.log].slice(0, 30) }
}

export function find(state: GcState, projectId: string, packageId: string, inviteId?: string) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((p) => p.id === packageId)
  const invite = inviteId ? pkg?.invites.find((i) => i.id === inviteId) : undefined
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  return { project, pkg, invite, partner }
}

export function awardedPartner(state: GcState, pkg: TradePackage | undefined): Partner | undefined {
  const invite = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

/** A statement of work drawn from the leveled bid: the price, the scope as a schedule of values. */
export function sowFromBid(project: GcProject, pkg: TradePackage, invite: Invite): Sow {
  const price = leveledTotal(pkg, invite) ?? pkg.budget
  const each = Math.floor(price / Math.max(1, pkg.scope.length) / 100) * 100
  const sov = pkg.scope.map((item, i) => ({
    id: item.id,
    label: item.label,
    amount: i === pkg.scope.length - 1 ? price - each * (pkg.scope.length - 1) : each,
    pctReported: 0,
    pctBilled: 0,
  }))
  // Their own schedule of values rides onto the statement of work (question 4), beside ours.
  const theirs = invite.bid?.sov
  return {
    status: 'draft',
    price,
    retainagePct: 10,
    basedOnRev: currentRev(project),
    sov,
    signedOn: null,
    draws: [],
    ...(theirs && theirs.length > 0 ? { theirSov: theirs } : {}),
    // What the contract says they will not do (the owner, 2026-10-04), from the quote awarded.
    ...(invite.bid?.exclusions && invite.bid.exclusions.length > 0 ? { excluded: sowExcluded(pkg, invite.bid) } : {}),
  }
}
