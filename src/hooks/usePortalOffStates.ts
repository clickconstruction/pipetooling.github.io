import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { computePortalGlobeStates, type PortalGlobeInitialState } from '../lib/portal/portalLinkState'

/**
 * Module-level cache of every customer's portal-link STATE — one small query
 * per session shared by every globe button, so 400 list rows never mean 400
 * queries. It began as the red-globe "turned off" set (portal train v2.2001);
 * since journey-map B18 (J21-F3) it carries the full verdict the modal opens
 * into — 'unminted' / 'active' / 'legacy-active' / 'off' — so a shared
 * portal no longer looks identical to one that was never created. `null`
 * means the rows have not loaded yet (the globe stays neutral grey).
 *
 * The globe modal updates the cache locally after create / turn-off / turn
 * back on so the list repaints without a refetch; local updates survive the
 * initial fetch resolving late. Office-only data (RLS): non-office roles never
 * mount a globe, so the query never runs for them.
 */

let loaded = false
let fetched = new Map<string, PortalGlobeInitialState>()
let overrides = new Map<string, PortalGlobeInitialState>()
let loadStarted = false
const subscribers = new Set<() => void>()

function emit() {
  for (const cb of subscribers) cb()
}

function ensureLoaded() {
  if (loadStarted) return
  loadStarted = true
  void (async () => {
    const { data, error } = await supabase
      .from('customer_portal_links')
      .select('customer_id, audience, revoked_at')
    if (error || !data) return
    fetched = computePortalGlobeStates(data)
    loaded = true
    emit()
  })()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function read(customerId: string): PortalGlobeInitialState | null {
  const local = overrides.get(customerId)
  if (local) return local
  if (!loaded) return null
  return fetched.get(customerId) ?? 'unminted'
}

/**
 * Local update after a modal action (create / turn back on → 'active',
 * turn off → 'off', or the verdict the modal just loaded). Only the MAIN
 * portal's state moves the globe — scoped-link actions should not call this.
 */
export function setPortalGlobeState(customerId: string, state: PortalGlobeInitialState) {
  if (overrides.get(customerId) === state) return
  const next = new Map(overrides)
  next.set(customerId, state)
  overrides = next
  emit()
}

/** This customer's globe state, or null while the list-level rows load. */
export function usePortalGlobeState(customerId: string): PortalGlobeInitialState | null {
  useEffect(ensureLoaded, [])
  return useSyncExternalStore(subscribe, () => read(customerId))
}
