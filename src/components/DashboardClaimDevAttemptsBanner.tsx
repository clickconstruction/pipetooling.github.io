import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  loadClaimDevAlertDismissState,
  saveClaimDevAlertDismissState,
  shouldShowClaimDevAlert,
  type ClaimDevAlertDismissState,
} from '../lib/claimDevAlertDismiss'
import { useAuth } from '../hooks/useAuth'

const SNOOZE_MS = 24 * 60 * 60 * 1000
const LOOKBACK_DAYS = 7

/**
 * Dev-only: someone tried to use the break-glass dev code while a dev was available.
 *
 * We alert on REFUSED attempts, not granted ones, and that is the whole point: a *granted* break-glass
 * means no usable dev existed, so there is nobody left to alert. The signal worth having is the inverse —
 * someone is trying to become a dev while you are here, which is an attack indicator.
 *
 * Reads claim_dev_attempts directly; dev-only RLS on the table means non-devs get zero rows, so this
 * needs no role logic and renders nothing for them. Mounting is a one-liner.
 */
export default function DashboardClaimDevAttemptsBanner() {
  const { user } = useAuth()
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissState, setDismissState] = useState<ClaimDevAlertDismissState>({})

  const load = useCallback(async () => {
    if (!user?.id) {
      setCount(null)
      return
    }
    setLoading(true)
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { count: n, error } = await supabase
        .from('claim_dev_attempts')
        .select('id', { count: 'exact', head: true })
        .like('outcome', 'refused%')
        .gte('attempted_at', since)
      // Never break the dashboard over an alarm; a failed poll (or a not-yet-pushed migration) shows nothing.
      setCount(error ? null : (n ?? 0))
    } catch {
      setCount(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user?.id) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user?.id, load])

  useEffect(() => {
    if (!user?.id) {
      setDismissState({})
      return
    }
    setDismissState(loadClaimDevAlertDismissState(user.id))
  }, [user?.id])

  const persist = (next: ClaimDevAlertDismissState) => {
    if (!user?.id) return
    saveClaimDevAlertDismissState(user.id, next)
    setDismissState(next)
  }

  if (!user?.id || loading) return null
  if (!shouldShowClaimDevAlert(count, dismissState)) return null

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
          {(count ?? 0) > 99 ? '99+' : count}
        </span>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-orange-800)' }}>
            Someone tried to become a dev
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {count} refused attempt{count === 1 ? '' : 's'} to use the admin code in the last {LOOKBACK_DAYS} days.
            They were blocked — the code only works when no dev is available. If this wasn&apos;t someone you
            asked to do it, rotate the code.
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
              onClick={() => persist({ ...dismissState, dismissedCount: count ?? 0 })}
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
              Dismiss until it happens again
            </button>
          </div>
        </div>
        <Link
          to="/settings?tab=settings-people"
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
          Review accounts
        </Link>
      </div>
    </section>
  )
}
