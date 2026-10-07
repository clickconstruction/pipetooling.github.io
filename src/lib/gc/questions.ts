/**
 * GC mode, the real build, step 8: questions about the plans, moved from the prototype (branch
 * spike/gc-mode, `gcPlans.ts`). A company asks; the office sends it to the architect and records
 * the answer; a new set of plans carries the answers in its note. Questions close three days
 * before our bid is due (the owner, 2026-10-03), and never open on a bid we lost. The database
 * holds the same rule (`gc_questions_close_on`); these read it for the screen.
 */

export type QuestionState = 'asked' | 'with the architect' | 'answered'

/** Questions close this many days before our bid is due. */
export const QUESTIONS_CLOSE_DAYS = 3

export interface PlanQuestionView {
  id: string
  packageId: string | null
  /** Who asked, as the office typed it. */
  askedByName: string
  text: string
  /** The sheets the question is about. */
  sheets: string[]
  askedOn: string
  /** The day we sent it to the architect. Null: not sent yet. */
  sentToArchitectOn: string | null
  answeredOn: string | null
  answer: string
  /** The plan set that carried the answer, by id. Null: not in a set yet. */
  inSetId: string | null
}

export interface QuestionsProject {
  stage: string
  bidDue: string | null
  lostOn: string | null
  questions: PlanQuestionView[]
}

/** The day questions close: three days before our bid is due while we bid. Null: they never close. */
export function questionsCloseOn(project: Pick<QuestionsProject, 'stage' | 'bidDue'>): string | null {
  if (project.stage !== 'bidding' || !project.bidDue) return null
  const [y, m, d] = project.bidDue.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - QUESTIONS_CLOSE_DAYS)).toISOString().slice(0, 10)
}

/** A company can still ask today. Never on a bid we lost. */
export function questionsOpen(project: Pick<QuestionsProject, 'stage' | 'bidDue' | 'lostOn'>, today: string): boolean {
  if (project.lostOn) return false
  const close = questionsCloseOn(project)
  return close === null || today < close
}

/** Where a question stands: asked and not sent on, with the architect, or answered. */
export function questionState(q: PlanQuestionView): QuestionState {
  if (q.answeredOn !== null) return 'answered'
  return q.sentToArchitectOn ? 'with the architect' : 'asked'
}

/** The questions still waiting on an answer, the oldest first. */
export function openQuestions(project: Pick<QuestionsProject, 'questions'>): PlanQuestionView[] {
  return project.questions.filter((q) => q.answeredOn === null).sort((a, b) => a.askedOn.localeCompare(b.askedOn))
}

/** The answered questions, the newest answer first. */
export function answeredQuestions(project: Pick<QuestionsProject, 'questions'>): PlanQuestionView[] {
  return project.questions.filter((q) => q.answeredOn !== null).sort((a, b) => (b.answeredOn ?? '').localeCompare(a.answeredOn ?? ''))
}

/** Answered questions no set has carried yet: the ones a new set can put in its note. */
export function answeredNotInSet(project: Pick<QuestionsProject, 'questions'>): PlanQuestionView[] {
  return project.questions.filter((q) => q.answeredOn !== null && q.inSetId === null)
}

/** A question and its answer as one line for a set's note: "E-301, Electrical: … Answer: …" */
export function questionInNote(q: PlanQuestionView, trade: string | null): string {
  const who = trade ?? 'A trade'
  const about = q.sheets.length > 0 ? `${q.sheets.join(', ')}, ${who}` : who
  return `${about}: ${q.text.trim()} Answer: ${q.answer.trim()}`
}
