import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * The Money in bar's data (punch list #191): the loader's fail-soft reads plus
 * the pure kernel, computed once the Financials cards' AR items are in hand.
 * `failed` names the sources that could not be read, so the bar says so
 * instead of blanking.
 */
import { buildMoneyInWeek, type MoneyInWeekView } from '../lib/moneyInWeek'
import { loadMoneyInWeek, type MoneyInSource } from '../lib/moneyInWeekLoad'
import type { FinancialItem } from '../lib/dashboardFinancials'
import { todayYmdInAppTz } from '../utils/dateUtils'

export type MoneyInWeekState = {
  view: MoneyInWeekView | null
  failed: MoneyInSource[]
  loading: boolean
  /** When the week was read, for the open bar's "as of". */
  readAtIso: string | null
  refresh: () => void
}

const EVERY_SOURCE: MoneyInSource[] = ['payments', 'drawer', 'bank', 'returns', 'pile', 'claims', 'stripe']

export function useMoneyInWeek(enabled: boolean, ar: ReadonlyArray<FinancialItem> | null, collections: ReadonlyArray<FinancialItem> | null): MoneyInWeekState {
  const [view, setView] = useState<MoneyInWeekView | null>(null)
  const [failed, setFailed] = useState<MoneyInSource[]>([])
  const [loading, setLoading] = useState(false)
  const [readAtIso, setReadAtIso] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!enabled || !ar) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const todayYmd = todayYmdInAppTz()
        const { input, failed: failedSources } = await loadMoneyInWeek(supabase, { ar, collections: collections ?? [], todayYmd })
        if (cancelled) return
        setView(buildMoneyInWeek(input))
        setFailed(failedSources)
        setReadAtIso(new Date().toISOString())
      } catch {
        if (!cancelled) setFailed(EVERY_SOURCE)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, ar, collections, tick])

  return { view, failed, loading, readAtIso, refresh }
}
