/**
 * Per-user, per-device toggle for Pin Mode (v2.1972) — whether the page-bottom
 * pin footer (Pin / Pin bid / Pin for… / full-screen strip) renders at all.
 *
 * Off by default: the footer is a power-user affordance, and most sessions
 * never pin anything. Turning Pin Mode on from the gear menu shows the strip
 * on every pinnable page; existing pins keep working either way — the
 * Dashboard quick bar and Settings management don't gate on this.
 *
 * Storage uses one key per user so a shared device with multiple accounts
 * doesn't leak the toggle. Mirrors `farmModeToggle.ts`.
 */

const PREFIX = 'pin_mode'

/** Same-tab change signal: `storage` events only fire in OTHER tabs, so the
 * gear-menu toggle dispatches this for hook instances in the same tab to
 * re-read. */
export const PIN_MODE_CHANGED_EVENT = 'pin_mode_changed'

export function pinModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readPinModeEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(pinModeStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writePinModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(pinModeStorageKey(userId), '1')
    } else {
      localStorage.removeItem(pinModeStorageKey(userId))
    }
  } catch {
    // ignore
  }
}
