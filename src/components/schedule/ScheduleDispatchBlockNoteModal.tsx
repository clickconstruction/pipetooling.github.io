import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'

const NOTE_MAX = 500

export function ScheduleDispatchBlockNoteModal({
  open,
  initialNote,
  title = 'Job instructions',
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean
  initialNote: string | null
  title?: string
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (notePlain: string) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) {
      setValue(initialNote?.trim() ? initialNote : '')
    }
  }, [open, initialNote])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation()
        onClose()
      }
    },
    [busy, onClose],
  )

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
        zIndex: 1005,
      }}
      onClick={() => {
        if (!busy) onClose()
      }}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dispatch-block-note-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 480,
          width: '92%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="schedule-dispatch-block-note-title" style={{ margin: 0, fontSize: '1.05rem' }}>
          {title}
        </h2>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          rows={5}
          disabled={busy}
          aria-label="Job instructions"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.5rem 0.6rem',
            fontSize: '0.875rem',
            lineHeight: 1.4,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            resize: 'vertical',
            minHeight: 100,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {value.length} / {NOTE_MAX}
        </div>
        {error ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}
        >
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setValue('')}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(value)}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: busy ? 'var(--bg-200)' : '#2563eb',
                color: busy ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
