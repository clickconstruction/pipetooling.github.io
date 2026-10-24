import { useCallback, useEffect, useState } from 'react'
import type { TextsLedger } from '../lib/quickfill/textsLedger'
import { todayYmdInAppTz } from '../utils/dateUtils'

export interface QuickfillTextsState {
  ledger: TextsLedger | null
  /** Texts the app prepared that wait on Today's sends, for the station's quiet line. */
  todaysSends: number
  loading: boolean
  /** The read failed: the station says Messages has the texts. */
  problem: boolean
  reload: () => void
}

/**
 * Quickfill → Texts (v2.5816, punch list #157): the day's text ledger at page level, beside the other station hooks,
 * so the metric reports from the page and stays live while the strip is collapsed. Follow up's queue and the reads
 * (`textsLedgerIo.ts`) load on demand, only for the office team, so Quickfill's own chunk does not carry them.
 * Refetches on window focus like the neighbouring nudges, and on `reload` after a mark or a send.
 */
export function useQuickfillTexts(enabled: boolean): QuickfillTextsState {
  const [state, setState] = useState<{ ledger: TextsLedger | null; todaysSends: number; loading: boolean; problem: boolean }>({ ledger: null, todaysSends: 0, loading: false, problem: false })
  const load = useCallback(async () => {
    if (!enabled) {
      setState({ ledger: null, todaysSends: 0, loading: false, problem: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    try {
      const { loadTextsLedger } = await import('../lib/quickfill/textsLedgerIo')
      const read = await loadTextsLedger(todayYmdInAppTz())
      setState({ ledger: read.ledger, todaysSends: read.todaysSends, loading: false, problem: false })
    } catch {
      setState({ ledger: null, todaysSends: 0, loading: false, problem: true })
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, load])
  return { ...state, reload: () => void load() }
}
