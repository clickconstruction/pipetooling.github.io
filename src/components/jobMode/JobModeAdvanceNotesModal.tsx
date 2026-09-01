import { useEffect, useRef, useState, type CSSProperties } from 'react'

export type JobModeAdvanceDestination = {
  jobId: string
  /** e.g. "PLUM 512 · Smith House Repipe" */
  label: string
  /** e.g. "10:30 · 212 Baker St" */
  sublabel: string
  /** The picker's suggested next job — gets a "Suggested" tag when not selected. */
  suggested?: boolean
}

type Props = {
  open: boolean
  /** Slightly different copy depending on whether this clocks-in vs switches-focus. */
  intent: 'start-first' | 'next-job'
  /** Where the tech can go — today's still-open jobs, excluding the current one. */
  destinations: JobModeAdvanceDestination[]
  /** Preselected destination (usually the picker's suggested next job). */
  initialJobId: string | null
  saving: boolean
  errorMessage: string | null
  onConfirm: (notes: string, destinationJobId: string) => void
  /** When provided, renders a "Done for the day" row that hands off to the clock-out flow. */
  onDoneForDay?: (() => void) | null
  onCancel: () => void
}

const DONE_FOR_DAY = '__done_for_day__'
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
  maxHeight: '88vh',
  overflowY: 'auto',
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

const destListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
}

const destBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  textAlign: 'left',
  padding: '0.55rem 0.65rem',
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  cursor: 'pointer',
  color: 'var(--text-gray-800)',
}

const destSelectedStyle: CSSProperties = {
  ...destBaseStyle,
  border: '1.5px solid #16a34a',
  background: 'var(--bg-green-tint)',
}

const destDoneDayStyle: CSSProperties = {
  ...destBaseStyle,
  borderStyle: 'dashed',
}

const destDoneDaySelectedStyle: CSSProperties = {
  ...destSelectedStyle,
  border: '1.5px solid #dc2626',
  background: 'var(--bg-red-tint)',
}

const destDotStyle: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  flexShrink: 0,
  boxSizing: 'border-box',
  border: '2px solid var(--text-faint)',
}

const destLabelStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.05rem',
}

const destTagStyle: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  flexShrink: 0,
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
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-slate-tint)',
  color: 'var(--text-gray-800)',
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

const confirmDoneDayBtnStyle: CSSProperties = {
  ...confirmBtnStyle,
  background: '#dc2626',
}

export default function JobModeAdvanceNotesModal({
  open,
  intent,
  destinations,
  initialJobId,
  saving,
  errorMessage,
  onConfirm,
  onDoneForDay,
  onCancel,
}: Props) {
  const [notes, setNotes] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setNotes('')
      setSelectedId(initialJobId ?? destinations[0]?.jobId ?? null)
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open, initialJobId, destinations])

  if (!open) return null

  const doneDaySelected = selectedId === DONE_FOR_DAY
  const title = intent === 'start-first' ? 'Start first job' : 'Where to next?'
  const helper =
    intent === 'start-first'
      ? 'What do you intend to accomplish on this job? (optional)'
      : 'What did you accomplish on the last job? (optional)'

  function submit(text: string) {
    if (saving) return
    if (doneDaySelected) {
      onDoneForDay?.()
      return
    }
    if (!selectedId) return
    onConfirm(text, selectedId)
  }

  const confirmLabel = saving
    ? 'Working…'
    : doneDaySelected
      ? 'Clock Out'
      : intent === 'start-first'
        ? 'Clock In'
        : 'Confirm'

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-label={title}>
      <div style={dialogStyle}>
        <div style={titleStyle}>{title}</div>
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
        <div style={destListStyle} role="radiogroup" aria-label="Destination">
          {destinations.map((d) => {
            const selected = selectedId === d.jobId
            return (
              <button
                key={d.jobId}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                style={selected ? destSelectedStyle : destBaseStyle}
                onClick={() => setSelectedId(d.jobId)}
              >
                <span
                  style={
                    selected
                      ? { ...destDotStyle, border: '5px solid #16a34a', background: 'var(--surface)' }
                      : destDotStyle
                  }
                  aria-hidden="true"
                />
                <span style={destLabelStyle}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.sublabel}</span>
                </span>
                {d.suggested && !selected ? <span style={destTagStyle}>Suggested</span> : null}
              </button>
            )
          })}
          {onDoneForDay ? (
            <button
              type="button"
              role="radio"
              aria-checked={doneDaySelected}
              disabled={saving}
              style={doneDaySelected ? destDoneDaySelectedStyle : destDoneDayStyle}
              onClick={() => setSelectedId(DONE_FOR_DAY)}
            >
              <span
                style={
                  doneDaySelected
                    ? { ...destDotStyle, border: '5px solid #dc2626', background: 'var(--surface)' }
                    : destDotStyle
                }
                aria-hidden="true"
              />
              <span style={destLabelStyle}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Done for the day</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Clock out &amp; wrap up
                </span>
              </span>
            </button>
          ) : null}
        </div>
        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}
        <div style={actionRowStyle}>
          <button type="button" disabled={saving} style={cancelBtnStyle} onClick={onCancel}>
            Cancel
          </button>
          {!doneDaySelected ? (
            <button
              type="button"
              disabled={saving || !selectedId}
              style={skipBtnStyle}
              onClick={() => submit('')}
            >
              Skip notes
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving || !selectedId}
            style={doneDaySelected ? confirmDoneDayBtnStyle : confirmBtnStyle}
            onClick={() => submit(notes)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
