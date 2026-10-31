import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { FixturePull, FixturePullRow, SetAsideReason } from '../lib/bids/robotFixtures'
import { formatErrorMessage } from '../utils/errorHandling'

// bid_fixture_pulls / bid_fixture_pull_rows and the five doors land with 20261030230000_robot_fixtures (v2.6180);
// the generated types follow the push, and the names are read at run time until then.
const db = supabase as unknown as SupabaseClient

export type RobotFixturesState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'ready'; pull: FixturePull; rows: FixturePullRow[] }
  | { kind: 'failed'; message: string }

/**
 * The robot's fixtures on a bid (punch list #221, PR 3): the newest pull and its rows, and the five doors the
 * window presses — take, undo, set aside, put back, price — each a SECURITY DEFINER RPC that refuses on a sent
 * bid. `enabled` is the gate: fixtures open once the run is sealed (`buildRobotStage(...).fixturesOpen`), so a
 * closed gate reads nothing.
 */
export function useRobotFixtures(bidId: string | null, enabled: boolean): {
  state: RobotFixturesState
  reload: () => void
  take: (rowIds: string[], bidVersionId: string | null, updates: Array<{ row_id: string; count_row_id: string }>) => Promise<{ added: number; updated: number; pull_id: string }>
  untake: (pullId: string) => Promise<{ removed: number; restored: number; kept: number }>
  setAside: (rowIds: string[], reason: SetAsideReason | null) => Promise<{ set_aside: number }>
  putBack: (rowIds: string[]) => Promise<{ put_back: number; landed: number }>
  price: (bidId: string, priceBookVersionId: string) => Promise<{ priced_by_book: number; priced_by_robot: number }>
} {
  const [state, setState] = useState<RobotFixturesState>({ kind: 'idle' })
  const [gen, setGen] = useState(0)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!enabled || !bidId) {
      setState({ kind: 'idle' })
      return
    }
    let cancelled = false
    void (async () => {
      setState({ kind: 'loading' })
      try {
        const { data: pull, error } = await db.from('bid_fixture_pulls').select('id, bid_id, plan_link, ct_link, sheet_count, source, check_summary, robot_total, read_at').eq('bid_id', bidId).order('read_at', { ascending: false }).limit(1).maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (!pull) {
          setState({ kind: 'none' })
          return
        }
        const { data: rows, error: rowsErr } = await db.from('bid_fixture_pull_rows').select('*').eq('pull_id', (pull as { id: string }).id).order('sequence_order').limit(400)
        if (cancelled) return
        if (rowsErr) throw rowsErr
        setState({ kind: 'ready', pull: pull as FixturePull, rows: (rows ?? []) as FixturePullRow[] })
      } catch (e) {
        if (!cancelled) setState({ kind: 'failed', message: formatErrorMessage(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, enabled, gen])

  const call = useCallback(async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args)
    if (error) throw new Error(formatErrorMessage(error))
    return data as T
  }, [])

  return {
    state,
    reload,
    take: (rowIds, bidVersionId, updates) => call('take_robot_fixtures', { p_row_ids: rowIds, p_bid_version_id: bidVersionId, p_updates: updates }),
    untake: (pullId) => call('untake_robot_fixtures', { p_pull_id: pullId }),
    setAside: (rowIds, reason) => call('set_aside_robot_fixtures', { p_row_ids: rowIds, p_reason: reason }),
    putBack: (rowIds) => call('put_back_robot_fixtures', { p_row_ids: rowIds }),
    price: (bid, version) => call('price_robot_fixtures', { p_bid_id: bid, p_price_book_version_id: version }),
  }
}
