import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readSubLaborDueJobRows, type SubLaborDueJobRow } from '../lib/subLaborDueRows'

// The read itself lives in `lib/subLaborDueRows.ts` with the client passed in (v2.5880); this file binds the
// app's client for the pin total, the Dashboard AP card and Settings.
export type { SubLaborDueJobRow } from '../lib/subLaborDueRows'

/**
 * Per-job outstanding sub-labor balances (Jobs → Sub Labor semantics: labor items × rate,
 * minus payments and backcharges; zero-cost jobs with payments treat paid as the cost).
 * Single source of truth for the Sub Labor Due pin total and the Dashboard AP card.
 */
export function fetchSubLaborDueJobRows(): Promise<SubLaborDueJobRow[]> {
  return readSubLaborDueJobRows(supabase)
}

/** Fetches and computes Sub Labor Due total (for use outside React, e.g. Settings). */
export async function fetchSubLaborDueTotal(): Promise<number> {
  try {
    const rows = await fetchSubLaborDueJobRows()
    return rows.reduce((s, r) => s + r.balance, 0)
  } catch {
    return 0
  }
}

export function useSubLaborDueTotal(
  enabled: boolean,
  refreshKey?: number
): { total: number | null; loading: boolean } {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setTotal(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setTotal(null)

    void (async () => {
      try {
        const rows = await fetchSubLaborDueJobRows()
        if (!cancelled) setTotal(rows.reduce((s, r) => s + r.balance, 0))
      } catch {
        if (!cancelled) setTotal(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  return { total, loading }
}
