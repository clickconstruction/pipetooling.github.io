/**
 * Customer profile modal — derived stats kernel (v2.1322).
 *
 * Pure math over a customer's jobs/invoices/payments for the three money
 * cells and the aging chip. The money rules are the bill-truth kernel's
 * (`lib/billing/billTruth.ts`, journey Tier-1 #2(c)) — the same rows and the
 * same single clamp the Pipeline strip, the AR card, the Invoices footer and
 * the Customers list read:
 *  - open balance: `openBillRowsForJob` — billed-invoice remainders + billed
 *    job-shells, each clamped at 0 once (an over-paid shell no longer nets
 *    against another job, J34-N6), INCLUDING Collections jobs — flagged money
 *    is still owed to this customer's ledger;
 *  - aging buckets: estimated_bill_date rule at 30/90 days with remaining > 0
 *    (keep in sync with billedStageRowAgingBucket in lib/jobs/invoiceBilling —
 *    same rule, restated here over lean structural inputs);
 *  - lifetime collected: every payment row on their jobs;
 *  - "pays in ~N days": MEDIAN gap between an invoice's billed_at and its
 *    invoice-linked payments' paid_on, last 12 months (job-level payments
 *    excluded — no bill date to measure from).
 */

import {
  appliedByInvoiceId,
  jobBilledContribution,
  lifetimeCollected,
  openBillRowsForJob,
  openRemainder,
} from '../billing/billTruth'

export type ProfileInvoice = {
  id: string
  status: string
  amount: number | null
  billed_at: string | null
  estimated_bill_date: string | null
}

export type ProfilePayment = {
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
}

export type ProfileJob = {
  id: string
  status: string | null
  revenue: number | null
  payments_made: number | null
  invoices: ProfileInvoice[]
  payments: ProfilePayment[]
}

export type CustomerAging = { count30_90: number; sum30_90: number; count90: number; sum90: number }

export type CustomerMoneyStats = {
  openBalance: number
  aging: CustomerAging
  lifetimeCollected: number
  /**
   * Lifetime value (the HouseCall Pro headline): everything ever billed to
   * this customer. Per job: Σ invoice amounts in status billed/paid; jobs
   * with no billed/paid invoice rows fall back to the job shell (revenue)
   * once the job itself has reached billed/paid — mirroring the shell rule
   * openBalance uses.
   */
  lifetimeBilled: number
  jobCount: number
}

function daysBetweenYmdUtc(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime()
  const b = new Date(`${toYmd}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** timestamptz/date → YYYY-MM-DD (UTC slice — consistent with the board's date handling). */
function ymdOf(iso: string): string {
  return iso.slice(0, 10)
}

export function customerMoneyStats(jobs: ProfileJob[], todayYmd: string): CustomerMoneyStats {
  let open = 0
  let lifetime = 0
  let billedTotal = 0
  const aging: CustomerAging = { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 }
  for (const job of jobs) {
    lifetime += lifetimeCollected(job.payments)
    const appliedByInvoice = appliedByInvoiceId(job.payments)
    billedTotal += jobBilledContribution(job, job.invoices)
    const rows = openBillRowsForJob(
      job,
      job.invoices.map((i) => ({ ...i, job_id: job.id })),
      appliedByInvoice,
    )
    const invoiceById = new Map(job.invoices.map((i) => [i.id, i]))
    for (const row of rows) {
      open += row.remaining
      const inv = row.invoiceId ? invoiceById.get(row.invoiceId) : undefined
      if (row.settled || !inv?.estimated_bill_date) continue
      const remaining = row.remaining
      const days = daysBetweenYmdUtc(ymdOf(inv.estimated_bill_date), todayYmd)
      if (days >= 90) {
        aging.count90 += 1
        aging.sum90 += remaining
      } else if (days >= 30) {
        aging.count30_90 += 1
        aging.sum30_90 += remaining
      }
    }
  }
  return { openBalance: open, aging, lifetimeCollected: lifetime, lifetimeBilled: billedTotal, jobCount: jobs.length }
}

export type EstimateOutcomes = { accepted: number; decided: number } | null

/**
 * Estimate win rate inputs: accepted vs decided (accepted + declined).
 * Drafts, sent-and-waiting, and superseded estimates don't count as decided.
 * Null when nothing has been decided yet.
 */
export function customerEstimateOutcomes(estimates: Array<{ status: string }>): EstimateOutcomes {
  let accepted = 0
  let declined = 0
  for (const e of estimates) {
    if (e.status === 'customer_accepted') accepted += 1
    else if (e.status === 'declined') declined += 1
  }
  const decided = accepted + declined
  return decided === 0 ? null : { accepted, decided }
}

export type DaysToPay = { medianDays: number; samples: number } | null

/**
 * Median billed_at → paid_on gap across invoice-linked payments in the last
 * 12 months (by paid_on). Null when there are no measurable samples. Negative
 * gaps (payment recorded before the bill date) are clamped to 0.
 */
export function customerDaysToPay(jobs: ProfileJob[], todayYmd: string): DaysToPay {
  const cutoffYmd = `${Number(todayYmd.slice(0, 4)) - 1}${todayYmd.slice(4)}`
  const gaps: number[] = []
  for (const job of jobs) {
    const billedAtByInvoice = new Map<string, string>()
    for (const inv of job.invoices) {
      if (inv.billed_at) billedAtByInvoice.set(inv.id, ymdOf(inv.billed_at))
    }
    for (const p of job.payments) {
      if (!p.invoice_id || !p.paid_on) continue
      const billedYmd = billedAtByInvoice.get(p.invoice_id)
      if (!billedYmd) continue
      const paidYmd = ymdOf(p.paid_on)
      if (paidYmd < cutoffYmd) continue
      gaps.push(Math.max(0, daysBetweenYmdUtc(billedYmd, paidYmd)))
    }
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 === 1 ? gaps[mid]! : Math.round((gaps[mid - 1]! + gaps[mid]!) / 2)
  return { medianDays: median, samples: gaps.length }
}

export type ProfileJobRowMoney = {
  /** Billed-open remainder on this job — same basis as openBalance, so listed rows reconcile with the money strip. */
  openBilled: number
  /** Unbilled work value (revenue − payments) for jobs with no billed-open money; 0 for paid jobs. */
  unbilled: number
  /** Days since the OLDEST open bill's date (est. bill date, else billed_at); null when undated. */
  ageDays: number | null
  /** The date the age reads from (YYYY-MM-DD), for the row's date label. */
  oldestOpenBillYmd: string | null
  /** Open billed money with no date anywhere (no est. date, no billed_at) — can't age. */
  noBillDate: boolean
}

/**
 * One job's money for the profile jobs list (v2.1985). Rules are the
 * bill-truth kernel's, so listed rows reconcile with the money strip:
 * billed-invoice remainders (net of linked payments) plus the billed
 * job-shell fallback, each clamped once; every other non-paid job shows its
 * unbilled value instead.
 */
export function profileJobRowMoney(job: ProfileJob, todayYmd: string): ProfileJobRowMoney {
  const status = (job.status ?? 'working') as string
  const out: ProfileJobRowMoney = { openBilled: 0, unbilled: 0, ageDays: null, oldestOpenBillYmd: null, noBillDate: false }
  if (status === 'paid') return out
  const rows = openBillRowsForJob(job, job.invoices.map((i) => ({ ...i, job_id: job.id })), appliedByInvoiceId(job.payments))
  const shell = rows.find((r) => r.kind === 'shell')
  if (shell) {
    out.openBilled = shell.remaining
    out.noBillDate = !shell.settled
    return out
  }
  const invoiceById = new Map(job.invoices.map((i) => [i.id, i]))
  let sawUndated = false
  for (const row of rows) {
    const inv = row.invoiceId ? invoiceById.get(row.invoiceId) : undefined
    const remaining = row.remaining
    out.openBilled += remaining
    if (row.settled || !inv) continue
    const dateSource = inv.estimated_bill_date ?? inv.billed_at
    if (!dateSource) {
      sawUndated = true
      continue
    }
    const ymd = ymdOf(dateSource)
    if (out.oldestOpenBillYmd == null || ymd < out.oldestOpenBillYmd) out.oldestOpenBillYmd = ymd
  }
  if (out.oldestOpenBillYmd != null) out.ageDays = Math.max(0, daysBetweenYmdUtc(out.oldestOpenBillYmd, todayYmd))
  out.noBillDate = out.openBilled > 0.005 && out.oldestOpenBillYmd == null && sawUndated
  if (out.openBilled <= 0.005) out.unbilled = openRemainder(job.revenue, job.payments_made)
  return out
}

/**
 * List order for the profile jobs list: money the customer owes first
 * (billed-open desc, oldest-age tiebreak), then unbilled work value desc,
 * then everything else (paid last, newest first is fine as-is).
 */
export function sortProfileJobsForList<T extends ProfileJob>(jobs: T[], todayYmd: string): T[] {
  const money = new Map(jobs.map((j) => [j.id, profileJobRowMoney(j, todayYmd)]))
  return [...jobs].sort((a, b) => {
    const ma = money.get(a.id)!
    const mb = money.get(b.id)!
    if (ma.openBilled !== mb.openBilled) return mb.openBilled - ma.openBilled
    if (ma.openBilled > 0 && (ma.ageDays ?? -1) !== (mb.ageDays ?? -1)) return (mb.ageDays ?? -1) - (ma.ageDays ?? -1)
    return mb.unbilled - ma.unbilled
  })
}
