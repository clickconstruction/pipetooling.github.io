import type { Database } from '../types/database'
import { billOnOpenJob, openRemainder } from './billing/billTruth'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { StagesBoardSortMode } from './jobsStagesSortMode'
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

/**
 * Gross remainder not covered by ANY invoice line, the primary RTB bundle
 * included (dollars). This is the board-merge basis — a well-synced primary
 * makes it 0, and `readyToBillMergedPrimaryInvoiceId` / section exposure sums
 * read a positive value as "gap the drafts don't cover". NOT the ensure-RPC
 * basis: for how much can still be carved into a new partial invoice, use
 * `jobPartialInvoiceRemainingDollars`.
 */
export function jobBillingUnallocatedDollars(job: JobWithDetails): number {
  return jobBillingUnallocCentsJob(job) / 100
}

/**
 * Cents still carvable into a new partial invoice: like the unallocated sum
 * above, but the never-sent PRIMARY RTB remainder bundle does not count as
 * allocated (the rule the ensure RPC has used since v2.1134 and JobFormModal's
 * `unallocatedBillableDollars` since v2.2446). The bundle is elastic — it
 * resizes to whatever isn't billed — so counting it read "Remaining $0" on
 * every Ready-to-Bill job carrying the auto draft.
 */
function jobPartialInvoiceRemainingCents(job: JobWithDetails): number {
  const g = jobGrossRemainingCentsJob(job)
  let alloc = 0
  for (const i of job.invoices ?? []) {
    if (i.status === 'ready_to_bill' && i.is_primary_rtb_bundle === true) continue
    if (i.status === 'ready_to_bill' || i.status === 'billed') {
      alloc += Math.round(Number(i.amount ?? 0) * 100)
    }
  }
  return Math.max(0, g - alloc)
}

/** Dollars still carvable into a new partial invoice (primary bundle excluded) — Stages partial-invoice display/gate. */
export function jobPartialInvoiceRemainingDollars(job: JobWithDetails): number {
  return jobPartialInvoiceRemainingCents(job) / 100
}

/** Requested partial-invoice cents clamped to the carvable remainder (primary bundle excluded; Stages "Create partial invoice"). */
export function clampPartialInvoiceCentsToUnallocated(job: JobWithDetails, amountDollars: number): number {
  return Math.min(Math.round(amountDollars * 100), jobPartialInvoiceRemainingCents(job))
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
    return openRemainder(r.job.revenue, r.job.payments_made)
  }
  const inv = r.inv
  return openRemainder(inv.amount, sumPaymentsForInvoiceOnJob(r.job, inv.id))
}

/** Short label for Bank Payments / Stages (HCP + line type). */
export function billedStageRowLineLabel(r: StageRow): string {
  const hcp = effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—'
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
  /**
   * v2.1614: the bill was sent through Stripe. Allocating to it is allowed but
   * gated — the AR modal requires the paid-outside-Stripe confirmation and
   * sends p_allow_stripe_hosted to the RPC.
   */
  stripeHosted: boolean
  /** `jobs_ledger.customer_name` ('' when blank) — feeds search + deposit-payer matching. */
  customerName: string
  /** The job's linked GC name ('' when none) — GCs usually pay on GC jobs. */
  gcName: string
}

function bankPaymentTargetMoneyStr(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function bankPaymentTargetSearchLabel(job: JobWithDetails, shortLabel: string, remaining: number): string {
  const hcp = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
  const name = (job.job_name ?? '').trim()
  const addr = (job.job_address ?? '').trim()
  const rem = bankPaymentTargetMoneyStr(remaining)
  /** Lead with dollar amount (plain text for SearchableSelect search); UI can bold via `labelContent`. */
  const dollars = `$${rem}`
  /** Customer + GC join the search text so typing the payer's name always finds the bill (they're often absent from the job name). */
  const payers = dedupedPayerNames(name, bankPaymentTargetCustomerName(job), bankPaymentTargetGcName(job))
  const rest = [hcp, name, ...payers, addr, shortLabel].filter((s) => s.length > 0).join(' · ')
  return rest ? `${dollars} · ${rest}` : dollars
}

/** Payer names worth showing next to a job name: blanks, repeats, and names the job name already contains drop out. */
function dedupedPayerNames(jobName: string, ...candidates: string[]): string[] {
  const out: string[] = []
  for (const p of candidates) {
    if (p.length === 0) continue
    if (jobName.toLowerCase().includes(p.toLowerCase())) continue
    if (out.some((x) => x.toLowerCase() === p.toLowerCase())) continue
    out.push(p)
  }
  return out
}

function bankPaymentTargetCustomerName(job: JobWithDetails): string {
  return (job.customer_name ?? '').trim()
}

function bankPaymentTargetGcName(job: JobWithDetails): string {
  return (job.gcCustomer?.name ?? '').trim()
}

/** Formatted dollar string for AR allocation display (e.g. `$1,234.56`). */
export function formatBankPaymentTargetDollars(remaining: number): string {
  return `$${bankPaymentTargetMoneyStr(remaining)}`
}

/** Text after the leading amount: HCP, job name, payer(s), address, short line (matches `searchLabel` tail). */
export function bankPaymentTargetCuesAfterAmount(t: BankPaymentTarget): string {
  const payers = dedupedPayerNames(t.jobName, t.customerName, t.gcName)
  return [t.hcpNumber, t.jobName, ...payers, t.jobAddress, t.label].filter((s) => s.trim().length > 0).join(' · ')
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

/**
 * Billed rows eligible for Bank Payments (positive remaining). Stripe-hosted
 * lines are INCLUDED since v2.1614 (customer paid by check instead of the
 * Stripe link) but flagged `stripeHosted` — the modal gates them behind an
 * explicit paid-outside-Stripe confirmation.
 */
export function bankPaymentTargetsFromStageRows(rows: StageRow[]): BankPaymentTarget[] {
  const out: BankPaymentTarget[] = []
  for (const r of rows) {
    if (r.kind === 'invoice' || r.kind === 'job_with_merged_billed') {
      const stripeHosted = isStripeHostedBilledInvoice(r.inv)
      const rem = billedStageRowRemainingAmount(r)
      if (rem <= 0.0005) continue
      const job = r.job
      const shortLabel = billedStageRowLineLabel(r)
      const lineKind: BankPaymentLineKind = r.kind === 'job_with_merged_billed' ? 'merged_billed' : 'invoice'
      out.push({
        key: `inv:${r.inv.id}`,
        label: stripeHosted ? `${shortLabel} · Stripe` : shortLabel,
        searchLabel: bankPaymentTargetSearchLabel(job, stripeHosted ? `${shortLabel} · Stripe` : shortLabel, rem),
        remaining: rem,
        invoiceId: r.inv.id,
        jobId: job.id,
        hcpNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
        jobName: (job.job_name ?? '').trim(),
        jobAddress: (job.job_address ?? '').trim(),
        lineKind,
        invoiceSequenceOrder: r.inv.sequence_order,
        stripeHosted,
        customerName: bankPaymentTargetCustomerName(job),
        gcName: bankPaymentTargetGcName(job),
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
        hcpNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
        jobName: (job.job_name ?? '').trim(),
        jobAddress: (job.job_address ?? '').trim(),
        lineKind: 'job_balance',
        invoiceSequenceOrder: null,
        stripeHosted: false,
        customerName: bankPaymentTargetCustomerName(job),
        gcName: bankPaymentTargetGcName(job),
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

/** Sentinel for the Stages GC filter: only jobs WITHOUT a GC (the fill-them-in worklist). */
export const STAGES_GC_FILTER_NO_GC = 'no-gc'

/** Distinct GCs among loaded jobs, name-sorted, for the Stages filter dropdown (v2.1183). */
export function gcFilterOptionsFromJobs(jobs: JobWithDetails[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const j of jobs) {
    const gc = j.gcCustomer
    if (gc?.id && !byId.has(gc.id)) byId.set(gc.id, (gc.name ?? '').trim() || '—')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** '' / null = all jobs; STAGES_GC_FILTER_NO_GC = jobs without a GC; else exact gc customer id. */
export function filterJobsByGcCustomer(jobs: JobWithDetails[], gcFilter: string | null): JobWithDetails[] {
  if (!gcFilter) return jobs
  if (gcFilter === STAGES_GC_FILTER_NO_GC) return jobs.filter((j) => !j.gcCustomer?.id)
  return jobs.filter((j) => j.gcCustomer?.id === gcFilter)
}

/** Sentinel for the Stages development filter: only jobs WITHOUT a development (the fill-them-in worklist). */
export const STAGES_DEVELOPMENT_FILTER_NONE = 'no-development'

/** Distinct developments among loaded jobs, name-sorted, for the Stages filter dropdown. */
export function developmentFilterOptionsFromJobs(jobs: JobWithDetails[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const j of jobs) {
    const d = j.development
    if (d?.id && !byId.has(d.id)) byId.set(d.id, (d.name ?? '').trim() || '—')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** '' / null = all jobs; STAGES_DEVELOPMENT_FILTER_NONE = jobs without a development; else exact development id. */
export function filterJobsByDevelopment(jobs: JobWithDetails[], developmentFilter: string | null): JobWithDetails[] {
  if (!developmentFilter) return jobs
  if (developmentFilter === STAGES_DEVELOPMENT_FILTER_NONE) return jobs.filter((j) => !j.development?.id)
  return jobs.filter((j) => j.development?.id === developmentFilter)
}

/** Sentinel for the Stages Account Man filter: only jobs WITHOUT an Account Man (the assign-them worklist). */
export const STAGES_ACCOUNT_MAN_FILTER_NONE = 'no-account-man'

/** Distinct Account Men among loaded jobs, name-sorted, for the Stages filter dropdown (v2.1477). */
export function accountManFilterOptionsFromJobs(jobs: JobWithDetails[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const j of jobs) {
    const id = j.account_manager_user_id
    if (id && !byId.has(id)) byId.set(id, (j.account_manager?.name ?? '').trim() || '—')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** '' / null = all jobs; STAGES_ACCOUNT_MAN_FILTER_NONE = jobs without an Account Man; else exact user id. */
export function filterJobsByAccountMan(jobs: JobWithDetails[], accountManFilter: string | null): JobWithDetails[] {
  if (!accountManFilter) return jobs
  if (accountManFilter === STAGES_ACCOUNT_MAN_FILTER_NONE) return jobs.filter((j) => !j.account_manager_user_id)
  return jobs.filter((j) => j.account_manager_user_id === accountManFilter)
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
      (j.gcCustomer?.name ?? '').toLowerCase().includes(q) ||
      (j.development?.name ?? '').toLowerCase().includes(q) ||
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

/** In Collections = billed AND flagged; a DB trigger clears the flag when the job transitions to paid (v2.1642). */
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
  sortMode: StagesBoardSortMode = 'number',
): JobsStagesBoardLists {
  // Sort once here so every section below (and the row builders, which preserve
  // input order) shows the same order: by displayed number (C# interleaved with
  // HCP), or by time added when the ⋯ menu's sort says so (v2.1807).
  const filtered = [...filterJobsByStagesSearch(jobs, stagesSearchQuery, extraJobIds)].sort(
    sortMode === 'added' ? sortStagesJobsByAddedDesc : sortStagesJobsByEffectiveNumberDesc,
  )
  const status = (j: JobWithDetails) => (j.status ?? 'working') as string
  const waiting = filtered.filter((j) => status(j) === 'waiting')
  const working = filtered.filter((j) => status(j) === 'working')
  const paid = filtered.filter((j) => status(j) === 'paid')
  const readyToBillJobs = filtered.filter(
    (j) => status(j) === 'ready_to_bill' || (status(j) === 'working' && jobHasReadyToBillInvoice(j)),
  )
  const billedJobs = filtered.filter((j) => status(j) === 'billed')
  // Bill-truth membership (journey Tier-1 #2): an invoice riding a `paid` job is
  // never a Ready to Bill draft nor an open bill — the lean strip never fetches
  // paid jobs, the Dashboard drops them (v2.2846), and this full-row path must
  // not be the one surface that still lists them.
  const openJobs = filtered.filter((j) => billOnOpenJob(j.status))
  const readyToBillInvoices: InvoiceWithJob[] = openJobs.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').map((inv) => ({ ...inv, job: j })),
  )
  const billedInvoices: InvoiceWithJob[] = openJobs.flatMap((j) =>
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

/**
 * Stages board order: effective job number (HCP else Click) descending, then job
 * name. The server query can only `.order('hcp_number')` — PostgREST cannot sort
 * by an expression — so click-only jobs (empty `hcp_number`) all collapsed to the
 * bottom of every section regardless of their C#. This comparator is the
 * authoritative ordering; it interleaves C# jobs with HCP jobs by the number the
 * board actually displays (204, C#203, 200, 100). Jobs with neither number sort
 * last.
 */
/** Most recently added first (jobs_ledger.created_at desc); effective number breaks ties. */
export function sortStagesJobsByAddedDesc(a: JobWithDetails, b: JobWithDetails): number {
  const cmp = (b.created_at ?? '').localeCompare(a.created_at ?? '')
  if (cmp !== 0) return cmp
  return sortStagesJobsByEffectiveNumberDesc(a, b)
}

export function sortStagesJobsByEffectiveNumberDesc(a: JobWithDetails, b: JobWithDetails): number {
  const na = effectiveJobLedgerNumber(a.hcp_number, a.click_number)
  const nb = effectiveJobLedgerNumber(b.hcp_number, b.click_number)
  if (!na !== !nb) return na ? -1 : 1
  const cmp = nb.localeCompare(na, undefined, { numeric: true })
  if (cmp !== 0) return cmp
  return (a.job_name ?? '').localeCompare(b.job_name ?? '', undefined, { sensitivity: 'base' })
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

/** Same list as Jobs → Stages → "No email" for Ready to Bill jobs with blank customer_email (jobs-cache variant, v2.972). */
export function buildStagesReadyToBillNoEmailList(
  jobs: JobWithDetails[],
  stagesSearchQuery: string,
  extraJobIds?: ReadonlySet<string> | null,
): JobWithDetails[] {
  const lists = buildJobsStagesBoardLists(jobs, stagesSearchQuery, extraJobIds)
  return stagesReadyToBillJobsWithoutEmail(lists.readyToBillRows)
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
 * Open-ask remainder: what the job's RTB drafts + sent bills still ask for,
 * net of payments applied to each line (same per-invoice remainder basis as
 * the Billed Awaiting Payment board). Money already asked for is not
 * "capable of being billed" again.
 */
export function jobOpenBillingRemainderDollars(job: Pick<JobWithDetails, 'invoices' | 'payments'>): number {
  let s = 0
  for (const inv of job.invoices ?? []) {
    if (inv.status !== 'ready_to_bill' && inv.status !== 'billed') continue
    let applied = 0
    for (const p of job.payments ?? []) {
      if (p.invoice_id === inv.id) applied += Number(p.amount ?? 0)
    }
    s += Math.max(0, Number(inv.amount ?? 0) - applied)
  }
  return s
}

type CapableToBillJob = Pick<JobWithDetails, 'revenue' | 'payments_made' | 'pct_complete' | 'invoices' | 'payments'>

/**
 * Capable-of-Being-Billed kernel (map quirk #8 — previously computed inline
 * twice, in the Working section header and the breakdown modal): value created
 * by % complete minus what has already come off the job — payments received
 * AND open asks (RTB drafts + billed-unpaid remainders, v2.1927; before that,
 * billing a job didn't move the number). `toBill` may be negative;
 * aggregations clamp/filter it.
 */
export function jobCapableToBillAmounts(j: CapableToBillJob): {
  toBill: number
  valueCreated: number
  openBilling: number
} {
  const totalBill = Number(j.revenue ?? 0)
  const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
  const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
  const openBilling = jobOpenBillingRemainderDollars(j)
  const toBill = valueCreated - (totalBill - remaining) - openBilling
  return { toBill, valueCreated, openBilling }
}

/** Working section header total: sum of positive to-bill amounts. */
export function capableToBillTotalFromWorking(working: CapableToBillJob[]): number {
  return working.reduce((s, j) => s + Math.max(0, jobCapableToBillAmounts(j).toBill), 0)
}

/** Breakdown-modal rows: positive to-bill only, sorted by amount descending. */
export function buildCapableToBillBreakdownRows<T extends CapableToBillJob>(
  working: T[],
): Array<{ job: T; toBill: number; valueCreated: number; openBilling: number }> {
  return working
    .map((j) => {
      const { toBill, valueCreated, openBilling } = jobCapableToBillAmounts(j)
      return { job: j, toBill, valueCreated, openBilling }
    })
    .filter((r) => r.toBill > 0)
    .sort((a, b) => b.toBill - a.toBill)
}

/** Ready-to-Bill jobs (distinct, row order) missing a customer email — Stripe/emailed invoices will need one. */
export function stagesReadyToBillJobsWithoutEmail(readyToBillRows: readonly StageRow[]): JobWithDetails[] {
  const seen = new Set<string>()
  const out: JobWithDetails[] = []
  for (const row of readyToBillRows) {
    const job = row.job
    if (seen.has(job.id)) continue
    seen.add(job.id)
    if (!(job.customer_email ?? '').trim()) out.push(job)
  }
  return out
}
