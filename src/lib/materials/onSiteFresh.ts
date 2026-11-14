/**
 * Materials on site: when a screen reads again (punch list #344, PR 4).
 *
 * The on-site store read a job once and kept it for as long as the page stayed up. The desk left open showed the
 * morning's numbers all day, and a second phone capped **Used** at a number the first phone had already changed.
 * A job is read again when the person comes back to the page, when the signal returns, when a box is opened, and
 * every few minutes while the page stays in front. Pure: the ages and the one question, every one taking `now`.
 */

/** Coming back to the page, or the signal coming back: read again when the last read is older than this. */
export const ON_SITE_REFRESH_AFTER_MS = 60_000
/** Opening a box on the phone: its number is about to be pressed against, so a shorter age. */
export const ON_SITE_BOX_REFRESH_AFTER_MS = 20_000
/** While the page stays in front and nothing else asks. */
export const ON_SITE_REFRESH_EVERY_MS = 5 * 60_000

/** True when a read that finished at `loadedAt` is old enough to make again. A job never read is not refreshed: its first read is the screen's own. */
export function readIsStale(loadedAt: number | null | undefined, now: number, afterMs: number): boolean {
  if (loadedAt == null) return false
  return now - loadedAt >= afterMs
}
