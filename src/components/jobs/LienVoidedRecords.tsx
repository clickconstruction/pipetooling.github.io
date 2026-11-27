import { useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LIEN_UNVOID_WORDS, lienUnvoidConfirm, lienUnvoidDoneWords, lienUnvoidDrawn, lienUnvoidFacts, lienUnvoidProblem, lienVoidedRecords, type LienUnvoidJob } from '../../lib/jobs/lienFilingUnvoid'
import { LienUnvoidRefused, unvoidLienFiling } from '../../lib/jobs/lienFilingUnvoidIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * **Voided records**, a folded line in a job's Lien window (punch list #443, row 2): the take-back of **Void** on a
 * lien record, for a dev on a test job. It draws nothing for any other role, and nothing on a real job.
 *
 * The window's tabs draw live records alone, so this is where a voided one can be reached. Each record reads what
 * it is and its days as values, one fact a line, with **Put back…**. A record that applied a paper already on
 * record draws the press dead with the reason beside it: Undo was its take-back. Every other press asks first, in a
 * confirm whose button names the act and whose words say what comes back. Then `unvoidLienFiling` calls the
 * function once. The database puts the record and its desk paper back together, or refuses in a sentence, and that
 * sentence stays on the record's line. `onChanged` reads the window again, after a put back and after a refusal.
 */
export function LienVoidedRecords({
  role,
  filings,
  job,
  onChanged,
}: {
  role: string | null | undefined
  /** Every record of the job, voided ones too. */
  filings: ReadonlyArray<JobLienFilingRow>
  job: LienUnvoidJob
  onChanged: () => void
}) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [shown, setShown] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Why a record stayed voided when its press was pressed, by the record's id: the database's own sentence, kept on its line. */
  const [stayed, setStayed] = useState<Record<string, string>>({})
  const drawn = lienUnvoidDrawn(role, job)
  const records = useMemo(() => (drawn ? lienVoidedRecords(filings) : []), [drawn, filings])
  if (records.length === 0) return null

  const putBack = async (record: JobLienFilingRow) => {
    if (busyId || lienUnvoidProblem(record)) return
    setBusyId(record.id)
    try {
      if (!(await confirmDialog(lienUnvoidConfirm(record)))) return
      const answer = await unvoidLienFiling(record)
      setStayed((s) => {
        const next = { ...s }
        delete next[record.id]
        return next
      })
      showToast(lienUnvoidDoneWords(answer), 'success')
      onChanged()
    } catch (e) {
      const words = formatErrorMessage(e, LIEN_UNVOID_WORDS.notDone)
      if (e instanceof LienUnvoidRefused) {
        // The rule turned it down on purpose: its reason, as it stands, on the record's line and in the toast. The
        // window reads again, so a record that is gone, or live already, leaves the list.
        setStayed((s) => ({ ...s, [record.id]: words }))
        showToast(words, 'warning')
        onChanged()
      } else {
        showToast(words, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.72rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
  return (
    <div data-testid="lien-voided-records" style={{ margin: '0 0 0.9rem', padding: '0 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.72rem', color: 'var(--text-700)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <b>
          {LIEN_UNVOID_WORDS.heading} · {records.length}
        </b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ paddingBottom: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>{LIEN_UNVOID_WORDS.lede}</p>
          {records.map((f) => {
            const fixed = lienUnvoidProblem(f)
            const why = fixed || stayed[f.id] || ''
            const dead = !!fixed || busyId != null
            return (
              <div key={f.id} data-testid="lien-voided-record" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', alignItems: 'center', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <ValueLines>
                    {lienUnvoidFacts(f).map((fact) => (
                      <ValueLine key={fact.label} label={fact.label}>
                        <WorkedOutValue>{fact.value}</WorkedOutValue>
                      </ValueLine>
                    ))}
                  </ValueLines>
                  {why ? (
                    <span style={{ display: 'block', color: 'var(--text-muted)' }} data-testid="lien-voided-record-why">
                      {why}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void putBack(f)}
                  disabled={dead}
                  style={fixed ? { ...word, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : { ...word, cursor: dead ? 'default' : 'pointer' }}
                >
                  {busyId === f.id ? LIEN_UNVOID_WORDS.busy : LIEN_UNVOID_WORDS.press}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
