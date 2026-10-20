import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { readBoard, type BoardRead } from '../lib/flows/boardRead'
import type { BoardContext } from '../lib/flows/board'
import type { FlowKind } from '../lib/flows/facts'
import { loadFlowDef, loadFlowRowsKind } from '../lib/flows/flowsIo'
import { SEED_FLOWS } from '../lib/flows/seed'
import { flat, type FlowDef } from '../lib/flows/state'
import { todayYmdInAppTz } from '../utils/dateUtils'

export interface FlowBoard {
  flow: FlowDef
  read: BoardRead | null
  /** What the boards' kernels take: the flow, the jobs, each step's usual, the first names, today. */
  ctx: BoardContext | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * One kind's board (Trade partners, Customers): every contact of the kind read on its flow, the office's own
 * (`loadFlowDef`, the seed's until one is kept). With a project, only the people on that job. Each step's usual is the
 * flow's until the done ones are read (`going.ts`'s `usualByStep`).
 */
export function useFlowBoard(kind: FlowKind, opts: { projectId?: string | null; enabled?: boolean } = {}): FlowBoard {
  const { projectId = null, enabled = true } = opts
  const [flow, setFlow] = useState<FlowDef>(SEED_FLOWS[kind])
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof loadFlowRowsKind>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    setLoading(true)
    Promise.all([loadFlowDef(kind), loadFlowRowsKind(kind, projectId)])
      .then(([f, a]) => {
        if (!alive) return
        setFlow(f)
        setAnswer(a)
        setError(null)
      })
      .catch((e: unknown) => {
        if (alive) setError(formatErrorMessage(e, 'The flows could not be read.'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [kind, projectId, enabled, tick])

  const read = useMemo(() => (answer ? readBoard(flow, answer, new Date()) : null), [answer, flow])
  const ctx = useMemo<BoardContext | null>(
    () => (read ? { flow, jobs: read.jobs, usual: Object.fromEntries(flat(flow).map((s) => [s.id, s.usual])), firstNames: read.firstNames, today: todayYmdInAppTz() } : null),
    [read, flow],
  )
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { flow, read, ctx, loading, error, refresh }
}
