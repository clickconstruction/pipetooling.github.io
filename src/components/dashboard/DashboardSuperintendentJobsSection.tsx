import { Link } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatTimeSince } from '../../lib/dashboardJobRowActivity'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import {
  DriveLinkGlyph,
  JOB_ROW_LINK_ICON_COLUMN_STYLE,
  JOB_ROW_LINK_ICON_STYLE,
  JOB_ROW_PICTURES_ICON_WRAP_STYLE,
  JobPlansGlyph,
  sendToBillingButtonStyle,
  VIEW_REPORTS_BUTTON_STYLE,
} from './dashboardJobRowShared'

/**
 * Dashboard "Superintendent Jobs" block (v2.1004 job-row-family extraction —
 * improvement-plan item #4). Verbatim lift from `src/pages/Dashboard.tsx`;
 * every captured page value is a same-named prop; no behavior change.
 */
export function DashboardSuperintendentJobsSection({
  role,
  superintendentJobs,
  superintendentJobsLoading,
  superintendentJobsExpanded,
  setSuperintendentJobsExpanded,
  assignedJobs,
  openJobDetailFromDashboardJobRow,
  setViewReportsJob,
  isMobile,
  setReadyForBillingJob,
  setReadyForBillingChecked1,
  setReadyForBillingChecked2,
  jobStatusUpdatingId,
}: {
  role: UserRole | null
  superintendentJobs: DashboardTeamAssignedJobRow[]
  superintendentJobsLoading: boolean
  superintendentJobsExpanded: boolean
  setSuperintendentJobsExpanded: (updater: (prev: boolean) => boolean) => void
  assignedJobs: DashboardTeamAssignedJobRow[]
  openJobDetailFromDashboardJobRow: (j: DashboardTeamAssignedJobRow) => void
  setViewReportsJob: (v: { id: string; hcpNumber: string; jobName: string; jobAddress: string } | null) => void
  isMobile: boolean
  setReadyForBillingJob: (v: { id: string; hcpNumber: string; jobName: string } | null) => void
  setReadyForBillingChecked1: (v: boolean) => void
  setReadyForBillingChecked2: (v: boolean) => void
  jobStatusUpdatingId: string | null
}) {
  return (
    <>
      {role === 'superintendent' && (superintendentJobsLoading || superintendentJobs.filter((j) => !assignedJobs.some((a) => a.id === j.id)).length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setSuperintendentJobsExpanded((prev) => !prev)}
            aria-expanded={superintendentJobsExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: superintendentJobsExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{superintendentJobsExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
              Superintendent Jobs ({superintendentJobs.filter((j) => !assignedJobs.some((a) => a.id === j.id)).length})
            </h2>
          </button>
          {superintendentJobsExpanded && (
            superintendentJobsLoading && superintendentJobs.length === 0 ? (
              <DashboardListRowSkeleton rows={2} />
            ) : (
              <div>
                {superintendentJobs
                  .filter((j) => !assignedJobs.some((a) => a.id === j.id))
                  .map((j) => (
                    <div
                      key={j.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={isMobile ? { flex: '0 0 50%', minWidth: 0 } : undefined}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => openJobDetailFromDashboardJobRow(j)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openJobDetailFromDashboardJobRow(j)
                              }
                            }}
                            aria-label={`Job details: ${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${(j.job_name ?? '').trim() || '—'}`}
                            style={{
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: 'var(--text-strong)',
                              width: 'fit-content',
                            }}
                          >
                            {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name || '—'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {j.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                            <div style={JOB_ROW_LINK_ICON_COLUMN_STYLE}>
                              {j.google_drive_link?.trim() && (
                                <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={JOB_ROW_LINK_ICON_STYLE}>
                                  <DriveLinkGlyph />
                                </a>
                              )}
                              {j.job_pictures_link?.trim() && (
                                <span style={JOB_ROW_PICTURES_ICON_WRAP_STYLE}>
                                  <DashboardJobPicturesLinkRow layout="inline" jobPicturesLink={j.job_pictures_link} />
                                </span>
                              )}
                              {j.job_plans_link?.trim() && (
                                <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={JOB_ROW_LINK_ICON_STYLE}>
                                  <JobPlansGlyph />
                                </a>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                                style={VIEW_REPORTS_BUTTON_STYLE}
                              >
                                View<br />Reports
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' })
                                  setReadyForBillingChecked1(false)
                                  setReadyForBillingChecked2(false)
                                }}
                                disabled={jobStatusUpdatingId === j.id}
                                style={sendToBillingButtonStyle(jobStatusUpdatingId === j.id)}
                              >
                                {jobStatusUpdatingId === j.id ? '…' : <>Send to<br />Billing</>}
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              {j.created_at && (
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                                  <>Open<br />{formatTimeSince(j.created_at)}</>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {j.in_progress_stage_name && (
                        <Link
                          to={j.project_id && j.in_progress_step_id
                            ? `/workflows/${j.project_id}#step-${j.in_progress_step_id}`
                            : '/workflows'}
                          style={{
                            display: 'block',
                            marginTop: '1rem',
                            marginLeft: '-1rem',
                            marginRight: '-1rem',
                            marginBottom: '-1rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-violet-100)',
                            color: 'var(--text-violet-700)',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            borderBottomLeftRadius: 8,
                            borderBottomRightRadius: 8,
                            textAlign: 'center',
                          }}
                        >
                          In progress stage: {j.in_progress_stage_name}
                        </Link>
                      )}
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
      )}
    </>
  )
}
