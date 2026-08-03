import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import {
  NONCARD_QUEUE_LIST_LIMIT,
  parseNoncardAttributionQueueRows,
  type NoncardAttributionQueueRow,
} from '../lib/banking/noncardAttributionQueue'

/**
 * Quickfill "Bank transfers needing attribution": non-card (ACH/wire/check)
 * money-out Mercury transactions with no attribution of any kind.
 *
 * Eligibility is probed, not role-derived: the count RPC is attempted on mount
 * and a 42501/permission error (any error, in practice) marks the section
 * ineligible so it renders nothing. That makes the section work for dev today
 * and for `banking_attributors` capability-holders automatically (Phase 3)
 * without the client knowing the grant list.
 *
 * The new RPCs are not in the generated types (substrate shipped ahead of a
 * types regen), hence the established `(supabase as any).rpc(...)` cast
 * precedent (see the prospect_timer_events call sites in Prospects.tsx).
 */
export function useQuickfillNoncardAttribution(): {
  rows: NoncardAttributionQueueRow[]
  count: number | null
  loading: boolean
  /** True once the count RPC has succeeded for this user (dev or capability holder). */
  eligible: boolean
  fetchEnabled: boolean
  refetch: () => Promise<void>
} {
  const { user: authUser } = useAuth()
  const fetchEnabled = Boolean(authUser?.id)
  const [rows, setRows] = useState<NoncardAttributionQueueRow[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [eligible, setEligible] = useState(false)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!fetchEnabled) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase)
    const countRes = await rpc('count_unattributed_noncard_mercury_transactions')
    if (countRes.error) {
      // 42501 "Not authorized" = user lacks the capability → hide the section
      // entirely. Other errors also leave it hidden for this visit (the section
      // is dev/capability-only; a transient failure hiding it is acceptable).
      if (countRes.error.code !== '42501') console.error(countRes.error)
      setEligible(false)
      setRows([])
      setCount(null)
      return
    }
    const n = Number(countRes.data)
    setEligible(true)
    setCount(Number.isFinite(n) ? n : 0)
    const listRes = await rpc('list_unattributed_noncard_mercury_transactions', {
      p_limit: NONCARD_QUEUE_LIST_LIMIT,
    })
    if (listRes.error) {
      console.error(listRes.error)
      return
    }
    setRows(parseNoncardAttributionQueueRows(listRes.data))
  }, [fetchEnabled])

  useEffect(() => {
    if (!fetchEnabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      await refetch()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchEnabled, refetch])

  return { rows, count, loading, eligible, fetchEnabled, refetch }
}
