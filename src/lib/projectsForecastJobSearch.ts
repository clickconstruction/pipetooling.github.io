/**
 * Projects → Forecast: client-side search filter for the All Stages job rows.
 *
 * Mirrors [`projectsJobHistoryBarSearch.ts`](src/lib/projectsJobHistoryBarSearch.ts) but
 * targets `ForecastJob`-shaped inputs (which carry `hcp_number`, `job_name`, `job_address`,
 * `service_type_id`, `project_id`, plus optional `project_name`). The matched fields:
 *
 *   1. The full display label `{prefix}{hcp_number} · {job_name}`.
 *   2. The bare HCP number.
 *   3. The prefix + raw number (so typing `JP740` matches).
 *   4. The raw job name.
 *   5. The raw job address.
 *   6. The project name (so typing a project name surfaces every job on it).
 *
 * Empty query → no filtering (returns the original array reference).
 */

import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from './ledgerDisplayPrefixes'

export type ForecastJobSearchInput = {
  hcp_number: string
  job_name: string
  job_address: string | null
  service_type_id: string | null
  project_name?: string | null
}

export function normalizeForecastJobSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (trimmed.length === 0) return ''
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

export function forecastJobMatchesSearch<T extends ForecastJobSearchInput>(
  job: T,
  query: string,
  prefixMap: LedgerPrefixMap,
): boolean {
  const q = normalizeForecastJobSearchQuery(query)
  if (q.length === 0) return true

  const prefix = resolveJobLedgerPrefix(job.service_type_id, prefixMap)
  const hcpLabel = formatJobLedgerNumberLabel(prefix, job.hcp_number)
  const jobName = (job.job_name ?? '').trim()
  const jobAddress = (job.job_address ?? '').trim()
  const projectName = (job.project_name ?? '').trim()

  const fields = [
    `${hcpLabel} · ${jobName || '—'}`,
    hcpLabel,
    job.hcp_number ?? '',
    jobName,
    jobAddress,
    projectName,
  ]

  for (const f of fields) {
    if (f && f.toLowerCase().includes(q)) return true
  }
  return false
}

export function filterForecastJobsBySearch<T extends ForecastJobSearchInput>(
  jobs: readonly T[],
  query: string,
  prefixMap: LedgerPrefixMap,
): readonly T[] {
  if (normalizeForecastJobSearchQuery(query).length === 0) return jobs
  return jobs.filter((j) => forecastJobMatchesSearch(j, query, prefixMap))
}
