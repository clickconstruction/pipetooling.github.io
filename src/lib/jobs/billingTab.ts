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
  job_name?: string | null
  job_address?: string | null
}

export function billingJobMatchesSearch(job: BillingSearchableJob, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  return (
    (job.hcp_number ?? '').toLowerCase().includes(q) ||
    (job.job_name ?? '').toLowerCase().includes(q) ||
    (job.job_address ?? '').toLowerCase().includes(q)
  )
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
