import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  formatTimeSince,
  subcontractorAssignedJobStageDisplay,
  subcontractorLastActivityBlock,
} from '../../lib/dashboardJobRowActivity'
import { subcontractorLastActivityMobileLine } from '../../lib/subcontractorLastActivityCompact'
import { formatOpenAgeShort } from '../../lib/formatOpenAgeShort'
import { DashboardGroupCard } from './DashboardGroupCard'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { DashboardLeaveReportButton } from './DashboardLeaveReportButton'
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
 * Dashboard "Assigned Jobs" section (v2.1004 job-row-family extraction —
 * improvement-plan item #4). Verbatim lift from `src/pages/Dashboard.tsx`:
 * every captured page value is a same-named prop; no behavior change. Lives
 * beside `DashboardTeamReadyToBillSection` so the compact-card language
 * (v2.994/v2.997) has one home per section.
 */
export function DashboardAssignedJobsSection({
  role,
  isMobile,
  assignedJobs,
  assignedJobsLoading,
  assignedJobsSearch,
  setAssignedJobsSearch,
  filteredAssignedJobs,
  openJobDetailFromDashboardJobRow,
  setViewReportsJob,
  setSubcontractorJobActivityModalJob,
  leaveReportReminderForJobRow,
  setLeaveReportJob,
  setReadyForBillingJob,
  setReadyForBillingChecked1,
  setReadyForBillingChecked2,
  jobStatusUpdatingId,
  formatDatetime,
}: {
  role: UserRole | null
  isMobile: boolean
  assignedJobs: DashboardTeamAssignedJobRow[]
  assignedJobsLoading: boolean
  assignedJobsSearch: string
  setAssignedJobsSearch: Dispatch<SetStateAction<string>>
  filteredAssignedJobs: DashboardTeamAssignedJobRow[]
  openJobDetailFromDashboardJobRow: (j: DashboardTeamAssignedJobRow) => void
  setViewReportsJob: (v: { id: string; hcpNumber: string; jobName: string; jobAddress: string } | null) => void
  setSubcontractorJobActivityModalJob: (v: { id: string; hcpNumber: string; jobName: string } | null) => void
  leaveReportReminderForJobRow: (j: DashboardTeamAssignedJobRow) => boolean
  setLeaveReportJob: (v: { id: string; hcpNumber: string; jobName: string; jobAddress: string } | null) => void
  setReadyForBillingJob: (v: { id: string; hcpNumber: string; jobName: string } | null) => void
  setReadyForBillingChecked1: (v: boolean) => void
  setReadyForBillingChecked2: (v: boolean) => void
  jobStatusUpdatingId: string | null
  formatDatetime: (iso: string) => string
}) {
  return (
        <DashboardGroupCard
          id="dash-assigned-jobs"
          title={`Assigned Jobs (${assignedJobs.length})`}
          collapseStorageKey="dash-assigned-jobs-collapsed"
          defaultCollapsed
        >
          {assignedJobsLoading && assignedJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              <input
                type="search"
                value={assignedJobsSearch}
                onChange={(e) => setAssignedJobsSearch(e.target.value)}
                placeholder="Search assigned jobs…"
                aria-label="Search assigned jobs"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                  marginBottom: '0.25rem',
                }}
              />
              {filteredAssignedJobs.length === 0 && assignedJobsSearch.trim() !== '' && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.75rem 0 0.25rem' }}>
                  No assigned jobs match your search.
                </p>
              )}
              {filteredAssignedJobs.map((j, idx) => (
                <div
                  key={j.id}
                  style={{
                    padding: '0.85rem 0',
                    borderBottom: idx < filteredAssignedJobs.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* v2.997: same compact mobile treatment as Ready to Bill — info full-width, actions on a row below. */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? '0.5rem' : '1rem' }}>
                    <div style={isMobile ? { width: '100%', minWidth: 0 } : undefined}>
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
                      {(j.customer_name ?? '').trim() !== '' && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={13} height={13} fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L160 64zM272 352L336 352C380.2 352 416 387.8 416 432C416 440.8 408.8 448 400 448L208 448C199.2 448 192 440.8 192 432C192 387.8 227.8 352 272 352zM248 256C248 225.1 273.1 200 304 200C334.9 200 360 225.1 360 256C360 286.9 334.9 312 304 312C273.1 312 248 286.9 248 256zM576 144C576 135.2 568.8 128 560 128C551.2 128 544 135.2 544 144L544 208C544 216.8 551.2 224 560 224C568.8 224 576 216.8 576 208L576 144zM576 272C576 263.2 568.8 256 560 256C551.2 256 544 263.2 544 272L544 336C544 344.8 551.2 352 560 352C568.8 352 576 344.8 576 336L576 272zM560 384C551.2 384 544 391.2 544 400L544 464C544 472.8 551.2 480 560 480C568.8 480 576 472.8 576 464L576 400C576 391.2 568.8 384 560 384z" />
                          </svg>
                          <span>{(j.customer_name ?? '').trim()}</span>
                        </div>
                      )}
                      {isSubcontractorLikeRole(role) && (() => {
                        const d = subcontractorAssignedJobStageDisplay(j)
                        if (!d) return null
                        const { line, title } = d
                        return (
                          <div
                            style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}
                            title={title}
                          >
                            {line}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                        <div style={{ ...JOB_ROW_LINK_ICON_COLUMN_STYLE, flexDirection: isMobile ? 'row' : 'column' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={JOB_ROW_LINK_ICON_STYLE}
                            >
                              <DriveLinkGlyph />
                            </a>
                          )}
                          {j.job_pictures_link?.trim() && (
                            <span style={JOB_ROW_PICTURES_ICON_WRAP_STYLE}>
                              <DashboardJobPicturesLinkRow layout="inline" jobPicturesLink={j.job_pictures_link} />
                            </span>
                          )}
                          {j.job_plans_link?.trim() && (
                            <a
                              href={j.job_plans_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                              title="Job Plans"
                              style={JOB_ROW_LINK_ICON_STYLE}
                            >
                              <JobPlansGlyph />
                            </a>
                          )}
                        </div>
                      )}
                      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                            style={VIEW_REPORTS_BUTTON_STYLE}
                          >
                            View<br />Reports
                          </button>
                        </>
                      )}
                      {role === 'superintendent' && (
                        <button
                          type="button"
                          onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={VIEW_REPORTS_BUTTON_STYLE}
                        >
                          View<br />Reports
                        </button>
                      )}
                      {isSubcontractorLikeRole(role) && !isMobile && (() => {
                        const b = subcontractorLastActivityBlock(j)
                        return (
                          b.line3 != null ? (
                            <button
                              type="button"
                              className="subcontractorLastActivityTypeBtn"
                              style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              textAlign: 'center',
                              maxWidth: 220,
                              lineHeight: 1.25,
                              gap: 2,
                              }}
                              title={b.title}
                              onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                                    jobName: j.job_name ?? '—',
                                  })
                              }
                              aria-label={`What last activity means and recent history for ${j.job_name ?? 'this job'}`}
                            >
                              <span>{b.line1}</span>
                              <span>{b.line2}</span>
                              <span>{b.line3}</span>
                            </button>
                          ) : (
                            <div
                              style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              textAlign: 'center',
                              maxWidth: 220,
                              lineHeight: 1.25,
                              gap: 2,
                              }}
                              title={b.title}
                            >
                              <span>{b.line1}</span>
                              <span>{b.line2}</span>
                            </div>
                          )
                        )
                      })()}
                      {role !== 'helpers' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' })
                          setReadyForBillingChecked1(false)
                          setReadyForBillingChecked2(false)
                        }}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{ ...sendToBillingButtonStyle(jobStatusUpdatingId === j.id), whiteSpace: 'nowrap' }}
                      >
                        {jobStatusUpdatingId === j.id ? '…' : isMobile ? 'Send to Billing' : <>Send to<br />Billing</>}
                      </button>
                      ) : null}
                      {canLeaveJobFieldReport(role) && (
                        <DashboardLeaveReportButton
                          singleLine={isMobile}
                          showReminder={leaveReportReminderForJobRow(j)}
                          onClick={() =>
                            setLeaveReportJob({
                              id: j.id,
                              hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                              jobName: j.job_name ?? '—',
                              jobAddress: j.job_address ?? '—',
                            })
                          }
                        />
                      )}
                      {j.created_at && (!isMobile || !isSubcontractorLikeRole(role)) && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                          <>Open<br />{formatTimeSince(j.created_at)}</>
                        </span>
                      )}
                      {isSubcontractorLikeRole(role) && isMobile && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.4rem', width: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                          {j.created_at && (
                          <span title="Time since job created">
                            Open {formatOpenAgeShort(j.created_at)}{' ·'}
                          </span>
                        )}
                          {(() => {
                            const m = subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                            if (!m.clickable) {
                              return (
                                <span title={m.title} aria-label={m.aria} style={{ lineHeight: 1.3 }}>
                                  {m.textCompact}
                                </span>
                              )
                            }
                            return (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                title={m.title}
                                aria-label={m.aria}
                                style={{ lineHeight: 1.3, textAlign: 'left' }}
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                              >
                                {m.textCompact}
                              </button>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {j.in_progress_stage_name && !isSubcontractorLikeRole(role) && (
                    <Link
                      to={j.project_id && j.in_progress_step_id
                        ? `/workflows/${j.project_id}#step-${j.in_progress_step_id}`
                        : '/workflows'}
                      style={{
                        display: 'block',
                        marginTop: '0.75rem',
                        padding: '0.4rem 0.75rem',
                        background: 'var(--bg-violet-100)',
                        color: 'var(--text-violet-700)',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        borderRadius: 6,
                        textAlign: 'center',
                      }}
                    >
                      In progress stage: {j.in_progress_stage_name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashboardGroupCard>
  )
}
