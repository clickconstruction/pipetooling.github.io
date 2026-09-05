/**
 * Dashboard "Financials" one-pager: Accounts Receivable, Accounts Payable, and Not billed out.
 * Pure shaping — the hook fetches rows; every formula mirrors the owning feature's kernel so the
 * cards can never disagree with Jobs Stages (unallocated), Supply Houses (unpaid), or the Payroll
 * ledger (open balances):
 *
 * - AR   = the bill-truth kernel's `billed` / `collections` buckets (`lib/billing/billTruth.ts`,
 *          journey Tier-1 #2(c)): one row per billed invoice on a non-paid job, netted against its
 *          linked payments; one shell row per invoice-less billed job (revenue − payments_made);
 *          clamped at 0 once, in the kernel. Bills on paid or missing jobs are EXCLUDED and
 *          reported in `excluded` (the old "Unknown job" $488 row). Same numbers as the Pipeline
 *          strip, the Billed pin, Quickfill and the Customer Hub.
 * - AP   = unpaid supply-house invoices + open payroll balances
 *          (stubNetPay(gross, less, additional) − payments) + estimated upcoming payroll for
 *          worked-but-unreported weeks (folded in via mergeUpcomingIntoAp). Mirrors the Payroll
 *          ledger summary (due + upcoming).
 * - Not billed = working / ready_to_bill jobs: max(0, (revenue − payments_made) − Σ billed
 *          invoice amounts). Ready-to-Bill draft lines are NOT subtracted — they aren't on a
 *          customer invoice yet. Mirrors the Stages gross/alloc basis (jobsStagesBoard.ts).
 */

import type { UpcomingPayrollLine } from './upcomingPayrollSummary'
import { effectivePctComplete } from './jobs/effectivePctComplete'
import { computeBillTruth, type BillTruth, type BillTruthOpenRow } from './billing/billTruth'

export type FinancialItem = {
  key: string
  label: string
  sublabel: string | null
  amount: number
  /** YYYY-MM-DD used for the "oldest" hint; null when the source has no meaningful date. */
  dateYmd: string | null
  /** jobs_ledger id for AR / Not-billed rows — powers click-to-open-job; null for AP rows. */
  jobId: string | null
  /** Job street address — shown on Not-billed rows; null elsewhere. */
  address: string | null
  /**
   * Effective % done for Not-billed and AR (billed/collections) rows —
   * jobs_ledger.pct_complete with the display fallback already applied
   * (unset reads 0; see effectivePctComplete). Null on AP rows and rows
   * whose job row is missing.
   */
  pctComplete?: number | null
  /** Full job total (jobs_ledger.revenue) — the "of $X job total" context line on Not-billed rows (v2.1597); null when 0/missing. */
  jobTotal?: number | null
  /** Not-billed rows: 100% done with the entire job total still unbilled — the "done — nothing billed" flag (v2.1597). */
  fullyUnbilledDone?: boolean
  /** Job's customer (AR rows, v2.2571) — powers the AR modal's Customers view; null on AP rows and customer-less jobs. */
  customerId?: string | null
  customerName?: string | null
}

export type FinancialBucket = {
  total: number
  count: number
  oldestDateYmd: string | null
  /** Sorted by amount desc. */
  items: FinancialItem[]
}

export type FinancialJobRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  job_address?: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  last_work_date: string | null
  /** Difficult-to-collect flag; in Collections = status='billed' AND collections_at set. */
  collections_at?: string | null
  /** Stages % complete (0–100), manually set on the Jobs Stages table. */
  pct_complete?: number | null
  /** Customer identity for the AR modal's Customers view (v2.2571). */
  customer_id?: string | null
  customer_name?: string | null
}

export type FinancialInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string | null
  billed_at: string | null
}

export type FinancialInvoicePaymentRow = { invoice_id: string | null; amount: number | null }

export type FinancialSupplyInvoiceRow = {
  id: string
  amount: number | null
  invoice_date: string | null
  supply_houses: { name: string | null } | null
}

export type FinancialPayrollStubRow = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  /** Net pay (gross − deductions + additional lines), computed by the hook via stubNetPay. */
  netPay: number
  paidSum: number
}

const EPSILON = 0.005

function isoToYmd(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function financialJobLabel(job: Pick<FinancialJobRow, 'hcp_number' | 'click_number' | 'job_name'>): string {
  const num = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  const name = (job.job_name ?? '').trim()
  if (num && name) return `${num} · ${name}`
  return num || name || '—'
}

function finishBucket(items: FinancialItem[]): FinancialBucket {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  let oldest: string | null = null
  for (const i of sorted) {
    if (i.dateYmd && (oldest === null || i.dateYmd < oldest)) oldest = i.dateYmd
  }
  return {
    total: sorted.reduce((s, i) => s + i.amount, 0),
    count: sorted.length,
    oldestDateYmd: oldest,
    items: sorted,
  }
}

/** Bills the kernel kept out of Owed: on a paid job, or on a job not in the fetch (deleted). */
export type ArExcluded = { count: number; total: number }

/** Sublabel for a bill that is fully paid but still `billed` — a Mark Paid to-do, not money owed. */
export const AR_SETTLED_SUBLABEL = 'paid in full — not yet marked Paid'

function arItemFromRow(
  row: BillTruthOpenRow,
  job: FinancialJobRow | undefined,
  invoiceById: ReadonlyMap<string, FinancialInvoiceRow>,
): FinancialItem {
  const inv = row.invoiceId ? invoiceById.get(row.invoiceId) : undefined
  const shell = row.kind === 'shell'
  return {
    key: shell ? `job:${row.jobId}` : `inv:${row.invoiceId}`,
    label: job ? financialJobLabel(job) : '—',
    sublabel: row.settled
      ? `${shell ? 'Billed job' : 'Billed invoice'} · ${AR_SETTLED_SUBLABEL}`
      : shell
        ? 'Billed job (no invoice rows)'
        : 'Billed invoice',
    amount: row.remaining,
    // A settled row has nothing to age — never let it drive the "oldest" hint or the 30/90 bars.
    dateYmd: row.settled || shell ? null : isoToYmd(inv?.billed_at ?? null),
    jobId: row.jobId,
    address: (job?.job_address ?? '').trim() || null,
    pctComplete: job ? effectivePctComplete(job.pct_complete, job.status) : null,
    customerId: job?.customer_id ?? null,
    customerName: (job?.customer_name ?? '').trim() || null,
  }
}

/**
 * AR split by the difficult-to-collect flag: `ar` is the headline (money realistically expected
 * soon), `collections` is parked receivables. Both are the bill-truth kernel's buckets shaped
 * into items — membership by status (a fully-paid-but-unmarked bill stays as a $0 settled row,
 * so the count matches the Pipeline strip), remainders clamped once in the kernel, bills on paid
 * or missing jobs excluded and counted in `excluded`. ar.total + collections.total = Owed.
 */
export function buildArBuckets(
  jobs: FinancialJobRow[],
  invoices: FinancialInvoiceRow[],
  invoicePayments: FinancialInvoicePaymentRow[],
): { ar: FinancialBucket; collections: FinancialBucket; excluded: ArExcluded; truth: BillTruth } {
  const truth = computeBillTruth({ jobs, invoices, payments: invoicePayments })
  const jobsById = new Map(jobs.map((j) => [j.id, j]))
  const invoiceById = new Map(invoices.map((i) => [i.id, i]))
  const toItems = (rows: BillTruthOpenRow[]) => rows.map((r) => arItemFromRow(r, jobsById.get(r.jobId), invoiceById))
  return {
    ar: finishBucket(toItems(truth.billed.rows)),
    collections: finishBucket(toItems(truth.collections.rows)),
    excluded: { count: truth.excludedOwed.count, total: truth.excludedOwed.total },
    truth,
  }
}

/** AR ignoring the collections split: open remainders on ALL billed invoices + invoice-less billed jobs. */
export function buildArBucket(
  jobs: FinancialJobRow[],
  invoices: FinancialInvoiceRow[],
  invoicePayments: FinancialInvoicePaymentRow[],
): FinancialBucket {
  const { ar, collections } = buildArBuckets(jobs, invoices, invoicePayments)
  return finishBucket([...ar.items, ...collections.items])
}

/** AP: unpaid supply-house invoices + open payroll balances. */
/** One outstanding sub-labor job balance (Jobs → Sub Labor); mirrors SubLaborDueJobRow. */
export type FinancialSubLaborJobRow = {
  id: string
  assignedToName: string | null
  address: string | null
  jobNumber: string | null
  createdYmd: string | null
  balance: number
}

export function buildApBucket(
  supplyInvoices: FinancialSupplyInvoiceRow[],
  payrollStubs: FinancialPayrollStubRow[],
  subLaborJobs: FinancialSubLaborJobRow[] = [],
): FinancialBucket & { supplyTotal: number; payrollTotal: number; subLaborTotal: number } {
  const items: FinancialItem[] = []
  let supplyTotal = 0
  for (const inv of supplyInvoices) {
    const amount = Number(inv.amount ?? 0)
    if (amount <= EPSILON) continue
    supplyTotal += amount
    items.push({
      key: `supply:${inv.id}`,
      label: (inv.supply_houses?.name ?? '').trim() || 'Supply house',
      sublabel: 'Supply invoice',
      amount,
      dateYmd: inv.invoice_date,
      jobId: null,
      address: null,
    })
  }
  let payrollTotal = 0
  for (const stub of payrollStubs) {
    const remaining = Math.max(0, stub.netPay - stub.paidSum)
    if (remaining <= EPSILON) continue
    payrollTotal += remaining
    items.push({
      key: `stub:${stub.id}`,
      label: stub.person_name,
      sublabel: `Payroll ${stub.period_start} – ${stub.period_end}`,
      amount: remaining,
      dateYmd: stub.period_end,
      jobId: null,
      address: null,
    })
  }
  let subLaborTotal = 0
  for (const job of subLaborJobs) {
    if (job.balance <= EPSILON) continue
    subLaborTotal += job.balance
    items.push({
      key: `sublabor:${job.id}`,
      label: (job.assignedToName ?? '').trim() || 'Sub labor',
      sublabel: `Sub labor${job.jobNumber ? ` · #${job.jobNumber}` : ''}`,
      amount: job.balance,
      dateYmd: job.createdYmd,
      jobId: null,
      address: job.address,
    })
  }
  return { ...finishBucket(items), supplyTotal, payrollTotal, subLaborTotal }
}

/** m/d without year, from a YYYY-MM-DD string (no Date/ICU involvement). */
function shortMd(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** "Upcoming payroll" section for the AP drill-down — estimate; merged into the AP total via mergeUpcomingIntoAp. */
export type UpcomingPayrollApSection = { total: number; count: number; items: FinancialItem[] }

/**
 * Map the Payroll ledger's upcoming person-week lines (buildUpcomingPayrollSummary) to AP
 * drill-down items. Keeps the ledger's order (person asc, week asc).
 */
export function buildUpcomingApSection(lines: UpcomingPayrollLine[]): UpcomingPayrollApSection {
  const items: FinancialItem[] = lines.map((l) => ({
    key: `upcoming:${l.personName}:${l.weekStartYmd}`,
    label: l.personName,
    sublabel: `${shortMd(l.weekStartYmd)}–${shortMd(l.weekEndYmd)} · ${l.hours.toFixed(1)}h (est.)`,
    amount: l.estimatedGrossDollars,
    dateYmd: l.weekEndYmd,
    jobId: null,
    address: null,
  }))
  return {
    total: items.reduce((s, i) => s + i.amount, 0),
    count: items.length,
    items,
  }
}

/**
 * Fold the estimated upcoming payroll into the AP bucket so the headline total, count, and
 * oldest hint cover ALL team labor owed — not just weeks with a pay report made. The upcoming
 * items keep their `upcoming:` key prefix so the drill-down can still render them as their own
 * "(estimate)" section; `upcomingTotal` carries the estimate subtotal for the card's Team line.
 */
export function mergeUpcomingIntoAp<
  T extends FinancialBucket & { supplyTotal: number; payrollTotal: number; subLaborTotal: number },
>(ap: T, upcoming: UpcomingPayrollApSection): T & { upcomingTotal: number } {
  if (upcoming.count === 0 || upcoming.total <= EPSILON) return { ...ap, upcomingTotal: 0 }
  return {
    ...ap,
    ...finishBucket([...ap.items, ...upcoming.items]),
    upcomingTotal: upcoming.total,
  }
}

/**
 * Assistant path (post pay-lockdown, v2.660): the AP bucket built from the
 * get_dashboard_payroll_totals RPC aggregates — per-person stub rows are never
 * fetched, so there is nothing to redact. Shape matches redactApPayrollItems output.
 */
export function buildApBucketFromAggregates(
  supplyInvoices: FinancialSupplyInvoiceRow[],
  totals: { dueTotal: number; dueCount: number },
  subLaborJobs: FinancialSubLaborJobRow[] = [],
): FinancialBucket & { supplyTotal: number; payrollTotal: number; subLaborTotal: number } {
  const base = buildApBucket(supplyInvoices, [], subLaborJobs)
  if (totals.dueTotal <= EPSILON) return base
  const aggregate: FinancialItem = {
    key: 'payroll:aggregate',
    label: 'Payroll',
    sublabel: `${totals.dueCount} open pay report${totals.dueCount === 1 ? '' : 's'}`,
    amount: totals.dueTotal,
    dateYmd: null,
    jobId: null,
    address: null,
  }
  return {
    ...finishBucket([...base.items, aggregate]),
    supplyTotal: base.supplyTotal,
    payrollTotal: totals.dueTotal,
    subLaborTotal: base.subLaborTotal,
  }
}

/** Assistant path: upcoming-payroll section from RPC aggregates (shape matches redactUpcomingApSection). */
export function upcomingApSectionFromAggregates(totals: {
  upcomingTotal: number
  upcomingCount: number
}): UpcomingPayrollApSection {
  if (totals.upcomingCount === 0 || totals.upcomingTotal <= EPSILON) return { total: 0, count: 0, items: [] }
  return {
    total: totals.upcomingTotal,
    count: totals.upcomingCount,
    items: [
      {
        key: 'upcoming:aggregate',
        label: 'Payroll',
        sublabel: `${totals.upcomingCount} person-week${totals.upcomingCount === 1 ? '' : 's'}`,
        amount: totals.upcomingTotal,
        dateYmd: null,
        jobId: null,
        address: null,
      },
    ],
  }
}

/** Assistant view: one aggregate upcoming-payroll line — no per-person amounts. */
export function redactUpcomingApSection(section: UpcomingPayrollApSection): UpcomingPayrollApSection {
  if (section.items.length === 0) return section
  return {
    total: section.total,
    count: section.count,
    items: [
      {
        key: 'upcoming:aggregate',
        label: 'Payroll',
        sublabel: `${section.count} person-week${section.count === 1 ? '' : 's'}`,
        amount: section.total,
        dateYmd: null,
        jobId: null,
        address: null,
      },
    ],
  }
}

/**
 * Assistant view of the AP drill-down: collapse per-person payroll rows — open pay reports AND
 * merged-in upcoming estimate lines — into aggregate "Payroll" lines (individual pay amounts
 * are private; the outstanding totals are not). Totals and subtotals are unchanged by
 * construction; extra fields (subLaborTotal, upcomingTotal) pass through.
 */
export function redactApPayrollItems<T extends FinancialBucket & { supplyTotal: number; payrollTotal: number }>(
  ap: T,
): T {
  const stubItems = ap.items.filter((i) => i.key.startsWith('stub:'))
  const upcomingItems = ap.items.filter((i) => i.key.startsWith('upcoming:') && i.key !== 'upcoming:aggregate')
  if (stubItems.length === 0 && upcomingItems.length === 0) return ap
  const aggregates: FinancialItem[] = []
  if (stubItems.length > 0) {
    let oldest: string | null = null
    for (const i of stubItems) {
      if (i.dateYmd && (oldest === null || i.dateYmd < oldest)) oldest = i.dateYmd
    }
    aggregates.push({
      key: 'payroll:aggregate',
      label: 'Payroll',
      sublabel: `${stubItems.length} open pay report${stubItems.length === 1 ? '' : 's'}`,
      amount: ap.payrollTotal,
      dateYmd: oldest,
      jobId: null,
      address: null,
    })
  }
  if (upcomingItems.length > 0) {
    aggregates.push({
      key: 'upcoming:aggregate',
      label: 'Payroll',
      sublabel: `${upcomingItems.length} person-week${upcomingItems.length === 1 ? '' : 's'} (est.)`,
      amount: upcomingItems.reduce((s, i) => s + i.amount, 0),
      dateYmd: null,
      jobId: null,
      address: null,
    })
  }
  const rest = ap.items.filter((i) => !i.key.startsWith('stub:') && !i.key.startsWith('upcoming:'))
  return { ...ap, ...finishBucket([...rest, ...aggregates]) }
}

/** Not billed out: working / ready_to_bill jobs' revenue not yet on a billed customer invoice. */
export function buildUnbilledBucket(jobs: FinancialJobRow[], invoices: FinancialInvoiceRow[]): FinancialBucket {
  const billedAmountByJob = new Map<string, number>()
  for (const inv of invoices) {
    if (inv.status !== 'billed') continue
    billedAmountByJob.set(inv.job_id, (billedAmountByJob.get(inv.job_id) ?? 0) + Number(inv.amount ?? 0))
  }
  const items: FinancialItem[] = []
  for (const job of jobs) {
    const status = job.status ?? ''
    if (status !== 'working' && status !== 'ready_to_bill') continue
    const revenue = Number(job.revenue ?? 0)
    const gross = Math.max(0, revenue - Number(job.payments_made ?? 0))
    const unbilled = Math.max(0, gross - (billedAmountByJob.get(job.id) ?? 0))
    if (unbilled <= EPSILON) continue
    const pct = effectivePctComplete(job.pct_complete, job.status)
    items.push({
      key: `job:${job.id}`,
      label: financialJobLabel(job),
      sublabel: status === 'ready_to_bill' ? 'Ready to Bill' : 'Working',
      amount: unbilled,
      dateYmd: job.last_work_date,
      jobId: job.id,
      address: (job.job_address ?? '').trim() || null,
      pctComplete: pct,
      jobTotal: revenue > 0 ? revenue : null,
      fullyUnbilledDone: pct === 100 && revenue > 0 && unbilled >= revenue - EPSILON,
    })
  }
  return finishBucket(items)
}
