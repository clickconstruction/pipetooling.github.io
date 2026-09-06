/**
 * Pure client-side filters for the Materials page part/assembly pickers and
 * the Parts Book Load-All view — extracted from Materials.tsx (Stage A of the
 * Materials decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md).
 *
 * The functions are generic over structural shapes so both the page's
 * `PartWithPrices` / `MaterialTemplate` rows and test fixtures type-check.
 */

type PartLike = {
  name: string
  manufacturer?: string | null
  notes?: string | null
  part_type?: { name?: string | null } | null
}

type TemplateLike = {
  name: string
  description?: string | null
  assembly_type_id?: string | null
}

/** Filter parts by search query (name, manufacturer, part_type, notes) — used by part pickers. */
export function filterPartsByQuery<T extends PartLike>(partList: T[], query: string, limit = 50): T[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return partList.slice(0, limit)
  return partList
    .filter(p => [p.name, p.manufacturer, p.part_type?.name, p.notes].some(f => (f || '').toLowerCase().includes(q)))
    .slice(0, limit)
}

/** Filter templates by search query (name, description, assembly type) — used by nested assembly pickers. */
export function filterTemplatesByQuery<T extends TemplateLike>(
  templateList: T[],
  query: string,
  assemblyTypes: Array<{ id: string; name: string }>,
  limit = 50
): T[] {
  const q = (query || '').trim().toLowerCase()
  return templateList
    .filter(t => {
      const typeName = t.assembly_type_id ? assemblyTypes.find(at => at.id === t.assembly_type_id)?.name ?? '' : ''
      if (!q) return true
      return [t.name, t.description, typeName].some(f => (f || '').toLowerCase().includes(q))
    })
    .slice(0, limit)
}

type LoadAllPartLike = PartLike & {
  part_type_id?: string | null
  prices: unknown[]
}

/**
 * The Parts Book Load-All display pipeline (was an inline IIFE): exact
 * part-type / manufacturer filters, then substring search, then the optional
 * price-count ascending sort (ties by name). Without the sort flag the
 * filtered array keeps its input order.
 */
export function computeLoadAllDisplayParts<T extends LoadAllPartLike>(
  allParts: T[],
  opts: {
    filterPartTypeId: string
    filterManufacturer: string
    clientSearchQuery: string
    sortByPriceCountAsc: boolean
  }
): T[] {
  // Filter by part type
  let filtered = allParts
  if (opts.filterPartTypeId) {
    filtered = filtered.filter(part => part.part_type_id === opts.filterPartTypeId)
  }
  if (opts.filterManufacturer) {
    filtered = filtered.filter(part => manufacturerMatches(part.manufacturer, opts.filterManufacturer))
  }
  // Filter by search query
  if (opts.clientSearchQuery) {
    const q = opts.clientSearchQuery.toLowerCase()
    filtered = filtered.filter(part =>
      part.name.toLowerCase().includes(q) ||
      part.manufacturer?.toLowerCase().includes(q) ||
      part.part_type?.name?.toLowerCase().includes(q) ||
      part.notes?.toLowerCase().includes(q)
    )
  }
  // Sort by price count if active
  if (opts.sortByPriceCountAsc) {
    return [...filtered].sort((a, b) => {
      return a.prices.length - b.prices.length || a.name.localeCompare(b.name)
    })
  }
  return filtered
}

/** Case-fold + trim key for a manufacturer name; `''` for blank/null. */
export function manufacturerKey(manufacturer: string | null | undefined): string {
  return (manufacturer ?? '').trim().toLowerCase()
}

/** Case-insensitive, whitespace-tolerant equality — "WATTS" is "watts" (v2.2903, J29-adj-2). */
export function manufacturerMatches(partManufacturer: string | null | undefined, filter: string): boolean {
  const f = manufacturerKey(filter)
  if (!f) return true
  return manufacturerKey(partManufacturer) === f
}

/**
 * One option per manufacturer regardless of how the rows spell it. The label is
 * the most common spelling (ties → first seen), sorted A→Z.
 */
export function manufacturerFacetOptions<T extends { manufacturer?: string | null }>(parts: T[]): string[] {
  const spellings = new Map<string, Map<string, number>>()
  for (const p of parts) {
    const raw = (p.manufacturer ?? '').trim()
    const key = raw.toLowerCase()
    if (!key) continue
    let counts = spellings.get(key)
    if (!counts) {
      counts = new Map()
      spellings.set(key, counts)
    }
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }
  const labels: string[] = []
  for (const counts of spellings.values()) {
    let best = ''
    let bestN = -1
    for (const [spelling, n] of counts) {
      if (n > bestN) {
        best = spelling
        bestN = n
      }
    }
    labels.push(best)
  }
  return labels.sort((a, b) => a.localeCompare(b))
}

/**
 * PostgREST `ilike` pattern that matches a manufacturer name exactly but
 * case-insensitively: `%`, `_` and `\` are escaped so they match literally.
 * (`*` is PostgREST's own wildcard alias and cannot be escaped — a literal `*`
 * in a name widens the match, which is harmless here.)
 */
export function manufacturerIlikePattern(value: string): string {
  return value.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)
}
