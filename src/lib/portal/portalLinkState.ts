/**
 * Pure kernel for portal-link state (portal train v2.2001): which customers
 * have a TURNED-OFF portal link (rows exist, none active) — powering the red
 * globe — and the per-audience link history shown under the modal's gear.
 */

export type PortalLinkRow = {
  customer_id?: string
  audience: string
  created_at: string
  revoked_at: string | null
  created_by?: string | null
}

export function portalOffKey(customerId: string, audience: string): string {
  return `${customerId}:${audience}`
}

/**
 * A (customer, audience) pair is "off" when links were minted for it but every
 * one is revoked — someone explicitly turned it off (or rotated and then
 * turned off). Never-minted pairs are NOT off; they simply have no link yet.
 */
export function computePortalOffKeys(
  rows: Array<Pick<PortalLinkRow, 'customer_id' | 'audience' | 'revoked_at'>>,
): string[] {
  const hasActive = new Set<string>()
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.customer_id) continue
    const key = portalOffKey(r.customer_id, r.audience)
    seen.add(key)
    if (r.revoked_at === null) hasActive.add(key)
  }
  return [...seen].filter((k) => !hasActive.has(k))
}

/**
 * Customers whose MAIN portal is off — powering the red globe since the
 * merged 'all' audience (custom-links train). When 'all' rows exist they are
 * authoritative: off iff none is active (turning off just a scoped link never
 * paints red). Customers with only legacy 'customer'/'gc' rows are off when
 * every row is revoked — the pre-'all' deliberate-off state, which the modal
 * must NOT silently revive by minting 'all'.
 */
export function computePortalMainOffCustomerIds(
  rows: Array<Pick<PortalLinkRow, 'customer_id' | 'audience' | 'revoked_at'>>,
): string[] {
  const byCustomer = new Map<string, Array<Pick<PortalLinkRow, 'audience' | 'revoked_at'>>>()
  for (const r of rows) {
    if (!r.customer_id) continue
    const list = byCustomer.get(r.customer_id) ?? []
    list.push(r)
    byCustomer.set(r.customer_id, list)
  }
  const off: string[] = []
  for (const [customerId, list] of byCustomer) {
    const allRows = list.filter((r) => r.audience === 'all')
    const isOff =
      allRows.length > 0
        ? allRows.every((r) => r.revoked_at !== null)
        : list.every((r) => r.revoked_at !== null)
    if (isOff) off.push(customerId)
  }
  return off
}

export type PortalHistoryEntry = {
  createdAt: string
  revokedAt: string | null
  createdBy: string | null
  /** How this link's life ended (or 'active' if it hasn't). */
  outcome: 'active' | 'rotated' | 'turned-off'
}

/**
 * History for ONE audience's rows, newest first. A revoked link counts as
 * "rotated" when a successor link was created within a minute of the
 * revocation (rotation revokes + re-mints in one transaction); otherwise it
 * was turned off outright.
 */
export function buildPortalLinkHistory(rows: PortalLinkRow[]): PortalHistoryEntry[] {
  return buildHistoryForOneAudience(rows)
}

function buildHistoryForOneAudience(rows: PortalLinkRow[]): PortalHistoryEntry[] {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return sorted.map((row) => {
    let outcome: PortalHistoryEntry['outcome'] = 'active'
    if (row.revoked_at !== null) {
      const revokedMs = Date.parse(row.revoked_at)
      const succeeded = sorted.some(
        (other) =>
          other !== row &&
          Math.abs(Date.parse(other.created_at) - revokedMs) < 60_000 &&
          Date.parse(other.created_at) >= revokedMs - 1_000,
      )
      outcome = succeeded ? 'rotated' : 'turned-off'
    }
    return {
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      createdBy: row.created_by ?? null,
      outcome,
    }
  })
}

export type PortalSlugEventRow = {
  event: string
  slug: string | null
  created_at: string
  created_by: string | null
}

export type PortalTimelineEntry =
  | {
      kind: 'link'
      at: string
      createdBy: string | null
      audience: string
      outcome: PortalHistoryEntry['outcome']
      revokedAt: string | null
    }
  | {
      kind: 'slug'
      at: string
      createdBy: string | null
      event: 'created' | 'changed' | 'locked'
      slug: string | null
    }

/**
 * The modal's History row: link lifecycles across ALL audiences (rotation
 * inferred per audience — an 'all' mint never relabels a scoped revoke) merged
 * with the address (slug) events, newest first.
 */
export function buildPortalTimeline(
  links: PortalLinkRow[],
  slugEvents: PortalSlugEventRow[],
): PortalTimelineEntry[] {
  const entries: PortalTimelineEntry[] = []
  const byAudience = new Map<string, PortalLinkRow[]>()
  for (const row of links) {
    const list = byAudience.get(row.audience) ?? []
    list.push(row)
    byAudience.set(row.audience, list)
  }
  for (const [audience, rows] of byAudience) {
    for (const h of buildPortalLinkHistory(rows)) {
      entries.push({
        kind: 'link',
        at: h.createdAt,
        createdBy: h.createdBy,
        audience,
        outcome: h.outcome,
        revokedAt: h.revokedAt,
      })
    }
  }
  for (const ev of slugEvents) {
    if (ev.event !== 'created' && ev.event !== 'changed' && ev.event !== 'locked') continue
    entries.push({
      kind: 'slug',
      at: ev.created_at,
      createdBy: ev.created_by,
      event: ev.event,
      slug: ev.slug,
    })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

export type PortalGlobeInitialState = 'unminted' | 'active' | 'off' | 'legacy-active'

/**
 * What the globe modal opens INTO for one customer, from their link rows
 * (journey-map Tier-1 #14(b), J21-F7 — opening a never-minted customer's
 * globe used to mint a live portal link with no confirm and no toast):
 *  - 'active'        an 'all' link is live → show it, mint nothing
 *  - 'off'           deliberately turned off (kernel above) → show the off state, mint nothing
 *  - 'legacy-active' only pre-merge scoped rows, at least one live → the merged
 *                    link is that link's continuation (unchanged behaviour)
 *  - 'unminted'      no rows at all → "No portal link yet" — the mint waits for
 *                    an explicit "Create their link"
 */
export function portalGlobeInitialState(
  rows: Array<Pick<PortalLinkRow, 'customer_id' | 'audience' | 'revoked_at'>>,
  customerId: string,
): PortalGlobeInitialState {
  const mine = rows.filter((r) => !r.customer_id || r.customer_id === customerId)
  if (mine.some((r) => r.audience === 'all' && r.revoked_at === null)) return 'active'
  if (mine.length === 0) return 'unminted'
  if (computePortalMainOffCustomerIds(mine.map((r) => ({ ...r, customer_id: r.customer_id ?? customerId }))).includes(customerId)) return 'off'
  return mine.some((r) => r.revoked_at === null) ? 'legacy-active' : 'unminted'
}
