import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bidMoneyLine, parseBidMoneyStrip, todayYmd, type BidMoneyLine } from '../lib/bids/bidMoneyLine'
import { buildMoneyLens, moneyLensRollup, type MoneyLens } from '../lib/bids/moneyLens'

/**
 * Money on my bids, the Dashboard's card (v2.5651, punch list #129): the signed-in person's jobs with their money
 * (`list_my_money_strip`: the bids they estimated or account-manage, the jobs they account-manage) as the lens the Bid
 * Board draws, so the card and the lens say the same words. A read that fails, or one before the push, reads as none.
 */
export function useMyMoney(enabled: boolean): { lens: MoneyLens | null; rollup: string | null; lines: BidMoneyLine[] } {
  const [lines, setLines] = useState<BidMoneyLine[]>([])
  const [lens, setLens] = useState<MoneyLens | null>(null)
  useEffect(() => {
    if (!enabled) {
      setLines([])
      setLens(null)
      return
    }
    let live = true
    void (async () => {
      try {
        const res = await supabase.rpc('list_my_money_strip' as never)
        if (!live) return
        const today = todayYmd()
        const got = res.error ? [] : parseBidMoneyStrip(res.data as unknown).map((e) => bidMoneyLine(e, today))
        setLines(got)
        setLens(buildMoneyLens({ lines: got, bids: [], authUserId: null, today, onlyMine: false }))
      } catch {
        if (live) {
          setLines([])
          setLens(null)
        }
      }
    })()
    return () => {
      live = false
    }
  }, [enabled])
  return { lens, rollup: lens ? moneyLensRollup(lens) : null, lines }
}
