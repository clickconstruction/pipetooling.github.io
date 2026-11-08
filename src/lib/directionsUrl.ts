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
