/**
 * Punch list #140 PR 7: the reply box's fourth kind, **Call**. The office dials, talks, then logs it: what they said,
 * the day they gave, whose move it leaves. The words and the one rule (nothing saves without their words); the write
 * is `log_call` (`replyIo.ts` → `followUpIo.logCall`), which lands the call as our line so Needs a reply clears, writes
 * the day as a written promise so the thread's chip reads *Their move · until …*, and closes the person's calls to
 * make. *Our move* writes what we still owe through the send window's own `mark_owed`, so nothing is stored twice.
 */
import { dayLabel, type DayKept } from './owed'

/** What the Call kind saves: their words, the day they gave, and whose move it leaves. */
export interface CallLogDraft {
  said: string
  day: DayKept | null
  theirMove: boolean
}

export const CALL_WORDS = {
  kind: 'Call',
  save: 'Save the call',
  dial: 'Call',
  said: 'What they said',
  dayPress: 'They gave a day…',
  dayTitle: 'They gave a day',
  dayNote: 'The row waits for that day.',
  dayTyped: 'The day they gave',
  noDay: 'No day ×',
  after: 'After this:',
  theirs: 'Their move',
  ours: 'Our move',
  hint: 'Their move clears Needs a reply. The row waits for the day they gave.',
  needWords: 'Write what they said first.',
  saveTip: 'Saves the call as our line in the thread. Only the team sees it. The row leaves Needs a reply.',
  notSaved: 'The call was not saved.',
} as const

/** The kinds row's words at its right while Call is on. */
export const CALL_ASIDE: readonly string[] = ['they gave a day', 'their move clears the row']

/** What stops the save, in the box's words, or null when the call can be saved. */
export function callLogProblem(draft: Pick<CallLogDraft, 'said'>): string | null {
  return draft.said.trim() ? null : CALL_WORDS.needWords
}

/** The call's line as `log_call` writes it: "Called Priya. They said: Thursday works". */
export function callLineBody(first: string, said: string): string {
  return `Called ${first.trim() || 'them'}. They said: ${said.trim()}`
}

/** The day they gave as the box prints it: the date as "Tue Oct 27", or the words as typed. Null for no day. */
export function callDayWords(day: DayKept | null): string | null {
  if (!day) return null
  return day.ymd ? dayLabel(day.ymd) : day.words?.trim() || null
}

/** Whether the day they gave still holds the row: a date today or later. Words hold nothing. */
export function callDayHolds(day: DayKept | null, todayYmd: string): boolean {
  return Boolean(day?.ymd && day.ymd >= todayYmd)
}

/** The number as a phone dials it. */
export function dialHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}
