import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { computePortalMainOffCustomerIds } from '../lib/portal/portalLinkState'

/**
 * Sub-portal twin of usePortalOffStates: module-level cache of which PEOPLE's
 * sub portal is TURNED OFF (rows exist and every one is revoked) — one query
 * per session shared by every sub globe. Sub links have no audiences, so rows
 * adapt into the customer kernel's shape (audience 'all') and reuse its
 * tested verdict. Office-only data (RLS); non-office roles never mount the
 * globe, so the query never runs for them.
 */

type SubPortalLinkStateRow = { person_id: string; revoked_at: string | null }

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
      .from('sub_portal_links' as never)
      .select('person_id, revoked_at')
    if (error || !data) return
    const rows = (data as unknown as SubPortalLinkStateRow[]).map((r) => ({
      customer_id: r.person_id,
      audience: 'all',
      revoked_at: r.revoked_at,
    }))
    offIds = new Set(computePortalMainOffCustomerIds(rows))
    emit()
  })()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

/** Local update after a modal action (turn off → red, mint → clear). */
export function setSubPortalOff(personId: string, off: boolean) {
  if (off === offIds.has(personId)) return
  const next = new Set(offIds)
  if (off) next.add(personId)
  else next.delete(personId)
  offIds = next
  emit()
}

/** True when this person's sub portal has been turned off. */
export function useSubPortalLinkOff(personId: string): boolean {
  useEffect(ensureLoaded, [])
  return useSyncExternalStore(subscribe, () => offIds.has(personId))
}
