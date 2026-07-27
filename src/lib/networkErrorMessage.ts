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
 */

const NETWORK_ERROR_TOKENS = [
  'load failed',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'fetch failed',
  'the internet connection appears to be offline',
]

export const OFFLINE_ERROR_MESSAGE =
  "No connection — the app couldn't reach the server, so nothing was saved. Check your signal and try again."

export function isNetworkFetchErrorMessage(message: string | null | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  if (!m) return false
  return NETWORK_ERROR_TOKENS.some((t) => m.includes(t))
}
