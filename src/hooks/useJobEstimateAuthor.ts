import { useEffect, useState } from 'react'
import { loadJobEstimateAuthor } from '../lib/jobs/jobPeopleIo'
import type { JobEstimateAuthor } from '../lib/jobs/jobPeople'

/**
 * The author of the signed estimate a job came from (v2.6694), for the E chip beside their name on the job's people
 * lists. Null until read, null when there is none or the read fails; reads once per job id.
 */
export function useJobEstimateAuthor(jobId: string | null | undefined): JobEstimateAuthor | null {
  const [author, setAuthor] = useState<JobEstimateAuthor | null>(null)
  useEffect(() => {
    let cancelled = false
    setAuthor(null)
    if (!jobId) return
    void loadJobEstimateAuthor(jobId).then((a) => {
      if (!cancelled) setAuthor(a)
    })
    return () => {
      cancelled = true
    }
  }, [jobId])
  return author
}
