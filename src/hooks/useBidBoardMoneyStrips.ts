import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bidMoneyLine, parseBidMoneyStrip, todayYmd, type BidMoneyLine } from '../lib/bids/bidMoneyLine'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'

/**
 * Money on my bids (punch list #129, v2.5651): ONE `list_bid_money_strip` call for the page's won bid ids, a money
 * line per bid whose job the person is a person of, for the Bid Board's Money lens; the per-bid twin
 * (`useBidMoneyStrip`) stays for Edit Bid's Job block. Reads again on focus, when a job is made from a bid, and on
 * `reload` after a word is written. An error reads as no lines.
 */
export function useBidBoardMoneyStrips(bidIds: readonly string[], enabled = true): { byBid: Map<string, BidMoneyLine>; lines: BidMoneyLine[]; loaded: boolean; reload: () => void } {
  const [lines, setLines] = useState<BidMoneyLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const key = useMemo(() => [...bidIds].sort().join(','), [bidIds])

  useEffect(() => {
    if (!enabled || !key) {
      setLines([])
      setLoaded(enabled)
      return
    }
    let cancelled = false
    void supabase.rpc('list_bid_money_strip' as never, { p_bid_ids: key.split(',') } as never).then(({ data, error }) => {
      if (cancelled) return
      const today = todayYmd()
      setLines(error ? [] : parseBidMoneyStrip(data as unknown).map((e) => bidMoneyLine(e, today)))
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

  const byBid = useMemo(() => new Map(lines.filter((l) => l.bidId).map((l) => [l.bidId!, l])), [lines])
  return { byBid, lines, loaded, reload }
}
