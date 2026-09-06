/**
 * "Is there somewhere in the app to go back to?" — for pages that want a real
 * Back button (Accounts Receivable, Tier-2 #17) instead of a fixed exit.
 *
 * React Router (v6 data/browser history) stamps every entry it creates with
 * `{ usr, key, idx }` in `window.history.state`; `idx` is the entry's position
 * in this tab's session. `idx > 0` means an in-app entry sits behind us. On a
 * cold open (bookmark, pasted link, hard reload of the first page) the state
 * is null or `idx` is 0, and the router's `location.key` is `'default'`.
 */
export function hasInAppHistory(historyState: unknown, locationKey?: string | null): boolean {
  if (historyState != null && typeof historyState === 'object') {
    const idx = (historyState as { idx?: unknown }).idx
    if (typeof idx === 'number' && Number.isFinite(idx)) return idx > 0
  }
  return locationKey != null && locationKey !== '' && locationKey !== 'default'
}
