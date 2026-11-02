/**
 * Messages, cut 2: Follow up's queue on a screen. Loads the rows through `FollowUpIo`, builds the queue with the kernel
 * (`followUpQueue`, the clause rows and the nudge builder passed through as their own kernels make them, and the New
 * lane built from the same rows, `followUpNewLane`), and reads again after every press, so what the screen draws is what the tables hold. A press that is refused leaves its words
 * in `problem`. A load that fails leaves its class too (`readFailure`, #183 PR 5), so the panel can tell a lost signal
 * from a refusal: the kept queue's stamp reads *could not read again*, and with nothing kept `OfflineRetryPanel` names it.
 */
import type { SetAsideRow } from '../lib/followUp/setAsideFold'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { followUpInputFromRows, followUpNewLane, type FollowUpContact, type FollowUpLine, type FollowUpRows } from '../lib/followUp/followUpRows'
import { pressProblem, type FollowUpIo } from '../lib/followUp/followUpIo'
import { followUpQueue, QUEUE_READ_FAILED_WORDS, QUEUE_READ_OFFLINE_WORDS, type FollowUpPassThrough, type FollowUpQueue } from '../lib/followUp/queue'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../utils/dateUtils'

export interface UseFollowUpQueueOptions<C, N extends { contactId: string }> {
  io: FollowUpIo
  /** Users' names by id: who has a conversation, who marked what we owe, whose note it is. */
  userNames: Readonly<Record<string, string>>
  /** Load only while the tab is open. */
  enabled?: boolean
  passThrough?: FollowUpPassThrough<C, N>
  /** Today, for a test; the app's zone otherwise. */
  todayYmd?: string
  /** Now, for the New lane's words ("today at 8:41 AM"), for a test; the clock otherwise. */
  nowIso?: string
}

export interface FollowUpQueueState<C, N extends { contactId: string }> {
  /** The notices the reader set aside this week (v2.6231), for the fold under New. */
  setAside: readonly SetAsideRow[]
  queue: FollowUpQueue<C, N> | null
  contacts: readonly FollowUpContact[]
  /** The lines the queue read, by id: a row's snippet. */
  lines: ReadonlyMap<string, FollowUpLine>
  loading: boolean
  /** The last load's or press's problem, in the words the office reads. */
  problem: string | null
  /** The last load's failure with its class (`recoveryFailureFromError`); null once a read lands. A refused press never sets it. */
  readFailure: OfflineRecoveryLastError | null
  /** The press running now, by its name, so its button can wait. */
  pressing: string | null
  reload: () => Promise<void>
  /** Runs a press, then reads again. Resolves false when it was refused (its words in `problem`). */
  press: (name: string, run: (io: FollowUpIo) => Promise<unknown>) => Promise<boolean>
}

export function useFollowUpQueue<C = never, N extends { contactId: string } = never>(
  options: UseFollowUpQueueOptions<C, N>,
): FollowUpQueueState<C, N> {
  const { io, userNames, enabled = true, passThrough, todayYmd, nowIso } = options
  const [rows, setRows] = useState<FollowUpRows | null>(null)
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [readFailure, setReadFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [pressing, setPressing] = useState<string | null>(null)
  const today = todayYmd ?? todayYmdInAppTz()
  const live = useRef(true)
  const readsOut = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    readsOut.current += 1
    let landed = false
    setLoading(true)
    try {
      const next = await io.loadQueue(today)
      landed = true
      if (live.current) {
        setRows(next)
        setProblem(null)
        setReadFailure(null)
      }
    } catch (e) {
      if (live.current) {
        const failure = recoveryFailureFromError(e, QUEUE_READ_FAILED_WORDS)
        setProblem(failure.kind === 'network' ? QUEUE_READ_OFFLINE_WORDS : pressProblem(e))
        setReadFailure(failure)
      }
    } finally {
      readsOut.current -= 1
      // A focus or a new line starts a read while another is out. A failed one ends `loading` only when none is left,
      // so a later read that lands still ends it, and the kept read (#183 PR 5) lets go on that edge.
      if (live.current && (landed || readsOut.current === 0)) setLoading(false)
    }
  }, [io, today])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  const press = useCallback(
    async (name: string, run: (io: FollowUpIo) => Promise<unknown>) => {
      setPressing(name)
      try {
        await run(io)
        await reload()
        return true
      } catch (e) {
        if (live.current) setProblem(pressProblem(e))
        return false
      } finally {
        if (live.current) setPressing(null)
      }
    },
    [io, reload],
  )

  const built = useMemo(() => {
    if (!rows) return { queue: null, contacts: [] as FollowUpContact[], lines: new Map<string, FollowUpLine>() }
    const input = followUpInputFromRows(rows, today, userNames)
    const newLane = followUpNewLane(input, rows.jobStates ?? {}, nowIso ?? new Date().toISOString())
    return { queue: followUpQueue<C, N>(input, { ...passThrough, newLane }), contacts: input.contacts, lines: new Map(input.messages.map((m) => [m.id, m])) }
  }, [rows, today, userNames, passThrough, nowIso])

  return { queue: built.queue, contacts: built.contacts, lines: built.lines, setAside: rows?.setAside ?? NO_SET_ASIDE, loading, problem, readFailure, pressing, reload, press }
}

/** One empty list, so a queue with nothing set aside hands out the same rows each render. */
const NO_SET_ASIDE: readonly SetAsideRow[] = []
