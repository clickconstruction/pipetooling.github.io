import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stageProgressRowsFromRpc, type StageProgressRow } from '../lib/reports/stageProgressReport'
import {
  defaultOpenLine,
  jobPercentFromLines,
  linesModeAvailable,
  movedLines,
  type LinePicks,
  type MovedLine,
} from '../lib/reports/lineProgressReport'

/**
 * Report by line (punch list #130, v2.5663): one hook behind every door that
 * asks for a job's percent — the New report and Additional report windows and
 * the My Schedule stepper. It reads the job's priced lines through
 * `list_job_stage_progress` (SECURITY DEFINER: field roles cannot read line
 * items) and the job's recorded percent, keeps the tech's picks, and says what
 * the lines add up to. A one-line job, a refused or missing RPC (a client
 * ahead of a push) or any error reads as no lines, and the caller keeps its
 * slider — the v2.3192 fallback, unchanged.
 */

type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

// Bound: a detached `supabase.rpc` loses `this` and throws before the request leaves. Cast the
// client, not `rpc.bind` (binding the typed overloads trips TS2589 as database.ts grows).
function untypedRpc(): UntypedRpc {
  const client = supabase as unknown as { rpc: UntypedRpc }
  return (fn, args) => client.rpc(fn, args)
}

export type JobLineProgress = {
  /** The job's priced lines when there are two or more and the list is on; null = the plain slider. */
  lines: StageProgressRow[] | null
  /** True when the job has two or more lines, whether or not the list is on. */
  hasLines: boolean
  linesMode: boolean
  setLinesMode: (on: boolean) => void
  picks: LinePicks
  setPick: (fixtureId: string, pct: number) => void
  openId: string | null
  setOpenId: (id: string | null) => void
  /** `jobs_ledger.pct_complete`, the job's number on record (the office may have typed it). */
  recordedPct: number | null
  /** What the lines say with the picks; null while the list is off. */
  derivedPct: number | null
  moved: MovedLine[]
}

export function useJobLineProgress(jobId: string | null | undefined, open: boolean): JobLineProgress {
  const [loaded, setLoaded] = useState<{ jobId: string; rows: StageProgressRow[]; recordedPct: number | null } | null>(null)
  const [linesMode, setLinesMode] = useState(true)
  const [picks, setPicks] = useState<LinePicks>({})
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLinesMode(true)
    setPicks({})
    setOpenId(null)
    if (!open || !jobId) {
      setLoaded(null)
      return
    }
    void (async () => {
      try {
        const { data, error } = await untypedRpc()('list_job_stage_progress', { p_job_id: jobId })
        if (cancelled) return
        if (error || !Array.isArray(data)) {
          setLoaded(null)
          return
        }
        const rows = stageProgressRowsFromRpc(data as Parameters<typeof stageProgressRowsFromRpc>[0])
        if (!linesModeAvailable(rows)) {
          setLoaded(null)
          return
        }
        // The recorded number is a courtesy for the job line's "was"; a failed read keeps the list.
        let recordedPct: number | null = null
        try {
          const { data: jobRow } = await supabase.from('jobs_ledger').select('pct_complete').eq('id', jobId).maybeSingle()
          const pct = (jobRow as { pct_complete?: number | null } | null)?.pct_complete
          recordedPct = pct != null && Number.isFinite(Number(pct)) ? Number(pct) : null
        } catch {
          recordedPct = null
        }
        if (cancelled) return
        setLoaded({ jobId, rows, recordedPct })
        setOpenId(defaultOpenLine(rows)?.fixtureId ?? null)
      } catch {
        if (!cancelled) setLoaded(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, jobId])

  const current = loaded && jobId && loaded.jobId === jobId ? loaded : null
  const lines = current && linesMode ? current.rows : null
  const setPick = useCallback((fixtureId: string, pct: number) => {
    setPicks((prev) => (prev[fixtureId] === pct ? prev : { ...prev, [fixtureId]: pct }))
  }, [])
  const derivedPct = useMemo(() => (lines ? jobPercentFromLines(lines, picks) : null), [lines, picks])
  const moved = useMemo(() => (lines ? movedLines(lines, picks) : []), [lines, picks])

  return {
    lines,
    hasLines: current != null,
    linesMode,
    setLinesMode,
    picks,
    setPick,
    openId,
    setOpenId,
    recordedPct: current?.recordedPct ?? null,
    derivedPct,
    moved,
  }
}

/**
 * Stamp each moved line on its row through `record_stage_progress`, one call a
 * line, best-effort: the report already carries the numbers, and a client
 * ahead of a push (or a refused call) must never strand the tech.
 */
export async function stampMovedLines(jobId: string, moved: ReadonlyArray<MovedLine>, reportId: string | null): Promise<void> {
  const rpc = untypedRpc()
  for (const m of moved) {
    try {
      await rpc('record_stage_progress', { p_job_id: jobId, p_fixture_id: m.fixtureId, p_pct: m.to, p_report_id: reportId })
    } catch {
      /* best-effort */
    }
  }
}
