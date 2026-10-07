/**
 * A decision entered by the office on a reviewer's behalf (Submittals stage 5b): the
 * architect marked up the PDF or answered by email, and the estimator types the call onto
 * the row. The record names both — the reviewer it came from and the person who typed it —
 * and the room's thread gets a quiet system line that never carries a staff name.
 *
 * A call can carry its own day: the reviewer approved it last week, by email, and the
 * office types it today. And a submittal approved whole takes one entry for every row that
 * has no call yet.
 */
import { asDecision, asStatus, type ReviewDecision, type SubmittalItemRow } from './submittalRevision'

export type EnteredPerson = { id: string; name: string; email: string | null }

export type EnteredDecisionInput = {
  decision: ReviewDecision
  note: string | null
  person: EnteredPerson
  byUserId: string | null
  byName: string | null
  now: string
  source?: 'entered' | 'robot'
}

export type EnteredDecisionPatch = {
  review_decision: ReviewDecision
  review_note: string | null
  reviewed_by_person_id: string
  reviewed_by_name: string
  reviewed_by_email: string | null
  reviewed_at: string
  decision_source: 'entered' | 'robot'
  decision_entered_by: string | null
  decision_entered_by_name: string | null
}

/** The `bid_submittal_items` patch for one row. */
export function enteredDecisionPatch(i: EnteredDecisionInput): EnteredDecisionPatch {
  return {
    review_decision: i.decision,
    review_note: i.note?.trim() || null,
    reviewed_by_person_id: i.person.id,
    reviewed_by_name: i.person.name.trim(),
    reviewed_by_email: i.person.email?.trim().toLowerCase() || null,
    reviewed_at: i.now,
    decision_source: i.source ?? 'entered',
    decision_entered_by: i.byUserId,
    decision_entered_by_name: i.byName?.trim() || null,
  }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
/** The earliest day a call can be dated: a year typed short ("0026") is a slip, not a date. */
export const ENTERED_ON_MIN = '2000-01-01'

/** Why a typed day cannot stand as the day of the call; null when it can. Blank means today. */
export function enteredOnProblem(on: string | null | undefined, todayYmd: string): string | null {
  const d = (on ?? '').trim()
  if (!d) return null
  if (!YMD.test(d) || d < ENTERED_ON_MIN) return 'That date does not read as a day.'
  if (d > todayYmd) return 'Their call cannot be dated after today.'
  return null
}

/**
 * The instant a call is recorded at. Today (or blank) is now. An earlier day is that day at
 * noon UTC: the same calendar day in the company's zone, where the procurement log reads it.
 */
export function enteredDecisionAt(on: string | null | undefined, now: Date, todayYmd: string): string {
  const d = (on ?? '').trim()
  if (!d || d === todayYmd || enteredOnProblem(d, todayYmd)) return now.toISOString()
  return `${d}T12:00:00.000Z`
}

/** "Sep 12, 2026" for the thread line; "" when the day does not read. */
function datedWords(on: string): string {
  if (!YMD.test(on)) return ''
  return new Date(`${on}T12:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * The rows one "they approved all of it" entry covers: every row with no call yet that has a
 * product to approve. A row that already carries a call keeps it; a Missing row has nothing
 * to approve and is left out.
 */
export function rowsToApproveAll<T extends Pick<SubmittalItemRow, 'review_decision' | 'status'>>(items: ReadonlyArray<T>): T[] {
  return items.filter((it) => !asDecision(it.review_decision) && asStatus(it.status) !== 'missing')
}

/** The patch that takes an entered decision back off a row. */
export const CLEAR_DECISION_PATCH = {
  review_decision: null,
  review_note: null,
  reviewed_by_person_id: null,
  reviewed_by_name: null,
  reviewed_by_email: null,
  reviewed_at: null,
  decision_source: 'room',
  decision_entered_by: null,
  decision_entered_by_name: null,
} as const

/**
 * The room thread's system line: "from Dana Whitfield's PDF, entered by the office · 1 row · 1 revise",
 * with " · dated Sep 12, 2026" when the call was made on an earlier day.
 * The office reads as the office on the room — the staff name stays on the tab.
 */
export function enteredEntryBody(personName: string, counts: { approved: number; revise: number; rejected: number }, source: 'entered' | 'robot' = 'entered', /** the day of the call when it is not the day it was typed */ datedOn?: string | null): string {
  const n = counts.approved + counts.revise + counts.rejected
  const parts = [counts.approved ? `${counts.approved} approve` : '', counts.revise ? `${counts.revise} revise` : '', counts.rejected ? `${counts.rejected} reject` : ''].filter(Boolean)
  const how = source === 'robot' ? 'read by the robot, confirmed by the office' : 'entered by the office'
  const dated = datedOn ? datedWords(datedOn) : ''
  return `from ${personName.trim()}'s file, ${how} · ${n} row${n === 1 ? '' : 's'}${parts.length ? ` · ${parts.join(' · ')}` : ''}${dated ? ` · dated ${dated}` : ''}`
}

/** "entered by Wendi" — the tab's suffix on a row's call; "" for a room decision. */
export function enteredSuffix(item: { decision_source?: string | null; decision_entered_by_name?: string | null }): string {
  if (item.decision_source === 'entered') return `entered by ${item.decision_entered_by_name?.trim() || 'the office'}`
  if (item.decision_source === 'robot') return `read by the robot · confirmed by ${item.decision_entered_by_name?.trim() || 'the office'}`
  return ''
}
