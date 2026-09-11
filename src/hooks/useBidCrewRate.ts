import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { loadJobDayLedgerCached } from '../lib/jobs/jobDayLedgerSessionCache'
import { jobBurnOverheadWindow } from '../lib/jobs/jobBurnOverheadWindow'
import { APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1, parseLaborBurdenFactor } from '../lib/appSettingsKeys'
import { CREW_RATE_WINDOW_DAYS, crewRateFromLedgerDays, type CrewRate } from '../lib/bids/crewRate'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'
import { useAuth } from './useAuth'

/**
 * The company crew rate for Bids → Labor (v2.3293): the last 90 days of
 * wage-priced field hours off the job day ledger × the burden factor, plus
 * overhead per field hour (lens A) over the same days. Reads the SAME cached
 * ledger the job's Burn section loads (the office pool's first day → today),
 * so opening Labor after a job costs nothing extra. Fail-soft: any error
 * yields null and the view falls back to the bid's own rate box.
 */
export type BidCrewRateState = { loading: boolean; crewRate: CrewRate | null }

export function useBidCrewRate(enabled: boolean): BidCrewRateState {
  const [loading, setLoading] = useState(false)
  const [crewRate, setCrewRate] = useState<CrewRate | null>(null)
  const { user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false)
      setCrewRate(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const today = todayYmdInAppTz()
        const window = jobBurnOverheadWindow(null, today)
        const [ledger, burdenRes] = await Promise.all([
          loadJobDayLedgerCached({ userId, startYmd: window.startYmd, endYmd: window.endYmd, load: () => loadJobDayLedger({ startYmd: window.startYmd, endYmd: window.endYmd }) }),
          supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1).maybeSingle(),
        ])
        if (cancelled) return
        if (!ledger) {
          setCrewRate(null)
          return
        }
        const burden = parseLaborBurdenFactor(burdenRes.data?.value_num)
        setCrewRate(crewRateFromLedgerDays(ledger.days, { fromYmd: ymdAddDays(today, -CREW_RATE_WINDOW_DAYS), toYmd: today, burden }))
      } catch {
        if (!cancelled) setCrewRate(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, userId])

  return { loading, crewRate }
}
