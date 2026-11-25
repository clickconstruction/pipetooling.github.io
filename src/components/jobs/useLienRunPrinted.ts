import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LienGetItRight } from '../../lib/jobs/lienGetItRight'
import type { LienPrintFact } from '../../lib/jobs/lienPrintSworn'
import { loadLienNewestPrints } from '../../lib/jobs/lienPrintsIo'
import { LIEN_RUN_PRINTED_NONE, lienRunPrinted, type LienRunPrinted, type LienRunPrintedAffidavit, type LienRunPrintedNotice } from '../../lib/jobs/lienRunPrinted'

export type LienRunPrintedHookInput = {
  run: LienGetItRight | null
  /** The checklist is open: nothing is read before then. */
  open: boolean
  /** The desk's monthly notices, printed ones among them. Called only while the checklist is open. */
  noticesFor: () => LienRunPrintedNotice[]
  /** The affidavits the batch would print now for these jobs. */
  affidavitsFor: (jobIds: ReadonlySet<string>) => LienRunPrintedAffidavit[]
}

export type LienRunPrintedState = LienRunPrinted & {
  /** The newest prints are being read: nothing is said yet, and every right affidavit counts as to print. */
  reading: boolean
  /** The read failed: said under the print press, with the way to read again. */
  failed: boolean
  /** Read the prints again: after a print, or after a failed read. */
  reload: () => void
  /** An instant as the card says it: *Nov 25, 10:02 AM*. */
  whenWords: (iso: string) => string
}

function whenWords(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Changed since printed, less its drawing (punch list #362, step 7): the read of each job's newest filed print while
 * the checklist is open, and the run's printed papers set beside today (`lienRunPrinted`).
 *
 * The read is by job, and its key keeps its identity while the jobs are the same: the desk builds the run anew on
 * every render. A read that fails says so and counts nothing as printed.
 */
export function useLienRunPrinted({ run, open, noticesFor, affidavitsFor }: LienRunPrintedHookInput): LienRunPrintedState | null {
  const right = run?.right
  const jobKey = useMemo(() => (right ? Array.from(new Set(right.map((l) => l.jobId))).sort().join('\n') : ''), [right])
  const [turn, setTurn] = useState(0)
  const [read, setRead] = useState<{ jobKey: string; turn: number; prints: ReadonlyMap<string, LienPrintFact> | null } | null>(null)
  const live = open && jobKey !== ''

  useEffect(() => {
    if (!live) return
    let stale = false
    void loadLienNewestPrints(jobKey.split('\n')).then((answer) => {
      if (!stale) setRead({ jobKey, turn, prints: answer ? answer.prints : null })
    })
    return () => {
      stale = true
    }
  }, [live, jobKey, turn])

  const reload = useCallback(() => setTurn((t) => t + 1), [])
  if (!run) return null

  // The last answer for these jobs stands while a read again is in flight, so a reload does not blank the card.
  const mine = read && read.jobKey === jobKey ? read : null
  const reading = live && (!mine || mine.turn !== turn)
  const failed = live && !reading && mine != null && mine.prints == null
  const prints = live && mine ? mine.prints : null

  let standings: LienRunPrinted = LIEN_RUN_PRINTED_NONE
  if (prints) {
    const lines = run.right.map((l) => ({ kind: l.kind, jobId: l.jobId, label: l.label, title: l.title, printed: l.kind === 'notice' && l.stageKey === 'in_mail' }))
    const noticeJobs = new Set(lines.filter((l) => l.kind === 'notice' && l.printed).map((l) => l.jobId))
    const affidavitJobs = new Set(lines.filter((l) => l.kind === 'affidavit').map((l) => l.jobId))
    standings = lienRunPrinted({
      lines,
      notices: noticeJobs.size > 0 ? noticesFor().filter((n) => noticeJobs.has(n.jobId)) : [],
      affidavits: affidavitJobs.size > 0 ? affidavitsFor(affidavitJobs) : [],
      prints,
    })
  }
  return { ...standings, reading, failed, reload, whenWords }
}
