/** Batching for the address_geocodes cache lookup on the Map page.
 *
 * The lookup filters with `.in('address_normalized', keys)`, which PostgREST
 * receives in the GET query string. Sending every key at once started failing
 * with 400 Bad Request around ~600 addresses (~24k raw filter chars, more once
 * URL-encoded) — the request line outgrew the server's URL limit. Splitting on
 * both key count and a raw-character budget keeps each request comfortably
 * small no matter how the address list grows.
 */

export const GEOCODE_CACHE_BATCH_MAX_KEYS = 50
export const GEOCODE_CACHE_BATCH_MAX_CHARS = 4000

export function batchGeocodeCacheKeys(
  keys: string[],
  maxKeys: number = GEOCODE_CACHE_BATCH_MAX_KEYS,
  maxChars: number = GEOCODE_CACHE_BATCH_MAX_CHARS
): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let currentChars = 0
  for (const key of keys) {
    if (current.length > 0 && (current.length >= maxKeys || currentChars + key.length > maxChars)) {
      batches.push(current)
      current = []
      currentChars = 0
    }
    current.push(key)
    currentChars += key.length
  }
  if (current.length > 0) batches.push(current)
  return batches
}
