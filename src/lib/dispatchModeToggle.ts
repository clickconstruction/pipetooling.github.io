/**
 * Per-user, per-device toggle for Dispatch Mode (the phone-first shell with the
 * bottom Dashboard/Schedule/Inbox/Customers/More tab bar). Mirrors
 * `jobModeToggle.ts`, including the same-tab change event — `storage` events
 * only fire in OTHER tabs, so same-tab listeners need the custom event.
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

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

/**
 * Server truth: `users.dispatch_mode_enabled` (v2.905). localStorage stays as
 * the instant-boot cache; the hook reconciles from the server on mount so the
 * mode follows the user across devices. Errors → null (keep the cached value).
 */
export async function fetchDispatchModeEnabledFromServer(
  userId: string,
): Promise<boolean | null> {
  try {
    const row = await withSupabaseRetry(
      async () =>
        supabase.from('users').select('dispatch_mode_enabled').eq('id', userId).maybeSingle(),
      'fetch dispatch_mode_enabled',
    )
    const v = (row as { dispatch_mode_enabled?: boolean } | null)?.dispatch_mode_enabled
    return typeof v === 'boolean' ? v : null
  } catch {
    return null
  }
}

/** Best-effort server write; localStorage/event already updated by the caller. */
export async function writeDispatchModeEnabledToServer(
  userId: string,
  enabled: boolean,
): Promise<void> {
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('users')
          .update({ dispatch_mode_enabled: enabled } as never)
          .eq('id', userId),
      'write dispatch_mode_enabled',
    )
  } catch {
    // per-device cache still holds; next toggle retries
  }
}
