/**
 * GC mode, the real build: questions about the plans in the prototype's shape (`PlanQuestion` on a `GcProject`, stage `pursuing`), moved
 * word for word from the GC mode prototype (branch spike/gc-mode, `gcPlans.ts` and `gcStageHealth.ts`) by the Portal lane's P1b-i, for
 * the portal's reads. Main's row-shaped questions (stage `bidding`) are `questions.ts`; the two never mix.
 */
import type { QuestionState } from './questions'
import { QUESTIONS_CLOSE_DAYS } from './questions'
import type { GcProject, PlanQuestion } from './types'

/**
 * The day questions close on a project we are bidding: three days before our bid is due. From
 * that day on no company can ask. Null: they never close, because there is no due date or the
 * job is ours (questions while building are part of the work).
 */
export function questionsCloseOn(project: GcProject): string | null {
  if (project.stage !== 'pursuing' || !project.bidDue) return null
  const [y, m, d] = project.bidDue.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - QUESTIONS_CLOSE_DAYS)).toISOString().slice(0, 10)
}

/** Where a question stands: asked and not sent on, with the architect, or answered. */
export function questionState(q: PlanQuestion): QuestionState {
  if (q.answer !== null) return 'answered'
  return q.sentToArchitectOn ? 'with the architect' : 'asked'
}

/** One trade's questions, the newest first. */
export function questionsFor(project: GcProject, packageId: string): PlanQuestion[] {
  return project.questions.filter((q) => q.packageId === packageId).sort((a, b) => b.askedOn.localeCompare(a.askedOn))
}

/**
 * The day we want every quote in: the day questions close, three days before our bid is due, so
 * there are days left to level the quotes and price our bid. Null: no bid date, or not bidding.
 * The trades' portal gives it as their due day (the Portal lane's `portalQuoteDue`): if this ever
 * stops being the questions-close day, say which one the trades' due day follows.
 */
export function quotesWantedOn(project: GcProject): string | null {
  return questionsCloseOn(project)
}
