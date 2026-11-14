import { noticeDeadlineForMonth } from './lienDeadlines'
import { describeNoticeMonths } from './lienNoticeMonthWords'
import type { LienAffidavitNoticeRow } from './lienAffidavitNotices'

/**
 * Whether each month an affidavit swears has a notice behind it (punch list #314). Pure.
 *
 * The office's first signed batch held papers that swore April through August on a house where the first notice was
 * mailed in late September, and the record showed that notice going to the owner alone. § 53.056 asks a subcontractor
 * to send notice to the owner and the original contractor by the 15th of the second month after each month of work on
 * a residential property, the third on any other (`noticeDeadlineForMonth`, the app's reading; counsel has not
 * answered what a late notice leaves standing). So this is a flag, never a hold: the desk's own rule lets a late
 * notice count while the affidavit's window is open, a hold has no override, and a paper stopped by a wrong reading
 * days before its last day to file would cost the lien. The line says what the record shows and to ask the attorney.
 *
 * A month is read off the recorded § 53.056 filings that name it: the first day a copy went to the owner, and the first
 * day one went to the original contractor.
 */

export type LienNoticeCheckMonth = {
  /** 'YYYY-MM' */
  month: string
  /** The last day a notice for this month's work was on time, 'YYYY-MM-DD'. */
  dueOn: string
  ownerSentOn: string | null
  contractorSentOn: string | null
}

export type LienNoticeCheck = {
  months: LienNoticeCheckMonth[]
  /** Months whose first notice to the owner went after its day, or never went. */
  ownerLate: string[]
  /** Months with no copy to the original contractor on record. */
  contractorMissing: string[]
  /** Months whose copy to the original contractor went after its day. */
  contractorLate: string[]
  /**
   * The paper swears no month while a notice is on record (punch list #356): the job's own work months and the months
   * the recorded notices name, which do not meet. Null when the paper names a month, when no notice is on record (the
   * affidavit's own gate holds then), or when the caller gave no work months.
   */
  empty: { work: string[]; named: string[] } | null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

function firstSend(filings: ReadonlyArray<LienAffidavitNoticeRow>, month: string, recipient: string): string | null {
  let first: string | null = null
  for (const f of filings) {
    if (f.kind !== 'notice_53_056' || f.voided_at || !(f.months_covered ?? []).includes(month)) continue
    for (const raw of Array.isArray(f.sends) ? f.sends : []) {
      if (!raw || typeof raw !== 'object') continue
      const s = raw as { recipient?: unknown; sent_on?: unknown }
      if (s.recipient !== recipient || typeof s.sent_on !== 'string' || !YMD.test(s.sent_on)) continue
      if (first === null || s.sent_on < first) first = s.sent_on
    }
  }
  return first
}

const MONTH_KEY = /^\d{4}-\d{2}$/

/** The months the live § 53.056 notices name, each once, oldest first (the record's side of `empty`). */
function namedMonths(filings: ReadonlyArray<LienAffidavitNoticeRow>): string[] {
  const out = new Set<string>()
  for (const f of filings) if (f.kind === 'notice_53_056' && !f.voided_at) for (const m of f.months_covered ?? []) if (MONTH_KEY.test(m)) out.add(m)
  return [...out].sort()
}

/**
 * The check for one paper: `months` are the months it swears (`lienAffidavitSwornMonths`). A job contracted with the
 * owner owes no notice and has nothing to check. `work` (punch list #356) is the job's own work months
 * (`lienAffidavitWorkMonths`): with it, a paper that swears no month while a notice on record names other months is
 * `empty`, and the lines say why the months line is blank.
 */
export function lienAffidavitNoticeCheck(input: { isSub: boolean; propertyKind: string | null | undefined; months: ReadonlyArray<string>; filings: ReadonlyArray<LienAffidavitNoticeRow> | null | undefined; work?: ReadonlyArray<string> | null }): LienNoticeCheck {
  const none: LienNoticeCheck = { months: [], ownerLate: [], contractorMissing: [], contractorLate: [], empty: null }
  if (!input.isSub) return none
  const filings = input.filings ?? []
  const months = [...new Set(input.months.filter((m) => MONTH_KEY.test(m)))].sort().map((month): LienNoticeCheckMonth => ({
    month,
    dueOn: noticeDeadlineForMonth(`${month}-01`, input.propertyKind ?? ''),
    ownerSentOn: firstSend(filings, month, 'owner'),
    contractorSentOn: firstSend(filings, month, 'original_contractor'),
  }))
  const late = (sentOn: string | null, dueOn: string) => sentOn !== null && dueOn !== '' && sentOn > dueOn
  const work = [...new Set((input.work ?? []).filter((m) => MONTH_KEY.test(m)))].sort()
  const named = months.length === 0 && work.length > 0 ? namedMonths(filings) : []
  return {
    months,
    ownerLate: months.filter((m) => m.ownerSentOn === null || late(m.ownerSentOn, m.dueOn)).map((m) => m.month),
    contractorMissing: months.filter((m) => m.contractorSentOn === null).map((m) => m.month),
    contractorLate: months.filter((m) => late(m.contractorSentOn, m.dueOn)).map((m) => m.month),
    empty: named.length > 0 ? { work, named } : null,
  }
}

/** True when the record raises a question about any sworn month, or the paper swears none while a notice is on record. */
export function lienNoticeCheckFlags(check: LienNoticeCheck): boolean {
  return check.ownerLate.length > 0 || check.contractorMissing.length > 0 || check.contractorLate.length > 0 || check.empty !== null
}

/** The lead above the lines: what to do about them. */
export const LIEN_NOTICE_CHECK_LEAD = 'Ask the attorney before this is filed.'

/** The first of the empty case's sentences: the fact, before the two lists. */
export const LIEN_NOTICE_CHECK_EMPTY_LEAD = 'No recorded notice names a month this job was worked.'

/**
 * Why the months line is blank (punch list #356), three sentences: the fact, the job's work months, the months the
 * notice on record names. The two lists side by side are what the office and the attorney read. Empty when the paper
 * names a month.
 */
export function lienNoticeCheckEmptyLines(check: Pick<LienNoticeCheck, 'empty'>): string[] {
  if (!check.empty) return []
  return [LIEN_NOTICE_CHECK_EMPTY_LEAD, `Its work was in ${describeNoticeMonths(check.empty.work)}.`, `The notice on record names ${describeNoticeMonths(check.empty.named)}.`]
}

/** The lines the desk and the Lien window draw, one per kind of question; none when the record raises none. */
export function lienNoticeCheckLines(check: LienNoticeCheck): string[] {
  const lines: string[] = [...lienNoticeCheckEmptyLines(check)]
  if (check.ownerLate.length > 0) lines.push(`The owner's notice went after its date, or is not on record, for ${describeNoticeMonths(check.ownerLate)}.`)
  if (check.contractorMissing.length > 0) lines.push(`No copy to the original contractor is on record for ${describeNoticeMonths(check.contractorMissing)}.`)
  if (check.contractorLate.length > 0) lines.push(`The original contractor's copy went after its date for ${describeNoticeMonths(check.contractorLate)}.`)
  return lines
}

/** The months the record raises a question about, each once, the oldest first. */
export function lienNoticeCheckMonths(check: LienNoticeCheck): string[] {
  return [...new Set([...check.ownerLate, ...check.contractorMissing, ...check.contractorLate])].sort()
}

/**
 * Months in the fewest words: three or more in a row read as a span (`April to July 2026`, `November 2026 to January
 * 2027`), anything else as `describeNoticeMonths` lists it. '' for none.
 */
export function noticeMonthsSpanWords(months: ReadonlyArray<string>): string {
  const sorted = [...new Set(months.filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort()
  const at = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7))
  const inARow = sorted.every((m, i) => i === 0 || at(m) === at(sorted[i - 1] as string) + 1)
  if (sorted.length < 3 || !inARow) return describeNoticeMonths(sorted)
  const first = describeNoticeMonths([sorted[0] as string])
  const last = describeNoticeMonths([sorted[sorted.length - 1] as string])
  return first.slice(-4) === last.slice(-4) ? `${first.replace(/ \d{4}$/, '')} to ${last}` : `${first} to ${last}`
}

/**
 * The check in one sentence, for a row with no room for the lines (the batch help sheet, the owner 2026-11-13: the
 * two long sentences are more than the row needs). It keeps the months and drops who and which: the notice record and
 * the Lien window say those. '' when the record raises no question.
 */
export function lienNoticeCheckRowLine(check: LienNoticeCheck): string {
  if (check.empty) return LIEN_NOTICE_CHECK_EMPTY_LEAD
  const months = lienNoticeCheckMonths(check)
  if (months.length === 0) return ''
  return months.length === 1 ? `The notice for ${noticeMonthsSpanWords(months)} went late or is not on record.` : `Notices for ${noticeMonthsSpanWords(months)} went late or are not on record.`
}

/**
 * The check in the fewest sentences that still say which copy, for the box that closes a notice record (the owner,
 * 2026-11-13, on that box with the lines above in it: *this sentence looks like it is too long*). The same months as
 * `lienNoticeCheckLines`, said shorter three ways: the months read as a span, two copies with one answer share a
 * sentence (*Both copies went late for April to July 2026.*), and the owner's copy is said as late or as not on
 * record, never both, because each month's row says which. A check whose months carry no row keeps the long lines.
 */
export function lienNoticeCheckShortLines(check: LienNoticeCheck): string[] {
  // The empty case has no month rows to shorten: the fact, then the two lists read as spans.
  if (check.empty) return [LIEN_NOTICE_CHECK_EMPTY_LEAD, `Its work was in ${noticeMonthsSpanWords(check.empty.work)}.`, `The notice on record names ${noticeMonthsSpanWords(check.empty.named)}.`]
  const by = new Map(check.months.map((m) => [m.month, m]))
  if ([...check.ownerLate, ...check.contractorMissing, ...check.contractorLate].some((m) => !by.has(m))) return lienNoticeCheckLines(check)
  const ownerMissing = check.ownerLate.filter((m) => by.get(m)?.ownerSentOn === null)
  const ownerLate = check.ownerLate.filter((m) => !ownerMissing.includes(m))
  const same = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.length > 0 && [...new Set(a)].sort().join() === [...new Set(b)].sort().join()
  const lines: string[] = []
  if (same(ownerLate, check.contractorLate)) lines.push(`Both copies went late for ${noticeMonthsSpanWords(ownerLate)}.`)
  else {
    if (ownerLate.length > 0) lines.push(`The owner's copy went late for ${noticeMonthsSpanWords(ownerLate)}.`)
    if (check.contractorLate.length > 0) lines.push(`The original contractor's copy went late for ${noticeMonthsSpanWords(check.contractorLate)}.`)
  }
  if (same(ownerMissing, check.contractorMissing)) lines.push(`No copy is on record for ${noticeMonthsSpanWords(ownerMissing)}.`)
  else {
    if (ownerMissing.length > 0) lines.push(`No copy to the owner is on record for ${noticeMonthsSpanWords(ownerMissing)}.`)
    if (check.contractorMissing.length > 0) lines.push(`No copy to the original contractor is on record for ${noticeMonthsSpanWords(check.contractorMissing)}.`)
  }
  return lines
}
