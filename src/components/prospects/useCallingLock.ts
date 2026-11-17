import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { callingLockDecision, type CallingLockRow, type CallingLockTrigger } from '../../lib/prospects/callingLock'
import { releaseCallingLock } from '../../lib/prospects/callingLockIo'

/**
 * The advisory calling lock of the Follow Up deck (v2.2850 — journey-map #14(b)): taken on INTENT, never on view.
 * `lockTakenForRef` remembers which prospect THIS tab locked so the release only deletes a row we wrote;
 * `lockHeldBy` names a colleague whose live lock we found (and did not steal) on the displayed prospect.
 * Moved out of `src/pages/Prospects.tsx` unchanged; the rules are in `lib/prospects/callingLock.ts`.
 *
 * `onDeck` is the page's "the Customers side is up and Follow Up is its tab".
 */
export function useCallingLock({
  onDeck,
  currentProspectId,
  userId,
  authRole,
}: {
  onDeck: boolean
  currentProspectId: string | null
  userId: string | null
  authRole: string | null
}) {
  const lockTakenForRef = useRef<string | null>(null)
  const lockAttemptForRef = useRef<string | null>(null)
  const [lockHeldBy, setLockHeldBy] = useState<{ prospectId: string; name: string | null } | null>(null)

  // Calling lock — RELEASE only. Viewing a prospect writes nothing (v2.2850,
  // journey-map #14(b) / J34-F5): the row is taken by `takeCallingLock` on
  // the first sign of intent. On prospect change / tab leave, delete the row
  // only if THIS tab took it.
  useEffect(() => {
    if (!onDeck || !currentProspectId || !userId) return
    const prospectId = currentProspectId
    const lockedBy = userId
    return () => {
      lockAttemptForRef.current = null
      setLockHeldBy((prev) => (prev?.prospectId === prospectId ? null : prev))
      if (lockTakenForRef.current !== prospectId) return
      lockTakenForRef.current = null
      releaseCallingLock(prospectId, lockedBy)
    }
  }, [onDeck, currentProspectId, userId])

  /**
   * Take the advisory calling lock on the displayed prospect because the
   * caller showed intent (`trigger`). Once per prospect per tab. Never steals:
   * a colleague's lock younger than the TTL leaves the row alone and names
   * them on the card; a stale one (closed tab) is taken over.
   */
  const takeCallingLock = useCallback(
    (trigger: CallingLockTrigger) => {
      if (!currentProspectId || !userId) return
      const prospectId = currentProspectId
      const me = userId
      if (lockAttemptForRef.current === prospectId) return
      lockAttemptForRef.current = prospectId
      void (async () => {
        try {
          const { data } = await supabase
            .from('prospect_calling_locks')
            .select('prospect_id, user_id, locked_at')
            .eq('prospect_id', prospectId)
            .maybeSingle()
          const existing = (data ?? null) as CallingLockRow | null
          const decision = callingLockDecision({ existing, now: Date.now(), me })
          if (decision === 'held-by-other' && existing) {
            const { data: holder } = await supabase.from('users').select('name').eq('id', existing.user_id).maybeSingle()
            setLockHeldBy({ prospectId, name: (holder as { name?: string | null } | null)?.name ?? null })
            return
          }
          const { error } = await supabase
            .from('prospect_calling_locks')
            .upsert({ prospect_id: prospectId, user_id: me, locked_at: new Date().toISOString() }, { onConflict: 'prospect_id' })
          if (error) throw error
          lockTakenForRef.current = prospectId
          setLockHeldBy((prev) => (prev?.prospectId === prospectId ? null : prev))
          recordNavClick(me, authRole, 'prospect_lock_taken', `#${trigger}${decision === 'stale-take' ? '-stale' : ''}`)
        } catch {
          // Advisory lock — the call goes on without it; allow a later retry.
          lockAttemptForRef.current = null
        }
      })()
    },
    [currentProspectId, userId, authRole],
  )

  return { lockHeldBy, takeCallingLock }
}
