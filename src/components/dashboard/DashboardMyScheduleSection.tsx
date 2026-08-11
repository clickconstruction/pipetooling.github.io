import { useState } from 'react'
import { Link } from 'react-router-dom'
import CallCustomerModal from './CallCustomerModal'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { splitScheduleRowLabel, stripAddressZip } from '../../lib/dashboardScheduleCardLines'
import { scheduleFormatWeekdayShort, scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import {
  resolveSubScheduleJobMeta,
  sortSubScheduleBlocksByStart,
  type SubScheduleDayPartition,
  type SubScheduleJobMeta,
} from '../../lib/dashboardSubSchedule'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import type { UserRole } from '../../hooks/useAuth'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { DashboardLeaveReportButton } from './DashboardLeaveReportButton'

export type DashboardMyScheduleSectionProps = {
  role: UserRole | null
  /** From the parent's `useFirstAssistantDispatchPhone` hook. */
  firstAssistantDispatchPhone: { telHref: string; display: string } | null
  /** From the parent's `useDashboardSubSchedule` seam. */
  subScheduleLoading: boolean
  subScheduleDayPartition: SubScheduleDayPartition
  subScheduleLabels: Map<string, string>
  subSchedulePhones: Map<string, string | null>
  /**
   * Per-job fallback for schedule rows whose job is absent from both assigned
   * lists (billed/paid jobs — see `SubScheduleJobMeta`). Without it those rows
   * showed the red "no photos" button on jobs that already had a link.
   */
  subScheduleJobMeta: Map<string, SubScheduleJobMeta>
  leaveReportReminderForJobRow: (
    j: Pick<DashboardTeamAssignedJobRow, 'id' | 'my_last_report_at'>,
  ) => boolean
  /** Parent-owned assigned-job lists — read only, for labels/pictures-link/reminder lookups. */
  assignedJobs: DashboardTeamAssignedJobRow[]
  assignedReadyToBillJobs: DashboardTeamAssignedJobRow[]
  /** Parent memo `[...assignedJobs, ...assignedReadyToBillJobs]`, shared with the job-row detail opener. */
  detailModalAssignedJobsRows: DashboardTeamAssignedJobRow[]
  /** Shared with the Team Ready to Bill rows — stays in the parent. */
  submitLinkJobPicturesDispatchRequest: (args: {
    jobId: string
    hcpNumber: string | null | undefined
    jobName: string | null | undefined
    jobAddress: string | null | undefined
  }) => Promise<void>
  /** Opener for the shared `AdditionalReportModal` (`leaveReportJob` state in the parent). */
  /** Reports visible to this user per job (Leave Report corner badge, v2.1547). */
  reportCountByJobId?: Record<string, number>
  /** Opens the job's reports list from the corner badge. */
  setViewReportsJob?: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
  setLeaveReportJob: (job: {
    id: string
    hcpNumber: string
    jobName: string
    jobAddress: string
  }) => void
}

/**
 * Dashboard "My Schedule" section (all roles since v2.782; previously
 * subcontractor-like only): today/tomorrow schedule blocks with call-dispatch
 * header, customer-call buttons, pictures-link row, and Leave Report buttons.
 * The data engine stays in the parent via `useDashboardSubSchedule` because
 * its rows also drive the job-row sections' leave-report reminders.
 *
 * The parent renders it unconditionally at the section's position; `id`
 * carries the section-dock anchor. The root is a bordered card whose styles
 * mirror `DashboardGroupCard` (custom header keeps it from using the wrapper).
 */
export function DashboardMyScheduleSection({
  role,
  firstAssistantDispatchPhone,
  subScheduleLoading,
  subScheduleDayPartition,
  subScheduleLabels,
  subSchedulePhones,
  subScheduleJobMeta,
  leaveReportReminderForJobRow,
  assignedJobs,
  assignedReadyToBillJobs,
  detailModalAssignedJobsRows,
  submitLinkJobPicturesDispatchRequest,
  reportCountByJobId,
  setViewReportsJob,
  setLeaveReportJob,
}: DashboardMyScheduleSectionProps) {
  const jobDetailModal = useJobDetailModal()
  /** Call-customer modal (mis-click guard + call notes) — see CallCustomerModal. */
  const [callModal, setCallModal] = useState<{ phone: string; jobId: string; jobLabel: string } | null>(null)

  return (
    <div
      id="dash-my-schedule"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
        // No marginTop (v2.1481): the quick row above already carries a 16px
        // bottom margin, and stacking 1rem on top of it made the gap above
        // this card ~2× the 1rem gap below it (user-reported on mobile).
        marginBottom: '1rem',
        scrollMarginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '0.6rem', minWidth: 0 }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>My Schedule</h2>
          {/* v2.1553: the two-line "(schedule wrong? click to call dispatch)"
              parenthetical becomes one round phone button beside the title. */}
          {firstAssistantDispatchPhone && (
            <a
              href={`tel:${firstAssistantDispatchPhone.telHref}`}
              aria-label={`Schedule wrong? Call dispatch at ${firstAssistantDispatchPhone.display}`}
              title={`Schedule wrong? Call dispatch at ${firstAssistantDispatchPhone.display}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text-link)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              {/* Icon: Font Awesome Free 7.x — phone (OFL/CC-BY), shared with the card call buttons. */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={14} height={14} aria-hidden focusable={false}>
                <path
                  fill="currentColor"
                  d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"
                />
              </svg>
            </a>
          )}
        </div>
        <Link to="/calendar" style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
          Calendar →
        </Link>
      </div>
      {subScheduleLoading ? (
        <DashboardListRowSkeleton rows={2} />
      ) : (
        <>
          {(['today', 'tomorrow'] as const).map((which) => {
            const ymd = which === 'today' ? subScheduleDayPartition.todayYmd : subScheduleDayPartition.tomorrowYmd
            const blocks =
              which === 'today' ? subScheduleDayPartition.todayBlocks : subScheduleDayPartition.tomorrowBlocks
            const dayTitle = which === 'today' ? 'Today' : 'Tomorrow'
            const sorted = sortSubScheduleBlocksByStart(blocks)
            return (
              <div key={which} style={{ marginBottom: which === 'today' ? '1.25rem' : 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-700)', textAlign: 'center' }}>
                  {dayTitle}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                    {scheduleFormatWeekdayShort(ymd)}
                  </span>
                </h3>
                {sorted.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.875rem', textAlign: 'center' }}>No blocks scheduled.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sorted.map((b) => {
                      const rowLabel = subScheduleLabels.get(b.job_id) ?? 'Job'
                      const fromAssigned =
                        assignedJobs.find((j) => j.id === b.job_id) ??
                        assignedReadyToBillJobs.find((j) => j.id === b.job_id)
                      // Report-due card treatment (v2.1549): amber rail + reason
                      // line on the card itself; replaces the old footer banner.
                      const reminderDue =
                        canLeaveJobFieldReport(role) &&
                        (fromAssigned ? leaveReportReminderForJobRow(fromAssigned) : false)
                      // Billed/paid scheduled jobs are in neither assigned list;
                      // the meta map carries their pictures link / HCP / address.
                      const jobMeta = resolveSubScheduleJobMeta(
                        fromAssigned,
                        subScheduleJobMeta.get(b.job_id),
                      )
                      const prefillAddr = (jobMeta.job_address ?? '').trim() || null
                      const scheduleDetailPayload = {
                        jobId: b.job_id,
                        prefillRowLabel: rowLabel,
                        prefillAddress: prefillAddr,
                        scheduleContext: {
                          workDate: b.work_date,
                          timeStart: b.time_start,
                          timeEnd: b.time_end,
                          note: b.note,
                        },
                      }
                      return (
                        <li
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            jobDetailModal?.openJobDetail({
                              ...scheduleDetailPayload,
                              assignedJobsRows: detailModalAssignedJobsRows,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              jobDetailModal?.openJobDetail({
                                ...scheduleDetailPayload,
                                assignedJobsRows: detailModalAssignedJobsRows,
                              })
                            }
                          }}
                          aria-label={`Job details: ${rowLabel}`}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid var(--border)',
                            borderLeft: reminderDue ? '3px solid #f2c230' : '1px solid var(--border)',
                            borderRadius: 8,
                            marginBottom: '0.5rem',
                            background: 'var(--surface)',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Card leads with the job NAME (v2.1548); the number moves to
                                  the full-width address line below. */}
                              <div
                                style={{
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {splitScheduleRowLabel(rowLabel).jobName}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {scheduleFormatWindow(b.time_start, b.time_end)}
                              </div>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexShrink: 0,
                              }}
                            >
                              {(() => {
                                const phone = (subSchedulePhones.get(b.job_id) ?? '').trim()
                                if (!phone) return null
                                return (
                                  <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Mis-click guard: open the Call modal (big tel target + call notes) instead of dialing immediately.
                                    setCallModal({ phone, jobId: b.job_id, jobLabel: rowLabel })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation()
                                    }
                                  }}
                                  aria-label={`Call customer at ${phone}`}
                                  title={`Call customer at ${phone}`}
                                  style={{
                                    flexShrink: 0,
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0.2rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-link)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    width="2.5em"
                                    height="2.5em"
                                    aria-hidden
                                    focusable={false}
                                    style={{ display: 'block' }}
                                  >
                                    <path
                                    fill="currentColor"
                                    d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"
                                    />
                                  </svg>
                                  </button>
                                )
                                })()}
                              <DashboardJobPicturesLinkRow
                                layout="inline"
                                size="large"
                                jobPicturesLink={jobMeta.job_pictures_link}
                                onMissingClick={() =>
                                  void submitLinkJobPicturesDispatchRequest({
                                    jobId: b.job_id,
                                    hcpNumber: jobMeta.hcp_number,
                                    jobName: fromAssigned?.job_name ?? rowLabel,
                                    jobAddress: jobMeta.job_address,
                                  })
                                }
                              />
                              {canLeaveJobFieldReport(role) ? (
                                <DashboardLeaveReportButton
                                  showReminder={reminderDue}
                                  reportCount={reportCountByJobId?.[b.job_id] ?? 0}
                                  onViewReports={
                                    setViewReportsJob
                                      ? () =>
                                          setViewReportsJob({
                                            id: b.job_id,
                                            hcpNumber: effectiveJobLedgerNumber(jobMeta.hcp_number, jobMeta.click_number) || '—',
                                            jobName: fromAssigned?.job_name ?? rowLabel,
                                            jobAddress: jobMeta.job_address ?? '—',
                                          })
                                      : undefined
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setLeaveReportJob({
                                      id: b.job_id,
                                      hcpNumber: effectiveJobLedgerNumber(jobMeta.hcp_number, jobMeta.click_number) || '—',
                                      jobName: fromAssigned?.job_name ?? rowLabel,
                                      jobAddress: jobMeta.job_address ?? '—',
                                    })
                                  }}
                                />
                              ) : null}
                            </div>
                          </div>
                          {/* Full-width job number + zip-less address line (v2.1548). */}
                          {(() => {
                            const num = splitScheduleRowLabel(rowLabel).jobNumber
                            const addr = stripAddressZip(jobMeta.job_address ?? '')
                            if (!num && !addr) return null
                            return (
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '0.35rem',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {num && addr ? `${num} · ${addr}` : num || addr}
                              </div>
                            )
                          })()}
                          {/* Dispatch note spans the full card width (v2.1545) — it used to
                              wrap inside the left column beside the icon stack. */}
                          {b.note?.trim() ? (
                            <div
                              style={{
                                fontSize: '0.8125rem',
                                color: 'var(--text-faint)',
                                marginTop: '0.35rem',
                                wordBreak: 'break-word',
                              }}
                            >
                              {b.note.trim()}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </>
      )}
      {callModal ? (
        <CallCustomerModal
          phone={callModal.phone}
          jobId={callModal.jobId}
          jobLabel={callModal.jobLabel}
          onClose={() => setCallModal(null)}
        />
      ) : null}
    </div>
  )
}
