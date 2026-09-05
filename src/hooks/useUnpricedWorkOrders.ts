/**
 * Unpriced work-order drafts (Work Orders tab, PR 3 — v2.2829) — the Needs
 * You watch for the master: drafts an assistant saved without a price while
 * taking a job in. One small scan (draft rows with amount NULL); null while
 * loading, zero on error so the card stays quiet. Refreshes on
 * `work-order-changed`.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { WORK_ORDER_CHANGED_EVENT } from './useJobWorkOrderCoverage'

export type UnpricedWorkOrders = { count: number; subNames: string[]; oldestDays: number | null }

export function summarizeUnpricedWorkOrders(rows: Array<{ display_name: string; created_at: string }>, nowMs: number): UnpricedWorkOrders {
  const subNames = Array.from(new Set(rows.map((r) => r.display_name.trim()).filter(Boolean)))
  let oldestDays: number | null = null
  for (const r of rows) {
    const t = Date.parse(r.created_at)
    if (!Number.isFinite(t)) continue
    const days = Math.floor((nowMs - t) / 86400000)
    if (oldestDays == null || days > oldestDays) oldestDays = days
  }
  return { count: rows.length, subNames, oldestDays }
}

export function useUnpricedWorkOrders(enabled: boolean): { unpriced: UnpricedWorkOrders | null } {
  const [unpriced, setUnpriced] = useState<UnpricedWorkOrders | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setUnpriced(null)
      return
    }
    try {
      const { data, error } = await supabase.from('step_commitments').select('display_name, created_at').eq('status', 'draft').is('amount', null).limit(200)
      if (error) throw error
      setUnpriced(summarizeUnpricedWorkOrders((data ?? []) as Array<{ display_name: string; created_at: string }>, Date.now()))
    } catch {
      setUnpriced(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
  }, [load])

  return { unpriced }
}
