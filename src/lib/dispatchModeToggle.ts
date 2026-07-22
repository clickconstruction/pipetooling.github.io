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

/** Cached per-device value; null = this device has no cached choice yet. */
export function readDispatchModeEnabled(userId: string | null | undefined): boolean | null {
  if (!userId) return null
  try {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(dispatchModeStorageKey(userId))
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}

export function writeDispatchModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(dispatchModeStorageKey(userId), enabled ? '1' : '0')
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
): Promise<{ value: boolean | null } | null> {
  try {
    const row = await withSupabaseRetry(
      async () =>
        supabase.from('users').select('dispatch_mode_enabled').eq('id', userId).maybeSingle(),
      'fetch dispatch_mode_enabled',
    )
    const v = (row as { dispatch_mode_enabled?: boolean | null } | null)?.dispatch_mode_enabled
    // value null = the user has never explicitly chosen (assistants default ON).
    return { value: typeof v === 'boolean' ? v : null }
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
