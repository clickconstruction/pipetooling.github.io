import type { BillTruthJob, BillTruthPayment } from '../billing/billTruth'
import { formatUsdNoCents } from './jobFormatting'
import { lienBilledOpen, type LienClaimInvoice } from './lienBilledOpen'
import { lienUnbilled } from './lienClaimBills'

/**
 * What a job owes, split in two (v2.7532): what its sent bills still owe, and the part of its price on no sent bill.
 * The app totalled "owed" two ways. The Collect desk, the Pipeline's totals and the Lien desk read the bills; a few
 * windows still took the job's price less its payments, so a job billed one stage of three, 30% complete, read as
 * owing the stages never done or billed the moment it was moved to Collections. This kernel is the one split those
 * windows read: `lienBilledOpen` (the payment rule every bill reader shares) for the first figure, the rest of the
 * price for the second, and percent complete beside percent billed so the gap is said, not guessed. Pure.
 */
export type JobOwedJob = Pick<BillTruthJob, 'id' | 'status' | 'revenue' | 'payments_made'> & {
  pct_complete?: number | null
  invoices?: ReadonlyArray<LienClaimInvoice> | null
  payments?: ReadonlyArray<Pick<BillTruthPayment, 'invoice_id' | 'amount'>> | null
}

export type JobOwedSplit = {
  /** What the sent bills still owe. A job billed as one shell, with no bill ever sent, is its price less payments. */
  billedOpen: number
  /** The part of the price no sent bill carries: work not billed yet, or never to be done. Not owed until it is billed. */
  unbilled: number
  /** The job's price. */
  jobTotal: number
  /** How many bills have gone out, owing or paid. */
  sentBills: number
  /** The sent bills as a share of the price, whole percent; null with no price or no sent bill. */
  pctBilled: number | null
  /** The job's percent complete as the office or the crew set it; null when nobody has. */
  pctComplete: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function jobOwedSplit(job: JobOwedJob): JobOwedSplit {
  const invoices = job.invoices ?? []
  const billedOpen = lienBilledOpen(job, invoices, job.payments ?? [])
  const sent = invoices.filter((i) => i.status === 'billed' || i.status === 'paid')
  const jobTotal = Math.max(0, Number(job.revenue ?? 0))
  const billedTotal = round2(sent.reduce((s, i) => s + Number(i.amount ?? 0), 0))
  const pc = job.pct_complete
  return {
    billedOpen,
    unbilled: lienUnbilled(job, billedOpen),
    jobTotal,
    sentBills: sent.length,
    pctBilled: jobTotal > 0 && sent.length > 0 ? Math.min(100, Math.round((billedTotal / jobTotal) * 100)) : null,
    pctComplete: typeof pc === 'number' && Number.isFinite(pc) ? Math.max(0, Math.min(100, Math.round(pc))) : null,
  }
}

/** Whether part of the job's price sits on no sent bill. */
export function jobHasUnbilled(s: Pick<JobOwedSplit, 'unbilled'>): boolean {
  return s.unbilled > 0.005
}

/** *$2,976 billed and still open.* */
export function jobOwedBilledWords(s: Pick<JobOwedSplit, 'billedOpen'>): string {
  return `${formatUsdNoCents(s.billedOpen)} billed and still open.`
}

/** *$25,171 of the job’s $43,249 is not billed.* Empty when every dollar of the price is on a sent bill. */
export function jobOwedUnbilledWords(s: Pick<JobOwedSplit, 'unbilled' | 'jobTotal'>): string {
  return jobHasUnbilled(s) ? `${formatUsdNoCents(s.unbilled)} of the job’s ${formatUsdNoCents(s.jobTotal)} is not billed.` : ''
}

/** *The job is 30% complete and 42% billed.* Empty when either percent is unknown, or nothing is unbilled. */
export function jobOwedPercentWords(s: JobOwedSplit): string {
  if (!jobHasUnbilled(s) || s.pctComplete == null || s.pctBilled == null) return ''
  return `The job is ${s.pctComplete}% complete and ${s.pctBilled}% billed.`
}

/**
 * The lines a window shows before a job is moved to Collections or written off: what is billed and still open, then,
 * only when part of the price is on no bill, how much, the two percents, and what to do about it. One sentence each.
 */
export function jobOwedLines(s: JobOwedSplit): { billed: string; unbilled: string; percent: string; check: string } {
  const has = jobHasUnbilled(s)
  return {
    billed: jobOwedBilledWords(s),
    unbilled: jobOwedUnbilledWords(s),
    percent: jobOwedPercentWords(s),
    check: has ? 'Collections chases what is billed. If the rest will not be done, correct the job total on the job.' : '',
  }
}
