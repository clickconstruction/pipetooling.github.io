/**
 * ITB / submission links on a bid (`bids.itb_links`, jsonb) — parsing the
 * stored value and deriving a human label per URL (PlanHub, BuildingConnected,
 * …) for the preview chips and form rows.
 */

/** Tolerant parse of the jsonb column value into a clean list of URL strings. */
export function parseItbLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
}

/** Serialize form rows back to the column shape: trimmed, blanks dropped. */
export function serializeItbLinks(links: string[]): string[] {
  return links.map((l) => l.trim()).filter(Boolean)
}

const KNOWN_HOST_LABELS: [pattern: string, label: string][] = [
  ['planhub', 'PlanHub'],
  ['buildingconnected', 'BuildingConnected'],
  ['procore', 'Procore'],
  ['constructconnect', 'ConstructConnect'],
  ['buildingblok', 'BuildingBlok'],
  ['pantera', 'Pantera'],
  ['smartbid', 'SmartBid'],
]

/**
 * Friendly label for an ITB URL: a known portal name when the hostname
 * matches, else the bare hostname (no www.), else the raw string.
 */
export function itbLinkLabel(url: string): string {
  const trimmed = url.trim()
  let host = ''
  try {
    host = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase()
  } catch {
    return trimmed
  }
  for (const [pattern, label] of KNOWN_HOST_LABELS) {
    if (host.includes(pattern)) return label
  }
  return host.replace(/^www\./, '') || trimmed
}

/**
 * Labels for a list of links, deduped for display: a second PlanHub link
 * becomes "PlanHub 2" so two chips never read identically.
 */
export function itbLinkLabels(links: string[]): string[] {
  const counts = new Map<string, number>()
  return links.map((url) => {
    const base = itbLinkLabel(url)
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    return n === 1 ? base : `${base} ${n}`
  })
}
