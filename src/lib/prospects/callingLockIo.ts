import { supabase } from '../supabase'

/**
 * Release a caller's own calling lock on a prospect: delete their row, if they hold one. Fire and forget, since
 * the lock is advisory: a refusal or a lost signal leaves a row that goes stale by itself (`callingLock.ts`).
 *
 * The `then` is what sends it. The Supabase client sends a query only when it is awaited, and the eight releases
 * on the Prospects page were written `void supabase…delete()` with nothing after: none was ever sent (v2.2850 to
 * the fix), so a lock stayed until it went stale. Every release goes through here now.
 */
export function releaseCallingLock(prospectId: string, userId: string): void {
  void supabase
    .from('prospect_calling_locks')
    .delete()
    .eq('prospect_id', prospectId)
    .eq('user_id', userId)
    .then(
      () => undefined,
      () => undefined,
    )
}
