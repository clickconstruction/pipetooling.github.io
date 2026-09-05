/**
 * The roster with each person's login role — what tells a crew pay sheet from a
 * sub sheet (Work Orders one-row spine). Teammates carry a `kind = 'sub'` row
 * too (the roster row behind a login), so `isRosterSub` needs the account
 * role: kind `sub` AND (no login OR a `subcontractor` login). Both the Work
 * Orders board and the Sub Labor ledger read this one list.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NeedsWorkOrderRosterPerson } from '../lib/subWorkOrders/sheetsNeedingWorkOrder'

export function useRosterSubKinds(enabled = true): { roster: NeedsWorkOrderRosterPerson[]; loaded: boolean } {
  const [roster, setRoster] = useState<NeedsWorkOrderRosterPerson[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const [{ data: people }, { data: users }] = await Promise.all([
        supabase.from('people').select('id, name, kind, account_user_id').order('id').limit(1000),
        supabase.from('users').select('id, role').order('id').limit(1000),
      ])
      if (cancelled) return
      const roleByUserId = new Map(((users ?? []) as Array<{ id: string; role: string | null }>).map((u) => [u.id, u.role]))
      setRoster(
        ((people ?? []) as Array<{ id: string; name: string; kind: string; account_user_id: string | null }>).map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          accountRole: p.account_user_id ? (roleByUserId.get(p.account_user_id) ?? null) : null,
        })),
      )
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { roster, loaded }
}
