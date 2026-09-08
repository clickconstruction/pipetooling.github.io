import { normalizeAddressForMatch } from '../jobs/lienProperty'

/**
 * Properties ↔ jobs (customer properties train, PR 3 — v2.3009). The job
 * ledger already knows every address the company has worked at for a
 * customer; this kernel turns that into (a) a job count per saved property
 * and (b) job addresses that are not saved as a property yet, offered as
 * one-click "Add as property" rows. Pure; the section fetches the rows.
 */

export type PropertyLike = { id: string; address: string }
export type JobAddressLike = { id: string; job_address: string | null; customer_address_id: string | null }

/** Street line only ("412 gruene rd"): the same rule `suggestCustomerAddressForJob` uses for its fallback. */
export function propertyStreetKey(address: string): string {
  return normalizeAddressForMatch(address).split(',')[0]?.trim() ?? ''
}

/**
 * Jobs at each property: linked by `customer_address_id`, plus unlinked jobs
 * whose street line matches (a job created before the property existed).
 */
export function jobCountsByProperty(properties: PropertyLike[], jobs: JobAddressLike[]): Map<string, number> {
  const counts = new Map<string, number>()
  const byStreet = new Map<string, string>()
  for (const p of properties) {
    counts.set(p.id, 0)
    const key = propertyStreetKey(p.address)
    if (key && !byStreet.has(key)) byStreet.set(key, p.id)
  }
  for (const j of jobs) {
    let pid: string | null = j.customer_address_id && counts.has(j.customer_address_id) ? j.customer_address_id : null
    if (!pid) {
      const key = propertyStreetKey(j.job_address ?? '')
      pid = key ? (byStreet.get(key) ?? null) : null
    }
    if (pid) counts.set(pid, (counts.get(pid) ?? 0) + 1)
  }
  return counts
}

export type PropertySuggestion = { address: string; jobCount: number }

/**
 * Job addresses with no saved property, one row per street line, spelled the
 * way the most recent job spells it (jobs are passed newest first), most
 * jobs first.
 */
export function suggestPropertiesFromJobs(properties: PropertyLike[], jobs: JobAddressLike[]): PropertySuggestion[] {
  const saved = new Set(properties.map((p) => propertyStreetKey(p.address)).filter(Boolean))
  const groups = new Map<string, PropertySuggestion>()
  for (const j of jobs) {
    if (j.customer_address_id) continue
    const raw = (j.job_address ?? '').trim()
    const key = propertyStreetKey(raw)
    if (!key || saved.has(key)) continue
    const g = groups.get(key)
    if (g) g.jobCount += 1
    else groups.set(key, { address: raw, jobCount: 1 })
  }
  return [...groups.values()].sort((a, b) => b.jobCount - a.jobCount || a.address.localeCompare(b.address))
}
