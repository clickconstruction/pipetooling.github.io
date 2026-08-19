/**
 * Per-user, per-device toggle for Farm Mode — the checklist-only lens.
 *
 * While on, Layout trims the nav to Checklist, redirects every other route
 * there, and the Checklist page shows only the Today + History tabs. Any role
 * may turn it on; it narrows what the device shows, never what RLS allows.
 *
 * Storage uses one key per user so a shared device with multiple accounts
 * doesn't leak the toggle. Mirrors `jobModeToggle.ts`.
 */

const PREFIX = 'farm_mode'

/** Same-tab change signal: `storage` events only fire in OTHER tabs, so the
 * gear-menu toggle dispatches this for hook instances in the same tab
 * (e.g. the Checklist page's) to re-read. */
export const FARM_MODE_CHANGED_EVENT = 'farm_mode_changed'

export function farmModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readFarmModeEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(farmModeStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeFarmModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(farmModeStorageKey(userId), '1')
    } else {
      localStorage.removeItem(farmModeStorageKey(userId))
    }
  } catch {
    // ignore
  }
}
