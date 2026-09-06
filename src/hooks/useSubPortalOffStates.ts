import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { computePortalGlobeStates, type PortalGlobeInitialState } from '../lib/portal/portalLinkState'

/**
 * Sub-portal twin of usePortalOffStates: module-level cache of every PERSON's
 * sub-portal state — one query per session shared by every sub globe. Sub
 * links have no audiences, so rows adapt into the customer kernel's shape
 * (audience 'all') and reuse its tested verdict; the tint kernel then paints
 * both globes the same way (journey-map B18 / J21-F3). Office-only data
 * (RLS); non-office roles never mount the globe, so the query never runs
 * for them.
 */

type SubPortalLinkStateRow = { person_id: string; revoked_at: string | null }

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
      .from('sub_portal_links' as never)
      .select('person_id, revoked_at')
    if (error || !data) return
    const rows = (data as unknown as SubPortalLinkStateRow[]).map((r) => ({
      customer_id: r.person_id,
      audience: 'all',
      revoked_at: r.revoked_at,
    }))
    fetched = computePortalGlobeStates(rows)
    loaded = true
    emit()
  })()
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function read(personId: string): PortalGlobeInitialState | null {
  const local = overrides.get(personId)
  if (local) return local
  if (!loaded) return null
  return fetched.get(personId) ?? 'unminted'
}

/** Local update after a modal action (create / turn back on → 'active', turn off → 'off'). */
export function setSubPortalGlobeState(personId: string, state: PortalGlobeInitialState) {
  if (overrides.get(personId) === state) return
  const next = new Map(overrides)
  next.set(personId, state)
  overrides = next
  emit()
}

/** This person's sub-portal globe state, or null while the list-level rows load. */
export function useSubPortalGlobeState(personId: string): PortalGlobeInitialState | null {
  useEffect(ensureLoaded, [])
  return useSyncExternalStore(subscribe, () => read(personId))
}

/** True when this person's sub portal has been turned off (Person Desk's compliance line). */
export function useSubPortalLinkOff(personId: string): boolean {
  return useSubPortalGlobeState(personId) === 'off'
}
