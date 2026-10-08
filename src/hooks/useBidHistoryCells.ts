import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { buildBidCellHistoryIndex, type BidCellHistoryIndex, type BidCellHistoryRpcRow } from '../lib/bids/bidCellHistory'

/**
 * Bid history under the cells (punch list #73, PR 3): the switch, and the read behind it.
 *
 * - `useBidHistoryCellsSwitch()`: whether the bid tabs show each cell's past. Off by default;
 *   remembered on this device (localStorage; the door sits on every bid tab, so it reads no auth
 *   context a tab's tests may not have), and every tab hears a flip at once (a window event), so
 *   the switch beside the History door turns all four tabs.
 * - `BidCellHistoryProvider`: one read of `latest_bid_cell_history` for the bid on screen while
 *   the switch is on, shared by every `BidCellPast` under it. Off, nothing is read.
 */
const KEY = 'bid_history_cells_v1'
const EVENT = 'bid-history-cells-changed'

function readSwitch(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function useBidHistoryCellsSwitch(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readSwitch)
  useEffect(() => {
    const hear = () => setOn(readSwitch())
    window.addEventListener(EVENT, hear)
    return () => window.removeEventListener(EVENT, hear)
  }, [])
  const set = useCallback((next: boolean) => {
    try {
      globalThis.localStorage?.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // Private window or blocked storage: the switch still flips for this page.
    }
    setOn(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return [on, set]
}

export type BidCellHistoryContextValue = { on: boolean; index: BidCellHistoryIndex | null; now: Date; bidId: string | null }

const BidCellHistoryContext = createContext<BidCellHistoryContextValue>({ on: false, index: null, now: new Date(0), bidId: null })

export function useBidCellHistoryContext(): BidCellHistoryContextValue {
  return useContext(BidCellHistoryContext)
}

/** Load the bid's cell history while the switch is on; a failed read shows no past (the cells stay as they were). */
export function BidCellHistoryProvider({
  bidId,
  children,
  load = loadBidCellHistory,
}: {
  bidId: string | null | undefined
  children: ReactNode
  load?: (bidId: string) => Promise<BidCellHistoryRpcRow[]>
}) {
  const [on] = useBidHistoryCellsSwitch()
  const [index, setIndex] = useState<BidCellHistoryIndex | null>(null)
  const [now, setNow] = useState(() => new Date())
  // Read again when the window comes back to the front: another device or person may have typed.
  const [readNo, setReadNo] = useState(0)
  useEffect(() => {
    if (!on) return
    const again = () => setReadNo((n) => n + 1)
    window.addEventListener('focus', again)
    return () => window.removeEventListener('focus', again)
  }, [on])
  useEffect(() => {
    if (!on || !bidId) {
      setIndex(null)
      return
    }
    let cancelled = false
    load(bidId).then(
      (rows) => {
        if (cancelled) return
        setIndex(buildBidCellHistoryIndex(rows))
        setNow(new Date())
      },
      () => { if (!cancelled) setIndex(null) },
    )
    return () => { cancelled = true }
  }, [on, bidId, load, readNo])
  const value = useMemo(() => ({ on, index, now, bidId: bidId ?? null }), [on, index, now, bidId])
  return createElement(BidCellHistoryContext.Provider, { value }, children)
}

export async function loadBidCellHistory(bidId: string): Promise<BidCellHistoryRpcRow[]> {
  const { data, error } = await supabase.rpc('latest_bid_cell_history', { p_bid_id: bidId })
  if (error) throw new Error(error.message)
  return (data ?? []) as BidCellHistoryRpcRow[]
}
