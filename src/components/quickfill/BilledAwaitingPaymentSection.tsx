import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { formatCurrency } from '../../lib/format'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { Database } from '../../types/database'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type LedgerPaymentPick = Pick<
  Database['public']['Tables']['jobs_ledger_payments']['Row'],
  'job_id' | 'invoice_id' | 'amount'
>
type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

type BilledRow =
  | { kind: 'job'; job: JobsLedgerRow; assigned: string[]; remaining: number }
  | { kind: 'invoice'; inv: JobsLedgerInvoice; job: JobsLedgerRow; assigned: string[]; remaining: number }

export function BilledAwaitingPaymentSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BilledRow[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [jobsRes, invoicesRes] = await Promise.all([
          supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, revenue, payments_made').eq('status', 'billed'),
          supabase.from('jobs_ledger_invoices').select('id, job_id, amount').eq('status', 'billed'),
        ])
        if (cancelled) return
        const billedJobs = (jobsRes.data ?? []) as JobsLedgerRow[]
        const billedInvoices = (invoicesRes.data ?? []) as JobsLedgerInvoice[]
        if (jobsRes.error) {
          setError(jobsRes.error.message)
          setLoading(false)
          return
        }
        if (invoicesRes.error) {
          setError(invoicesRes.error.message)
          setLoading(false)
          return
        }

        const jobIds = new Set<string>()
        for (const j of billedJobs) jobIds.add(j.id)
        for (const i of billedInvoices) jobIds.add(i.job_id)

        let jobDetailsMap: Record<string, JobsLedgerRow> = {}
        if (jobIds.size > 0) {
          const ids = Array.from(jobIds)
          const { data: jobDetails } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: ids })
          jobDetailsMap = Object.fromEntries(
            ((jobDetails ?? []) as JobsLedgerRow[]).map((j) => [j.id, j])
          )
        }

        const jobIdsArray = Array.from(jobIds)
        const { data: payRows } =
          jobIdsArray.length > 0
            ? await supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount').in('job_id', jobIdsArray)
            : { data: [] as LedgerPaymentPick[] }
        const payments = (payRows ?? []) as LedgerPaymentPick[]
        function appliedToInvoice(invoiceId: string): number {
          let s = 0
          for (const p of payments) {
            if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
          }
          return s
        }

        const { data: teamData } = await supabase
          .from('jobs_ledger_team_members')
          .select('job_id, users(name)')
          .in('job_id', jobIdsArray)
        const teamByJob = new Map<string, string[]>()
        for (const t of (teamData ?? []) as (JobsLedgerTeamMember & { users: { name: string } | null })[]) {
          const names = (teamByJob.get(t.job_id) ?? [])
          const n = t.users?.name?.trim()
          if (n) names.push(n)
          teamByJob.set(t.job_id, names)
        }

        const result: BilledRow[] = []
        let sumTotal = 0

        for (const j of billedJobs) {
          const remaining = Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)
          sumTotal += remaining
          result.push({
            kind: 'job',
            job: j,
            assigned: teamByJob.get(j.id) ?? [],
            remaining,
          })
        }
        for (const inv of billedInvoices) {
          const job = jobDetailsMap[inv.job_id]
          if (!job) continue
          const amount = Number(inv.amount ?? 0)
          const remaining = Math.max(0, amount - appliedToInvoice(inv.id))
          if (remaining <= 0) continue
          sumTotal += remaining
          result.push({
            kind: 'invoice',
            inv,
            job,
            assigned: teamByJob.get(inv.job_id) ?? [],
            remaining,
          })
        }

        if (!cancelled) {
          setRows(result)
          setTotal(sumTotal)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [authUser?.id])

  const canAccess = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const jobDetailModal = useJobDetailModal()
  useReportQuickfillSectionMetric(
    'billed-awaiting',
    !canAccess || !authUser?.id ? null : loading ? null : error ? null : rows.length,
    !!(canAccess && authUser?.id && loading),
  )
  if (!canAccess) return null

  if (loading) return null
  if (rows.length === 0) return null

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div
        style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          marginBottom: '0.75rem',
          textAlign: 'left',
          color: 'var(--text-700)',
        }}
      >
        {rows.length} line{rows.length !== 1 ? 's' : ''} · ${formatCurrency(total)} remaining
      </div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>HCP</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Job</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Assigned</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const openDetail = jobDetailModal
                ? () =>
                    jobDetailModal.openJobDetail({
                      jobId: r.job.id,
                      prefillRowLabel: `${effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—'} · ${r.job.job_name || '—'}`,
                    })
                : null
              return (
                <tr
                  key={r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`}
                  onClick={openDetail ?? undefined}
                  title={openDetail ? 'Open job details (notes, status, billing, crew timeline)' : undefined}
                  style={{ borderBottom: '1px solid var(--border)', cursor: openDetail ? 'pointer' : undefined }}
                >
                  <td style={{ padding: '0.75rem 0.5rem' }}>{effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {openDetail ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail()
                        }}
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
                          textAlign: 'left',
                        }}
                      >
                        {r.job.job_name || '—'}
                      </button>
                    ) : (
                      r.job.job_name || '—'
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{r.assigned.join(', ') || '—'}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${formatCurrency(r.remaining)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to="/jobs?tab=stages"
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 4, fontSize: '0.875rem' }}
        >
          View in Jobs Stages
        </Link>
      </div>
    </section>
  )
}
