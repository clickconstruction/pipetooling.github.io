import { useEffect, type CSSProperties } from 'react'
import JobStatusStepper, { type JobStatusStepperJob } from './JobStatusStepper'
import type { JobWindowVerb } from '../../lib/jobs/jobWindowBar'

const btn: CSSProperties = {
  padding: '0.7rem 0.75rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.1,
}
const verbTone: Record<JobWindowVerb['tone'], CSSProperties> = {
  blue: { background: 'var(--text-link)', borderColor: 'var(--text-link)', color: '#fff' },
  green: { background: '#16a34a', borderColor: '#16a34a', color: '#fff' },
  red: { background: '#dc2626', borderColor: '#dc2626', color: '#fff' },
}

/**
 * The job window's phone action bar (punch list #30, PR 2b): a non-scrolling row under the
 * body — Status ▾ · the job's next verb · Note — so the assistant's four moves are on screen
 * at any scroll depth instead of on the Edit tab or 1,400 px down.
 */
export function JobWindowActionBar({ verb, onStatus, onVerb, onNote }: { verb: JobWindowVerb | null; onStatus: () => void; onVerb: () => void; onNote: () => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Job actions"
      style={{
        display: 'grid',
        gridTemplateColumns: verb ? 'auto 1fr auto' : 'auto 1fr',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      <button type="button" onClick={onStatus} style={btn} aria-haspopup="dialog">
        Status ▾
      </button>
      {verb ? (
        <button type="button" onClick={onVerb} style={{ ...btn, ...verbTone[verb.tone], textAlign: 'center' }}>
          {verb.label}
        </button>
      ) : null}
      <button type="button" onClick={onNote} style={{ ...btn, ...(verb ? null : { justifySelf: 'end' }) }}>
        Note
      </button>
    </div>
  )
}

/** Status ▾: the Edit tab's stepper, rail and guards intact, in a bottom sheet. */
export function JobWindowStatusSheet({ open, job, authRole, onChanged, onClose }: { open: boolean; job: JobStatusStepperJob; authRole: string | null; onChanged: () => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!open) return null
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1020 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Job status"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 640, padding: '0.6rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', boxSizing: 'border-box' }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 0.5rem' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>Status</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tap the next stage. A move that needs a reason, a bill line or a payment asks for it, as on the Edit tab.</div>
        <JobStatusStepper job={job} authRole={authRole} onChanged={onChanged} />
      </div>
    </div>
  )
}
