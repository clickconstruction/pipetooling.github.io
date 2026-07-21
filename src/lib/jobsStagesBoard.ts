import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'
import { jobLedgerHasCustomerForBilling } from './jobLedgerCustomerForBilling'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

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

/** Requested partial-invoice cents clamped to the billing-unallocated remainder (Stages "Create partial invoice"). */
export function clampPartialInvoiceCentsToUnallocated(job: JobWithDetails, amountDollars: number): number {
  return Math.min(Math.round(amountDollars * 100), jobBillingUnallocCentsJob(job))
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

export type BankPaymentLineKind = 'job_balance' | 'merged_billed' | 'invoice'

export type BankPaymentTarget = {
  key: string
  /** Short line for errors and compact UI (HCP · line type). */
  label: string
  /**
   * Full option label for SearchableSelect: concatenates HCP, job name, address, line type, max remaining
   * so substring search matches any token.
   */
  searchLabel: string
  remaining: number
  invoiceId: string | null
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  lineKind: BankPaymentLineKind
  invoiceSequenceOrder: number | null
}

function bankPaymentTargetMoneyStr(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function bankPaymentTargetSearchLabel(job: JobWithDetails, shortLabel: string, remaining: number): string {
  const hcp = (job.hcp_number ?? '').trim() || '—'
  const name = (job.job_name ?? '').trim()
  const addr = (job.job_address ?? '').trim()
  const rem = bankPaymentTargetMoneyStr(remaining)
  /** Lead with dollar amount (plain text for SearchableSelect search); UI can bold via `labelContent`. */
  const dollars = `$${rem}`
  const rest = [hcp, name, addr, shortLabel].filter((s) => s.length > 0).join(' · ')
  return rest ? `${dollars} · ${rest}` : dollars
}

/** Formatted dollar string for AR allocation display (e.g. `$1,234.56`). */
export function formatBankPaymentTargetDollars(remaining: number): string {
  return `$${bankPaymentTargetMoneyStr(remaining)}`
}

/** Text after the leading amount: HCP, job name, address, short line (matches `searchLabel` tail). */
export function bankPaymentTargetCuesAfterAmount(t: BankPaymentTarget): string {
  return [t.hcpNumber, t.jobName, t.jobAddress, t.label].filter((s) => s.trim().length > 0).join(' · ')
}

/** Address and invoice # for the summary line under the picker (amount shown separately). */
export function bankPaymentTargetDetailLead(t: BankPaymentTarget): string {
  const addr = t.jobAddress.trim()
  const inv = t.invoiceSequenceOrder != null ? `Invoice #${t.invoiceSequenceOrder}` : null
  return [addr || null, inv].filter((x): x is string => Boolean(x)).join(' · ')
}

/** Primary title for AR allocation summary (under SearchableSelect). */
export function bankPaymentTargetPrimaryLabel(t: BankPaymentTarget): string {
  const name = t.jobName.trim()
  if (name) return `${t.hcpNumber || '—'} · ${name}`
  return t.label
}

/** Billed rows eligible for Bank Payments (non-Stripe, positive remaining). */
export function bankPaymentTargetsFromStageRows(rows: StageRow[]): BankPaymentTarget[] {
  const out: BankPaymentTarget[] = []
  for (const r of rows) {
    if (r.kind === 'invoice' || r.kind === 'job_with_merged_billed') {
      if (isStripeHostedBilledInvoice(r.inv)) continue
      const rem = billedStageRowRemainingAmount(r)
      if (rem <= 0.0005) continue
      const job = r.job
      const shortLabel = billedStageRowLineLabel(r)
      const lineKind: BankPaymentLineKind = r.kind === 'job_with_merged_billed' ? 'merged_billed' : 'invoice'
      out.push({
        key: `inv:${r.inv.id}`,
        label: shortLabel,
        searchLabel: bankPaymentTargetSearchLabel(job, shortLabel, rem),
        remaining: rem,
        invoiceId: r.inv.id,
        jobId: job.id,
        hcpNumber: (job.hcp_number ?? '').trim() || '—',
        jobName: (job.job_name ?? '').trim(),
        jobAddress: (job.job_address ?? '').trim(),
        lineKind,
        invoiceSequenceOrder: r.inv.sequence_order,
      })
    } else if (r.kind === 'job') {
      const rem = billedStageRowRemainingAmount(r)
      if (rem <= 0.0005) continue
      const job = r.job
      const shortLabel = billedStageRowLineLabel(r)
      out.push({
        key: `job:${r.job.id}`,
        label: shortLabel,
        searchLabel: bankPaymentTargetSearchLabel(job, shortLabel, rem),
        remaining: rem,
        invoiceId: null,
        jobId: job.id,
        hcpNumber: (job.hcp_number ?? '').trim() || '—',
        jobName: (job.job_name ?? '').trim(),
        jobAddress: (job.job_address ?? '').trim(),
        lineKind: 'job_balance',
        invoiceSequenceOrder: null,
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

export function filterJobsByStagesSearch(
  jobs: JobWithDetails[],
  stagesSearchQuery: string,
  extraJobIds?: ReadonlySet<string> | null,
): JobWithDetails[] {
  const q = stagesSearchQuery.trim().toLowerCase()
  if (!q) return jobs
  const extra = extraJobIds ?? null
  return jobs.filter(
    (j) =>
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.click_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q) ||
      (extra?.has(j.id) ?? false),
  )
}

export type JobsStagesBoardLists = {
  filtered: JobWithDetails[]
  waiting: JobWithDetails[]
  working: JobWithDetails[]
  paid: JobWithDetails[]
  readyToBillJobs: JobWithDetails[]
  /** ALL billed jobs, including Collections — Bank Payments/AR consumers rely on this. */
  billedJobs: JobWithDetails[]
  readyToBillInvoices: InvoiceWithJob[]
  billedInvoices: InvoiceWithJob[]
  readyToBillRows: StageRow[]
  /** Rows for ALL billed jobs, including Collections — Bank Payments/AR consumers rely on this. */
  billedRows: StageRow[]
  /** Billed jobs NOT flagged into Collections (the "Billed Awaiting Payment" section). */
  billedActiveJobs: JobWithDetails[]
  /** Billed jobs flagged difficult-to-collect (the "Collections" section). */
  collectionsJobs: JobWithDetails[]
  billedActiveRows: StageRow[]
  collectionsRows: StageRow[]
}

/** In Collections = billed AND flagged; the flag alone is ignored on non-billed jobs (sticky flag semantics). */
export function jobInCollections(j: Pick<JobWithDetails, 'status' | 'collections_at'>): boolean {
  return ((j.status ?? 'working') as string) === 'billed' && j.collections_at != null
}

function jobHasReadyToBillInvoice(j: JobWithDetails): boolean {
  return (j.invoices ?? []).some((i) => i.status === 'ready_to_bill')
}

export function buildJobsStagesBoardLists(
  jobs: JobWithDetails[],
  stagesSearchQuery: string,
  extraJobIds?: ReadonlySet<string> | null,
): JobsStagesBoardLists {
  const filtered = filterJobsByStagesSearch(jobs, stagesSearchQuery, extraJobIds)
  const status = (j: JobWithDetails) => (j.status ?? 'working') as string
  const waiting = filtered.filter((j) => status(j) === 'waiting')
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
  const billedActiveJobs = billedJobs.filter((j) => !jobInCollections(j))
  const collectionsJobs = billedJobs.filter((j) => jobInCollections(j))
  const collectionsJobIds = new Set(collectionsJobs.map((j) => j.id))
  const billedActiveRows = buildBilledStageRows(
    billedActiveJobs,
    billedInvoices.filter((iw) => !collectionsJobIds.has(iw.job.id)),
  )
  const collectionsRows = buildBilledStageRows(
    collectionsJobs,
    billedInvoices.filter((iw) => collectionsJobIds.has(iw.job.id)),
  )
  return {
    filtered,
    waiting,
    working,
    paid,
    readyToBillJobs,
    billedJobs,
    readyToBillInvoices,
    billedInvoices,
    readyToBillRows,
    billedRows,
    billedActiveJobs,
    collectionsJobs,
    billedActiveRows,
    collectionsRows,
  }
}

/** HCP numeric then job name; shared by Stages list modals. */
export function sortStagesJobsByHcpThenName(a: JobWithDetails, b: JobWithDetails): number {
  const ha = effectiveJobLedgerNumber(a.hcp_number, a.click_number)
  const hb = effectiveJobLedgerNumber(b.hcp_number, b.click_number)
  const cmpHcp = ha.localeCompare(hb, undefined, { numeric: true })
  if (cmpHcp !== 0) return cmpHcp
  return (a.job_name ?? '').localeCompare(b.job_name ?? '', undefined, { sensitivity: 'base' })
}

export function jobLedgerJobPicturesLinkDefined(link: string | null | undefined): boolean {
  return String(link ?? '').trim().length > 0
}

/** Jobs on the Stages board filter that lack a linked customer, sorted like the Jobs Stages modal. */
export function stagesJobsWithoutCustomerFromFiltered(filtered: JobWithDetails[]): JobWithDetails[] {
  const list = filtered.filter((j) => !jobLedgerHasCustomerForBilling(j.customer_id))
  return [...list].sort(sortStagesJobsByHcpThenName)
}

/** Working-stage jobs (after Stages search) with no Customer Pictures URL set. */
export function stagesWorkingJobsWithoutPicturesFromWorking(working: JobWithDetails[]): JobWithDetails[] {
  const list = working.filter((j) => !jobLedgerJobPicturesLinkDefined(j.job_pictures_link))
  return [...list].sort(sortStagesJobsByHcpThenName)
}

/** Same list as Stages "No customer" for the given search and optional schedule/clock extra ids. */
export function buildStagesJobsWithoutCustomerList(
  jobs: JobWithDetails[],
  stagesSearchQuery: string,
  extraJobIds?: ReadonlySet<string> | null,
): JobWithDetails[] {
  const { filtered } = buildJobsStagesBoardLists(jobs, stagesSearchQuery, extraJobIds)
  return stagesJobsWithoutCustomerFromFiltered(filtered)
}

/** Same list as Jobs → Stages → "No customer pictures" for working jobs with empty `job_pictures_link`. */
export function buildStagesWorkingJobsWithoutPicturesList(
  jobs: JobWithDetails[],
  stagesSearchQuery: string,
  extraJobIds?: ReadonlySet<string> | null,
): JobWithDetails[] {
  const { working } = buildJobsStagesBoardLists(jobs, stagesSearchQuery, extraJobIds)
  return stagesWorkingJobsWithoutPicturesFromWorking(working)
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

/** Stages section (stagesSectionOpen key / stages-* anchor) a job lands in for a given status. */
export function stagesSectionKeyForJobStatus(
  status: string | null | undefined,
): 'waiting' | 'working' | 'readyToBill' | 'billed' | null {
  switch (status ?? '') {
    case 'waiting':
      return 'waiting'
    case 'working':
      return 'working'
    case 'ready_to_bill':
      return 'readyToBill'
    case 'billed':
      return 'billed'
    default:
      return null
  }
}

/**
 * Capable-of-Being-Billed kernel (map quirk #8 — previously computed inline
 * twice, in the Working section header and the breakdown modal): value created
 * by % complete minus what has already come off the job. `toBill` may be
 * negative; aggregations clamp/filter it.
 */
export function jobCapableToBillAmounts(
  j: Pick<JobWithDetails, 'revenue' | 'payments_made' | 'pct_complete'>,
): { toBill: number; valueCreated: number } {
  const totalBill = Number(j.revenue ?? 0)
  const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
  const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
  const toBill = valueCreated - (totalBill - remaining)
  return { toBill, valueCreated }
}

/** Working section header total: sum of positive to-bill amounts. */
export function capableToBillTotalFromWorking(
  working: Array<Pick<JobWithDetails, 'revenue' | 'payments_made' | 'pct_complete'>>,
): number {
  return working.reduce((s, j) => s + Math.max(0, jobCapableToBillAmounts(j).toBill), 0)
}

/** Breakdown-modal rows: positive to-bill only, sorted by amount descending. */
export function buildCapableToBillBreakdownRows<
  T extends Pick<JobWithDetails, 'revenue' | 'payments_made' | 'pct_complete'>,
>(working: T[]): Array<{ job: T; toBill: number; valueCreated: number }> {
  return working
    .map((j) => {
      const { toBill, valueCreated } = jobCapableToBillAmounts(j)
      return { job: j, toBill, valueCreated }
    })
    .filter((r) => r.toBill > 0)
    .sort((a, b) => b.toBill - a.toBill)
}
