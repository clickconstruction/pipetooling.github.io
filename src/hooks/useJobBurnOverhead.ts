import { useEffect, useState } from 'react'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { allocateJobOverheadDayShare } from '../lib/jobs/jobDayLedger'
import type { JobBurnOverheadInput } from '../lib/jobs/jobBurn'
import type { JobOverheadDayInput } from '../lib/jobChargesTimeline'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'
import { useOverheadAllocationSettings } from './useOverheadAllocationSettings'

/** The day ledger scans company-wide sessions; cap the window so an old job stays cheap. */
const MAX_WINDOW_DAYS = 120

/**
 * This job's overhead day-share to date and per field day (v2.3189) — Job
 * Summary's method and the app-wide allocation settings (v2.3260), over [first
 * charge day … today] capped at 120 days. Feeds
 * ONLY the Burn section's at-completion projection. Fail-soft: any error or an
 * empty window yields null and the projection simply omits overhead.
 */
export type JobBurnOverheadState = {
  loading: boolean
  overhead: JobBurnOverheadInput | null
  /** The share's day lines (v2.3271) — the Cost Timeline's amber band; null with `overhead`. */
  days: JobOverheadDayInput[] | null
}

export function useJobBurnOverhead(enabled: boolean, jobId: string | null, firstChargeYmd: string | null): JobBurnOverheadState {
  const [loading, setLoading] = useState(false)
  const [overhead, setOverhead] = useState<JobBurnOverheadInput | null>(null)
  const [days, setDays] = useState<JobOverheadDayInput[] | null>(null)
  // The app-wide allocation (v2.3260): the same settings Job Summary charges from, so the projection agrees with the table.
  const { appDefault: settings, loaded: settingsLoaded } = useOverheadAllocationSettings(enabled)

  useEffect(() => {
    if (enabled && !settingsLoaded) return
    if (!enabled || !jobId) {
      setLoading(false)
      setOverhead(null)
      setDays(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const endYmd = todayYmdInAppTz()
        const floor = ymdAddDays(endYmd, -MAX_WINDOW_DAYS)
        const startYmd = firstChargeYmd && firstChargeYmd > floor ? firstChargeYmd : floor
        const ledger = await loadJobDayLedger({ startYmd, endYmd, isCancelled: () => cancelled })
        if (cancelled) return
        if (!ledger) {
          setOverhead(null)
          setDays(null)
          return
        }
        const share = allocateJobOverheadDayShare(ledger, jobId, settings)
        setOverhead({
          shareToDateUsd: share.overheadUsd,
          perFieldDayUsd: share.daysInWindow > 0 ? share.overheadUsd / share.daysInWindow : null,
        })
        setDays(share.lines.map((l) => ({ dateKey: l.ymd, amount: l.shareUsd, activityUsd: l.activityUsd, carryUsd: l.carryUsd })))
      } catch {
        if (!cancelled) {
          setOverhead(null)
          setDays(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, jobId, firstChargeYmd, settings, settingsLoaded])

  return { loading, overhead, days }
}
