import { useEffect, useMemo, useState } from 'react'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import {
  computeJobFollowupQueue,
  jobFollowupIdleSummary,
  jobFollowupQuietEntries,
  jobFollowupStageCounts,
  type JobFollowupQueueEntry,
  type JobFollowupStage,
} from '../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
} from '../lib/jobs/jobFollowupStore'
import { withoutZzTestJobRows } from '../lib/jobs/zzTestJobVisibility'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'

/** The idle cards' figures for the Dashboard's idle card (v2.5512): how many, the contract behind them, how many are the reader's. */
export type JobFollowupIdleNudge = { count: number; total: number; mine: number }

/**
 * Job Follow-Up Mode queue size + stage breakdown (v2.2487): the fetch+compute
 * the dashboard banner ran inline, extracted so the Needs You card and the
 * Quickfill station read the same data. Count is null while loading, 0 on
 * error — a loading source contributes no Needs You item, an errored one
 * reports an empty queue (matching the banner it replaces).
 *
 * Since v2.5510 the count is the quiet cards alone; `idle` (v2.5512) is the
 * idle cards' summary for the Dashboard's idle card, the same queue the deck
 * deals, so the card and the deck's Idle lens say one number. With
 * `hideZzTestJobs` (punch list #61) a ZZ test job leaves the idle figures, by
 * its names or the shared ids.
 */
export function useJobFollowupNudge(
  enabled: boolean,
  options: { userId?: string | null; hideZzTestJobs?: boolean } = {},
): {
  count: number | null
  stageCounts: Record<JobFollowupStage, number> | null
  idle: JobFollowupIdleNudge | null
} {
  const { userId = null, hideZzTestJobs = false } = options
  const [count, setCount] = useState<number | null>(null)
  /** The stalest quiet job (v2.5839, punch list #176): the Quickfill station's Next line. */
  const [first, setFirst] = useState<{ hcpNumber: string | null; jobName: string | null; quietDays: number } | null>(null)
  const [counts, setCounts] = useState<Record<JobFollowupStage, number> | null>(null)
  const [idle, setIdle] = useState<JobFollowupIdleNudge | null>(null)
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      setCounts(null)
      setIdle(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [cands, revs, sets] = await Promise.all([
          fetchJobFollowupCandidates(todayYmd),
          fetchJobFollowupReviews(),
          fetchJobFollowupSettings(),
        ])
        const whole = computeJobFollowupQueue(cands, revs, sets, todayYmd)
        // The quiet cards alone (v2.5510): the idle cards have their own Dashboard card.
        const quiet = jobFollowupQuietEntries(whole)
        let idleEntries: JobFollowupQueueEntry[] = whole.filter((e) => e.why === 'idle')
        if (hideZzTestJobs && idleEntries.length > 0) {
          const zzIds = await loadZzTestJobIds(userId)
          idleEntries = withoutZzTestJobRows(
            idleEntries.map((e) => ({ entry: e, job_name: e.job.jobName, customer_name: e.job.customerName })),
            (r) => r.entry.job.id,
            zzIds,
          ).map((r) => r.entry)
        }
        if (cancelled) return
        setCount(quiet.length)
        setCounts(jobFollowupStageCounts(quiet))
        const top = quiet[0]
        setFirst(top ? { hcpNumber: top.job.hcpNumber ?? null, jobName: top.job.jobName ?? null, quietDays: top.quietDays } : null)
        setIdle(jobFollowupIdleSummary(idleEntries, userId))
      } catch {
        if (!cancelled) {
          setCount(0)
          setCounts(null)
          setFirst(null)
          setIdle({ count: 0, total: 0, mine: 0 })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd, userId, hideZzTestJobs])

  return { count, stageCounts: counts, idle, first }
}
