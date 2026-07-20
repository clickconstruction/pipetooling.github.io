import { useEffect, useRef, useState, type ReactNode } from 'react'

export type ScheduleDispatchAssignJobPickerRow = {
  id: string
  displayTitle: string
  /** When set, show a muted hint (e.g. Quickfill: clocked on this job today). */
  sessionToday?: boolean
}

export function ScheduleDispatchAssignJobPickerModal({
  open,
  onClose,
  subtitle,
  jobRows,
  searchValue,
  onSearchChange,
  onPickJob,
  onCreateNewJob,
  notComingIn,
}: {
  open: boolean
  onClose: () => void
  subtitle: ReactNode
  jobRows: ScheduleDispatchAssignJobPickerRow[]
  searchValue: string
  onSearchChange: (v: string) => void
  onPickJob: (jobId: string) => void
  onCreateNewJob?: () => void
  /**
   * When provided, the footer offers a "Not coming in today" action with an inline confirm step.
   * Only meaningful when the picker is being opened for a single person on a single day
   * (cell-add intent); leave undefined for toolbar / multi-cell intents.
   */
  notComingIn?: {
    personLabel: string
    workDateLabel: string
    existingBlockCount: number
    busy?: boolean
    onConfirm: () => void | Promise<void>
  }
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const [notComingInConfirming, setNotComingInConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) setNotComingInConfirming(false)
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1003,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="hub-assign-job-picker-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 480,
          width: '92%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '0.75rem',
          }}
        >
          <h2 id="hub-assign-job-picker-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Add job to schedule
          </h2>
          {onCreateNewJob ? (
            <button
              type="button"
              onClick={onCreateNewJob}
              style={{
                boxSizing: 'border-box',
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.75rem',
                border: '1px solid #2563eb',
                borderRadius: 4,
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Create new job
            </button>
          ) : null}
        </div>
        {subtitle ? (
          <div style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>{subtitle}</div>
        ) : null}
        <input
          ref={searchRef}
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search HCP or job name"
          aria-label="Search jobs"
          style={{ marginBottom: '0.75rem', padding: '0.4rem', fontSize: '0.875rem' }}
        />
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 6 }}>
          {jobRows.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No jobs match.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {jobRows.map((r) => (
                <li key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => onPickJob(r.id)}
                    aria-label={
                      r.sessionToday ? `${r.displayTitle}, clocked today` : r.displayTitle
                    }
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.55rem 0.75rem',
                      border: 'none',
                      background: r.sessionToday ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ minWidth: 0, flex: 1 }}>{r.displayTitle}</span>
                    {r.sessionToday ? (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-blue-800)',
                          background: 'var(--bg-blue-200)',
                          padding: '0.12rem 0.4rem',
                          borderRadius: 4,
                        }}
                      >
                        Clocked today
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {notComingIn && notComingInConfirming ? (
          <div
            role="alertdialog"
            aria-label="Confirm mark not coming in today"
            style={{
              border: '1px solid #fecaca',
              background: 'var(--bg-red-tint)',
              borderRadius: 6,
              padding: '0.6rem 0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-red-900)', lineHeight: 1.4 }}>
              Mark <strong>{notComingIn.personLabel}</strong> as not coming in
              {notComingIn.workDateLabel ? (
                <>
                  {' '}on <strong>{notComingIn.workDateLabel}</strong>
                </>
              ) : null}
              ?
              {notComingIn.existingBlockCount > 0 ? (
                <>
                  {' '}
                  This will also remove their{' '}
                  <strong>
                    {notComingIn.existingBlockCount} existing schedule block
                    {notComingIn.existingBlockCount === 1 ? '' : 's'}
                  </strong>{' '}
                  for the day.
                </>
              ) : null}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={notComingIn.busy}
                onClick={() => setNotComingInConfirming(false)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={notComingIn.busy}
                onClick={() => {
                  if (notComingIn.busy) return
                  void notComingIn.onConfirm()
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: notComingIn.busy ? '#fca5a5' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {notComingIn.busy ? 'Saving…' : 'Confirm not coming in'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              {notComingIn ? (
                <button
                  type="button"
                  disabled={notComingIn.busy}
                  onClick={() => setNotComingInConfirming(true)}
                  style={{
                    padding: '0.45rem 0.6rem',
                    fontSize: '0.8125rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-red-700)',
                    cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  Not coming in today
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
