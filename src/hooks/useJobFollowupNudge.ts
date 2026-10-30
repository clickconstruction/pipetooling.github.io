import { useCallback, useEffect, useMemo, useState } from 'react'
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
  invalidateJobFollowupCandidatesCache,
} from '../lib/jobs/jobFollowupStore'
import { withoutZzTestJobRows } from '../lib/jobs/zzTestJobVisibility'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'

/** The idle cards' figures for the Dashboard's idle card (v2.5512): how many, the contract behind them, how many are the reader's. */
export type JobFollowupIdleNudge = { count: number; total: number; mine: number }

/** The job longest without a crew (v2.6093, punch list #178): the Quickfill station's Idle lane's Next line. */
export type JobFollowupIdleFirst = { hcpNumber: string | null; jobName: string | null; idleDays: number; need: string | null }

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
 * its names or the shared ids. `idleFirst` and `reload` (v2.6093, punch list
 * #178) serve the Quickfill station's Idle lane: the job longest without a crew,
 * and a re-read after the deck closes (the candidates cache dropped first).
 */
export function useJobFollowupNudge(
  enabled: boolean,
  options: { userId?: string | null; hideZzTestJobs?: boolean } = {},
): {
  count: number | null
  stageCounts: Record<JobFollowupStage, number> | null
  idle: JobFollowupIdleNudge | null
  /** The stalest quiet job (v2.5839, punch list #176): the Quickfill station's Next line. */
  first: { hcpNumber: string | null; jobName: string | null; quietDays: number } | null
  /** The job longest without a crew (v2.6093): the station's Idle lane's Next line; null with none. */
  idleFirst: JobFollowupIdleFirst | null
  /** Re-read the queue (the station's deck closed); the candidates cache is dropped first. */
  reload: () => void
} {
  const { userId = null, hideZzTestJobs = false } = options
  const [count, setCount] = useState<number | null>(null)
  /** The stalest quiet job (v2.5839, punch list #176): the Quickfill station's Next line. */
  const [first, setFirst] = useState<{ hcpNumber: string | null; jobName: string | null; quietDays: number } | null>(null)
  const [counts, setCounts] = useState<Record<JobFollowupStage, number> | null>(null)
  const [idle, setIdle] = useState<JobFollowupIdleNudge | null>(null)
  const [idleFirst, setIdleFirst] = useState<JobFollowupIdleFirst | null>(null)
  const [nonce, setNonce] = useState(0)
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      setCounts(null)
      setIdle(null)
      setIdleFirst(null)
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
        // The kernel deals the longest field-day gap first; the filter keeps that order.
        const topIdle = idleEntries[0]
        setIdleFirst(topIdle ? { hcpNumber: topIdle.job.hcpNumber ?? null, jobName: topIdle.job.jobName ?? null, idleDays: topIdle.idleDays ?? 0, need: topIdle.need?.words ?? null } : null)
      } catch {
        if (!cancelled) {
          setCount(0)
          setCounts(null)
          setFirst(null)
          setIdle({ count: 0, total: 0, mine: 0 })
          setIdleFirst(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd, userId, hideZzTestJobs, nonce])

  const reload = useCallback(() => {
    invalidateJobFollowupCandidatesCache()
    setNonce((n) => n + 1)
  }, [])

  return { count, stageCounts: counts, idle, first, idleFirst, reload }
}
