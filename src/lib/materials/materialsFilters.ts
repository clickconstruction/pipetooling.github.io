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
    filtered = filtered.filter(part => part.manufacturer === opts.filterManufacturer)
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
