/**
 * Keeps the live smoke suite off Google's paid APIs (v2.8049).
 *
 * The E2E smoke suite (`e2e/`, docs/E2E_SMOKE.md) signs in to the live site after every deploy and
 * nightly, so every Google map it opens and every address it makes the app place is billed as real
 * use. Read on 2026-11-20: on the days the suite reached no page the live site loaded 4 to 19 Google
 * maps a day, and 100 to 460 once it came back, weekends included; its runs also made two thirds of
 * November's geocoder calls. `e2e/fixtures.ts` stops every request this module names before it
 * leaves the browser, so a run asks Google for nothing and its maps fall back to OpenStreetMap the
 * way they do for a person whose Google fails.
 *
 * Two kinds of request reach Google:
 * - the page's own, to Google's map hosts: the Maps JavaScript API and what it loads, a static map,
 *   a Street View picture;
 * - a call to one of the app's edge functions that asks Google on the page's behalf (a geocode, a
 *   Street View picture, an address suggestion, a drive time, a Places search). That list is held to
 *   `supabase/functions/` by `smokeNoGoogle.test.ts`.
 *
 * Pure: no browser, no Playwright.
 */

/**
 * Google's map hosts. Google's fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) are not maps and
 * are not held: the pages must draw in the type a person sees.
 */
export const GOOGLE_MAP_HOSTS: readonly string[] = ['maps.googleapis.com', 'maps.gstatic.com', 'places.googleapis.com', 'routes.googleapis.com']

/** Every edge function that asks Google when it runs: its source names `GOOGLE_MAPS_API_KEY`. */
export const GOOGLE_BACKED_FUNCTIONS: readonly string[] = [
  'address-autocomplete',
  'court-precinct-nightly',
  'driving-distance',
  'geocode-address-batch',
  'geocode-one',
  'job-share',
  'owner-confirm-nightly',
  'permit-lookup',
  'property-lookup',
  'street-view-preview',
  'travel-time-batch',
]

/** The edge function a URL calls, from `…/functions/v1/<name>` (a doubled slash too); null for any other URL. */
export function edgeFunctionName(url: URL): string | null {
  const m = /\/functions\/v1\/([^/?#]+)/.exec(url.pathname)
  return m?.[1] ?? null
}

/** True when the request would reach Google: one of its map hosts, or an edge function that asks it. */
export function isGoogleBound(url: URL): boolean {
  if (GOOGLE_MAP_HOSTS.includes(url.hostname.toLowerCase())) return true
  const name = edgeFunctionName(url)
  return name !== null && GOOGLE_BACKED_FUNCTIONS.includes(name)
}

/**
 * What a held request is called in the run's report: the function's path, else the host. Never the
 * query: a Street View or geocode call carries a customer's address there, and the report is a public
 * artifact of a public repository.
 */
export function googleBoundLabel(url: URL): string {
  const name = edgeFunctionName(url)
  return name ? `functions/v1/${name}` : url.hostname.toLowerCase()
}

/** One line for the report: each label with its count, the most first, ties by name. */
export function heldSummary(labels: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${label} × ${n}`)
    .join(', ')
}
