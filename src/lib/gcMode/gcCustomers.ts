/**
 * GC mode — design spike. The one company window: an owner's and an architect's summary.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcCustomer, GcProject, GcState, PlanQuestion } from './gcTypes'
import { daysUntil } from './gcWords'
import { proposalTotals } from './gcBids'

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
    if (project.stage === 'pursuing') sum.inFront += price
    else {
      sum.underContract += price
      sum.won += 1
    }
    if (project.ownerBilling) {
      sum.billed += project.ownerBilling.billed
      sum.paid += project.ownerBilling.paid
      sum.retainageHeld += project.ownerBilling.retainageHeld
    }
  }
  sum.owed = sum.billed - sum.retainageHeld - sum.paid
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
