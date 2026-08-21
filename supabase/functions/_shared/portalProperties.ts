/**
 * Property list for the portal's Request-a-visit picker (portal custom-links
 * train, v2.2037). Customers pick the PROPERTY, never a job number or an
 * internal job name: non-paid jobs with an address collapse to one row per
 * address, labeled street + city with the trailing state/zip stripped.
 * Dependency-free — shared by the customer-portal edge function and
 * unit-tested from vitest (src/lib/portal/portalProperties.test.ts).
 */

export type PropertyJobRow = {
  id: string
  status: string | null
  job_address: string | null
  hcp_number: string | null
  click_number: string | null
}

export type PortalProperty = {
  /** Newest job at this address — what the office's dispatch inbox receives. */
  jobId: string
  street: string
  city: string | null
}

/** "150 E Sonterra Blvd 200B San Antonio, TX 78258" → street + city, zip/state dropped.
 * The state-anchored zip accepts 4-6 digits — real data holds typos like "TX 7866". */
export function splitAddress(address: string): { street: string; city: string | null } {
  let a = address.replace(/\s+/g, ' ').trim().replace(/[,\s]+$/g, '')
  // Drop a trailing state + optional zip (with or without a comma before it).
  a = a.replace(/,?\s+(TX|Texas)\b\.?(\s+\d{4,6}(-\d{4})?)?$/i, '')
  a = a.replace(/,?\s+\d{5}(-\d{4})?$/, '')
  const comma = a.lastIndexOf(',')
  if (comma > 0 && comma < a.length - 1) {
    return { street: a.slice(0, comma).trim(), city: a.slice(comma + 1).trim() || null }
  }
  // No comma: treat a trailing known-word-free split as unknowable — keep it all as street.
  return { street: a, city: null }
}

/** Grouping key over the CLEANED street+city — so comma/zip variants of one
 * address merge — case/whitespace/punctuation-insensitive but never fuzzy:
 * "200B" suites must not merge with their neighbors. */
export function normalizeAddressKey(address: string): string {
  const { street, city } = splitAddress(address)
  return `${street} ${city ?? ''}`.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

function jobNumberValue(j: PropertyJobRow): number {
  const n = parseInt(((j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * One row per distinct address across the statement's jobs (paid jobs and
 * address-less jobs drop out), newest job first — both for the row order and
 * for which job stands behind each address.
 */
export function buildPortalProperties(jobs: PropertyJobRow[]): PortalProperty[] {
  const byKey = new Map<string, PropertyJobRow>()
  for (const j of jobs) {
    if (j.status === 'paid') continue
    const addr = (j.job_address ?? '').replace(/\s+/g, ' ').trim()
    if (!addr) continue
    const key = normalizeAddressKey(addr)
    const held = byKey.get(key)
    if (!held || jobNumberValue(j) > jobNumberValue(held)) byKey.set(key, j)
  }
  return [...byKey.values()]
    .sort((a, b) => jobNumberValue(b) - jobNumberValue(a))
    .map((j) => {
      const { street, city } = splitAddress((j.job_address ?? '').trim())
      return { jobId: j.id, street, city }
    })
    .filter((p) => p.street.length > 0)
}
