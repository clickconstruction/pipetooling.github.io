import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatActiveSeconds } from '../../utils/formatActiveSeconds'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'

export type ActivityAggregatedRow = {
  userId: string
  name: string
  email: string
  lastSeen: string | null
  active7: number
  active30: number
}

export function usePeopleAppActivityRows(enabled: boolean) {
  const [rows, setRows] = useState<ActivityAggregatedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const n = new Date()
        const start30 = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - 29)).toISOString().slice(0, 10)
        const start7 = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - 6)).toISOString().slice(0, 10)
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('user_app_activity_daily')
              .select('user_id, activity_date, last_seen_at, active_seconds, users(name, email)')
              .gte('activity_date', start30)
              .order('activity_date', { ascending: false }),
          'people app activity'
        )
        if (cancelled) return
        const agg = new Map<string, { name: string; email: string; lastSeen: string | null; sec7: number; sec30: number }>()
        for (const r of data ?? []) {
          const row = r as {
            user_id: string
            activity_date: string
            last_seen_at: string | null
            active_seconds: number
            users: { name: string | null; email: string | null } | null
          }
          const uid = row.user_id
          let e = agg.get(uid)
          if (!e) {
            e = {
              name: row.users?.name ?? '',
              email: row.users?.email ?? '',
              lastSeen: null,
              sec7: 0,
              sec30: 0,
            }
            agg.set(uid, e)
          }
          if (row.last_seen_at && (!e.lastSeen || row.last_seen_at > e.lastSeen)) {
            e.lastSeen = row.last_seen_at
          }
          e.sec30 += row.active_seconds
          if (row.activity_date >= start7) e.sec7 += row.active_seconds
        }
        setRows(
          [...agg.entries()]
            .map(([userId, v]) => ({
              userId,
              name: v.name,
              email: v.email,
              lastSeen: v.lastSeen,
              active7: v.sec7,
              active30: v.sec30,
            }))
            .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
        )
      } catch (err) {
        if (!cancelled) setError(formatErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { rows, loading, error }
}

export default function PeopleAppActivityPanel({ enabled }: { enabled: boolean }) {
  const { rows, loading, error } = usePeopleAppActivityRows(enabled)

  return (
    <div>
      <p style={{ marginTop: 0, marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Approximate active time while the app tab is visible (UTC calendar days). One heartbeat per minute per user.
      </p>
      {error && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 960 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Last seen</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Active (7d)</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Active (30d)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{r.name || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{r.email || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {r.lastSeen ? formatNotificationDatetime(r.lastSeen) : '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{formatActiveSeconds(r.active7)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{formatActiveSeconds(r.active30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.75rem' }}>No activity data in the last 30 days.</p>
          )}
        </div>
      )}
    </div>
  )
}
