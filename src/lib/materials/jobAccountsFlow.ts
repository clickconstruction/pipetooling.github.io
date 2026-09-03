/**
 * Materials → Job Accounts: per-job money flow — customer payments in
 * (jobs_ledger.revenue / payments_made) against supply-house invoice
 * allocations out (supply_house_invoice_job_allocations × supply_house_invoices).
 * Pure; the tab fetches rows. Allocation pct is 0–100 (allocated dollars =
 * amount × pct / 100, matching fetchJobMaterialsCostSnapshot).
 */

import { agingBucketFor, type AgingBucketKey } from '../supplyHouseAging'

const EPSILON = 0.005

export type JobAccountsStatus = 'owe_suppliers' | 'floating' | 'awaiting_customer' | 'settled'

export interface JobAccountsInvoiceInput {
  id: string
  supply_house_id: string
  amount: number | null
  is_paid: boolean
  due_date: string | null
  /** Invoice rides on the house's job account — unpaid balance is the property owner's exposure, not ours. */
  on_job_account: boolean
}

export interface JobAccountsAllocationInput {
  invoice_id: string
  job_id: string
  pct: number | null
}

export interface JobAccountsJobInput {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  revenue: number | null
  payments_made: number | null
}

export interface JobAccountHouseGroup {
  supplyHouseId: string
  name: string
  invoiceCount: number
  unpaidCount: number
  /** Oldest unpaid due date (ymd), or null when no unpaid invoice carries one. */
  oldestUnpaidDueYmd: string | null
  /** Aging bucket of that oldest due date; 'noDueDate' when unpaid invoices exist without one. */
  oldestUnpaidBucket: AgingBucketKey | null
  paid: number
  owed: number
  /** Portion of `owed` on the house's job account (owner-secured). */
  owedOnJobAccount: number
}

export interface JobAccountsRow {
  jobId: string
  /** Effective ledger number (hcp else click), untrimmed of display prefixes. */
  jobNumber: string
  jobName: string
  /** jobs_ledger.revenue */
  billed: number
  /** jobs_ledger.payments_made */
  paidIn: number
  suppliersPaid: number
  suppliersOwed: number
  /**
   * Aging of owed dollars NOT on a job account — job-account owed dollars are
   * excluded (the house's collection path is the owner, so they don't join the
   * past-due heat) and reported separately in `owedOnJobAccount`.
   */
  owedBuckets: Record<AgingBucketKey, number>
  /** Portion of suppliersOwed on job accounts (owner-secured). */
  owedOnJobAccount: number
  /** Supplier balance covered by money already received: min(suppliersOwed, paidIn). */
  held: number
  /** paidIn / billed clamped to [0, 1]; null when nothing billed. */
  customerPaidFraction: number | null
  status: JobAccountsStatus
  invoiceCount: number
  /** Owed desc, then paid desc. */
  houses: JobAccountHouseGroup[]
}

export interface JobAccountsView {
  /** owe_suppliers (held desc) → floating (suppliersPaid desc) → awaiting_customer (owed desc) → settled (billed desc). */
  rows: JobAccountsRow[]
  holdingTotal: number
  holdingJobs: number
  floatingTotal: number
  floatingJobs: number
  awaitingJobs: number
  settledJobs: number
  /** Unpaid invoices allocated to neither a job nor a bid — dollars missing from the rows. */
  unallocatedTotal: number
  unallocatedCount: number
  /** Owed dollars on job accounts across all rows (owner-secured slice of every "owed" figure). */
  onJobAccountTotal: number
  /** Rows with any owed job-account dollars. */
  onJobAccountJobs: number
  /**
   * Slice of holdingTotal secured by job accounts. Attribution is job-account
   * first: per owe_suppliers row, min(owedOnJobAccount, held) — when held is
   * less than owed, the secured dollars are counted as held before our own.
   */
  holdingOnJobAccount: number
}

function emptyBuckets(): Record<AgingBucketKey, number> {
  return { current: 0, past1_30: 0, past30_60: 0, past60_90: 0, past90plus: 0, noDueDate: 0 }
}

export function classifyJobAccount(row: {
  billed: number
  paidIn: number
  suppliersPaid: number
  suppliersOwed: number
}): JobAccountsStatus {
  if (row.suppliersOwed > EPSILON) {
    return row.paidIn > EPSILON ? 'owe_suppliers' : 'awaiting_customer'
  }
  if (row.suppliersPaid > EPSILON && row.paidIn < row.billed - EPSILON) return 'floating'
  return 'settled'
}

const STATUS_RANK: Record<JobAccountsStatus, number> = {
  owe_suppliers: 0,
  floating: 1,
  awaiting_customer: 2,
  settled: 3,
}

function rowSortKey(row: JobAccountsRow): number {
  switch (row.status) {
    case 'owe_suppliers':
      return row.held
    case 'floating':
      return row.suppliersPaid
    case 'awaiting_customer':
      return row.suppliersOwed
    case 'settled':
      return row.billed
  }
}

export function buildJobAccountsView(
  jobs: JobAccountsJobInput[],
  invoices: JobAccountsInvoiceInput[],
  allocations: JobAccountsAllocationInput[],
  houses: Array<{ id: string; name: string }>,
  bidAllocatedInvoiceIds: Iterable<string>,
  todayYmd: string,
): JobAccountsView {
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]))
  const houseNameById = new Map(houses.map((h) => [h.id, h.name]))
  const jobById = new Map(jobs.map((j) => [j.id, j]))
  const bidAllocated = new Set(bidAllocatedInvoiceIds)

  type Acc = {
    job: JobAccountsJobInput
    suppliersPaid: number
    suppliersOwed: number
    owedBuckets: Record<AgingBucketKey, number>
    owedOnJobAccount: number
    invoiceCount: number
    houses: Map<string, JobAccountHouseGroup>
  }
  const accByJob = new Map<string, Acc>()
  const jobAllocatedInvoiceIds = new Set<string>()

  for (const alloc of allocations) {
    const inv = invoiceById.get(alloc.invoice_id)
    if (!inv) continue
    // Allocated in the DB even when the job row isn't visible/loaded — such
    // dollars drop from the rows but must not be reported as "unallocated".
    jobAllocatedInvoiceIds.add(inv.id)
    const job = jobById.get(alloc.job_id)
    if (!job) continue
    const allocated = (Number(inv.amount ?? 0) * Number(alloc.pct ?? 0)) / 100
    let acc = accByJob.get(job.id)
    if (!acc) {
      acc = {
        job,
        suppliersPaid: 0,
        suppliersOwed: 0,
        owedBuckets: emptyBuckets(),
        owedOnJobAccount: 0,
        invoiceCount: 0,
        houses: new Map(),
      }
      accByJob.set(job.id, acc)
    }
    acc.invoiceCount++
    let group = acc.houses.get(inv.supply_house_id)
    if (!group) {
      group = {
        supplyHouseId: inv.supply_house_id,
        name: houseNameById.get(inv.supply_house_id) ?? 'Unknown supply house',
        invoiceCount: 0,
        unpaidCount: 0,
        oldestUnpaidDueYmd: null,
        oldestUnpaidBucket: null,
        paid: 0,
        owed: 0,
        owedOnJobAccount: 0,
      }
      acc.houses.set(inv.supply_house_id, group)
    }
    group.invoiceCount++
    if (inv.is_paid) {
      acc.suppliersPaid += allocated
      group.paid += allocated
    } else {
      acc.suppliersOwed += allocated
      if (inv.on_job_account) {
        acc.owedOnJobAccount += allocated
        group.owedOnJobAccount += allocated
      } else {
        acc.owedBuckets[agingBucketFor(inv.due_date, todayYmd)] += allocated
      }
      group.owed += allocated
      group.unpaidCount++
      if (inv.due_date && (!group.oldestUnpaidDueYmd || inv.due_date < group.oldestUnpaidDueYmd)) {
        group.oldestUnpaidDueYmd = inv.due_date
      }
    }
  }

  const rows: JobAccountsRow[] = []
  for (const acc of accByJob.values()) {
    const billed = Number(acc.job.revenue ?? 0)
    const paidIn = Number(acc.job.payments_made ?? 0)
    const status = classifyJobAccount({
      billed,
      paidIn,
      suppliersPaid: acc.suppliersPaid,
      suppliersOwed: acc.suppliersOwed,
    })
    const houseGroups = [...acc.houses.values()]
      .map((g) => ({
        ...g,
        oldestUnpaidBucket: g.unpaidCount > 0 ? agingBucketFor(g.oldestUnpaidDueYmd, todayYmd) : null,
      }))
      .sort((a, b) => b.owed - a.owed || b.paid - a.paid)
    rows.push({
      jobId: acc.job.id,
      jobNumber: (acc.job.hcp_number ?? '').trim() || (acc.job.click_number ?? '').trim() || '',
      jobName: (acc.job.job_name ?? '').trim(),
      billed,
      paidIn,
      suppliersPaid: acc.suppliersPaid,
      suppliersOwed: acc.suppliersOwed,
      owedBuckets: acc.owedBuckets,
      owedOnJobAccount: acc.owedOnJobAccount,
      held: Math.min(acc.suppliersOwed, Math.max(0, paidIn)),
      customerPaidFraction: billed > EPSILON ? Math.min(1, Math.max(0, paidIn / billed)) : null,
      status,
      invoiceCount: acc.invoiceCount,
      houses: houseGroups,
    })
  }

  rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || rowSortKey(b) - rowSortKey(a))

  let unallocatedTotal = 0
  let unallocatedCount = 0
  for (const inv of invoices) {
    if (inv.is_paid) continue
    if (jobAllocatedInvoiceIds.has(inv.id) || bidAllocated.has(inv.id)) continue
    unallocatedTotal += Number(inv.amount ?? 0)
    unallocatedCount++
  }

  let holdingTotal = 0
  let holdingJobs = 0
  let floatingTotal = 0
  let floatingJobs = 0
  let awaitingJobs = 0
  let settledJobs = 0
  let onJobAccountTotal = 0
  let onJobAccountJobs = 0
  let holdingOnJobAccount = 0
  for (const row of rows) {
    if (row.owedOnJobAccount > EPSILON) {
      onJobAccountTotal += row.owedOnJobAccount
      onJobAccountJobs++
    }
    if (row.status === 'owe_suppliers') {
      holdingTotal += row.held
      holdingJobs++
      holdingOnJobAccount += Math.min(row.owedOnJobAccount, row.held)
    } else if (row.status === 'floating') {
      floatingTotal += row.suppliersPaid
      floatingJobs++
    } else if (row.status === 'awaiting_customer') {
      awaitingJobs++
    } else {
      settledJobs++
    }
  }

  return {
    rows,
    holdingTotal,
    holdingJobs,
    floatingTotal,
    floatingJobs,
    awaitingJobs,
    settledJobs,
    unallocatedTotal,
    unallocatedCount,
    onJobAccountTotal,
    onJobAccountJobs,
    holdingOnJobAccount,
  }
}
