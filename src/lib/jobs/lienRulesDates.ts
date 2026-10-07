import { filingDeadlineForMonth, noticeDeadlineForMonth } from './lienDeadlines'
import { formatYmdMonthDay } from './billedExpectedPay'
import { normalizePropertyKind, propertyKindWords } from './propertyKind'

/**
 * The § Rules window's dates (v2.4826): the guide's example table under *When each date falls*
 * is fixed to 2026, and the window swaps its rows for the months around today, or around the
 * job the desk had open, with that job's row lit. The strip above the rules names the job and
 * its two dates. Pure: the deadlines come from `lienDeadlines.ts`, nothing is read.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export type LienRuleDateRow = {
  /** 'YYYY-MM' */
  month: string
  /** "June", or "December 2025" when the year is not today's. */
  monthWords: string
  noticeCommercial: string
  noticeHouse: string
  lienCommercial: string
  lienHouse: string
  /** The job's own work month. */
  lit: boolean
}

/** The job the desk had open, as the strip and the table read it. */
export type LienRulesJob = {
  label: string
  /** "commercial", "residential" or "kind unknown". */
  kindWords: string
  /** The job has a GC: it owes the monthly notice. */
  isSub: boolean
  /** The last month worked, 'YYYY-MM'; '' when unknown. */
  workMonth: string
  workMonthWords: string
  /** 'YYYY-MM-DD' or '' — the earliest § 53.056 date still open, or the last month's. */
  noticeDue: string
  /** 'YYYY-MM-DD' or '' — the § 53.052 date. */
  lienDue: string
}

function monthKeyAdd(month: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return ''
  const n = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta
  const y = Math.floor(n / 12)
  const mo = (n % 12) + 1
  return `${y}-${String(mo).padStart(2, '0')}`
}

export function lienRuleMonthWords(month: string, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  const name = MONTHS[Number(m[2]) - 1] ?? month
  return m[1] === todayYmd.slice(0, 4) ? name : `${name} ${m[1]}`
}

/**
 * Three rows: the job's work month with one either side, else the month whose commercial
 * notice falls this month (three months back) with one either side.
 */
export function lienRuleDateRows(todayYmd: string, job?: Pick<LienRulesJob, 'workMonth'> | null): LienRuleDateRow[] {
  const centre = job?.workMonth && /^\d{4}-\d{2}$/.test(job.workMonth) ? job.workMonth : monthKeyAdd(todayYmd.slice(0, 7), -3)
  if (!centre) return []
  return [-1, 0, 1].map((d) => {
    const month = monthKeyAdd(centre, d)
    return {
      month,
      monthWords: lienRuleMonthWords(month, todayYmd),
      noticeCommercial: formatYmdMonthDay(noticeDeadlineForMonth(month, 'non_residential')),
      noticeHouse: formatYmdMonthDay(noticeDeadlineForMonth(month, 'residential')),
      lienCommercial: formatYmdMonthDay(filingDeadlineForMonth(month, 'non_residential')),
      lienHouse: formatYmdMonthDay(filingDeadlineForMonth(month, 'residential')),
      lit: d === 0 && !!job?.workMonth,
    }
  })
}

/** The strip's facts from what the desk's queue already holds for the picked job. */
export function lienRulesJobFrom(input: { label: string; propertyKind: string; isSub: boolean; months: ReadonlyArray<{ key: string }>; earliestDeadline: string | null }, todayYmd: string): LienRulesJob {
  const kind = normalizePropertyKind(input.propertyKind)
  const workMonth = input.months.length ? input.months[input.months.length - 1]!.key : ''
  return {
    label: input.label,
    kindWords: propertyKindWords(kind),
    isSub: input.isSub,
    workMonth,
    workMonthWords: workMonth ? lienRuleMonthWords(workMonth, todayYmd) : '',
    noticeDue: input.isSub ? (input.earliestDeadline ?? (workMonth ? noticeDeadlineForMonth(workMonth, kind) : '')) : '',
    lienDue: workMonth ? filingDeadlineForMonth(workMonth, kind) : '',
  }
}

/** The strip's words, one span each: the kind and the work month, then the two dates. */
export function lienRulesJobLine(job: LienRulesJob): { facts: string; noticeDue: string; lienDue: string } {
  const role = job.isSub ? 'Sub job' : 'Direct job, no monthly notice'
  const facts = [role, job.kindWords, job.workMonthWords ? `last work ${job.workMonthWords}` : ''].filter(Boolean).join(' · ')
  return {
    facts,
    noticeDue: job.noticeDue ? formatYmdMonthDay(job.noticeDue) : '',
    lienDue: job.lienDue ? formatYmdMonthDay(job.lienDue) : '',
  }
}
