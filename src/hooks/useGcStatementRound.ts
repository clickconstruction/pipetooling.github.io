import { useCallback, useEffect, useState } from 'react'
import { listGcReviewCertifications } from '../lib/gcReviewCertifications'
import { listGcStatementRoundMarks, listGcStatementRoundMarksSince, listGcStatementSenders } from '../lib/gcStatementRoundIo'
import type { GcReviewCertRow } from '../lib/jobs/gcReviewCertification'
import type { RoundMarkRow } from '../lib/jobs/gcStatementRounds'
import { trailingWeekStarts } from '../lib/jobs/temperatureBoard'

export type UseGcStatementRoundInput = {
  /** The reads run while this is true: GC Review passes its `open`, so every open reads the week afresh. */
  open: boolean
  /** The Monday the round counts from (`gcReviewWeekStartYmd()`). */
  certWeekStart: string
  /** The round GCs (active, by GC) whose standing senders are read. */
  roundGcIds: string[]
}

/**
 * The GC statement round's data (GC_REVIEW_MODAL_ARCHITECTURE.md, step 8): the week's
 * certifications and whether they were read, this week's round marks, six weeks of marks for the
 * temperature board, and each round GC's standing sender. GC Review reads it here. The writes stay
 * with the window, which needs its signed-in name, its toasts and the word promises: they reach this
 * data only through `refreshCerts`, `refreshRoundMarks` and `reloadSenders`. The Stages board's round
 * cards and `usePipelineMoneyOpportunities` still read the same tables on their own.
 */
export function useGcStatementRound({ open, certWeekStart, roundGcIds }: UseGcStatementRoundInput) {
  const [certRows, setCertRows] = useState<GcReviewCertRow[]>([])
  /** Whether the week's certifications were read (v2.5022): the statement doors wait for the read, and say so when it fails. */
  const [certsRead, setCertsRead] = useState<'reading' | 'read' | 'failed'>('reading')
  const refreshCerts = useCallback(() => {
    listGcReviewCertifications(certWeekStart).then(
      (rows) => {
        setCertRows(rows)
        setCertsRead('read')
      },
      () => {
        setCertRows([])
        setCertsRead('failed')
      },
    )
  }, [certWeekStart])
  useEffect(() => {
    if (open) refreshCerts()
  }, [open, refreshCerts])
  /** Personal statement rounds (v2.2072): weekly marks + standing senders. */
  const [roundMarks, setRoundMarks] = useState<RoundMarkRow[]>([])
  /** Six weeks of marks (v2.2813): the temperature board's trend, the header temperature pills, the guardrail. */
  const [boardMarks, setBoardMarks] = useState<RoundMarkRow[]>([])
  const [roundSenders, setRoundSenders] = useState<Map<string, string>>(new Map())
  const refreshRoundMarks = useCallback(() => {
    void listGcStatementRoundMarks(certWeekStart).then(setRoundMarks, () => setRoundMarks([]))
    void listGcStatementRoundMarksSince(trailingWeekStarts(certWeekStart, 6)[0] ?? certWeekStart).then(setBoardMarks, () => setBoardMarks([]))
  }, [certWeekStart])
  useEffect(() => {
    if (open) refreshRoundMarks()
  }, [open, refreshRoundMarks])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listGcStatementSenders(roundGcIds).then((m) => {
      if (!cancelled) setRoundSenders(m)
    })
    return () => {
      cancelled = true
    }
  }, [open, roundGcIds])
  /** The senders again, after one is assigned. A failed read rejects, so the window's assign says so. */
  const reloadSenders = useCallback(async () => {
    const m = await listGcStatementSenders(roundGcIds)
    setRoundSenders(m)
  }, [roundGcIds])
  return { certRows, certsRead, refreshCerts, roundMarks, boardMarks, refreshRoundMarks, roundSenders, reloadSenders }
}
