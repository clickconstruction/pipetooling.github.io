import { filingDeadlineForMonth } from './lienDeadlines'
import { formatYmdMonthDay } from './billedExpectedPay'

/**
 * The lien runway (v2.4051): does the money land before the lien dies?
 *
 * A Billed or Collections row already knows two dates — when the customer is
 * expected to pay (`billedExpectedPay`) and the last day a § 53.052 affidavit
 * can be filed (`lienDeadlines`). Side by side they still make the reader
 * subtract; this kernel does the subtraction and returns one reading: the
 * marks for a short runway (today → the pay dot → the lien flag), the words
 * under it, the tone, and a sort key that puts the tightest runway first.
 *
 * Rules, in order:
 * - nothing open, or a filed affidavit released → nothing to draw;
 * - an affidavit on file → "lien filed <day>", the pay dot alone;
 * - no last work month → nothing (the clock has no basis yet);
 * - the window already closed → "lien gone · window closed <day>";
 * - a pay date after the flag → "file first";
 * - a pay date before the flag → "N d of room";
 * - a pay date already past, or none → the flag stands alone.
 *
 * Property kind unknown: the RESIDENTIAL (earlier) date is shown and marked
 * `kindAssumed` — a house read as commercial is a lien lost a month late.
 * Pure: every input is a value another kernel or a row already carries.
 */

export type LienRunwayState = 'none' | 'filed' | 'closed' | 'file_first' | 'room' | 'no_pay'
export type LienRunwayTone = 'green' | 'amber' | 'red' | 'grey'

export type LienRunwayInput = {
  todayYmd: string
  /** Job-level open balance (revenue − payments); ≤ 0 draws nothing. */
  openBalance: number
  /** The job's last work date (latest approved clock session); '' / null when none. */
  lastWorkYmd: string | null | undefined
  /** '' | 'residential' | 'non_residential' from the property record. */
  propertyKind: string
  /** The expected-pay date from `billedExpectedPayModel` (the GC's word, a promise, or the pay-speed estimate); null when none. */
  expectedPayYmd: string | null
  /** The live affidavit's filed date (job_lien_filings, kind 'affidavit'); null when none. */
  filedYmd: string | null
  /** A release of record on file (the lien is discharged). */
  releasedYmd: string | null
}

export type LienRunwayMarks = {
  /** Days from today at the runway's right edge (> every mark). */
  endDays: number
  /** The pay dot, as days from today and percent along the track; null when there is no live pay date. */
  pay: { days: number; pct: number } | null
  /** The lien flag. */
  lien: { days: number; pct: number }
  /** The colored run between the two marks: 'room' (green) or 'short' (red hatching); null with one mark. */
  gap: { fromPct: number; toPct: number; kind: 'room' | 'short' } | null
}

export type LienPayRunway = {
  state: LienRunwayState
  tone: LienRunwayTone
  /** The sentence under the track — always the same shape: earlier date, arrow, later date, the gap and what it means. */
  words: string
  /** Hover text: the basis (last work month, kind, the statute) and what to do. */
  title: string
  /** The one-chip label for the phone row — short, no dates. */
  chipLabel: string
  /** The § 53.052 date, 'YYYY-MM-DD'; '' when unknown. */
  lienByYmd: string
  /** Days from today to the flag (negative once closed); null when unknown. */
  daysToLien: number | null
  /** The residential date is shown because the property kind is not set. */
  kindAssumed: boolean
  /** The right-edge label under the track ('' when there is no track). */
  endLabel: string
  marks: LienRunwayMarks | null
  /** Ascending = tightest first: file-first rows, then flags standing alone, then rows with room; closed and filed last. */
  sortKey: number
}

export const LIEN_RUNWAY_AMBER_DAYS = 21
export const LIEN_RUNWAY_RED_DAYS = 7

const NONE: LienPayRunway = {
  state: 'none',
  tone: 'grey',
  words: '',
  title: '',
  chipLabel: '',
  lienByYmd: '',
  daysToLien: null,
  kindAssumed: false,
  endLabel: '',
  marks: null,
  sortKey: Number.MAX_SAFE_INTEGER,
}

function ymdToUtcDays(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return null
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

/** Calendar days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier); null when either is not a date. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtcDays(fromYmd)
  const b = ymdToUtcDays(toYmd)
  if (a == null || b == null) return null
  return b - a
}

function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToUtcDays(ymd)
  if (d == null) return ''
  return new Date((d + days) * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The § 53.052 date for a job, and whether the residential clock was assumed.
 * '' kind → the residential (earlier) date, `kindAssumed: true`.
 */
export function lienByForJob(lastWorkYmd: string | null | undefined, propertyKind: string): { ymd: string; kindAssumed: boolean } {
  const kind = (propertyKind ?? '').trim()
  const known = kind === 'residential' || kind === 'non_residential'
  const ymd = filingDeadlineForMonth((lastWorkYmd ?? '').trim().slice(0, 10), known ? kind : 'residential')
  return { ymd, kindAssumed: !known && ymd !== '' }
}

function daysWords(n: number): string {
  return `${n} d`
}

const KIND_ASSUMED_NOTE = 'Property kind is not set, so the earlier (residential) date is shown — set the kind on the property record to confirm.'

function basisWords(lastWorkYmd: string, propertyKind: string, kindAssumed: boolean): string {
  const month = new Date(`${lastWorkYmd.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const nth = kindAssumed || propertyKind === 'residential' ? '3rd' : '4th'
  const kindWords = kindAssumed ? 'residential assumed' : propertyKind === 'residential' ? 'residential' : 'commercial'
  return `Counts from the last work month (${month}, approved hours) · ${kindWords}: the 15th of the ${nth} month after (§ 53.052)`
}

export function buildLienPayRunway(input: LienRunwayInput): LienPayRunway {
  if (!(input.openBalance > 0)) return NONE
  if (input.releasedYmd) return NONE
  const today = (input.todayYmd ?? '').slice(0, 10)
  if (ymdToUtcDays(today) == null) return NONE

  if (input.filedYmd) {
    const filed = input.filedYmd.slice(0, 10)
    return {
      ...NONE,
      state: 'filed',
      tone: 'green',
      words: `lien filed ${formatYmdMonthDay(filed)}`,
      title: 'The lien affidavit is on file. The money is still owed; the Lien window carries the serve-by and the year to sue.',
      chipLabel: 'lien filed',
      sortKey: 3_000_000,
    }
  }

  const lastWork = (input.lastWorkYmd ?? '').trim().slice(0, 10)
  const { ymd: lienBy, kindAssumed } = lienByForJob(lastWork, input.propertyKind)
  if (!lienBy) return NONE
  const daysToLien = daysBetweenYmd(today, lienBy)
  if (daysToLien == null) return NONE
  const basis = basisWords(lastWork, input.propertyKind, kindAssumed)
  const kindNote = kindAssumed ? ` ${KIND_ASSUMED_NOTE}` : ''
  const lienWords = formatYmdMonthDay(lienBy)

  if (daysToLien < 0) {
    return {
      ...NONE,
      state: 'closed',
      tone: 'red',
      words: `lien gone · window closed ${lienWords}`,
      title: `The § 53.052 window closed ${lienWords} with nothing filed. The lien is gone; the money is still owed — Collections, or the Legal desk. ${basis}.${kindNote}`,
      chipLabel: 'lien gone',
      lienByYmd: lienBy,
      daysToLien,
      kindAssumed,
      sortKey: 2_000_000 + daysToLien,
    }
  }

  const payYmd = (input.expectedPayYmd ?? '').slice(0, 10)
  const daysToPay = payYmd ? daysBetweenYmd(today, payYmd) : null
  const livePay = daysToPay != null && daysToPay >= 0 ? daysToPay : null
  const urgencyTone: LienRunwayTone = daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'red' : daysToLien <= LIEN_RUNWAY_AMBER_DAYS ? 'amber' : 'grey'

  const farthest = Math.max(daysToLien, livePay ?? 0, 1)
  const endDays = Math.max(Math.ceil(farthest * 1.2), farthest + 3)
  const pct = (d: number) => Math.round((1000 * d) / endDays) / 10
  const lienMark = { days: daysToLien, pct: pct(daysToLien) }
  const endLabel = formatYmdMonthDay(addDaysYmd(today, endDays))

  if (livePay != null && livePay > daysToLien) {
    const short = livePay - daysToLien
    return {
      state: 'file_first',
      tone: 'red',
      words: `lien ${lienWords} → pay ${formatYmdMonthDay(payYmd)} · file first`,
      title: `The lien window closes ${short} ${short === 1 ? 'day' : 'days'} before the money is expected. File the affidavit, or get the payment date moved before ${lienWords}. ${basis}.${kindNote}`,
      chipLabel: 'file first',
      lienByYmd: lienBy,
      daysToLien,
      kindAssumed,
      endLabel,
      marks: { endDays, pay: { days: livePay, pct: pct(livePay) }, lien: lienMark, gap: { fromPct: lienMark.pct, toPct: pct(livePay), kind: 'short' } },
      sortKey: daysToLien,
    }
  }

  if (livePay != null) {
    const room = daysToLien - livePay
    return {
      state: 'room',
      tone: daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'amber' : 'green',
      words: `pay ${formatYmdMonthDay(payYmd)} → lien ${lienWords} · ${daysWords(room)} of room`,
      title: `Expected pay lands ${room} ${room === 1 ? 'day' : 'days'} before the lien window closes. Wait for the money; the lien is still there if it does not come. ${basis}.${kindNote}`,
      chipLabel: `${daysWords(room)} of room`,
      lienByYmd: lienBy,
      daysToLien,
      kindAssumed,
      endLabel,
      marks: { endDays, pay: { days: livePay, pct: pct(livePay) }, lien: lienMark, gap: { fromPct: pct(livePay), toPct: lienMark.pct, kind: 'room' } },
      sortKey: 1_000_000 + daysToLien,
    }
  }

  const payPast = daysToPay != null && daysToPay < 0
  const lead = payPast ? `pay was due ${formatYmdMonthDay(payYmd)}` : 'no pay date'
  return {
    state: 'no_pay',
    tone: urgencyTone,
    words: `${lead} · lien ${lienWords} · ${daysWords(daysToLien)}`,
    title: `${payPast ? `The expected pay date has passed with the balance still open.` : 'Nobody has said when this will be paid.'} The lien window closes ${lienWords}. ${basis}.${kindNote}`,
    chipLabel: `lien in ${daysWords(daysToLien)}`,
    lienByYmd: lienBy,
    daysToLien,
    kindAssumed,
    endLabel,
    marks: { endDays, pay: null, lien: lienMark, gap: null },
    sortKey: 500_000 + daysToLien,
  }
}

/** Whether the phone row's one chip should be this runway rather than the softer facts behind it. */
export function lienRunwayWantsTheChip(r: LienPayRunway | null | undefined): boolean {
  if (!r) return false
  if (r.state === 'file_first' || r.state === 'closed') return true
  if ((r.state === 'no_pay' || r.state === 'room') && r.daysToLien != null && r.daysToLien <= LIEN_RUNWAY_AMBER_DAYS) return true
  return false
}
