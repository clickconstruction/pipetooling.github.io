/**
 * GC mode — design spike: the Project Board grouped by customer (open question 9; the owner,
 * 2026-10-04: a switch between By stage and By customer, By stage selected every time the board
 * opens). The rows are the same; only the sections change. Each customer's section carries the
 * company window's money, and its closed and lost jobs fold into one quiet line.
 */
import type { GcCustomer, GcProject, GcStage, GcState } from './gcTypes'
import { customerSummary, type CustomerSummary } from './gcCustomers'
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
