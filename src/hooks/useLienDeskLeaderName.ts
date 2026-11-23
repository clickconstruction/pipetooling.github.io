import { useEffect, useState } from 'react'
import { lienDeskLeaderNameOf } from '../lib/dashboard/lienDeskCard'
import type { ActiveRosterRow } from '../lib/people/activeRoster'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

type LeaderRow = ActiveRosterRow & { id: string; name: string | null }

/** The one read behind the name: a person's row by id, with what `isActiveRosterPerson` asks. */
export type LienDeskLeaderNameIo = { person(userId: string): Promise<LeaderRow | null> }

export const lienDeskLeaderNameIo: LienDeskLeaderNameIo = {
  async person(userId) {
    const rows = await withSupabaseRetry(
      async () => supabase.from('users').select('id, name, role, archived_at, is_digital_twin, is_sample, is_walk_tester').eq('id', userId).limit(1),
      'Lien desk card: the leader’s name',
    )
    return ((rows ?? []) as LeaderRow[])[0] ?? null
  },
}

/**
 * The name the Lien desk's Board gives the leader, for the Dashboard's Lien desk card (punch list #423, v2.8372): one
 * small read of one person, the master most of the desk's papers wait on (`lienBoardLeaderUserId`), named as the desk
 * names him (`lienDeskLeaderNameOf`). Null with no one to name, while the read is out, and when it fails: the card then
 * says *waiting on the leader*, as it did before. Nothing is read without an id, so the leader's own Dashboard, which
 * says *wait on you*, makes no read.
 */
export function useLienDeskLeaderName(userId: string | null, io: LienDeskLeaderNameIo = lienDeskLeaderNameIo): string | null {
  const [got, setGot] = useState<{ userId: string; name: string | null } | null>(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    io.person(userId).then(
      (row) => {
        if (!cancelled) setGot({ userId, name: lienDeskLeaderNameOf(row) })
      },
      () => {
        if (!cancelled) setGot({ userId, name: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId, io])
  // A name read for someone else, before the id changed, is never shown.
  return userId && got?.userId === userId ? got.name : null
}
