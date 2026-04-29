import { normalizePersonNameKey } from './personNameKey'

type WithAttribution = { attributionDisplayName: string | null }

/** Attributed person rows: Mercury line must have a non-empty attribution match. */
export function filterJobSummaryMercuryRowsForPersonName<T extends WithAttribution>(
  rows: T[],
  displayName: string,
): T[] {
  const k = normalizePersonNameKey(displayName)
  return rows.filter((r) => {
    const a = (r.attributionDisplayName ?? '').trim()
    if (!a) return false
    return normalizePersonNameKey(a) === k
  })
}

export function filterJobSummaryMercuryRowsUnattributed<T extends WithAttribution>(rows: T[]): T[] {
  return rows.filter((r) => !(r.attributionDisplayName ?? '').trim())
}

/** Mercury lines attributed to any of the given display names (e.g. person-summary filter). */
export function filterJobSummaryMercuryRowsForPersonNames<T extends WithAttribution>(
  rows: T[],
  displayNames: string[],
): T[] {
  if (displayNames.length === 0) return []
  const keys = new Set(displayNames.map((d) => normalizePersonNameKey(d)))
  return rows.filter((r) => {
    const a = (r.attributionDisplayName ?? '').trim()
    if (!a) return false
    return keys.has(normalizePersonNameKey(a))
  })
}
