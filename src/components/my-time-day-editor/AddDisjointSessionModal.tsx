import { useEffect, useState } from 'react'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import { MIN_SEGMENT_MS } from '../../lib/myTimeDayTimeline'

export type AddDisjointSessionExistingInterval = {
  startMs: number
  endMs: number | null
}

export type AddDisjointSessionConfirmPayload = {
  clockedInIso: string
  clockedOutIso: string
  workDateYmd: string
}

export type AddDisjointSessionModalProps = {
  defaultClockInIso: string
  defaultClockOutIso: string
  workDateYmd: string
  existingIntervals: ReadonlyArray<AddDisjointSessionExistingInterval>
  onClose: () => void
  onConfirm: (payload: AddDisjointSessionConfirmPayload) => void
  zIndex?: number
}

function formatHm(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatExistingRangeForError(
  iv: AddDisjointSessionExistingInterval,
  nowMs: number,
): string {
  const start = formatHm(iv.startMs)
  if (iv.endMs == null) return `${start} – Open`
  const endRef = Math.min(iv.endMs, nowMs)
  return `${start} – ${formatHm(endRef)}`
}

/**
 * Returns the first overlapping interval (half-open). Open sessions are treated as
 * extending to `nowMs` for the overlap check so the user can't insert "underneath"
 * an in-progress session.
 */
function firstOverlap(
  inMs: number,
  outMs: number,
  existingIntervals: ReadonlyArray<AddDisjointSessionExistingInterval>,
  nowMs: number,
): AddDisjointSessionExistingInterval | null {
  for (const iv of existingIntervals) {
    const ivEnd = iv.endMs ?? nowMs
    if (inMs < ivEnd && outMs > iv.startMs) return iv
  }
  return null
}

export function AddDisjointSessionModal({
  defaultClockInIso,
  defaultClockOutIso,
  workDateYmd,
  existingIntervals,
  onClose,
  onConfirm,
  zIndex = 1300,
}: AddDisjointSessionModalProps) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClockIn(toDatetimeLocal(defaultClockInIso))
    setClockOut(toDatetimeLocal(defaultClockOutIso))
    setError(null)
  }, [defaultClockInIso, defaultClockOutIso])

  function handleSubmit() {
    setError(null)
    const inIso = fromDatetimeLocal(clockIn)
    if (!inIso) {
      setError('Clock in is required.')
      return
    }
    const outIso = fromDatetimeLocal(clockOut)
    if (!outIso) {
      setError('Clock out is required.')
      return
    }
    const inMs = new Date(inIso).getTime()
    const outMs = new Date(outIso).getTime()
    const nowMs = Date.now()
    if (outMs <= inMs) {
      setError('Clock out must be after clock in.')
      return
    }
    if (outMs - inMs < MIN_SEGMENT_MS) {
      setError('Session must be at least 0.01 hours (~36 seconds).')
      return
    }
    if (inMs > nowMs) {
      setError('Clock-in cannot be in the future.')
      return
    }
    if (outMs > nowMs) {
      setError('Clock-out cannot be in the future.')
      return
    }
    const overlap = firstOverlap(inMs, outMs, existingIntervals, nowMs)
    if (overlap) {
      setError(
        `Overlaps an existing session at ${formatExistingRangeForError(overlap, nowMs)}. Adjust the times or close the other session.`,
      )
      return
    }
    onConfirm({ clockedInIso: inIso, clockedOutIso: outIso, workDateYmd })
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-disjoint-session-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="add-disjoint-session-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 600 }}
        >
          Add disjoint session
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          Insert a new closed clock session. Notes and job/bid can be edited after Save.
        </p>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '0.25rem',
            }}
          >
            Clock in
          </span>
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            style={{
              padding: '0.4rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: '0.875rem',
              width: '100%',
              maxWidth: 300,
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '0.25rem',
            }}
          >
            Clock out
          </span>
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            style={{
              padding: '0.4rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: '0.875rem',
              width: '100%',
              maxWidth: 300,
            }}
          />
        </label>
        {error ? (
          <p
            style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#b91c1c' }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '0.45rem 0.85rem',
              border: 'none',
              borderRadius: 4,
              background: '#3b82f6',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
