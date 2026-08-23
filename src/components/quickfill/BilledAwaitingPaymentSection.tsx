import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { formatCurrency } from '../../lib/format'
import { fetchStagesHeaderStats } from '../../lib/jobs/fetchStagesHeaderStats'
import { buildQuickfillBilledRows, type QuickfillBilledRow } from '../../lib/jobs/quickfillBilledAwaiting'
import type { Database } from '../../types/database'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

export function BilledAwaitingPaymentSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<QuickfillBilledRow[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // v2.2147: the Pipeline's own Billed Awaiting Payment rows (lean spine →
        // board kernel: one row per bill, Collections excluded). Before, this
        // section pushed a job-level row for EVERY billed job plus an invoice
        // row per line — doubling nearly everything.
        const res = await fetchStagesHeaderStats(null)
        if (cancelled) return
        if (!res.ok) {
          setError(res.error)
          setLoading(false)
          return
        }
        const lean = res.leanBilledRows
        const jobIds = Array.from(new Set(lean.map((r) => r.job.id)))
        const jobNameById = new Map<string, string>()
        const assignedByJobId = new Map<string, string[]>()
        if (jobIds.length > 0) {
          const [{ data: jobDetails }, { data: teamData }] = await Promise.all([
            supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }),
            supabase.from('jobs_ledger_team_members').select('job_id, users(name)').in('job_id', jobIds),
          ])
          if (cancelled) return
          for (const j of (jobDetails ?? []) as Array<{ id: string; job_name: string | null }>) {
            jobNameById.set(j.id, (j.job_name ?? '').trim())
          }
          for (const t of (teamData ?? []) as (JobsLedgerTeamMember & { users: { name: string } | null })[]) {
            const n = t.users?.name?.trim()
            if (!n) continue
            assignedByJobId.set(t.job_id, [...(assignedByJobId.get(t.job_id) ?? []), n])
          }
        }
        const built = buildQuickfillBilledRows(lean, jobNameById, assignedByJobId)
        if (!cancelled) {
          setRows(built.rows)
          setTotal(built.total)
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
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Job #</th>
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
                      jobId: r.jobId,
                      prefillRowLabel: `${r.jobNumber} · ${r.jobName}`,
                    })
                : null
              return (
                <tr
                  key={r.key}
                  onClick={openDetail ?? undefined}
                  title={openDetail ? 'Open job details (notes, status, billing, crew timeline)' : undefined}
                  style={{ borderBottom: '1px solid var(--border)', cursor: openDetail ? 'pointer' : undefined }}
                >
                  <td style={{ padding: '0.75rem 0.5rem' }}>{r.jobNumber}</td>
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
                        {r.jobName}
                      </button>
                    ) : (
                      r.jobName
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
          View in Jobs Pipeline
        </Link>
      </div>
    </section>
  )
}
