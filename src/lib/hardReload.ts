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
 * Full reload with cache bust, without requesting the current pathname from the host.
 * GitHub Pages returns HTTP 404 for deep links (e.g. /dashboard) even when 404.html
 * serves the SPA; navigating to / first avoids a misleading 404 on the document request.
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

  const target = `${window.location.origin}/?nocache=${Date.now()}`

  const go = () => {
    window.location.href = target
  }

  void wipeServiceWorkersAndCaches().then(go, go)
}
