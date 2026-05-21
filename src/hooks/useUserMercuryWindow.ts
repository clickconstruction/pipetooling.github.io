import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useRealtimeChannel } from './useRealtimeChannel'
import type { UserReviewRpcRow } from '../lib/buildUserJobLabelBreakdown'

export type UseUserMercuryWindowArgs = {
  /** When null, the hook stays idle and returns empty rows. */
  userId: string | null
  /** Inclusive YYYY-MM-DD start of the company-calendar window. */
  startYmd: string | null
  /** Inclusive YYYY-MM-DD end of the company-calendar window. */
  endYmd: string | null
  /** Default true. When false, the RPC ignores person-attributed rows entirely. */
  includePersonAttributed?: boolean
}

export type UseUserMercuryWindowResult = {
  rows: ReadonlyArray<UserReviewRpcRow>
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Calls the SECURITY DEFINER RPC `list_user_mercury_review_window` once per (userId, startYmd, endYmd, includePerson)
 * change. Used by `UserMercuryWindowSection` to build the per-job × per-label breakdown for one user.
 *
 * The hook is idle (and returns empty rows / no error) until all three of userId / startYmd / endYmd are set.
 * The RPC enforces banking-staff RLS — non-banking callers will get an error from the RPC, which the hook surfaces.
 */
export function useUserMercuryWindow({
  userId,
  startYmd,
  endYmd,
  includePersonAttributed = true,
}: UseUserMercuryWindowArgs): UseUserMercuryWindowResult {
  const [rows, setRows] = useState<ReadonlyArray<UserReviewRpcRow>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const argsKey = useMemo(() => {
    if (!userId || !startYmd || !endYmd) return null
    return `${userId}|${startYmd}|${endYmd}|${includePersonAttributed ? '1' : '0'}`
  }, [userId, startYmd, endYmd, includePersonAttributed])

  const load = useCallback(async () => {
    if (!userId || !startYmd || !endYmd) {
      setRows([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase.rpc('list_user_mercury_review_window', {
            p_user_id: userId,
            p_start_ymd: startYmd,
            p_end_ymd: endYmd,
            p_include_person_attributed: includePersonAttributed,
          }),
        'list_user_mercury_review_window',
      )
      setRows((data ?? []) as UserReviewRpcRow[])
    } catch (e) {
      setRows([])
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
    // argsKey covers all four inputs deterministically; eslint can't see that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argsKey])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime: refresh when this user's attribution rows change (server-side filter), or when
  // any job allocation row changes (table-level — narrower filter would need txId list, not
  // worth the join). Both tables are dev/master/assistant-only via RLS so non-banking sockets
  // receive nothing.
  const realtimeFilters = useMemo(
    () =>
      userId
        ? [
            {
              event: '*' as const,
              schema: 'public',
              table: 'mercury_transaction_attributions',
              filter: `user_id=eq.${userId}`,
            },
            {
              event: '*' as const,
              schema: 'public',
              table: 'mercury_transaction_job_allocations',
            },
          ]
        : [],
    [userId],
  )
  useRealtimeChannel(
    !!userId && !!startYmd && !!endYmd,
    `user-review-mercury-${userId ?? 'none'}`,
    realtimeFilters,
    () => {
      void load()
    },
    { debounceMs: 500 },
  )

  return { rows, loading, error, reload: load }
}
