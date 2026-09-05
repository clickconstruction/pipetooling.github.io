/**
 * Friendly wording for network-layer fetch failures (v2.1026).
 *
 * When a phone has no signal (Abraham's SOS-mode screenshot), the browser's
 * fetch rejects with a TypeError whose message varies by engine — Safari says
 * "Load failed", Chrome "Failed to fetch", Firefox "NetworkError when
 * attempting to fetch resource". supabase-js folds that into the result's
 * error.message, and our retry/label plumbing then showed techs strings like
 * "Failed to insert jobs_ledger_thread_note modal: TypeError: Load failed".
 * The failure is correct — the message is the bug. This kernel recognizes the
 * fetch-layer signatures so the toast chokepoints can swap in plain language.
 *
 * Text matching is the LAST resort (J18-N1): `DatabaseError` carries a
 * structured `kind` and the chokepoints in `utils/errorHandling.ts` decide
 * "offline" from that class, never from the message. This kernel is only
 * consulted for errors with no structure at all — a bare string, a plain
 * `Error` — and even then the Chrome signature must stand on its own:
 * `Failed to fetch` followed by an operation name (`Failed to
 * fetchScheduleJobContext: …`, `Failed to fetch bid for preview: …`) is the
 * app's own "Failed to <operation>:" prefix, not the engine, and must not
 * read as no-signal.
 */

const NETWORK_ERROR_TOKENS = [
  'load failed',
  'networkerror',
  'network request failed',
  'fetch failed',
  'the internet connection appears to be offline',
]

/**
 * Chrome's fetch-layer message is exactly "Failed to fetch" — it never carries
 * a continuation. The lookahead rejects the app's own `Failed to fetch<Op>:` /
 * `Failed to fetch <words>:` operation prefix, which is a different sentence
 * that happens to start with the same three words.
 */
const CHROME_FAILED_TO_FETCH_RE = /failed to fetch(?=\s*$|[.,;:)\]\n])/i

export const OFFLINE_ERROR_MESSAGE =
  "No connection — the app couldn't reach the server, so nothing was saved. Check your signal and try again."

export function isNetworkFetchErrorMessage(message: string | null | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  if (!m) return false
  if (NETWORK_ERROR_TOKENS.some((t) => m.includes(t))) return true
  return CHROME_FAILED_TO_FETCH_RE.test(m)
}

/**
 * Class-level check for the genuine offline path: the browser's own fetch
 * rejection is a `TypeError` (Chrome/Safari/Firefox all agree on the class,
 * only the message differs). A `TypeError` thrown by app code ("x is not a
 * function") does not carry a fetch signature, so the message is still
 * consulted — but only on a `TypeError`, never on a database/server error.
 */
export function isFetchLayerTypeError(error: unknown): boolean {
  return error instanceof TypeError && isNetworkFetchErrorMessage(error.message)
}
