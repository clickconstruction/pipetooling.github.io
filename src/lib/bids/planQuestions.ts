/**
 * Ask the robot to look (Robot rounds PR 7, punch list #142, decision 9): the words round a
 * person's question about the plans and the robot's answer. Pure.
 */
import { relativeTimeFrom } from '../twinConsoleDisplay'

export type PlanQuestionRow = {
  id: string
  bid_id: string
  question: string
  asked_by: string | null
  asked_at: string
  status: 'open' | 'answered' | 'dismissed' | string
  answer: string | null
  sheet_refs: string[] | null
  answered_at: string | null
  seen_at: string | null
  rfi_id: string | null
}

/** A question that asks for a count: "how many", "count", "number of", "quantity". The robot does not count before the bid is sent. */
export function asksForACount(q: string): boolean {
  return /\b(how many|count|number of|quantity|qty|total of)\b/i.test(q)
}

/** The once-only line under a count question before the bid is sent. */
export const COUNT_LINE = 'The robot answers what the plans say and where. Counts come after you send.'

/** The card's second line while the question waits. */
export function waitingWords(q: PlanQuestionRow, shadowSealed: boolean | null, nowMs: number): string {
  if (q.status === 'answered') return `Answered ${relativeTimeFrom(q.answered_at ?? q.asked_at, nowMs)}.`
  if (q.status === 'dismissed') return 'Set aside.'
  if (shadowSealed === false) return 'The robot answers once its own number is sealed, usually within the hour. The plans answer now.'
  return `Asked ${relativeTimeFrom(q.asked_at, nowMs)}. The robot looks on its next round, within a few minutes.`
}

/** "cites P-001, P-201" or nothing. */
export function citesWords(refs: readonly string[] | null | undefined): string {
  const r = (refs ?? []).map((s) => s.trim()).filter(Boolean)
  return r.length ? `cites ${r.join(', ')}` : ''
}

/** An answer that says the plans do not say invites an RFI. */
export function answerInvitesRfi(answer: string | null | undefined): boolean {
  if (!answer) return false
  return /\b(do not show|does not show|not shown|not on the plans|plans do not say|no sheet|not drawn|not called out|unclear|cannot tell|does not say)\b/i.test(answer)
}

/** The RFI's question from a plan question and its answer: the question, then what the plans left open. */
export function rfiQuestionFrom(q: PlanQuestionRow): string {
  const head = q.question.trim().replace(/\s+/g, ' ')
  const tail = q.answer ? ` The plans do not settle it: ${q.answer.trim().replace(/\s+/g, ' ').slice(0, 300)}` : ''
  return `${head}${/[?.!]$/.test(head) ? '' : '?'}${tail}`.slice(0, 900)
}

/** The Needs You line for the asker: one answer or several, newest first. */
export function answeredLine(rows: readonly PlanQuestionRow[], bidNumberOf: (bidId: string) => string | null): { count: number; title: string; detail: string; firstBidId: string | null } | null {
  const fresh = rows.filter((r) => r.status === 'answered' && !r.seen_at)
  if (!fresh.length) return null
  const first = fresh[0]!
  const n = bidNumberOf(first.bid_id)
  const where = n ? `b${n}` : 'a bid'
  return {
    count: fresh.length,
    title: fresh.length === 1 ? `The robot answered your question on ${where}` : `The robot answered ${fresh.length} of your questions`,
    detail: fresh.length === 1 ? `${first.question.trim()} Open the bid's Plans panel to read the answer.` : `The newest is on ${where}. Open each bid's Plans panel to read them.`,
    firstBidId: first.bid_id,
  }
}
