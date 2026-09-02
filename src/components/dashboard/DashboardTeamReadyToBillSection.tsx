import { useState } from 'react'
import { Link } from 'react-router-dom'
import CollectPaymentModal from '../jobs/CollectPaymentModal'
import CallCustomerModal from './CallCustomerModal'
import { JobRowCallButton, JobRowMissingPhoneButton } from './dashboardJobRowShared'
import { useJobCustomerPhones } from '../../hooks/useJobCustomerPhones'
import { submitAddJobPhoneDispatchRequestForJob } from '../../lib/addJobPhoneDispatchRequest'
import { useToastContext } from '../../contexts/ToastContext'
import { DashboardGroupCard } from './DashboardGroupCard'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { isAssistantLike, isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatDatetime } from '../../lib/dashboardProjectsCard'
import { subcontractorLastActivityMobileLine } from '../../lib/subcontractorLastActivityCompact'
import { formatTimeSince } from '../../lib/dashboardJobRowActivity'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../../lib/dashboardTeamAssignedJobRow'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { effectivePctComplete } from '../../lib/jobs/effectivePctComplete'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { DashboardLeaveReportButton } from './DashboardLeaveReportButton'

export type DashboardTeamReadyToBillSectionProps = {
  role: UserRole | null
  isMobile: boolean
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
  /** Reports visible to this user per job (Leave Report corner badge, v2.1547). */
  reportCountByJobId?: Record<string, number>
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
  assignedReadyToBillJobs,
  assignedReadyToBillLoading,
  refreshAssignedReadyToBill,
  leaveReportReminderForJobRow,
  openJobDetailFromDashboardJobRow,
  setViewReportsJob,
  reportCountByJobId,
  setLeaveReportJob,
  setSubcontractorJobActivityModalJob,
}: DashboardTeamReadyToBillSectionProps) {
  // v2.1006: phone icon -> CallCustomerModal on rows with a customer phone.
  // v2.1024: no phone on file -> red phone that asks Dispatch to add one.
  const { phones, loaded: phonesLoaded } = useJobCustomerPhones(assignedReadyToBillJobs.map((j) => j.id))
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [callModal, setCallModal] = useState<{ phone: string; jobId: string; jobLabel: string } | null>(null)
  const [collectPaymentJob, setCollectPaymentJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    buttonVariant?: string | null
  } | null>(null)

  return (
    <>
      {isDashboardTeamReadyToBillRole(role) && (assignedReadyToBillLoading || assignedReadyToBillJobs.length > 0) && (
        <DashboardGroupCard
          id="dash-ready-to-bill"
          title={`Ready to Bill (${assignedReadyToBillJobs.length})`}
          collapseStorageKey="dash-ready-to-bill-collapsed"
        >
          {(assignedReadyToBillLoading && assignedReadyToBillJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {assignedReadyToBillJobs.map((j) => {
                // Document links (Drive / Pictures / Plans): part of the fixed icon
                // trio pinned top-right of the title at every width (v2.1570).
                const hasDocLinks = !!(
                  j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()
                )
                const docLinksCluster = hasDocLinks ? (
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
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
                ) : null
                return (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: isMobile ? '0.6rem 0.7rem' : '1rem',
                    marginBottom: '0.5rem',
                    background: 'var(--surface)',
                  }}
                >
                  {/* v2.1570 (mockup-approved): the My Schedule anatomy at EVERY width —
                      title with a fixed icon trio pinned top-right, address, ONE muted
                      meta line, then the action buttons as their own row. Nothing
                      wraps mid-cluster; the only responsive behavior is the action
                      row stretching on phones. */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
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
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                      {phones.get(j.id) ? (
                        <JobRowCallButton
                          phone={phones.get(j.id)!}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCallModal({ phone: phones.get(j.id)!, jobId: j.id, jobLabel: `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${j.job_name || '—'}` })
                          }}
                        />
                      ) : phonesLoaded ? (
                        <JobRowMissingPhoneButton
                          onClick={(e) => {
                            e.stopPropagation()
                            void submitAddJobPhoneDispatchRequestForJob(authUser?.id, showToast, {
                              jobId: j.id,
                              hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number),
                              jobName: j.job_name,
                              jobAddress: j.job_address,
                            })
                          }}
                        />
                      ) : null}
                      {docLinksCluster}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {j.job_address?.trim() ? (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                    ) : (
                      '—'
                    )}
                  </div>
                  {/* ONE muted meta line, all roles and widths: Open · % done · last
                      activity (the activity part stays clickable → job-activity
                      modal, sub-like + superintendent since v2.2635). */}
                  {(() => {
                    const staticText = [
                      j.created_at ? `Open ${formatTimeSince(j.created_at)}` : null,
                      // undefined = the RPC didn't return the column (pre-20260722266000
                      // deploys) — keep hiding; null = genuinely unset — read 0 via fallback.
                      j.pct_complete !== undefined ? `${effectivePctComplete(j.pct_complete, j.status ?? null)}% done` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    // Superintendents included since v2.2635 — the row data and the
                    // activity modal's RPC (team-membership gate) already work for
                    // them; only this render gate hid the clickable line.
                    const m = isSubcontractorLikeRole(role) || role === 'superintendent'
                      ? subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                      : null
                    const hasStatic = staticText.length > 0
                    const hasActivity = !!m?.textCompact
                    if (!hasStatic && !hasActivity) return null
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          rowGap: 0,
                          columnGap: '0.4rem',
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          marginTop: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {hasStatic && (
                          <span title="Time since job created · reported percent complete">{staticText}</span>
                        )}
                        {hasStatic && hasActivity && <span aria-hidden>·</span>}
                        {hasActivity &&
                          m &&
                          (m.clickable ? (
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
                          ) : (
                            <span title={m.title} aria-label={m.aria}>
                              {m.textCompact}
                            </span>
                          ))}
                      </div>
                    )
                  })()}
                  {/* Action row: right-aligned on desktop, stretched on phones. */}
                  <div style={{ display: 'flex', gap: isMobile ? '0.4rem' : '0.5rem', alignItems: 'center', justifyContent: isMobile ? 'stretch' : 'flex-end', marginTop: '0.6rem' }}>
                      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary' || role === 'superintendent') && (
                        <button
                          type="button"
                          onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', ...(isMobile ? { flex: 1 } : {}) }}
                        >
                          View Reports
                        </button>
                      )}
                      {/* Collect Payment before Leave Report (v2.994): the money action
                          leads on these subcontractor cards. */}
                      {isSubcontractorLikeRole(role) && (
                        <button
                          type="button"
                          title="Collect payment"
                          onClick={() =>
                            setCollectPaymentJob({
                              id: j.id,
                              hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                              jobName: j.job_name ?? '—',
                              buttonVariant: j.collect_payment_button_variant ?? 'default',
                            })
                          }
                          style={{
                            padding: isMobile ? '0.35rem 0.6rem' : '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            ...(isMobile ? { flex: 1 } : {}),
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
                          {(j.collect_payment_button_variant ?? 'default') === 'pending_dispatch'
                            ? 'Collect (pending)'
                            : 'Collect'}
                        </button>
                      )}
                      {canLeaveJobFieldReport(role) && (
                        <DashboardLeaveReportButton
                          singleLine
                          buttonTitle="Leave a field report"
                          showReminder={leaveReportReminderForJobRow(j)}
                          reportCount={reportCountByJobId?.[j.id] ?? 0}
                          onViewReports={() =>
                            setViewReportsJob({
                              id: j.id,
                              hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                              jobName: j.job_name ?? '—',
                              jobAddress: j.job_address ?? '—',
                            })
                          }
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
                )
              })}
            </div>
          ))}
        </DashboardGroupCard>
      )}
      {callModal ? (
        <CallCustomerModal phone={callModal.phone} jobId={callModal.jobId} jobLabel={callModal.jobLabel} onClose={() => setCallModal(null)} />
      ) : null}
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
