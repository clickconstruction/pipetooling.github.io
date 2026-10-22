import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildRobotAgentView, sortRobotAgents, type RobotAgentRow, type RobotAgentView } from '../lib/bids/robotAgents'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

// robot_agents / robot_rounds_stop land with 20261022..._robot_agents; the generated types follow the push.
const db = supabase as unknown as SupabaseClient

/** The status is the point of the card, so it re-reads every half minute while mounted and visible. */
export const ROBOT_AGENTS_REFRESH_MS = 30_000

/** Midnight today in the company's time zone, for the Today line. */
function todayStartMs(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(nowMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const sinceMidnightMs = ((get('hour') % 24) * 3600 + get('minute') * 60 + get('second')) * 1000
  return nowMs - sinceMidnightMs
}

/**
 * The robots' status rows (Robot rounds PR 3, punch list #142): `robot_agents()` on mount and
 * every 30 seconds while the Console is open, built into views; `stopRounds` presses Stop the
 * rounds or Start again on one key through `robot_rounds_stop` and re-reads. Fail-soft: a closed
 * read is an empty list and the card says nobody has checked in.
 */
export function useRobotAgents(opts: { enabled: boolean; canStop: boolean }): {
  agents: readonly RobotAgentView[] | null
  reload: () => void
  stopRounds: (credentialId: string, stop: boolean) => Promise<string | null>
} {
  const [rows, setRows] = useState<readonly RobotAgentRow[] | null>(null)
  const [gen, setGen] = useState(0)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!opts.enabled) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await db.rpc('robot_agents')
        if (cancelled) return
        setRows(error ? [] : ((data ?? []) as RobotAgentRow[]))
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opts.enabled, gen])

  useEffect(() => {
    if (!opts.enabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setGen((g) => g + 1)
    }, ROBOT_AGENTS_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [opts.enabled])

  const stopRounds = useCallback(async (credentialId: string, stop: boolean): Promise<string | null> => {
    try {
      const { error } = await db.rpc('robot_rounds_stop', { p_credential_id: credentialId, p_stop: stop })
      if (error) return error.message
      setGen((g) => g + 1)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }, [])

  const agents = useMemo(() => {
    if (rows === null) return null
    const now = Date.now()
    const day = todayStartMs(now)
    return sortRobotAgents(rows.map((r) => buildRobotAgentView(r, now, day, opts.canStop)))
  }, [rows, opts.canStop])

  return { agents, reload, stopRounds }
}
