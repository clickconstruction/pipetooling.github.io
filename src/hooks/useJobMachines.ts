/**
 * Equipment pre-use check (punch list #270): a job's machines for the Job Mode line and the dashboard stops, read
 * again on `reload` after a write.
 */
import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { loadJobMachines, type JobMachines } from '../lib/machines/checksIo'

/** The job's machines, read again on `reload`. */
export function useJobMachines(jobId: string): { data: JobMachines | null; problem: string | null; reload: () => void } {
  const [data, setData] = useState<JobMachines | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let live = true
    loadJobMachines(jobId)
      .then((d) => live && setData(d))
      .catch((e) => live && setProblem(formatErrorMessage(e, 'The machines did not read.')))
    return () => {
      live = false
    }
  }, [jobId, rev])
  const reload = useCallback(() => setRev((r) => r + 1), [])
  return { data, problem, reload }
}

