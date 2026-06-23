import { useEffect, useState } from 'react'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'

export type StagesAlertJobListModalProps = {
  open: boolean
  onClose: () => void
  jobs: JobWithDetails[]
  onSelectJob: (jobId: string) => void
  title: string
  /** Used for aria-labelledby */
  titleId: string
  description: string
  /** Shown when jobs.length === 0 */
  emptyMessage?: string
}

export default function StagesAlertJobListModal({
  open,
  onClose,
  jobs,
  onSelectJob,
  title,
  titleId,
  description,
  emptyMessage = 'None match this view.',
}: StagesAlertJobListModalProps) {
  const [hoverRowId, setHoverRowId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setHoverRowId(null)
  }, [open])

  if (!open) return null

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
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: '#fef2f2',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 520,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          border: '1px solid #fecaca',
          boxShadow: 'inset 3px 0 0 #fecaca',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#b91c1c' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#991b1b' }}>{description}</p>
        {jobs.length === 0 ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#991b1b' }}>{emptyMessage}</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 1rem',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              border: '1px solid #fecaca',
              borderRadius: 6,
              background: '#fff',
            }}
          >
            {jobs.map((j) => {
              const hcp = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
              const name = (j.job_name ?? '').trim() || '—'
              const addr = (j.job_address ?? '').trim()
              const hovered = hoverRowId === j.id
              return (
                <li key={j.id} style={{ borderBottom: '1px solid #fecaca' }}>
                  <button
                    type="button"
                    onClick={() => onSelectJob(j.id)}
                    onMouseEnter={() => setHoverRowId(j.id)}
                    onMouseLeave={() => setHoverRowId(null)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: 'none',
                      background: hovered ? '#fee2e2' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      color: '#111827',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {hcp} · {name}
                    </div>
                    {addr ? (
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{addr}</div>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
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
