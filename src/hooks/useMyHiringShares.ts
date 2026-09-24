/**
 * The Hiring columns shared with the signed-in account (v2.3805, to-dos/helper-tryout-loop PR 6).
 * `team_prospect_role_shares` returns one's own rows to anyone; a full holder never needs this
 * (they see everything), so the Prospects page reads it only to decide whether the Hiring pill
 * shows for someone without the switch. Fail-soft: an error (the migration not yet pushed) reads
 * as no shares. `loading` holds the cold landing until the answer is in, as `authLoading` does.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMyHiringShares(userId: string | null | undefined) {
  const [sharedRoleIds, setSharedRoleIds] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setSharedRoleIds([])
      setLoading(false)
      return
    }
    setLoading(true)
    void supabase
      .from('team_prospect_role_shares')
      .select('role_id')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return
        setSharedRoleIds(error ? [] : ((data ?? []) as unknown as Array<{ role_id: string }>).map((r) => r.role_id))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return { sharedRoleIds, loading }
}
