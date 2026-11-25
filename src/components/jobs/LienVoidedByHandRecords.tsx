import { useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LIEN_BY_HAND_RECORD_DELETED, lienByHandDeleteConfirm, lienByHandDeleteDrawn, lienByHandDeleteProblem, lienByHandRecordWords, lienByHandTiesProblem, lienVoidedByHandRecords, type LienByHandJob } from '../../lib/jobs/lienByHandRecordDelete'
import { countLienPacketSiblings, deleteLienByHandRecord, readLienRecordTies } from '../../lib/jobs/lienByHandRecordDeleteIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * **Voided by-hand notice records**, a folded line in a job's Lien window (punch list #443, row 1): the take-back
 * of a § 53.056 notice recorded by hand, for a dev on a test job. It draws nothing for any other role, and nothing
 * when the job holds no voided by-hand notice.
 *
 * The window's tabs draw live records alone, so this is where a voided one can be reached. Each reads its months
 * and days, with **Delete…**. On a real job the press is dead and the line says why. On a test job the press reads
 * what points at the record first, and a record something points at says so on its line and stays. Then it asks, in
 * a confirm whose button names the act and whose words say the Activity line stays. `deleteLienByHandRecord` reads
 * everything again before it deletes. `onChanged` reads the window again.
 */
export function LienVoidedByHandRecords({ role, filings, job, onChanged }: { role: string | null | undefined; /** Every record of the job, voided ones too. */ filings: ReadonlyArray<JobLienFilingRow>; job: LienByHandJob; onChanged: () => void }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [shown, setShown] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Why a record stayed when its delete was pressed, by the record's id: what points at it, kept on its line. */
  const [stayed, setStayed] = useState<Record<string, string>>({})
  const drawn = lienByHandDeleteDrawn(role)
  const records = useMemo(() => (drawn ? lienVoidedByHandRecords(filings) : []), [drawn, filings])
  if (!drawn || records.length === 0) return null

  const remove = async (record: JobLienFilingRow) => {
    if (busyId || lienByHandDeleteProblem(record, job)) return
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
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The record was not deleted.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.72rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
  return (
    <div data-testid="lien-voided-by-hand" style={{ margin: '0 0 0.9rem', padding: '0 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.72rem', color: 'var(--text-700)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <b>Voided by-hand notice records · {records.length}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ paddingBottom: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>Only a developer sees this list. A delete takes the record. Its line on the job’s Activity stays.</p>
          {records.map((f) => {
            const problem = lienByHandDeleteProblem(f, job) || stayed[f.id] || ''
            const dead = !!problem || busyId != null
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
}
