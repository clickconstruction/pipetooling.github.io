import { useState } from 'react'
import { Link } from 'react-router-dom'
import CollectPaymentModal from '../jobs/CollectPaymentModal'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { isAssistantLike, isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { labelJobsLedgerStatusForDashboard } from '../../lib/jobsLedgerStatusPipeline'
import { formatDatetime } from '../../lib/dashboardProjectsCard'
import { subcontractorLastActivityMobileLine } from '../../lib/subcontractorLastActivityCompact'
import { formatTimeSince, subcontractorLastActivityBlock } from '../../lib/dashboardJobRowActivity'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../../lib/dashboardTeamAssignedJobRow'
import type { UserRole } from '../../hooks/useAuth'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { DashboardLeaveReportButton } from './DashboardLeaveReportButton'

export type DashboardTeamReadyToBillSectionProps = {
  role: UserRole | null
  isMobile: boolean
  narrowViewport660: boolean
  /** From the parent's `useDashboardAssignedJobs` seam. */
  assignedReadyToBillJobs: DashboardTeamAssignedJobRow[]
  assignedReadyToBillLoading: boolean
  /** Seam refresher — also wired to `CollectPaymentModal.onFlowChanged`. */
  refreshAssignedReadyToBill: () => void
  /** From the parent's `useDashboardSubSchedule` seam (quirk #11). */
  leaveReportReminderForJobRow: (
    j: Pick<DashboardTeamAssignedJobRow, 'id' | 'my_last_report_at'>,
  ) => boolean
  /** Shared job-detail opener (parent-owned; also used by Assigned/Superintendent rows). */
  openJobDetailFromDashboardJobRow: (j: {
    id: string
    hcp_number: string | null
    job_name: string | null
    job_address: string | null
  }) => void
  /** Opener for the shared `JobReportsModal` (`viewReportsJob` state in the parent). */
  setViewReportsJob: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
  /** Opener for the shared `AdditionalReportModal` (`leaveReportJob` state in the parent). */
  setLeaveReportJob: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
  /** Opener for the shared `SubcontractorJobActivityModal` (parent state; also opened from Assigned rows). */
  setSubcontractorJobActivityModalJob: (job: { id: string; hcpNumber: string; jobName: string }) => void
}

/**
 * Dashboard "Ready to Bill (N)" section for field roles
 * (`isDashboardTeamReadyToBillRole`): team-assigned jobs from RPC
 * `list_ready_to_bill_assigned_jobs_for_dashboard` — a third, distinct "Ready
 * to Bill" from the billing-invoice pipeline's two (quirk #5; heading
 * preserved exactly). Render + `CollectPaymentModal` (single opener: the
 * subcontractor-like Collect Payment buttons on these rows) moved verbatim
 * from `src/pages/Dashboard.tsx` (extraction-series refactor; no behavior
 * change). Data stays in the parent's `useDashboardAssignedJobs` seam.
 *
 * Self-gates on `isDashboardTeamReadyToBillRole(role)`; the parent renders it
 * unconditionally at the section's position.
 */
export function DashboardTeamReadyToBillSection({
  role,
  isMobile,
  narrowViewport660,
  assignedReadyToBillJobs,
  assignedReadyToBillLoading,
  refreshAssignedReadyToBill,
  leaveReportReminderForJobRow,
  openJobDetailFromDashboardJobRow,
  setViewReportsJob,
  setLeaveReportJob,
  setSubcontractorJobActivityModalJob,
}: DashboardTeamReadyToBillSectionProps) {
  const [assignedReadyToBillExpanded, setAssignedReadyToBillExpanded] = useState(true)
  const [collectPaymentJob, setCollectPaymentJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    buttonVariant?: string | null
  } | null>(null)

  return (
    <>
      {isDashboardTeamReadyToBillRole(role) && (assignedReadyToBillLoading || assignedReadyToBillJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setAssignedReadyToBillExpanded((prev) => !prev)}
            aria-expanded={assignedReadyToBillExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: assignedReadyToBillExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{assignedReadyToBillExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
              Ready to Bill ({assignedReadyToBillJobs.length})
            </h2>
          </button>
          {assignedReadyToBillExpanded && (assignedReadyToBillLoading && assignedReadyToBillJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {assignedReadyToBillJobs.map((j) => (
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
                        aria-label={`Job details: ${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || '—'}`}
                        style={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--text-strong)',
                          width: 'fit-content',
                        }}
                      >
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                      {isSubcontractorLikeRole(role) && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Job: {labelJobsLedgerStatusForDashboard(j.status)}
                        </div>
                      )}
                      {isSubcontractorLikeRole(role) && narrowViewport660 && j.created_at && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }} title="Time since job created">
                          Open {formatTimeSince(j.created_at)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                          {j.job_pictures_link?.trim() && (
                            <span style={{ display: 'inline-flex', padding: '0.35rem' }}>
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
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View<br />Reports
                          </button>
                        </>
                      )}
                      {role === 'superintendent' && (
                        <button
                          type="button"
                          onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                        >
                          View<br />Reports
                        </button>
                      )}
                      {isSubcontractorLikeRole(role) && !isMobile && (() => {
                        const b = subcontractorLastActivityBlock(j)
                        return (
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
                            {b.line3 != null ? (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                                aria-label={`What last activity means and recent history for ${j.job_name ?? 'this job'}`}
                              >
                                {b.line3}
                              </button>
                            ) : null}
                          </div>
                        )
                      })()}
                      {canLeaveJobFieldReport(role) && (
                        <DashboardLeaveReportButton
                          showReminder={leaveReportReminderForJobRow(j)}
                          onClick={() =>
                            setLeaveReportJob({
                              id: j.id,
                              hcpNumber: j.hcp_number ?? '—',
                              jobName: j.job_name ?? '—',
                              jobAddress: j.job_address ?? '—',
                            })
                          }
                        />
                      )}
                      {isSubcontractorLikeRole(role) && (
                        <button
                          type="button"
                          onClick={() =>
                            setCollectPaymentJob({
                              id: j.id,
                              hcpNumber: j.hcp_number ?? '—',
                              jobName: j.job_name ?? '—',
                              buttonVariant: j.collect_payment_button_variant ?? 'default',
                            })
                          }
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            borderRadius: 4,
                            cursor: 'pointer',
                            ...((j.collect_payment_button_variant ?? 'default') === 'ready_terminal'
                              ? {
                                  background: '#15803d',
                                  color: '#ffffff',
                                  border: '1px solid #15803d',
                                  fontWeight: 600,
                                }
                              : (j.collect_payment_button_variant ?? 'default') === 'pending_dispatch'
                                ? {
                                    background: 'var(--bg-amber-tint)',
                                    color: 'var(--text-amber-700)',
                                    border: '1px solid #f59e0b',
                                    fontWeight: 500,
                                  }
                                : {
                                    background: 'var(--surface)',
                                    color: 'var(--text-link)',
                                    border: '1px solid #2563eb',
                                  }),
                          }}
                        >
                          {(j.collect_payment_button_variant ?? 'default') === 'pending_dispatch' ? (
                            <>
                              Collect<br />
                              Payment (pending)
                            </>
                          ) : (
                            <>
                              Collect<br />Payment
                            </>
                          )}
                        </button>
                      )}
                      {j.created_at && (!isSubcontractorLikeRole(role) || !narrowViewport660) && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                          <>Open<br />{formatTimeSince(j.created_at)}</>
                        </span>
                      )}
                      {isSubcontractorLikeRole(role) && isMobile && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {(() => {
                            const m = subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                            if (!m.clickable) {
                              return (
                                <span title={m.title} aria-label={m.aria} style={{ lineHeight: 1.25 }}>
                                  {m.text}
                                </span>
                              )
                            }
                            return (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                title={m.title}
                                aria-label={m.aria}
                                style={{ lineHeight: 1.25 }}
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                              >
                                {m.text}
                              </button>
                            )
                          })()}
                        </div>
                      )}
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
                        background: '#ede9fe',
                        color: '#6d28d9',
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
          ))}
        </div>
      )}
      {collectPaymentJob ? (
        <CollectPaymentModal
          open
          onClose={() => setCollectPaymentJob(null)}
          jobId={collectPaymentJob.id}
          hcpNumber={collectPaymentJob.hcpNumber}
          jobName={collectPaymentJob.jobName}
          initialFlowStatus={
            collectPaymentJob.buttonVariant === 'ready_terminal'
              ? 'approved_for_terminal'
              : collectPaymentJob.buttonVariant === 'pending_dispatch'
                ? 'pending_dispatch'
                : null
          }
          onFlowChanged={refreshAssignedReadyToBill}
          stripeModeForBilling={stripeModeForBillingFromRole(role)}
        />
      ) : null}
    </>
  )
}
