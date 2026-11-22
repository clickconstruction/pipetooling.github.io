import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOptionalToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import {
  TICKS_READ_FAILED,
  canTick,
  readTicks,
  stillOnFailed,
  tickSaveFailed,
  withTick,
  withoutTick,
  type PunchTick,
} from '../lib/todos/punchListTicks'
import { readClaims, type ClaimCard, type ClaimsRead } from '../lib/todos/punchListClaims'
import type { BoardItem } from '../lib/todos/todoBoard'

/**
 * The Punch list's ticks: the rows of `punch_list_ticks`, one per person and card number. A tick is
 * a claim since v2.8226, so the read is every person's rows, each with its claimer's name, and the
 * writes are still the person's own. The rules (what shows, what a move wipes) are
 * `lib/todos/punchListTicks.ts`, and who holds a card and when a claim goes quiet is
 * `lib/todos/punchListClaims.ts`; this hook reads, writes and clears.
 *
 * Reads: one select on mount and whenever the tab comes back to the front, so a tick made at the
 * desk is on the phone the next time it is looked at, and another person's claim shows when the
 * board is looked at again. A failed read leaves the cards alone and hands back a `failure` for the
 * page to say.
 *
 * Writes: a tick is an upsert of the card's section today, an untick a delete, and Still on it the
 * same upsert again, which moves the row's time. The box changes at once; when the save fails it
 * goes back as it was and a toast says why.
 *
 * Clears: the person's own row whose card moved to another section or left the list is deleted
 * here, with no press, when `mayClear` allows it. So is their own claim gone quiet, where a quiet
 * tick is wiped (`OWN_TICK_AFTER_QUIET`). The page holds that on a dev server (a branch's board can
 * be behind `main`) and under View as (a look writes nothing with no press). Nobody's row but the
 * person's own is ever deleted.
 *
 * `nowMs` is the page's clock: fresh or quiet is worked out from it each time it moves.
 */
export function usePunchListTicks({
  enabled,
  userId,
  userName,
  cards,
  boardVersion,
  mayClear,
  touched,
  nowMs,
}: {
  enabled: boolean
  userId: string | null | undefined
  /** The person's name for the row drawn before the save answers; the database stamps its own. */
  userName?: string | null
  cards: readonly ClaimCard[]
  boardVersion: string
  mayClear: boolean
  /** When each card last changed on main, by slug, as the build read it (`PunchListHistory.touched`). */
  touched?: Readonly<Record<string, number>>
  nowMs: number
}): {
  /** Who is on each card, for this person, at `nowMs`. */
  claims: ClaimsRead
  /** The numbers of the cards the person's own tick shows on. */
  ticked: ReadonlySet<number>
  failure: OfflineRecoveryLastError | null
  loading: boolean
  reload: () => Promise<void>
  toggle: (card: Pick<BoardItem, 'number' | 'group'>, next: boolean) => Promise<void>
  /** Still on it: the person's claim on the card is fresh again from now. */
  stillOn: (card: Pick<BoardItem, 'number' | 'group'>) => Promise<void>
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
      const { data, error } = await supabase.from('punch_list_ticks').select('user_id, card_number, section, board_version, claimer_name, ticked_at')
      if (error) throw error
      if (at !== presses.current) return
      setTicks(
        (data ?? []).map((r) => ({
          userId: r.user_id,
          cardNumber: r.card_number,
          section: r.section,
          boardVersion: r.board_version,
          claimerName: r.claimer_name ?? '',
          tickedAt: r.ticked_at ?? '',
        })),
      )
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

  const read = useMemo(() => readTicks(ticks, cards, boardVersion, userId), [ticks, cards, boardVersion, userId])
  const claims = useMemo(
    () => readClaims({ ticks, cards, boardVersion, me: userId, touched, nowMs }),
    [ticks, cards, boardVersion, userId, touched, nowMs],
  )
  const wipedKey = claims.wiped.join(',')

  // The person's own row on a card that moved or left the list goes, with nobody having to notice the move.
  useEffect(() => {
    if (!mayClear || !userId) return
    const asked = [...read.stale, ...(wipedKey ? wipedKey.split(',').map(Number) : [])]
    const gone = [...new Set(asked)].filter((n) => !cleared.current.has(n))
    if (gone.length === 0) return
    for (const n of gone) cleared.current.add(n)
    void (async () => {
      try {
        const { error } = await supabase.from('punch_list_ticks').delete().eq('user_id', userId).in('card_number', gone)
        if (!error) setTicks((now) => withoutTick(now, userId, ...gone))
      } catch {
        // The rows are not shown either way; the next visit tries again.
      }
    })()
  }, [mayClear, userId, read.stale, wipedKey])

  /** A tick, an untick or a Still on it: the box changes at once, and goes back with the reason when the save fails. */
  const write = useCallback(
    async (card: Pick<BoardItem, 'number' | 'group'>, next: boolean, failedWords: string) => {
      if (!userId || !canTick(card)) return
      const prior = ticksRef.current.find((t) => t.userId === userId && t.cardNumber === card.number)
      presses.current += 1
      cleared.current.delete(card.number)
      const me = { id: userId, name: (userName ?? '').trim() }
      setTicks((now) => (next ? withTick(now, card, boardVersion, me, new Date().toISOString()) : withoutTick(now, userId, card.number)))
      try {
        const { error } = next
          ? await supabase
              .from('punch_list_ticks')
              .upsert({ user_id: userId, card_number: card.number, section: card.group, board_version: boardVersion }, { onConflict: 'user_id,card_number' })
          : await supabase.from('punch_list_ticks').delete().eq('user_id', userId).eq('card_number', card.number)
        if (error) throw error
      } catch (e) {
        // Back as it was: this person's row on this card alone, so a press made on another card meanwhile stays.
        setTicks((now) => {
          const rest = withoutTick(now, userId, card.number)
          return prior ? [...rest, prior] : rest
        })
        toasts?.showToast(formatErrorMessage(e, failedWords), 'error')
      } finally {
        presses.current += 1
      }
    },
    [userId, userName, boardVersion, toasts],
  )

  const toggle = useCallback((card: Pick<BoardItem, 'number' | 'group'>, next: boolean) => write(card, next, tickSaveFailed(card, next)), [write])
  const stillOn = useCallback((card: Pick<BoardItem, 'number' | 'group'>) => write(card, true, stillOnFailed(card)), [write])

  return { claims, ticked: claims.ticked, failure, loading, reload, toggle, stillOn }
}
