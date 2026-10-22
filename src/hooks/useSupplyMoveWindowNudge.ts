import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type SupplyMoveWindow = {
  /** Still-current unpaid charges not on a job account, on exactly one job. */
  count: number
  /** Their dollars. */
  dollars: number
  /** How many of them have an open (unconfirmed) ask out to the house. */
  asked: number
  /** The soonest due date among them — the first window to close. 'YYYY-MM-DD'. */
  soonestDueYmd: string | null
}

/**
 * The RPC lands with its migration after the client (fail-soft below), and the generated
 * types regenerate after the push — until then the call is untyped, as other new RPCs are.
 */
const db = supabase as unknown as SupabaseClient

/**
 * The move window's Needs You line (punch list #132, the owner's ask of 2026-10-21): the
 * Accounts payable strip's four numbers from count_supply_house_move_window(), the same
 * predicate as the tab's `movableCandidates` + `isMovableAgingInvoice`. Gating lives in
 * the function — a caller who cannot work the list gets the zero row. Null while loading,
 * disabled, zero, or when the read fails (no line). Refetches on window focus.
 */
export function useSupplyMoveWindowNudge(enabled: boolean): { moveWindow: SupplyMoveWindow | null; reload: () => void } {
  const [moveWindow, setMoveWindow] = useState<SupplyMoveWindow | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setMoveWindow(null)
      return
    }
    try {
      const rows = await withSupabaseRetry(async () => await db.rpc('count_supply_house_move_window'), 'count supply house move window')
      const row = (Array.isArray(rows) ? rows[0] : undefined) as Record<string, unknown> | undefined
      const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0)
      const next: SupplyMoveWindow = {
        count: num(row?.count),
        dollars: num(row?.dollars),
        asked: num(row?.asked),
        soonestDueYmd: typeof row?.soonest_due === 'string' && row.soonest_due ? row.soonest_due.slice(0, 10) : null,
      }
      setMoveWindow(next.count > 0 ? next : null)
    } catch {
      setMoveWindow(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { moveWindow, reload: () => void load() }
}
