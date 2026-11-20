/**
 * Whether Google has failed under a painted map on this page (punch list #387). Kept for the page,
 * not for the window: a painted map's window opens and closes many times in one visit, and a key
 * Google refused once is refused every time. Without this each open would draw Google's grey map
 * for a moment and then change to the other one.
 *
 * One fact, kept until the page is loaded again. The rule that reads it is `paintedMapProvider.ts`.
 */
let failed = false

/** Google failed under a painted map since this page loaded. */
export function paintedGoogleFailedOnPage(): boolean {
  return failed
}

/** Google just failed under a painted map: every painted map after it opens on Leaflet. */
export function notePaintedGoogleFailed(): void {
  failed = true
}

/** A new page, for a test. */
export function forgetPaintedGoogleFailureForTests(): void {
  failed = false
}
