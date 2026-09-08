/**
 * The company office anchor for map cards (v2.3162): `office_address_v1` when
 * set, else the Map default view center — the same resolution the bid form's
 * Distance to Office auto-fill uses (`resolveOfficeAnchor`). One app setting,
 * fetched once per page and shared by every card that asks; a failed read is
 * simply no anchor.
 */
import { useEffect, useState } from 'react'
import { resolveOfficeAnchor, type OfficeAnchor } from '../lib/officeAddressSettings'

let officeAnchorPromise: Promise<OfficeAnchor | null> | null = null

function loadOfficeAnchor(): Promise<OfficeAnchor | null> {
  if (!officeAnchorPromise) officeAnchorPromise = resolveOfficeAnchor().catch(() => null)
  return officeAnchorPromise
}

export function resetOfficeAnchorCacheForTests(): void {
  officeAnchorPromise = null
}

export function useOfficeAnchor(enabled: boolean): OfficeAnchor | null {
  const [anchor, setAnchor] = useState<OfficeAnchor | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void loadOfficeAnchor().then((a) => {
      if (!cancelled) setAnchor(a)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return anchor
}
