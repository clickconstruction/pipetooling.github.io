import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { needsYouSourceEnabled } from '../lib/needsYouSources'
import { fillInRowsOrdered } from '../lib/needsYou/fillIn'
import { lostBidFillInRows, type LostBidFillInRow } from '../lib/needsYou/fillInLostBids'
import { lostBidFillInIo, type LostBidFillInIo } from '../lib/needsYou/fillInLostBidsIo'

/** The rows the deck can fill, every kind built so far. */
export type FillInRow = LostBidFillInRow

/** One object for the default io, so the read effect does not re-run on every render. */
const DEFAULT_IO: { lostBids: LostBidFillInIo } = { lostBids: lostBidFillInIo }

/**
 * The rows behind the Fill them in deck (v2.5774, punch list #146): each kind's rows read
 * under the same gate as its Needs you line, ordered as the deck walks them. `drop` takes a
 * saved row off the list at once and `restore` puts it back on Undo, so the deck never waits
 * on a reload; `reload` re-reads every kind (the window's focus, a save elsewhere).
 */
export function useFillInRows(role: UserRole | null, enabled: boolean, io: { lostBids: LostBidFillInIo } = DEFAULT_IO): {
  rows: FillInRow[]
  loading: boolean
  reload: () => void
  drop: (key: string) => void
  restore: (row: FillInRow) => void
} {
  const lostBidsOn = enabled && needsYouSourceEnabled('lostBids', role, 'quickfill')
  const [rows, setRows] = useState<FillInRow[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!lostBidsOn) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const lostBids = lostBidFillInRows(await io.lostBids.fetchSources())
        if (!cancelled) setRows(fillInRowsOrdered({ 'lost-bid': lostBids }))
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lostBidsOn, nonce, io])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const drop = useCallback((key: string) => setRows((prev) => prev.filter((r) => r.key !== key)), [])
  const restore = useCallback((row: FillInRow) => setRows((prev) => (prev.some((r) => r.key === row.key) ? prev : fillInRowsOrdered({ 'lost-bid': [...prev.filter((r) => r.kind === 'lost-bid'), row].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)) }))), [])

  return { rows, loading, reload, drop, restore }
}
