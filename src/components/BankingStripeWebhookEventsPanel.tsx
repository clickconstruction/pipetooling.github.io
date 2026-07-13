import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { formatCompactNoteDateTime } from '../utils/dateUtils'

const WEBHOOK_EVENTS_PAGE_SIZE = 500

type StripeWebhookEventRow = Database['public']['Tables']['stripe_webhook_events']['Row']

export function BankingStripeWebhookEventsPanel() {
  const [rows, setRows] = useState<StripeWebhookEventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('stripe_webhook_events')
          .select('stripe_event_id, event_type, received_at')
          .order('received_at', { ascending: false })
          .limit(WEBHOOK_EVENTS_PAGE_SIZE)
      }, 'load stripe_webhook_events')
      setRows((data ?? []) as StripeWebhookEventRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load webhook events')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-600)', maxWidth: 720, fontSize: '0.9375rem', lineHeight: 1.55 }}>
        Events recorded when the <code>stripe-webhook</code> Edge Function accepts a delivery (dedupe by Stripe event id). Dev-only read;
        see <strong>docs/EDGE_FUNCTIONS.md</strong>.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Reload'}
        </button>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Showing up to {WEBHOOK_EVENTS_PAGE_SIZE} rows, newest first
        </span>
      </div>
      {error ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-red-tint)',
            border: '1px solid #fecaca',
            borderRadius: 4,
            color: 'var(--text-red-800)',
          }}
        >
          {error}
        </div>
      ) : null}
      {loading && rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No webhook events yet (or none in range).</p>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Received</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Event type</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Stripe event id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stripe_event_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-700)' }}>
                    {formatCompactNoteDateTime(r.received_at)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
                    {r.event_type}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', color: 'var(--text-600)' }}>
                    {r.stripe_event_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
