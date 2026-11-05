import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { importClockRows, importResultWords, jobNumberDigits, parseImportDayLines, readImportAnswer, type ImportAnswer } from '../../../lib/people/importDays'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { BTN, BTN_BLUE, BTN_QUIET, DeskRow, deskBtn } from '../personDeskShared'

/**
 * Import the days the app never recorded (punch list #265, PR 3, v2.6531): the dev-only door on the person's desk over
 * `import_clock_sessions` (v2.6425). One day a line — `YYYY-MM-DD, hours, where the day came from` — on one job named
 * by its number; each row lands as an imported clock session, unapproved, for the approval door, and the answer
 * names what went in, what was already there and what was refused, line by line.
 */
export function PersonDeskImportDays({ userId, displayName, onImported }: { userId: string; displayName: string; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [jobNumber, setJobNumber] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string[] | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const digits = jobNumberDigits(jobNumber)
    if (!digits) {
      setError('Name the job by its number, such as 1064.')
      return
    }
    const parsed = parseImportDayLines(text)
    if (parsed.rows.length === 0) {
      setError(parsed.problems.length ? importResultWords({ inserted: 0, skipped: 0, refused: [] }, parsed.problems, []).slice(1).join(' ') : 'Paste at least one day: YYYY-MM-DD, hours, where the day came from.')
      return
    }
    setBusy(true)
    try {
      const { data: job, error: jobError } = await supabase.from('jobs_ledger').select('id, job_name, billing_only').eq('click_number', digits).maybeSingle()
      if (jobError) throw jobError
      const j = job as { id: string; job_name: string | null; billing_only: boolean | null } | null
      if (!j) throw new Error(`No job carries the number ${digits}.`)
      if (j.billing_only) throw new Error(`Job ${digits} is billing-only; a day cannot go on it.`)
      const { data, error: rpcError } = await supabase.rpc('import_clock_sessions', { p_rows: importClockRows(parsed.rows, { userId, jobId: j.id }) })
      if (rpcError) throw rpcError
      const answer: ImportAnswer = readImportAnswer(data)
      setResult(importResultWords(answer, parsed.problems, parsed.rows))
      if (answer.inserted > 0) onImported()
    } catch (err) {
      setError(formatErrorMessage(err, 'The days were not imported.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DeskRow
      label="Imported days"
      actions={
        open ? null : (
          <button type="button" style={deskBtn(BTN, busy)} disabled={busy} onClick={() => setOpen(true)} data-testid="import-days-open">
            Import days…
          </button>
        )
      }
    >
      {!open ? (
        <span style={{ color: 'var(--text-muted)' }}>Days the app never recorded, one a line, on one job. They wait for approval like a punch.</span>
      ) : (
        <form noValidate onSubmit={(e) => void submit(e)} style={{ flexBasis: '100%', display: 'grid', gap: '0.4rem' }} data-testid="import-days-form">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
            <span>Job number</span>
            <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} aria-label="Job number" placeholder="1064" style={{ width: '7rem', fontSize: '0.8125rem', padding: '0.2rem 0.4rem' }} />
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem' }}>
            <span>One day a line: the day, the hours, where the day came from</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Days to import" rows={5} placeholder={'2026-10-06, 8, bank row of Oct 10'} style={{ fontSize: '0.8125rem', padding: '0.3rem 0.4rem', fontFamily: 'inherit' }} />
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" style={deskBtn(BTN_BLUE, busy)} disabled={busy}>
              {busy ? 'Importing…' : `Import ${displayName}'s days`}
            </button>
            <button type="button" style={deskBtn(BTN_QUIET, busy)} disabled={busy} onClick={() => { setOpen(false); setError(null); setResult(null) }}>
              Close
            </button>
          </div>
          {error ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }} role="alert">{error}</span> : null}
          {result ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="import-days-result">
              {result.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </form>
      )}
    </DeskRow>
  )
}
