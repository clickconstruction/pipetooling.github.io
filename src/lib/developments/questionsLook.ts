/**
 * The Questions look (v2.6214, the owner on the Gun Dog page: *these could just be buttons, and if there
 * are outstanding questions then they should show up in tables below*). Two presses at the top, one per
 * lane, always there; under them one table per lane that has questions, the open ones first and oldest
 * first, the answered ones folded under a count. The Waiting tile keeps its kinds (the customer's
 * answers, the payments); this look is the questions alone. Pure; `DevelopmentQuestionsLook.tsx` draws it.
 */
import { requestIsOpen, type MemberRequest } from './overview'

export type QuestionLane = MemberRequest['lane']

export const QUESTION_LANES: ReadonlyArray<{ lane: QuestionLane; label: string; ask: string; hint: string }> = [
  { lane: 'estimators', label: 'To the estimators', ask: 'Ask the estimators', hint: 'A bid, its plans, its price' },
  { lane: 'dispatch', label: 'To Dispatch', ask: 'Ask Dispatch', hint: 'A crew, a day on site' },
]

export type QuestionTable = {
  lane: QuestionLane
  label: string
  /** Open questions, oldest first. */
  open: MemberRequest[]
  /** Answered or closed, newest first. */
  answered: MemberRequest[]
}

/** One table per lane with any question, in the lanes' order; a lane with none is left out. */
export function questionTables(requests: readonly MemberRequest[]): QuestionTable[] {
  const out: QuestionTable[] = []
  for (const l of QUESTION_LANES) {
    const mine = requests.filter((r) => r.lane === l.lane)
    if (mine.length === 0) continue
    const open = mine.filter(requestIsOpen).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const answered = mine.filter((r) => !requestIsOpen(r)).sort((a, b) => (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at))
    out.push({ lane: l.lane, label: l.label, open, answered })
  }
  return out
}

/** The answer a row shows: the close note, else the newest reply, else null while nothing has come back. */
export function questionAnswer(r: Pick<MemberRequest, 'closed_note' | 'notes'>): { body: string; by: string | null } | null {
  const closed = (r.closed_note ?? '').trim()
  if (closed) return { body: closed, by: null }
  const last = [...r.notes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return last ? { body: last.body, by: last.author_user_id } : null
}

/** The table head's count words: *2 open · 3 answered*, *1 open*, *4 answered*. */
export function questionTableMeta(t: Pick<QuestionTable, 'open' | 'answered'>): string {
  const parts: string[] = []
  if (t.open.length) parts.push(`${t.open.length} open`)
  if (t.answered.length) parts.push(`${t.answered.length} answered`)
  return parts.join(' · ')
}

/** The fold's label under a table: *Show the 3 answered* / *Hide the 3 answered*. */
export function answeredFoldLabel(n: number, open: boolean): string {
  return `${open ? 'Hide' : 'Show'} the ${n} answered`
}

/** The look's words with no question at all: the good state, the presses right above it. */
export const NO_QUESTIONS_WORDS = 'Nothing waiting on the estimators or Dispatch.'
