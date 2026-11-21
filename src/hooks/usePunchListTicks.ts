import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOptionalToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import {
  TICKS_READ_FAILED,
  canTick,
  readTicks,
  tickSaveFailed,
  withTick,
  withoutTick,
  type PunchTick,
  type TickCard,
} from '../lib/todos/punchListTicks'
import type { BoardItem } from '../lib/todos/todoBoard'

/**
 * The Punch list's ticks: the person's own "I am working on this" rows in `punch_list_ticks`, one
 * per card number. The rules (what shows, what a move wipes) are `lib/todos/punchListTicks.ts`; this
 * hook reads, writes and clears.
 *
 * Reads: one select on mount and whenever the tab comes back to the front, so a tick made at the
 * desk is on the phone the next time it is looked at. A failed read leaves the cards alone and
 * hands back a `failure` for the page to say.
 *
 * Writes: a tick is an upsert of the card's section today, an untick a delete. The box changes at
 * once; when the save fails it goes back as it was and a toast says why.
 *
 * Clears: a row whose card moved to another section or left the list is deleted here, with no
 * press, when `mayClear` allows it. The page holds that on a dev server (a branch's board can be
 * behind `main`) and under View as (a look writes nothing with no press).
 */
export function usePunchListTicks({
  enabled,
  userId,
  cards,
  boardVersion,
  mayClear,
}: {
  enabled: boolean
  userId: string | null | undefined
  cards: readonly TickCard[]
  boardVersion: string
  mayClear: boolean
}): {
  ticked: ReadonlySet<number>
  failure: OfflineRecoveryLastError | null
  loading: boolean
  reload: () => Promise<void>
  toggle: (card: Pick<BoardItem, 'number' | 'group'>, next: boolean) => Promise<void>
} {
  const toasts = useOptionalToastContext()
  const [ticks, setTicks] = useState<PunchTick[]>([])
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(false)
  const ticksRef = useRef<PunchTick[]>(ticks)
  ticksRef.current = ticks
  /** Bumped by every press, at its start and its end: a read that a press overlapped is dropped, so it cannot undo the press. */
  const presses = useRef(0)
  /** The numbers this page already tried to clear, so a refused delete is not asked again on every draw. */
  const cleared = useRef<Set<number>>(new Set())

  const reload = useCallback(async () => {
    if (!enabled || !userId) return
    const at = presses.current
    setLoading(true)
    try {
      const { data, error } = await supabase.from('punch_list_ticks').select('card_number, section, board_version').eq('user_id', userId)
      if (error) throw error
      if (at !== presses.current) return
      setTicks((data ?? []).map((r) => ({ cardNumber: r.card_number, section: r.section, boardVersion: r.board_version })))
      setFailure(null)
    } catch (e) {
      if (at === presses.current) setFailure(recoveryFailureFromError(e, TICKS_READ_FAILED))
    } finally {
      setLoading(false)
    }
  }, [enabled, userId])

  useEffect(() => {
    void reload()
    const onFront = (): void => {
      if (document.visibilityState === 'visible') void reload()
    }
    window.addEventListener('focus', onFront)
    document.addEventListener('visibilitychange', onFront)
    return () => {
      window.removeEventListener('focus', onFront)
      document.removeEventListener('visibilitychange', onFront)
    }
  }, [reload])

  const read = useMemo(() => readTicks(ticks, cards, boardVersion), [ticks, cards, boardVersion])

  // A card moved or left the list: its row goes, with nobody having to notice the move.
  useEffect(() => {
    if (!mayClear || !userId) return
    const stale = read.stale.filter((n) => !cleared.current.has(n))
    if (stale.length === 0) return
    for (const n of stale) cleared.current.add(n)
    void (async () => {
      try {
        const { error } = await supabase.from('punch_list_ticks').delete().eq('user_id', userId).in('card_number', stale)
        if (!error) setTicks((now) => withoutTick(now, ...stale))
      } catch {
        // The rows are not shown either way; the next visit tries again.
      }
    })()
  }, [mayClear, userId, read.stale])

  const toggle = useCallback(
    async (card: Pick<BoardItem, 'number' | 'group'>, next: boolean) => {
      if (!userId || !canTick(card)) return
      const prior = ticksRef.current.find((t) => t.cardNumber === card.number)
      presses.current += 1
      cleared.current.delete(card.number)
      setTicks((now) => (next ? withTick(now, card, boardVersion) : withoutTick(now, card.number)))
      try {
        const { error } = next
          ? await supabase
              .from('punch_list_ticks')
              .upsert({ user_id: userId, card_number: card.number, section: card.group, board_version: boardVersion }, { onConflict: 'user_id,card_number' })
          : await supabase.from('punch_list_ticks').delete().eq('user_id', userId).eq('card_number', card.number)
        if (error) throw error
      } catch (e) {
        // Back as it was: this card's row alone, so a press made on another card meanwhile stays.
        setTicks((now) => {
          const rest = withoutTick(now, card.number)
          return prior ? [...rest, prior] : rest
        })
        toasts?.showToast(formatErrorMessage(e, tickSaveFailed(card, next)), 'error')
      } finally {
        presses.current += 1
      }
    },
    [userId, boardVersion, toasts],
  )

  return { ticked: read.ticked, failure, loading, reload, toggle }
}
