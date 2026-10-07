/**
 * GC mode, the real build, the Building lane's U2: the submittal register, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingSubmittals.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
import { addDays } from './building'
import { partnerById } from './lookups'
import { daysBetween } from './schedule/schedule'
import type { GcProject, GcState, Submittal, TradePackage } from './types'

/**
 * Whose move it is. The trade's: asked and not sent yet, or sent back to revise. Ours: sent, not
 * yet to the architect. The architect's: with them. Approved: approved, or approved as noted.
 */
export type SubmittalState = 'trade' | 'us' | 'architect' | 'approved'

export function submittalState(s: Submittal): SubmittalState {
  const last = s.rounds[s.rounds.length - 1]
  if (!last || last.answer === 'revise') return 'trade'
  if (last.answer) return 'approved'
  return last.toArchitectOn ? 'architect' : 'us'
}

/** The day it was approved. Null: not yet. */
export function submittalApprovedOn(s: Submittal): string | null {
  const last = s.rounds[s.rounds.length - 1]
  return last && last.answer && last.answer !== 'revise' ? last.answeredOn : null
}

/**
 * The day it is needed approved by: the first start of the lines it holds on the schedule, less
 * its lead days. With none of its lines on the schedule, the day the office set. Null: neither.
 */
export function submittalNeededBy(project: GcProject, s: Submittal): string | null {
  const starts = (project.schedule?.activities ?? []).filter((a) => s.lineIds.includes(a.lineId)).map((a) => a.start)
  if (starts.length === 0) return s.neededBy ?? null
  const first = starts.reduce((m, d) => (d < m ? d : m))
  return addDays(first, -s.leadDays)
}

export interface SubmittalRow {
  submittal: Submittal
  pkg: TradePackage | null
  company: string
  state: SubmittalState
  neededBy: string | null
  approvedOn: string | null
  /** Days past the day it was needed: by today while not approved, or by the day it was approved. 0: on time. */
  daysLate: number
}

function companyOf(state: GcState, pkg: TradePackage | undefined): string {
  if (!pkg) return 'A trade'
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
}

/** The register, in the order added, each with whose move it is and how late. */
export function submittalRows(state: GcState, project: GcProject): SubmittalRow[] {
  return submittalRowsOn(project, state.today).map((r) => ({ ...r, company: companyOf(state, r.pkg ?? undefined) }))
}

/** The same rows without the company's name: what a trade's portal reads, with only its project and today. */
export function submittalRowsOn(project: GcProject, today: string): SubmittalRow[] {
  return (project.submittals ?? []).map((submittal) => {
    const pkg = project.packages.find((k) => k.id === submittal.packageId) ?? null
    const neededBy = submittalNeededBy(project, submittal)
    const approvedOn = submittalApprovedOn(submittal)
    const until = approvedOn ?? today
    const daysLate = neededBy ? Math.max(0, daysBetween(neededBy, until)) : 0
    return { submittal, pkg, company: pkg?.trade ?? 'A trade', state: submittalState(submittal), neededBy, approvedOn, daysLate }
  })
}

/** How the register stands: whose move, and how many are late and not approved. */
export function submittalCounts(state: GcState, project: GcProject): Record<SubmittalState, number> & { late: number } {
  const rows = submittalRows(state, project)
  const n = (st: SubmittalState) => rows.filter((r) => r.state === st).length
  return { trade: n('trade'), us: n('us'), architect: n('architect'), approved: n('approved'), late: rows.filter((r) => r.state !== 'approved' && r.daysLate > 0).length }
}

/** The submittal not yet approved that holds a schedule line. Null: none holds it. */
export function submittalHolding(project: GcProject, lineId: string): Submittal | null {
  return (project.submittals ?? []).find((s) => s.lineIds.includes(lineId) && submittalState(s) !== 'approved') ?? null
}

/** The next number in the register for a spec section: "26 24 16-02". Without a section, a plain count. */
export function nextSubmittalNumber(project: GcProject, specSection?: string): string {
  const all = project.submittals ?? []
  if (!specSection) return String(all.length + 1).padStart(3, '0')
  const n = all.filter((s) => s.specSection === specSection).length + 1
  return `${specSection}-${String(n).padStart(2, '0')}`
}

/** The next id on the project. */
export function nextSubmittalId(project: GcProject): string {
  const n = (project.submittals ?? []).reduce((m, s) => Math.max(m, Number(s.id.split('-').pop()) || 0), 0)
  return `${project.id}-sub-${n + 1}`
}
