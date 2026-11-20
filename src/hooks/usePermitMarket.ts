import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'
import { marketBidsSince, marketPermitsSince, type CityBuilders, type ClockPermit, type MarketBid } from '../lib/research/permitMarket'
import { loadApplicationClock, loadBuildersOfCities, loadMarketBids } from '../lib/research/permitMarketIo'

/** What the Market view reads once: our bids of two years and every city's Builders rows. */
export type PermitMarketGround = { bids: MarketBid[]; builders: CityBuilders[] }

/**
 * The Market view's reads (punch list #405). The ground is read once when the view opens, and
 * again when `reload` is called after a mark, a kind or a tie changed: it is the same for every
 * city, so picking another city reads only that city's applications for the clock. `ground` is
 * null while it reads and when the read fails, and `error` says why. `applications` is null
 * while it reads and when it fails: the clock then draws nothing, and the table stands.
 */
export function usePermitMarket(city: string, todayYmd: string): { ground: PermitMarketGround | null; loading: boolean; error: string | null; reload: () => void; applications: ClockPermit[] | null } {
  const [ground, setGround] = useState<PermitMarketGround | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asked, setAsked] = useState(0)
  const [applications, setApplications] = useState<{ city: string; rows: ClockPermit[] } | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([loadMarketBids(marketBidsSince(todayYmd)), loadBuildersOfCities(RESEARCH_CITIES)])
      .then(([bids, builders]) => {
        if (!live) return
        setGround({ bids, builders })
        setError(null)
      })
      .catch((e) => {
        if (live) setError(formatErrorMessage(e))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [todayYmd, asked])

  useEffect(() => {
    let live = true
    loadApplicationClock(city, marketPermitsSince(todayYmd))
      .then((rows) => {
        if (live) setApplications({ city, rows })
      })
      .catch(() => {
        if (live) setApplications(null)
      })
    return () => {
      live = false
    }
  }, [city, todayYmd])

  const reload = useCallback(() => setAsked((n) => n + 1), [])
  // Another city's applications are never drawn under this city's name while its own read is on the way.
  return { ground, loading, error, reload, applications: applications?.city === city ? applications.rows : null }
}
