/**
 * Where a tapped push notification lands — the kernel behind `notificationclick`
 * in src/sw.ts (v2.4323).
 *
 * The server pushes carry a path (`/checklist`, `/bids?tab=counts&bidId=…`); the
 * workflow senders carry a full `${origin}/workflows/…` link. Both resolve against
 * the worker's own origin here: `new URL(path)` with no base throws, and it did so
 * on every tap made while an app window was open, so the tap did nothing.
 */

/** The absolute link a notification opens: its url resolved against `origin`; the app's home when missing, unparseable or not http(s). */
export function notificationClickHref(url: unknown, origin: string): string {
  const home = new URL('/', origin).href
  if (typeof url !== 'string') return home
  try {
    const target = new URL(url, origin)
    return target.protocol === 'https:' || target.protocol === 'http:' ? target.href : home
  } catch {
    return home
  }
}

/**
 * The open window to reuse for `href`: one already on it, else the first window of
 * the same origin (`clients.matchAll` lists the most recently focused first).
 * `undefined` → open a new window, which is also how a link to another origin opens.
 */
export function notificationClickWindow<W extends { url: string }>(windows: readonly W[], href: string): W | undefined {
  const origin = originOf(href)
  if (origin === null) return undefined
  return windows.find((w) => w.url === href) ?? windows.find((w) => originOf(w.url) === origin)
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}
