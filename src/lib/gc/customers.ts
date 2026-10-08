/**
 * GC mode, the real build, the Board's B2: an architect's summary, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCustomers.ts`).
 */
import type { GcCustomer, GcProject, GcState, PlanQuestion } from './types'
import { daysUntil } from './words'

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

export interface ArchitectSummary {
  live: GcProject[]
  sets: number
  addenda: number
  /** Sent to them and not answered: days count from the day we sent it, their own wait. */
  waiting: { project: GcProject; question: PlanQuestion; days: number }[]
  /** Asked by a trade and not sent to them yet: ours to send, days from the ask. */
  notSent: { project: GcProject; question: PlanQuestion; days: number }[]
  answered: { project: GcProject; question: PlanQuestion }[]
}

/** The same company as an architect: the sets they issued, the questions they owe us. */
export function architectSummary(state: GcState, architect: GcCustomer): ArchitectSummary {
  const live = state.projects.filter((p) => p.architectId === architect.id)
  const sum: ArchitectSummary = { live, sets: 0, addenda: 0, waiting: [], notSent: [], answered: [] }
  for (const project of live) {
    sum.sets += project.planSets.length
    sum.addenda += project.planSets.filter((s) => s.rev > 0).length
    for (const question of project.questions) {
      // The architect's wait starts the day we sent it (the owner's go, 2026-10-03), not the day a
      // trade asked: a question we have not sent yet is waiting on us.
      if (question.answeredOn) sum.answered.push({ project, question })
      else if (question.sentToArchitectOn) sum.waiting.push({ project, question, days: daysUntil(state.today, question.sentToArchitectOn) })
      else sum.notSent.push({ project, question, days: daysUntil(state.today, question.askedOn) })
    }
  }
  sum.waiting.sort((a, b) => b.days - a.days)
  sum.notSent.sort((a, b) => b.days - a.days)
  return sum
}
