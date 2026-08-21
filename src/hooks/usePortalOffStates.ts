import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { computePortalMainOffCustomerIds } from '../lib/portal/portalLinkState'

/**
 * Module-level cache of which customers' MAIN portal is TURNED OFF — one
 * small query per session shared by every globe button, so 400 list rows
 * never mean 400 queries. Since the merged 'all' audience (custom-links
 * train), red means the merged portal is off: every 'all' row revoked, or —
 * for customers with only legacy 'customer'/'gc' rows — every row revoked.
 * Turning off just a scoped "Separate view" link never paints red. The globe
 * modal updates the cache locally after turn-off / re-mint so reds appear
 * without a refetch. Office-only data (RLS): non-office roles never mount a
 * globe, so the query never runs for them.
 */

let offIds = new Set<string>()
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
    offIds = new Set(computePortalMainOffCustomerIds(data))
    emit()
  })()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

/**
 * Local update after a modal action (turn off → red, mint/turn back on →
 * clear). Only the main portal's state moves the red globe, so callers pass
 * the customer-level verdict — scoped-link actions should not call this.
 */
export function setPortalMainOff(customerId: string, off: boolean) {
  if (off === offIds.has(customerId)) return
  const next = new Set(offIds)
  if (off) next.add(customerId)
  else next.delete(customerId)
  offIds = next
  emit()
}

/** True when this customer's main portal has been turned off. */
export function usePortalLinkOff(customerId: string): boolean {
  useEffect(ensureLoaded, [])
  return useSyncExternalStore(subscribe, () => offIds.has(customerId))
}
