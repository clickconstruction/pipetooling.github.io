/**
 * The last day of work on a job, for the lien clocks (v2.4653, the owner's ask): a billed job
 * with no approved clock hours was dated from the day it was created, and the office remembers
 * the real day but will not touch hours already paid. The day lives on the job
 * (`jobs_ledger.lien_last_work_on`, with who set it, when and why); the four lien readers take
 * its month. Pure: where the day comes from, the words for it, what a typed day may be, and
 * the patch that saves it. Clock sessions are never touched.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type LienLastWorkSource = 'hand' | 'hours' | 'created'

export type LienLastWorkJob = {
  created_at?: string | null
  /** 'YYYY-MM-DD' — the last approved clock day, as the ledger keeps it. */
  last_work_date?: string | null
  lien_last_work_on?: string | null
  lien_last_work_note?: string | null
  lien_last_work_set_at?: string | null
  lien_last_work_set_by?: string | null
}

export type LienLastWorkDay = {
  /** 'YYYY-MM-DD', or null when the job has no day at all. */
  day: string | null
  source: LienLastWorkSource
  /** "set by hand" · "from clock hours" · "from the job's creation" */
  sourceWords: string
  note: string
  setAt: string | null
  setBy: string | null
}

/** The line under a month, and on the timeline's LAST WORK node, when the day was typed (one wording). */
export const LAST_DAY_SET_BY_HAND_WORDS = 'last day set by hand'

const SOURCE_WORDS: Record<LienLastWorkSource, string> = { hand: 'set by hand', hours: 'from clock hours', created: "from the job's creation" }

export function lienLastWorkDay(job: LienLastWorkJob | null | undefined): LienLastWorkDay {
  const hand = (job?.lien_last_work_on ?? '').slice(0, 10)
  if (hand) return { day: hand, source: 'hand', sourceWords: SOURCE_WORDS.hand, note: (job?.lien_last_work_note ?? '').trim(), setAt: job?.lien_last_work_set_at ?? null, setBy: job?.lien_last_work_set_by ?? null }
  const hours = (job?.last_work_date ?? '').slice(0, 10)
  if (hours) return { day: hours, source: 'hours', sourceWords: SOURCE_WORDS.hours, note: '', setAt: null, setBy: null }
  const created = job?.created_at ? calendarYmdInAppTzFromIso(job.created_at).slice(0, 10) : ''
  return { day: created || null, source: 'created', sourceWords: created ? SOURCE_WORDS.created : 'no day yet', note: '', setAt: null, setBy: null }
}

function plausible(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`))
}

/** Why a typed day cannot be saved, or null when it can. The hours already say later is the one rule the office cannot override. */
export function lienLastWorkDayProblem(day: string, lastSessionDay: string | null | undefined, todayYmd: string): string | null {
  if (!plausible(day)) return 'Pick a day.'
  if (day > todayYmd) return 'The last day of work cannot be after today.'
  const hours = (lastSessionDay ?? '').slice(0, 10)
  if (hours && day < hours) return `The clock hours already say ${formatYmdMonthDay(hours)}. The last day cannot be earlier.`
  return null
}

export type LienLastWorkPatch = { lien_last_work_on: string | null; lien_last_work_note: string; lien_last_work_set_at: string | null; lien_last_work_set_by: string | null }

/** The columns a save writes: the day, the reason, who and when. */
export function lienLastWorkDayPatch(day: string, note: string, userId: string | null, nowIso: string): LienLastWorkPatch {
  return { lien_last_work_on: day, lien_last_work_note: note.trim(), lien_last_work_set_at: nowIso, lien_last_work_set_by: userId }
}

/** Back to the clock hours (or the creation day): every hand-set column cleared. */
export const LIEN_LAST_WORK_CLEAR: LienLastWorkPatch = { lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null }

/** "set by hand · Robert · Oct 6" — the chip's words with who and when, when known. */
export function lienLastWorkSourceLine(d: LienLastWorkDay, setByName?: string | null): string {
  if (d.source !== 'hand') return d.sourceWords
  const who = (setByName ?? '').trim()
  const when = d.setAt ? formatYmdMonthDay(calendarYmdInAppTzFromIso(d.setAt).slice(0, 10)) : ''
  return [d.sourceWords, who, when].filter(Boolean).join(' · ')
}
