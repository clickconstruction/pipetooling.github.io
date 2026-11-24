import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LienBoard } from '../../lib/jobs/lienBoard'
import { buildLienGetItRight, type LienRunLine } from '../../lib/jobs/lienGetItRight'
import type { LienLeaveOutReason, LienLeftOutRow } from '../../lib/jobs/lienLeftOut'
import { readLienLeftOut, writeLienLeftOut } from '../../lib/jobs/lienLeftOutIo'
import type { LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'

export type LienGetItRightHookInput = {
  /** To do is the view on screen: the left-out rows are read only then. */
  shown: boolean
  board: Pick<LienBoard, 'notices' | 'affidavits'> | null
  rows: ReadonlyArray<LienNextUpRow>
  todayYmd: string
  jobTitle: (jobId: string) => string
  leaderName?: (jobId: string) => string | null | undefined
  /** Changes whenever the desk re-reads, so the left-out rows are read again with it. */
  refreshKey: unknown
}

/**
 * The run's first step, less its drawing (punch list #362, step 5): the read of the papers left out, the checklist
 * over the Board and the To do rows the desk already built (`lienGetItRight.ts`), whether the checklist is open, and
 * the two writes. The checklist is null until the left-out rows are read, and while their read has failed: a count
 * drawn without them could call a left-out paper right.
 */
export function useLienGetItRight({ shown, board, rows, todayYmd, jobTitle, leaderName, refreshKey }: LienGetItRightHookInput) {
  const [leftOut, setLeftOut] = useState<LienLeftOutRow[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [open, setOpen] = useState(false)

  const reload = useCallback(async () => {
    try {
      setLeftOut(await readLienLeftOut())
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The papers left out of the run could not be read.'))
    }
  }, [])
  useEffect(() => {
    if (shown) void reload()
  }, [shown, reload, refreshKey])

  const run = useMemo(() => (leftOut && !failure ? buildLienGetItRight({ board, rows, leftOut, todayYmd, jobTitle, leaderName }) : null), [leftOut, failure, board, rows, todayYmd, jobTitle, leaderName])

  /** Leave a paper out of the run on screen; the rows are read again so every count moves with it. */
  const leaveOut = useCallback(
    async (line: LienRunLine, reason: LienLeaveOutReason, note: string) => {
      if (!run) return
      await writeLienLeftOut({ jobId: line.jobId, paper: line.kind, leftOut: true, runDay: run.day, reason, note })
      await reload()
    },
    [run, reload],
  )
  const putBack = useCallback(
    async (line: LienRunLine) => {
      await writeLienLeftOut({ jobId: line.jobId, paper: line.kind, leftOut: false })
      await reload()
    },
    [reload],
  )

  return { run, failure, open: open && Boolean(run), setOpen, reload, leaveOut, putBack }
}
