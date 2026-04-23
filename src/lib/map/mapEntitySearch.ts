import type { MapPageEntity } from '../../hooks/useMapPageData'

/** Whitespace-tokens: every token must appear (case-insensitive) in a combined field string. */
export function mapEntityMatchesSearch(queryTrimmed: string, entity: MapPageEntity): boolean {
  if (queryTrimmed.length === 0) return true
  const haystack = [entity.kind, entity.tableLabel, entity.addressLabel, entity.sublabel, entity.meta]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const tokens = queryTrimmed
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return true
  return tokens.every((t) => haystack.includes(t))
}
