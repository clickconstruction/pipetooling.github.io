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
