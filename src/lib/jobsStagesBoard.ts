import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type InvoiceWithJob = JobsLedgerInvoice & { job: JobWithDetails }

export type StageRow =
  | { kind: 'job'; job: JobWithDetails }
  | { kind: 'job_with_merged_billed'; job: JobWithDetails; inv: JobsLedgerInvoice }
  | { kind: 'job_with_primary_rtb'; job: JobWithDetails; inv: JobsLedgerInvoice }
  | { kind: 'invoice'; inv: JobsLedgerInvoice; job: JobWithDetails }

/** Gross billable remainder in cents (revenue − payments), same basis as ensure RPC inputs. */
function jobGrossRemainingCentsJob(job: Pick<JobWithDetails, 'revenue' | 'payments_made'>): number {
  const remaining = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
  return Math.round(remaining * 100)
}

/** Billing-unallocated cents: gross − sum(ready_to_bill + billed invoice amounts) on the job. */
function jobBillingUnallocCentsJob(job: JobWithDetails): number {
  const g = jobGrossRemainingCentsJob(job)
  let alloc = 0
  for (const i of job.invoices ?? []) {
    if (i.status === 'ready_to_bill' || i.status === 'billed') {
      alloc += Math.round(Number(i.amount ?? 0) * 100)
    }
  }
  return Math.max(0, g - alloc)
}

/** Gross remainder not yet allocated to RTB/billed lines (dollars); same basis as ensure_single_ready_to_bill_invoice_for_job. */
export function jobBillingUnallocatedDollars(job: JobWithDetails): number {
  return jobBillingUnallocCentsJob(job) / 100
}

function invoiceAmountCents(inv: Pick<JobsLedgerInvoice, 'amount'>): number {
  return Math.round(Number(inv.amount ?? 0) * 100)
}

/**
 * Invoice id merged into `job_with_primary_rtb` for this job, or null when the board uses a bare `{ kind: 'job' }`
 * row plus separate invoice rows (split case: sole RTB + unallocated gap, or multiple RTB without legacy single-line bundle).
 */
export function readyToBillMergedPrimaryInvoiceId(job: JobWithDetails): string | null {
  const rtbList = (job.invoices ?? [])
    .filter((i) => i.status === 'ready_to_bill')
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
  const u = jobBillingUnallocatedDollars(job)
  const primary = rtbList.find((i) => i.is_primary_rtb_bundle === true)
  if (primary) {
    if (rtbList.length === 1 && u > 0) return null
    return primary.id
  }
  const remCents = jobGrossRemainingCentsJob(job)
  if (rtbList.length === 1 && invoiceAmountCents(rtbList[0]!) === remCents) {
    return rtbList[0]!.id
  }
  return null
}

/** Invoice id shown on the merged job shell row on Stages (RTB primary bundle or sole billed line); null if none. */
export function stagesMergedBillingInvoiceId(job: JobWithDetails): string | null {
  const status = (job.status ?? 'working') as string
  if (status === 'billed') {
    const billed = (job.invoices ?? []).filter((i) => i.status === 'billed')
    return billed.length === 1 ? billed[0]!.id : null
  }
  if (status === 'ready_to_bill') {
    return readyToBillMergedPrimaryInvoiceId(job)
  }
  return null
}

/** Sum of billable exposure for Ready to Bill: job row = unallocated; merged primary = line amount; each invoice row = line amount. */
export function readyToBillRowsExposureTotal(rows: StageRow[]): number {
  let sum = 0
  for (const r of rows) {
    if (r.kind === 'job') {
      sum += jobBillingUnallocatedDollars(r.job)
    } else if (r.kind === 'job_with_primary_rtb') {
      sum += Number(r.inv.amount ?? 0)
    } else if (r.kind === 'invoice') {
      sum += Number(r.inv.amount ?? 0)
    }
  }
  return sum
}

/**
 * Ready to Bill rows: mirrors Dashboard `buildReadyToBillDashboardUnits` bundling for non-working jobs.
 * Jobs still in `working` omit the bare remainder `{ kind: 'job' }` row so break-off drafts appear as invoice
 * rows only; remainder stays visible on the Working board.
 */
export function buildReadyToBillStageRows(readyToBillJobs: JobWithDetails[]): StageRow[] {
  const rows: StageRow[] = []
  for (const job of readyToBillJobs) {
    const isWorking = ((job.status ?? 'working') as string) === 'working'
    const rtbList = (job.invoices ?? [])
      .filter((i) => i.status === 'ready_to_bill')
      .slice()
      .sort((a, b) => a.sequence_order - b.sequence_order)
    const mergedId = readyToBillMergedPrimaryInvoiceId(job)
    const bundledIds = mergedId != null ? new Set<string>([mergedId]) : new Set<string>()

    if (mergedId != null) {
      const inv = rtbList.find((i) => i.id === mergedId)
      if (inv != null) rows.push({ kind: 'job_with_primary_rtb', job, inv })
      else if (!isWorking) rows.push({ kind: 'job', job })
    } else if (!isWorking) {
      rows.push({ kind: 'job', job })
    }

    for (const inv of rtbList) {
      if (!bundledIds.has(inv.id)) {
        rows.push({ kind: 'invoice', inv, job })
      }
    }
  }
  return rows
}

/** One row per display unit: sole billed invoice merges with job; 2+ invoices → invoice rows only; no invoices → job row. */
function sumPaymentsForInvoiceOnJob(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

/** Remaining dollars for a Billed Awaiting Payment stage row (job shell, merged billed, or invoice). */
export function billedStageRowRemainingAmount(r: StageRow): number {
  if (r.kind === 'job') {
    return Math.max(0, Number(r.job.revenue ?? 0) - Number(r.job.payments_made ?? 0))
  }
  const inv = r.inv
  const applied = sumPaymentsForInvoiceOnJob(r.job, inv.id)
  return Math.max(0, Number(inv.amount ?? 0) - applied)
}

/** Short label for Bank Payments / Stages (HCP + line type). */
export function billedStageRowLineLabel(r: StageRow): string {
  const hcp = r.job.hcp_number || '—'
  if (r.kind === 'job') return `${hcp} · Job balance`
  if (r.kind === 'job_with_merged_billed') return `${hcp} · Billed line`
  return `${hcp} · Invoice #${r.inv.sequence_order}`
}

export function isStripeHostedBilledInvoice(inv: JobsLedgerInvoice): boolean {
  return String(inv.stripe_invoice_id ?? '').trim() !== ''
}

export type BankPaymentTarget = {
  key: string
  label: string
  remaining: number
  invoiceId: string | null
  jobId: string
}

/** Billed rows eligible for Bank Payments (non-Stripe, positive remaining). */
export function bankPaymentTargetsFromStageRows(rows: StageRow[]): BankPaymentTarget[] {
  const out: BankPaymentTarget[] = []
  for (const r of rows) {
    if (r.kind === 'invoice' || r.kind === 'job_with_merged_billed') {
      if (isStripeHostedBilledInvoice(r.inv)) continue
      const rem = billedStageRowRemainingAmount(r)
      if (rem <= 0.0005) continue
      out.push({
        key: `inv:${r.inv.id}`,
        label: billedStageRowLineLabel(r),
        remaining: rem,
        invoiceId: r.inv.id,
        jobId: r.job.id,
      })
    } else if (r.kind === 'job') {
      const rem = billedStageRowRemainingAmount(r)
      if (rem <= 0.0005) continue
      out.push({
        key: `job:${r.job.id}`,
        label: billedStageRowLineLabel(r),
        remaining: rem,
        invoiceId: null,
        jobId: r.job.id,
      })
    }
  }
  return out
}

export function buildBilledStageRows(billedJobs: JobWithDetails[], billedInvoices: InvoiceWithJob[]): StageRow[] {
  const bundledIds = new Set<string>()
  const rows: StageRow[] = []
  for (const job of billedJobs) {
    const billedList = (job.invoices ?? []).filter((i) => i.status === 'billed')
    if (billedList.length === 1) {
      const inv = billedList[0]!
      rows.push({ kind: 'job_with_merged_billed', job, inv })
      bundledIds.add(inv.id)
    } else if (billedList.length === 0) {
      rows.push({ kind: 'job', job })
    }
  }
  for (const iw of billedInvoices) {
    if (bundledIds.has(iw.id)) continue
    const { job, ...inv } = iw
    rows.push({ kind: 'invoice', inv: inv as JobsLedgerInvoice, job })
  }
  return rows
}

function filterJobsByStagesSearch(jobs: JobWithDetails[], stagesSearchQuery: string): JobWithDetails[] {
  const q = stagesSearchQuery.trim().toLowerCase()
  if (!q) return jobs
  return jobs.filter(
    (j) =>
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q),
  )
}

export type JobsStagesBoardLists = {
  filtered: JobWithDetails[]
  working: JobWithDetails[]
  paid: JobWithDetails[]
  readyToBillJobs: JobWithDetails[]
  billedJobs: JobWithDetails[]
  readyToBillInvoices: InvoiceWithJob[]
  billedInvoices: InvoiceWithJob[]
  readyToBillRows: StageRow[]
  billedRows: StageRow[]
}

function jobHasReadyToBillInvoice(j: JobWithDetails): boolean {
  return (j.invoices ?? []).some((i) => i.status === 'ready_to_bill')
}

export function buildJobsStagesBoardLists(jobs: JobWithDetails[], stagesSearchQuery: string): JobsStagesBoardLists {
  const filtered = filterJobsByStagesSearch(jobs, stagesSearchQuery)
  const status = (j: JobWithDetails) => (j.status ?? 'working') as string
  const working = filtered.filter((j) => status(j) === 'working')
  const paid = filtered.filter((j) => status(j) === 'paid')
  const readyToBillJobs = filtered.filter(
    (j) => status(j) === 'ready_to_bill' || (status(j) === 'working' && jobHasReadyToBillInvoice(j)),
  )
  const billedJobs = filtered.filter((j) => status(j) === 'billed')
  const readyToBillInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').map((inv) => ({ ...inv, job: j })),
  )
  const billedInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j })),
  )
  const readyToBillRows = buildReadyToBillStageRows(readyToBillJobs)
  const billedRows = buildBilledStageRows(billedJobs, billedInvoices)
  return {
    filtered,
    working,
    paid,
    readyToBillJobs,
    billedJobs,
    readyToBillInvoices,
    billedInvoices,
    readyToBillRows,
    billedRows,
  }
}

/** Which Stages accordion contains this invoice row, if any. */
export function locateStagesInvoiceSection(
  invoiceId: string,
  readyToBillRows: StageRow[],
  billedRows: StageRow[],
): 'readyToBill' | 'billed' | null {
  for (const r of readyToBillRows) {
    if (r.kind === 'invoice' && r.inv.id === invoiceId) return 'readyToBill'
    if (r.kind === 'job_with_primary_rtb' && r.inv.id === invoiceId) return 'readyToBill'
  }
  for (const r of billedRows) {
    if (r.kind === 'invoice' && r.inv.id === invoiceId) return 'billed'
    if (r.kind === 'job_with_merged_billed' && r.inv.id === invoiceId) return 'billed'
  }
  return null
}

/** True if the invoice exists on the board when search is cleared (job may be hidden by current search). */
export function stagesInvoiceVisibleWithEmptySearch(invoiceId: string, jobs: JobWithDetails[]): boolean {
  const { readyToBillRows, billedRows } = buildJobsStagesBoardLists(jobs, '')
  return locateStagesInvoiceSection(invoiceId, readyToBillRows, billedRows) != null
}
