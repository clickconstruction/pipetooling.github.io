import { useEffect, useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { formatAddressTwoLines } from '../../lib/jobs/jobAddressUrls'
import { useToastContext } from '../../contexts/ToastContext'
import {
  BILLING_ATTENTION_LABEL,
  billingFixturesCellText,
  billingJobMatchesSearch,
  billingJobNeedsAttention,
  billingMaterialsCellText,
  billingRowMoneyTokens,
  billingTotals,
  sortJobsForBilling,
} from '../../lib/jobs/billingTab'
import { jobBilledUnpaidDollars } from '../../lib/jobs/invoiceBilling'
import { jobPickerStatusChip } from '../../lib/scheduleDispatchHub'
import { STAGES_EDIT_MODE_RAIL_WIDTH, renderStagesEditModeRail, renderStagesJobHcpChip } from './jobsStagesRowShared'

/**
 * Jobs → Billing tab (Stage B of the Jobs.tsx decomposition — see
 * docs/JOBS_TABS_ARCHITECTURE.md). Owns the search box and the per-user HCP
 * sort toggle (localStorage `jobs_billing_sort_asc_<uid>`); everything else is
 * injected — the jobs list cache, the two red-icon sets from the shared labor
 * loaders, and the parent callbacks (New/Edit Job via the app modal context,
 * and the Billing → Sub Labor prefill).
 */
export type JobsBillingTabProps = {
  jobs: JobWithDetails[]
  jobsListLoading: boolean
  jobsListRefreshing: boolean
  jobsListError: string | null
  /** Page-global error (map quirk #7 — one error state shared across tabs). */
  error: string | null
  authUserId: string | undefined
  authRole: UserRole | null
  /** Parent-owned media-query flag, shared with the Stages toolbar. */
  shortNewJobButtonLabel: boolean
  /** Lowercased HCP numbers that already have a Sub Labor job (hides the red Add-Labor icon). */
  laborJobHcps: Set<string>
  /** Job ids that have Team Job Labor rows (hides the red no-team-labor icon). */
  teamLaborJobIds: Set<string>
  teamLaborLoading: boolean
  openNew: () => void
  openEdit: (job: JobWithDetails) => void
}

export default function JobsBillingTab({
  jobs,
  jobsListLoading,
  jobsListRefreshing,
  jobsListError,
  error,
  authUserId,
  authRole,
  shortNewJobButtonLabel,
  laborJobHcps,
  teamLaborJobIds,
  teamLaborLoading,
  openNew,
  openEdit,
}: JobsBillingTabProps) {
  const { showToast } = useToastContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [billingSortAsc, setBillingSortAsc] = useState(false) // false = highest HCP first (desc, largest to smallest)
  /** v2.1619 audit refit: 'attention' shows only rows wearing a red labor-capture flag. */
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [stageFilter, setStageFilter] = useState<string>('')

  // Restore billing sort preference from localStorage (per user)
  useEffect(() => {
    if (authUserId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`jobs_billing_sort_asc_${authUserId}`)
        if (stored !== null) setBillingSortAsc(stored === 'true')
      } catch {
        /* ignore */
      }
    }
  }, [authUserId])

  const attentionCount = useMemo(
    () => jobs.filter((j) => billingJobNeedsAttention(j, laborJobHcps, teamLaborJobIds)).length,
    [jobs, laborJobHcps, teamLaborJobIds],
  )

  const filteredJobs = jobs.filter(
    (j) =>
      billingJobMatchesSearch(j, searchQuery) &&
      (!stageFilter || (j.status ?? 'working') === stageFilter) &&
      (!attentionOnly || billingJobNeedsAttention(j, laborJobHcps, teamLaborJobIds)),
  )

  const sortedBillingJobs = useMemo(
    () => sortJobsForBilling(filteredJobs, billingSortAsc),
    [filteredJobs, billingSortAsc],
  )

  const totals = useMemo(() => billingTotals(sortedBillingJobs), [sortedBillingJobs])

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={openNew}
          aria-label="New job"
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {shortNewJobButtonLabel ? 'New' : 'New Job'}
        </button>
        <input
          type="search"
          placeholder="Search jobs…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: 200,
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '0.875rem',
          }}
        />
        <button
          type="button"
          onClick={() => {
            setBillingSortAsc((prev) => {
              const next = !prev
              if (authUserId && typeof window !== 'undefined') {
                try {
                  localStorage.setItem(`jobs_billing_sort_asc_${authUserId}`, String(next))
                } catch {
                  /* ignore */
                }
              }
              return next
            })
          }}
          title={billingSortAsc ? 'Lowest HCP first (click to reverse)' : 'Highest HCP first (click to reverse)'}
          aria-label={billingSortAsc ? 'Sort ascending' : 'Sort descending'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            padding: 0,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          {billingSortAsc ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
              <path d="M7 14l5-5 5 5H7z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
              <path d="M7 10l5 5 5-5H7z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAttentionOnly((v) => !v)}
          aria-pressed={attentionOnly}
          title="Only jobs missing a Sub Labor book or Team Job Labor (the red flags)"
          style={{
            padding: '0.45rem 0.8rem',
            borderRadius: 999,
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            border: attentionOnly ? '1px solid #b91c1c' : '1px solid var(--border-strong)',
            background: attentionOnly ? 'var(--bg-red-100)' : 'var(--surface)',
            color: attentionOnly ? 'var(--text-red-800)' : 'var(--text-700)',
          }}
        >
          {attentionOnly ? '✓ ' : ''}Needs labor{attentionCount > 0 ? ` (${attentionCount})` : ''}
        </button>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
          style={{
            padding: '0.45rem 0.5rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '0.8125rem',
            background: 'var(--surface)',
            color: stageFilter ? 'var(--text-700)' : 'var(--text-muted)',
          }}
        >
          <option value="">All stages</option>
          <option value="waiting">Waiting</option>
          <option value="working">Working</option>
          <option value="ready_to_bill">Ready to Bill</option>
          <option value="billed">Billed</option>
        </select>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
        Assistants see jobs from their master and from other assistants adopted by the same master. If you don&apos;t see a colleague&apos;s jobs, the master must adopt both of you in Settings → Adopt Assistants.
      </p>
      {(error || jobsListError) && (
        <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error || jobsListError}</p>
      )}
      {jobsListLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : null}
      {jobsListRefreshing && !jobsListLoading && (
        <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Updating…</p>
      )}
      {!jobsListLoading && (sortedBillingJobs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No HCP jobs yet. Click New Job to add one.</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', width: 130 }}>Contractors</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', width: '42%' }}>Specific Work</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', width: 140 }}>Other job charges</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total Bill</th>
                <th style={{ padding: 0, width: STAGES_EDIT_MODE_RAIL_WIDTH, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {sortedBillingJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {/* v2.1623: the Pipeline "926 PLUM" merged chip — one unwrappable badge. */}
                      {renderStagesJobHcpChip(job) ?? <span>—</span>}
                      {(() => {
                        const chip = jobPickerStatusChip(job.status ?? 'working')
                        if (!chip) return null
                        return (
                          <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: chip.background, color: chip.color, whiteSpace: 'nowrap' }}>
                            {chip.label}
                          </span>
                        )
                      })()}
                    {job.hcp_number && authRole !== 'primary' && !teamLaborLoading && (() => {
                      // v2.1643: icon only when BOTH labor kinds are missing —
                      // either one recorded clears it. Mirrors the Needs labor
                      // filter. Hover explains; click toasts it (phones have no
                      // hover).
                      if (!billingJobNeedsAttention(job, laborJobHcps, teamLaborJobIds)) return null
                      const label = BILLING_ATTENTION_LABEL
                      return (
                      <button
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={() => showToast(label, 'info')}
                        style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                          <path d="M240 104C240 73.1 265.1 48 296 48C326.9 48 352 73.1 352 104C352 134.9 326.9 160 296 160C265.1 160 240 134.9 240 104zM42.5 245.3C48.4 233.4 62.8 228.6 74.7 234.6L99.3 246.9L111.5 226.5C130.4 195 164.7 176 201.1 176C247.3 176 288.8 206.5 301.6 251.4L333.8 364.1L426.7 410.5L452.5 367.5C458.3 357.9 468.7 352 479.9 352C491.1 352 501.6 357.9 507.3 367.5L603.3 527.5C609.2 537.4 609.4 549.7 603.7 559.7C598 569.7 587.5 576 576 576L384 576C372.5 576 361.8 569.8 356.2 559.8C350.6 549.8 350.7 537.5 356.6 527.6L402 451.8L53.3 277.5C41.4 271.6 36.6 257.2 42.6 245.3zM126.3 371.4L238.3 427.4C249.1 432.8 256 443.9 256 456L256 544C256 561.7 241.7 576 224 576C206.3 576 192 561.7 192 544L192 475.8L130.7 445.1L94.4 554.1C88.8 570.9 70.7 579.9 53.9 574.3C37.1 568.7 28.1 550.6 33.7 533.9L81.7 389.9C84.6 381.1 91.2 374 99.8 370.5C108.4 367 118.1 367.3 126.4 371.4z" />
                        </svg>
                      </button>
                      )
                    })()}
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>{job.job_name || '—'}</div>
                    {(() => {
                      const fmt = formatAddressTwoLines(job.job_address)
                      if (!fmt) return null
                      return (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          <div>{fmt.line1}</div>
                          {fmt.line2 && <div>{fmt.line2}</div>}
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: 130, fontSize: '0.8125rem' }}>
                    {job.team_members.length === 0
                      ? '—'
                      : job.team_members.map((t) => t.users?.name ?? 'Unknown').join(', ')}
                  </td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap' }}>
                    {billingFixturesCellText(job.fixtures)}
                  </td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                    {billingMaterialsCellText(job.materials)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {job.revenue != null ? `$${formatCurrency(Number(job.revenue))}` : '—'}
                    {(() => {
                      const tokens = billingRowMoneyTokens(job, jobBilledUnpaidDollars(job))
                      if (tokens.length === 0) return null
                      const tone = { paid: 'var(--text-green-700)', billed: 'var(--text-blue-700)', unbilled: 'var(--text-amber-700)' } as const
                      return (
                        <div style={{ fontSize: '0.6875rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          {tokens.map((t) => (
                            <span key={t.tone} style={{ color: tone[t.tone] }}>{t.label}</span>
                          ))}
                        </div>
                      )
                    })()}
                  </td>
                  {/* v2.1635: the whole actions cell is Stages' vertical EDIT rail (right edge). */}
                  <td style={{ position: 'relative', padding: 0, width: STAGES_EDIT_MODE_RAIL_WIDTH }}>
                    {renderStagesEditModeRail(job, openEdit, 'right')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {totals.count} {totals.count === 1 ? 'job' : 'jobs'}
                  {attentionOnly ? ' needing labor' : ''}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ${formatCurrency(totals.totalBill)}
                  <div style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-green-700)' }}>paid ${formatCurrency(totals.totalPaid)}</div>
                </td>
                <td style={{ borderTop: '1px solid var(--border)' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  )
}
