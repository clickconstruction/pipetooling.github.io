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
 *
 * The reload waits for a write. The page that lost its chunk cannot draw, so the reload has
 * to come, but a save still on its way out is let finish first (`decideChunkReloadWait`):
 * a reload inside a write sends the write and never hears its answer.
 */
import { inFlightWriteCount, subscribeUnsavedWork } from './unsavedWork'

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

/** A write that came back is often the first of a chain (a row, then its files): stay this long after it. */
export const CHUNK_RELOAD_SETTLE_MS = 1_500
/** The page cannot draw, so the wait has an end: after this long the reload goes whatever is in flight. */
export const CHUNK_RELOAD_WAIT_MAX_MS = 30_000

export type ChunkReloadWaitSnapshot = {
  /** Non-GET requests through the Supabase client still waiting for a response. */
  inFlightWrites: number
  /** Time since the recovery reload was started. */
  msSinceStarted: number
  /** Time since the last write seen during the wait came back, null when none was seen. */
  msSinceWriteSettled: number | null
}

export type ChunkReloadWait =
  | { act: 'reload'; reason: string }
  | { act: 'wait'; reason: string; lookAgainInMs: number }

/**
 * May the started recovery reload fire now? There is no standing down here, unlike the
 * update's quiet moment (`autoReload.ts`): the page is already lost, so the answer is only
 * now or a little later.
 */
export function decideChunkReloadWait(s: ChunkReloadWaitSnapshot): ChunkReloadWait {
  const untilGiveUp = CHUNK_RELOAD_WAIT_MAX_MS - s.msSinceStarted
  if (untilGiveUp <= 0) return { act: 'reload', reason: 'waited as long as a lost page can' }
  if (s.inFlightWrites > 0) {
    return { act: 'wait', reason: `${s.inFlightWrites} write(s) in flight`, lookAgainInMs: untilGiveUp }
  }
  if (s.msSinceWriteSettled != null && s.msSinceWriteSettled < CHUNK_RELOAD_SETTLE_MS) {
    return {
      act: 'wait',
      reason: 'a write just came back, another may follow',
      lookAgainInMs: Math.min(CHUNK_RELOAD_SETTLE_MS - s.msSinceWriteSettled, untilGiveUp),
    }
  }
  return { act: 'reload', reason: 'nothing in flight' }
}

/** Where the wait reads the writes in flight. The app's own is `unsavedWork.ts`; a test hands in its own. */
export type WriteWatch = {
  count: () => number
  subscribe: (onChange: () => void) => () => void
}

const appWrites: WriteWatch = { count: inFlightWriteCount, subscribe: subscribeUnsavedWork }

/** Call `reload` as soon as `decideChunkReloadWait` allows it: at once when nothing is in flight. */
function reloadWhenWritesSettle(reload: () => void, writes: WriteWatch): void {
  const startedAt = Date.now()
  let lastCount = writes.count()
  let settledAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe = () => {}
  let fired = false
  const look = () => {
    if (fired) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const at = Date.now()
    const wait = decideChunkReloadWait({
      inFlightWrites: writes.count(),
      msSinceStarted: at - startedAt,
      msSinceWriteSettled: settledAt == null ? null : at - settledAt,
    })
    if (wait.act === 'reload') {
      fired = true
      unsubscribe()
      reload()
      return
    }
    timer = setTimeout(look, wait.lookAgainInMs)
  }
  unsubscribe = writes.subscribe(() => {
    const count = writes.count()
    if (count === 0 && lastCount > 0) settledAt = Date.now()
    lastCount = count
    look()
  })
  look()
}

/** True once a recovery reload has been started in this document. The page is leaving. */
let recoveryReloadStarted = false

/** The browser's own word on the network. Only a plain `false` is offline: a browser that cannot say counts as online. */
export function browserSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Start the one guarded recovery reload: claim it, remember that it is on its way and call
 * `reload`, at once when no write is in flight and otherwise when the write is back. False
 * when the guard refuses (one already ran inside the interval); nothing is started then, and
 * the caller shows the fallback with its Reload press.
 *
 * False too while the browser says it is offline, with the guard left unclaimed. A reload has
 * nothing to fetch then: it empties the caches and lands on the browser's own error page, which
 * is worse than the fallback. The chunk was lost to the signal, not to a deploy.
 */
export function startChunkRecoveryReload(
  now: number,
  storage: StorageLike | null | undefined,
  reload: () => void,
  writes: WriteWatch = appWrites,
  offline: boolean = browserSaysOffline(),
): boolean {
  if (offline) return false
  if (!tryClaimChunkRecoveryReload(now, storage)) return false
  recoveryReloadStarted = true
  reloadWhenWritesSettle(reload, writes)
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
