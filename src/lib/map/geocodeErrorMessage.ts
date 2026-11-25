/**
 * The line a person reads when the map services did not place an address: the Bid Board's sheet, the Map page's
 * list and its Try again, the geocode review window, Quickfill's schedule, the home map window and two Settings
 * kernels. Shared, so the words are written once, to `src/lib/plainWords.ts`'s rules: one sentence that says what
 * happened, and a second only when it says what to do.
 *
 * The `detail` a look-up carries is the services' own account of it: which one answered what, a status code, a
 * reply that would not parse. It is never drawn (punch list #441: a miss kept before v2.8512 still holds
 * *OpenStreetMap (Nominatim) HTTP 403*, and a plain reader met it on the sheet). One thing in it is worth a
 * person's read and is said in plain words: a service that placed the address outside the lower 48 states, which
 * the app refuses (`usPointBox.ts`). The raw detail stays in the function's answer and in the kept miss's row.
 */
const WORDS: Record<string, string> = {
  not_found: 'No map service could find this address.',
  upstream: 'A map service had a problem and did not place this address. Try again in a minute.',
  google_upstream: 'A map service had a problem and did not place this address. Try again in a minute.',
  census_upstream: 'A map service had a problem and did not place this address. Try again in a minute.',
  invalid_coordinates: 'A map service sent back a place the app could not read.',
  google_denied: 'Google refused the look-up. A developer needs to check the map key.',
  google_over_query: 'Google is taking no more look-ups right now. Try again later.',
  google_invalid: 'Google could not read this address. Check how it is written.',
  google_unknown: 'Google could not place this address.',
  google_no_results: 'Google could not place this address.',
  google_unconfigured: 'Google look-ups are not set up yet. A developer needs to add the map key.',
}

/** A code this file does not know: said as a miss, never as the code itself. */
const UNKNOWN_WORDS = 'The map services could not place this address.'

const OUTSIDE_WORDS = 'A map service placed this address outside the lower 48 states. Check the city, the state and the ZIP.'

/** The services' words for a point the app refused as outside the country (`refusePointOutsideUs`). */
const OUTSIDE_DETAIL = /outside the lower 48/i

export function mapGeocodeErrorMessage(errorCode: string, detail?: string | null): string {
  if (errorCode === 'not_found' && detail && OUTSIDE_DETAIL.test(detail)) return OUTSIDE_WORDS
  return WORDS[errorCode] ?? UNKNOWN_WORDS
}
