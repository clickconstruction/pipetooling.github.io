import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadDevRejectedDismissState,
  saveDevRejectedDismissState,
  shouldShowDevRejectedBanner,
  type DevRejectedDismissState,
} from '../lib/devRejectedNotificationDismiss'
import { useAuth } from '../hooks/useAuth'
import { useDevRejectedSessionsCount } from '../hooks/useDevRejectedSessionsCount'

const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * Dev-only: compact notice for org-wide rejected sessions this week; full list lives on People → Hours.
 */
export default function DashboardDevRejectedNotification() {
  const { user } = useAuth()
  const { count, loading } = useDevRejectedSessionsCount(!!user?.id)
  const [dismissState, setDismissState] = useState<DevRejectedDismissState>({})

  useEffect(() => {
    if (!user?.id) {
      setDismissState({})
      return
    }
    setDismissState(loadDevRejectedDismissState(user.id))
  }, [user?.id])

  const persist = (next: DevRejectedDismissState) => {
    if (!user?.id) return
    saveDevRejectedDismissState(user.id, next)
    setDismissState(next)
  }

  if (!user?.id || loading) return null
  if (count === null || count <= 0) return null
  if (!shouldShowDevRejectedBanner(count, dismissState)) return null

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
          background: '#fff7ed',
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
          {count}
        </span>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#9a3412' }}>Rejected clock sessions</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Org-wide for the current week. Return to pending, edit, or delete on People → Hours.
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
          to="/people?tab=hours&section=rejected"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem 1rem',
            borderRadius: 6,
            background: '#ea580c',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Open People → Hours
        </Link>
      </div>
    </section>
  )
}
