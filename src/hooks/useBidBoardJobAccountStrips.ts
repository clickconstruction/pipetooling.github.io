import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'
import { groupStripRowsByBid } from '../lib/bids/bidBoardJobAccounts'
import type { BidJobAccountRow } from './useBidJobAccountStrip'

/**
 * Job accounts for every won bid on the Bid Board (v2.3520): ONE
 * `list_bid_job_account_strip` call for the page's won bid ids, grouped per
 * bid. The per-bid twin (`useBidJobAccountStrip`) stays for Edit Bid's Job
 * block. Refetches when a job is created from a bid and on window focus; an
 * RPC error reads as no rows (the chips just do not draw).
 */
export function useBidBoardJobAccountStrips(bidIds: readonly string[], enabled = true): {
  byBid: Map<string, BidJobAccountRow[]>
  loaded: boolean
  reload: () => void
} {
  const [rows, setRows] = useState<BidJobAccountRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const key = useMemo(() => [...bidIds].sort().join(','), [bidIds])

  useEffect(() => {
    if (!enabled || !key) {
      setRows([])
      setLoaded(enabled)
      return
    }
    let cancelled = false
    void supabase.rpc('list_bid_job_account_strip', { p_bid_ids: key.split(',') }).then(({ data, error }) => {
      if (cancelled) return
      setRows(error ? [] : ((data ?? []) as BidJobAccountRow[]))
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])

  useEffect(() => {
    if (!enabled) return
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('focus', bump)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
    return () => {
      window.removeEventListener('focus', bump)
      window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
    }
  }, [enabled])

  const byBid = useMemo(() => groupStripRowsByBid(rows), [rows])
  return { byBid, loaded, reload }
}
