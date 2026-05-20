/**
 * Projects → Forecast → Specific: "Insert stage" naming / length modal.
 *
 * Opens when the user clicks the per-row "+" affordance in a stage's gutter (insert
 * AFTER that stage) or the toolbar's "Add stage to start" button (insert as
 * sequence_order = 1). Collects two inputs from the user:
 *
 *   - **Name** — required, defaults to "New stage".
 *   - **Length in days** — required ≥ 1, defaults to whatever the user last typed
 *     (persisted across sessions via localStorage so a "I'm adding a bunch of 3-day
 *     stages right now" workflow doesn't have to re-type 3 on every insert).
 *
 * The modal also surfaces a live preview built from `planInsertStageAfter`:
 *   - "Starts" / "Ends" YMDs for the new bar (recomputed as length changes).
 *   - How many later stages will shift forward by N days.
 *   - How many historical stages were intentionally skipped from the date shift
 *     (per the agreed `shift_pending_only` policy for completed / approved / skipped).
 *
 * The actual persistence (sequence_order bumps, scheduled_date updates, INSERT) lives
 * in the parent's `onConfirm` callback so this component stays presentation-only and
 * easy to test by inspection. The parent passes `dragSaving` as `applying` so the
 * footer's "Add stage" button disables across all in-flight saves (drag commits or
 * other inserts), preventing concurrent writers from racing on `sequence_order`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  planInsertStageAfter,
  type ForecastInsertStageInput,
} from '../../lib/projectsForecastInsertStage'

const LENGTH_STORAGE_KEY = 'projects_forecast_specific_insert_default_length_v1'
const MIN_LENGTH_DAYS = 1
const MAX_LENGTH_DAYS = 365
const DEFAULT_LENGTH_DAYS = 1

type Props = {
  /** All stages in the currently-selected workflow. Passed straight into
   *  `planInsertStageAfter` so the preview matches what the call site will persist. */
  stages: readonly ForecastInsertStageInput[]
  /** null = insert at the very start; string = id of the stage to insert AFTER. */
  afterStageId: string | null
  /** Display info for the "After: …" subtitle. null when inserting at the start. */
  afterStageDisplayNumber: number | null
  afterStageName: string | null
  /** Company-calendar "today" — same value the parent feeds into the resolver and
   *  passes to `planInsertStageAfter`. Used as the start anchor when inserting before
   *  the first stage. */
  todayYmd: string
  /** Disable the "Add stage" button while any save (drag commit or another insert) is
   *  in flight. */
  applying: boolean
  onConfirm: (name: string, lengthDays: number) => Promise<void>
  onClose: () => void
}

const DATE_FMT_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatYmdLong(ymd: string): string {
  if (!ymd) return '—'
  return DATE_FMT_LONG.format(new Date(`${ymd}T12:00:00`))
}

function readStoredDefaultLength(): number {
  if (typeof window === 'undefined') return DEFAULT_LENGTH_DAYS
  try {
    const raw = window.localStorage.getItem(LENGTH_STORAGE_KEY)
    if (!raw) return DEFAULT_LENGTH_DAYS
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return DEFAULT_LENGTH_DAYS
    if (parsed < MIN_LENGTH_DAYS) return MIN_LENGTH_DAYS
    if (parsed > MAX_LENGTH_DAYS) return MAX_LENGTH_DAYS
    return parsed
  } catch {
    return DEFAULT_LENGTH_DAYS
  }
}

function writeStoredDefaultLength(value: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LENGTH_STORAGE_KEY, String(value))
  } catch {
    /* ignore quota errors */
  }
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.8125rem',
  color: '#374151',
  fontWeight: 600,
}

const inputStyle: CSSProperties = {
  padding: '0.5rem 0.625rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.9375rem',
  color: '#0f172a',
  width: '100%',
  boxSizing: 'border-box',
  background: '#ffffff',
}

const previewRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 12,
  fontSize: '0.8125rem',
  color: '#0f172a',
}

const previewLabelStyle: CSSProperties = {
  color: '#6b7280',
  fontWeight: 500,
}

const previewValueStyle: CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontWeight: 600,
}

export function ProjectsForecastInsertStageModal({
  stages,
  afterStageId,
  afterStageDisplayNumber,
  afterStageName,
  todayYmd,
  applying,
  onConfirm,
  onClose,
}: Props) {
  const [name, setName] = useState<string>('New stage')
  const [lengthRaw, setLengthRaw] = useState<string>(() => String(readStoredDefaultLength()))
  const [submitting, setSubmitting] = useState<boolean>(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  // Focus + select the name on mount so users can either keep "New stage" by hitting
  // Enter, or just start typing to overwrite it.
  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const lengthDays = useMemo(() => {
    const parsed = Number.parseInt(lengthRaw, 10)
    if (!Number.isFinite(parsed)) return MIN_LENGTH_DAYS
    if (parsed < MIN_LENGTH_DAYS) return MIN_LENGTH_DAYS
    if (parsed > MAX_LENGTH_DAYS) return MAX_LENGTH_DAYS
    return parsed
  }, [lengthRaw])

  const plan = useMemo(
    () => planInsertStageAfter({ stages, afterStageId, todayYmd, lengthDays }),
    [stages, afterStageId, todayYmd, lengthDays],
  )

  const subtitle =
    afterStageId == null
      ? 'At the start of the workflow'
      : `After: Step ${afterStageDisplayNumber ?? '?'} · ${afterStageName ?? '(unnamed stage)'}`

  const shiftedCount = plan.shiftedOverrides.size
  const skippedCount = plan.skippedHistoricalCount

  const canSubmit = name.trim().length > 0 && !applying && !submitting

  const handleClose = useCallback(() => {
    if (submitting || applying) return
    onClose()
  }, [submitting, applying, onClose])

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) handleClose()
    },
    [handleClose],
  )

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) e.preventDefault()
      if (!canSubmit) return
      const trimmed = name.trim()
      setSubmitting(true)
      try {
        await onConfirm(trimmed, lengthDays)
        // Only persist the length once the insert succeeds — a failed insert often
        // means the user made a mistake; we don't want to "stickify" a bad value.
        writeStoredDefaultLength(lengthDays)
      } finally {
        setSubmitting(false)
      }
    },
    [canSubmit, name, lengthDays, onConfirm],
  )

  // Escape closes the modal (mirrors the Align modal's UX). Mounted at the document
  // level because the inputs steal keyboard focus.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a new stage"
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 10,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', lineHeight: 1.3 }}>
              Add a new stage
            </h2>
            <div
              style={{
                fontSize: '0.8125rem',
                color: '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={subtitle}
            >
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
            disabled={submitting || applying}
            style={{
              all: 'unset',
              cursor: submitting || applying ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}
          >
            <label style={labelStyle}>
              Name
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting || applying}
                aria-label="Stage name"
                maxLength={200}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Length (days)
              <input
                type="number"
                value={lengthRaw}
                onChange={(e) => setLengthRaw(e.target.value)}
                onBlur={() => setLengthRaw(String(lengthDays))}
                disabled={submitting || applying}
                aria-label="Length in days"
                min={MIN_LENGTH_DAYS}
                max={MAX_LENGTH_DAYS}
                step={1}
                style={{ ...inputStyle, width: 120 }}
              />
            </label>

            {/* Preview block */}
            <div
              style={{
                marginTop: '0.25rem',
                padding: '0.625rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={previewRowStyle}>
                <span style={previewLabelStyle}>Starts</span>
                <span style={previewValueStyle}>{formatYmdLong(plan.newRow.startYmd)}</span>
              </div>
              <div style={previewRowStyle}>
                <span style={previewLabelStyle}>Ends</span>
                <span style={previewValueStyle}>{formatYmdLong(plan.newRow.endYmd)}</span>
              </div>
              {shiftedCount > 0 ? (
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: '#475569',
                    paddingTop: 4,
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  {shiftedCount} later {shiftedCount === 1 ? 'stage' : 'stages'} will shift
                  forward by {lengthDays} {lengthDays === 1 ? 'day' : 'days'}.
                </div>
              ) : null}
              {skippedCount > 0 ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#92400e',
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: 4,
                    padding: '0.375rem 0.5rem',
                  }}
                >
                  {skippedCount} completed/approved {skippedCount === 1 ? 'stage' : 'stages'}{' '}
                  in the cascade will keep their scheduled dates (the timeline may briefly
                  show overlap until you adjust them).
                </div>
              ) : null}
              {shiftedCount === 0 && skippedCount === 0 ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    paddingTop: 4,
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  No later stages to shift.
                </div>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e5e7eb',
              background: '#f8fafc',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || applying}
              style={{
                padding: '0.5rem 0.875rem',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#374151',
                borderRadius: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: submitting || applying ? 'not-allowed' : 'pointer',
                opacity: submitting || applying ? 0.55 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={submitting || applying}
              style={{
                padding: '0.5rem 0.875rem',
                border: '1px solid #1d4ed8',
                background: canSubmit ? '#2563eb' : '#93c5fd',
                color: '#ffffff',
                borderRadius: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting || applying ? 'Adding…' : 'Add stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
