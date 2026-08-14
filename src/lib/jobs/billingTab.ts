import { formatCurrency } from './jobFormatting'

/**
 * Jobs → Billing tab kernels (Stage A of the Jobs.tsx decomposition — see
 * docs/JOBS_TABS_ARCHITECTURE.md): the search predicate, HCP sort, and the
 * Specific Work / Other job charges cell text. Behavior-preserving extraction
 * of the inline `filteredJobs` filter, `sortedBillingJobs` comparator, and the
 * two cell map/joins.
 */

export type BillingSearchableJob = {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  customer_name?: string | null
  /** v2.1619: search reaches the line-item text the tab actually displays. */
  fixtures?: Array<{ name?: string | null; line_description?: string | null }>
  materials?: Array<{ description?: string | null }>
}

export function billingJobMatchesSearch(job: BillingSearchableJob, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  if (
    (job.hcp_number ?? '').toLowerCase().includes(q) ||
    // Rows display the Click number when there is no HCP — it must be findable
    // by typing it too (the audit's display/match mismatch).
    (job.click_number ?? '').toLowerCase().includes(q) ||
    (job.job_name ?? '').toLowerCase().includes(q) ||
    (job.job_address ?? '').toLowerCase().includes(q) ||
    (job.customer_name ?? '').toLowerCase().includes(q)
  ) {
    return true
  }
  // The columns this tab is FOR — Specific Work + Other job charges — are
  // searchable too (v2.1619): "which job replaced that water heater?" works.
  for (const f of job.fixtures ?? []) {
    if ((f.name ?? '').toLowerCase().includes(q)) return true
    if ((f.line_description ?? '').toLowerCase().includes(q)) return true
  }
  for (const m of job.materials ?? []) {
    if ((m.description ?? '').toLowerCase().includes(q)) return true
  }
  return false
}

/** Numeric-aware HCP sort; `asc: false` = highest HCP first (the default). Returns a new array. */
export function sortJobsForBilling<T extends { hcp_number?: string | null }>(jobs: T[], asc: boolean): T[] {
  const arr = [...jobs]
  arr.sort((a, b) => {
    const ha = (a.hcp_number ?? '').trim()
    const hb = (b.hcp_number ?? '').trim()
    const cmp = ha.localeCompare(hb, undefined, { numeric: true })
    return asc ? cmp : -cmp
  })
  return arr
}

export type BillingFixtureLine = {
  name?: string | null
  count: number
  line_unit_price?: number | string | null
  line_description?: string | null
}

/** Specific Work cell: one line per named fixture — `Name × N @ $price` + optional description line. '—' only when the list is empty. */
export function billingFixturesCellText(fixtures: BillingFixtureLine[]): string {
  if (fixtures.length === 0) return '—'
  return fixtures
    .filter((f) => (f.name ?? '').trim())
    .map((f) => {
      let line = f.count > 1 ? `${f.name} × ${f.count}` : `${f.name}`
      if (
        f.line_unit_price != null &&
        Number.isFinite(Number(f.line_unit_price)) &&
        Number(f.line_unit_price) > 0
      ) {
        line += ` @ $${formatCurrency(Number(f.line_unit_price))}`
      }
      const desc = (f.line_description ?? '').trim()
      if (desc) line += `\n${desc}`
      return line
    })
    .join('\n')
}

export type BillingMaterialLine = {
  description?: string | null
  amount: number | string | null
}

/** Other job charges cell: `Description: $amount` per non-blank line. '—' only when the list is empty. */
export function billingMaterialsCellText(materials: BillingMaterialLine[]): string {
  if (materials.length === 0) return '—'
  return materials
    .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
    .map((m) => `${(m.description || '').trim() || 'Item'}: $${formatCurrency(Number(m.amount))}`)
    .join('\n')
}


export type BillingAttentionJob = {
  id: string
  hcp_number?: string | null
}

/**
 * The red-icon audit conditions as one predicate (v2.1619): the job has an
 * HCP but no Sub Labor book for it, or no Team Job Labor rows. Mirrors the
 * row icons exactly so the "Needs labor" filter and its count can't drift
 * from what the row shows.
 */
export function billingJobNeedsAttention(
  job: BillingAttentionJob,
  laborJobHcps: ReadonlySet<string>,
  teamLaborJobIds: ReadonlySet<string>,
): boolean {
  const hcp = (job.hcp_number ?? '').trim().toLowerCase()
  if (!hcp) return false
  return !laborJobHcps.has(hcp) || !teamLaborJobIds.has(job.id)
}

export type BillingMoneyJob = {
  revenue?: number | string | null
  payments_made?: number | string | null
}

/**
 * Per-row billing state line (v2.1619): "paid $X" / "billed $Y open" /
 * "unbilled $Z" tokens with their semantic colors, derived the same way the
 * Pipeline money bar derives its slices. `billedUnpaid` comes from
 * jobBilledUnpaidDollars(job) at the callsite (invoice-model aware).
 */
export function billingRowMoneyTokens(
  job: BillingMoneyJob,
  billedUnpaid: number,
): Array<{ label: string; tone: 'paid' | 'billed' | 'unbilled' }> {
  const revenue = Number(job.revenue) || 0
  const paid = Math.max(0, Number(job.payments_made) || 0)
  const billedOpen = Math.max(0, billedUnpaid)
  const unbilled = Math.max(0, revenue - paid - billedOpen)
  const out: Array<{ label: string; tone: 'paid' | 'billed' | 'unbilled' }> = []
  if (paid > 0.005) out.push({ label: `paid $${formatCurrency(paid)}`, tone: 'paid' })
  if (billedOpen > 0.005) out.push({ label: `billed $${formatCurrency(billedOpen)} open`, tone: 'billed' })
  if (unbilled > 0.005) out.push({ label: `unbilled $${formatCurrency(unbilled)}`, tone: 'unbilled' })
  return out
}

/** Footer totals over the FILTERED rows (v2.1619). */
export function billingTotals(jobs: ReadonlyArray<BillingMoneyJob>): {
  count: number
  totalBill: number
  totalPaid: number
} {
  let totalBill = 0
  let totalPaid = 0
  for (const j of jobs) {
    totalBill += Number(j.revenue) || 0
    totalPaid += Math.max(0, Number(j.payments_made) || 0)
  }
  return { count: jobs.length, totalBill, totalPaid }
}


/**
 * The red icon's tooltip/toast line (v2.1627): names exactly which labor kinds
 * are missing, in the owner's phrasing. Empty when nothing is missing.
 */
export function billingAttentionLabel(noSubLabor: boolean, noTeamLabor: boolean): string {
  if (noSubLabor && noTeamLabor) return 'No team labor or sub labor recorded for this job.'
  if (noTeamLabor) return 'No team labor recorded for this job.'
  if (noSubLabor) return 'No sub labor recorded for this job.'
  return ''
}
