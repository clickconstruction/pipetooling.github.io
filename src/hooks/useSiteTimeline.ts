import { useEffect, useMemo, useState } from 'react'
import { fetchLabelIdByTxId, loadCategoryTags } from '../lib/banking/categoryTagsData'
import type { SiteCostsRead } from '../lib/developments/siteCosts'
import { siteFuelTxIds } from '../lib/developments/siteTimeline'

export type SiteTimelineRead =
  | { state: 'off' }
  | { state: 'reading' }
  | {
      state: 'read'
      /** The card charges in the fuel family's tag, the Timeline's ⛽ stream. */
      fuelTxIds: ReadonlySet<string>
      /** False when the tags or the labels would not read: the card line then keeps the fuel. */
      fuelKnown: boolean
    }

/**
 * What the Development page's Timeline reads past the site's costs and the clock (v2.6493, punch list
 * #257): the fuel split of the site's card charges, the tags and the accounting labels read once for
 * every charge on the site, never per job, and only while the view is open (`enabled`) and once the
 * cost rows are in. A failed tag read is no failure of the chart: the fuel stays on the card line.
 */
export function useSiteTimeline(costs: SiteCostsRead | undefined, enabled: boolean): SiteTimelineRead {
  const rows = enabled && costs?.state === 'read' ? costs.rows : undefined
  const key = useMemo(() => (rows ? `tx:${[...new Set(rows.cardAlloc.map((r) => r.mercury_transaction_id).filter((id): id is string => !!id))].sort().join(',')}` : ''), [rows])
  const [state, setState] = useState<{ key: string; read: SiteTimelineRead } | null>(null)

  useEffect(() => {
    if (!key || !rows) return
    const ids = key.slice(3).split(',').filter(Boolean)
    if (ids.length === 0) {
      setState({ key, read: { state: 'read', fuelTxIds: new Set(), fuelKnown: true } })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [tagRows, labelIdByTxId] = await Promise.all([loadCategoryTags(), fetchLabelIdByTxId(ids)])
        if (cancelled) return
        setState({ key, read: { state: 'read', fuelTxIds: siteFuelTxIds({ cardAlloc: rows.cardAlloc, tags: tagRows.tags, members: tagRows.members, labelIdByTxId }), fuelKnown: true } })
      } catch {
        if (!cancelled) setState({ key, read: { state: 'read', fuelTxIds: new Set(), fuelKnown: false } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, rows])

  if (!enabled) return { state: 'off' }
  if (!key) return { state: 'reading' }
  return state && state.key === key ? state.read : { state: 'reading' }
}
