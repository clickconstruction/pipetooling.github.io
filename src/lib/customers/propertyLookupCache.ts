import { lookupPropertyRecord, type PropertyLookupOutcome } from './propertyLookupClient'
import { ownerConfirmPropertyKey } from '../../../supabase/functions/_shared/ownerConfirmPlan'

/**
 * One session cache for the parcel lookup, shared by every surface that
 * reads the appraisal roll (v2.3450): the Fix-ups list, Bill Customer's
 * owner line and the Lien desk's Needs-the-owner pane. Keyed by the
 * property (street number + street), so a job opened three ways costs one
 * call. Only a real answer — found, or a clean miss — is remembered; a
 * network error retries on the next ask.
 */

const CACHE = new Map<string, PropertyLookupOutcome>()
const INFLIGHT = new Map<string, Promise<PropertyLookupOutcome>>()

export function propertyLookupCacheKey(address: string): string {
  return ownerConfirmPropertyKey(address)
}

export function getCachedPropertyLookup(address: string): PropertyLookupOutcome | undefined {
  return CACHE.get(propertyLookupCacheKey(address))
}

export function setCachedPropertyLookup(address: string, outcome: PropertyLookupOutcome): void {
  if (outcome.ok) CACHE.set(propertyLookupCacheKey(address), outcome)
}

/** The lookup, once per property per session; concurrent asks for the same property share one call. */
export async function cachedLookupPropertyRecord(address: string): Promise<PropertyLookupOutcome> {
  const key = propertyLookupCacheKey(address)
  const hit = CACHE.get(key)
  if (hit) return hit
  const running = INFLIGHT.get(key)
  if (running) return running
  const p = lookupPropertyRecord(address)
    .then((res) => {
      if (res.ok) CACHE.set(key, res)
      return res
    })
    .finally(() => INFLIGHT.delete(key))
  INFLIGHT.set(key, p)
  return p
}

/** Test seam: forget every answer. */
export function resetPropertyLookupCache(): void {
  CACHE.clear()
  INFLIGHT.clear()
}
