/**
 * The board's tab-switch TTL (Pipeline load speed, v2.3603). Switching to a Jobs tab used to
 * reload the whole jobs list every time — the `activeTab` effect called the loader
 * unconditionally, and the 30 s guard covered only `visibilitychange`. This is the one rule:
 * a tab-switch load is skipped when the board for the same key finished within the window
 * and already holds every scope the tab wants. Mutation refreshes, a changed customer
 * filter and a first load are never skipped — they do not pass `kind: 'tab'`.
 */
import type { JobsBoardScope } from './boardScopes'

export const BOARD_TAB_REFETCH_TTL_MS = 30_000

export type BoardFreshnessInput = {
  /** The cache key the tab wants (user + customer filter). */
  key: string
  /** Keys a load has completed for in this session. */
  completedKeys: ReadonlySet<string>
  /** The key the current rows belong to; null before any success. */
  currentKey: string | null
  /** When the last load completed (ms epoch); 0 before any. */
  lastCompletedAt: number
  now: number
  /** The scopes the current rows hold. */
  mergedScopes: ReadonlySet<JobsBoardScope>
  /** The scopes the tab wants on screen. */
  wantedScopes: readonly JobsBoardScope[]
  ttlMs?: number
}

/** True when a tab-switch load can be skipped: same key, inside the window, every wanted scope already merged. */
export function boardIsFreshForTab(i: BoardFreshnessInput): boolean {
  const ttl = i.ttlMs ?? BOARD_TAB_REFETCH_TTL_MS
  if (i.currentKey !== i.key || !i.completedKeys.has(i.key)) return false
  if (!(i.lastCompletedAt > 0) || i.now - i.lastCompletedAt >= ttl) return false
  return i.wantedScopes.every((s) => i.mergedScopes.has(s))
}
