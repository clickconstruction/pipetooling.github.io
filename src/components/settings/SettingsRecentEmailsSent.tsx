import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  emailLogStatusChip,
  formatEmailLogRecipients,
  mapEmailSendLogRows,
  type EmailSendLogDisplayRow,
} from '../../lib/emailSendLog'
import { emailLogStreamForSubject, type EmailStreamKey } from '../../lib/emailLogStreamLink'

const PAGE_SIZE = 25

type Props = {
  /** Render nothing unless the viewer is a dev — the log is org-wide. */
  isDev: boolean
  /**
   * Opens the email's stream card on Email & notifications (v2.1754). Rows
   * whose subject maps to a stream become clickable; one-off transactional
   * sends (estimates, quotes, invoices) have no stream and stay plain.
   */
  onOpenStream?: (key: EmailStreamKey) => void
}

function chipStyle(tone: 'good' | 'bad' | 'neutral'): React.CSSProperties {
  const color =
    tone === 'good' ? 'var(--text-green-600)' : tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)'
  return {
    color,
    border: `1px solid ${color}`,
    borderRadius: 999,
    padding: '0 0.5rem',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  }
}

export default function SettingsRecentEmailsSent({ isDev, onOpenStream }: Props) {
  const [rows, setRows] = useState<EmailSendLogDisplayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(
    async (nextLimit: number) => {
      setLoading(true)
      setError(null)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('email_send_log')
              .select('id, sent_at, from_email, to_emails, subject, last_event')
              .order('sent_at', { ascending: false, nullsFirst: false })
              .limit(nextLimit + 1),
          'settings recent emails sent',
        )
        const raw = data ?? []
        setHasMore(raw.length > nextLimit)
        setRows(mapEmailSendLogRows(raw.slice(0, nextLimit)))
      } catch (e) {
        setError(formatErrorMessage(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isDev) return
    void load(limit)
  }, [isDev, limit, load])

  const refreshFromResend = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const { error: fnError } = await supabase.functions.invoke('sync-resend-emails', { body: {} })
      if (fnError) throw fnError
      await load(limit)
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setSyncing(false)
    }
  }, [limit, load])

  if (!isDev) return null

  return (
    <div
      id="settings-recent-emails"
      style={{
        marginBottom: '2rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
        background: 'var(--bg-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Most recent emails sent</h2>
        <button type="button" onClick={() => void refreshFromResend()} disabled={syncing} style={{ padding: '0.25rem 0.75rem' }}>
          {syncing ? 'Refreshing…' : 'Refresh from Resend'}
        </button>
      </div>
      {loading && rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          No emails logged yet — new sends appear here automatically; Refresh from Resend backfills older history.
        </p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>When</th>
                  <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>To</th>
                  <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>Subject</th>
                  <th style={{ padding: '0.25rem 0.5rem', fontWeight: 600 }}>Status</th>
                  <th aria-hidden="true" style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const chip = emailLogStatusChip(row.lastEvent)
                  const stream = onOpenStream ? emailLogStreamForSubject(row.subject) : null
                  const open = stream && onOpenStream ? () => onOpenStream(stream) : null
                  return (
                    <tr
                      key={row.id}
                      onClick={open ?? undefined}
                      style={{ borderTop: '1px solid var(--border)', cursor: open ? 'pointer' : undefined }}
                      title={open ? 'Open this stream in Email & notifications' : undefined}
                    >
                      <td style={{ padding: '0.375rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formatNotificationDatetime(row.sentAt)}
                      </td>
                      <td style={{ padding: '0.375rem 0.5rem', whiteSpace: 'nowrap' }} title={row.toEmails.join(', ')}>
                        {formatEmailLogRecipients(row.toEmails)}
                      </td>
                      <td
                        style={{
                          padding: '0.375rem 0.5rem',
                          maxWidth: 320,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={row.subject ?? undefined}
                      >
                        {row.subject ?? '—'}
                      </td>
                      <td style={{ padding: '0.375rem 0.5rem' }}>
                        <span style={chipStyle(chip.tone)}>{chip.label}</span>
                      </td>
                      <td style={{ padding: '0.375rem 0.25rem', width: 28 }}>
                        {open ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              open()
                            }}
                            aria-label={`Open the stream for "${row.subject ?? 'this email'}" in Email & notifications`}
                            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.25rem', fontSize: '0.9rem', lineHeight: 1 }}
                          >
                            ›
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              disabled={loading}
              style={{ marginTop: '0.75rem', padding: '0.25rem 0.75rem' }}
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
