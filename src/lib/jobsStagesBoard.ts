import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type InvoiceWithJob = JobsLedgerInvoice & { job: JobWithDetails }

export type StageRow =
  | { kind: 'job'; job: JobWithDetails }
  | { kind: 'job_with_primary_rtb'; job: JobWithDetails; inv: JobsLedgerInvoice }
  | { kind: 'invoice'; inv: JobsLedgerInvoice; job: JobWithDetails }

export function buildReadyToBillStageRows(readyToBillJobs: JobWithDetails[], readyToBillInvoices: InvoiceWithJob[]): StageRow[] {
  const bundledIds = new Set<string>()
  const rows: StageRow[] = []
  for (const job of readyToBillJobs) {
    const primary = (job.invoices ?? []).find((i) => i.status === 'ready_to_bill' && i.is_primary_rtb_bundle === true)
    if (primary) {
      rows.push({ kind: 'job_with_primary_rtb', job, inv: primary })
      bundledIds.add(primary.id)
    } else {
      rows.push({ kind: 'job', job })
    }
  }
  for (const iw of readyToBillInvoices) {
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

export function buildJobsStagesBoardLists(jobs: JobWithDetails[], stagesSearchQuery: string): JobsStagesBoardLists {
  const filtered = filterJobsByStagesSearch(jobs, stagesSearchQuery)
  const status = (j: JobWithDetails) => (j.status ?? 'working') as string
  const working = filtered.filter((j) => status(j) === 'working')
  const paid = filtered.filter((j) => status(j) === 'paid')
  const readyToBillJobs = filtered.filter((j) => status(j) === 'ready_to_bill')
  const billedJobs = filtered.filter((j) => status(j) === 'billed')
  const readyToBillInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').map((inv) => ({ ...inv, job: j })),
  )
  const billedInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j })),
  )
  const readyToBillRows = buildReadyToBillStageRows(readyToBillJobs, readyToBillInvoices)
  const billedRows: StageRow[] = [
    ...billedJobs.map((j) => ({ kind: 'job' as const, job: j })),
    ...billedInvoices.map(({ job, ...inv }) => ({ kind: 'invoice' as const, inv, job })),
  ]
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
  }
  return null
}

/** True if the invoice exists on the board when search is cleared (job may be hidden by current search). */
export function stagesInvoiceVisibleWithEmptySearch(invoiceId: string, jobs: JobWithDetails[]): boolean {
  const { readyToBillRows, billedRows } = buildJobsStagesBoardLists(jobs, '')
  return locateStagesInvoiceSection(invoiceId, readyToBillRows, billedRows) != null
}
