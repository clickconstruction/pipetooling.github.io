import { useEffect, useState } from 'react'
import { lienCodeSignerFrom, type LienCodeStatusRead } from '../../lib/jobs/lienCodeSigner'
import { lienSignCodeStatus } from '../../lib/jobs/lienDeskSignIo'
import type { LienNoticeSignLineCodeSigner } from './LienNoticeSignLine'

/**
 * The leader's signing code on someone else's screen (v2.5791, punch list #150; its own file since v2.7611, out
 * of `LienDesk.tsx` as it stood). When the job has a master and he is not the one signed in, the desk reads
 * whether his code is live, once per job and again when a refused code says its status went stale. On his own
 * screen there is no code signer.
 */
export function useLienCodeSigner({ otherScreen, masterId, leaderName, jobId }: { otherScreen: boolean; masterId: string | null; leaderName: string; /** The job on the pane: a new job reads the code again. */ jobId: string | undefined }) {
  const [codeStatus, setCodeStatus] = useState<LienCodeStatusRead>(null)
  const [codeStatusTick, setCodeStatusTick] = useState(0)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)
  useEffect(() => {
    setCodeProblem(null)
    if (!otherScreen || !masterId) {
      setCodeStatus(null)
      return
    }
    let live = true
    setCodeStatus('loading')
    lienSignCodeStatus(masterId)
      .then((s) => {
        if (live) setCodeStatus(s ?? 'not_live')
      })
      .catch(() => {
        if (live) setCodeStatus('not_live')
      })
    return () => {
      live = false
    }
  }, [otherScreen, masterId, codeStatusTick, jobId])
  const codeSigner: LienNoticeSignLineCodeSigner | null = otherScreen ? lienCodeSignerFrom(leaderName, codeStatus) : null
  const codeReady = codeSigner?.status === 'ready'
  /** A refused code whose status went stale: read it again. */
  const refreshCodeStatus = () => setCodeStatusTick((t) => t + 1)
  return { codeSigner, codeReady, codeProblem, setCodeProblem, refreshCodeStatus }
}
