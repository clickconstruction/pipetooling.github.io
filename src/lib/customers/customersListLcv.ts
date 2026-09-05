/**
 * Customers list — per-customer money + activity rollup (Customer Hub train
 * PR 6, extended by the list-redesign train PR 1).
 *
 * The money rules are the bill-truth kernel's (`lib/billing/billTruth.ts`) —
 * no longer a hand-synced copy of customerProfileStats:
 * - lifetime billed: `jobBilledContribution` (Σ billed/paid invoice amounts
 *   per job, else the billed/paid job shell);
 * - open balance: `openBillRowsForJob` (billed-invoice remainders + billed
 *   job-shells, each clamped at 0 once; paid jobs contribute nothing). The
 *   customer-level clamp this file used to apply is gone — a sum of clamped
 *   rows is never negative.
 * Pure — flat arrays in, a customer_id → rollup map out.
 */
import { appliedByInvoiceId, jobBilledContribution, openBillRowsForJob, sumRemaining } from '../billing/billTruth'

export type LcvJobRow = {
  id: string
  customer_id: string | null
  status: string | null
  revenue: number | null
  payments_made?: number | null
  created_at?: string | null
}
export type LcvInvoiceRow = { job_id: string; status: string; amount: number | null; id?: string }
export type LcvPaymentRow = { job_id: string; invoice_id: string | null; amount: number | null; paid_on: string | null }

export type CustomerListRollup = {
  lcv: number
  openBalance: number
  /** Lifetime collected: every payment row on the customer's jobs (money rail, v2.1791). */
  lifetimePaid: number
  /** Revenue on the books not yet billed: Σ max(0, revenue − billed contribution) per job. */
  unbilled: number
  /** Jobs not yet paid (any pipeline status but 'paid'). */
  openJobs: number
  /** Latest of job created / payment received, with which it was. */
  lastActivityIso: string | null
  lastActivityKind: 'job' | 'payment' | null
}

export function customersListRollup(
  jobs: LcvJobRow[],
  invoices: LcvInvoiceRow[],
  payments: LcvPaymentRow[],
): Record<string, CustomerListRollup> {
  const invoicesByJob = new Map<string, LcvInvoiceRow[]>()
  for (const inv of invoices) {
    const list = invoicesByJob.get(inv.job_id)
    if (list) list.push(inv)
    else invoicesByJob.set(inv.job_id, [inv])
  }
  const appliedByInvoice = appliedByInvoiceId(payments)
  const paymentsByJob = new Map<string, LcvPaymentRow[]>()
  for (const p of payments) {
    const list = paymentsByJob.get(p.job_id)
    if (list) list.push(p)
    else paymentsByJob.set(p.job_id, [p])
  }

  const out: Record<string, CustomerListRollup> = {}
  const get = (cid: string): CustomerListRollup =>
    (out[cid] ??= {
      lcv: 0,
      openBalance: 0,
      lifetimePaid: 0,
      unbilled: 0,
      openJobs: 0,
      lastActivityIso: null,
      lastActivityKind: null,
    })

  for (const job of jobs) {
    if (!job.customer_id) continue
    const r = get(job.customer_id)
    const jobInvoices = invoicesByJob.get(job.id) ?? []
    const status = job.status ?? 'working'

    // The job's billed contribution (the kernel's lifetime rule); what
    // revenue exceeds it is work on the books not yet invoiced.
    const billedContribution = jobBilledContribution(job, jobInvoices)
    r.lcv += billedContribution
    r.unbilled += Math.max(0, Number(job.revenue ?? 0) - billedContribution)
    for (const p of paymentsByJob.get(job.id) ?? []) r.lifetimePaid += Number(p.amount ?? 0)

    if (status !== 'paid') {
      r.openJobs += 1
      r.openBalance += sumRemaining(
        openBillRowsForJob(
          { id: job.id, status: job.status, revenue: job.revenue, payments_made: job.payments_made ?? 0 },
          jobInvoices.map((i) => ({ id: i.id ?? '', job_id: i.job_id, status: i.status, amount: i.amount })),
          appliedByInvoice,
        ),
      )
    }

    const stamp = (iso: string | null | undefined, kind: 'job' | 'payment') => {
      if (!iso) return
      if (!r.lastActivityIso || iso > r.lastActivityIso) {
        r.lastActivityIso = iso
        r.lastActivityKind = kind
      }
    }
    stamp(job.created_at, 'job')
    for (const p of paymentsByJob.get(job.id) ?? []) stamp(p.paid_on, 'payment')
  }
  return out
}

/** Back-compat wrapper (v2.1780 shape): customer_id → lifetime billed. */
export function lifetimeValueByCustomer(jobs: LcvJobRow[], invoices: LcvInvoiceRow[]): Record<string, number> {
  const rollup = customersListRollup(jobs, invoices, [])
  return Object.fromEntries(Object.entries(rollup).filter(([, r]) => r.lcv !== 0).map(([k, r]) => [k, r.lcv]))
}
