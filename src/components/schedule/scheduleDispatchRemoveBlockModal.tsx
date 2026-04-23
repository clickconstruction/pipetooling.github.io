import {
  MIN_MIN,
  MAX_MIN,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import {
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from '../../lib/jobScheduleOverlap'

export function validateScheduleDispatchBlockTimeRange(
  timeStart: string,
  timeEnd: string,
): string | null {
  const ts = timeInputToPg(timeStart)
  const te = timeInputToPg(timeEnd)
  const sm = scheduleTimeToMinutesFromMidnight(ts)
  const em = scheduleTimeToMinutesFromMidnight(te)
  return validateJobScheduleBlockMinuteRange({
    startMin: sm,
    endMin: em,
    minWallMin: MIN_MIN,
    maxWallMin: MAX_MIN,
  })
}

export function RemoveScheduleBlockConfirmModal({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
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
        zIndex: 1004,
      }}
      onClick={() => {
        if (!busy) onCancel()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dispatch-remove-block-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 400,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="schedule-dispatch-remove-block-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
          Remove this scheduled block?
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: busy ? '#e5e7eb' : '#b91c1c',
              color: busy ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}
