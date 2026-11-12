/**
 * The directions link for an address: Google Maps' directions endpoint, which needs no key and opens the phone's maps
 * app. Its own file, with no import, so a public page (the trade partner's portal, punch list #205) can draw it without
 * reaching the Supabase client that `fieldJobLookup.ts`'s neighbours pull in. `fieldJobLookup.ts` re-exports it, so the
 * field job card's callers are unchanged.
 */

/** Google Maps directions link for an address; null when there is nothing to route to. */
export function directionsUrlForAddress(address: string | null | undefined): string | null {
  const a = (address ?? '').trim()
  if (!a) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`
}

/**
 * Google Maps directions link for a point (punch list #328, a task's place): a spot on a property has no address to
 * route to. On a road the phone routes there. Off a road it routes to the nearest one, and the place's own map does the
 * rest. Null for anything that is not two finite numbers on the globe.
 */
export function directionsUrlForPoint(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
}
