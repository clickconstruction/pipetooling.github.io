/**
 * One job's Build wait that is not lifted (punch list #192, write A, v2.8726), for the fact row in the job window.
 * One small read when the window opens on a job, under the reader's own rights: whoever reads a job reads its wait.
 * It reads again when a wait is marked or lifted anywhere on the page (`BUILD_WAITS_CHANGED_EVENT`). A job that does
 * not wait, and a read the database refuses, are both null, so the window draws as it did before.
 */
import { useEffect, useState } from 'react'
import type { BuildWait } from '../lib/bridge/build/buildWaits'
import { BUILD_WAITS_CHANGED_EVENT, buildWaitsIo, type BuildWaitsIo } from '../lib/bridge/build/buildWaitsIo'

export function useJobBuildWait(jobId: string | null | undefined, io: Pick<BuildWaitsIo, 'loadOpenForJob'> = buildWaitsIo): BuildWait | null {
  const [found, setFound] = useState<{ jobId: string; wait: BuildWait | null } | null>(null)
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const read = () => {
      void io.loadOpenForJob(jobId).then((wait) => {
        if (!cancelled) setFound({ jobId, wait })
      })
    }
    read()
    window.addEventListener(BUILD_WAITS_CHANGED_EVENT, read)
    return () => {
      cancelled = true
      window.removeEventListener(BUILD_WAITS_CHANGED_EVENT, read)
    }
  }, [jobId, io])
  // A wait read for another job is never drawn on this one.
  return jobId && found?.jobId === jobId ? found.wait : null
}
