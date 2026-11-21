import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'
import { marketBidsSince, marketPermitsSince, type CityBuilders, type MarketBid, type MarketPermit } from '../lib/research/permitMarket'
import type { CallAnswerRow } from '../lib/research/permitCallList'
import { loadBuilderLookups, loadBuildersOfCities, loadCallAnswers, loadMarketBids, loadMarketPermits, type BuilderLookupReads } from '../lib/research/permitMarketIo'

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
  /** Asks for the city's year of permits again, after a read that failed. */
  reloadPermits: () => void
  /** The answers on the call list. Null while they read. Empty before the table is on the database, and when the first read fails. */
  answers: CallAnswerRow[] | null
  answersError: string | null
  reloadAnswers: () => void
  /** What was looked up about builders, with the checks on it. Null while it reads. Empty before the tables are on the database, and when a read fails. */
  lookups: BuilderLookupReads | null
  lookupsError: string | null
  reloadLookups: () => void
}

/**
 * The Market view's reads (punch list #405). The ground is read once when the view opens, and
 * again when `reload` is called after a mark, a kind or a tie changed: it is the same for every
 * city, so picking another city reads only that city's year of permits. The answers on the call
 * list are read once and again after each answer. A read that fails says why in its own error,
 * and the parts that do not need it still draw. `reloadPermits` and `reloadAnswers` ask again
 * after a read that failed. What was looked up about builders is read once and again after each
 * check, the same way, and `reloadLookups` asks again.
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
  const [permitsAsked, setPermitsAsked] = useState(0)
  const [lookups, setLookups] = useState<BuilderLookupReads | null>(null)
  const [lookupsError, setLookupsError] = useState<string | null>(null)
  const [lookupsAsked, setLookupsAsked] = useState(0)

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
  }, [city, todayYmd, permitsAsked])

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
        // The list still draws, and says under the reason that an answered name may be on it.
        setAnswers((held) => held ?? [])
      })
    return () => {
      live = false
    }
  }, [answersAsked])

  useEffect(() => {
    let live = true
    loadBuilderLookups()
      .then((read) => {
        if (!live) return
        setLookups(read ?? { rows: [], checks: [] })
        setLookupsError(null)
      })
      .catch((e) => {
        if (!live) return
        setLookupsError(formatErrorMessage(e))
        // The list still draws, and each Ask for block says the lookups could not be read. An earlier read is
        // dropped too, so no row shows a fact or a tag the red line says cannot be shown.
        setLookups({ rows: [], checks: [] })
      })
    return () => {
      live = false
    }
  }, [lookupsAsked])

  const reload = useCallback(() => setAsked((n) => n + 1), [])
  const reloadLookups = useCallback(() => {
    setLookupsError(null)
    setLookupsAsked((n) => n + 1)
  }, [])
  const reloadAnswers = useCallback(() => {
    setAnswersError(null)
    setAnswersAsked((n) => n + 1)
  }, [])
  const reloadPermits = useCallback(() => {
    // The failed read is dropped, so the parts that wait on it say they are reading again.
    setPermits(null)
    setPermitsAsked((n) => n + 1)
  }, [])
  // Another city's permits are never drawn under this city's name while its own read is on the way.
  const mine = permits?.city === city ? permits : null
  return { ground, loading, error, reload, permits: mine?.rows ?? null, permitsError: mine?.error ?? null, reloadPermits, answers, answersError, reloadAnswers, lookups, lookupsError, reloadLookups }
}
