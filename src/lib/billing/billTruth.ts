/**
 * Bill truth — the ONE kernel behind every "Ready to Bill", "Billed",
 * "Owed" and "Lifetime billed" figure the app shows (journey-map Tier-1 #2(c),
 * clusters C1/C4; J3-2/N1, J4-1/2/N1, J34-F1/N6/adj1).
 *
 * Before this file the app carried at least seven hand-rolled sums over
 * `jobs_ledger_invoices` / `jobs_ledger_payments` — the Pipeline strip, the
 * Dashboard AR card, the Dashboard Billed pin, Quickfill's "who owes what",
 * the Customer Hub money strip, its Invoices footer and the Customers list —
 * and they disagreed by construction: the AR card summed a $488 bill whose
 * job no longer existed, Quickfill dropped a fully-paid-but-unmarked bill the
 * board still counted, the Hub footer skipped the job-shell arm the Profile
 * used, and negative balances were clamped three different ways (never / per
 * customer / per row). Every surface now reads the buckets below; the rules
 * are stated once, here, and the tests pin them with the journey's specimens.
 *
 * ## Bucket rules (one each)
 *
 * - **Ready to Bill** — `ready_to_bill` invoice rows whose job is present and
 *   NOT `paid`. A draft on a paid job is a stale never-sent bill (J3-1,
 *   v2.2846), never work to bill. Total = Σ draft amounts. (The Pipeline
 *   board and the Dashboard bundle these drafts into rows with mirrored
 *   algorithms — `buildReadyToBillStageRows` / `buildReadyToBillDashboardUnits`
 *   — and the board's "exposure" figure adds the unallocated gap for jobs whose
 *   drafts do not cover the remainder; membership is this rule.)
 * - **Billed** (awaiting payment) — `billed` invoice rows on jobs of ANY
 *   non-paid status (a billed, unpaid invoice is owed whatever stage the job
 *   is in — the 8 progress bills on working jobs count; decision 6,
 *   2026-09-05), plus ONE job-shell row for each `billed` job that has zero
 *   billed invoice rows (legacy / HCP-era jobs: `revenue − payments_made`).
 *   Rows on jobs flagged into Collections go to `collections` instead;
 *   `owed` = both. Membership is by STATUS, not by remainder: a billed row
 *   that is fully paid but never marked Paid stays a member with
 *   `remaining 0` and `settled: true` (it needs a Mark Paid, not a chase),
 *   so the count is the same on every surface and no surface ages it.
 * - **Owed** — per row, `max(0, billed − applied)`: invoice rows net their
 *   invoice-linked payments, shell rows net `payments_made`. This is the ONLY
 *   place a bill balance is clamped at zero; every surface sums these
 *   remainders and never clamps again. Over-payments therefore never net
 *   against another job's balance (the Hub's old behaviour) and a customer's
 *   total is the sum of its rows (the list's old customer-level clamp is gone).
 * - **Paid in full** — jobs whose status is `paid`; the Pipeline shows them
 *   as a bare head-count.
 * - **Excluded, counted** — a `billed` / `ready_to_bill` invoice whose job is
 *   `paid` (`onPaidJobs`) or whose job is not among the rows supplied
 *   (`orphans` — deleted job, or a job the caller's fetch did not include) is
 *   NEVER Ready to Bill, Billed or Owed. It is reported separately so a
 *   surface can say "1 bill on a paid or missing job excluded — $488" instead
 *   of listing an "Unknown job" nobody can act on (J4-2).
 * - **Lifetime billed** (`jobBilledContribution`) — Σ `billed`/`paid` invoice
 *   amounts on the job; a `billed`/`paid` job with none falls back to its
 *   shell `revenue`. Used by the Hub strip, the Hub Invoices footer and the
 *   Customers list alike (J34-F1: the footer used to skip the shell arm).
 * - **Lifetime collected** (`lifetimeCollected`) — every payment row on the
 *   customer's jobs, invoice-linked or not (record-only HCP backfills count).
 *
 * ## Server twins
 * The predicates are the ones the edge functions already use, imported
 * verbatim: `isPaidJobStatus` (`_shared/paidJobBillGuard.ts`, v2.2846) and
 * `jobCarriesOpenBills` / `jobPrintsShellRemainder`
 * (`_shared/portalBillMembership.ts`, v2.2839, itself aligned with the GC
 * statement RPC). The single client-side difference is deliberate and tested:
 * the board coalesces a NULL / empty job status to `working`, so
 * `billOnOpenJob(null)` is true here while the SQL mirror excludes NULL.
 *
 * Pure — no imports beyond the two `_shared` twins; tests in `billTruth.test.ts`.
 */
import { isPaidJobStatus } from '../../../supabase/functions/_shared/paidJobBillGuard'
import {
  jobCarriesOpenBills,
  jobPrintsShellRemainder,
  PORTAL_OPEN_INVOICE_STATUS,
} from '../../../supabase/functions/_shared/portalBillMembership'

/** Below this a remainder reads as settled (the Dashboard's long-standing EPSILON). */
export const BILL_TRUTH_EPSILON = 0.005

export const RTB_INVOICE_STATUS = 'ready_to_bill'
/** Same string the portal / GC payload list — one open-bill status. */
export const BILLED_INVOICE_STATUS: string = PORTAL_OPEN_INVOICE_STATUS

export type BillTruthJob = {
  id: string
  status: string | null
  revenue: number | null
  payments_made: number | null
  /** Difficult-to-collect flag; in Collections = status 'billed' AND set. */
  collections_at?: string | null
}

export type BillTruthInvoice = {
  id: string
  job_id: string
  status: string | null
  amount: number | null
}

export type BillTruthPayment = {
  invoice_id: string | null
  amount: number | null
}

export type BillTruthOpenRow = {
  kind: 'invoice' | 'shell'
  /** null on a job-shell row. */
  invoiceId: string | null
  jobId: string
  /** Face value: the invoice amount, or the job's revenue on a shell row. */
  billed: number
  /** Invoice-linked payments (invoice row) or `payments_made` (shell row). */
  applied: number
  /** max(0, billed − applied) — clamped here and nowhere else. */
  remaining: number
  /** Fully paid but still `billed`: a Mark Paid to-do, not a receivable; never aged. */
  settled: boolean
  /** Row belongs to a job flagged into Collections. */
  inCollections: boolean
}

export type BillTruthBucket = { rows: BillTruthOpenRow[]; count: number; total: number }
export type BillTruthDraftBucket = { invoices: BillTruthInvoice[]; count: number; total: number }

export type BillTruth = {
  readyToBill: BillTruthDraftBucket
  /** Open bills on jobs NOT flagged into Collections (the "Billed Awaiting Payment" pile). */
  billed: BillTruthBucket
  /** Open bills on Collections-flagged jobs. */
  collections: BillTruthBucket
  /** billed + collections — everything customers owe. */
  owed: { count: number; total: number }
  paidInFull: { jobCount: number }
  /** RTB / billed invoices riding a `paid` job — excluded from every bucket above. */
  onPaidJobs: BillTruthDraftBucket
  /** RTB / billed invoices whose job is not among the supplied rows — excluded. */
  orphans: BillTruthDraftBucket
  /** The billed-status part of onPaidJobs + orphans, as open remainders — "excluded from Owed". */
  excludedOwed: { count: number; total: number }
}

// ---------------------------------------------------------------------------
// Rule primitives — small enough for the per-customer kernels to call directly.
// ---------------------------------------------------------------------------

/** THE clamp. Every bill balance in the app goes through here exactly once. */
export function openRemainder(billed: number | null | undefined, applied: number | null | undefined): number {
  return Math.max(0, Number(billed ?? 0) - Number(applied ?? 0))
}

/** A remainder that reads as zero money. */
export function isSettledRemainder(remaining: number): boolean {
  return remaining <= BILL_TRUTH_EPSILON
}

/**
 * A job whose bills are live: any status but `paid`. NULL / empty status is
 * the board's `working` (the one deliberate departure from the SQL mirror in
 * `jobCarriesOpenBills`, which excludes NULL like `j.status <> 'paid'`).
 */
export function billOnOpenJob(jobStatus: string | null | undefined): boolean {
  if (jobStatus == null || jobStatus === '') return true
  return jobCarriesOpenBills(jobStatus)
}

/** The v2.2846 exception, by name: the job is Paid in Full. */
export function billIsOnPaidJob(jobStatus: string | null | undefined): boolean {
  return isPaidJobStatus(jobStatus)
}

/** A `billed` job with no billed invoice rows prints its shell remainder (never widen — see twin). */
export function jobPrintsBilledShell(jobStatus: string | null | undefined): boolean {
  return jobPrintsShellRemainder(jobStatus)
}

/** In Collections = billed AND flagged (mirrors `jobInCollections` in jobsStagesBoard.ts). */
export function jobIsInCollections(job: Pick<BillTruthJob, 'status' | 'collections_at'>): boolean {
  return (job.status ?? '') === 'billed' && job.collections_at != null
}

export function isBilledInvoiceStatus(status: string | null | undefined): boolean {
  return status === BILLED_INVOICE_STATUS
}

export function isReadyToBillInvoiceStatus(status: string | null | undefined): boolean {
  return status === RTB_INVOICE_STATUS
}

/** Σ payment.amount per invoice_id (job-level rows, invoice_id null, are skipped). */
export function appliedByInvoiceId(payments: ReadonlyArray<BillTruthPayment>): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    out.set(p.invoice_id, (out.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return out
}

/**
 * Lifetime billed on ONE job: Σ billed/paid invoice amounts, else the shell
 * `revenue` once the job itself is billed/paid. 0 for everything else.
 */
export function jobBilledContribution(
  job: Pick<BillTruthJob, 'status' | 'revenue'>,
  invoicesOnJob: ReadonlyArray<Pick<BillTruthInvoice, 'status' | 'amount'>>,
): number {
  let invoiced = 0
  for (const inv of invoicesOnJob) {
    if (inv.status === 'billed' || inv.status === 'paid') invoiced += Number(inv.amount ?? 0)
  }
  if (invoiced > 0) return invoiced
  const status = job.status ?? ''
  if (status === 'billed' || status === 'paid') return Number(job.revenue ?? 0)
  return 0
}

/** Lifetime collected: every payment row, invoice-linked or job-level. */
export function lifetimeCollected(payments: ReadonlyArray<Pick<BillTruthPayment, 'amount'>>): number {
  let s = 0
  for (const p of payments) s += Number(p.amount ?? 0)
  return s
}

/**
 * The open-bill rows ONE job contributes: nothing on a paid job; each `billed`
 * invoice row netted against its linked payments; or, when a `billed` job has
 * no billed invoice rows, one shell row. `applied` is the invoice_id → Σ map
 * from `appliedByInvoiceId` (pass an empty map when payments are unknown).
 */
export function openBillRowsForJob(
  job: BillTruthJob,
  invoicesOnJob: ReadonlyArray<BillTruthInvoice>,
  applied: ReadonlyMap<string, number>,
): BillTruthOpenRow[] {
  if (!billOnOpenJob(job.status)) return []
  const inCollections = jobIsInCollections(job)
  const rows: BillTruthOpenRow[] = []
  for (const inv of invoicesOnJob) {
    if (!isBilledInvoiceStatus(inv.status)) continue
    const billed = Number(inv.amount ?? 0)
    const paid = applied.get(inv.id) ?? 0
    const remaining = openRemainder(billed, paid)
    rows.push({
      kind: 'invoice',
      invoiceId: inv.id,
      jobId: job.id,
      billed,
      applied: paid,
      remaining,
      settled: isSettledRemainder(remaining),
      inCollections,
    })
  }
  if (rows.length === 0 && jobPrintsBilledShell(job.status)) {
    const billed = Number(job.revenue ?? 0)
    const paid = Number(job.payments_made ?? 0)
    const remaining = openRemainder(billed, paid)
    rows.push({
      kind: 'shell',
      invoiceId: null,
      jobId: job.id,
      billed,
      applied: paid,
      remaining,
      settled: isSettledRemainder(remaining),
      inCollections,
    })
  }
  return rows
}

/** Σ remaining over rows — the only way a surface should total a bucket. */
export function sumRemaining(rows: ReadonlyArray<Pick<BillTruthOpenRow, 'remaining'>>): number {
  let s = 0
  for (const r of rows) s += r.remaining
  return s
}

// ---------------------------------------------------------------------------
// The buckets.
// ---------------------------------------------------------------------------

function emptyBucket(): BillTruthBucket {
  return { rows: [], count: 0, total: 0 }
}

function finishBucket(rows: BillTruthOpenRow[]): BillTruthBucket {
  return { rows, count: rows.length, total: sumRemaining(rows) }
}

function finishDraftBucket(invoices: BillTruthInvoice[]): BillTruthDraftBucket {
  let total = 0
  for (const inv of invoices) total += Number(inv.amount ?? 0)
  return { invoices, count: invoices.length, total }
}

export type BillTruthInput = {
  jobs: ReadonlyArray<BillTruthJob>
  invoices: ReadonlyArray<BillTruthInvoice>
  payments: ReadonlyArray<BillTruthPayment>
}

/** The buckets over nothing — for fixtures and loading states. */
export function emptyBillTruth(): BillTruth {
  return computeBillTruth({ jobs: [], invoices: [], payments: [] })
}

export function computeBillTruth(input: BillTruthInput): BillTruth {
  const jobsById = new Map<string, BillTruthJob>()
  for (const j of input.jobs) jobsById.set(j.id, j)
  const invoicesByJob = new Map<string, BillTruthInvoice[]>()
  const onPaidJobs: BillTruthInvoice[] = []
  const orphans: BillTruthInvoice[] = []
  const readyToBill: BillTruthInvoice[] = []
  for (const inv of input.invoices) {
    const isRtb = isReadyToBillInvoiceStatus(inv.status)
    const isBilled = isBilledInvoiceStatus(inv.status)
    if (!isRtb && !isBilled) continue
    const job = jobsById.get(inv.job_id)
    if (!job) {
      orphans.push(inv)
      continue
    }
    if (billIsOnPaidJob(job.status) || !billOnOpenJob(job.status)) {
      onPaidJobs.push(inv)
      continue
    }
    if (isRtb) readyToBill.push(inv)
    const list = invoicesByJob.get(inv.job_id)
    if (list) list.push(inv)
    else invoicesByJob.set(inv.job_id, [inv])
  }

  const applied = appliedByInvoiceId(input.payments)
  const billedRows: BillTruthOpenRow[] = []
  const collectionsRows: BillTruthOpenRow[] = []
  let paidJobCount = 0
  for (const job of input.jobs) {
    if (billIsOnPaidJob(job.status)) {
      paidJobCount += 1
      continue
    }
    for (const row of openBillRowsForJob(job, invoicesByJob.get(job.id) ?? [], applied)) {
      if (row.inCollections) collectionsRows.push(row)
      else billedRows.push(row)
    }
  }

  const billed = billedRows.length ? finishBucket(billedRows) : emptyBucket()
  const collections = collectionsRows.length ? finishBucket(collectionsRows) : emptyBucket()

  let excludedCount = 0
  let excludedTotal = 0
  for (const inv of [...onPaidJobs, ...orphans]) {
    if (!isBilledInvoiceStatus(inv.status)) continue
    excludedCount += 1
    excludedTotal += openRemainder(inv.amount, applied.get(inv.id) ?? 0)
  }

  return {
    readyToBill: finishDraftBucket(readyToBill),
    billed,
    collections,
    owed: { count: billed.count + collections.count, total: billed.total + collections.total },
    paidInFull: { jobCount: paidJobCount },
    onPaidJobs: finishDraftBucket(onPaidJobs),
    orphans: finishDraftBucket(orphans),
    excludedOwed: { count: excludedCount, total: excludedTotal },
  }
}

/**
 * Jobs that already carry their `invoices` / `payments` (the board's
 * `JobWithDetails`, the Hub's `ProfileJob`) — flatten and compute.
 */
export type BillTruthJobWithRows = BillTruthJob & {
  invoices?: ReadonlyArray<Omit<BillTruthInvoice, 'job_id'> & { job_id?: string }> | null
  payments?: ReadonlyArray<BillTruthPayment> | null
}

export function computeBillTruthFromJobs(jobs: ReadonlyArray<BillTruthJobWithRows>): BillTruth {
  const invoices: BillTruthInvoice[] = []
  const payments: BillTruthPayment[] = []
  for (const j of jobs) {
    for (const inv of j.invoices ?? []) {
      invoices.push({ id: inv.id, job_id: inv.job_id ?? j.id, status: inv.status, amount: inv.amount })
    }
    for (const p of j.payments ?? []) payments.push({ invoice_id: p.invoice_id, amount: p.amount })
  }
  return computeBillTruth({ jobs, invoices, payments })
}
