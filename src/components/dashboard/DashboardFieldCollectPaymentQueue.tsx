import { useCallback, useEffect, useState } from 'react'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { formatWaitingLabelFromCertifiedAt } from '../../lib/formatElapsedCountUp'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { Database } from '../../types/database'

type FlowRow = Database['public']['Tables']['job_collect_payment_flows']['Row'] & {
  jobs_ledger: Pick<
    Database['public']['Tables']['jobs_ledger']['Row'],
    'hcp_number' | 'job_name' | 'job_address'
  > | null
}

type BilledInvRow = Pick<
  Database['public']['Tables']['jobs_ledger_invoices']['Row'],
  'id' | 'job_id' | 'amount' | 'stripe_invoice_id' | 'status'
>

export default function DashboardFieldCollectPaymentQueue() {
  const { showToast } = useToastContext()
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<FlowRow[]>([])
  const [invoicesByJob, setInvoicesByJob] = useState<Record<string, BilledInvRow[]>>({})
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Record<string, string>>({})
  const dispatchQueueNowMs = useIntervalNowMs(1000)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('job_collect_payment_flows')
            .select(
              `*, jobs_ledger ( hcp_number, job_name, job_address )`,
            )
            .eq('status', 'pending_dispatch')
            .order('certified_at', { ascending: false }),
        'job_collect_payment_flows queue',
      )
      const list = (data ?? []) as unknown as FlowRow[]
      setRows(list)
      const jobIds = [...new Set(list.map((r) => r.job_id))]
      if (jobIds.length === 0) {
        setInvoicesByJob({})
        return
      }
      const { data: invData, error: invErr } = await supabase
        .from('jobs_ledger_invoices')
        .select('id, job_id, amount, stripe_invoice_id, status')
        .in('job_id', jobIds)
        .eq('status', 'billed')
        .not('stripe_invoice_id', 'is', null)
      if (invErr) {
        showToast(invErr.message, 'warning')
        setInvoicesByJob({})
        return
      }
      const byJob: Record<string, BilledInvRow[]> = {}
      for (const r of (invData ?? []) as BilledInvRow[]) {
        const jid = r.job_id
        if (!byJob[jid]) byJob[jid] = []
        byJob[jid].push(r)
      }
      setInvoicesByJob(byJob)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load queue'), 'error')
      setRows([])
      setInvoicesByJob({})
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(jobId: string) {
    const invId = selectedInvoiceId[jobId] ?? invoicesByJob[jobId]?.[0]?.id
    if (!invId) {
      showToast('Create and finalize a Stripe invoice for this job (Billed) first.', 'error')
      return
    }
    setApprovingJobId(jobId)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('approve_collect_payment_for_terminal', {
            p_job_id: jobId,
            p_jobs_ledger_invoice_id: invId,
            p_dispatch_notes: undefined,
          }),
        'approve_collect_payment_for_terminal',
      )
      const raw = data as unknown
      if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
        showToast(String((raw as { error?: string }).error ?? 'Approve failed'), 'error')
        return
      }
      showToast('Approved for field Terminal collection', 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Approve failed'), 'error')
    } finally {
      setApprovingJobId(null)
    }
  }

  if (!loading && rows.length === 0) return null

  return (
    <div style={{ marginTop: '2rem' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        style={{
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: expanded ? '0.75rem' : 0,
        }}
      >
        <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Field: Waiting for Approval ({rows.length})</h2>
      </button>
      {expanded && (
        <>
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
          ) : (
            <div>
              {rows.map((r) => {
                const jl = r.jobs_ledger
                const hcp = jl?.hcp_number?.trim() || '—'
                const name = jl?.job_name?.trim() || '—'
                const opts = invoicesByJob[r.job_id] ?? []
                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      background: '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, minWidth: 0 }}>
                        {hcp} · {name}
                      </div>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: '#6b7280',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                        aria-label="Time waiting for dispatch review"
                      >
                        Waiting{' '}
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {formatWaitingLabelFromCertifiedAt(dispatchQueueNowMs, r.certified_at)}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 6 }}>
                      Mode: {r.certify_mode === 'correction_requested' ? 'Correction requested' : 'Certified'}{' '}
                      ·{' '}
                      {r.correction_notes ? (
                        <span title={r.correction_notes}>Notes on file</span>
                      ) : (
                        'No extra notes'
                      )}
                    </div>
                    {r.correction_notes && r.certify_mode === 'correction_requested' ? (
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          margin: '0.5rem 0 0',
                          padding: '0.5rem',
                          background: '#fffbeb',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {r.correction_notes}
                      </p>
                    ) : null}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      {opts.length === 0 ? (
                        <span style={{ fontSize: '0.8125rem', color: '#b45309' }}>
                          No billed Stripe invoice on file for this job.
                        </span>
                      ) : opts.length === 1 ? (
                        <span style={{ fontSize: '0.8125rem', color: '#374151' }}>
                          Invoice ${Number(opts[0]!.amount).toFixed(2)} ·{' '}
                          {(opts[0]!.stripe_invoice_id ?? '').slice(0, 12)}…
                        </span>
                      ) : (
                        <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          Billed invoice:
                          <select
                            value={selectedInvoiceId[r.job_id] ?? opts[0]!.id}
                            onChange={(e) =>
                              setSelectedInvoiceId((prev) => ({ ...prev, [r.job_id]: e.target.value }))
                            }
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            {opts.map((o) => (
                              <option key={o.id} value={o.id}>
                                ${Number(o.amount).toFixed(2)} · {(o.stripe_invoice_id ?? '').slice(0, 14)}…
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => void approve(r.job_id)}
                        disabled={approvingJobId === r.job_id || opts.length === 0}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: '#15803d',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor:
                            approvingJobId === r.job_id || opts.length === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {approvingJobId === r.job_id ? '…' : 'Approve for Terminal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void load()}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
