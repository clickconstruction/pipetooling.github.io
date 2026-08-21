import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { computePortalOffKeys, portalOffKey } from '../lib/portal/portalLinkState'

/**
 * Module-level cache of which (customer, audience) portal links are TURNED
 * OFF — one small query per session shared by every globe button, so 400 list
 * rows never mean 400 queries. The globe modal updates the cache locally
 * after revoke / re-mint so reds appear without a refetch. Office-only data
 * (RLS): non-office roles never mount a globe, so the query never runs for
 * them.
 */

let offKeys = new Set<string>()
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
    offKeys = new Set(computePortalOffKeys(data))
    emit()
  })()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

/** Local update after a modal action (revoke → off, mint → back on). */
export function setPortalLinkOff(customerId: string, audience: string, off: boolean) {
  const key = portalOffKey(customerId, audience)
  if (off === offKeys.has(key)) return
  const next = new Set(offKeys)
  if (off) next.add(key)
  else next.delete(key)
  offKeys = next
  emit()
}

/** True when ANY audience's link for this customer has been turned off. */
export function usePortalLinkOff(customerId: string): boolean {
  useEffect(ensureLoaded, [])
  return useSyncExternalStore(
    subscribe,
    () => offKeys.has(portalOffKey(customerId, 'customer')) || offKeys.has(portalOffKey(customerId, 'gc')),
  )
}
