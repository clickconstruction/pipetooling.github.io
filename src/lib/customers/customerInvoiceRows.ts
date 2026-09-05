/**
 * Customer Hub — Invoices tab row kernel (Customer Hub train, PR 5).
 *
 * Pure mapping from a customer's raw invoice + payment rows to display rows
 * and the lifetime totals line. Statuses follow the billing model
 * (ready_to_bill = draft bill, billed, paid); the aging rule reuses the
 * customerProfileStats convention (estimated_bill_date at 30/90 days).
 * The totals ARE the Profile money strip's numbers, by construction: the
 * bill-truth kernel's `jobBilledContribution` per job (billed/paid invoice
 * amounts, else the billed/paid job shell — journey J34-F1: this footer used
 * to skip the shell arm and read five figures under the strip) and
 * `lifetimeCollected` over every payment on the customer's jobs (record-only
 * HCP backfills included, as the strip counts them).
 */
import { jobBilledContribution, lifetimeCollected } from '../billing/billTruth'

export type CustomerInvoiceInput = {
  id: string
  job_id: string
  amount: number | null
  status: string
  sequence_order: number
  billed_at: string | null
  estimated_bill_date: string | null
  created_at: string | null
  sent_to_customer_at: string | null
  external_send_channel: string | null
  stripe_invoice_id: string | null
  hosted_invoice_url: string | null
}

export type CustomerInvoicePaymentInput = {
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
}

export type CustomerInvoiceJob = {
  id: string
  label: string
  /** For the footer's lifetime (shell arm) — the kernel's lifetime rule needs the job's status + revenue. */
  status?: string | null
  revenue?: number | null
}

export type CustomerInvoiceRow = {
  key: string
  jobId: string
  jobLabel: string
  /** "#n" partial-sequence marker when a job carries more than one invoice. */
  partLabel: string | null
  channel: 'Stripe' | 'HCP' | 'Physical' | '—'
  status: 'draft' | 'billed' | 'partial' | 'paid'
  /** Days since billed (billed rows only, needs a billable date). */
  agingDays: number | null
  amount: number
  applied: number
  billedAtIso: string | null
  lastPaidOnIso: string | null
  hostedInvoiceUrl: string | null
  /** Sort stamp: billed_at, else created_at, else empty (sorts last). */
  sortIso: string
}

export type CustomerInvoiceTotals = { count: number; billedTotal: number; collectedTotal: number }

function daysBetweenYmdUtc(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime()
  const b = new Date(`${toYmd}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function invoiceChannelLabel(inv: {
  external_send_channel: string | null
  stripe_invoice_id: string | null
}): CustomerInvoiceRow['channel'] {
  const ch = inv.external_send_channel
  if (ch === 'stripe' || ch === 'stripe_manual') return 'Stripe'
  if (ch === 'housecallpro') return 'HCP'
  if (ch === 'physical') return 'Physical'
  if (inv.stripe_invoice_id) return 'Stripe'
  return '—'
}

export function buildCustomerInvoiceRows(
  invoices: CustomerInvoiceInput[],
  payments: CustomerInvoicePaymentInput[],
  jobs: CustomerInvoiceJob[],
  todayYmd: string,
): { rows: CustomerInvoiceRow[]; totals: CustomerInvoiceTotals } {
  const jobLabelById = new Map(jobs.map((j) => [j.id, j.label]))
  const appliedByInvoice = new Map<string, number>()
  const lastPaidByInvoice = new Map<string, string>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    appliedByInvoice.set(p.invoice_id, (appliedByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
    if (p.paid_on) {
      const prev = lastPaidByInvoice.get(p.invoice_id)
      if (!prev || p.paid_on > prev) lastPaidByInvoice.set(p.invoice_id, p.paid_on)
    }
  }

  const invoiceCountByJob = new Map<string, number>()
  for (const inv of invoices) invoiceCountByJob.set(inv.job_id, (invoiceCountByJob.get(inv.job_id) ?? 0) + 1)

  const invoicesByJob = new Map<string, CustomerInvoiceInput[]>()
  for (const inv of invoices) {
    const list = invoicesByJob.get(inv.job_id)
    if (list) list.push(inv)
    else invoicesByJob.set(inv.job_id, [inv])
  }
  let billedTotal = 0
  for (const j of jobs) billedTotal += jobBilledContribution({ status: j.status ?? null, revenue: j.revenue ?? null }, invoicesByJob.get(j.id) ?? [])
  // Invoices on jobs the caller did not list (should not happen — the fetch is by job) still count.
  for (const [jobId, list] of invoicesByJob) {
    if (!jobLabelById.has(jobId)) billedTotal += jobBilledContribution({ status: null, revenue: null }, list)
  }
  const collectedTotal = lifetimeCollected(payments)
  const rows: CustomerInvoiceRow[] = invoices.map((inv) => {
    const amount = Number(inv.amount ?? 0)
    const applied = appliedByInvoice.get(inv.id) ?? 0
    let status: CustomerInvoiceRow['status']
    if (inv.status === 'paid') status = 'paid'
    else if (inv.status === 'billed') status = applied > 0.005 ? 'partial' : 'billed'
    else status = 'draft'
    let agingDays: number | null = null
    if ((status === 'billed' || status === 'partial') && inv.estimated_bill_date) {
      agingDays = Math.max(0, daysBetweenYmdUtc(inv.estimated_bill_date.slice(0, 10), todayYmd))
    }
    return {
      key: inv.id,
      jobId: inv.job_id,
      jobLabel: jobLabelById.get(inv.job_id) ?? 'Job',
      partLabel: (invoiceCountByJob.get(inv.job_id) ?? 0) > 1 ? `#${inv.sequence_order}` : null,
      channel: invoiceChannelLabel(inv),
      status,
      agingDays,
      amount,
      applied,
      billedAtIso: inv.billed_at,
      lastPaidOnIso: lastPaidByInvoice.get(inv.id) ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      sortIso: inv.billed_at ?? inv.created_at ?? '',
    }
  })

  rows.sort((a, b) => (a.sortIso < b.sortIso ? 1 : a.sortIso > b.sortIso ? -1 : a.key < b.key ? 1 : -1))
  return { rows, totals: { count: rows.length, billedTotal, collectedTotal } }
}
