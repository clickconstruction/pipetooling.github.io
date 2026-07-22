/**
 * Per-user, per-device toggle for the Dashboard Job Mode card.
 *
 * Storage uses one key per user so a shared device with multiple accounts
 * doesn't leak the toggle. Mirrors the lightweight pattern from
 * `dashboardClockStripScopeStorage.ts`.
 */

const PREFIX = 'dashboard_job_mode'

/** Same-tab change signal: `storage` events only fire in OTHER tabs, so the
 * gear-menu toggle dispatches this for hook instances in the same tab
 * (e.g. the Dashboard's) to re-read. */
export const JOB_MODE_CHANGED_EVENT = 'dashboard_job_mode_changed'

export function jobModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readJobModeEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(jobModeStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeJobModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(jobModeStorageKey(userId), '1')
    } else {
      localStorage.removeItem(jobModeStorageKey(userId))
    }
  } catch {
    // ignore
  }
}
