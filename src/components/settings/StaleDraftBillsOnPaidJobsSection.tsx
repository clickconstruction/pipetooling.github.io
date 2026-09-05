/** Settings → Data & recovery → "Draft bills on paid jobs (dev)": the one-time sweep behind the
 * J3-1 fix (v2.2846). Lists `jobs_ledger_invoices` rows still in `ready_to_bill` whose job is already
 * `paid` — never-sent drafts the Dashboard used to show with live Bill Customer buttons — and retires
 * each through the existing, audited `delete_ready_to_bill_invoice` RPC (deleted-records archive keeps
 * the row). Self-contained like DeletedRecordsSection: single-surface, owns its own state. The parent
 * already gates the whole Data tab to `myRole === 'dev'`. */
import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT,
  formatStaleDraftBillAmount,
  mapStaleDraftBillRows,
  summarizeStaleDraftBills,
  type StaleDraftBillJoinRow,
  type StaleDraftBillRow,
} from '../../lib/staleDraftBillsOnPaidJobs'

export default function StaleDraftBillsOnPaidJobsSection() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<StaleDraftBillRow[] | null>(null)
  const [retiringId, setRetiringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('jobs_ledger_invoices')
        .select(STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT)
        .eq('status', 'ready_to_bill')
        .eq('jobs_ledger.status', 'paid')
        .order('created_at', { ascending: true })
      if (error) throw error
      setRows(mapStaleDraftBillRows((data ?? []) as unknown as StaleDraftBillJoinRow[]))
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Could not load draft bills'))
    } finally {
      setLoading(false)
    }
  }, [])

  async function retire(row: StaleDraftBillRow) {
    if (retiringId) return
    setRetiringId(row.invoiceId)
    try {
      const data = await withSupabaseRetry(
        async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: row.invoiceId }),
        'delete_ready_to_bill_invoice',
      )
      const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        showToast(result?.error ?? 'Failed to retire draft bill', 'error')
        return
      }
      showToast(`Retired the ${formatStaleDraftBillAmount(row.amount)} draft on job ${row.jobNumber}`, 'success')
      setRows((prev) => (prev ? prev.filter((r) => r.invoiceId !== row.invoiceId) : prev))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to retire draft bill'), 'error')
    } finally {
      setRetiringId(null)
    }
  }

  const summary = rows ? summarizeStaleDraftBills(rows) : null

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next && rows === null) void load()
            return next
          })
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Draft bills on paid jobs (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Never-sent draft bills sitting on jobs that are already Paid in Full. The Dashboard no longer lists
            them, and a paid job cannot be billed again without asking twice, so these are leftovers — retire
            each one here. Retiring goes through the same audited delete as the Dashboard&apos;s &quot;Delete draft
            bill&quot; button (the row lands in Recently deleted).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Checking…' : rows === null ? 'Check now' : 'Check again'}
            </button>
            {summary ? (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {summary.count === 0
                  ? 'None found — every draft bill sits on an unpaid job.'
                  : `${summary.count} draft ${summary.count === 1 ? 'bill' : 'bills'} · ${formatStaleDraftBillAmount(summary.totalDollars)} that nobody owes`}
              </span>
            ) : null}
          </div>
          {loadError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p> : null}
          {rows && rows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Job</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Draft</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Created</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.invoiceId}>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                        <strong>{r.jobNumber}</strong> · {r.jobName}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {formatStaleDraftBillAmount(r.amount)}
                        {r.isPrimaryRemainder ? (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>auto</span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : '—'}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void retire(r)}
                          disabled={retiringId !== null}
                          style={{
                            padding: '0.3rem 0.75rem',
                            border: '1px solid #dc2626',
                            color: 'var(--text-red-700)',
                            background: 'var(--surface)',
                            borderRadius: 4,
                            cursor: retiringId ? 'wait' : 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {retiringId === r.invoiceId ? 'Retiring…' : 'Retire draft'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
