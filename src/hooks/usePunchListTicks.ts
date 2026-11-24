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
import { OWN_TICK_AFTER_QUIET, readClaims, type ClaimCard, type ClaimsRead, type OwnTickAfterQuiet } from '../lib/todos/punchListClaims'
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
 * here, with no press, when `mayClear` allows it. So is their own claim gone quiet, since a quiet
 * tick is wiped (`OWN_TICK_AFTER_QUIET`, Taunya's answer of 2026-11-24). That delete names the time
 * this page read on the row, so a claim the person renewed on another device since is a newer row
 * and stays; the page then reads again. The page holds every clear on a dev server (a branch's
 * board can be behind `main`), under View as (a look writes nothing with no press) and in training
 * mode (the database would refuse it). Nobody's row but the person's own is ever deleted.
 *
 * A wiped tick is remembered until the page is left, so its card goes on saying the tick was
 * cleared after the row is gone. The next visit says nothing: the row is the only record.
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
  ownTickAfterQuiet = OWN_TICK_AFTER_QUIET,
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
  /** What becomes of the person's own quiet tick. The page names none, so it is the default; the tests of the other reading name it. */
  ownTickAfterQuiet?: OwnTickAfterQuiet
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
  /** The person's own quiet rows this visit wiped, kept so their cards go on saying so; one leaves when its card is ticked again. */
  const [wipedRows, setWipedRows] = useState<PunchTick[]>([])
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
      const rows: PunchTick[] = (data ?? []).map((r) => ({
        userId: r.user_id,
        cardNumber: r.card_number,
        section: r.section,
        boardVersion: r.board_version,
        claimerName: r.claimer_name ?? '',
        tickedAt: r.ticked_at ?? '',
      }))
      setTicks(rows)
      // A card the person ticked again on another device is theirs now, not a cleared tick.
      setWipedRows((now) => (now.length === 0 ? now : now.filter((w) => !rows.some((r) => r.userId === w.userId && r.cardNumber === w.cardNumber))))
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
  // The rows the claims are read from: the table's, and the person's own wiped rows the table no longer holds.
  const seen = useMemo(() => {
    const kept = wipedRows.filter((w) => w.userId === userId && !ticks.some((t) => t.userId === w.userId && t.cardNumber === w.cardNumber))
    return kept.length > 0 ? [...ticks, ...kept] : ticks
  }, [ticks, wipedRows, userId])
  const claims = useMemo(
    () => readClaims({ ticks: seen, cards, boardVersion, me: userId, touched, nowMs, ownTickAfterQuiet }),
    [seen, cards, boardVersion, userId, touched, nowMs, ownTickAfterQuiet],
  )
  const wipedKey = claims.wiped.join(',')

  // The person's own row on a card that moved or left the list goes, with nobody having to notice the move.
  // So does their own claim gone quiet. Each number is asked once a visit, so a refused delete is not asked on every draw.
  useEffect(() => {
    if (!mayClear || !userId) return
    const stale = read.stale.filter((n) => !cleared.current.has(n))
    const quiet = (wipedKey ? wipedKey.split(',').map(Number) : []).filter((n) => !cleared.current.has(n))
    if (stale.length === 0 && quiet.length === 0) return
    for (const n of [...stale, ...quiet]) cleared.current.add(n)
    // A row with no time on it cannot be told from a newer one, so it is only hidden.
    const quietRows = ticksRef.current.filter((t) => t.userId === userId && t.tickedAt !== '' && quiet.includes(t.cardNumber))
    void (async () => {
      try {
        if (stale.length > 0) {
          const { error } = await supabase.from('punch_list_ticks').delete().eq('user_id', userId).in('card_number', stale)
          if (!error) setTicks((now) => withoutTick(now, userId, ...stale))
        }
        let newer = false
        for (const row of quietRows) {
          // Only the row this page read. The person may have renewed the claim on another device since: that row is newer, and it stays.
          const { data, error } = await supabase
            .from('punch_list_ticks')
            .delete()
            .eq('user_id', userId)
            .eq('card_number', row.cardNumber)
            .lte('ticked_at', row.tickedAt)
            .select('card_number')
          if (error) continue
          if ((data ?? []).length === 0) {
            newer = true
            continue
          }
          setWipedRows((now) => [...now.filter((w) => w.cardNumber !== row.cardNumber), row])
          setTicks((now) => now.filter((t) => !(t.userId === row.userId && t.cardNumber === row.cardNumber && t.tickedAt === row.tickedAt)))
        }
        // The table holds something this page did not read: read it, and the card says what is true.
        if (newer) await reload()
      } catch {
        // The rows are not shown either way; the next visit tries again.
      }
    })()
  }, [mayClear, userId, read.stale, wipedKey, reload])

  /** A tick, an untick or a Still on it: the box changes at once, and goes back with the reason when the save fails. */
  const write = useCallback(
    async (card: Pick<BoardItem, 'number' | 'group'>, next: boolean, failedWords: string) => {
      if (!userId || !canTick(card)) return
      const prior = ticksRef.current.find((t) => t.userId === userId && t.cardNumber === card.number)
      presses.current += 1
      cleared.current.delete(card.number)
      setWipedRows((now) => (now.some((w) => w.cardNumber === card.number) ? now.filter((w) => w.cardNumber !== card.number) : now))
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
