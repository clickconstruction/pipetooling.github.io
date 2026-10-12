/**
 * Messages, cut 2: Follow up's queue on a screen. Loads the rows through `FollowUpIo`, builds the queue with the kernel
 * (`followUpQueue`, the clause rows and the nudge builder passed through as their own kernels make them), and reads
 * again after every press, so what the screen draws is what the tables hold. A press that is refused leaves its words
 * in `problem`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { followUpInputFromRows, type FollowUpContact, type FollowUpLine, type FollowUpRows } from '../lib/followUp/followUpRows'
import { pressProblem, type FollowUpIo } from '../lib/followUp/followUpIo'
import { followUpQueue, type FollowUpPassThrough, type FollowUpQueue } from '../lib/followUp/queue'
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
}

export interface FollowUpQueueState<C, N extends { contactId: string }> {
  queue: FollowUpQueue<C, N> | null
  contacts: readonly FollowUpContact[]
  /** The lines the queue read, by id: a row's snippet. */
  lines: ReadonlyMap<string, FollowUpLine>
  loading: boolean
  /** The last load's or press's problem, in the words the office reads. */
  problem: string | null
  /** The press running now, by its name, so its button can wait. */
  pressing: string | null
  reload: () => Promise<void>
  /** Runs a press, then reads again. Resolves false when it was refused (its words in `problem`). */
  press: (name: string, run: (io: FollowUpIo) => Promise<unknown>) => Promise<boolean>
}

export function useFollowUpQueue<C = never, N extends { contactId: string } = never>(
  options: UseFollowUpQueueOptions<C, N>,
): FollowUpQueueState<C, N> {
  const { io, userNames, enabled = true, passThrough, todayYmd } = options
  const [rows, setRows] = useState<FollowUpRows | null>(null)
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pressing, setPressing] = useState<string | null>(null)
  const today = todayYmd ?? todayYmdInAppTz()
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await io.loadQueue(today)
      if (live.current) {
        setRows(next)
        setProblem(null)
      }
    } catch (e) {
      if (live.current) setProblem(pressProblem(e))
    } finally {
      if (live.current) setLoading(false)
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
    return { queue: followUpQueue<C, N>(input, passThrough ?? {}), contacts: input.contacts, lines: new Map(input.messages.map((m) => [m.id, m])) }
  }, [rows, today, userNames, passThrough])

  return { queue: built.queue, contacts: built.contacts, lines: built.lines, loading, problem, pressing, reload, press }
}
