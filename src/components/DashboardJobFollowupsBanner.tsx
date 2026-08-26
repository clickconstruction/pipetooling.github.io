import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import {
  computeJobFollowupQueue,
  jobFollowupStageCounts,
  type JobFollowupStage,
} from '../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
} from '../lib/jobs/jobFollowupStore'

/**
 * Dashboard attention card for Job Follow-Up Mode (v2.1720): counts the jobs
 * quiet too long for their stage (same kernel as the deck) and starts the
 * review. Self-gating — renders nothing while loading, on error, or when the
 * queue is empty. Office-role gating happens at the mount site.
 */

const STAGE_PHRASES: Record<JobFollowupStage, (n: number) => string> = {
  billed: (n) => `${n} billed with no nudge`,
  working: (n) => `${n} working with no recent notes`,
  waiting: (n) => `${n} waiting with nothing scheduled`,
  ready_to_bill: (n) => `${n} ready to bill`,
  collections: (n) => `${n} in collections`,
}
/** Breakdown order: money first. */
const PHRASE_ORDER: JobFollowupStage[] = ['billed', 'working', 'waiting', 'ready_to_bill', 'collections']

export default function DashboardJobFollowupsBanner({
  onCount,
}: {
  /** Quickfill metric seam (v2.2347): reports the queue size, 0 on error. */
  onCount?: (n: number | null) => void
} = {}) {
  const navigate = useNavigate()
  const [count, setCount] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<JobFollowupStage, number> | null>(null)
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [cands, revs, sets] = await Promise.all([
          fetchJobFollowupCandidates(todayYmd),
          fetchJobFollowupReviews(),
          fetchJobFollowupSettings(),
        ])
        if (cancelled) return
        const queue = computeJobFollowupQueue(cands, revs, sets, todayYmd)
        setCount(queue.length)
        setCounts(jobFollowupStageCounts(queue))
        onCount?.(queue.length)
      } catch {
        if (!cancelled) {
          setCount(0)
          onCount?.(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [todayYmd])

  if (count == null || count === 0) return null

  const breakdown = counts
    ? PHRASE_ORDER.filter((s) => counts[s] > 0)
        .slice(0, 3)
        .map((s) => STAGE_PHRASES[s](counts[s]))
        .join(' · ')
    : ''

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
