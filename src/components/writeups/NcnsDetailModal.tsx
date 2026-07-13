import { useEffect } from 'react'
import type { NcnsListRow } from './writeupsTimelineTypes'

type Props = {
  open: boolean
  row: NcnsListRow | null
  onClose: () => void
}

function formatWorkDateYmd(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

export function NcnsDetailModal({ open, row, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !row) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="ncns-detail-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="ncns-detail-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
          No-call, no-show
        </h3>
        <dl style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', display: 'grid', gap: '0.65rem' }}>
          <div>
            <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Subject</dt>
            <dd style={{ margin: '0.15rem 0 0 0' }}>{row.subject_name}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Work date</dt>
            <dd style={{ margin: '0.15rem 0 0 0' }}>{formatWorkDateYmd(row.work_date)}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Recorded</dt>
            <dd style={{ margin: '0.15rem 0 0 0' }}>{new Date(row.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Recorded by</dt>
            <dd style={{ margin: '0.15rem 0 0 0' }}>{row.author_name}</dd>
          </div>
          {row.source ? (
            <div>
              <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Source</dt>
              <dd style={{ margin: '0.15rem 0 0 0' }}>{row.source}</dd>
            </div>
          ) : null}
          {row.details && row.details.trim() !== '' ? (
            <div>
              <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Details</dt>
              <dd
                style={{
                  margin: '0.15rem 0 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {row.details}
              </dd>
            </div>
          ) : null}
          <div>
            <dt style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Payroll note</dt>
            <dd style={{ margin: '0.15rem 0 0 0' }}>
              {row.had_approved_sessions
                ? 'This day included approved time; hours were removed from payroll totals when NCNS was recorded.'
                : 'No approved sessions were on this day when NCNS was recorded.'}
            </dd>
          </div>
        </dl>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 0.85rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
