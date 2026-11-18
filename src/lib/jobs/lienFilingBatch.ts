/**
 * Back from the clerk (the owner's pick of 2026-11-18, option B of the look): the liens in *Ready to file* in one
 * short window, each taking the number the County Clerk stamped on it.
 *
 * Until now a filed lien was recorded one at a time: its chip, **Open the affidavit tab ›**, **Record filing…**, the
 * number, **Record filing**. Four presses a lien and two windows deep. Eleven liens filed on one day were typed by
 * the dev seat for that reason, and the twelfth by an assistant the long way.
 *
 * The window is one press from To do, a line on the *Ready to file* bin. The owner's call on how it saves: **each
 * lien is recorded as its number is typed**. Enter, or leaving the box, on a number that passes its check
 * (`lienDocCheck`) records that lien as filed on the *Filed on* day, right then. A number another lien holds is held.
 * A number that is not the county's shape is asked about and recorded on the reader's word.
 *
 * The office often holds the clerk's PDFs, named by hand: *J858 Lien (20260229004).pdf*. **Choose the stamped
 * liens** takes them all at once. A file whose name holds one lien's job number goes to that lien, and a long number
 * in the name is typed in as its document number. A number that came from a name is not recorded by itself: it
 * waits for a look at the stamp, and one counted press records every lien whose number waits that way.
 *
 * What a recording writes is what the job's Lien window writes: one `job_lien_filings` row (kind `affidavit`, the
 * sworn amount, the paper as the desk draws it, the county, the number, the day filed and the serve-by day), then the
 * desk's affidavit item marked sent, then the stamped file as the filing's saved copy when one was chosen.
 *
 * Pure. `lienFilingBatchIo.ts` writes.
 */
import { countedLabel } from '../batchWords'
import { formatYmdMonthDay } from './billedExpectedPay'
import { serveDueForFiling } from './lienDeadlines'
import { lienDocCheck, lienDocNumberClean, type LienDocCheck, type LienDocKnown } from './lienDocNumber'

/** One lien in *Ready to file*, as much of it as the window reads. */
export type LienFilingTarget = {
  jobId: string
  /** The job's number as the desk prints it: *JP858*. */
  jobNumber: string
  /** *858 · Sample Job* */
  jobLabel: string
  /** The property's county, off the paper. */
  county: string
  /** The day the lien must be filed by, YYYY-MM-DD, or '' when the desk holds none. */
  fileByYmd: string
  daysLeft: number | null
  /** The paper as the desk draws it, kept on the filing. Null when the desk cannot draw one: the lien is recorded in its own Lien window. */
  fields: Record<string, unknown> | null
  /** The amount the paper swears. */
  amount: number
}

/** What the desk holds of an affidavit entry, as much as this reads. */
export type LienFilingEntryLike = { jobId: string; pile: string; deadline?: string | null; daysLeft?: number | null }

/**
 * The liens the window lists: every affidavit standing in *Ready to file*, the soonest day first. A paper a hold
 * stopped is in another pile and is not offered: nobody files a paper that is held.
 */
export function lienFilingTargets(input: {
  entries: ReadonlyArray<LienFilingEntryLike>
  jobNumber: (jobId: string) => string
  jobLabel: (jobId: string) => string
  /** The paper for a job (`lienDeskAffidavitFieldsFor`), or null. */
  fieldsFor: (jobId: string) => Record<string, unknown> | null
}): LienFilingTarget[] {
  const out: LienFilingTarget[] = []
  for (const e of input.entries) {
    if (e.pile !== 'ready') continue
    const fields = input.fieldsFor(e.jobId)
    const text = (k: string): string => (fields && typeof fields[k] === 'string' ? (fields[k] as string).trim() : '')
    const amount = Number(text('unpaidAmount'))
    out.push({ jobId: e.jobId, jobNumber: input.jobNumber(e.jobId), jobLabel: input.jobLabel(e.jobId), county: text('county'), fileByYmd: (e.deadline ?? '').slice(0, 10), daysLeft: e.daysLeft ?? null, fields, amount: Number.isFinite(amount) ? amount : 0 })
  }
  return out.sort((a, b) => (a.fileByYmd || '9999').localeCompare(b.fileByYmd || '9999') || a.jobLabel.localeCompare(b.jobLabel, undefined, { numeric: true }))
}

export const LIEN_FILING_BATCH_WORDS = {
  title: 'Back from the clerk: record the filings',
  /** The Board's line on *Ready to file*, before its door. */
  boardAsk: 'Back from the clerk?',
  day: 'Filed on',
  dayHint: 'One day for every lien recorded here.',
  hint: 'Type the number the County Clerk stamped on each lien. Enter records it and moves to the next. A lien with no number stays for later.',
  choose: 'Choose the stamped liens',
  chooseMore: 'Choose more',
  chooseHint: 'Have the clerk’s PDFs? Pick them all at once. A file named with its job number finds its lien, and a document number in the name is typed in for you.',
  addOne: 'Add the stamped lien',
  addOneHint: 'The clerk’s copy. A photo or a PDF. It can follow later.',
  fromName: 'The number is from the file’s name. Check it against the stamp.',
  anyway: 'Record it anyway',
  recording: 'Recording…',
  needDay: 'Set the day the liens were filed.',
  noPaper: 'The desk cannot draw this lien’s paper, so it is recorded in its own Lien window.',
  openLien: 'Open its Lien window ›',
  wrongLien: 'Recorded on the wrong lien? Its Lien window takes it back.',
  none: 'Nothing waiting on a document number.',
  noneNext: 'Every approved lien is on record as filed. Next, each owner and each original contractor gets a copy by certified mail.',
  foot: 'Each lien is saved the moment its number is recorded.',
  close: 'Close',
} as const

const FILINGS: [string, string] = ['filing', 'filings']

/** The Board's door, and the copies window's: *Enter document numbers · 3 ›*. Null with none. */
export function lienFilingDoorWords(count: number): string | null {
  return count > 0 ? `Enter document numbers · ${count} ›` : null
}

/** Under the title: how many liens wait. */
export function lienFilingLeadWords(waiting: number, recorded: number): string {
  if (waiting <= 0) return recorded > 0 ? `${recorded === 1 ? '1 filing is' : `${recorded} filings are`} on record.` : LIEN_FILING_BATCH_WORDS.none
  return `${waiting === 1 ? '1 lien is' : `${waiting} liens are`} approved and not yet on record as filed.`
}

/** The counted press for the numbers that came from file names and wait for a look: *Record 3 filings*. */
export function lienFilingBatchPress(waiting: number): string {
  return countedLabel('Record', waiting, FILINGS)
}

/** Beside a lien once it is on record: *Filed Nov 18. Recorded. Mail its copies by Nov 23.* */
export function lienFilingRecordedWords(filedYmd: string): string {
  return `Filed ${formatYmdMonthDay(filedYmd)}. Recorded. Mail its copies by ${formatYmdMonthDay(serveDueForFiling(filedYmd))}.`
}

/** Beside a lien whose recording did not land: the reason, and that the box still holds the number. */
export function lienFilingNotRecordedWords(reason: string): string {
  const why = (reason ?? '').trim().replace(/[.\s]+$/, '')
  return `Not recorded${why ? `: ${why}` : ''}. The box still holds the number.`
}

/** A chip for the day a lien must be filed by: *file by Dec 15*, *file today*, *its day passed*. */
export function lienFilingByWords(t: Pick<LienFilingTarget, 'fileByYmd' | 'daysLeft'>): { words: string; tone: 'quiet' | 'soon' | 'late' } | null {
  if (!t.fileByYmd) return null
  if (t.daysLeft != null && t.daysLeft < 0) return { words: 'its day passed', tone: 'late' }
  if (t.daysLeft === 0) return { words: 'file today', tone: 'soon' }
  return { words: `file by ${formatYmdMonthDay(t.fileByYmd)}`, tone: t.daysLeft != null && t.daysLeft <= 3 ? 'soon' : 'quiet' }
}

/** Whether a day box holds a day. */
export function lienFilingDayOk(filedYmd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((filedYmd ?? '').trim())
}

/**
 * Check one row's number before it is recorded. `others` is every number the desk holds, and the rows typed or
 * recorded in this sitting, each under a made-up id so a twin in the same stack is caught.
 */
export function lienFilingCheck(input: { target: Pick<LienFilingTarget, 'jobId' | 'county'>; number: string; filedYmd: string; known: ReadonlyArray<LienDocKnown>; stack: ReadonlyArray<{ jobId: string; county: string; number: string; jobLabel: string }> }): LienDocCheck {
  const stack: LienDocKnown[] = input.stack.filter((r) => r.jobId !== input.target.jobId && r.number.trim()).map((r) => ({ filingId: `stack:${r.jobId}`, county: r.county, number: r.number, filedYmd: input.filedYmd, jobLabel: r.jobLabel }))
  return lienDocCheck({ number: input.number, county: input.target.county, filedYmd: input.filedYmd, known: [...input.known, ...stack] })
}

/** The row a recording inserts, as the job's Lien window inserts it. `created_by` and the saved copy are the io's. */
export function lienFilingPayload(target: LienFilingTarget, input: { number: string; filedYmd: string }): { job_id: string; kind: 'affidavit'; amount: number; fields: Record<string, unknown>; county: string; recording_number: string; filed_at: string; serve_due: string } {
  return { job_id: target.jobId, kind: 'affidavit', amount: target.amount, fields: target.fields ?? {}, county: target.county, recording_number: lienDocNumberClean(input.number), filed_at: input.filedYmd, serve_due: serveDueForFiling(input.filedYmd) }
}

// ---------------------------------------------------------------------------
// The clerk's files, by their names
// ---------------------------------------------------------------------------

const stem = (name: string): string => (name ?? '').replace(/\.[a-z0-9]{1,5}$/i, '')

/** The digits of a job's number: *858* of *JP858*, since the office writes *J858* as often. */
function jobDigits(jobNumber: string): string {
  return (jobNumber ?? '').replace(/\D+/g, '')
}

/** A job's number as a number of its own in a name: *858* in *J858 Lien (2026…).pdf*, never inside *1858* or a longer run of digits. */
function nameHasJob(name: string, jobNumber: string): boolean {
  const n = jobDigits(jobNumber)
  if (!n) return false
  return new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(stem(name))
}

/**
 * The document number in a file's name: the longest run of eight or more digits, spaces and dashes inside it let
 * through, that is not the job's own number. *J858 Lien (20260229004).pdf* reads *20260229004*. '' when the name
 * holds none: a day written as digits, *2026-11-16*, is eight digits and is not taken when a longer run stands by it.
 */
export function lienDocNumberFromName(name: string, jobNumber: string): string {
  const job = jobDigits(jobNumber)
  const runs = (stem(name).match(/\d[\d -]{6,}\d/g) ?? []).map((r) => r.replace(/\D+/g, '')).filter((r) => r.length >= 8 && r !== job)
  // A day alone, eight digits that read as a date, is not a clerk's number.
  const real = runs.filter((r) => !(r.length === 8 && /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(r)))
  return real.sort((a, b) => b.length - a.length)[0] ?? ''
}

export type LienFilingFileMatch = { index: number; jobId: string; number: string }
export type LienFilingFileLeft = { index: number; name: string; reason: string }

/**
 * Each chosen file to its lien, by the job number in its name. A name that fits one lien goes to it. A name that
 * fits none, or two, is left with the reason, and so is a second file for a lien that has one: nothing is guessed,
 * since a wrong match would put one lien's stamped copy on another.
 */
export function lienFilingFilesPlan(files: ReadonlyArray<{ name: string }>, targets: ReadonlyArray<Pick<LienFilingTarget, 'jobId' | 'jobNumber'>>, taken: ReadonlySet<string> = new Set()): { matched: LienFilingFileMatch[]; left: LienFilingFileLeft[] } {
  const matched: LienFilingFileMatch[] = []
  const left: LienFilingFileLeft[] = []
  const has = new Set(taken)
  files.forEach((file, index) => {
    const fits = targets.filter((t) => nameHasJob(file.name, t.jobNumber))
    if (fits.length === 0) return void left.push({ index, name: file.name, reason: 'its name holds no job number of a lien here' })
    if (fits.length > 1) return void left.push({ index, name: file.name, reason: 'its name fits two liens' })
    const target = fits[0]!
    if (has.has(target.jobId)) return void left.push({ index, name: file.name, reason: 'that lien already has a file' })
    has.add(target.jobId)
    matched.push({ index, jobId: target.jobId, number: lienDocNumberFromName(file.name, target.jobNumber) })
  })
  return { matched, left }
}

/** Under the chooser after a pick: what went where, and what was left with its reason. */
export function lienFilingFilesWords(plan: { matched: ReadonlyArray<unknown>; left: ReadonlyArray<LienFilingFileLeft> }): { went: string; left: string[] } {
  const n = plan.matched.length
  return {
    went: n === 0 ? 'No file found its lien.' : `${n === 1 ? '1 file went' : `${n} files went`} to ${n === 1 ? 'its lien' : 'their liens'}, by the job number in ${n === 1 ? 'its name' : 'each name'}.`,
    left: plan.left.map((l) => `${l.name}: left out, ${l.reason}.`),
  }
}
