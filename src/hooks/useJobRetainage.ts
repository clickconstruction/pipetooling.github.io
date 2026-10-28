import { useCallback, useEffect, useRef, useState } from 'react'
import { retainageHeldLine, retainageSourceFigure, type RetainageHeldLine, type RetainageSource } from '../lib/ar/retainageHeld'
import { loadRetainageHeldRowsForJob } from '../lib/ar/retainageHeldIo'
import { assembleRetainageHeld, type RetainageJobFacts } from '../lib/ar/retainageHeldRows'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

export type JobRetainage = {
  /** The job's Retainage held line, or null when there is nothing to show. */
  line: RetainageHeldLine | null
  /** The one source's figure, even zero, or null when the job has neither an application nor a typed figure. */
  figure: { source: RetainageSource; amount: number; applicationNumber: number | null } | null
  facts: RetainageJobFacts | null
  jobStatus: string | null
}

/**
 * One job's retainage as the kernel reads it (punch list #165, PR 3): for the lien details and
 * the Lien desk. Read when the job id lands and again on `reload`; a failed read says why.
 */
export function useJobRetainage(jobId: string | null): { retainage: JobRetainage | null; loading: boolean; error: string | null; reload: () => void } {
  const [retainage, setRetainage] = useState<JobRetainage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!jobId) {
      setRetainage(null)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    void (async () => {
      try {
        const rows = await loadRetainageHeldRowsForJob(jobId)
        if (seq !== seqRef.current) return
        const { inputs, facts } = assembleRetainageHeld(rows.jobs, rows.applications, rows.invoices)
        const input = inputs[0] ?? null
        setRetainage({
          line: input ? retainageHeldLine(input, todayYmdInAppTz()) : null,
          figure: input ? retainageSourceFigure(input.applications, input.typedHeld) : null,
          facts: facts.get(jobId) ?? null,
          jobStatus: rows.jobs[0]?.status ?? null,
        })
        setError(null)
      } catch (e) {
        if (seq !== seqRef.current) return
        setError(formatErrorMessage(e, 'The retainage could not be read.'))
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    })()
  }, [jobId, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { retainage, loading, error, reload }
}
