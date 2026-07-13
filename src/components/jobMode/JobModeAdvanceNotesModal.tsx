import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Props = {
  open: boolean
  /** Header label for the destination job, e.g. "Next: JP523 · Mission Hills". */
  destinationLabel: string
  /** Slightly different copy depending on whether this clocks-in vs switches-focus. */
  intent: 'start-first' | 'next-job'
  saving: boolean
  errorMessage: string | null
  onConfirm: (notes: string) => void
  onCancel: () => void
}

const Z_INDEX = 1100

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: Z_INDEX,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const dialogStyle: CSSProperties = {
  width: 'min(92vw, 460px)',
  background: 'var(--surface)',
  borderRadius: 12,
  padding: '1.1rem 1.1rem 1rem',
  boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const titleStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text-strong)',
  textAlign: 'center',
}

const subtitleStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-700)',
  textAlign: 'center',
  margin: 0,
}

const inputStyle: CSSProperties = {
  width: '100%',
  fontSize: '1rem',
  padding: '0.65rem 0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  boxSizing: 'border-box',
}

const errorStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--text-red-700)',
  textAlign: 'center',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const cancelBtnStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const skipBtnStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: 'var(--bg-slate-tint)',
  color: '#1f2937',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const confirmBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.7rem 0.9rem',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
}

export default function JobModeAdvanceNotesModal({
  open,
  destinationLabel,
  intent,
  saving,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  const [notes, setNotes] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setNotes('')
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const title = intent === 'start-first' ? 'Start first job' : 'Switch to next job'
  const helper =
    intent === 'start-first'
      ? 'What do you intend to accomplish on this job? (optional)'
      : 'What did you accomplish on the last job? (optional)'

  function submit(text: string) {
    if (saving) return
    onConfirm(text)
  }

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-label={title}>
      <div style={dialogStyle}>
        <div style={titleStyle}>{title}</div>
        <p style={subtitleStyle}>{destinationLabel}</p>
        <p style={{ ...subtitleStyle, color: 'var(--text-muted)' }}>{helper}</p>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit(notes)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              if (!saving) onCancel()
            }
          }}
          disabled={saving}
          placeholder="Notes"
          style={inputStyle}
        />
        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}
        <div style={actionRowStyle}>
          <button type="button" disabled={saving} style={cancelBtnStyle} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            style={skipBtnStyle}
            onClick={() => submit('')}
          >
            Skip notes
          </button>
          <button
            type="button"
            disabled={saving}
            style={confirmBtnStyle}
            onClick={() => submit(notes)}
          >
            {saving ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
