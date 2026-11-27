import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { announceJobActivityChanged } from '../../lib/jobs/jobActivityChanged'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import {
  LIEN_BY_HAND_RECORD_DELETED,
  lienByHandDeleteConfirm,
  lienByHandDeleteDrawn,
  lienByHandDeleteProblem,
  lienByHandRecordWords,
  lienByHandTiesProblem,
  lienNoticeStrayClearConfirm,
  lienNoticeStrayClearedWords,
  lienNoticeStrayLines,
  lienNoticeStrayLinesDrawn,
  lienVoidedByHandRecords,
  type LienByHandJob,
  type LienNoticeActivityLine,
} from '../../lib/jobs/lienByHandRecordDelete'
import { clearLienNoticeStrayLines, countLienPacketSiblings, deleteLienByHandRecord, readLienNoticeActivityLines, readLienRecordTies } from '../../lib/jobs/lienByHandRecordDeleteIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * **Voided by-hand notice records**, a folded line in a job's Lien window (punch list #443, row 1): the take-back
 * of a § 53.056 notice recorded by hand, for a dev on a test job. It draws nothing for any other role.
 *
 * The window's tabs draw live records alone, so this is where a voided one can be reached. Each reads its months
 * and days, with **Delete…**. On a real job the press is dead and the line says why. On a test job the press reads
 * what points at the record first, and a record something points at says so on its line and stays. Then it asks, in
 * a confirm whose button names the act and whose words say the Activity line goes with the record.
 * `deleteLienByHandRecord` reads everything again before it calls the function that takes both. `onChanged` reads
 * the window again.
 *
 * **Activity lines of deleted notice records**, a second line under it, for a dev on a test job alone. Records
 * deleted before the function existed left their lines on the job's Activity. The job's notice lines are read once,
 * and each time the records change. The line is drawn when one or more names a record the job no longer holds,
 * though the job holds no voided record. **Clear…** asks, then calls the function that clears them, and the toast
 * says how many it cleared. A read that fails draws nothing here and leaves the list above as it was.
 *
 * Both presses take lines off the job's Activity, and the lists hear only new lines from the database. So each says
 * so through `announceJobActivityChanged`, and a job window open behind this one reads its list again (finding 283).
 */
export function LienVoidedByHandRecords({
  role,
  filings,
  job,
  jobId,
  onChanged,
}: {
  role: string | null | undefined
  /** Every record of the job, voided ones too. */
  filings: ReadonlyArray<JobLienFilingRow>
  job: LienByHandJob
  /** The job's id: its Activity is read for notice lines whose record is gone. */
  jobId: string
  onChanged: () => void
}) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [shown, setShown] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Why a record stayed when its delete was pressed, by the record's id: what points at it, kept on its line. */
  const [stayed, setStayed] = useState<Record<string, string>>({})
  const drawn = lienByHandDeleteDrawn(role)
  const records = useMemo(() => (drawn ? lienVoidedByHandRecords(filings) : []), [drawn, filings])
  const strayDrawn = lienNoticeStrayLinesDrawn(role, job)
  /**
   * The job's stray notice lines, with the job they were read for: worked out when a read lands, against the records
   * of that moment, so a record just deleted never shows its line as a stray while the next read is on its way.
   * Null until read, and after a read that failed.
   */
  const [read, setRead] = useState<{ jobId: string; strays: LienNoticeActivityLine[] } | null>(null)
  /** Counts each clear, so the lines are read again after one. */
  const [cleared, setCleared] = useState(0)
  const [clearing, setClearing] = useState(false)
  useEffect(() => {
    if (!strayDrawn || !jobId) return
    let live = true
    readLienNoticeActivityLines(jobId).then(
      (lines) => {
        if (live) setRead({ jobId, strays: lienNoticeStrayLines(lines, filings) })
      },
      () => {
        if (live) setRead(null)
      },
    )
    return () => {
      live = false
    }
  }, [strayDrawn, jobId, filings, cleared])
  const strays = strayDrawn && read && read.jobId === jobId ? read.strays : []
  if (records.length === 0 && strays.length === 0) return null

  const remove = async (record: JobLienFilingRow) => {
    if (busyId || clearing || lienByHandDeleteProblem(record, job)) return
    setBusyId(record.id)
    try {
      const [ties, siblings] = await Promise.all([readLienRecordTies(record.id), countLienPacketSiblings(record)])
      const tied = lienByHandTiesProblem(ties)
      if (tied) {
        setStayed((s) => ({ ...s, [record.id]: tied }))
        return
      }
      if (!(await confirmDialog({ ...lienByHandDeleteConfirm(siblings), danger: true }))) return
      await deleteLienByHandRecord(record.id)
      showToast(LIEN_BY_HAND_RECORD_DELETED, 'success')
      // The record's Activity line went with it: a job window open behind this one reads its list again (finding 283).
      announceJobActivityChanged(jobId)
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The record was not deleted.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const clear = async () => {
    if (clearing || busyId || strays.length === 0) return
    setClearing(true)
    try {
      if (!(await confirmDialog({ ...lienNoticeStrayClearConfirm(strays.length), danger: true }))) return
      const n = await clearLienNoticeStrayLines(jobId)
      showToast(lienNoticeStrayClearedWords(n), n > 0 ? 'success' : 'info')
      setCleared((c) => c + 1)
      if (n > 0) announceJobActivityChanged(jobId)
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The Activity lines were not cleared.'), 'error')
    } finally {
      setClearing(false)
    }
  }

  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.72rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
  const box: CSSProperties = { margin: '0 0 0.9rem', padding: '0 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.72rem', color: 'var(--text-700)' }
  const recordsBox = records.length > 0 && (
    <div data-testid="lien-voided-by-hand" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <b>Voided by-hand notice records · {records.length}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ paddingBottom: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>Only a developer sees this list. A delete takes the record. Its line on the job’s Activity goes with it.</p>
          {records.map((f) => {
            const problem = lienByHandDeleteProblem(f, job) || stayed[f.id] || ''
            const dead = !!problem || busyId != null || clearing
            return (
              <div key={f.id} data-testid="lien-voided-by-hand-record" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', alignItems: 'center', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b style={{ color: 'var(--text-strong)' }}>§ 53.056 notice, recorded by hand</b>
                  <span style={{ display: 'block', color: 'var(--text-muted)' }}>{lienByHandRecordWords(f)}</span>
                  {problem ? (
                    <span style={{ display: 'block', color: 'var(--text-muted)' }} data-testid="lien-voided-by-hand-why">
                      {problem}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  disabled={dead}
                  style={problem ? { ...word, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : { ...word, color: 'var(--text-red-700)', cursor: dead ? 'default' : 'pointer' }}
                >
                  {busyId === f.id ? 'Deleting…' : 'Delete…'}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
  const straysBox = strays.length > 0 && (
    <div data-testid="lien-notice-stray-lines" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <b>Activity lines of deleted notice records · {strays.length}</b>
        <button type="button" onClick={() => void clear()} disabled={clearing || busyId != null} style={{ ...word, color: 'var(--text-red-700)', cursor: clearing || busyId != null ? 'default' : 'pointer' }}>
          {clearing ? 'Clearing…' : 'Clear…'}
        </button>
      </div>
    </div>
  )
  return (
    <>
      {recordsBox}
      {straysBox}
    </>
  )
}
