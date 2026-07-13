import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

type NotificationHistoryRow = Database['public']['Tables']['notification_history']['Row']

type Props = {
  userId: string | undefined
}

export default function SettingsRecentPushNotifications({ userId }: Props) {
  const [rows, setRows] = useState<NotificationHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('notification_history')
              .select('id, sent_at, title, body_preview, template_type, channel, project_id, step_id, checklist_instance_id')
              .eq('recipient_user_id', userId)
              .in('channel', ['push', 'both'])
              .order('sent_at', { ascending: false })
              .limit(5),
          'settings recent push notifications',
        )
        if (!cancelled) setRows((data ?? []) as NotificationHistoryRow[])
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!userId) return null

  return (
    <div
      id="settings-recent-push"
      style={{
        marginBottom: '2rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
        background: 'var(--bg-subtle)',
      }}
    >
      <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', fontWeight: 600 }}>Most recent push notifications</h2>
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          No push notifications have been logged for your account yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((row) => {
            const channelBadge = row.channel === 'both' ? 'Push + email' : 'Push'
            const link =
              row.project_id && row.step_id
                ? `/workflows/${row.project_id}#step-${row.step_id}`
                : row.checklist_instance_id
                  ? '/checklist'
                  : null
            return (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginBottom: '0.5rem',
                  background: 'var(--surface)',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 140, flexShrink: 0 }}>
                  {formatNotificationDatetime(row.sent_at)}
                </span>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{row.title}</div>
                  {(row.body_preview?.trim() || row.template_type) && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.35 }}>
                      {row.template_type ? <span style={{ marginRight: '0.5rem' }}>{row.template_type}</span> : null}
                      {row.body_preview?.trim() ?? ''}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--bg-muted)',
                    color: 'var(--text-700)',
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  {channelBadge}
                </span>
                {link && (
                  <Link to={link} style={{ fontSize: '0.875rem', color: 'var(--text-link)', flexShrink: 0, alignSelf: 'flex-start' }}>
                    View →
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
