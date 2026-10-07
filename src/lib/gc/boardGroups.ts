/**
 * GC mode, the real build, the Board's B2: the board's sections and its customers, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBoardGroups.ts`).
 */
import type { CustomerSummary } from './customers'
import type { GcCustomer, GcProject, GcStage } from './types'
import { money } from './words'

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
