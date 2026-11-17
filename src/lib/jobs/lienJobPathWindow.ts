import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { LIEN_OFF_PATH_NO_REASON, lienOffPathSinceWords } from './lienOffPathBin'
import { lienPublicListNote, lienPublicWhatWentOut, type LienPublicPaper } from './lienPublicProperty'

/**
 * The window that takes one job off the lien path, or puts it back (the *not lienable* train, PR 3; the owner's pick
 * of 2026-11-16). Pure: every word the window, its presses and its toasts say. The rule is `lienJobPath.ts`, the reads
 * and the write `lienJobPathIo.ts`, the bin `lienOffPathBin.ts`.
 *
 * The app does not judge what a bill is for. The window shows the bill's own lines, so the person who decides reads
 * them, and it asks for the reason in their words. The reason, the person and the day stay on the job.
 */

export const LIEN_JOB_PATH_OFF_TITLE = 'Take this job off the lien path?'
export const LIEN_JOB_PATH_BACK_TITLE = 'Put this job back on the lien path?'
/** The press that opens the window on a job that is on the path. */
export const LIEN_JOB_PATH_DOOR = 'Not lienable…'
/** What a lien is for, as the app reads it, over the bill's lines: the question the person is answering. */
export const LIEN_JOB_PATH_BILL_NOTE = 'A lien is for labor done or materials furnished to the property (Texas Property Code § 53.021 and § 53.023, as the app reads them). Read what this job billed. Ask the attorney when it is not clear.'
export const LIEN_JOB_PATH_REASON_EXAMPLE = 'For example: the bill is for trips to pick up checks, not for work on the property.'
export const LIEN_JOB_PATH_BACK_REASON_EXAMPLE = 'For example: the attorney says the claim stands.'
export const LIEN_JOB_PATH_LIST_TICK = 'Also put it on the attorney’s list'

/** One line of what the job billed. */
export type LienJobPathBillLine = { name: string; amount: number | null }

/** What the window knows of the job, as its read hands it over. */
export type LienJobPathFacts = {
  number: string
  name: string
  /** What the job's sent bills still owe, by the desk's own rule. */
  unpaid: number
  status: string | null
  /** When the job went on the attorney's list (the Collections flag); null when it is not on it. */
  attorneySince: string | null
  papers: ReadonlyArray<LienPublicPaper>
  billLines: ReadonlyArray<LienJobPathBillLine>
  /** Whether the job is off the path now, and what its row says beside the answer. */
  off: boolean
  reason: string
  since: string | null
  byName: string
}

export type LienJobPathWindow = {
  mode: 'off' | 'back'
  title: string
  /** "977 · ZZ Trip Charges · $1,050 unpaid". */
  sub: string
  billLines: Array<{ name: string; amountWords: string }>
  /** What already went out on the job, in sentences. */
  wentOut: string
  /** The attorney's list, on the way off: the tick, or the line that says the job is on it already. */
  list: { tick: boolean; line: string | null; note: string | null }
  /** On the way back: why it came off, who and the day. */
  cameOff: string | null
}

const dayOf = (iso: string | null | undefined) => (iso ? formatYmdMonthDay(calendarYmdInAppTzFromIso(iso)) : '')

export function buildLienJobPathWindow(f: LienJobPathFacts): LienJobPathWindow {
  const label = f.name ? `${f.number} · ${f.name}` : f.number
  const mode = f.off ? 'back' : 'off'
  return {
    mode,
    title: f.off ? LIEN_JOB_PATH_BACK_TITLE : LIEN_JOB_PATH_OFF_TITLE,
    sub: `${label} · ${formatUsdNoCents(f.unpaid)} unpaid`,
    billLines: f.billLines.filter((l) => l.name.trim() !== '').map((l) => ({ name: l.name.trim(), amountWords: l.amount == null ? '' : formatUsdNoCents(l.amount) })),
    wentOut: lienPublicWhatWentOut(f.papers),
    list: f.attorneySince
      ? { tick: false, line: `It is on the attorney’s list already, since ${dayOf(f.attorneySince)}.`, note: null }
      : { tick: true, line: null, note: lienPublicListNote(f.number, f.status) },
    cameOff: f.off ? `Taken ${lienOffPathSinceWords(f.since, f.byName)}. The reason given: ${f.reason.trim() || LIEN_OFF_PATH_NO_REASON}` : null,
  }
}

/** What the press does, on the way off: said before it is pressed. */
export function lienJobPathOffDoes(attorneyList: boolean): string[] {
  return [
    'The job leaves the Lien desk: its bins, its run, its counts and its lien dates on the Pipeline.',
    'Nothing is filed, voided or deleted. Its lien papers stay as they are, and they are back if the job is put back.',
    'Nobody is reminded of its lien dates after this. They still run.',
    attorneyList ? 'It goes on the attorney’s list, with your reason as the note.' : 'It does not go on the attorney’s list.',
    'Your name, today and your reason are kept on the job, and the bin Off the lien path lists it.',
  ]
}

export const LIEN_JOB_PATH_BACK_DOES: ReadonlyArray<string> = [
  'The job is on the Lien desk again, with its papers where they stood.',
  'Its lien dates did not stop while it was off. Check each one first.',
  'It stays on the attorney’s list if it is on it.',
  'Your name, today and your reason are kept on the job.',
]

export function lienJobPathOffLabel(number: string): string {
  return `Take ${number} off the lien path`
}

export function lienJobPathBackLabel(number: string): string {
  return `Put ${number} back on the lien path`
}

/** What the function answers (`set_job_lien_path_answer`). */
export type LienJobPathResult = { answer: 'off_path' | null; changed: boolean; onAttorneyList: boolean; alreadyOnList: boolean; held: string | null }

/** The toast after the press, on the way off: what happened, and what the attorney's list said when it was asked. */
export function lienJobPathOffToast(number: string, asked: boolean, r: LienJobPathResult): { words: string; tone: 'success' | 'warning' } {
  const head = `${number} is off the lien path.`
  if (!asked) return { words: head, tone: 'success' }
  if (r.held) return { words: `${head} It did not go on the attorney’s list: ${r.held}${/[.!?]$/.test(r.held) ? '' : '.'}`, tone: 'warning' }
  if (r.alreadyOnList) return { words: `${head} It was on the attorney’s list already.`, tone: 'success' }
  return { words: `${head} It is on the attorney’s list.`, tone: 'success' }
}

export function lienJobPathBackToast(number: string): string {
  return `${number} is back on the lien path. Its papers are on the Lien desk again.`
}
