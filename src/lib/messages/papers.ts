/**
 * Bills and estimates in a message (punch list #127): a customer's own papers, as the reply box offers them. Pure: the
 * read (`papersIo.ts`) hands the rows in.
 *
 * A bill is open by the bill-truth kernel the AR page totals with (`computeBillTruth`): billed or in Collections, money
 * still open after the payment rule, not marked Uncollectible. What is open is its amount. A bill billed or paid that
 * is no longer open (settled, or on a job paid in full, whose bills keep `billed`) is a paid copy to send, its amount the
 * bill's own. A job marked Uncollectible offers nothing. A GC project's billing job (`billing_only`) is Owner Billing's, so its bills
 * are never offered here, as Follow up's They owe us leaves them out. A bill has no number of its own: it goes by its
 * job's number, as They owe us and the Stages board name it.
 *
 * An estimate is offered once it is sent: sent and not yet answered, or approved (`customer_accepted`). A draft, a
 * declined one and a superseded one are not.
 *
 * The fills: `paperFills` is what a paper puts in the blanks (its pay page, its amount, its number, its job), and
 * `defaultPaperFills` is the paper a line about money speaks of when nobody picked one: the job's newest open bill in a
 * job's box, the newest open bill anywhere in a person's thread. `{estimate}` waits for its link (#127 PR 3).
 */
import { computeBillTruth, jobIsUncollectible, type BillTruthInvoice, type BillTruthJob, type BillTruthPayment } from '../billing/billTruth'
import { isPayLinkId, payLinkUrl } from '../billing/payLink'
import { billMoney } from '../followUp/theyOweUs'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

// ---------- the rows, as the read selects them ----------

export type PaperJobRow = BillTruthJob & {
  job_name: string | null
  hcp_number: string | null
  click_number: string | null
  /** A GC project's billing job: its bills are Owner Billing's. */
  billing_only: boolean | null
}

export type PaperInvoiceRow = BillTruthInvoice & {
  /** Set when the bill is on Stripe, so it has a pay page. */
  stripe_invoice_id: string | null
}

export type PaperPaymentRow = BillTruthPayment

export type PaperEstimateRow = {
  id: string
  estimate_number: number | string | null
  title: string | null
  total_cents: number | null
  status: string | null
  sent_at: string | null
  job_ledger_id: string | null
}

// ---------- the papers ----------

export interface BillPaper {
  kind: 'bill'
  /** The bill's row (`jobs_ledger_invoices.id`). */
  id: string
  jobId: string
  /** The job's name: "Helotes re-pipe". */
  job: string
  /** The job's number, as the bill shows it: "1312". '' when it has none. */
  number: string
  open: boolean
  /** Open: what is still open on it. Paid: the bill's amount. */
  amount: number
  billedYmd: string | null
  /** Its pay page; null for a bill not on Stripe. */
  payUrl: string | null
}

export interface EstimatePaper {
  kind: 'estimate'
  id: string
  jobId: string | null
  /** The estimate's title: "Kitchen re-pipe". */
  job: string
  number: string
  approved: boolean
  /** Its total. */
  amount: number
  sentYmd: string | null
}

export type Paper = BillPaper | EstimatePaper

const newestFirst = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')

/** A person's bills: the open ones first, then the paid ones, the newest billed first in each. Owner Billing's never. */
export function billPapers(rows: { jobs: readonly PaperJobRow[]; invoices: readonly PaperInvoiceRow[]; payments: readonly PaperPaymentRow[] }): BillPaper[] {
  const jobs = new Map(rows.jobs.filter((j) => !j.billing_only).map((j) => [j.id, j]))
  const invoices = rows.invoices.filter((i) => jobs.has(i.job_id))
  const truth = computeBillTruth({ jobs: [...jobs.values()], invoices, payments: rows.payments })
  const remaining = new Map<string, number>()
  for (const r of [...truth.billed.rows, ...truth.collections.rows]) {
    if (r.invoiceId && !r.settled && !r.uncollectible) remaining.set(r.invoiceId, r.remaining)
  }
  const out: BillPaper[] = []
  for (const inv of invoices) {
    const job = jobs.get(inv.job_id)!
    if (inv.status !== 'billed' && inv.status !== 'paid') continue
    if (jobIsUncollectible(job)) continue
    const open = remaining.has(inv.id)
    out.push({
      kind: 'bill',
      id: inv.id,
      jobId: job.id,
      job: (job.job_name ?? '').trim(),
      number: effectiveJobLedgerNumber(job.hcp_number, job.click_number),
      open,
      amount: open ? remaining.get(inv.id)! : Number(inv.amount ?? 0),
      billedYmd: inv.billed_at ? calendarYmdInAppTzFromIso(inv.billed_at) || null : null,
      payUrl: (inv.stripe_invoice_id ?? '').trim() && isPayLinkId(inv.id) ? payLinkUrl(inv.id) : null,
    })
  }
  return out.sort((a, b) => Number(b.open) - Number(a.open) || newestFirst(a.billedYmd, b.billedYmd) || a.id.localeCompare(b.id))
}

/** A person's estimates once sent: the ones waiting on an answer first, then the approved ones, the newest sent first. */
export function estimatePapers(rows: readonly PaperEstimateRow[]): EstimatePaper[] {
  return rows
    .filter((e) => e.status === 'sent' || e.status === 'customer_accepted')
    .map((e) => ({
      kind: 'estimate' as const,
      id: e.id,
      jobId: e.job_ledger_id,
      job: (e.title ?? '').trim(),
      number: e.estimate_number == null ? '' : String(e.estimate_number),
      approved: e.status === 'customer_accepted',
      amount: Math.round(Number(e.total_cents ?? 0)) / 100,
      sentYmd: e.sent_at ? calendarYmdInAppTzFromIso(e.sent_at) || null : null,
    }))
    .sort((a, b) => Number(a.approved) - Number(b.approved) || newestFirst(a.sentYmd, b.sentYmd) || a.id.localeCompare(b.id))
}

/** The papers in a box: the job's own first when the box is a job's, each kind keeping its order. */
export function papersFor<T extends Paper>(papers: readonly T[], jobId: string | null): T[] {
  if (!jobId) return [...papers]
  return [...papers.filter((p) => p.jobId === jobId), ...papers.filter((p) => p.jobId !== jobId)]
}

// ---------- the fills ----------

/** What a paper puts in the blanks. `{estimate}` waits for its link (#127 PR 3). */
export interface PaperFills {
  bill?: string | null
  amount?: string | null
  number?: string | null
  job?: string | null
}

export function paperFills(paper: Paper): PaperFills {
  if (paper.kind === 'bill') return { bill: paper.payUrl, amount: billMoney(paper.amount), number: paper.number || null, job: paper.job || null }
  return { amount: billMoney(paper.amount), number: paper.number || null, job: paper.job || null }
}

/**
 * The bill a line about money speaks of when nobody picked one. A job's box (`jobOnly`) speaks of its job's newest open
 * bill and no other; a thread speaks of the tied job's when it has one open, else the newest open bill on any job of
 * theirs. Its job's name stays the box's own. Nothing when they owe nothing.
 */
export function defaultPaperFills(papers: readonly Paper[], jobId: string | null, jobOnly = false): PaperFills {
  const open = papers.filter((p): p is BillPaper => p.kind === 'bill' && p.open)
  const onJob = jobId ? open.find((p) => p.jobId === jobId) : undefined
  const bill = jobOnly ? onJob : (onJob ?? open[0])
  if (!bill) return {}
  const fills = paperFills(bill)
  return { bill: fills.bill, amount: fills.amount, number: fills.number }
}
