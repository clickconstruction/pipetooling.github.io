import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  REMOVED_PAPERS_NOTE,
  REMOVED_PAPER_DELETE_PRESS,
  removedPaperDayWords,
  removedPaperDeleteConfirm,
  removedPaperDeletedWords,
  removedPaperStaysWhy,
  removedPapersDrawn,
  removedPapersHeading,
  type RemovedPaper,
  type RemovedPaperJob,
} from '../../lib/jobs/jobPaperRemovedDelete'
import { supabaseJobPaperRemovedDeleteIo, type JobPaperRemovedDeleteIo } from '../../lib/jobs/jobPaperRemovedDeleteIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

const box: CSSProperties = { padding: '0 0.6rem', borderRadius: 7, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.8125rem', color: 'var(--text-700)' }
const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8125rem', border: 'none', background: 'transparent', padding: '0 0.25rem', minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
const press: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 44, padding: '0 0.75rem', borderRadius: 7, whiteSpace: 'nowrap' }
const livePress: CSSProperties = { ...press, cursor: 'pointer', border: '1px solid var(--text-red-700)', background: 'var(--surface)', color: 'var(--text-red-700)' }
const deadPress: CSSProperties = { ...press, cursor: 'not-allowed', border: '1px solid transparent', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT }
const why: CSSProperties = { gridColumn: '1 / -1', margin: 0, color: 'var(--text-muted)', overflowWrap: 'anywhere' }

/**
 * **Taken-off papers**, a folded line under *Papers before this job opens* (punch list #443, row 10): the take-back
 * of **Take off**, for a dev on a ZZ test job. It draws nothing for any other role, on any real job, or while the
 * job holds no taken-off paper.
 *
 * The pane lists live papers alone, so this is where a taken-off one can be reached. Open, each reads its name and
 * the day it came off, with **Delete…**. A paper something points at draws the press dead, with the reason beside it
 * in the database function's own sentence. A live press asks first, in a confirm that names the paper and whose button
 * names the act. Then `delete_test_job_required_paper` checks all of it again, and a refusal it raises is shown in its
 * own words. After a delete the list is read again.
 *
 * A read that fails draws nothing and leaves the pane as it was. That is also what a dev sees before the migration is
 * pushed, when the function is not there yet.
 */
export function JobPapersTakenOff({
  role,
  job,
  io = supabaseJobPaperRemovedDeleteIo,
  readAgain = 0,
  onOverlayOpenChange,
}: {
  role: string | null | undefined
  job: { id: string } & RemovedPaperJob
  io?: JobPaperRemovedDeleteIo
  /** The pane counts its own reads here, so a paper just taken off shows without a reload of the page. */
  readAgain?: number
  onOverlayOpenChange?: (open: boolean) => void
}) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const drawn = removedPapersDrawn(role, job)
  const jobId = job.id
  /** The taken-off papers, with the job they were read for. Null until read, and after a read that failed. */
  const [read, setRead] = useState<{ jobId: string; papers: RemovedPaper[] } | null>(null)
  const [shown, setShown] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Counts each delete tried, so the list is read again after one. */
  const [tried, setTried] = useState(0)
  /** What the function said when it refused a paper, by the paper's id: kept on its line while the paper stands. */
  const [refused, setRefused] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!drawn || !jobId) return
    let live = true
    io.readRemoved(jobId).then(
      (papers) => {
        if (live) setRead({ jobId, papers })
      },
      () => {
        if (live) setRead(null)
      },
    )
    return () => {
      live = false
    }
  }, [drawn, jobId, io, readAgain, tried])

  const papers = drawn && read && read.jobId === jobId ? read.papers : []
  if (papers.length === 0) return null

  const remove = async (paper: RemovedPaper) => {
    if (busyId || removedPaperStaysWhy(paper)) return
    setBusyId(paper.id)
    try {
      onOverlayOpenChange?.(true)
      const ok = await confirmDialog({ ...removedPaperDeleteConfirm(paper.paperName), danger: true })
      onOverlayOpenChange?.(false)
      if (!ok) return
      try {
        await io.deletePaper(paper.id)
        showToast(removedPaperDeletedWords(paper.paperName), 'success')
      } catch (e) {
        const said = formatErrorMessage(e, 'The paper was not deleted.')
        setRefused((r) => ({ ...r, [paper.id]: said }))
        showToast(said, 'error')
      }
      // Read again either way: the paper is gone, or what points at it has changed since the list was read.
      setTried((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div data-testid="job-papers-taken-off" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <b style={{ color: 'var(--text-strong)' }}>{removedPapersHeading(papers.length)}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} aria-label={shown ? 'Hide the taken-off papers' : 'Show the taken-off papers'} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ paddingBottom: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>{REMOVED_PAPERS_NOTE}</p>
          {papers.map((p) => {
            const stays = removedPaperStaysWhy(p)
            const said = stays || refused[p.id] || ''
            const dead = !!stays || busyId != null
            const day = removedPaperDayWords(p.removedAt)
            return (
              <div key={p.id} data-testid="job-paper-taken-off" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.15rem 0.6rem', alignItems: 'center', padding: '0.35rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <WorkedOutValue>{p.paperName}</WorkedOutValue>
                  {day ? (
                    <ValueLines>
                      <ValueLine label="Taken off">
                        <WorkedOutValue>{day}</WorkedOutValue>
                      </ValueLine>
                    </ValueLines>
                  ) : null}
                </div>
                <button type="button" onClick={() => void remove(p)} disabled={dead} aria-label={`Delete ${p.paperName}`} aria-describedby={said ? `job-paper-taken-off-why-${p.id}` : undefined} style={dead ? deadPress : livePress}>
                  {busyId === p.id ? 'Deleting…' : REMOVED_PAPER_DELETE_PRESS}
                </button>
                {said ? (
                  <p id={`job-paper-taken-off-why-${p.id}`} style={stays ? why : { ...why, color: 'var(--text-red-700)' }} role={stays ? undefined : 'alert'} data-testid="job-paper-taken-off-why">
                    {said}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default JobPapersTakenOff
