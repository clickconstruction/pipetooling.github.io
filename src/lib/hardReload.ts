/** sessionStorage key — must match inline script in index.html */
export const HARD_RELOAD_RESTORE_KEY = 'pipetooling-hard-reload-restore'

type RestorePayload = {
  pathname: string
  search: string
  hash: string
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

  if (typeof caches !== 'undefined') {
    void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(go, go)
  } else {
    go()
  }
}
