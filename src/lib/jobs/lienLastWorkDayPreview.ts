/**
 * Setting the last day of work by hand, with its consequences in view (v2.4717, the owner's
 * ask after typing July for October): before the day is saved, a window says how far it moves
 * from the clock hours and shows only the dates the law hangs on it — the months the notice
 * names, the § 53.056 window of the last month, the § 53.052 affidavit, the § 53.158 suit —
 * today beside the new day, changed rows lit. A day the rule refuses is explained in the same
 * window; a day far from the hours asks for a second look; a new month whose window already
 * closed is named as one that would read as missed. Pure: dates in, rows and words out.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import { filingDeadlineForMonth, noticeDeadlineForMonth, suitDeadlineFor } from './lienDeadlines'
import { lienLastWorkDayProblem } from './lienLastWorkDay'
import { workMonthLabel } from './forecastWorkMonths'

export type LienLastWorkPreviewInput = {
  /** The day being typed, YYYY-MM-DD (or anything else, which the preview refuses). */
  candidate: string
  /** The day the job reads today, and where it comes from. */
  currentDay: string | null
  currentSource: 'hand' | 'hours' | 'created'
  /** The last approved clock day; the one floor a hand-set day cannot go under. */
  lastSessionDay: string | null
  /** The months with approved hours, YYYY-MM. Empty on a job with none. */
  clockMonths: ReadonlyArray<string>
  /** Months a notice already names; they never move. */
  noticedMonths?: ReadonlyArray<string>
  /** 'residential' | 'commercial' | '' — '' means the dates cannot be drawn. */
  propertyKind: string
  todayYmd: string
}

export type LienLastWorkPreviewVerdict = 'refused' | 'look' | 'fine'

export type LienLastWorkPreviewRow = {
  what: string
  before: string
  after: string
  changed: boolean
}

export type LienLastWorkPreview = {
  verdict: LienLastWorkPreviewVerdict
  /** The first sentence: the day and how far it sits from the clock hours. */
  shiftWords: string
  /** The verdict in a line: why it is refused, why to look again, or that the dates follow. */
  sayWords: string
  /** The table; empty when the property kind is unknown. */
  rows: LienLastWorkPreviewRow[]
  /** The months and dates on each side, for a strip; null while refused or unknown. */
  before: LienLastWorkPreviewDates | null
  after: LienLastWorkPreviewDates | null
}

export type LienLastWorkPreviewDates = {
  day: string | null
  months: string[]
  lastMonth: string | null
  noticeDue: string
  affidavitDue: string
  suitDue: string
}

/** A day this many days or more past the clock hours asks for a second look. */
export const LIEN_LAST_WORK_FAR_DAYS = 60

const YMD = /^\d{4}-\d{2}-\d{2}$/

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** "a month" · "two months" · "3 days" — the size of a move, as a person says it. */
export function lienLastWorkShiftSize(days: number): string {
  const n = Math.abs(days)
  if (n >= LIEN_LAST_WORK_FAR_DAYS) {
    const months = Math.max(1, Math.round(n / 30.4))
    return months === 1 ? 'a month' : `${['', '', 'two', 'three', 'four', 'five', 'six'][months] ?? months} months`
  }
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** The months the readers will name for a day: the clocked months, plus the day's month when it is later than every one of them (or alone, when there are none). */
export function lienLastWorkMonthsFor(day: string | null, clockMonths: ReadonlyArray<string>): string[] {
  const months = [...new Set(clockMonths.filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort()
  if (!day || !YMD.test(day)) return months
  const m = day.slice(0, 7)
  if (!months.length || m > months[months.length - 1]!) months.push(m)
  return months
}

function datesFor(day: string | null, clockMonths: ReadonlyArray<string>, propertyKind: string): LienLastWorkPreviewDates {
  const months = lienLastWorkMonthsFor(day, clockMonths)
  const lastMonth = months[months.length - 1] ?? null
  const noticeDue = lastMonth ? noticeDeadlineForMonth(`${lastMonth}-01`, propertyKind) : ''
  const affidavitDue = lastMonth ? filingDeadlineForMonth(`${lastMonth}-01`, propertyKind) : ''
  return { day, months, lastMonth, noticeDue, affidavitDue, suitDue: affidavitDue ? suitDeadlineFor(affidavitDue) : '' }
}

const monthsWords = (months: ReadonlyArray<string>): string => (months.length ? months.map(workMonthLabel).join(', ') : 'none')

/** "Nov 16" this year, "Jan 15, 2027" another — a date in the window never loses a year that differs from today's. */
export function lienLastWorkDayWords(ymd: string, todayYmd: string): string {
  const y = ymd.slice(0, 4)
  return y && y !== todayYmd.slice(0, 4) ? `${formatYmdMonthDay(ymd)}, ${y}` : formatYmdMonthDay(ymd)
}

export function lienLastWorkPreview(i: LienLastWorkPreviewInput): LienLastWorkPreview {
  const hours = (i.lastSessionDay ?? '').slice(0, 10) || null
  const anchor = hours ?? i.currentDay
  const w = (d: string) => lienLastWorkDayWords(d, i.todayYmd)
  const anchorWords = hours ? `the clock hours say (${w(hours)})` : i.currentSource === 'created' && i.currentDay ? `the job's creation (${w(i.currentDay)})` : i.currentDay ? `the day on the job (${w(i.currentDay)})` : 'today'
  const problem = lienLastWorkDayProblem(i.candidate, hours, i.todayYmd)
  const dayWords = YMD.test(i.candidate) ? w(i.candidate) : '—'
  const delta = anchor && YMD.test(i.candidate) ? daysBetween(anchor, i.candidate) : 0
  const size = lienLastWorkShiftSize(delta)
  const dir = delta < 0 ? 'earlier' : 'later'

  let verdict: LienLastWorkPreviewVerdict = 'fine'
  let shiftWords: string
  let sayWords: string
  if (problem) {
    verdict = 'refused'
    shiftWords = !YMD.test(i.candidate) ? 'Type a day.' : i.candidate > i.todayYmd ? `Last day of work ${dayWords} — after today.` : `Last day of work ${dayWords} — ${size} ${dir} than ${anchorWords}.`
    sayWords = i.candidate > i.todayYmd ? `A last day of work has to be a day that has happened. Today is ${w(i.todayYmd)}.` : hours && i.candidate < hours ? `The clock hours already show work on ${w(hours)}, so the last day cannot be earlier. If you meant a later month, check the month number.` : problem
  } else if (i.candidate === i.currentDay) {
    verdict = 'refused'
    shiftWords = `Last day of work ${dayWords} — the same day the job reads today.`
    sayWords = i.currentSource === 'hand' ? 'Nothing changes. Cancel, or pick another day.' : 'Nothing changes. Leave it as it is; there is no need to set it by hand.'
  } else if (hours && Math.abs(delta) >= LIEN_LAST_WORK_FAR_DAYS) {
    verdict = 'look'
    shiftWords = `Last day of work ${dayWords} — ${size} ${dir} than ${anchorWords}.`
    sayWords = `That is a long way past the last clocked hour. Work on ${dayWords} with no hours against it is unusual; make sure the day is right before you set it.`
  } else {
    shiftWords = anchor ? `Last day of work ${dayWords} — ${size} ${dir} than ${anchorWords}.` : `Last day of work ${dayWords}.`
    sayWords = hours ? `The hours end ${w(hours)} and the day is in reach of them. The dates below move with it.` : 'The job has no clock hours, so this day is the one the lien dates hang on.'
  }

  const kind = (i.propertyKind ?? '').trim()
  if (!kind) return { verdict, shiftWords, sayWords: verdict === 'refused' ? sayWords : `${sayWords} The property kind is not on record, so the dates cannot be drawn here; the Lien desk shows them.`, rows: [], before: null, after: null }

  const before = datesFor(i.currentDay, i.clockMonths, kind)
  const after = verdict === 'refused' ? before : datesFor(i.candidate, i.clockMonths, kind)
  const noticed = new Set(i.noticedMonths ?? [])
  const newMonths = after.months.filter((m) => !before.months.includes(m) && !noticed.has(m))
  const closedNew = newMonths.filter((m) => noticeDeadlineForMonth(`${m}-01`, kind) < i.todayYmd)
  const lastWords = (d: LienLastWorkPreviewDates) => (d.lastMonth ? `${workMonthLabel(d.lastMonth)} · mail by ${w(d.noticeDue)}` : '—')
  const rows: LienLastWorkPreviewRow[] = [
    { what: 'Last day of work', before: before.day ? `${w(before.day)} · ${i.currentSource === 'hand' ? 'set by hand' : i.currentSource === 'hours' ? 'clock hours' : "the job's creation"}` : 'none yet', after: verdict === 'refused' ? '' : `${dayWords} · set by hand` },
    { what: 'Months the notice names', before: monthsWords(before.months), after: monthsWords(after.months) },
    { what: '§ 53.056 for the last month', before: lastWords(before), after: `${lastWords(after)}${closedNew.includes(after.lastMonth ?? '') ? ' · window closed, would read as missed' : ''}` },
    { what: '§ 53.052 affidavit', before: before.affidavitDue ? `file by ${w(before.affidavitDue)}` : '—', after: after.affidavitDue ? `file by ${w(after.affidavitDue)}` : '—' },
    { what: '§ 53.158 suit', before: before.suitDue ? `by ${w(before.suitDue)}` : '—', after: after.suitDue ? `by ${w(after.suitDue)}` : '—' },
  ].map((r) => ({ ...r, after: r.after || r.before, changed: verdict !== 'refused' && r.after !== '' && r.after !== r.before }))
  if (closedNew.length && verdict !== 'refused') sayWords += ` ${closedNew.map(workMonthLabel).join(' and ')} would join the notice with ${closedNew.length === 1 ? 'its window' : 'their windows'} already closed, so ${closedNew.length === 1 ? 'it' : 'they'} would read as missed.`
  return { verdict, shiftWords, sayWords, rows, before, after: verdict === 'refused' ? null : after }
}
