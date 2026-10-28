/**
 * Follow up's Nudges from the flow (Messages cut 4, wave 2): everyone on the three flows read once (`loadNudgeBatch`),
 * and the slot's `build`, which helper 2's Follow up calls with its portal skip: `nudgeRows` over them, one row per
 * person, worst first. The presses act on the steps a row's one message names: Hold until Mon holds each
 * (`nudge_hold_until`), Remind now records each as sent (`nudge_record_sent`, which also lets a standing hold go),
 * then everyone is read again.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadNudgeBatch, type NudgeKind, type NudgePerson } from '../lib/flows/flowNudgesIo'
import { flowPresses } from '../lib/flows/flowPersonIo'
import { nextMonday, nudgeRows, type NudgeRow, type NudgeStep, type PersonFlow } from '../lib/flows/nudges'
import { pressJobOf } from '../lib/flows/person'
import type { FlowDef } from '../lib/flows/state'
import type { OnPortal } from '../lib/followUp/queue'
import { formatErrorMessage } from '../utils/errorHandling'

export interface FlowNudges {
  /** The slot's rows, built with Follow up's portal skip. */
  build: (skip: OnPortal) => NudgeRow[]
  names: ReadonlyMap<string, NudgePerson>
  flows: Readonly<Partial<Record<NudgeKind, FlowDef>>>
  loading: boolean
  problem: string | null
  /** The press running now, by its row, so its buttons wait. */
  pressing: string | null
  holdUntilMonday: (row: NudgeRow) => Promise<{ ok: boolean; words: string }>
  remindNow: (row: NudgeRow) => Promise<{ ok: boolean; words: string }>
  reload: () => Promise<void>
}

/** The steps a row's message names; its own step when none is marked. */
export const namedSteps = (row: NudgeRow): NudgeStep[] => {
  const named = row.steps.filter((s) => s.named)
  return named.length ? named : row.steps.filter((s) => s.stepId === row.stepId && s.jobId === row.jobId).slice(0, 1)
}

export function useFlowNudges(opts: { enabled?: boolean; now?: () => Date } = {}): FlowNudges {
  const enabled = opts.enabled ?? true
  const nowRef = useRef(opts.now ?? (() => new Date()))
  nowRef.current = opts.now ?? (() => new Date())
  const [people, setPeople] = useState<PersonFlow[]>([])
  const [names, setNames] = useState<ReadonlyMap<string, NudgePerson>>(new Map())
  const [flows, setFlows] = useState<Readonly<Partial<Record<NudgeKind, FlowDef>>>>({})
  const [readAt, setReadAt] = useState<Date>(() => nowRef.current())
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pressing, setPressing] = useState<string | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const at = nowRef.current()
      const batch = await loadNudgeBatch(at)
      if (!live.current) return
      setPeople(batch.people)
      setNames(batch.names)
      setFlows(batch.flows)
      setReadAt(at)
      setProblem(null)
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e))
    } finally {
      if (live.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const build = useCallback((skip: OnPortal) => nudgeRows(people, readAt, { skip }), [people, readAt])

  const run = useCallback(
    async (row: NudgeRow, press: (s: NudgeStep) => Promise<unknown>, done: string): Promise<{ ok: boolean; words: string }> => {
      setPressing(row.contactId)
      try {
        for (const s of namedSteps(row)) await press(s)
        await reload()
        return { ok: true, words: done }
      } catch (e) {
        return { ok: false, words: formatErrorMessage(e, formatErrorMessage(e)) }
      } finally {
        if (live.current) setPressing(null)
      }
    },
    [reload],
  )

  /** The step's job as the press names it: a residential customer's is a Pipeline job, anyone else's a GC project (v2.6016). */
  const jobOn = useCallback((row: NudgeRow, s: NudgeStep) => pressJobOf(people.find((p) => p.id === row.contactId)?.reading.kind ?? 'unknown', s.jobId), [people])

  const holdUntilMonday = useCallback(
    (row: NudgeRow) => {
      const until = nextMonday(nowRef.current())
      return run(row, (s) => flowPresses.holdUntil(row.contactId, s.stepId, jobOn(row, s), until), 'Held until Monday. The row comes back then.')
    },
    [run, jobOn],
  )

  const remindNow = useCallback(
    (row: NudgeRow) =>
      run(row, (s) => flowPresses.remindNow(row.contactId, s.stepId, jobOn(row, s), s.how, s.round), 'Marked as reminded today. The app sends no second reminder on top of it.'),
    [run, jobOn],
  )

  return { build, names, flows, loading, problem, pressing, holdUntilMonday, remindNow, reload }
}
