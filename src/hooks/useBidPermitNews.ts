import { useEffect, useMemo, useState } from 'react'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'
import { numbersToAsk, type Chip, type SitePermitRow } from '../lib/research/bidSitePanel'
import { loadPermitsByHouseNumber } from '../lib/research/bidSiteIo'
import { bidPermitNews, type NewsBid, type NewsItem } from '../lib/research/bidPermitNews'
import { NO_OUR_KEYS, type OurNameKeys } from '../lib/research/ourNames'

const NOTHING: { chips: Map<string, Chip>; news: NewsItem[] } = { chips: new Map(), news: [] }

/**
 * Permit news for the Bid Board (punch list #307, PR 5): one read for every undecided bid on the
 * board, never one per row. The house numbers of the bids that are street addresses in a city we
 * read are asked once; the chips and the news are worked out here. A failed read, or the read
 * not on the database yet, draws nothing: the board is whole without it. `ourKeys` are the names
 * that are us on a plumbing permit (`useOurPermitNames`); the board passes them in.
 */
export function useBidPermitNews(bids: readonly NewsBid[], enabled: boolean, ourKeys: OurNameKeys = NO_OUR_KEYS): { chips: Map<string, Chip>; news: NewsItem[] } {
  const undecided = useMemo(() => (enabled ? bids.filter((b) => b.outcome == null) : []), [bids, enabled])
  const asks = useMemo(() => numbersToAsk(undecided, RESEARCH_CITIES), [undecided])
  // The read runs again only when the set of house numbers changes, not on every reload of the board.
  const asksKey = useMemo(() => [...asks].map(([city, numbers]) => `${city}:${[...numbers].sort().join(',')}`).join('|'), [asks])
  const [permits, setPermits] = useState<Map<string, SitePermitRow[]> | null>(null)

  useEffect(() => {
    if (asksKey === '') {
      setPermits(null)
      return
    }
    let live = true
    ;(async () => {
      const out = new Map<string, SitePermitRow[]>()
      for (const part of asksKey.split('|')) {
        const [city, list] = part.split(':')
        if (!city || !list) continue
        const rows = await loadPermitsByHouseNumber(city, list.split(','))
        if (rows == null) return null
        out.set(city, rows)
      }
      return out
    })()
      .then((map) => {
        if (live) setPermits(map)
      })
      .catch(() => {
        if (live) setPermits(null)
      })
    return () => {
      live = false
    }
  }, [asksKey])

  return useMemo(() => (permits ? bidPermitNews(undecided, permits, RESEARCH_CITIES, todayYmdInAppTz(), ourKeys) : NOTHING), [permits, undecided, ourKeys])
}
