/**
 * A lien paper left out of the run, and what the next run does with it (punch list #362, step 5).
 *
 * The run is every paper due by the day the Board's first tile counts to. Its first step lists each paper that still
 * asks a question, and each line carries **Leave out**, so one stuck paper never holds the rest. A leave-out is one
 * row in `lien_run_left_out`: the paper, the run's day, the reason a person picked, their words, who and when. Every
 * office seat reads the same rows.
 *
 * The rule, and the call it answers (*does the next run take a left-out paper by itself?*):
 *
 *   - **This run.** A row that stands (not put back) for this run's day, or a later one, leaves the paper out of this
 *     run. It is listed with who left it out, when and why, and **Put it back**.
 *   - **The next run.** A row that stands for an earlier run's day does neither. The paper is not taken into the new
 *     run and not left out of it: the run asks about it again, first on its list, with the old reason. A person
 *     answers **Put it back** or **Leave out again**.
 *
 * So no paper is carried into a run nobody looked at, and none stays out of every run with nobody asked. Leaving a
 * paper out changes nothing about the paper: it stays in its bin with its own day, and no rule about when a paper may
 * go reads these rows.
 *
 * Pure: rows in, standings and words out. The read and the write are `lienLeftOutIo.ts`.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'

/** Which of a job's papers: its § 53.056 notice or its § 53.052 affidavit. */
export type LienLeftOutPaper = 'notice' | 'affidavit'

export type LienLeaveOutReason = 'fact_not_in_time' | 'leader_not_in_time' | 'customer_paying' | 'ask_attorney' | 'other'

/** The reasons a person picks from, in the order the form draws them. *Another reason* needs their words. */
export const LIEN_LEAVE_OUT_REASONS: ReadonlyArray<{ key: LienLeaveOutReason; words: string }> = [
  { key: 'fact_not_in_time', words: 'Its fact will not come in time' },
  { key: 'leader_not_in_time', words: 'The leader will not get to it in time' },
  { key: 'customer_paying', words: 'The customer is paying' },
  { key: 'ask_attorney', words: 'The attorney is asked first' },
  { key: 'other', words: 'Another reason' },
]

/** One row of `lien_run_left_out`. */
export type LienLeftOutRow = {
  id: string
  jobId: string
  paper: LienLeftOutPaper
  /** The day the run counted to when the paper was left out (YYYY-MM-DD). */
  runDay: string
  reason: LienLeaveOutReason
  /** The person's words; '' when they picked a reason and typed nothing. */
  note: string
  leftOutBy: string
  leftOutAt: string
  putBackBy: string | null
  putBackAt: string | null
}

/**
 * Where a paper stands against this run: left out of it, or left out of an earlier run and asked about again. A
 * paper with no standing row has no entry.
 */
export type LienLeftOutStanding = { state: 'left_out' | 'asked_again'; row: LienLeftOutRow }

/** A paper's key, the same as its To do row's and its Board chip's: `affidavit:<jobId>`. */
export function lienPaperKey(paper: LienLeftOutPaper, jobId: string): string {
  return `${paper}:${jobId}`
}

/** The later of two rows: by the run's day, then by when it was written. */
function later(a: LienLeftOutRow, b: LienLeftOutRow): LienLeftOutRow {
  if (a.runDay !== b.runDay) return a.runDay > b.runDay ? a : b
  return a.leftOutAt >= b.leftOutAt ? a : b
}

/**
 * Every paper's standing against the run that counts to `runDay`, by `lienPaperKey`. A row put back counts for
 * nothing. With no run (`runDay` null) no paper has a standing.
 */
export function lienLeftOutStandings(rows: ReadonlyArray<LienLeftOutRow>, runDay: string | null): Map<string, LienLeftOutStanding> {
  const out = new Map<string, LienLeftOutStanding>()
  if (!runDay) return out
  const byPaper = new Map<string, LienLeftOutRow[]>()
  for (const r of rows) {
    if (r.putBackAt) continue
    const key = lienPaperKey(r.paper, r.jobId)
    const list = byPaper.get(key)
    if (list) list.push(r)
    else byPaper.set(key, [r])
  }
  for (const [key, list] of byPaper) {
    const thisRun = list.filter((r) => r.runDay >= runDay)
    if (thisRun.length) out.set(key, { state: 'left_out', row: thisRun.reduce(later) })
    else out.set(key, { state: 'asked_again', row: list.reduce(later) })
  }
  return out
}

/** What the form refuses, in its own words, or null when the leave-out can go. */
export function lienLeaveOutCheck(reason: LienLeaveOutReason | null | undefined, note: string): string | null {
  if (!reason || !LIEN_LEAVE_OUT_REASONS.some((r) => r.key === reason)) return 'Pick a reason first.'
  if (reason === 'other' && note.trim() === '') return 'Say why in a few words.'
  return null
}

/** The reason as the list says it: the picked reason, then the person's words. *Another reason* is their words alone. */
export function lienLeaveOutReasonWords(row: Pick<LienLeftOutRow, 'reason' | 'note'>): string {
  const note = row.note.trim()
  if (row.reason === 'other') return note || 'Another reason'
  const picked = LIEN_LEAVE_OUT_REASONS.find((r) => r.key === row.reason)?.words ?? 'Another reason'
  return note ? `${picked}. ${note}` : picked
}

/** The day a stamp fell on, in the app's time zone, as *Nov 15*; '' when the stamp is not a day. */
function stampDay(iso: string): string {
  const ymd = calendarYmdInAppTzFromIso(iso)
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? formatYmdMonthDay(ymd) : ''
}

/**
 * Who left the paper out and when, with each value marked for `ValueSentence`: *Left out by ⟪Rosa⟫ on ⟪Nov 15⟫*. A
 * person the desk cannot name reads *someone in the office*.
 */
export function lienLeftOutByWords(row: Pick<LienLeftOutRow, 'leftOutBy' | 'leftOutAt'>, userName: (userId: string) => string | null | undefined): string {
  const name = userName(row.leftOutBy)?.trim()
  const day = stampDay(row.leftOutAt)
  return `Left out by ${name ? val('who', name) : 'someone in the office'}${day ? ` on ${val('day', day)}` : ''}`
}

/**
 * The line over a paper the run asks about again: *Left out of the run for ⟪Nov 16⟫ by ⟪Rosa⟫ on ⟪Nov 15⟫*. The
 * reason follows it on the screen, from `lienLeaveOutReasonWords`.
 */
export function lienAskedAgainWords(row: Pick<LienLeftOutRow, 'runDay' | 'leftOutBy' | 'leftOutAt'>, userName: (userId: string) => string | null | undefined): string {
  const name = userName(row.leftOutBy)?.trim()
  const day = stampDay(row.leftOutAt)
  return `Left out of the run for ${val('day', formatYmdMonthDay(row.runDay))} by ${name ? val('who', name) : 'someone in the office'}${day ? ` on ${val('day', day)}` : ''}`
}

/** The presses' words, one home: the screen, its smokes and the guide say the same. */
export const LIEN_LEFT_OUT_WORDS = {
  leaveOut: 'Leave out',
  /** The form's own press: it names the act. */
  confirm: 'Leave it out',
  leaveOutAgain: 'Leave out again',
  putBack: 'Put it back',
  cancel: 'Cancel',
  /** Over the reasons in the form. */
  why: 'Why is it left out of this run?',
  notePlaceholder: 'A few words, if they help',
  noteNeeded: 'Say why in a few words',
} as const
