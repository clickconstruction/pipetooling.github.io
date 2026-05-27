import { useEffect, useMemo, useState } from 'react'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'

const MAX_RANGE_DAYS = 3650
const DEFAULT_BACKFILL_DAYS = 365

export type MercuryBackfillResult = {
  upserted: number
  start: string
  end: string
}

export type MercuryBackfillModalProps = {
  open: boolean
  onClose: () => void
  /** Resolves with the upserted count on success; should reject on error so the modal stays open. */
  onSubmit: (range: { start: string; end: string }) => Promise<MercuryBackfillResult>
}

function ymdDaysBetween(a: string, b: string): number {
  const aMs = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))
  const bMs = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)))
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return NaN
  return Math.round((bMs - aMs) / 86400000)
}

export function MercuryBackfillModal({ open, onClose, onSubmit }: MercuryBackfillModalProps) {
  const todayYmd = useMemo(() => denverCalendarDayKey(Date.now()), [])
  const defaultStartYmd = useMemo(() => ymdAddDays(todayYmd, -DEFAULT_BACKFILL_DAYS), [todayYmd])

  const [startYmd, setStartYmd] = useState<string>(defaultStartYmd)
  const [endYmd, setEndYmd] = useState<string>(todayYmd)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStartYmd(defaultStartYmd)
    setEndYmd(todayYmd)
    setErrorMsg(null)
    setSubmitting(false)
  }, [open, defaultStartYmd, todayYmd])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  const validationError: string | null = (() => {
    if (!startYmd || !endYmd) return 'Pick both Start and End dates.'
    if (startYmd > todayYmd || endYmd > todayYmd) return 'Dates cannot be in the future.'
    if (startYmd > endYmd) return 'Start must be on or before End.'
    const days = ymdDaysBetween(startYmd, endYmd)
    if (!Number.isFinite(days)) return 'Invalid date.'
    if (days > MAX_RANGE_DAYS) return `Range must be ${MAX_RANGE_DAYS} days or less.`
    return null
  })()

  const canSubmit = !submitting && validationError === null

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      await onSubmit({ start: startYmd, end: endYmd })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Backfill failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (submitting) return
    onClose()
  }

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
        zIndex: 1260,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercury-backfill-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          maxWidth: 460,
          width: '100%',
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="mercury-backfill-modal-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}
        >
          Backfill from Mercury
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
          Pull a custom date range from Mercury into <code>mercury_transactions</code>. Idempotent — already-synced rows are
          upserted, not duplicated. A 1-year window typically pulls ~10,000 transactions and takes ~20–30 seconds.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Date range</legend>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                Start
                <input
                  type="date"
                  value={startYmd}
                  max={endYmd && endYmd <= todayYmd ? endYmd : todayYmd}
                  onChange={(e) => setStartYmd(e.target.value)}
                  disabled={submitting}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                End
                <input
                  type="date"
                  value={endYmd}
                  min={startYmd || undefined}
                  max={todayYmd}
                  onChange={(e) => setEndYmd(e.target.value)}
                  disabled={submitting}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              </label>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Default is the last {DEFAULT_BACKFILL_DAYS} days. Maximum range is {MAX_RANGE_DAYS} days.
            </p>
          </fieldset>

          {validationError ? (
            <p
              role="status"
              style={{
                margin: 0,
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.8rem',
              }}
            >
              {validationError}
            </p>
          ) : null}

          {errorMsg ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem',
              background: 'white',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            style={{
              padding: '0.5rem 1rem',
              background: canSubmit ? '#2563eb' : '#94a3b8',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Running…' : 'Run backfill'}
          </button>
        </div>
      </div>
    </div>
  )
}
