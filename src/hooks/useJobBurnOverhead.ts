import { useEffect, useState } from 'react'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { allocateJobOverheadDayShare } from '../lib/jobs/jobDayLedger'
import type { JobBurnOverheadInput } from '../lib/jobs/jobBurn'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'

/** The day ledger scans company-wide sessions; cap the window so an old job stays cheap. */
const MAX_WINDOW_DAYS = 120

/**
 * This job's overhead day-share to date and per field day (v2.3189) — Job
 * Summary's method, over [first charge day … today] capped at 120 days. Feeds
 * ONLY the Burn section's at-completion projection. Fail-soft: any error or an
 * empty window yields null and the projection simply omits overhead.
 */
export function useJobBurnOverhead(enabled: boolean, jobId: string | null, firstChargeYmd: string | null): { loading: boolean; overhead: JobBurnOverheadInput | null } {
  const [loading, setLoading] = useState(false)
  const [overhead, setOverhead] = useState<JobBurnOverheadInput | null>(null)

  useEffect(() => {
    if (!enabled || !jobId) {
      setLoading(false)
      setOverhead(null)
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
          return
        }
        const share = allocateJobOverheadDayShare(ledger, jobId)
        setOverhead({
          shareToDateUsd: share.overheadUsd,
          perFieldDayUsd: share.daysInWindow > 0 ? share.overheadUsd / share.daysInWindow : null,
        })
      } catch {
        if (!cancelled) setOverhead(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, jobId, firstChargeYmd])

  return { loading, overhead }
}
