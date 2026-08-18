import { formatLostBidNudgeValue, type LostBidNudge } from '../lib/dashboardLostBidNudge'

/**
 * Dashboard nudge into the Why we lost lens — why-we-lost train PR 4 (v2.1800).
 *
 * Threshold-gated upstream (buildLostBidNudge returns null below
 * LOST_BID_NUDGE_MIN_COUNT), personal (bids where the viewer is estimator or
 * account man), and it counts by `loss_category` like the lens queue does.
 * Renders nothing while loading or when the nudge is null.
 */

type Props = {
  nudge: LostBidNudge | null
  loading: boolean
  onStartCallMode?: () => void
}

export default function DashboardLostBidsMissingReasonBanner({ nudge, loading, onStartCallMode }: Props) {
  if (loading || nudge == null) {
    return null
  }
  const { count, value } = nudge
  const ariaLabel = `Start call mode for ${count} lost bid${count === 1 ? '' : 's'} with no reason recorded`
  return (
    <button
      type="button"
      onClick={() => onStartCallMode?.()}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-orange)',
        borderRadius: 8,
        background: 'var(--bg-orange-tint)',
        marginBottom: '1rem',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          minWidth: '2.25rem',
          height: '2.25rem',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#ea580c',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {count > 99 ? '99+' : count}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-orange-700)' }}>
          {count === 1 ? 'One lost bid has no reason recorded' : `${count} lost bids have no reason recorded`}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {value > 0 ? `${formatLostBidNudgeValue(value)} unexplained — ` : ''}work them one GC call at a time on the Why we lost lens.
        </div>
      </div>
      <span
        style={{
          background: '#2563eb',
          color: '#fff',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: '0.8rem',
          padding: '0.45rem 0.9rem',
          whiteSpace: 'nowrap',
        }}
        aria-hidden
      >
        Start call mode →
      </span>
    </button>
  )
}
