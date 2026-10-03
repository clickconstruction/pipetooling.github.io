/**
 * GC mode — design spike. The one company window: an owner's and an architect's summary.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcCustomer, GcProject, GcState, PlanQuestion } from './gcTypes'
import { daysUntil } from './gcWords'
import { proposalTotals } from './gcBids'
import { ownerAccount } from './gcOwnerBilling'

export interface CustomerSummary {
  live: GcProject[]
  /** Our price on the projects we are still bidding to them. */
  inFront: number
  /** Our price on the projects they gave us. */
  underContract: number
  billed: number
  paid: number
  owed: number
  retainageHeld: number
  asked: number
  won: number
}

/**
 * What a project's owner has been billed, has paid and is holding. Our sent pay applications when
 * any went (`ownerAccount`, the owner's ask 2026-10-03); before the first one, the record's
 * made-up `ownerBilling`. Null when neither: nothing billed yet.
 */
export function ownerMoney(project: GcProject): { billed: number; paid: number; retainageHeld: number; owed: number } | null {
  // Owed is the account's own (asked less paid): once the architect certifies less than we asked,
  // billed - held - paid would count the cut twice, since the cut comes back on the next bill.
  const account = ownerAccount(project)
  if (account) return { billed: account.billed, paid: account.paid, retainageHeld: account.retainageHeld, owed: account.owed }
  const record = project.ownerBilling
  return record
    ? { billed: record.billed, paid: record.paid, retainageHeld: record.retainageHeld, owed: record.billed - record.retainageHeld - record.paid }
    : null
}

/** One customer across every project: what is live, what is owed, how often they pick us. */
export function customerSummary(state: GcState, customer: GcCustomer): CustomerSummary {
  const live = state.projects.filter((p) => p.customerId === customer.id)
  const sum: CustomerSummary = {
    live,
    inFront: 0,
    underContract: 0,
    billed: 0,
    paid: 0,
    owed: 0,
    retainageHeld: 0,
    asked: live.length + customer.past.length,
    won: customer.past.filter((p) => p.outcome === 'built').length,
  }
  for (const project of live) {
    const price = proposalTotals(project).price
    // A lost bid is no longer in front of them (owner, 2026-10-03); the window counts it as a loss.
    if (project.lostOn) continue
    if (project.stage === 'pursuing') sum.inFront += price
    else {
      sum.underContract += price
      sum.won += 1
    }
    const money = ownerMoney(project)
    if (money) {
      sum.billed += money.billed
      sum.paid += money.paid
      sum.retainageHeld += money.retainageHeld
      sum.owed += money.owed
    }
  }
  return sum
}

export interface ArchitectSummary {
  live: GcProject[]
  sets: number
  addenda: number
  waiting: { project: GcProject; question: PlanQuestion; days: number }[]
  answered: { project: GcProject; question: PlanQuestion }[]
}

/** The same company as an architect: the sets they issued, the questions they owe us. */
export function architectSummary(state: GcState, architect: GcCustomer): ArchitectSummary {
  const live = state.projects.filter((p) => p.architectId === architect.id)
  const sum: ArchitectSummary = { live, sets: 0, addenda: 0, waiting: [], answered: [] }
  for (const project of live) {
    sum.sets += project.planSets.length
    sum.addenda += project.planSets.filter((s) => s.rev > 0).length
    for (const question of project.questions) {
      if (question.answeredOn) sum.answered.push({ project, question })
      else sum.waiting.push({ project, question, days: daysUntil(state.today, question.askedOn) })
    }
  }
  sum.waiting.sort((a, b) => b.days - a.days)
  return sum
}
