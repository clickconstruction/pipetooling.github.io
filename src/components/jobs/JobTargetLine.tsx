import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useExpectedHours, type ExpectedHoursApi } from '../../hooks/useExpectedHours'
import { canSetExpectedHours } from '../../lib/jobs/projectsBoard'
import { jobTargetWords, parseHours, targetDraftProblem, WHY_MAX } from '../../lib/jobs/jobTarget'
import { fetchJobTargetBudget, type JobTargetBudget } from '../../lib/jobs/jobTargetIo'

/**
 * The job's Target line on the job window's Job tab (punch list #255, v2.6585): the open expected hours
 * (`job_expected_hours`, v2.6321), else the labor budget's hours, else *No target yet*. The leader and the office
 * press **Set a target** or **Change the target** (hours and why, through `set_job_expected_hours`) and **Back to the
 * budget** (`clear_job_expected_hours`); everyone who opens the window reads it. The project board keeps its slider;
 * this is the door a service job never had, so the crew's hours against the target can be counted on any job.
 */

const ROW: CSSProperties = { marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '7px 11px', fontSize: '0.8rem', color: 'var(--text-base)', display: 'grid', gap: 6 }
const BUTTON: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.25rem 0.7rem', minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }
const FIELD: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }

export function JobTargetLine({ jobId, api: apiIn, readBudget = fetchJobTargetBudget }: { jobId: string; api?: ExpectedHoursApi; readBudget?: (jobId: string) => Promise<JobTargetBudget> }) {
  const { role, readOnly } = useAuth()
  const ids = useMemo(() => [jobId], [jobId])
  const live = useExpectedHours(ids, !apiIn)
  const api = apiIn ?? live
  const canEdit = canSetExpectedHours(role) && !readOnly
  const [budget, setBudget] = useState<JobTargetBudget | null>(null)
  const [editing, setEditing] = useState(false)
  const [hoursText, setHoursText] = useState('')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    void readBudget(jobId).then((b) => on && setBudget(b), () => on && setBudget({ hours: null, source: null }))
    return () => {
      on = false
    }
  }, [jobId, readBudget])

  const target = api.byJob.get(jobId) ?? null
  const words = jobTargetWords(target, budget?.hours ?? null, budget?.source ?? null)
  const draftProblem = targetDraftProblem(hoursText, why)

  const open = () => {
    setHoursText(words.counts != null ? String(Math.round(words.counts)) : '')
    setWhy('')
    setProblem(null)
    setEditing(true)
  }
  const keep = async () => {
    if (draftProblem) {
      setProblem(draftProblem)
      return
    }
    setBusy(true)
    setProblem(null)
    const saved = await api.setTarget(jobId, parseHours(hoursText), words.counts, why.trim())
    setBusy(false)
    if (saved) setEditing(false)
    else setProblem(api.error ?? 'The target was not saved.')
  }
  const clear = async () => {
    setBusy(true)
    setProblem(null)
    const ok = await api.clearTarget(jobId)
    setBusy(false)
    if (!ok) setProblem(api.error ?? 'The target was not cleared.')
  }

  return (
    <div style={ROW} data-testid="job-target-line" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>🎯 {words.head}</span>
        {canEdit && !editing ? (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {words.clearable ? (
              <button type="button" style={BUTTON} disabled={busy} onClick={() => void clear()}>
                Back to the budget
              </button>
            ) : null}
            <button type="button" style={BUTTON} disabled={busy} onClick={open}>
              {words.press}
            </button>
          </span>
        ) : null}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>{words.detail}</div>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} data-testid="job-target-edit">
          <input aria-label="Target hours" inputMode="decimal" value={hoursText} onChange={(e) => setHoursText(e.target.value)} style={{ ...FIELD, width: 72, textAlign: 'right', fontWeight: 700 }} />
          <span style={{ color: 'var(--text-muted)' }}>h</span>
          <input aria-label="Why this target" placeholder="why · the crew reads this" value={why} maxLength={WHY_MAX} onChange={(e) => setWhy(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void keep() }} style={{ ...FIELD, flex: '1 1 12rem' }} autoFocus />
          <button type="button" style={{ ...BUTTON, background: '#2563eb', borderColor: '#2563eb', color: '#fff', opacity: draftProblem ? 0.5 : 1 }} disabled={busy} onClick={() => void keep()}>
            {busy ? 'Keeping…' : 'Keep it'}
          </button>
          <button type="button" style={BUTTON} disabled={busy} onClick={() => setEditing(false)}>
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

export default JobTargetLine
