import { useEffect, useMemo, useState } from 'react'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { loadJobDayLedgerCached } from '../lib/jobs/jobDayLedgerSessionCache'
import { allocateJobOverheadDayShare, type JobOverheadDayLine } from '../lib/jobs/jobDayLedger'
import { OVERHEAD_POOL_FIRST_YMD } from '../lib/jobs/overheadAllocation'
import type { SiteOverheadRead } from '../lib/developments/scoreboard'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useAuth } from './useAuth'
import { useOverheadAllocationSettings } from './useOverheadAllocationSettings'

/**
 * Each job's overhead day share for the Development page's scoreboard (v2.6407): Job Summary's
 * method under the app-wide allocation settings, over the office pool's first day to today, the
 * same window the Job window's Burn reads, behind the same session cache, so the page and the
 * window charge one ledger. The ledger is the page's heaviest read, so it starts only when the
 * scoreboard or the Timeline view is open (`enabled`). Fail-soft: a failed read says so and the cells name it.
 */
export function useSiteOverhead(jobIds: ReadonlyArray<string>, enabled: boolean): SiteOverheadRead {
  const key = useMemo(() => (enabled && jobIds.length ? [...jobIds].sort().join(',') : ''), [jobIds, enabled])
  const [state, setState] = useState<{ key: string; read: SiteOverheadRead } | null>(null)
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { appDefault: settings, loaded: settingsLoaded } = useOverheadAllocationSettings(!!key)

  useEffect(() => {
    if (!key || !userId || !settingsLoaded) return
    let cancelled = false
    void (async () => {
      try {
        const startYmd = OVERHEAD_POOL_FIRST_YMD
        const endYmd = todayYmdInAppTz()
        const ledger = await loadJobDayLedgerCached({ userId, startYmd, endYmd, load: () => loadJobDayLedger({ startYmd, endYmd }) })
        if (cancelled) return
        if (!ledger) {
          setState({ key, read: { state: 'failed' } })
          return
        }
        const byJobId = new Map<string, { usd: number; days: number; lines: JobOverheadDayLine[] }>()
        for (const id of key.split(',')) {
          const share = allocateJobOverheadDayShare(ledger, id, settings)
          // The day lines ride with the share (v2.6498): the Timeline's amber band lands them day by day.
          byJobId.set(id, { usd: share.overheadUsd, days: share.daysInWindow, lines: share.lines })
        }
        setState({ key, read: { state: 'read', byJobId } })
      } catch {
        if (!cancelled) setState({ key, read: { state: 'failed' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, userId, settingsLoaded, settings])

  if (!key) return { state: 'off' }
  return state && state.key === key ? state.read : { state: 'reading' }
}
