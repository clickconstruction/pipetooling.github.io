/**
 * When the firm's page reloads its payload on its own (punch list #85, item 22).
 * `legal-portal` signs the agreement PDF links for fifteen minutes. A firm that
 * keeps the page open longer would click a dead link, so the page reloads the
 * payload quietly once it is ten minutes old: when the tab comes back into
 * view, and on a one-minute check while it is in view. The reload mints fresh
 * links and keeps the selected matter and tab.
 */

/** The function's signed PDF link life, in milliseconds. Mirrors `SIGNED_PDF_SECONDS` in `legal-portal`. */
export const PORTAL_SIGNED_LINK_MS = 15 * 60 * 1000

/** Reload this long after the last load, leaving five minutes of margin before a link dies. */
export const PORTAL_RELOAD_AFTER_MS = 10 * 60 * 1000

/** True when the payload loaded at `loadedAtMs` is old enough to reload. Never true before a first load. */
export function portalPayloadIsStale(loadedAtMs: number | null, nowMs: number): boolean {
  return loadedAtMs != null && nowMs - loadedAtMs >= PORTAL_RELOAD_AFTER_MS
}

/** The notice line when the quiet reload fails: the page stays as it is, and the firm learns its PDF links may lapse. */
export const PORTAL_QUIET_RELOAD_FAILED = 'This page could not refresh itself just now. Its agreement links may stop opening. Reload the page to get fresh ones.'
