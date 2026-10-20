import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bidMoneyLine, parseBidMoneyStrip, todayYmd, type BidMoneyLine } from '../lib/bids/bidMoneyLine'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'

/**
 * The money line under a won bid (punch list #129, v2.5647): one bid's entry from `list_bid_money_strip`, the read the
 * job's people have where they read no job row. Null while nothing is read, when the bid has no job yet, or when the
 * person is no person of the job (the function returns no entry). Reads again when a job is made from a bid and on
 * window focus, and on `reload` after a word is written. An error reads as nothing: the line just does not draw.
 */
export function useBidMoneyStrip(bidId: string | null, enabled = true): { line: BidMoneyLine | null; loaded: boolean; reload: () => void } {
  const [line, setLine] = useState<BidMoneyLine | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !bidId) {
      setLine(null)
      setLoaded(enabled)
      return
    }
    let cancelled = false
    void supabase.rpc('list_bid_money_strip' as never, { p_bid_ids: [bidId] } as never).then(({ data, error }) => {
      if (cancelled) return
      const entry = error ? null : (parseBidMoneyStrip(data as unknown).find((e) => e.bidId === bidId) ?? null)
      setLine(entry ? bidMoneyLine(entry, todayYmd()) : null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [bidId, enabled, tick])

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

  return { line, loaded, reload }
}
