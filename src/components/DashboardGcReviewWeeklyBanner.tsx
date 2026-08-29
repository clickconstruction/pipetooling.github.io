import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gcReviewNudgeState, gcReviewWeekdayIndex } from '../lib/jobs/gcReviewCertification'
import type { GcReviewWeekStatus } from '../lib/gcReviewCertifications'
import { useGcReviewWeekNudge } from '../hooks/useGcReviewWeekNudge'

/**
 * Attention card for the Wednesday GC certification ritual (v2.1984): amber
 * from Wednesday until every GC with outstanding billed money is certified
 * AND sent this week, green for the rest of Wednesday once done, hidden
 * otherwise (the kernel owns that state machine). Self-gating — renders
 * nothing while loading, on error, or off-days. Office-role gating happens at
 * the mount site. Since v2.2490 the Dashboard shows the due state as a Needs
 * You item (plus GcReviewWeekDoneNotice when done); Quickfill's GC weekly
 * station still renders this banner.
 */

/** The green "done for the week" confirmation — also rendered by the Dashboard quick row (v2.2490). */
export function GcReviewWeekDoneNotice({ status }: { status: GcReviewWeekStatus }) {
  return (
    <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          width: '100%',
          padding: '1rem 1.25rem',
          border: '1px solid var(--border-green)',
          borderRadius: 8,
          background: 'var(--bg-green-tint)',
          marginBottom: '1rem',
          boxSizing: 'border-box',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            minWidth: '2.25rem',
            height: '2.25rem',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            background: '#16a34a',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
          }}
        >
          ✓
        </span>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-green-800)' }}>GC review is done for the week</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            All {status.gcs_outstanding} GCs certified and sent. Next review due Wednesday.
          </div>
        </div>
      </div>
  )
}

export default function DashboardGcReviewWeeklyBanner({
  onCount,
}: {
  /** Quickfill metric seam (v2.2347): GCs still to certify this week (0 when done or off-window). */
  onCount?: (n: number | null) => void
} = {}) {
  const navigate = useNavigate()
  const { status, loaded } = useGcReviewWeekNudge(true)

  useEffect(() => {
    if (!loaded) return
    onCount?.(
      status != null && gcReviewNudgeState(status) === 'due'
        ? Math.max(0, status.gcs_outstanding - status.gcs_certified)
        : 0,
    )
  }, [status, loaded, onCount])

  if (!status) return null
  const nudge = gcReviewNudgeState(status)
  if (nudge === 'hidden') return null

  if (nudge === 'done') return <GcReviewWeekDoneNotice status={status} />

  const remaining = Math.max(0, status.gcs_outstanding - status.gcs_certified)
  const isWednesday = gcReviewWeekdayIndex() === 3
  return (
    <button
      type="button"
      onClick={() => navigate('/jobs?tab=stages&gcReview=1')}
      aria-label={`Open GC Review — ${remaining} GCs left to certify this week`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        background: 'var(--bg-amber-tint)',
        marginBottom: '1rem',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          minWidth: '2.25rem',
          height: '2.25rem',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#f59e0b',
          color: 'var(--text-on-amber-solid)',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
      >
        {remaining > 99 ? '99+' : remaining}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-amber-800)' }}>
          {isWednesday ? 'GC review is due today' : 'GC review is still due this week'}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {status.gcs_certified} of {status.gcs_outstanding} GCs certified · {status.gcs_sent} statement
          {status.gcs_sent === 1 ? '' : 's'} sent — certify each group and send it off so every GC knows what they owe.
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          padding: '0.35rem 0.85rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 9999,
          background: 'var(--surface)',
          color: 'var(--text-link)',
          fontSize: '0.75rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        Open GC Review
      </span>
    </button>
  )
}
