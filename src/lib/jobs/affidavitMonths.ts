import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { MonthNotice, WorkMonth } from './forecastWorkMonths'
import { lienStandInWords } from './lienBillMonths'
import type { LienMonthHistoryEntry } from './lienMonthHistory'

/**
 * The affidavit's month card (v2.3681): which work months the lien will cover.
 * A sub's lien covers the months a § 53.056 notice went out for; a month whose
 * window closed with no notice, or was skipped, is worked but unsecured — its
 * share of the balance is an ordinary receivable. The affidavit never re-dates
 * work: an unsecured month is shown, named, and left off the lien.
 */
export type AffidavitMonthStatus = 'lien' | 'open' | 'unsecured'

export type AffidavitMonthRow = {
  key: string
  status: AffidavitMonthStatus
  /** "41.4 approved hours · notice sent Sep 24" */
  words: string
}

const hoursWords = (h: number) => `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })} approved ${h === 1 ? 'hour' : 'hours'}`

/** One month's row: `lead` says what the month rests on, and the rest says what became of its notice. */
function monthRow(key: string, lead: string, h: LienMonthHistoryEntry | undefined, notice: Pick<MonthNotice, 'state' | 'due'> | null): AffidavitMonthRow {
  if (h?.outcome === 'sent' || notice?.state === 'sent') {
    return { key, status: 'lien', words: `${lead} · notice sent${h?.at ? ` ${formatYmdMonthDay(calendarYmdInAppTzFromIso(h.at))}` : ''}` }
  }
  if (h?.outcome === 'skipped') {
    return { key, status: 'unsecured', words: `${lead} · skipped${h.at ? ` ${formatYmdMonthDay(calendarYmdInAppTzFromIso(h.at))}` : ''}${h.byName ? ` by ${h.byName}` : ''} — given up on purpose; the lien does not cover it` }
  }
  if (h?.outcome === 'missed' || notice?.state === 'closed') {
    const closed = h?.deadline || notice?.due || ''
    return { key, status: 'unsecured', words: `${lead} · window closed${closed ? ` ${formatYmdMonthDay(closed)}` : ''} with no notice — the lien does not cover it` }
  }
  if (!notice) return { key, status: 'lien', words: `${lead} · no monthly notice required` }
  return { key, status: 'open', words: `${lead} · notice still open — mail by ${formatYmdMonthDay(notice.due)}` }
}

export function affidavitMonthRows(work: ReadonlyArray<WorkMonth>, history: ReadonlyArray<LienMonthHistoryEntry>): AffidavitMonthRow[] {
  const byMonth = new Map(history.map((h) => [h.month, h]))
  return work.map((m) => monthRow(m.key, hoursWords(m.hours), byMonth.get(m.key), m.notice))
}

/** What a month with no approved hours rests on: a sent bill, the job's creation, or the last day of work set by hand. */
export type AffidavitNoHoursSource = 'bill' | 'job_created' | 'hand'

/** The lead of a month that rests on the last day of work set by hand, where a stand-in reads `lienStandInWords`. */
export const AFFIDAVIT_HAND_DAY_WORDS = 'from the last day of work set by hand · no clock hours'

/**
 * Where a job with no approved clock month takes its month from, off the affidavit row's own flags. Null when the row
 * names none of the three, or names a hand day on a job the ledger shows an approved clock day for: that job is dated
 * from hours too, and its card waits for the clock months.
 */
export function affidavitNoHoursSource(f: {
  lastMonthFromCreation?: boolean | null
  lastMonthFromBill?: boolean | null
  lastMonthByHand?: boolean | null
  /** The job's first and last approved clock day, as the ledger keeps them (`first_work_date`, `last_work_date`). */
  firstWorkDate?: string | null
  lastWorkDate?: string | null
}): AffidavitNoHoursSource | null {
  if (f.lastMonthFromCreation) return f.lastMonthFromBill ? 'bill' : 'job_created'
  return f.lastMonthByHand && !(f.firstWorkDate ?? '').trim() && !(f.lastWorkDate ?? '').trim() ? 'hand' : null
}

/**
 * The card for a job with no approved clock month (punch list #415, the owner's pick of 2026-11-24). Until then the
 * card was built from clock months alone, so a job dated by hand, by a bill or by its creation showed no card at all,
 * whatever notice was on record. `months` are the months of the job's own work as the paper's span reads them
 * (`lienAffidavitWorkMonths`), `named` the months a live § 53.056 notice names, and `deadlineOf` the month's notice day
 * (`noticeDeadlineForMonth`), since the desk's month reader drops a month once its day is a week past. Each month says
 * what it rests on in place of its hours, and its notice is read against it as for a clock month.
 */
export function affidavitMonthRowsWithoutHours(input: {
  months: ReadonlyArray<string>
  source: AffidavitNoHoursSource
  named: ReadonlyArray<string>
  history: ReadonlyArray<LienMonthHistoryEntry>
  deadlineOf: (month: string) => string
  todayYmd: string
}): AffidavitMonthRow[] {
  const byMonth = new Map(input.history.map((h) => [h.month, h]))
  const named = new Set(input.named)
  const lead = input.source === 'hand' ? AFFIDAVIT_HAND_DAY_WORDS : lienStandInWords(input.source === 'bill')
  return [...new Set(input.months.filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().map((key) => {
    const due = input.deadlineOf(key)
    const state = named.has(key) ? 'sent' : due && due < input.todayYmd ? 'closed' : 'open'
    return monthRow(key, lead, byMonth.get(key), { state, due })
  })
}

/** The card's closing sentence: what the affidavit names, and where the rest of the money goes. */
export function affidavitMonthsSentence(rows: ReadonlyArray<AffidavitMonthRow>, labelOf: (key: string) => string): string {
  const lien = rows.filter((r) => r.status === 'lien').map((r) => labelOf(r.key))
  const open = rows.filter((r) => r.status === 'open').map((r) => labelOf(r.key))
  const unsecured = rows.filter((r) => r.status === 'unsecured').map((r) => labelOf(r.key))
  const list = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const parts: string[] = []
  parts.push(lien.length ? `The affidavit names ${list(lien)}${open.length ? `, and ${list(open)} once ${open.length === 1 ? 'its' : 'their'} notice has gone out` : ''}.` : open.length ? `Nothing is on the lien yet — ${list(open)} joins it once the notice has gone out.` : 'No month has a notice on record — the affidavit cannot claim this work.')
  if (unsecured.length) parts.push(`${list(unsecured)}'s share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.`)
  return parts.join(' ')
}
