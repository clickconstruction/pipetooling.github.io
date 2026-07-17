/**
 * Per-source success rollup for the Prospects → Team hiring board.
 *
 * `source` is free text on each candidate ("referral", "Indeed", "walk-in", ...),
 * so rows group case-/whitespace-insensitively to keep "Referral" and "referral "
 * from splitting the stats. Success = hires; the rate is hired / (hired + passed)
 * — measured against decided candidates only, so a source with ten undecided
 * people isn't punished for being new.
 */

export type TeamProspectSourceInput = {
  source: string | null
  status: string
}

export type TeamProspectSourceSummaryRow = {
  /** Normalized grouping key ('' for blank source). */
  key: string
  /** Display label: first-seen original spelling, or '(no source)'. */
  label: string
  total: number
  active: number
  hired: number
  passed: number
  /** hired / (hired + passed); null when nobody from this source has been decided yet. */
  hireRate: number | null
}

export const NO_SOURCE_LABEL = '(no source)'

function normalizeSourceKey(source: string | null): string {
  return (source ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Distinct source spellings (first-seen casing) for autocomplete, alphabetical. */
export function distinctTeamProspectSources(rows: TeamProspectSourceInput[]): string[] {
  const byKey = new Map<string, string>()
  for (const row of rows) {
    const key = normalizeSourceKey(row.source)
    if (!key || byKey.has(key)) continue
    byKey.set(key, (row.source ?? '').trim().replace(/\s+/g, ' '))
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Roll up candidates per source: most hires first, then most candidates, then A–Z. */
export function summarizeTeamProspectSources(rows: TeamProspectSourceInput[]): TeamProspectSourceSummaryRow[] {
  const byKey = new Map<string, TeamProspectSourceSummaryRow>()
  for (const row of rows) {
    const key = normalizeSourceKey(row.source)
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        key,
        label: key === '' ? NO_SOURCE_LABEL : (row.source ?? '').trim().replace(/\s+/g, ' '),
        total: 0,
        active: 0,
        hired: 0,
        passed: 0,
        hireRate: null,
      }
      byKey.set(key, entry)
    }
    entry.total += 1
    if (row.status === 'hired') entry.hired += 1
    else if (row.status === 'passed') entry.passed += 1
    else entry.active += 1
  }
  const out = [...byKey.values()]
  for (const entry of out) {
    const decided = entry.hired + entry.passed
    entry.hireRate = decided > 0 ? entry.hired / decided : null
  }
  out.sort((a, b) => {
    if (a.hired !== b.hired) return b.hired - a.hired
    if (a.total !== b.total) return b.total - a.total
    return a.label.localeCompare(b.label)
  })
  return out
}
