/**
 * Projects → Forecast → Specific: "Align stages" preview + apply modal.
 *
 * Opens from the Specific tab toolbar's "Align stages" button. Snapshots the selected
 * job's `project_workflow_steps` rows once, computes an `AlignmentPlan` via
 * `buildAlignmentPlan`, and renders a per-row preview table:
 *
 *   - First stage is the anchor — its `scheduled_start_date` (or `started_at`, or
 *     today) is preserved. The header banner explains where the anchor came from.
 *   - Each subsequent stage's `scheduled_start_date` is set to the previous stage's
 *     `scheduled_end_date`; length (in calendar days) is preserved when both dates
 *     were set, otherwise defaults to 1.
 *
 * Apply path: UPDATEs run in parallel via `withSupabaseRetry` on
 * `project_workflow_steps`. Partial failure keeps the modal open with a per-row
 * error tail; successful rows are remembered so the next Apply only retries the
 * failed ones. The parent's existing `project_workflow_steps` realtime channel
 * refreshes the chart in ~280 ms so we never need to push a manual reload.
 *
 * Gating: only mounted by the parent when the role is in `ALIGN_EDITOR_ROLES`. The
 * server-side UPDATE policy is the canonical authority — any RLS rejection here
 * surfaces as a per-row inline error.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  forecastBarSwatch,
  forecastStageColorKey,
  type ForecastStageStatus,
} from '../../lib/projectsForecastColors'
import {
  buildAlignmentPlan,
  type AlignStageInput,
  type AlignmentRow,
} from '../../lib/projectsForecastAlignStages'

type Props = {
  /** Display label for the header banner (e.g. `JP740 · Mission Hills`). */
  jobLabel: string
  /** Raw stage rows for the selected job's workflow (before resolver chaining). */
  stages: readonly AlignStageInput[]
  /** Company-calendar "today" (the same value the Specific tab passes to its
   *  resolver), used as the final anchor fallback. */
  todayYmd: string
  onClose: () => void
  /** Fired after a fully successful Apply (and after the success toast). The parent
   *  typically closes the modal in response — the chart itself refreshes via
   *  realtime so no manual reload is needed. */
  onApplied: () => void
}

const DATE_FMT_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatYmdLong(ymd: string | null): string {
  if (!ymd) return '\u2014'
  // Use noon Central to avoid DST/UTC drift.
  return DATE_FMT_LONG.format(new Date(`${ymd}T12:00:00`))
}

function describeOldDates(row: AlignmentRow): string {
  if (row.oldStartYmd && row.oldEndYmd) {
    return `${formatYmdLong(row.oldStartYmd)} \u2192 ${formatYmdLong(row.oldEndYmd)}`
  }
  if (row.oldStartYmd) return `${formatYmdLong(row.oldStartYmd)} (no end)`
  if (row.oldEndYmd) return `(no start) \u2192 ${formatYmdLong(row.oldEndYmd)}`
  return '(none)'
}

function describeNewDates(row: AlignmentRow): string {
  const len = row.lengthDays
  const lenLabel = len === 1 ? '1 day' : `${len} days`
  return `${formatYmdLong(row.newStartYmd)} \u2192 ${formatYmdLong(row.newEndYmd)} \u00b7 ${lenLabel}`
}

const CHANGE_PILL_STYLES: Record<AlignmentRow['change'], CSSProperties> = {
  unchanged: {
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  },
  shifted: {
    background: 'var(--bg-blue-200)',
    color: 'var(--text-blue-700)',
    border: '1px solid #93c5fd',
  },
  filled: {
    background: 'var(--bg-amber-100)',
    color: 'var(--text-amber-800)',
    border: '1px solid #fcd34d',
  },
  repaired: {
    background: 'var(--bg-red-100)',
    color: 'var(--text-red-800)',
    border: '1px solid #fca5a5',
  },
}

const CHANGE_PILL_LABELS: Record<AlignmentRow['change'], string> = {
  unchanged: 'unchanged',
  shifted: 'shifted',
  filled: 'filled',
  repaired: 'repaired',
}

const CHANGE_PILL_TITLES: Record<AlignmentRow['change'], string> = {
  unchanged: 'No change \u2014 already aligned',
  shifted: 'Scheduled dates will move to chain to the previous stage',
  filled: 'Missing scheduled dates will be filled in (length defaults to 1 day)',
  repaired:
    'Scheduled end was before scheduled start \u2014 will be repaired to a 1-day stage',
}

function describeAnchorBanner(
  jobLabel: string,
  anchorSource: ReturnType<typeof buildAlignmentPlan>['anchorSource'],
  anchorYmd: string,
): { tone: 'info' | 'warn' | 'error'; text: string } {
  if (anchorSource === 'none') {
    return { tone: 'error', text: 'Could not determine an anchor date for this job.' }
  }
  const friendly = formatYmdLong(anchorYmd)
  if (anchorSource === 'scheduled_start_date') {
    return {
      tone: 'info',
      text: `Anchored to ${jobLabel} \u2014 stage 1 starts ${friendly}.`,
    }
  }
  if (anchorSource === 'started_at') {
    return {
      tone: 'info',
      text: `Anchored to stage 1's actual start (${friendly}) since it has no scheduled start yet.`,
    }
  }
  return {
    tone: 'warn',
    text: `No scheduled start on stage 1 yet \u2014 anchoring on today (${friendly}). Set stage 1's expected start first if you want a different anchor.`,
  }
}

export function ProjectsForecastAlignStagesModal({
  jobLabel,
  stages,
  todayYmd,
  onClose,
  onApplied,
}: Props) {
  const { showToast } = useToastContext()

  // Snapshot the plan once on open. Realtime updates from the parent will refresh
  // the chart in the background, but we deliberately don't recompute under the
  // user's feet — the user already clicked "Align" intending to commit *this*
  // snapshot. They can cancel and reopen if data changed materially.
  const plan = useMemo(() => buildAlignmentPlan(stages, todayYmd), [stages, todayYmd])
  const anchorBanner = describeAnchorBanner(jobLabel, plan.anchorSource, plan.anchorYmd)

  const [applying, setApplying] = useState<boolean>(false)
  const [errorByRow, setErrorByRow] = useState<Map<string, string>>(() => new Map())
  const [succeededIds, setSucceededIds] = useState<Set<string>>(() => new Set())
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ESC closes when not applying.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, applying])

  // Body scroll lock.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const onBackdropClick = useCallback(() => {
    if (applying) return
    onClose()
  }, [applying, onClose])

  const pendingRows = useMemo(
    () => plan.changedRows.filter((r) => !succeededIds.has(r.stageId)),
    [plan.changedRows, succeededIds],
  )

  const isRetry = errorByRow.size > 0
  const applyButtonLabel = applying
    ? 'Applying\u2026'
    : isRetry
      ? `Retry ${errorByRow.size} ${errorByRow.size === 1 ? 'stage' : 'stages'}`
      : pendingRows.length > 0
        ? `Apply ${pendingRows.length} ${pendingRows.length === 1 ? 'change' : 'changes'}`
        : 'No changes'
  const applyDisabled =
    applying || pendingRows.length === 0 || plan.anchorSource === 'none'

  const handleApply = useCallback(async () => {
    if (pendingRows.length === 0) return
    setApplying(true)
    setGlobalError(null)
    const newSucceeded = new Set(succeededIds)
    const newErrors = new Map<string, string>()

    const results = await Promise.all(
      pendingRows.map(async (row) => {
        try {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('project_workflow_steps')
                .update({
                  scheduled_start_date: row.newStartYmd,
                  scheduled_end_date: row.newEndYmd,
                })
                .eq('id', row.stageId),
            `align project_workflow_steps row ${row.stageId}`,
          )
          return { stageId: row.stageId, ok: true as const }
        } catch (e) {
          return {
            stageId: row.stageId,
            ok: false as const,
            error: formatErrorMessage(e, 'Update failed'),
          }
        }
      }),
    )

    for (const r of results) {
      if (r.ok) {
        newSucceeded.add(r.stageId)
      } else {
        newErrors.set(r.stageId, r.error)
      }
    }
    setSucceededIds(newSucceeded)
    setErrorByRow(newErrors)
    setApplying(false)

    if (newErrors.size === 0) {
      const total = newSucceeded.size
      showToast(
        `Aligned ${total} ${total === 1 ? 'stage' : 'stages'}.`,
        'success',
      )
      onApplied()
    } else {
      const okCount = results.filter((r) => r.ok).length
      if (okCount > 0) {
        showToast(
          `Aligned ${okCount} of ${results.length}; ${newErrors.size} failed.`,
          'error',
        )
      }
      setGlobalError(
        `Could not save ${newErrors.size} ${newErrors.size === 1 ? 'stage' : 'stages'}. See the rows below.`,
      )
    }
  }, [pendingRows, showToast, succeededIds, onApplied])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Align stages for ${jobLabel}`}
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
          background: 'var(--surface)',
          borderRadius: 10,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 760,
          maxHeight: 'calc(100vh - 2rem)',
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
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-slate-900)', lineHeight: 1.3 }}>
              Align stages
            </h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-slate-600)' }}>
              {plan.changedRows.length === 0
                ? `${plan.rows.length} ${plan.rows.length === 1 ? 'stage' : 'stages'} \u00b7 already aligned`
                : `${plan.changedRows.length} of ${plan.rows.length} ${plan.rows.length === 1 ? 'stage' : 'stages'} will change`}
            </div>
          </div>
          <button
            type="button"
            onClick={onBackdropClick}
            aria-label="Close"
            title="Close"
            disabled={applying}
            style={{
              all: 'unset',
              cursor: applying ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              padding: '0.25rem 0.5rem',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div
            role={anchorBanner.tone === 'error' ? 'alert' : undefined}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              fontSize: '0.8125rem',
              ...(anchorBanner.tone === 'error'
                ? {
                    background: 'var(--bg-red-tint)',
                    border: '1px solid #fecaca',
                    color: 'var(--text-red-800)',
                  }
                : anchorBanner.tone === 'warn'
                  ? {
                      background: 'var(--bg-amber-tint)',
                      border: '1px solid #fcd34d',
                      color: 'var(--text-amber-800)',
                    }
                  : {
                      background: 'var(--bg-blue-tint)',
                      border: '1px solid #bfdbfe',
                      color: 'var(--text-blue-700)',
                    }),
            }}
          >
            {anchorBanner.text}
          </div>

          {globalError ? (
            <div
              role="alert"
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 6,
                color: 'var(--text-red-800)',
                fontSize: '0.8125rem',
              }}
            >
              {globalError}
            </div>
          ) : null}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-slate-tint)', color: 'var(--text-slate-600)' }}>
                  <th style={thStyleNum}>#</th>
                  <th style={thStyle}>Stage</th>
                  <th style={thStyle}>Current</th>
                  <th style={thStyle}>New</th>
                  <th style={thStyleCenter}>Change</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <PlanRow
                    key={row.stageId}
                    row={row}
                    succeeded={succeededIds.has(row.stageId)}
                    error={errorByRow.get(row.stageId) ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {plan.rows.length > 0 && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Each subsequent stage starts where the previous one ends, preserving each
              stage's existing length. Stages with missing scheduled dates default to a
              1-day length. Recorded actual start/end timestamps are not changed.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={onClose} disabled={applying} style={footerSecondaryStyle}>
            {succeededIds.size > 0 && errorByRow.size === 0 ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applyDisabled}
            style={{
              ...footerPrimaryStyle,
              opacity: applyDisabled ? 0.55 : 1,
              cursor: applyDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {applyButtonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanRow({
  row,
  succeeded,
  error,
}: {
  row: AlignmentRow
  succeeded: boolean
  error: string | null
}) {
  const isUnscheduled = row.oldStartYmd == null && row.oldEndYmd == null
  const colorKey = forecastStageColorKey(
    (row.status ?? null) as ForecastStageStatus | null,
    isUnscheduled,
  )
  const swatch = forecastBarSwatch(colorKey)

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
        <td style={tdStyleNum}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              height: 18,
              padding: '0 6px',
              borderRadius: 4,
              background: swatch.background,
              color: swatch.textColor,
              border: `1px solid ${swatch.borderColor}`,
              fontSize: '0.6875rem',
              fontWeight: 700,
              textDecoration: swatch.textDecoration,
            }}
          >
            {row.sequenceOrder}
          </span>
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ color: 'var(--text-slate-900)', fontWeight: 500, overflowWrap: 'break-word' }}>
              {row.name || '(unnamed)'}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {row.isHistorical ? (
                <span
                  title="This stage's status is completed, approved, or skipped — only the scheduled (forecast) dates change. Recorded actual timestamps are not touched."
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    padding: '0.05rem 0.4rem',
                    borderRadius: 3,
                    background: 'var(--bg-muted)',
                    color: 'var(--text-600)',
                    border: '1px solid var(--border)',
                  }}
                >
                  historical
                </span>
              ) : null}
              {succeeded ? (
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    padding: '0.05rem 0.4rem',
                    borderRadius: 3,
                    background: 'var(--bg-green-100)',
                    color: 'var(--text-green-800)',
                    border: '1px solid #86efac',
                  }}
                >
                  saved
                </span>
              ) : null}
            </div>
          </div>
        </td>
        <td style={tdStyle}>
          <span style={{ color: row.oldStartYmd && row.oldEndYmd ? 'var(--text-slate-900)' : 'var(--text-faint)' }}>
            {describeOldDates(row)}
          </span>
        </td>
        <td style={tdStyle}>
          <span style={{ color: 'var(--text-slate-900)' }}>{describeNewDates(row)}</span>
        </td>
        <td style={tdStyleCenter}>
          <span
            title={CHANGE_PILL_TITLES[row.change]}
            style={{
              display: 'inline-block',
              padding: '0.05rem 0.45rem',
              borderRadius: 999,
              fontSize: '0.6875rem',
              fontWeight: 600,
              ...CHANGE_PILL_STYLES[row.change],
            }}
          >
            {CHANGE_PILL_LABELS[row.change]}
          </span>
        </td>
      </tr>
      {error ? (
        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td />
          <td colSpan={4} style={{ padding: '0 0.5rem 0.5rem' }}>
            <div
              role="alert"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-red-800)',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 4,
                padding: '0.35rem 0.5rem',
              }}
            >
              {error}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.45rem 0.5rem',
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
  borderBottom: '1px solid var(--border)',
}
const thStyleNum: CSSProperties = { ...thStyle, width: 38 }
const thStyleCenter: CSSProperties = { ...thStyle, textAlign: 'center', width: 88 }

const tdStyle: CSSProperties = {
  padding: '0.5rem',
  verticalAlign: 'top',
}
const tdStyleNum: CSSProperties = { ...tdStyle, width: 38 }
const tdStyleCenter: CSSProperties = { ...tdStyle, textAlign: 'center', width: 88 }

const footerSecondaryStyle: CSSProperties = {
  padding: '0.5rem 0.85rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-gray-800)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const footerPrimaryStyle: CSSProperties = {
  padding: '0.5rem 0.95rem',
  borderRadius: 6,
  border: '1px solid #1d4ed8',
  background: '#2563eb',
  color: '#ffffff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}
