import { openRemainder } from '../billing/billTruth'
import { attributeJobPayments, isSentBill, type AttributionPayment } from './paymentAttribution'
import { billedReferenceYmd, formatYmdMonthDay } from './billedExpectedPay'
import { daysBetweenYmd } from './lienPayRunway'
import type { LienCalendarJob } from './lienCalendar'
import type { LienCalendarBucket } from './lienCalendarBuckets'

/**
 * Days since billed, and the By date tab's Later list (v2.7254).
 *
 * Later holds the jobs with nothing to do for two months or more. Each was a full
 * timeline row, so the quiet jobs took most of the screen. They are a list now, one
 * line a job, oldest bill first: what has waited longest for its money leads, since
 * no date in this bucket asks for anything yet.
 *
 * The age counts from the oldest bill still open. A bill's day is the desk's own
 * reference (`billedReferenceYmd`): `billed_at` as a civil day in the company's time
 * zone, else the bill's estimated day. A job with no bill row falls back to the job's
 * `last_bill_date`, else it has no age and sorts last.
 *
 * Pure. No date here is a deadline and none moves one: the lien's day and the notice's
 * day are read from the runway the rest of the tab reads.
 */

export type LienBilledAgeBill = {
  id: string
  status: string | null | undefined
  amount: number | string | null | undefined
  billed_at?: string | null
  estimated_bill_date?: string | null
  sequence_order?: number | null
}

/** The civil day the job's oldest open billed bill went out; null when the job has no bill day on record. */
export function lienBilledOnYmd(
  job: { revenue?: number | string | null; last_bill_date?: string | null },
  invoices: ReadonlyArray<LienBilledAgeBill>,
  payments: ReadonlyArray<AttributionPayment> = [],
): string | null {
  const billed = invoices.filter((i) => i.status === 'billed')
  if (billed.length > 0) {
    // What each bill has been paid follows the one payment rule (`lienBilledOpen`): a bill paid in full is not waiting.
    const paid = attributeJobPayments(invoices.filter((i) => isSentBill(i.status)), payments, job.revenue ?? null).byBill
    const open = billed.filter((i) => openRemainder(Number(i.amount ?? 0), paid.get(i.id)?.applied ?? 0) > 0)
    const days = (open.length > 0 ? open : billed)
      .map((i) => billedReferenceYmd({ billedAtIso: i.billed_at ?? null, estBillYmd: i.estimated_bill_date ?? null }))
      .filter((d): d is string => Boolean(d))
      .sort()
    if (days[0]) return days[0]
  }
  const last = (job.last_bill_date ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : null
}

/** From this many days a bill's age reads amber, and from this many red. */
export const LIEN_BILLED_AGE_AMBER_DAYS = 30
export const LIEN_BILLED_AGE_RED_DAYS = 60
/** The meter is full at this age; an older bill draws the same full meter. */
export const LIEN_BILLED_AGE_METER_DAYS = 90

export type LienBilledAgeTone = 'muted' | 'amber' | 'red'

export type LienBilledAge = {
  ymd: string
  days: number
  /** "39 d ago", "1 d ago", "today". */
  words: string
  tone: LienBilledAgeTone
  /** The meter's length, 0 to 100: the age over ninety days, capped. */
  meterPct: number
  /** The hover: the day itself and what the age counts from. */
  title: string
}

export function lienBilledAge(billedOnYmd: string | null | undefined, todayYmd: string): LienBilledAge | null {
  if (!billedOnYmd) return null
  const between = daysBetweenYmd(billedOnYmd, todayYmd)
  if (between == null) return null
  const days = Math.max(0, between)
  return {
    ymd: billedOnYmd,
    days,
    words: days === 0 ? 'today' : `${days} d ago`,
    tone: days >= LIEN_BILLED_AGE_RED_DAYS ? 'red' : days >= LIEN_BILLED_AGE_AMBER_DAYS ? 'amber' : 'muted',
    meterPct: Math.round((Math.min(days, LIEN_BILLED_AGE_METER_DAYS) / LIEN_BILLED_AGE_METER_DAYS) * 100),
    title: `Billed ${formatYmdMonthDay(billedOnYmd)}. The age counts from the oldest bill still open.`,
  }
}

/** The hover on a Later line with no age. */
export const LIEN_BILLED_AGE_NONE_TITLE = 'No bill day is on record for this job.'

/** One line of the Later list. */
export type LienLaterLine = {
  job: LienCalendarJob
  /** The GC's name, or "direct". */
  who: string
  billed: LienBilledAge | null
  /** The lien's own day and the days left: "Feb 15 · 93 d". A lien on file or a closed window says so in the runway's words. */
  lienBy: string
  /** What comes before the lien's day, when something does: "notice by Jan 15". Empty otherwise. */
  first: string
  /** An overdue job listed here with its property (v2.4526): greyed, under the job that hosts it. */
  closed: boolean
}

function lienByWords(job: Pick<LienCalendarJob, 'runway'>): { lienBy: string; first: string } {
  const r = job.runway
  if (r.state === 'closed') return { lienBy: r.lines.join(' · ') || r.words, first: '' }
  if (r.state === 'filed' || !r.lienByYmd) return { lienBy: r.lines[0] ?? r.words, first: '' }
  const lienBy = r.daysToLien != null ? `${formatYmdMonthDay(r.lienByYmd)} · ${r.daysToLien} d` : formatYmdMonthDay(r.lienByYmd)
  if (r.state === 'notice_due' && r.noticeByYmd) return { lienBy, first: `notice by ${formatYmdMonthDay(r.noticeByYmd)}` }
  if (r.state === 'late_notice') return { lienBy, first: 'late notice' }
  return { lienBy, first: '' }
}

function whoOf(job: Pick<LienCalendarJob, 'isSub' | 'gcId' | 'gcName'>): string {
  return job.isSub && job.gcId ? job.gcName?.trim() || 'GC' : 'direct'
}

/**
 * The Later bucket as lines, oldest bill first; a job with no bill day goes last. An overdue job
 * the bucket lists with its property keeps its place under the job that hosts it.
 */
export function lienLaterLines(bucket: Pick<LienCalendarBucket, 'jobs' | 'groups'>, todayYmd: string): LienLaterLine[] {
  const guests = new Map<string, LienCalendarJob[]>()
  for (const g of bucket.groups) {
    for (const p of g.byProperty ?? []) {
      if (p.closed.length && p.key.startsWith('p:')) guests.set(p.key.slice(2), p.closed)
    }
  }
  const line = (job: LienCalendarJob, closed: boolean): LienLaterLine => ({ job, who: whoOf(job), billed: lienBilledAge(job.billedOnYmd, todayYmd), ...lienByWords(job), closed })
  const live = bucket.jobs.map((job) => line(job, false))
  live.sort((a, b) => {
    if (a.billed && b.billed) return b.billed.days - a.billed.days || a.job.runway.sortKey - b.job.runway.sortKey || b.job.openBalance - a.job.openBalance
    if (a.billed) return -1
    if (b.billed) return 1
    return a.job.runway.sortKey - b.job.runway.sortKey || b.job.openBalance - a.job.openBalance
  })
  return live.flatMap((l) => [l, ...(guests.get(l.job.jobId) ?? []).map((job) => line(job, true))])
}
