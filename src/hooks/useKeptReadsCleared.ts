import { useEffect, useRef } from 'react'
import { clearKeptReads } from '../lib/keptReadStore'

/**
 * Sign-out and an account switch drop every kept read on the device (#183 PR 2, v2.6031; the
 * board's `clearBoardSnapshots` of v2.3610 moved up from the jobs cache to `AuthProvider`, the one
 * place that knows who is signed in). Mounted once, with the signed-in user's id and whether auth
 * has settled: once settled with nobody signed in (the sign-in page, so a sign-out that left the
 * page before its clear could finish is cleared here), or with another id than before (an
 * account switch, or impersonation starting or ending), the store is cleared. Nothing runs while
 * auth is still loading, so a cold open never drops the read it is about to paint.
 *
 * Its own file, with no hook of the app's imported, so `useAuth` can mount it without a cycle.
 */
export function useKeptReadsClearedOnAccountChange(userId: string | null | undefined, settled: boolean): void {
  const lastRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!settled) return
    const last = lastRef.current
    const now = userId ?? null
    lastRef.current = now
    if (now == null || (last != null && last !== now)) void clearKeptReads()
  }, [userId, settled])
}
