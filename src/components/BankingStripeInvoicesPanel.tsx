import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { formatCompactNoteDateTime } from '../utils/dateUtils'

const INVOICES_PAGE_SIZE = 500

type JobsLedgerMini = Pick<Database['public']['Tables']['jobs_ledger']['Row'], 'hcp_number' | 'job_name'>

type InvoiceWithJobRow = Database['public']['Tables']['jobs_ledger_invoices']['Row'] & {
  jobs_ledger: JobsLedgerMini | null
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function BankingStripeInvoicesPanel() {
  const [rows, setRows] = useState<InvoiceWithJobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('jobs_ledger_invoices')
          .select(
            `
            id,
            job_id,
            amount,
            status,
            stripe_invoice_id,
            stripe_invoice_status,
            billed_at,
            created_at,
            hosted_invoice_url,
            sent_to_customer_at,
            external_send_channel,
            sequence_order,
            jobs_ledger ( hcp_number, job_name )
          `,
          )
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(INVOICES_PAGE_SIZE)
      }, 'load jobs_ledger_invoices for banking')
      setRows((data ?? []) as InvoiceWithJobRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invoices')
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
        Ledger invoice rows from <code>jobs_ledger_invoices</code>. <strong>App status</strong> is the PipeTooling column;{' '}
        <strong>Stripe status</strong> is synced from Stripe (webhook) when present. Rows with no <strong>Stripe invoice</strong> id are
        highlighted. Showing up to {INVOICES_PAGE_SIZE} rows, newest first.
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
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No invoice rows yet.</p>
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
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Job</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Seq</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>App status</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Stripe status</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Stripe invoice</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Created</th>
                <th style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const jl = r.jobs_ledger
                const jobLabel = jl ? `${jl.hcp_number} · ${jl.job_name}` : r.job_id.slice(0, 8) + '…'
                const hasStripeInvoiceId = Boolean(r.stripe_invoice_id?.trim())
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      verticalAlign: 'top',
                      backgroundColor: hasStripeInvoiceId ? undefined : '#fef2f2',
                    }}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', maxWidth: 220 }}>
                      <Link
                        to={`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(r.id)}`}
                        style={{ color: 'var(--text-link)', fontWeight: 600, wordBreak: 'break-word' }}
                      >
                        {jobLabel}
                      </Link>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{r.sequence_order}</td>
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{formatUsd(Number(r.amount))}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'ui-monospace, monospace' }}>{r.status}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'ui-monospace, monospace' }}>
                      {r.stripe_invoice_status ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                        color: 'var(--text-600)',
                      }}
                    >
                      {r.stripe_invoice_id ?? '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-700)' }}>
                      {r.created_at ? formatCompactNoteDateTime(r.created_at) : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {r.hosted_invoice_url ? (
                        <a
                          href={r.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--text-link)', whiteSpace: 'nowrap' }}
                        >
                          Hosted link
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
