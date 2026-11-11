/**
 * Recovery logic for failed route-chunk loads (white-screen prevention).
 *
 * Every main route is a `lazy()` dynamic import of a content-hashed chunk. A deploy
 * replaces all hashed filenames, so a tab still running an older build 404s when it
 * fetches a chunk it hasn't visited yet. Without recovery the rejection throws through
 * Suspense with no boundary above the routes and React unmounts the whole tree.
 *
 * The recovery is a guarded full reload (fresh index.html → current chunk URLs). The
 * guard prevents reload loops when a reload does NOT fix the problem (e.g. the network
 * itself is down, so the fresh chunk fetch fails the same way).
 *
 * Two boundaries draw what this decides (`RouteChunkBoundary`): one around every route in
 * `App.tsx` and one around the Layout's outlet. A page outside the Layout, or a provider
 * above it, that loses its chunk is caught by the first, so no route ends on an empty page.
 */

/** sessionStorage key recording the last automatic chunk-recovery reload. */
export const CHUNK_RECOVERY_KEY = 'pipetooling-chunk-recovery-last'

/** Minimum gap between automatic recovery reloads. */
export const CHUNK_RECOVERY_MIN_INTERVAL_MS = 60_000

const CHUNK_ERROR_PATTERNS = [
  // Chrome/Edge
  'failed to fetch dynamically imported module',
  // Firefox
  'error loading dynamically imported module',
  // Safari
  'importing a module script failed',
  // Vite's CSS/asset preload helper
  'unable to preload css',
  // Webpack-style name kept for safety (some libs throw it)
  'chunkloaderror',
]

/** True when the error is a failed dynamic-import (stale chunk / asset fetch). */
export function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false
  const err = error as { name?: unknown; message?: unknown }
  const name = typeof err.name === 'string' ? err.name.toLowerCase() : ''
  if (name === 'chunkloaderror') return true
  const message =
    typeof err.message === 'string'
      ? err.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : ''
  return CHUNK_ERROR_PATTERNS.some((p) => message.includes(p))
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/**
 * One-shot guard: returns true (and records the attempt) when an automatic recovery
 * reload is allowed now; false when one already ran within the interval — the caller
 * should then show a manual fallback instead of reloading again.
 */
export function tryClaimChunkRecoveryReload(
  now: number,
  storage: StorageLike | null | undefined,
): boolean {
  if (!storage) return true
  try {
    const last = storage.getItem(CHUNK_RECOVERY_KEY)
    if (last) {
      const lastMs = Number.parseInt(last, 10)
      if (Number.isFinite(lastMs) && now - lastMs < CHUNK_RECOVERY_MIN_INTERVAL_MS) {
        return false
      }
    }
    storage.setItem(CHUNK_RECOVERY_KEY, String(now))
    return true
  } catch {
    // Storage unavailable (private mode/quota) — allow the reload rather than white-screen.
    return true
  }
}

/** True once a recovery reload has been started in this document. The page is leaving. */
let recoveryReloadStarted = false

/**
 * Start the one guarded recovery reload: claim it, remember that it is on its way and call
 * `reload`. False when the guard refuses (one already ran inside the interval); nothing is
 * started then, and the caller shows the fallback with its Reload press.
 */
export function startChunkRecoveryReload(
  now: number,
  storage: StorageLike | null | undefined,
  reload: () => void,
): boolean {
  if (!tryClaimChunkRecoveryReload(now, storage)) return false
  recoveryReloadStarted = true
  reload()
  return true
}

/** True while a recovery reload started here is on its way. */
export function chunkRecoveryReloadStarted(): boolean {
  return recoveryReloadStarted
}

/** Tests only: forget a started reload, since a test's document never leaves. */
export function forgetChunkRecoveryReload(): void {
  recoveryReloadStarted = false
}

/** What a chunk boundary draws: the page, "Updating app…", or one of its two fallbacks. */
export type ChunkBoundaryView = 'page' | 'updating' | 'lost-chunk' | 'broken'

/**
 * What a boundary draws for the error it holds. While a recovery reload is on its way the
 * answer is `updating` whatever the error says: the preload handler in `main.tsx` cancels
 * Vite's own throw when it starts the reload, the `lazy()` page then resolves to nothing, and
 * React reports a TypeError that names no chunk.
 */
export function chunkBoundaryView(error: unknown, reloadOnItsWay: boolean): ChunkBoundaryView {
  if (error == null) return 'page'
  if (reloadOnItsWay) return 'updating'
  return isChunkLoadError(error) ? 'lost-chunk' : 'broken'
}
