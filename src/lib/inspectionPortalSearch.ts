/** City-first search over permit portal quick links (Jobs → Inspections tab). */

export type PortalLinkForSearch = {
  label: string
  url: string
  cities: string[]
}

/** Case-insensitive substring match used for both filtering and chip highlighting. */
export function cityMatchesQuery(city: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return false
  return city.toLowerCase().includes(q)
}

/**
 * Portals matching a search query by label, any served city, or URL.
 * Empty/whitespace query returns everything (the resting state shows all portals).
 */
export function filterPortalsByQuery<T extends PortalLinkForSearch>(portals: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (q === '') return portals
  return portals.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q) ||
      p.cities.some((c) => c.toLowerCase().includes(q)),
  )
}

/** "Buda, Cibolo,  buda\nSan Marcos" → ['Buda', 'Cibolo', 'San Marcos'] (trimmed, case-insensitively deduped, order kept). */
export function parseCitiesInput(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[,\n]/)) {
    const city = raw.trim()
    if (city === '') continue
    const key = city.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(city)
  }
  return out
}

export function formatCitiesInput(cities: string[]): string {
  return cities.join(', ')
}

/**
 * Portal serving the city found in an inspection's address (case-insensitive
 * substring; the longest matching city wins so "Live Oak" beats "Oak").
 * Null when no portal's city appears in the address.
 */
export function matchPortalForInspectionAddress<T extends PortalLinkForSearch>(
  portals: T[],
  address: string | null | undefined,
): T | null {
  const addr = (address ?? '').toLowerCase()
  if (addr.trim() === '') return null
  let best: T | null = null
  let bestCityLen = 0
  for (const portal of portals) {
    for (const city of portal.cities) {
      const c = city.trim()
      if (c.length > bestCityLen && addr.includes(c.toLowerCase())) {
        best = portal
        bestCityLen = c.length
      }
    }
  }
  return best
}
