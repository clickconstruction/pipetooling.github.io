import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useMyJobPapers } from '../../hooks/useJobsClosedToMe'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { JOB_PAPERS_RETURN_KEY, jobPapersGateView, lockedJobWords } from '../../lib/jobs/jobPapers'
import { supabaseJobPapersIo, type JobPapersIo } from '../../lib/jobs/jobPapersIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '0.9rem', display: 'grid', gap: '0.65rem' }
const title: CSSProperties = { margin: 0, fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.25, color: 'var(--text-strong)' }
const lead: CSSProperties = { margin: 0, fontSize: '0.84375rem', color: 'var(--text-700)' }
const paper: CSSProperties = { display: 'flex', gap: '0.55rem', alignItems: 'center', padding: '0.55rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8 }
const dot: CSSProperties = { flex: '0 0 22px', height: 22, borderRadius: 999, border: '2px solid var(--border-strong)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }
const bigPress: CSSProperties = { font: 'inherit', fontWeight: 700, fontSize: '0.9375rem', minHeight: 46, borderRadius: 9, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', padding: '0.5rem 0.9rem', textAlign: 'center', lineHeight: 1.2, cursor: 'pointer', width: '100%' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.78125rem', color: 'var(--text-muted)' }

/** Remember where the signing page sends this person back to, then leave for it. */
function leaveToSign(url: string, jobId: string, path: string) {
  try {
    window.sessionStorage.setItem(JOB_PAPERS_RETURN_KEY, JSON.stringify({ jobId, path }))
  } catch {
    // No session storage here: the signing page then offers the dashboard, and the job's prompt is still there.
  }
  window.location.assign(url)
}

/**
 * The prompt drawn in place of a job (papers before a job opens, step 3): **Before you open J2391**, the papers and
 * which are signed, and **Read and sign** on the first one that is not. It shows the job's number and the papers'
 * names and nothing else of the job. Read and sign opens the signing page the app already has, and that page sends
 * the person back here. With nothing left it offers **Open the job**. The job window, Job Mode's card and the
 * clock-in picker all draw this one card.
 */
export function JobPapersGate({
  jobId,
  onOpenJob,
  returnPath,
  footer,
  io = supabaseJobPapersIo,
}: {
  jobId: string
  /** Pressed on Open the job, once nothing is owed. */
  onOpenJob?: () => void
  /** The in-app path to come back to after signing. Defaults to the page the prompt is on. */
  returnPath?: string
  footer?: ReactNode
  io?: JobPapersIo
}) {
  const read = useMyJobPapers(jobId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setError(null), [jobId])

  if (read.failure && !read.mine) {
    return (
      <div style={card} data-job-papers-gate="failed">
        <OfflineRetryPanel failure={read.failure} onRetry={read.reload} surface="job-papers-gate" idempotent busy={read.loading} />
        {footer}
      </div>
    )
  }
  if (!read.mine) {
    return (
      <div style={card} data-job-papers-gate="loading">
        <p style={quiet}>Loading…</p>
      </div>
    )
  }

  const view = jobPapersGateView(read.mine, todayYmdInAppTz())
  const sign = async () => {
    if (busy || !view.next) return
    setBusy(true)
    setError(null)
    try {
      const url = await io.ownSigningLink(view.next.id)
      leaveToSign(url, jobId, returnPath ?? `${window.location.pathname}${window.location.search}`)
    } catch (e) {
      setError(formatErrorMessage(e, 'The signing page could not be opened.'))
      setBusy(false)
    }
  }

  return (
    <div style={card} data-job-papers-gate={view.allSigned ? 'signed' : 'owed'}>
      <h4 style={title}>{view.title}</h4>
      <p style={lead}>{view.lead}</p>
      {view.rows.map((r) => (
        <div key={r.id} style={paper} data-job-papers-gate-paper={r.done ? 'signed' : 'owed'}>
          <span style={r.done ? { ...dot, background: '#15803d', borderColor: '#15803d', color: '#fff' } : dot} aria-hidden="true">
            {r.done ? '✓' : ''}
          </span>
          <div>
            <b style={{ display: 'block', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.875rem' }}>{r.paperName}</b>
            <small style={{ color: 'var(--text-muted)' }}>{r.sub}</small>
          </div>
        </div>
      ))}
      {view.blocked ? (
        <p style={{ ...lead, color: 'var(--text-red-700)' }} role="alert">
          {view.blocked}
        </p>
      ) : null}
      {view.next && view.nextLabel ? (
        <button type="button" style={busy ? { ...bigPress, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' } : bigPress} disabled={busy} onClick={() => void sign()}>
          {busy ? 'Opening the paper…' : view.nextLabel}
        </button>
      ) : null}
      {view.allSigned && onOpenJob ? (
        <button type="button" style={{ ...bigPress, background: '#15803d', border: '1px solid #15803d' }} onClick={onOpenJob}>
          Open the job
        </button>
      ) : null}
      {error ? (
        <p style={{ ...quiet, color: 'var(--text-red-700)' }} role="alert">
          {error}
        </p>
      ) : null}
      {view.hidden ? <p style={quiet}>{view.hidden}</p> : null}
      {footer}
    </div>
  )
}

/**
 * A locked job in a list: a lock, the job's number and how many papers it waits on. Never its name, its address or
 * its customer. `where` picks the words: a list row, or the clock-in picker.
 */
export function LockedJobLine({ jobId, where = 'list', action = 'Sign ›' }: { jobId: string; where?: 'list' | 'clock'; action?: string | null }) {
  const read = useMyJobPapers(jobId)
  const words = lockedJobWords(read.mine, where)
  return (
    <span data-job-locked={jobId} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', minWidth: 0, textAlign: 'left' }}>
      <span aria-hidden="true" style={{ flex: '0 0 30px', height: 30, borderRadius: 8, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', display: 'grid', placeItems: 'center', fontSize: '0.9375rem' }}>
        🔒
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b style={{ display: 'block', color: 'var(--text-strong)', fontWeight: 600 }}>{words.number}</b>
        <small style={{ color: 'var(--text-muted)' }}>{words.line}</small>
      </span>
      {action ? <span style={{ color: 'var(--text-link)', fontWeight: 700, whiteSpace: 'nowrap' }}>{action}</span> : null}
    </span>
  )
}

export default JobPapersGate
