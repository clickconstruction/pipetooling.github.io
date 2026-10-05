/**
 * GC mode — design spike: the Project Board grouped by customer (open question 9; the owner,
 * 2026-10-04: a switch between By stage and By customer, By stage selected every time the board
 * opens). The rows are the same; only the sections change. Each customer's section carries the
 * company window's money, and its closed and lost jobs fold into one quiet line.
 */
import type { GcCustomer, GcProject, GcStage, GcState } from './gcTypes'
import { customerSummary, priceToOwner, type CustomerSummary } from './gcCustomers'
import { money } from './gcWords'

export type BoardGroupBy = 'stage' | 'customer'

export interface CustomerGroup {
  customer: GcCustomer
  /** Jobs still moving: bidding, buying out, building. Stage order, soonest first inside one. */
  open: GcProject[]
  /** Newest first. */
  closed: GcProject[]
  /** Newest first. */
  lost: GcProject[]
  summary: CustomerSummary
}

const STAGE_ORDER: Record<GcStage, number> = { pursuing: 0, buyout: 1, building: 2 }

/** The day that matters next on an open job: our bid due while bidding, the start while buying out. */
function nextDay(project: GcProject): string | null {
  if (project.stage === 'pursuing') return project.bidDue
  if (project.stage === 'buyout') return project.startDate ?? null
  return null
}

function isOpen(project: GcProject): boolean {
  return !project.closedOn && !project.lostOn
}

/**
 * One group per customer we build for (the project's owner, not its architect). Customers sort by
 * the soonest day due on their open jobs, so one with a bid due Thursday comes first; customers
 * with nothing due follow, then those with only closed or lost jobs, each by name.
 */
export function customerGroups(state: GcState): CustomerGroup[] {
  const groups: CustomerGroup[] = []
  for (const customer of state.customers) {
    const theirs = state.projects.filter((p) => p.customerId === customer.id)
    if (theirs.length === 0) continue
    groups.push({
      customer,
      open: theirs
        .filter(isOpen)
        .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || (nextDay(a) ?? '9999').localeCompare(nextDay(b) ?? '9999')),
      closed: theirs.filter((p) => p.closedOn).sort((a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? '')),
      lost: theirs.filter((p) => p.lostOn).sort((a, b) => (b.lostOn ?? '').localeCompare(a.lostOn ?? '')),
      summary: customerSummary(state, customer),
    })
  }
  const rank = (g: CustomerGroup) => {
    const days = g.open.map(nextDay).filter((d): d is string => Boolean(d)).sort()
    return days[0] ?? (g.open.length > 0 ? '9998' : '9999')
  }
  return groups.sort((a, b) => rank(a).localeCompare(rank(b)) || a.customer.name.localeCompare(b.customer.name))
}

/**
 * The money line under a customer's name: "bidding $977,823 · under contract $1,488,762 · owes us
 * $288,879". A customer under contract who has not been billed reads "nothing billed yet". Empty
 * when nothing is in front of them or under contract.
 */
export function customerMoneyWords(summary: CustomerSummary): string {
  const parts: string[] = []
  if (summary.inFront > 0) parts.push(`bidding ${money(summary.inFront)}`)
  if (summary.underContract > 0) {
    parts.push(`under contract ${money(summary.underContract)}`)
    parts.push(summary.billed > 0 ? `owes us ${money(summary.owed)}` : 'nothing billed yet')
  }
  return parts.join(' · ')
}

/** The board's five sections: the three stages, then Closed and Lost. */
export type BoardSection = GcStage | 'closed' | 'lost'

export const BOARD_SECTION_ORDER: BoardSection[] = ['pursuing', 'buyout', 'building', 'closed', 'lost']

/** Which section a job sits in: a closed or lost job leaves its stage for its own section. */
export function boardSectionOf(project: GcProject): BoardSection {
  if (project.lostOn) return 'lost'
  if (project.closedOn) return 'closed'
  return project.stage
}

export interface BoardSectionCount {
  key: BoardSection
  count: number
  /** What the section's jobs are worth to their customers: priced so far while bidding, as signed after. */
  worth: number
}

/**
 * The stage strip at the top of the board (the owner, 2026-10-04: "just like on jobs stages … a
 * header … so it's easy for a user to jump to a stage"): each section's job count and worth.
 */
export function boardSectionCounts(state: GcState): BoardSectionCount[] {
  return BOARD_SECTION_ORDER.map((key) => {
    const jobs = state.projects.filter((p) => boardSectionOf(p) === key)
    return { key, count: jobs.length, worth: jobs.reduce((t, p) => t + priceToOwner(p).price, 0) }
  })
}

/** "$977,823 priced so far", "$338,767 under contract": the money words beside a stage's title. */
export function boardSectionWorthWords(section: BoardSectionCount): string {
  if (section.count === 0 || section.worth === 0) return ''
  if (section.key === 'pursuing') return `${money(section.worth)} priced so far`
  if (section.key === 'buyout' || section.key === 'building') return `${money(section.worth)} under contract`
  if (section.key === 'closed') return `${money(section.worth)} built`
  return ''
}

/** The element id a section's heading carries, for the strip to jump to. */
export function boardSectionElementId(key: BoardSection): string {
  return `gc-board-${key}`
}

/** The element id a customer's heading carries on By customer. */
export function boardCustomerElementId(customerId: string): string {
  return `gc-board-customer-${customerId}`
}
