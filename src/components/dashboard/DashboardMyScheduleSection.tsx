import { Link } from 'react-router-dom'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { scheduleFormatWeekdayLong, scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { sortSubScheduleBlocksByStart, type SubScheduleDayPartition } from '../../lib/dashboardSubSchedule'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
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
  setLeaveReportJob: (job: {
    id: string
    hcpNumber: string
    jobName: string
    jobAddress: string
  }) => void
}

/**
 * Dashboard "My Schedule" section (subcontractor-like roles): today/tomorrow
 * schedule blocks with call-dispatch header, customer-call buttons,
 * pictures-link row, and Leave Report buttons. Render moved verbatim from
 * `src/pages/Dashboard.tsx` (extraction-series refactor; no behavior change);
 * the data engine stays in the parent via `useDashboardSubSchedule` because
 * its rows also drive the job-row sections' leave-report reminders.
 *
 * Self-gates on `isSubcontractorLikeRole(role)`; the parent renders it
 * unconditionally at the section's position.
 */
export function DashboardMyScheduleSection({
  role,
  firstAssistantDispatchPhone,
  subScheduleLoading,
  subScheduleDayPartition,
  subScheduleLabels,
  subSchedulePhones,
  leaveReportReminderForJobRow,
  assignedJobs,
  assignedReadyToBillJobs,
  detailModalAssignedJobsRows,
  submitLinkJobPicturesDispatchRequest,
  setLeaveReportJob,
}: DashboardMyScheduleSectionProps) {
  const jobDetailModal = useJobDetailModal()

  if (!isSubcontractorLikeRole(role)) return null

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '0.5rem', minWidth: 0 }}>
          {firstAssistantDispatchPhone ? (
            <a
              href={`tel:${firstAssistantDispatchPhone.telHref}`}
              style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}
              aria-label={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
              title={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
            >
              <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>My Schedule</h2>
            </a>
          ) : (
            <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>My Schedule</h2>
          )}
          {firstAssistantDispatchPhone && (
            <a
              href={`tel:${firstAssistantDispatchPhone.telHref}`}
              style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1.15, whiteSpace: 'nowrap' }}
              aria-label={`Schedule wrong? Click to call dispatch at ${firstAssistantDispatchPhone.display}`}
              title={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
            >
              (schedule wrong?<br />click to call dispatch)
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
                    {scheduleFormatWeekdayLong(ymd)}
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
                      const prefillAddr = (fromAssigned?.job_address ?? '').trim() || null
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
                                  {rowLabel}
                                </span>
                                {(() => {
                                  const phone = (subSchedulePhones.get(b.job_id) ?? '').trim()
                                  if (!phone) return null
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openInExternalBrowser(`tel:${phone}`)
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
                                        width={16}
                                        height={16}
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
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {scheduleFormatWindow(b.time_start, b.time_end)}
                              </div>
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
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexShrink: 0,
                              }}
                            >
                              <DashboardJobPicturesLinkRow
                                layout="inline"
                                size="large"
                                jobPicturesLink={fromAssigned?.job_pictures_link}
                                onMissingClick={() =>
                                  void submitLinkJobPicturesDispatchRequest({
                                    jobId: b.job_id,
                                    hcpNumber: fromAssigned?.hcp_number,
                                    jobName: fromAssigned?.job_name ?? rowLabel,
                                    jobAddress: fromAssigned?.job_address,
                                  })
                                }
                              />
                              {canLeaveJobFieldReport(role) ? (
                                <DashboardLeaveReportButton
                                  showReminder={
                                    fromAssigned ? leaveReportReminderForJobRow(fromAssigned) : false
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setLeaveReportJob({
                                      id: b.job_id,
                                      hcpNumber: fromAssigned?.hcp_number ?? '—',
                                      jobName: fromAssigned?.job_name ?? rowLabel,
                                      jobAddress: fromAssigned?.job_address ?? '—',
                                    })
                                  }}
                                />
                              ) : null}
                            </div>
                          </div>
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
    </div>
  )
}
