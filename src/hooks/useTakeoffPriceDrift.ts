import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { takeoffPriceDrift, type BookPrice, type TakeoffDrift } from '../lib/bids/takeoffPriceDrift'
import { loadBookPrices, loadTakeoffDriftLines } from '../lib/bids/takeoffPriceDriftIo'

/**
 * Today's book price of each row a takeoff's lines were picked from (v2.4395). Re-reads when the
 * set of rows changes; an empty map while it reads or when the read fails (the line then says nothing).
 */
export function useBookPrices(priceIds: ReadonlyArray<string>, enabled = true): ReadonlyMap<string, BookPrice> {
  const key = useMemo(() => [...new Set(priceIds.filter(Boolean))].sort().join(','), [priceIds])
  const [book, setBook] = useState<ReadonlyMap<string, BookPrice>>(new Map())
  useEffect(() => {
    if (!enabled || !key) {
      setBook(new Map())
      return
    }
    let cancelled = false
    void loadBookPrices(supabase, key.split(','))
      .then((m) => {
        if (!cancelled) setBook(m)
      })
      .catch(() => {
        if (!cancelled) setBook(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [key, enabled])
  return book
}

/** One bid version's materials at today's book, read whole (Pricing's row, v2.4395); null until read. */
export function useTakeoffPriceDrift(args: { bidId: string | null | undefined; versionId: string | null; enabled: boolean }): TakeoffDrift | null {
  const { bidId, versionId, enabled } = args
  const [drift, setDrift] = useState<TakeoffDrift | null>(null)
  useEffect(() => {
    setDrift(null)
    if (!enabled || !bidId) return
    let cancelled = false
    void (async () => {
      try {
        const lines = await loadTakeoffDriftLines(supabase, { bidId, versionId })
        const book = await loadBookPrices(supabase, lines.map((l) => l.sourcePriceId ?? '').filter(Boolean))
        if (!cancelled) setDrift(takeoffPriceDrift(lines, book))
      } catch {
        if (!cancelled) setDrift(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, versionId, enabled])
  return drift
}
