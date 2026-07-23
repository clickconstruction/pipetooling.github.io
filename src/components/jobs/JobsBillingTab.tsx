import { useEffect, useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { formatAddressTwoLines } from '../../lib/jobs/jobAddressUrls'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  billingFixturesCellText,
  billingJobMatchesSearch,
  billingMaterialsCellText,
  sortJobsForBilling,
} from '../../lib/jobs/billingTab'

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
  /** Switch to Sub Labor with the labor form prefilled from this job (parent-owned cross-tab flow). */
  onFillLaborFromBilling: (job: JobWithDetails) => void
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
  onFillLaborFromBilling,
}: JobsBillingTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [billingSortAsc, setBillingSortAsc] = useState(false) // false = highest HCP first (desc, largest to smallest)

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

  const filteredJobs = jobs.filter((j) => billingJobMatchesSearch(j, searchQuery))

  const sortedBillingJobs = useMemo(
    () => sortJobsForBilling(filteredJobs, billingSortAsc),
    [filteredJobs, billingSortAsc],
  )

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
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job #</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Specific Work</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Other job charges</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contractors</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total Bill</th>
                <th style={{ padding: '0.75rem', width: 100, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {sortedBillingJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}
                    {job.hcp_number && authRole !== 'primary' && !laborJobHcps.has((job.hcp_number ?? '').trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => onFillLaborFromBilling(job)}
                        title="Add Labor: fill from Billing and open Labor"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                          <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                        </svg>
                      </button>
                    )}
                    {job.hcp_number && authRole !== 'primary' && !teamLaborLoading && !teamLaborJobIds.has(job.id) && (
                      <span
                        title="No Team Job Labor for this job"
                        style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                          <path d="M240 104C240 73.1 265.1 48 296 48C326.9 48 352 73.1 352 104C352 134.9 326.9 160 296 160C265.1 160 240 134.9 240 104zM42.5 245.3C48.4 233.4 62.8 228.6 74.7 234.6L99.3 246.9L111.5 226.5C130.4 195 164.7 176 201.1 176C247.3 176 288.8 206.5 301.6 251.4L333.8 364.1L426.7 410.5L452.5 367.5C458.3 357.9 468.7 352 479.9 352C491.1 352 501.6 357.9 507.3 367.5L603.3 527.5C609.2 537.4 609.4 549.7 603.7 559.7C598 569.7 587.5 576 576 576L384 576C372.5 576 361.8 569.8 356.2 559.8C350.6 549.8 350.7 537.5 356.6 527.6L402 451.8L53.3 277.5C41.4 271.6 36.6 257.2 42.6 245.3zM126.3 371.4L238.3 427.4C249.1 432.8 256 443.9 256 456L256 544C256 561.7 241.7 576 224 576C206.3 576 192 561.7 192 544L192 475.8L130.7 445.1L94.4 554.1C88.8 570.9 70.7 579.9 53.9 574.3C37.1 568.7 28.1 550.6 33.7 533.9L81.7 389.9C84.6 381.1 91.2 374 99.8 370.5C108.4 367 118.1 367.3 126.4 371.4z" />
                        </svg>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div>{job.job_name || '—'}</div>
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
                  <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 180 }}>
                    {billingFixturesCellText(job.fixtures)}
                  </td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                    {billingMaterialsCellText(job.materials)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {job.team_members.length === 0
                      ? '—'
                      : job.team_members.map((t) => t.users?.name ?? 'Unknown').join(', ')}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {job.revenue != null ? `$${formatCurrency(Number(job.revenue))}` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {(job.google_drive_link?.trim() || job.job_plans_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                          {job.google_drive_link?.trim() && (
                            <a
                              href={job.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.25rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                          {job.job_plans_link?.trim() && (
                            <a
                              href={job.job_plans_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.job_plans_link!.trim()) }}
                              title="Job Plans"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.25rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(job)}
                        title="Edit"
                        aria-label="Edit"
                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
