import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { canOpenGcProjects } from '../../lib/gc/access'
import { jobReviewLine, newestRating, starsGlyphs, type OfficeRating } from '../../lib/ratings/ratingsOffice'
import { supabaseRatingsOfficeIo, type RatingsOfficeIo } from '../../lib/ratings/ratingsOfficeIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The job's review line on the job window's Job tab (v2.5946, punch list #185 PR 4): the job's newest review ask, as
 * the office reads it. Asked and not opened, opened and not answered, or the stars with their words, the Google press
 * and the call. An answer at three stars or fewer that nobody called offers **I called**, with a line for what was said
 * (`customer_rating_called`). Nothing shows for a job never asked. The office team reads it (the table's policy).
 */

const ROW: CSSProperties = { marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '7px 11px', fontSize: '0.8rem', color: 'var(--text-base)', display: 'grid', gap: 6 }
const STARS_ON = '#f59e0b'
const BUTTON: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.25rem 0.7rem', minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }

export function JobReviewLine({ jobId, io: ioIn }: { jobId: string; io?: RatingsOfficeIo }) {
  const { role, readOnly } = useAuth()
  const io = useMemo(() => ioIn ?? supabaseRatingsOfficeIo(), [ioIn])
  const office = canOpenGcProjects(role)
  const [rows, setRows] = useState<OfficeRating[] | null>(null)
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    io.forJob(jobId)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]))
    return () => {
      live = false
    }
  }, [io, jobId])
  useEffect(() => (office ? load() : undefined), [office, load])

  const line = rows ? jobReviewLine(rows) : null
  if (!office || !line) return null
  const rating = rows ? newestRating(rows) : null

  const save = async () => {
    if (!rating) return
    setBusy(true)
    setProblem(null)
    try {
      await io.recordCall(rating.id, note)
      setNoting(false)
      setNote('')
      load()
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The call was not recorded.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={ROW} data-testid="job-review-line" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Review</span>
        {line.score != null ? (
          <span aria-hidden style={{ color: STARS_ON, letterSpacing: 1 }}>
            {starsGlyphs(line.score)}
          </span>
        ) : null}
        <span style={{ fontWeight: line.score != null ? 600 : 400, color: line.callOwed ? 'var(--text-red-700)' : 'var(--text-strong)' }}>{line.head}</span>
        {line.facts.length ? <span style={{ color: 'var(--text-muted)' }}>{line.facts.join(' · ')}</span> : null}
        {line.callOwed && !readOnly && !noting ? (
          <button type="button" style={{ ...BUTTON, marginLeft: 'auto' }} onClick={() => setNoting(true)}>
            I called
          </button>
        ) : null}
      </div>
      {line.words ? <div style={{ color: 'var(--text-700)', borderLeft: '3px solid var(--border-strong)', paddingLeft: 8 }}>“{line.words}”</div> : null}
      {line.callNote ? <div style={{ color: 'var(--text-muted)' }}>The call: {line.callNote}</div> : null}
      {noting ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="What was said on the call"
            placeholder="What was said, if you like"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: '1 1 14rem', font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <button type="button" style={{ ...BUTTON, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save the call'}
          </button>
          <button type="button" style={BUTTON} disabled={busy} onClick={() => setNoting(false)}>
            Not now
          </button>
        </div>
      ) : null}
      {problem ? (
        <div role="alert" style={{ color: 'var(--text-red-700)' }}>
          {problem}
        </div>
      ) : null}
    </div>
  )
}
