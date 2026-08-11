import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadBulkDeleteAlertDismissState,
  saveBulkDeleteAlertDismissState,
  shouldShowBulkDeleteAlert,
  type BulkDeleteAlertDismissState,
} from '../lib/bulkDeleteAlertDismiss'
import { useAuth } from '../hooks/useAuth'
import { useBulkDeleteAlerts } from '../hooks/useBulkDeleteAlerts'
import {
  formatDispatchNoteDaysAgoShortPhrase,
  formatDispatchNoteWeekdayShortDateTimeChicago,
} from '../utils/dispatchNoteDisplay'

const SNOOZE_MS = 24 * 60 * 60 * 1000

/** Bursts listed individually before collapsing to "+N more bursts". */
const MAX_BURST_LINES = 3

/**
 * Dev-only: someone deleted a lot at once. Everything else we built (archive, restore, read-only)
 * assumes somebody notices — this is the thing that notices.
 *
 * Red rather than the blue/amber of the neighbouring notices: those two track WHO ACTS (amber = your
 * queue, blue = reconcile work), and this is neither — it is a destructive event. Dismissible because,
 * unlike the work-queue notices, a deletion never drains to zero on its own.
 *
 * Renders nothing for non-devs (the RPC returns no rows for them anyway), when disabled, or when there
 * is nothing to report — so mounting it is a one-liner.
 */
export default function DashboardBulkDeleteAlertBanner() {
  const { user } = useAuth()
  const { alerts, loading } = useBulkDeleteAlerts(!!user?.id)
  const [dismissState, setDismissState] = useState<BulkDeleteAlertDismissState>({})

  useEffect(() => {
    if (!user?.id) {
      setDismissState({})
      return
    }
    setDismissState(loadBulkDeleteAlertDismissState(user.id))
  }, [user?.id])

  const persist = (next: BulkDeleteAlertDismissState) => {
    if (!user?.id) return
    saveBulkDeleteAlertDismissState(user.id, next)
    setDismissState(next)
  }

  const count = alerts.length
  if (!user?.id || loading) return null
  if (!shouldShowBulkDeleteAlert(count, dismissState)) return null

  // Newest first from the RPC — listed one line per burst (capped) so the
  // badge, the lines, and the title-row aggregate all describe the same thing.
  const totalBundles = alerts.reduce((sum, a) => sum + Number(a.bundles ?? 0), 0)
  const actors = new Set(alerts.map((a) => a.actor_name)).size
  const shownBursts = alerts.slice(0, MAX_BURST_LINES)
  const moreBursts = alerts.length - shownBursts.length

  return (
    <section style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.25rem',
          border: '1px solid #fecaca',
          borderRadius: 8,
          background: 'var(--bg-orange-tint)',
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
            background: '#dc2626',
            color: '#fff',
            fontSize: '0.9375rem',
            fontWeight: 700,
          }}
          aria-hidden
        >
          {count > 99 ? '99+' : count}
        </span>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-orange-800)' }}>
            {count === 1 ? 'Bulk deletion detected' : 'Bulk deletions detected'}
            {count > 1 ? (
              <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {' '}· {count} bursts · {totalBundles} record{totalBundles === 1 ? '' : 's'} · {actors}{' '}
                {actors === 1 ? 'person' : 'people'}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: '0.875rem', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shownBursts.map((a) => (
              <span key={`${a.actor_name}:${a.window_start}`}>
                <strong>{a.actor_name}</strong> —{' '}
                <span title={`${a.row_count} database rows including attached items`}>
                  {a.bundles} record{Number(a.bundles) === 1 ? '' : 's'}
                </span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>
                  · {formatDispatchNoteWeekdayShortDateTimeChicago(a.window_start)} (
                  {formatDispatchNoteDaysAgoShortPhrase(a.window_start)})
                </span>
              </span>
            ))}
            {moreBursts > 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                +{moreBursts} more burst{moreBursts === 1 ? '' : 's'} — see Recently deleted
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => persist({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS })}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Snooze 24h
            </button>
            <button
              type="button"
              onClick={() => persist({ ...dismissState, dismissedCount: count })}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Dismiss until count increases
            </button>
          </div>
        </div>
        <Link
          to="/settings?tab=settings-data#settings-recently-deleted"
          style={{
            padding: '0.5rem 0.9rem',
            borderRadius: 6,
            background: '#dc2626',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Review deletions
        </Link>
      </div>
    </section>
  )
}
