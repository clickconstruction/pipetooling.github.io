/**
 * Reference copy of the Cloudflare Worker bound to https://pipetooling.com/sw.js
 * on the pipetooling.com zone (kept in sync with the dashboard, like
 * portal-link-shell.worker.js).
 *
 * Why this exists (post-cutover, docs/DOMAIN_CUTOVER.md): returning visitors
 * still have the old PWA service worker registered on the pipetooling.com
 * origin. That worker intercepts every navigation, and its update check for
 * /sw.js hits the zone-wide 301 to clicktooling.com — a cross-origin redirect,
 * which browsers treat as a failed script fetch, so the stale worker can never
 * update OR unregister itself. When its precache is gone, navigations die with
 * net::ERR_FAILED instead of following the redirect.
 *
 * This Worker serves a self-destructing service worker at the exact old script
 * URL: it installs, wipes the origin's caches, unregisters the registration,
 * and re-navigates any open tabs — which then flow through the normal 301 to
 * clicktooling.com. The zone's redirect rule must EXCLUDE /sw.js so this route
 * is reachable (Single Redirects run before Workers).
 *
 * Keep this Worker (and the redirect exclusion) forever, same as the redirect
 * rule itself — any device that ever installed the old PWA needs it once.
 */
export default {
  async fetch() {
    const killerSw = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}
    try { await self.clients.claim(); } catch {}
    let clients = [];
    try { clients = await self.clients.matchAll({ type: 'window' }); } catch {}
    for (const client of clients) {
      try { client.navigate(client.url); } catch {}
    }
    try { await self.registration.unregister(); } catch {}
  })());
});
`
    return new Response(killerSw, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        // Never let this script cache — the whole point is a fresh update check.
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
    })
  },
}
