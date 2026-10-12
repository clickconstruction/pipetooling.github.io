import { useCallback, useEffect, useMemo, useState } from 'react'
import { jobPaperCompanyOf, readBoard, type FlowRowsKindAnswer } from '../lib/flows/boardRead'
import type { FlowKind } from '../lib/flows/facts'
import { loadFlowDef, loadFlowRowsKind } from '../lib/flows/flowsIo'
import type { JobPaperCompany, JobPapersInput } from '../lib/flows/jobPapers'
import { SEED_FLOWS } from '../lib/flows/seed'
import { flat, type FlowDef } from '../lib/flows/state'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'

const KINDS = ['trade', 'customer', 'arch'] as const satisfies readonly FlowKind[]
type PaperKind = (typeof KINDS)[number]

export interface JobPapers {
  /** What `jobPaperGrid`, `jobPaperList` and `jobStrip` take; null until read. */
  input: JobPapersInput | null
  /** The records each person's own windows open by. */
  refs: Readonly<Record<string, { companyId: string | null; customerId: string | null }>>
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Papers on one job (Messages cut 4): everyone on the job read on their flow in one call (`flow_rows_kind` with the
 * project and no kind), each kind on the office's own flow (`loadFlowDef`), each person's papers read for this job.
 */
export function useJobPapers(projectId: string | null): JobPapers {
  const [answer, setAnswer] = useState<FlowRowsKindAnswer | null>(null)
  const [flows, setFlows] = useState<Record<PaperKind, FlowDef>>({ trade: SEED_FLOWS.trade, customer: SEED_FLOWS.customer, arch: SEED_FLOWS.arch })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!projectId) return
    let alive = true
    setLoading(true)
    Promise.all([loadFlowRowsKind(null, projectId), ...KINDS.map((k) => loadFlowDef(k))])
      .then(([a, trade, customer, arch]) => {
        if (!alive) return
        setAnswer(a as FlowRowsKindAnswer)
        setFlows({ trade: trade as FlowDef, customer: customer as FlowDef, arch: arch as FlowDef })
        setError(null)
      })
      .catch((e: unknown) => {
        if (alive) setError(formatErrorMessage(e, 'The papers on this job could not be read.'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [projectId, tick])

  const read = useMemo(() => {
    if (!answer || !projectId) return null
    const now = new Date()
    const companies: JobPaperCompany[] = []
    const refs: Record<string, { companyId: string | null; customerId: string | null }> = {}
    const firstNames: Record<string, string> = {}
    const jobs: Record<string, { name: string }> = {}
    for (const kind of KINDS) {
      const b = readBoard(flows[kind], answer, now)
      Object.assign(refs, b.refs)
      Object.assign(firstNames, b.firstNames)
      Object.assign(jobs, b.jobs)
      for (const c of b.companies) {
        const reading = b.readings[c.contactId]
        if (reading) companies.push(jobPaperCompanyOf(flows[kind], c, reading, projectId))
      }
    }
    const usual = Object.fromEntries(KINDS.flatMap((k) => flat(flows[k]).map((s) => [s.id, s.usual] as const)))
    const input: JobPapersInput = { jobId: projectId, flows, companies, today: todayYmdInAppTz(), usual, firstNames, jobs }
    return { input, refs }
  }, [answer, flows, projectId])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { input: read?.input ?? null, refs: read?.refs ?? {}, loading, error, refresh }
}
