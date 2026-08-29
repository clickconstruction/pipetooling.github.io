import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobFollowupNudge } from '../hooks/useJobFollowupNudge'
import { jobFollowupBreakdownPhrase } from '../lib/jobs/jobFollowupQueue'

/**
 * Attention card for Job Follow-Up Mode (v2.1720): counts the jobs quiet too
 * long for their stage (same kernel as the deck) and starts the review.
 * Self-gating — renders nothing while loading, on error, or when the queue is
 * empty. Since v2.2487 the Dashboard shows this as a Needs You item instead;
 * Quickfill's Job follow-ups station still renders the banner.
 */
export default function DashboardJobFollowupsBanner({
  onCount,
}: {
  /** Quickfill metric seam (v2.2347): reports the queue size, 0 on error. */
  onCount?: (n: number | null) => void
} = {}) {
  const navigate = useNavigate()
  const { count, stageCounts } = useJobFollowupNudge(true)

  useEffect(() => {
    if (count != null) onCount?.(count)
  }, [count, onCount])

  if (count == null || count === 0) return null

  const breakdown = jobFollowupBreakdownPhrase(stageCounts)

  return (
    <button
      type="button"
      onClick={() => navigate('/jobs?tab=stages&followups=1')}
      aria-label={`Start job follow-up review, ${count} job${count === 1 ? '' : 's'} waiting`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-amber-soft)',
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
        style={{
          display: 'inline-flex',
          minWidth: '2.25rem',
          height: '2.25rem',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#f59e0b',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {count > 99 ? '99+' : count}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-amber-800)' }}>
          {count === 1 ? 'One job is waiting on a follow-up' : `${count} jobs are waiting on a follow-up`}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {breakdown ? `${breakdown} — ` : ''}tap to review them one card at a time.
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
        Start review →
      </span>
    </button>
  )
}
