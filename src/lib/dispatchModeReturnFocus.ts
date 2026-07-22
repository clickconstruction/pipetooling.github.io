/**
 * Assistants in Dispatch Mode land on the Schedule tab when they come back to
 * the app after being away — a fresh open or a tab refocus more than
 * DISPATCH_MODE_AWAY_MS since their last activity.
 */

export const DISPATCH_MODE_AWAY_MS = 5 * 60 * 1000

const LAST_ACTIVE_KEY = 'dispatch_mode_last_active_ms'

export function stampDispatchModeActivity(nowMs: number): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LAST_ACTIVE_KEY, String(nowMs))
  } catch {
    // ignore
  }
}

export function readDispatchModeLastActive(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LAST_ACTIVE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/**
 * True when the return should jump to the Schedule tab: no stamp at all (first
 * open on this device) also counts as "away".
 */
export function isDispatchModeReturnAfterAway(
  lastActiveMs: number | null,
  nowMs: number,
  awayMs: number = DISPATCH_MODE_AWAY_MS,
): boolean {
  if (lastActiveMs == null) return true
  return nowMs - lastActiveMs >= awayMs
}
