import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatActiveSeconds } from '../../utils/formatActiveSeconds'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'
import { useToastContext } from '../../contexts/ToastContext'
import { PersonActivityDetailModal } from './PersonActivityDetailModal'

type ActivityGrantUserRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
}

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

type PeopleAppActivityPanelProps = {
  enabled: boolean
  isDev: boolean
  users: ActivityGrantUserRow[]
  authUserId: string | null
}

export default function PeopleAppActivityPanel({ enabled, isDev, users, authUserId }: PeopleAppActivityPanelProps) {
  const { showToast } = useToastContext()
  const { rows, loading, error } = usePeopleAppActivityRows(enabled)

  const [activityViewerGrantSet, setActivityViewerGrantSet] = useState<Set<string>>(() => new Set())
  const [activityGrantListLoading, setActivityGrantListLoading] = useState(false)
  const [activityGrantBusyId, setActivityGrantBusyId] = useState<string | null>(null)
  const [activityGrantsSectionOpen, setActivityGrantsSectionOpen] = useState(true)
  /** Person whose 90-day day-by-day / per-page drilldown modal is open. */
  const [activityDetailPerson, setActivityDetailPerson] = useState<{ userId: string; name: string } | null>(null)

  useEffect(() => {
    if (!isDev) return
    let cancelled = false
    setActivityGrantListLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.from('user_app_activity_viewers').select('viewer_user_id'),
          'list activity viewers'
        )
        if (cancelled) return
        setActivityViewerGrantSet(new Set((data ?? []).map((r: { viewer_user_id: string }) => r.viewer_user_id)))
      } finally {
        if (!cancelled) setActivityGrantListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev])

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>App activity</h2>
        {isDev && (
          <button
            type="button"
            aria-expanded={activityGrantsSectionOpen}
            aria-controls="people-activity-grants-panel"
            onClick={() => setActivityGrantsSectionOpen((o) => !o)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span aria-hidden>{activityGrantsSectionOpen ? '\u25BC' : '\u25B6'}</span>
            {activityGrantsSectionOpen ? 'Hide access' : 'Manage access'}
          </button>
        )}
      </div>
      {isDev && activityGrantsSectionOpen && (
        <div
          id="people-activity-grants-panel"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Who can see this tab</h3>
          <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Grant Assistants, Master Technicians, or Primaries org-wide activity (same table as below). Others keep only their own usage.
          </p>
          {activityGrantListLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading grants…</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                    <th style={{ padding: '0.5rem 0.75rem' }} />
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => ['assistant', 'master_technician', 'primary', 'controller'].includes(u.role))
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                    .map((u) => {
                      const granted = activityViewerGrantSet.has(u.id)
                      const busy = activityGrantBusyId === u.id
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{u.name || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{u.email || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {u.phone ? (
                              <a href={`tel:${u.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                {u.phone}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{u.role.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {granted ? (
                              <button
                                type="button"
                                disabled={busy || !authUserId}
                                onClick={async () => {
                                  setActivityGrantBusyId(u.id)
                                  try {
                                    await withSupabaseRetry(
                                      async () =>
                                        await supabase.from('user_app_activity_viewers').delete().eq('viewer_user_id', u.id),
                                      'revoke activity viewer'
                                    )
                                    setActivityViewerGrantSet((prev) => {
                                      const next = new Set(prev)
                                      next.delete(u.id)
                                      return next
                                    })
                                  } catch (e) {
                                    showToast(String(e instanceof Error ? e.message : e), 'error')
                                  } finally {
                                    setActivityGrantBusyId(null)
                                  }
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.8125rem',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  background: 'var(--surface)',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '…' : 'Revoke'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy || !authUserId}
                                onClick={async () => {
                                  if (!authUserId) return
                                  setActivityGrantBusyId(u.id)
                                  try {
                                    await withSupabaseRetry(
                                      async () =>
                                        await supabase.from('user_app_activity_viewers').insert({
                                          viewer_user_id: u.id,
                                          granted_by: authUserId,
                                        }),
                                      'grant activity viewer'
                                    )
                                    setActivityViewerGrantSet((prev) => new Set(prev).add(u.id))
                                  } catch (e) {
                                    showToast(String(e instanceof Error ? e.message : e), 'error')
                                  } finally {
                                    setActivityGrantBusyId(null)
                                  }
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.8125rem',
                                  border: '1px solid #3b82f6',
                                  borderRadius: 6,
                                  background: '#3b82f6',
                                  color: '#fff',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '…' : 'Grant'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
              {users.filter((u) => ['assistant', 'master_technician', 'primary', 'controller'].includes(u.role)).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No eligible users loaded.</p>
              )}
            </div>
          )}
        </div>
      )}
      <div>
      <p style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Approximate active time while the app tab is visible (UTC calendar days). One heartbeat per minute per user.
      </p>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 960 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Last seen</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Active (7d)</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Active (30d)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setActivityDetailPerson({ userId: r.userId, name: r.name || r.email || '—' })}
                      title="Day-by-day activity for this person"
                      aria-label={`Day-by-day activity for ${r.name || r.email || 'user'}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        font: 'inherit',
                        color: 'var(--text-link)',
                        textDecoration: 'underline dotted',
                        textUnderlineOffset: '2px',
                        cursor: 'pointer',
                      }}
                    >
                      {r.name || '—'}
                    </button>
                  </td>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.75rem' }}>No activity data in the last 30 days.</p>
          )}
        </div>
      )}
      </div>
      {activityDetailPerson ? (
        <PersonActivityDetailModal
          userId={activityDetailPerson.userId}
          personName={activityDetailPerson.name}
          zIndex={1100}
          onClose={() => setActivityDetailPerson(null)}
        />
      ) : null}
    </>
  )
}
