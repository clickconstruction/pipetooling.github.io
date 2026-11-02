import { useCallback, useEffect, useState } from 'react'
import { JOB_KIND_CHANGED_EVENT } from '../lib/jobs/jobKindWrite'
import { jobsWithNoKind } from '../lib/needsYou/fillInJobKinds'
import { jobKindFillInIo, type JobKindFillInIo } from '../lib/needsYou/fillInJobKindsIo'

export type JobKindGaps = { count: number }

/**
 * The working jobs with no kind (punch list #238, PR 2): the Needs you line's count, the deck's own
 * candidates read by the same kernel, so the line and the deck agree. Null while it reads and on a
 * refused read, so the card stays quiet. Reads again when a press lands anywhere in the app.
 */
export function useJobKindGaps(enabled: boolean, io: Pick<JobKindFillInIo, 'fetchCandidates'> = jobKindFillInIo): { gaps: JobKindGaps | null } {
  const [gaps, setGaps] = useState<JobKindGaps | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setGaps(null)
      return
    }
    try {
      const { jobs, fixtures } = await io.fetchCandidates()
      setGaps({ count: jobsWithNoKind(jobs, fixtures).length })
    } catch {
      setGaps(null)
    }
  }, [enabled, io])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(JOB_KIND_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(JOB_KIND_CHANGED_EVENT, onChanged)
  }, [load])

  return { gaps }
}
