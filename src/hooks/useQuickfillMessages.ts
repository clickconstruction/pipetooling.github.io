import { useCallback, useEffect, useState } from 'react'
import { useMessagesLive } from '../components/gc/messages/useMessagesLive'
import type { MessagesStation } from '../lib/quickfill/messagesStation'
import type { TextsLedger } from '../lib/quickfill/textsLedger'
import { todayYmdInAppTz } from '../utils/dateUtils'

export interface QuickfillMessagesState {
  station: MessagesStation | null
  ledger: TextsLedger | null
  /** Texts the app prepared that wait on Today's sends, for the ledger's quiet line. */
  todaysSends: number
  loading: boolean
  /** The read failed: the station says Messages has the lanes. */
  problem: boolean
  reload: () => void
}

/**
 * Quickfill → Messages (v2.6098, punch list #178): the station's lanes and the Texts ledger from one read at page
 * level, beside the other station hooks, so the metric reports from the page and stays live while the strip is
 * collapsed. Follow up's kernels load on demand, only for the office team, so Quickfill's own chunk does not carry
 * them. Re-reads on window focus, after a mark or a send (`reload`), and when the Messages tables change
 * (`useMessagesLive`, the header badge's own bus), so the count follows the page.
 */
export function useQuickfillMessages(enabled: boolean): QuickfillMessagesState {
  const [state, setState] = useState<{ station: MessagesStation | null; ledger: TextsLedger | null; todaysSends: number; loading: boolean; problem: boolean }>({ station: null, ledger: null, todaysSends: 0, loading: false, problem: false })
  const load = useCallback(async () => {
    if (!enabled) {
      setState({ station: null, ledger: null, todaysSends: 0, loading: false, problem: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    try {
      const { loadMessagesStation } = await import('../lib/quickfill/messagesStationIo')
      const read = await loadMessagesStation(todayYmdInAppTz())
      setState({ station: read.station, ledger: read.ledger, todaysSends: read.todaysSends, loading: false, problem: false })
    } catch {
      setState({ station: null, ledger: null, todaysSends: 0, loading: false, problem: true })
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
  useMessagesLive(enabled, () => void load())
  return { ...state, reload: () => void load() }
}
