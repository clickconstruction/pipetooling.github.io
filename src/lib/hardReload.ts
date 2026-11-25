import { RELOAD_MARK, sealedReloadTarget } from './lens/reloadPlace'

/** sessionStorage key — must match inline script in index.html */
export const HARD_RELOAD_RESTORE_KEY = 'pipetooling-hard-reload-restore'

type RestorePayload = {
  pathname: string
  search: string
  hash: string
}

/**
 * Unregister every service worker, then delete every cache — the same order
 * fix-cache.html uses. Deleting caches while a SW stays registered leaves the old
 * SW controlling the page with a permanently empty precache (workbox only
 * repopulates it during a future SW install), so every asset request falls through
 * to the network — and 404s as soon as the next deploy replaces the hashed files.
 * Never rejects; each step is best-effort.
 */
export async function wipeServiceWorkersAndCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister().catch(() => false)))
    }
  } catch {
    // serviceWorker API unavailable or blocked
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Cache API unavailable or blocked
  }
}

/**
 * How long a reload waits for the wipe before it leaves anyway (punch list #406, the simulator's walk of
 * 2026-11-25). The wipe is a few promise turns on a quiet page, so three seconds never cuts a wipe that is
 * moving. A longer wait buys nothing: what holds the wipe is not the wipe's own work.
 */
export const WIPE_DEADLINE_MS = 3_000

/**
 * The wipe, held to a deadline: settles when the wipe is done or when `deadlineMs` has passed, whichever
 * comes first, and never rejects. A page that waits on this always leaves.
 *
 * The wipe alone has no end of its own. A browser runs one registration's jobs in order, so `unregister()`
 * waits behind an install of the same worker, and an install ends only when the whole precache is on the
 * device: workbox fetches it one file at a time. Every load registers the worker at once (`UpdatePrompt`),
 * and a load that follows a wipe starts that install from nothing. A reload asked for inside it stood on
 * *Updating app…*, or on a grey **Reload**, for as long as the install took. Right after a deploy that is
 * the longest it can be, since no file of the new build is on the device yet.
 *
 * Leaving at the deadline is safe, because the wipe unregisters before it touches a cache. A deadline that
 * comes before the worker is gone finds every cache whole, so a worker still in control serves its own whole
 * build, and `UpdatePrompt` brings that page onto the new one. A deadline that comes after it finds no worker
 * to answer, and the load comes from the network, which is what the wipe was for.
 */
export function wipeBeforeLeaving(
  wipe: () => Promise<void> = wipeServiceWorkersAndCaches,
  deadlineMs: number = WIPE_DEADLINE_MS,
): Promise<'wiped' | 'deadline'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('deadline'), deadlineMs)
    const wiped = () => {
      clearTimeout(timer)
      resolve('wiped')
    }
    try {
      wipe().then(wiped, wiped)
    } catch {
      wiped()
    }
  })
}

/**
 * Full reload with cache bust, without requesting the current pathname from the host.
 * GitHub Pages returns HTTP 404 for deep links (e.g. /dashboard) even when 404.html
 * serves the SPA; navigating to / first avoids a misleading 404 on the document request.
 *
 * A sealed lens frame (`window.__lens`, punch list #194) reloads its own address instead: its `sessionStorage` is
 * memory, so the page kept there was gone after the reload and the frame came back on its person's home
 * (`lens/reloadPlace.ts`).
 */
export function hardReloadFromRoot(): void {
  try {
    sessionStorage.setItem(
      HARD_RELOAD_RESTORE_KEY,
      JSON.stringify({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      } satisfies RestorePayload)
    )
  } catch {
    // sessionStorage may be unavailable
  }

  const target =
    typeof window.__lens !== 'undefined'
      ? sealedReloadTarget(window.location, Date.now())
      : `${window.location.origin}/?${RELOAD_MARK}=${Date.now()}`

  const go = () => {
    window.location.href = target
  }

  // Once, on the wipe or on its deadline, whichever comes first.
  void wipeBeforeLeaving().then(go)
}
