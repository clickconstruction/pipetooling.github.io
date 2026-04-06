import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useAuth } from './useAuth'

/**
 * Distinct people + transaction row counts for stale unlinked linked-card Mercury tally
 * (`list_stale_unlinked_mercury_transactions_for_tally_staff`), for dev / master / assistant.
 * Non-staff: 0 / 0 without RPC. Unauthenticated: null / null.
 */
export function useStaleTallyStaffFollowUp(minAgeDays: number): {
  peopleCount: number | null
  transactionCount: number | null
  refetch: () => Promise<void>
} {
  const { user: authUser, role } = useAuth()
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const [transactionCount, setTransactionCount] = useState<number | null>(null)

  const refetch = useCallback(async () => {
    if (!authUser?.id || role == null) {
      setPeopleCount(null)
      setTransactionCount(null)
      return
    }
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant') {
      setPeopleCount(0)
      setTransactionCount(0)
      return
    }
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase.rpc('list_stale_unlinked_mercury_transactions_for_tally_staff', {
            min_age_days: minAgeDays,
            include_all_unlinked: false,
          }),
        'list stale unlinked mercury transactions for tally staff',
      )
      const list = Array.isArray(data) ? data : []
      const people = new Set<string>()
      for (const r of list) {
        if (r && typeof r === 'object' && 'target_user_id' in r) {
          people.add(String((r as { target_user_id: string }).target_user_id))
        }
      }
      setPeopleCount(people.size)
      setTransactionCount(list.length)
    } catch {
      setPeopleCount(null)
      setTransactionCount(null)
    }
  }, [authUser?.id, role, minAgeDays])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!authUser?.id || role == null) return
    const onFocus = () => void refetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [authUser?.id, role, refetch])

  return { peopleCount, transactionCount, refetch }
}
