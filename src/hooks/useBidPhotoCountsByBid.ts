import { useEffect, useMemo, useState } from 'react'
import { loadBidPhotoCounts } from '../lib/bids/bidPhotosIo'

/**
 * How many photos each of the board's bids has (punch list #306, PR 3): one paged read of `bid_photos` for every bid
 * on the page, never one per row, as the plan sets ride in (`useBidPlanSetsByBid`). Null until the first read lands
 * and when it fails, so the board draws the icon grey and claims no count. `gen` re-runs the read, after the photos
 * window adds one.
 */
export function useBidPhotoCountsByBid(bidIds: ReadonlyArray<string>, enabled: boolean, gen = 0): ReadonlyMap<string, number> | null {
  const key = useMemo(() => (enabled ? [...bidIds].sort().join(',') : ''), [bidIds, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, number> | null>(null)

  useEffect(() => {
    if (!key) {
      setMap(null)
      return
    }
    let cancelled = false
    loadBidPhotoCounts(key.split(',')).then(
      (counts) => {
        if (!cancelled) setMap(counts)
      },
      () => {
        /* the count is a courtesy: the icon still opens the window */
        if (!cancelled) setMap(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, gen])

  return map
}
