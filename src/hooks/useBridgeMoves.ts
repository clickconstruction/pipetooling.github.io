import { useCallback, useEffect, useState } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { myMovesNeed, type MyMovesNeed } from '../lib/bridge/callPeople'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * The week's call, for the person a move was given to (v2.6864, punch list #303 PR 4): the viewer's own open moves on
 * the Bridge's standing call, as the Needs you card's line. The read loads on demand, only when the line is on, so the
 * Dashboard's own chunk does not grow. Null while off, loading, or when no move is theirs. Refetches on window focus
 * like the neighbouring nudges. `markFirstDone` is the line's Done press: it stamps the first move and reads again.
 */
export function useBridgeMoves(enabled: boolean, userId: string | undefined): { need: MyMovesNeed | null; reload: () => void; markFirstDone: () => void } {
  const { showToast } = useToastContext()
  const [need, setNeed] = useState<MyMovesNeed | null>(null)
  const load = useCallback(async () => {
    if (!enabled || !userId) {
      setNeed(null)
      return
    }
    try {
      const { loadMyBridgeMoves } = await import('../lib/bridge/callPeopleIo')
      setNeed(myMovesNeed(await loadMyBridgeMoves(supabase)))
    } catch {
      setNeed(null)
    }
  }, [enabled, userId])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  const markFirstDone = useCallback(() => {
    const first = need?.first
    if (!first) return
    void (async () => {
      try {
        const { markMyBridgeMoveDone } = await import('../lib/bridge/callPeopleIo')
        await markMyBridgeMoveDone(supabase, first.callId, first.idx)
        showToast('Marked done. The Bridge shows it on the week’s call.', 'success', 2500)
      } catch (e) {
        showToast(formatErrorMessage(e), 'error', 4000)
      }
      await load()
    })()
  }, [need, load, showToast])
  return { need, reload: () => void load(), markFirstDone }
}
