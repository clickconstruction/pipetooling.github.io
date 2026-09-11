import { useEffect, useState } from 'react'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { loadJobDayLedgerCached } from '../lib/jobs/jobDayLedgerSessionCache'
import { allocateJobOverheadDayShare, jobOverheadPerFieldDaySince } from '../lib/jobs/jobDayLedger'
import { JOB_BURN_OVERHEAD_RATE_DAYS, jobBurnOverheadWindow } from '../lib/jobs/jobBurnOverheadWindow'
import type { JobBurnOverheadInput } from '../lib/jobs/jobBurn'
import type { JobOverheadDayInput } from '../lib/jobChargesTimeline'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'
import { useAuth } from './useAuth'
import { useOverheadAllocationSettings } from './useOverheadAllocationSettings'

/**
 * This job's overhead day-share to date and per field day (v2.3189) — Job
 * Summary's method and the app-wide allocation settings (v2.3260), over
 * the office pool's first day … today (v2.3289: the same window for every job,
 * behind the shared session cache, so job windows read one ledger; the rate
 * stays recent). Feeds the Burn section's at-completion projection and the Cost
 * Timeline's amber band (v2.3271). Fail-soft: any error or an empty window
 * yields null and the projection simply omits overhead.
 */
export type JobBurnOverheadState = {
  loading: boolean
  overhead: JobBurnOverheadInput | null
  /** The share's day lines (v2.3271) — the Cost Timeline's amber band; null with `overhead`. */
  days: JobOverheadDayInput[] | null
  /** When the window's floor cut off part of the job's history: the first day charged (v2.3289). Null when nothing was cut. */
  sinceYmd: string | null
}

export function useJobBurnOverhead(enabled: boolean, jobId: string | null, firstEventYmd: string | null): JobBurnOverheadState {
  const [loading, setLoading] = useState(false)
  const [overhead, setOverhead] = useState<JobBurnOverheadInput | null>(null)
  const [days, setDays] = useState<JobOverheadDayInput[] | null>(null)
  const [sinceYmd, setSinceYmd] = useState<string | null>(null)
  const { user } = useAuth()
  const userId = user?.id ?? null
  // The app-wide allocation (v2.3260): the same settings Job Summary charges from, so the projection agrees with the table.
  const { appDefault: settings, loaded: settingsLoaded } = useOverheadAllocationSettings(enabled)

  useEffect(() => {
    if (enabled && !settingsLoaded) return
    if (!enabled || !jobId || !userId) {
      setLoading(false)
      setOverhead(null)
      setDays(null)
      setSinceYmd(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const window = jobBurnOverheadWindow(firstEventYmd, todayYmdInAppTz())
        const ledger = await loadJobDayLedgerCached({ userId, startYmd: window.startYmd, endYmd: window.endYmd, load: () => loadJobDayLedger({ startYmd: window.startYmd, endYmd: window.endYmd }) })
        if (cancelled) return
        if (!ledger) {
          setOverhead(null)
          setDays(null)
          setSinceYmd(null)
          return
        }
        const share = allocateJobOverheadDayShare(ledger, jobId, settings)
        setOverhead({
          shareToDateUsd: share.overheadUsd,
          perFieldDayUsd: jobOverheadPerFieldDaySince(share.lines, ymdAddDays(window.endYmd, -JOB_BURN_OVERHEAD_RATE_DAYS)),
        })
        setDays(share.lines.map((l) => ({ dateKey: l.ymd, amount: l.shareUsd, activityUsd: l.activityUsd, carryUsd: l.carryUsd })))
        setSinceYmd(window.sinceYmd)
      } catch {
        if (!cancelled) {
          setOverhead(null)
          setDays(null)
          setSinceYmd(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, jobId, userId, firstEventYmd, settings, settingsLoaded])

  return { loading, overhead, days, sinceYmd }
}
