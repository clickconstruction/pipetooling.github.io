import { useEffect, useMemo, useRef, useState } from 'react'
import { buildOfferIndex, type OfferIndex } from '../lib/materials/priceOffers'
import { loadOfferSources, type OfferSourcesRead } from '../lib/materials/priceOffersIo'
import { todayYmdInAppTz } from '../utils/dateUtils'

export type PriceOffersState = {
  /** The sources folded for matching; null until they were read. */
  index: OfferIndex | null
  loading: boolean
  /** The reason a source did not answer; the other source's offers still stand. */
  bookError: string | null
  billsError: string | null
}

/**
 * The price offers' sources (punch list #342): read once, the first time `wanted` is true, and
 * kept for as long as the screen is mounted. A test hands in its own read.
 */
export function usePriceOffers(wanted: boolean, load: () => Promise<OfferSourcesRead> = loadOfferSources): PriceOffersState {
  const [read, setRead] = useState<OfferSourcesRead | null>(null)
  const [loading, setLoading] = useState(false)
  // Asked once per mount. A ref, so starting the read does not re-run the effect and drop its answer.
  const asked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!wanted || asked.current) return
    asked.current = true
    setLoading(true)
    void load().then((r) => {
      if (!mounted.current) return
      setRead(r)
      setLoading(false)
    })
    // `load` is the module's own function unless a test hands in another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])
  const index = useMemo(() => (read ? buildOfferIndex(read.sources, todayYmdInAppTz()) : null), [read])
  return { index, loading, bookError: read?.bookError ?? null, billsError: read?.billsError ?? null }
}
