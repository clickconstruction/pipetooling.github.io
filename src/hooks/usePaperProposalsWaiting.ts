import { useEffect, useState } from 'react'
import { JOB_PAPERS_CHANGED_EVENT } from '../lib/jobs/jobPapers'
import { paperProposalsWaiting, type PaperProposalsWaiting } from '../lib/needsYou/paperProposals'
import { paperProposalsIo, type PaperProposalsIo } from '../lib/needsYou/paperProposalsIo'

/**
 * The GC proposals that wait on the office (punch list #389, step 6, its second part), for the office's
 * Needs you line. Null while it reads and on a refused read, so the card stays quiet.
 *
 * It reads again when the window comes back into focus, and when a job's papers change in this tab: the
 * office's take or decline tells that event, so the line leaves as soon as the proposal is answered.
 */
export function usePaperProposalsWaiting(enabled: boolean, io: PaperProposalsIo = paperProposalsIo): { waiting: PaperProposalsWaiting | null } {
  const [waiting, setWaiting] = useState<PaperProposalsWaiting | null>(null)
  useEffect(() => {
    if (!enabled) {
      setWaiting(null)
      return
    }
    let cancelled = false
    const read = async () => {
      try {
        const { proposals, jobs } = await io.fetchSources()
        if (!cancelled) setWaiting(paperProposalsWaiting(proposals, jobs))
      } catch {
        if (!cancelled) setWaiting(null)
      }
    }
    const again = () => void read()
    window.addEventListener('focus', again)
    window.addEventListener(JOB_PAPERS_CHANGED_EVENT, again)
    void read()
    return () => {
      cancelled = true
      window.removeEventListener('focus', again)
      window.removeEventListener(JOB_PAPERS_CHANGED_EVENT, again)
    }
  }, [enabled, io])
  return { waiting }
}
