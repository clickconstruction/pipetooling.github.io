/**
 * Where a sealed frame's hard reload goes (punch list #426's live walk, 2026-11-24). The app's hard reload leaves for
 * the site's root and keeps the page to come back to in `sessionStorage` (`hardReload.ts`). A sealed frame's
 * `sessionStorage` is memory, so the page was lost: after a new build landed, a frame drawn on the Dashboard came back
 * on its person's home, and an estimator's on the Bid Board. A sealed frame reloads its own address instead, with the
 * same mark on it that keeps the host's saved copy from answering, and the seal takes the mark off as it starts. Pure.
 */

/** The mark a hard reload puts on its address, so a saved copy of the page is never the answer. */
export const RELOAD_MARK = 'nocache'

type Place = { pathname: string; search: string; hash: string }

/** The address a sealed frame's hard reload asks for: its own page with the mark on it. */
export function sealedReloadTarget(loc: Place & { origin: string }, nowMs: number): string {
  const params = new URLSearchParams(loc.search)
  params.set(RELOAD_MARK, String(nowMs))
  return `${loc.origin}${loc.pathname}?${params.toString()}${loc.hash}`
}

/** The frame's page without the mark, or null when its address carries none and there is nothing to put right. */
export function placeWithoutReloadMark(loc: Place): string | null {
  const params = new URLSearchParams(loc.search)
  if (!params.has(RELOAD_MARK)) return null
  params.delete(RELOAD_MARK)
  const rest = params.toString()
  return `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash}`
}
