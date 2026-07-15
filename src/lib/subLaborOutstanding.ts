/**
 * Sub Labor ("Sub Sheet Ledger") money kernel — the single source of truth for
 * a job's outstanding balance, the tab's search predicate, and the per-contractor
 * outstanding rollup shown at the top of the tab. Pure: no React/Supabase.
 */
import { laborItemsSubtotal } from './peopleLaborJobItemLineCost'
import { normalizePersonNameKey } from './personNameKey'
import type { LaborJob } from '../types/laborJob'

/** Fields needed to cost a single sub-labor job's balance. */
export type SubLaborBalanceInput = Pick<LaborJob, 'labor_rate' | 'items' | 'payments'>

export type SubLaborJobBalance = {
  totalCost: number
  paid: number
  backcharges: number
  balance: number
}

/**
 * Per-job balance. `paid` sums non-negative payments; `backcharges` sums the
 * magnitude of negative payments. When a job has no priced line items but does
 * have money moved, its cost is reconstructed from those movements so it nets to
 * zero rather than showing a spurious negative balance.
 */
export function subLaborJobBalance(job: SubLaborBalanceInput): SubLaborJobBalance {
  const jobRate = job.labor_rate ?? 0
  const laborTotal = laborItemsSubtotal(job.items, jobRate)
  let totalCost = laborTotal
  const jobPayments = job.payments ?? []
  const paid = jobPayments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
  const backcharges = jobPayments
    .filter((p) => Number(p.amount) < 0)
    .reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
  if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
    totalCost = paid + backcharges
  }
  const balance = totalCost - paid - backcharges
  return { totalCost, paid, backcharges, balance }
}

/** Fields the Sub Labor search box matches against. */
export type SubLaborSearchable = Pick<LaborJob, 'assigned_to_name' | 'job_number' | 'address'>

/**
 * Whether a job matches the tab search: contractor, HCP number, address, or the
 * resolved job name for that HCP. Empty/blank query matches everything. The
 * query is normalized internally — callers pass the raw box value.
 */
export function subLaborJobMatchesSearch(
  job: SubLaborSearchable,
  query: string,
  laborJobNamesByHcp: Record<string, string>,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const contractor = (job.assigned_to_name ?? '').toLowerCase()
  const hcp = (job.job_number ?? '').toLowerCase()
  const addr = (job.address ?? '').toLowerCase()
  const jobName = laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]?.toLowerCase() ?? ''
  return contractor.includes(q) || hcp.includes(q) || addr.includes(q) || jobName.includes(q)
}

export type SubLaborOutstandingRow = {
  /** normalizePersonNameKey(assigned_to_name); '' for blank names. */
  key: string
  /** First-seen display name; '' is rendered as "(No name)" by the UI. */
  name: string
  /** Sum of positive balances across this contractor's owed jobs. */
  outstanding: number
  /** Sum of totalCost across the same owed jobs (context). */
  totalCost: number
  /** Sum of paid + backcharges across the same owed jobs (context). */
  paid: number
  /** Number of owed jobs (balance > 0) contributing to this row. */
  jobCount: number
}

export type SubLaborOutstandingByPerson = {
  rows: SubLaborOutstandingRow[]
  totalOutstanding: number
}

/**
 * Group jobs by contractor and sum money still owed. Only jobs with a positive
 * balance count — over-paid jobs are floored per-job (a credit on one job never
 * nets against debt elsewhere), matching the grand-total semantics. Rows are
 * sorted by outstanding descending (name ascending as tie-break). Because only
 * positive-balance jobs are summed, each row satisfies
 * `outstanding === totalCost - paid`, and `totalOutstanding` equals the
 * floored-per-job grand total over the same job set.
 */
export function buildSubLaborOutstandingByPerson(jobs: LaborJob[]): SubLaborOutstandingByPerson {
  const byKey = new Map<string, SubLaborOutstandingRow>()
  for (const job of jobs) {
    const { totalCost, paid, backcharges, balance } = subLaborJobBalance(job)
    if (balance <= 0) continue
    const name = job.assigned_to_name ?? ''
    const key = normalizePersonNameKey(name)
    const existing = byKey.get(key)
    if (existing) {
      existing.outstanding += balance
      existing.totalCost += totalCost
      existing.paid += paid + backcharges
      existing.jobCount += 1
    } else {
      byKey.set(key, {
        key,
        name,
        outstanding: balance,
        totalCost,
        paid: paid + backcharges,
        jobCount: 1,
      })
    }
  }
  const rows = [...byKey.values()].sort(
    (a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name),
  )
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0)
  return { rows, totalOutstanding }
}
