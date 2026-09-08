import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DISPATCH_REQUESTS_CHANGED_EVENT } from '../lib/dispatchRequestHelpers'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'
import { OPEN_JOB_FROM_BID_ACTION } from '../lib/bids/wonDispatchHandoff'

export type OpenJobFromBidRequest = {
  id: string
  createdAt: string | null
  senderName: string | null
}

/**
 * The open "open the job" to-do for a bid, if this viewer may see it (RLS:
 * the requester, devs, dispatch members). Fail-soft — no row, no chip. Refetches
 * when a dispatch request changes in this tab or a job is born from the bid.
 */
export function useOpenJobFromBidRequest(bidId: string | null): { request: OpenJobFromBidRequest | null; refetch: () => void } {
  const [request, setRequest] = useState<OpenJobFromBidRequest | null>(null)
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!bidId) {
      setRequest(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('dispatch_requests')
          .select('id, created_at, sender:users!dispatch_requests_from_user_id_fkey(name)')
          .eq('bid_id', bidId)
          .eq('pending_action', OPEN_JOB_FROM_BID_ACTION)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        const row = data as { id: string; created_at: string | null; sender: { name: string | null } | null } | null
        setRequest(row ? { id: row.id, createdAt: row.created_at, senderName: row.sender?.name ?? null } : null)
      } catch {
        if (!cancelled) setRequest(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, tick])

  useEffect(() => {
    const onChange = () => refetch()
    window.addEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, onChange)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, onChange)
    return () => {
      window.removeEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, onChange)
      window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, onChange)
    }
  }, [refetch])

  return { request, refetch }
}
