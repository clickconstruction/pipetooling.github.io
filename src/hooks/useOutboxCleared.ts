import { useEffect, useRef } from 'react'
import { outbox } from '../lib/offline/outboxState'

/**
 * Sign-out and an account switch drop every queued press on the device (punch list #163 PR 2),
 * the rule of `useKeptReadsClearedOnAccountChange`: a press is never sent as someone else. On a
 * sign-in the device's presses for that person are read back. Mounted once in `useAuth`; its own
 * file, with no hook of the app's imported, so `useAuth` can mount it without a cycle.
 */
export function useOutboxClearedOnAccountChange(userId: string | null | undefined, settled: boolean): void {
  const lastRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!settled) return
    const last = lastRef.current
    const now = userId ?? null
    lastRef.current = now
    if (now == null || (last != null && last !== now)) {
      void outbox.clear().then(() => {
        if (now != null) void outbox.load(now, Date.now())
      })
      return
    }
    if (outbox.userId() !== now) void outbox.load(now, Date.now())
  }, [userId, settled])
}
