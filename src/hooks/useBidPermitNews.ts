import { useEffect, useMemo, useState } from 'react'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'
import { numbersToAsk, type Chip, type SitePermitRow } from '../lib/research/bidSitePanel'
import { loadPermitsByHouseNumber } from '../lib/research/bidSiteIo'
import { bidPermitNews, type NewsBid, type NewsItem, type TakenOffPermit } from '../lib/research/bidPermitNews'
import { NO_OUR_KEYS, type OurNameKeys } from '../lib/research/ourNames'
import { foldPermitAnswers, NO_PERMIT_ANSWERS, type PermitAnswers } from '../lib/research/bidPermitAnswers'
import { loadPermitAnswers, onPermitAnswered } from '../lib/research/bidPermitAnswersIo'

const NOTHING: { chips: Map<string, Chip>; news: NewsItem[]; takenOff: TakenOffPermit[] } = { chips: new Map(), news: [], takenOff: [] }

/**
 * Permit news for the Bid Board (punch list #307, PR 5): one read for every undecided bid on the
 * board, never one per row. The house numbers of the bids that are street addresses in a city we
 * read are asked once; the chips and the news are worked out here. A failed read, or the read
 * not on the database yet, draws nothing: the board is whole without it. `ourKeys` are the names
 * that are us on a plumbing permit (`useOurPermitNames`); the board passes them in.
 * `plumbingServiceTypeId` is the Plumbing trade, so a plumbing permit is news on a plumbing bid
 * only; null leaves the trade unchecked.
 *
 * The answers people gave on a line (punch list #401) are read once beside the permits, and
 * again after each answer saved in this window. A read of them that fails keeps the answers
 * already held: the lines then show as they last stood.
 */
export function useBidPermitNews(bids: readonly NewsBid[], enabled: boolean, ourKeys: OurNameKeys = NO_OUR_KEYS, plumbingServiceTypeId: string | null = null): { chips: Map<string, Chip>; news: NewsItem[]; takenOff: TakenOffPermit[] } {
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

  const [answers, setAnswers] = useState<PermitAnswers>(NO_PERMIT_ANSWERS)
  useEffect(() => {
    if (!enabled) {
      setAnswers(NO_PERMIT_ANSWERS)
      return
    }
    let live = true
    const read = () => {
      loadPermitAnswers()
        .then((rows) => {
          // No answer is the one shared empty map, so a read that finds none draws nothing again.
          if (live) setAnswers(rows.length === 0 ? NO_PERMIT_ANSWERS : foldPermitAnswers(rows))
        })
        .catch(() => {})
    }
    read()
    const stop = onPermitAnswered(read)
    return () => {
      live = false
      stop()
    }
  }, [enabled])

  return useMemo(() => (permits ? bidPermitNews(undecided, permits, RESEARCH_CITIES, todayYmdInAppTz(), ourKeys, plumbingServiceTypeId, answers) : NOTHING), [permits, undecided, ourKeys, plumbingServiceTypeId, answers])
}
