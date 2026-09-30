import { filingDeadlineForMonth, noticeDeadlineForMonth } from './lienDeadlines'
import { formatYmdMonthDay } from './billedExpectedPay'
import { DATED_FROM_CREATION_WORDS } from './lienDesk'

/**
 * The lien runway (v2.4051): does the money land before the lien dies?
 *
 * A Billed or Collections row already knows two dates — when the customer is
 * expected to pay (`billedExpectedPay`) and the last day a § 53.052 affidavit
 * can be filed (`lienDeadlines`). Side by side they still make the reader
 * subtract; this kernel does the subtraction and returns one reading: the
 * marks for a short runway (today → the pay dot → the lien flag), the words
 * under it (two lines: the dates, then the verdict), the tone, and a sort key
 * that puts the tightest runway first.
 *
 * Rules, in order:
 * - nothing open, or a filed affidavit released → nothing to draw;
 * - an affidavit on file → "lien filed <day>", the pay dot alone;
 * - a sub job (a GC on the job) whose § 53.056 notice for the work month is
 *   not recorded → the notice is the first deadline: a hollow flag ahead of
 *   the lien flag and "send the notice"; a notice window already closed
 *   means the lien for that month is gone (v2.4096);
 * - no last work month → the job's creation month stands in, as on the Lien
 *   desk (`datedFromCreation`); with neither, nothing;
 * - the window already closed → "lien gone · window closed <day>";
 * - a pay date after the flag → "file first";
 * - a pay date before the flag → "N d of room";
 * - a pay date already past, or none → the flag stands alone.
 *
 * Property kind unknown: the RESIDENTIAL (earlier) date is shown and marked
 * `kindAssumed` — a house read as commercial is a lien lost a month late.
 * Pure: every input is a value another kernel or a row already carries.
 */

export type LienRunwayState = 'none' | 'filed' | 'closed' | 'notice_due' | 'file_first' | 'room' | 'no_pay'
export type LienRunwayTone = 'green' | 'amber' | 'red' | 'grey'

export type LienRunwayInput = {
  todayYmd: string
  /** Job-level open balance (revenue − payments); ≤ 0 draws nothing. */
  openBalance: number
  /** The job's last work date (latest approved clock session); '' / null when none. */
  lastWorkYmd: string | null | undefined
  /** The job's creation instant — the month that stands in when there are no clock hours (the Lien desk's rule). */
  createdAt?: string | null
  /** '' | 'residential' | 'non_residential' from the property record. */
  propertyKind: string
  /** The expected-pay date from `billedExpectedPayModel` (the GC's word, a promise, or the pay-speed estimate); null when none. */
  expectedPayYmd: string | null
  /** The live affidavit's filed date (job_lien_filings, kind 'affidavit'); null when none. */
  filedYmd: string | null
  /** A release of record on file (the lien is discharged). */
  releasedYmd: string | null
  /** A GC on the job — we are a subcontractor, and § 53.056 wants a notice to the owner and the GC before any lien (v2.4096). */
  isSub?: boolean
  /** 'YYYY-MM' months the job's live § 53.056 notices say they cover. */
  noticedMonths?: ReadonlyArray<string>
  /** A live notice that lists no months still counts as the work month's notice. */
  anyNoticeOnFile?: boolean
}

export type LienRunwayMarks = {
  /** Days from today at the runway's right edge (> every mark). */
  endDays: number
  /** The pay dot, as days from today and percent along the track; null when there is no live pay date. */
  pay: { days: number; pct: number } | null
  /** The lien flag. */
  lien: { days: number; pct: number }
  /** A sub job's § 53.056 notice: hollow (owed) or a check (recorded); null on direct jobs or once its date is behind us. */
  notice: { days: number; pct: number; done: boolean } | null
  /** The colored run between the two marks: 'room' (green) or 'short' (red hatching); null with one mark. */
  gap: { fromPct: number; toPct: number; kind: 'room' | 'short' } | null
}

export type LienPayRunway = {
  state: LienRunwayState
  tone: LienRunwayTone
  /** The sentence under the track — always the same shape: earlier date, arrow, later date, the gap and what it means. */
  words: string
  /** The same sentence as the row draws it: the dates on the first line, the verdict on the second (a filed lien is one line). */
  lines: string[]
  /** Hover text: the basis (last work month, kind, the statute) and what to do. */
  title: string
  /** The one-chip label for the phone row — short, no dates. */
  chipLabel: string
  /** The § 53.052 date, 'YYYY-MM-DD'; '' when unknown. */
  lienByYmd: string
  /** Days from today to the flag (negative once closed); null when unknown. */
  daysToLien: number | null
  /** The § 53.056 notice date for the work month on a sub job, 'YYYY-MM-DD'; '' on direct jobs or when unknown. */
  noticeByYmd: string
  /** Days from today to the notice date; null when there is none. */
  daysToNotice: number | null
  /** The residential date is shown because the property kind is not set. */
  kindAssumed: boolean
  /** The § 53.056 notice for the work month is recorded (a sub job); false on a direct job. The Pipeline's dates block reads it (v2.4205). */
  noticeSent: boolean
  /** No clock hours — the clock counts from the month the job was created. */
  datedFromCreation: boolean
  /** The right-edge label under the track ('' when there is no track). */
  endLabel: string
  marks: LienRunwayMarks | null
  /** Ascending = tightest first: notices owed and file-first rows, then flags standing alone, then rows with room; closed and filed last. */
  sortKey: number
}

export const LIEN_RUNWAY_AMBER_DAYS = 21
export const LIEN_RUNWAY_RED_DAYS = 7

const NONE: LienPayRunway = {
  state: 'none',
  tone: 'grey',
  words: '',
  lines: [],
  title: '',
  chipLabel: '',
  lienByYmd: '',
  daysToLien: null,
  noticeByYmd: '',
  daysToNotice: null,
  kindAssumed: false,
  noticeSent: false,
  datedFromCreation: false,
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

function basisWords(lastWorkYmd: string, propertyKind: string, kindAssumed: boolean, datedFromCreation: boolean): string {
  const month = new Date(`${lastWorkYmd.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const nth = kindAssumed || propertyKind === 'residential' ? '3rd' : '4th'
  const kindWords = kindAssumed ? 'residential assumed' : propertyKind === 'residential' ? 'residential' : 'commercial'
  const from = datedFromCreation ? `${month}, ${DATED_FROM_CREATION_WORDS}` : `${month}, approved hours`
  return `Counts from the last work month (${from}) · ${kindWords}: the 15th of the ${nth} month after (§ 53.052)`
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
      lines: [`lien filed ${formatYmdMonthDay(filed)}`],
      noticeSent: false,
      title: 'The lien affidavit is on file. The money is still owed; the Lien window carries the serve-by and the year to sue.',
      chipLabel: 'lien filed',
      sortKey: 3_000_000,
    }
  }

  const worked = (input.lastWorkYmd ?? '').trim().slice(0, 10)
  const created = (input.createdAt ?? '').trim().slice(0, 10)
  const datedFromCreation = !/^\d{4}-\d{2}-\d{2}$/.test(worked) && /^\d{4}-\d{2}-\d{2}$/.test(created)
  const lastWork = datedFromCreation ? created : worked
  const { ymd: lienBy, kindAssumed } = lienByForJob(lastWork, input.propertyKind)
  if (!lienBy) return NONE
  const daysToLien = daysBetweenYmd(today, lienBy)
  if (daysToLien == null) return NONE
  const basis = basisWords(lastWork, input.propertyKind, kindAssumed, datedFromCreation)
  const kindNote = kindAssumed ? ` ${KIND_ASSUMED_NOTE}` : ''
  const lienWords = formatYmdMonthDay(lienBy)
  const wordsOf = (lines: string[]) => lines.join(' · ')

  // § 53.056: a sub's notice for the work month comes before any lien (v2.4096).
  const isSub = input.isSub === true
  const workMonth = lastWork.slice(0, 7)
  const kindEff = input.propertyKind === 'non_residential' ? 'non_residential' : 'residential'
  const noticeBy = isSub ? noticeDeadlineForMonth(lastWork, kindEff) : ''
  const noticedMonths = input.noticedMonths ?? []
  const noticeSent = isSub && (noticedMonths.includes(workMonth) || (input.anyNoticeOnFile === true && noticedMonths.length === 0))
  const daysToNotice = noticeBy ? daysBetweenYmd(today, noticeBy) : null
  const noticeOwed = isSub && !noticeSent && daysToNotice != null
  const noticeWords = noticeBy ? formatYmdMonthDay(noticeBy) : ''
  const noticeNote = isSub && noticeSent ? ' The § 53.056 notice for this month is recorded.' : ''

  if (noticeOwed && daysToNotice < 0) {
    return {
      ...NONE,
      state: 'closed',
      tone: 'red',
      words: wordsOf(['lien gone', `notice window closed ${noticeWords}`]),
      lines: ['lien gone', `notice window closed ${noticeWords}`],
      title: `The § 53.056 notice for this work month was due ${noticeWords} and none is recorded, so the lien for it is gone. The money is still owed — Collections, or the Legal desk. ${basis}.${kindNote}`,
      chipLabel: 'lien gone',
      lienByYmd: lienBy,
      daysToLien,
      noticeByYmd: noticeBy,
      daysToNotice,
      kindAssumed,
      noticeSent,
      datedFromCreation,
      sortKey: 2_000_000 + daysToNotice,
    }
  }

  if (daysToLien < 0) {
    return {
      ...NONE,
      state: 'closed',
      tone: 'red',
      words: wordsOf(['lien gone', `window closed ${lienWords}`]),
      lines: ['lien gone', `window closed ${lienWords}`],
      title: `The § 53.052 window closed ${lienWords} with nothing filed. The lien is gone; the money is still owed — Collections, or the Legal desk. ${basis}.${kindNote}`,
      chipLabel: 'lien gone',
      lienByYmd: lienBy,
      daysToLien,
      noticeByYmd: noticeBy,
      daysToNotice,
      kindAssumed,
      noticeSent,
      datedFromCreation,
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
  const noticeMark = isSub && daysToNotice != null && daysToNotice >= 0 ? { days: daysToNotice, pct: pct(daysToNotice), done: noticeSent } : null
  const payMark = livePay != null ? { days: livePay, pct: pct(livePay) } : null

  if (noticeOwed) {
    const lines = [`notice by ${noticeWords} · lien by ${lienWords}`, `send the notice · ${daysWords(daysToNotice)}`]
    return {
      state: 'notice_due',
      tone: daysToNotice <= LIEN_RUNWAY_RED_DAYS ? 'red' : 'amber',
      words: wordsOf(lines),
      lines,
      title: `A § 53.056 notice for this work month is owed to the owner and the GC by ${noticeWords}; the lien affidavit can then be filed by ${lienWords}. Send it from the Lien desk. ${basis}.${kindNote}`,
      chipLabel: `notice in ${daysWords(daysToNotice)}`,
      lienByYmd: lienBy,
      daysToLien,
      noticeByYmd: noticeBy,
      daysToNotice,
      kindAssumed,
      noticeSent,
      datedFromCreation,
      endLabel,
      marks: { endDays, pay: payMark, lien: lienMark, notice: noticeMark, gap: null },
      sortKey: daysToNotice,
    }
  }

  if (livePay != null && livePay > daysToLien) {
    const short = livePay - daysToLien
    const lines = [`file lien by ${lienWords} → pay ${formatYmdMonthDay(payYmd)}`, 'file first']
    return {
      state: 'file_first',
      tone: 'red',
      words: wordsOf(lines),
      lines,
      title: `The lien window closes ${short} ${short === 1 ? 'day' : 'days'} before the money is expected. File the affidavit, or get the payment date moved before ${lienWords}.${noticeNote} ${basis}.${kindNote}`,
      chipLabel: 'file first',
      lienByYmd: lienBy,
      daysToLien,
      noticeByYmd: noticeBy,
      daysToNotice,
      kindAssumed,
      noticeSent,
      datedFromCreation,
      endLabel,
      marks: { endDays, pay: { days: livePay, pct: pct(livePay) }, lien: lienMark, notice: noticeMark, gap: { fromPct: lienMark.pct, toPct: pct(livePay), kind: 'short' } },
      sortKey: daysToLien,
    }
  }

  if (livePay != null) {
    const room = daysToLien - livePay
    const lines = [`pay ${formatYmdMonthDay(payYmd)} → file lien by ${lienWords}`, `${daysWords(room)} of room`]
    return {
      state: 'room',
      tone: daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'amber' : 'green',
      words: wordsOf(lines),
      lines,
      title: `Expected pay lands ${room} ${room === 1 ? 'day' : 'days'} before the lien window closes. Wait for the money; the lien is still there if it does not come.${noticeNote} ${basis}.${kindNote}`,
      chipLabel: `${daysWords(room)} of room`,
      lienByYmd: lienBy,
      daysToLien,
      noticeByYmd: noticeBy,
      daysToNotice,
      kindAssumed,
      noticeSent,
      datedFromCreation,
      endLabel,
      marks: { endDays, pay: { days: livePay, pct: pct(livePay) }, lien: lienMark, notice: noticeMark, gap: { fromPct: pct(livePay), toPct: lienMark.pct, kind: 'room' } },
      sortKey: 1_000_000 + daysToLien,
    }
  }

  const payPast = daysToPay != null && daysToPay < 0
  const lead = payPast ? `pay was due ${formatYmdMonthDay(payYmd)}` : 'no pay date'
  const lines = [`${lead} · file lien by ${lienWords}`, `${daysWords(daysToLien)} to the flag`]
  return {
    state: 'no_pay',
    tone: urgencyTone,
    words: wordsOf(lines),
    lines,
    title: `${payPast ? `The expected pay date has passed with the balance still open.` : 'Nobody has said when this will be paid.'} The lien window closes ${lienWords}.${noticeNote} ${basis}.${kindNote}`,
    chipLabel: `lien in ${daysWords(daysToLien)}`,
    lienByYmd: lienBy,
    daysToLien,
    noticeByYmd: noticeBy,
    daysToNotice,
    kindAssumed,
    noticeSent,
    datedFromCreation,
    endLabel,
    marks: { endDays, pay: null, lien: lienMark, notice: noticeMark, gap: null },
    sortKey: 500_000 + daysToLien,
  }
}

/** Whether the phone row's one chip should be this runway rather than the softer facts behind it. */
export function lienRunwayWantsTheChip(r: LienPayRunway | null | undefined): boolean {
  if (!r) return false
  if (r.state === 'file_first' || r.state === 'closed') return true
  if (r.state === 'notice_due' && r.daysToNotice != null && r.daysToNotice <= LIEN_RUNWAY_AMBER_DAYS) return true
  if ((r.state === 'no_pay' || r.state === 'room') && r.daysToLien != null && r.daysToLien <= LIEN_RUNWAY_AMBER_DAYS) return true
  return false
}
