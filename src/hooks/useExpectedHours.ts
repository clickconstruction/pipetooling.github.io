/**
 * The expected hours (punch list #242, PR 2): the leader's or the office's target for a
 * project's hours, set in the open — who, when, from what to what and why — read by the
 * Projects board and the superintendent's phone as the line's pace budget while the Costs
 * tab's baseline stays frozen apart from it. One read of `job_expected_hours` for the jobs
 * on the board; the open target per job, the history for the Recent changes strip and the
 * one Undo come from `lib/jobs/expectedHours.ts`. Writes go through the two functions the
 * migration made, then the hook reads again so every card reads the same ledger.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { changesOf, openTargetsOf, undoOf, type ExpectedHoursChange, type ExpectedHoursRow, type ExpectedHoursTarget, type ExpectedHoursUndo } from '../lib/jobs/expectedHours'

const COLS = 'id, job_id, hours, from_hours, set_by, set_by_name, set_at, why, cleared_at, cleared_by, cleared_by_name'
const NO_ROWS: readonly ExpectedHoursRow[] = []

export type ExpectedHoursApi = {
  /** The open target per job id. */
  byJob: ReadonlyMap<string, ExpectedHoursTarget>
  /** Every change on these jobs, newest first, for the Recent changes strip. */
  history: readonly ExpectedHoursChange[]
  /** What Undo the last change would do, or null with nothing to undo. */
  undo: ExpectedHoursUndo | null
  loading: boolean
  /** The last read's or write's failure in words; null when clean. */
  error: string | null
  /** Sets a job's expected hours with the reason; `from` is what the line read before. True when it saved. */
  setTarget: (jobId: string, hours: number, from: number | null, why: string) => Promise<boolean>
  /** Back to the budget: clears the job's open target. */
  clearTarget: (jobId: string) => Promise<boolean>
  /** Puts the latest change back: the replaced target again, or the budget. */
  undoLatest: () => Promise<boolean>
  reload: () => void
}

export function useExpectedHours(jobIds: ReadonlyArray<string>, enabled = true): ExpectedHoursApi {
  const [rows, setRows] = useState<readonly ExpectedHoursRow[]>(NO_ROWS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const key = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])

  useEffect(() => {
    if (!enabled || key.length === 0) {
      setRows(NO_ROWS)
      return
    }
    const mine = ++seq.current
    const ids = key.split(',')
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const got = await fetchAllRowsChunkedIn<ExpectedHoursRow, string>(
          ids,
          (chunk, from, to) => supabase.from('job_expected_hours').select(COLS).in('job_id', chunk).order('set_at', { ascending: false }).range(from, to),
          'load expected hours ledger',
        )
        if (cancelled || mine !== seq.current) return
        setRows(got)
        setError(null)
      } catch (e: unknown) {
        if (cancelled || mine !== seq.current) return
        setError(formatErrorMessage(e, 'The expected hours could not be read.'))
      } finally {
        if (!cancelled && mine === seq.current) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const write = useCallback(
    async (name: string, run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<boolean> => {
      try {
        await withSupabaseRetry(run, name)
        setError(null)
        reload()
        return true
      } catch (e: unknown) {
        setError(formatErrorMessage(e, 'The expected hours could not be saved.'))
        return false
      }
    },
    [reload],
  )

  const setTarget = useCallback(
    (jobId: string, hours: number, from: number | null, why: string) =>
      write('set_job_expected_hours', () => supabase.rpc('set_job_expected_hours', { p_job_id: jobId, p_hours: Math.max(0, Math.round(hours)), p_from_hours: from != null ? Math.round(from) : (null as unknown as number), p_why: why.trim() })),
    [write],
  )
  const clearTarget = useCallback((jobId: string) => write('clear_job_expected_hours', () => supabase.rpc('clear_job_expected_hours', { p_job_id: jobId })), [write])

  const byJob = useMemo(() => openTargetsOf(rows), [rows])
  const history = useMemo(() => changesOf(rows), [rows])
  const undo = useMemo(() => undoOf(rows), [rows])

  const undoLatest = useCallback(async () => {
    if (!undo) return false
    return undo.kind === 'clear' ? clearTarget(undo.jobId) : setTarget(undo.jobId, undo.hours, undo.from, undo.why)
  }, [undo, clearTarget, setTarget])

  return { byJob, history, undo, loading, error, setTarget, clearTarget, undoLatest, reload }
}
