/**
 * Per-user, per-device toggle for Dispatch Mode (the phone-first shell with the
 * bottom Dashboard/Schedule/Inbox/Customers/More tab bar). Mirrors
 * `jobModeToggle.ts`, including the same-tab change event — `storage` events
 * only fire in OTHER tabs, so same-tab listeners need the custom event.
 */

const PREFIX = 'dispatch_mode'

export const DISPATCH_MODE_CHANGED_EVENT = 'dispatch_mode_changed'

export function dispatchModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readDispatchModeEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(dispatchModeStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeDispatchModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(dispatchModeStorageKey(userId), '1')
    } else {
      localStorage.removeItem(dispatchModeStorageKey(userId))
    }
  } catch {
    // ignore
  }
}
