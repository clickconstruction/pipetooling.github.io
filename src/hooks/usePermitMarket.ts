import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'
import { marketBidsSince, marketPermitsSince, type CityBuilders, type MarketBid, type MarketPermit } from '../lib/research/permitMarket'
import type { CallAnswerRow } from '../lib/research/permitCallList'
import { loadBuildersOfCities, loadCallAnswers, loadMarketBids, loadMarketPermits } from '../lib/research/permitMarketIo'

/** What the Market view reads once: our bids of two years and every city's Builders rows. */
export type PermitMarketGround = { bids: MarketBid[]; builders: CityBuilders[] }

export type PermitMarketReads = {
  ground: PermitMarketGround | null
  loading: boolean
  error: string | null
  reload: () => void
  /** The city's commercial permits of twelve months. Null while they read and when the read fails. */
  permits: MarketPermit[] | null
  permitsError: string | null
  /** The answers on the call list. Null while they read. Empty before the table is on the database. */
  answers: CallAnswerRow[] | null
  answersError: string | null
  reloadAnswers: () => void
}

/**
 * The Market view's reads (punch list #405). The ground is read once when the view opens, and
 * again when `reload` is called after a mark, a kind or a tie changed: it is the same for every
 * city, so picking another city reads only that city's year of permits. The answers on the call
 * list are read once and again after each answer. A read that fails says why in its own error,
 * and the parts that do not need it still draw.
 */
export function usePermitMarket(city: string, todayYmd: string): PermitMarketReads {
  const [ground, setGround] = useState<PermitMarketGround | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asked, setAsked] = useState(0)
  const [permits, setPermits] = useState<{ city: string; rows: MarketPermit[] | null; error: string | null } | null>(null)
  const [answers, setAnswers] = useState<CallAnswerRow[] | null>(null)
  const [answersError, setAnswersError] = useState<string | null>(null)
  const [answersAsked, setAnswersAsked] = useState(0)

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
    loadMarketPermits(city, marketPermitsSince(todayYmd))
      .then((rows) => {
        if (live) setPermits({ city, rows, error: null })
      })
      .catch((e) => {
        if (live) setPermits({ city, rows: null, error: formatErrorMessage(e) })
      })
    return () => {
      live = false
    }
  }, [city, todayYmd])

  useEffect(() => {
    let live = true
    loadCallAnswers()
      .then((rows) => {
        if (!live) return
        setAnswers(rows ?? [])
        setAnswersError(null)
      })
      .catch((e) => {
        if (!live) return
        setAnswersError(formatErrorMessage(e))
        // The list still draws: with no answer read, no name is held off it.
        setAnswers((held) => held ?? [])
      })
    return () => {
      live = false
    }
  }, [answersAsked])

  const reload = useCallback(() => setAsked((n) => n + 1), [])
  const reloadAnswers = useCallback(() => setAnswersAsked((n) => n + 1), [])
  // Another city's permits are never drawn under this city's name while its own read is on the way.
  const mine = permits?.city === city ? permits : null
  return { ground, loading, error, reload, permits: mine?.rows ?? null, permitsError: mine?.error ?? null, answers, answersError, reloadAnswers }
}
