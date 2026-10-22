import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { robotProgressByBid, type RobotProgress, type RobotProgressRow } from '../lib/bids/robotProgress'

// robot_progress lands with 20261022..._robot_progress; the generated types follow in the types PR.
const db = supabase as unknown as SupabaseClient

/** How often the board re-reads while it is open: a heartbeat comes every five minutes, so a minute is plenty. */
export const ROBOT_PROGRESS_REFRESH_MS = 60_000

/**
 * The robots' progress on a set of human bids (Robot rounds PR 2): one `robot_progress()` call for
 * the bids on screen, rebuilt every minute while mounted so "last word 2m ago" and the quiet line
 * stay true without a reload. Fail-soft: an RLS-closed read or a missing function is an empty map,
 * and the icon falls back to its own state.
 */
export function useRobotProgress(bidIds: readonly string[], opts: { enabled: boolean }): { byBid: ReadonlyMap<string, RobotProgress>; rows: readonly RobotProgressRow[]; reload: () => void } {
  const key = useMemo(() => [...bidIds].sort().join(','), [bidIds])
  const [rows, setRows] = useState<readonly RobotProgressRow[]>([])
  const [gen, setGen] = useState(0)
  const alive = useRef(true)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    alive.current = true
    if (!opts.enabled || !key) {
      setRows([])
      return
    }
    const ids = key.split(',')
    void (async () => {
      try {
        const { data, error } = await db.rpc('robot_progress', { p_bid_ids: ids })
        if (!alive.current || error) return
        setRows((data ?? []) as RobotProgressRow[])
      } catch {
        /* the icon falls back to its own state */
      }
    })()
    return () => {
      alive.current = false
    }
  }, [key, opts.enabled, gen])

  // The clock: every minute while the tab is visible, re-read so the relative times and the quiet rule move.
  useEffect(() => {
    if (!opts.enabled || !key) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      setGen((g) => g + 1)
    }, ROBOT_PROGRESS_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [key, opts.enabled])

  // A fresh read is a fresh array, so the clock moves with it.
  const byBid = useMemo(() => robotProgressByBid(rows, Date.now()), [rows])
  return { byBid, rows, reload }
}

/** One signal or stamp of a robot's run on a bid, oldest first (`robot_run_signals`). */
export type RobotRunSignal = { at: string; kind: 'signal' | 'stamp'; state: string | null; stage: string | null; progress: RobotProgressRow['heartbeat_progress']; words: string }

/** Read the run: the bid's signals and stamps, loaded when the fold opens. */
export function useRobotRunSignals(bidId: string | null): { signals: readonly RobotRunSignal[] | null; loading: boolean } {
  const [signals, setSignals] = useState<readonly RobotRunSignal[] | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!bidId) {
      setSignals(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await db.rpc('robot_run_signals', { p_bid_id: bidId })
        if (cancelled) return
        setSignals(error ? [] : ((data ?? []) as RobotRunSignal[]))
      } catch {
        if (!cancelled) setSignals([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId])
  return { signals, loading }
}
