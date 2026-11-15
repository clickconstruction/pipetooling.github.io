import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienStandInLine, lienStandInWords, MONTH_STAND_IN_DOOR_WORDS, type LienStandInSource } from './lienBillMonths'

/**
 * The stand-in lien month, confirmed by a person (v2.7280, punch list #358; the owner's ask of 2026-11-14). Pure.
 *
 * A job with no clock hours and no last day of work set by hand takes its lien month from its bill, or from the day
 * it was made (`lienBillMonths.ts`), and every surface flags that month as a stand-in: the affidavit pane, the Lien
 * window's affidavit tab, the printed help sheet and the notice record. A bill is not a record of work, so the flag
 * asked a person to set the last day of work if the work ran in another month. That was the only door, and it moves
 * every clock. Jobs brought in from the earlier system have no hours and never will, and on most of them the bill's
 * month is right. So this is the second door: a person confirms the month, with who said so and when, and the flag
 * turns quiet. No clock moves and no paper changes.
 *
 * The check lives on the job (`jobs_ledger.lien_month_checked_*`, migration 20261114120000) and holds only while the
 * job still has no hours and no hand day and the confirmed month is still the stand-in month. A last day set later,
 * or a bill that moved the month, puts the question back.
 */
export type LienMonthCheck = {
  /** 'YYYY-MM', the month confirmed. */
  month: string
  /** ISO, as the row keeps it; '' when the row has none. */
  at: string
  byName: string
  /** Who said the month is right, and when, as typed. */
  note: string
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** 'August' from '2026-08'; the key itself when it is not a month. */
export function lienMonthName(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key)
  return (m && FULL_MONTHS[Number(m[2]) - 1]) || key
}

/** 'August 2026' from '2026-08'. */
export function lienMonthFullLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key)
  return m && FULL_MONTHS[Number(m[2]) - 1] ? `${FULL_MONTHS[Number(m[2]) - 1]} ${m[1]}` : key
}

/** The job row's check columns → the kernel's shape; null for a row with no confirmed month. Tolerates a row read without the columns. */
export function parseLienMonthCheck(row: unknown): LienMonthCheck | null {
  const r = row as { lien_month_checked_month?: unknown; lien_month_checked_at?: unknown; lien_month_checked_by_name?: unknown; lien_month_check_note?: unknown } | null | undefined
  if (!r || typeof r.lien_month_checked_month !== 'string' || !MONTH_KEY.test(r.lien_month_checked_month)) return null
  return {
    month: r.lien_month_checked_month,
    at: typeof r.lien_month_checked_at === 'string' ? r.lien_month_checked_at : '',
    byName: typeof r.lien_month_checked_by_name === 'string' ? r.lien_month_checked_by_name.trim() : '',
    note: typeof r.lien_month_check_note === 'string' ? r.lien_month_check_note.trim() : '',
  }
}

/**
 * Where the month stands: `none` when it comes from hours or a day set by hand (nothing to ask), `flag` when it is a
 * stand-in nobody confirmed, `checked` when a person confirmed this very month.
 */
export type LienMonthCheckState =
  | { kind: 'none' }
  | { kind: 'flag'; source: LienStandInSource; month: string }
  | { kind: 'checked'; source: LienStandInSource; month: string; check: LienMonthCheck }

export function lienMonthCheckState(input: { source: LienStandInSource | null | undefined; month: string; check: LienMonthCheck | null | undefined }): LienMonthCheckState {
  if (!input.source || !input.month) return { kind: 'none' }
  if (input.check && input.check.month === input.month) return { kind: 'checked', source: input.source, month: input.month, check: input.check }
  return { kind: 'flag', source: input.source, month: input.month }
}

/** The check that still applies, or null: the one the help sheet, the notice record and the Lien window read. */
export function lienMonthCheckedFor(input: { source: LienStandInSource | null | undefined; month: string; check: LienMonthCheck | null | undefined }): LienMonthCheck | null {
  const state = lienMonthCheckState(input)
  return state.kind === 'checked' ? state.check : null
}

/** The pane's question: where the month came from, then the one thing to answer. */
export function lienMonthQuestion(source: LienStandInSource, month: string): string {
  return `${lienStandInLine(source)} Is ${lienMonthName(month)} the month the work was done?`
}

/** The first press: it opens the ask. */
export function lienMonthYesWords(month: string): string {
  return `Yes, ${lienMonthName(month)} is right ›`
}

/** The second press: today's door, which moves every clock. */
export const LIEN_MONTH_SET_LAST_DAY_WORDS = 'Set the last day of work ›'

/** The flag's door for a reader who cannot press either: the words every surface carried before the presses. */
export const LIEN_MONTH_FLAG_DOOR_WORDS = MONTH_STAND_IN_DOOR_WORDS

/** The ask's one question. */
export function lienMonthAskWords(month: string): string {
  return `Who said ${lienMonthName(month)} is the month, and when?`
}

/** The ask's press. */
export function lienMonthConfirmWords(month: string): string {
  return `Confirm ${lienMonthName(month)}`
}

export const LIEN_MONTH_CHECK_CANCEL_WORDS = 'Cancel'

/** Under the ask: what the press does and does not do. */
export const LIEN_MONTH_CHECK_SAVES_WORDS = 'Saved on the job with your name and the day. It changes no date and no paper. It takes the flag off.'

/** What the ask's box says before anything is typed. */
export const LIEN_MONTH_CHECK_NOTE_HINT = 'The owner, Nov 14: the work was done in August; the job came in from the earlier system.'

/** Why the ask cannot save, or null when it can: the note names who said so. */
export function lienMonthCheckProblem(note: string): string | null {
  return note.trim() ? null : 'Type who said the month is right, and when.'
}

const dayOf = (check: LienMonthCheck, formatDay: (ymd: string) => string): string => (check.at ? formatDay(calendarYmdInAppTzFromIso(check.at)) : '')

/** "August checked · Robert · Nov 14 · the owner's word" — the pane's quiet line and the Lien window's. */
export function lienMonthCheckedWords(check: LienMonthCheck, formatDay: (ymd: string) => string): string {
  return [`${lienMonthName(check.month)} checked`, check.byName, dayOf(check, formatDay), check.note].filter(Boolean).join(' · ')
}

/** The quiet line's press: reopens the ask with the note filled. */
export const LIEN_MONTH_CHECK_CHANGE_WORDS = 'Change ›'

/**
 * The month's words in the pane's grid once it is checked: *dated from the bill · no clock hours* becomes
 * *from the bill · checked Nov 14*. Words with no stand-in lead come back as they were.
 */
export function lienMonthCheckedRowWords(words: string, check: LienMonthCheck, formatDay: (ymd: string) => string): string {
  const when = dayOf(check, formatDay)
  const checked = when ? `checked ${when}` : 'checked'
  return words.replace(lienStandInWords(true), `from the bill · ${checked}`).replace(lienStandInWords(false), `from the job’s creation · ${checked}`)
}

/**
 * The help sheet's ✓ row in place of its ⚠ one (`lienHelpChecks`, *Work month.*): the month, who checked it, when and
 * the note. `row` is the batch sheet's one sentence. The notice record prints `words` on a note line.
 */
export function lienMonthCheckedSheetRow(check: LienMonthCheck, formatDay: (ymd: string) => string): { lead: string; words: string; row: string } {
  const when = dayOf(check, formatDay)
  const who = [check.byName, when].filter(Boolean).join(' on ')
  const label = lienMonthFullLabel(check.month)
  return {
    lead: 'Work month.',
    words: `${label}${who ? `, checked by ${who}` : ', checked'}${check.note ? `: ${check.note}` : '.'}`,
    row: `Work month ${label}, checked${check.byName ? ` by ${check.byName}` : ''}.`,
  }
}

/** The columns one confirm writes, and the clear. */
export type LienMonthCheckPatch = {
  lien_month_checked_month: string | null
  lien_month_checked_at: string | null
  lien_month_checked_by: string | null
  lien_month_checked_by_name: string
  lien_month_check_note: string
}

export function lienMonthCheckPatch(input: { month: string; note: string; userId: string | null; userName: string; nowIso: string }): LienMonthCheckPatch {
  return { lien_month_checked_month: input.month, lien_month_checked_at: input.nowIso, lien_month_checked_by: input.userId, lien_month_checked_by_name: input.userName.trim(), lien_month_check_note: input.note.trim() }
}

export const LIEN_MONTH_CHECK_CLEAR: LienMonthCheckPatch = { lien_month_checked_month: null, lien_month_checked_at: null, lien_month_checked_by: null, lien_month_checked_by_name: '', lien_month_check_note: '' }
