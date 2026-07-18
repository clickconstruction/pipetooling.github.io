/**
 * Pure kernels for the Dashboard Billing Pipeline (extraction-series Stage A;
 * moved verbatim from `Dashboard.tsx` module scope — no behavior change).
 * Invoice/job row mapping, payment grouping, money math, and the Billed
 * Waiting for Payment bucketing, plus the shared row types and the
 * `jobs_ledger_invoices` select used by the loaders.
 */
import type { Database } from '../types/database'
import type { InvoiceWithJobLike } from '../components/jobs/BilledPaymentConfirmationModal'
import { type JobBillingContext } from './jobBillingContext'
import { type ReadyToBillDashboardUnit as ReadyToBillDashboardUnitBase } from './buildReadyToBillDashboardUnits'

type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']
export type JobsLedgerPaymentRow = Database['public']['Tables']['jobs_ledger_payments']['Row']

export type InvoiceForDashboard = JobsLedgerInvoiceRow & {
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  master_user_id: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  last_work_date: string | null
  /** Prefer job `created_at` for dashboard “Open … ago” labels */
  open_since_at: string | null
  invoice_payments: JobsLedgerPaymentRow[]
}

export type DashboardInvoiceJoinRow = JobsLedgerInvoiceRow & {
  jobs_ledger: {
    hcp_number: string
    job_name: string
    job_address: string
    google_drive_link: string | null
    job_plans_link: string | null
    created_at: string | null
    master_user_id: string
    customer_id: string | null
    customer_name: string | null
    customer_email: string | null
    customer_phone: string | null
    last_work_date: string | null
  }
}

export const DASHBOARD_INVOICES_JOBS_LEDGER_SELECT =
  'id, job_id, amount, status, created_at, is_primary_rtb_bundle, billed_at, estimated_bill_date, external_send_channel, external_send_note, hosted_invoice_url, sent_to_customer_at, sequence_order, stripe_invoice_id, stripe_invoice_memo, stripe_invoice_footer, stripe_invoice_status, agreed_write_down_at, agreed_write_down_by, agreed_write_down_note, agreed_write_down_previous_amount, agreed_write_down_stripe_credit_note_id, jobs_ledger!inner(hcp_number, job_name, job_address, google_drive_link, job_plans_link, created_at, master_user_id, customer_id, customer_name, customer_email, customer_phone, last_work_date)'

export function buildPaymentsByInvoiceIdMap(payments: JobsLedgerPaymentRow[]): Map<string, JobsLedgerPaymentRow[]> {
  const m = new Map<string, JobsLedgerPaymentRow[]>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    const list = m.get(p.invoice_id) ?? []
    list.push(p)
    m.set(p.invoice_id, list)
  }
  return m
}

export function mapJoinedInvoiceToDashboard(
  r: DashboardInvoiceJoinRow,
  paymentsByInvoiceId: Map<string, JobsLedgerPaymentRow[]>,
): InvoiceForDashboard {
  const jl = r.jobs_ledger
  return {
    id: r.id,
    job_id: r.job_id,
    amount: r.amount,
    status: r.status,
    billed_at: r.billed_at,
    created_at: r.created_at,
    estimated_bill_date: r.estimated_bill_date,
    external_send_channel: r.external_send_channel,
    external_send_note: r.external_send_note,
    hosted_invoice_url: r.hosted_invoice_url,
    sent_to_customer_at: r.sent_to_customer_at,
    sequence_order: r.sequence_order,
    stripe_invoice_id: r.stripe_invoice_id,
    stripe_invoice_memo: r.stripe_invoice_memo,
    stripe_invoice_footer: r.stripe_invoice_footer,
    stripe_invoice_status: r.stripe_invoice_status,
    agreed_write_down_at: r.agreed_write_down_at,
    agreed_write_down_by: r.agreed_write_down_by,
    agreed_write_down_note: r.agreed_write_down_note,
    agreed_write_down_previous_amount: r.agreed_write_down_previous_amount,
    agreed_write_down_stripe_credit_note_id: r.agreed_write_down_stripe_credit_note_id,
    is_primary_rtb_bundle: r.is_primary_rtb_bundle,
    hcp_number: jl?.hcp_number ?? '',
    job_name: jl?.job_name ?? '',
    job_address: jl?.job_address ?? '',
    google_drive_link: jl?.google_drive_link ?? null,
    job_plans_link: jl?.job_plans_link ?? null,
    master_user_id: jl?.master_user_id ?? '',
    customer_id: jl?.customer_id ?? null,
    customer_name: jl?.customer_name ?? null,
    customer_email: jl?.customer_email ?? null,
    customer_phone: jl?.customer_phone ?? null,
    last_work_date: jl?.last_work_date ?? null,
    open_since_at: jl?.created_at ?? r.created_at,
    invoice_payments: paymentsByInvoiceId.get(r.id) ?? [],
  }
}

export function dashboardBilledInvoiceAmounts(inv: InvoiceForDashboard): { applied: number; open: number } {
  const applied = inv.invoice_payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return { applied, open: Math.max(0, Number(inv.amount ?? 0) - applied) }
}

export function dashboardInvoiceToPaymentModal(inv: InvoiceForDashboard): InvoiceWithJobLike {
  const {
    hcp_number,
    job_name,
    job_address,
    google_drive_link,
    job_plans_link,
    master_user_id,
    customer_id,
    customer_name,
    customer_email,
    open_since_at: _openSince,
    invoice_payments: _invPay,
    ...invoiceRow
  } = inv
  return {
    ...invoiceRow,
    job: {
      id: inv.job_id,
      hcp_number,
      job_name,
      revenue: null,
      payments_made: null,
    },
  }
}

export function jobBillingFromDashboardInvoice(inv: InvoiceForDashboard): JobBillingContext {
  return {
    id: inv.job_id,
    master_user_id: inv.master_user_id,
    hcp_number: inv.hcp_number,
    job_name: inv.job_name,
    customer_id: inv.customer_id,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    job_address: inv.job_address,
    customer_phone: inv.customer_phone,
    last_work_date: inv.last_work_date,
  }
}

export type JobForDashboard = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  revenue: number | null
  payments_made: number | null
  google_drive_link: string | null
  job_plans_link: string | null
  created_at: string | null
  customer_id: string | null
}

export function dashboardJobHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

/** `readyToBillInvoices` is already limited to status ready_to_bill. */
export function countDashboardRtbDraftsForJob(jobId: string, readyToBillInvoices: InvoiceForDashboard[]): number {
  let n = 0
  for (const inv of readyToBillInvoices) {
    if (inv.job_id === jobId) n += 1
  }
  return n
}

export type ReadyToBillDashboardUnit = ReadyToBillDashboardUnitBase<JobForDashboard, InvoiceForDashboard>

export type BilledWaitingDashboardUnit =
  | { kind: 'job'; job: JobForDashboard }
  | { kind: 'job_bundle'; job: JobForDashboard; inv: InvoiceForDashboard }
  | { kind: 'invoice'; inv: InvoiceForDashboard }

/**
 * Dedupes billed job + invoice rows: one merged row when exactly one billed
 * invoice on the job. Every job always yields a row — 0 invoices → plain job
 * row, 1 invoice → merged `job_bundle`, 2+ invoices → plain job row (its
 * "Remaining" card, computed job-side as revenue − payments_made) followed by
 * each invoice standalone.
 */
export function buildBilledWaitingDashboardUnits(jobs: JobForDashboard[], invoices: InvoiceForDashboard[]): BilledWaitingDashboardUnit[] {
  const byJob = new Map<string, InvoiceForDashboard[]>()
  for (const inv of invoices) {
    const list = byJob.get(inv.job_id) ?? []
    list.push(inv)
    byJob.set(inv.job_id, list)
  }
  const bundledIds = new Set<string>()
  const out: BilledWaitingDashboardUnit[] = []
  for (const job of jobs) {
    const billedOnJob = byJob.get(job.id) ?? []
    if (billedOnJob.length === 1) {
      const inv = billedOnJob[0]!
      bundledIds.add(inv.id)
      out.push({ kind: 'job_bundle', job, inv })
    } else {
      out.push({ kind: 'job', job })
    }
  }
  for (const inv of invoices) {
    if (!bundledIds.has(inv.id)) out.push({ kind: 'invoice', inv })
  }
  return out
}
