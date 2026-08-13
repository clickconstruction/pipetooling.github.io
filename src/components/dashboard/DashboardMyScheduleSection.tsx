import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CallCustomerModal from './CallCustomerModal'
import { supabase } from '../../lib/supabase'
import { computeJobPctToday, type JobPctToday, type PctNoteRow } from '../../lib/jobPctDayDelta'
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
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { DashboardAddJobToMyScheduleModal } from './DashboardAddJobToMyScheduleModal'
import { DashboardMyDayEditorModal } from './DashboardMyDayEditorModal'
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
  /** Re-fetches the schedule engine after a self-schedule add/move/remove (v2.1568). */
  reloadSubSchedule?: () => void
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
/**
 * Current % done + today's movement for the schedule's jobs (v2.1567).
 * Self-contained: two small queries over the handful of scheduled job ids.
 * The baseline comes from "N% complete" thread notes; roles whose RLS hides
 * those notes just get the % with no delta line. Failures render nothing —
 * this layer is additive.
 */
function useMyScheduleJobPct(jobIds: string[], todayYmd: string): ReadonlyMap<string, JobPctToday> {
  const [pctToday, setPctToday] = useState<ReadonlyMap<string, JobPctToday>>(() => new Map())
  const idsKey = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])
  useEffect(() => {
    const ids = idsKey === '' ? [] : idsKey.split(',')
    if (ids.length === 0) {
      setPctToday(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const [jobsRes, notesRes] = await Promise.all([
        supabase.from('jobs_ledger').select('id, pct_complete, status').in('id', ids),
        supabase
          .from('jobs_ledger_thread_notes')
          .select('job_id, body, created_at')
          .in('job_id', ids)
          .like('body', '%\\% complete%'),
      ])
      if (cancelled || jobsRes.error) return
      const jobsById = new Map(
        ((jobsRes.data ?? []) as { id: string; pct_complete: number | null; status: string | null }[]).map((j) => [
          j.id,
          { pct: j.pct_complete, status: j.status },
        ]),
      )
      const notes = (notesRes.error ? [] : ((notesRes.data ?? []) as PctNoteRow[]))
      setPctToday(computeJobPctToday(jobsById, notes, todayYmd))
    })()
    return () => {
      cancelled = true
    }
  }, [idsKey, todayYmd])
  return pctToday
}

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
  reloadSubSchedule,
}: DashboardMyScheduleSectionProps) {
  const jobDetailModal = useJobDetailModal()
  const { user: authUser } = useAuth()
  const [addJobOpen, setAddJobOpen] = useState(false)
  const [myDayOpen, setMyDayOpen] = useState(false)
  const allMyBlocks = useMemo(
    () => [...subScheduleDayPartition.todayBlocks, ...subScheduleDayPartition.tomorrowBlocks],
    [subScheduleDayPartition],
  )
  /** Call-customer modal (mis-click guard + call notes) — see CallCustomerModal. */
  const [callModal, setCallModal] = useState<{ phone: string; jobId: string; jobLabel: string } | null>(null)
  const scheduleJobIds = useMemo(
    () =>
      [...subScheduleDayPartition.todayBlocks, ...subScheduleDayPartition.tomorrowBlocks]
        .map((b) => b.job_id)
        .filter((id): id is string => id != null),
    [subScheduleDayPartition],
  )
  const pctTodayByJobId = useMyScheduleJobPct(scheduleJobIds, subScheduleDayPartition.todayYmd)

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
                border: 'none',
                // Matches the header's dispatch task button (v2.1557).
                background: '#0ea5e9',
                color: 'white',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* v2.1568: self-scheduling — search any active job and put it on your day. */}
          <button
            type="button"
            onClick={() => setAddJobOpen(true)}
            style={{
              padding: '0.25rem 0.8rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              border: '1px solid #2563eb',
              borderRadius: 999,
              background: 'transparent',
              color: 'var(--text-link)',
              cursor: 'pointer',
            }}
          >
            + Add job
          </button>
          {allMyBlocks.length > 0 ? (
            <button
              type="button"
              onClick={() => setMyDayOpen(true)}
              title="Rearrange my schedule"
              aria-label="Rearrange my schedule"
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.8125rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✎
            </button>
          ) : null}
          <Link to="/calendar" style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
            Calendar →
          </Link>
        </div>
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
                      // Bid-anchored blocks (v2.1613): no job affordances (detail,
                      // call, pictures, reports, %) — just the labeled visit.
                      const blockJobId = b.job_id
                      const anchorId = blockJobId ?? `bid:${b.bid_id ?? ''}`
                      const rowLabel = subScheduleLabels.get(anchorId) ?? (blockJobId == null ? 'Bid' : 'Job')
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
                        blockJobId != null ? subScheduleJobMeta.get(blockJobId) : undefined,
                      )
                      const prefillAddr = (jobMeta.job_address ?? '').trim() || null
                      const scheduleDetailPayload = blockJobId == null ? null : {
                        jobId: blockJobId,
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
                          onClick={() => {
                            if (!scheduleDetailPayload) return
                            jobDetailModal?.openJobDetail({
                              ...scheduleDetailPayload,
                              assignedJobsRows: detailModalAssignedJobsRows,
                            })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              if (!scheduleDetailPayload) return
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
                              {/* v2.1556: the window never wraps — overflow beats "12:00\nPM". */}
                              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
                                {scheduleFormatWindow(b.time_start, b.time_end)}
                                {authUser?.id && b.created_by === authUser.id ? (
                                  <span
                                    style={{
                                      marginLeft: '0.4rem',
                                      fontSize: '0.625rem',
                                      fontWeight: 600,
                                      color: 'var(--text-green-600)',
                                      border: '1px solid var(--border-green)',
                                      borderRadius: 999,
                                      padding: '0.05rem 0.4rem',
                                      verticalAlign: '1px',
                                    }}
                                  >
                                    added by you
                                  </span>
                                ) : null}
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
                                const phone = blockJobId != null ? (subSchedulePhones.get(blockJobId) ?? '').trim() : ''
                                if (!phone || blockJobId == null) return null
                                return (
                                  <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Mis-click guard: open the Call modal (big tel target + call notes) instead of dialing immediately.
                                    setCallModal({ phone, jobId: blockJobId, jobLabel: rowLabel })
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
                              {blockJobId != null ? (
                              <DashboardJobPicturesLinkRow
                                layout="inline"
                                size="large"
                                jobPicturesLink={jobMeta.job_pictures_link}
                                onMissingClick={() =>
                                  void submitLinkJobPicturesDispatchRequest({
                                    jobId: blockJobId,
                                    hcpNumber: jobMeta.hcp_number,
                                    jobName: fromAssigned?.job_name ?? rowLabel,
                                    jobAddress: jobMeta.job_address,
                                  })
                                }
                              />
                              ) : null}
                              {(() => {
                                // v2.1591: the % stack is ANCHORED directly under the
                                // Leave Report button (owner request) — riding the
                                // address line put it at a varying distance whenever
                                // the title wrapped.
                                const pctInfo = blockJobId != null ? pctTodayByJobId.get(blockJobId) : undefined
                                const delta = pctInfo?.delta ?? null
                                const pctStack = pctInfo ? (
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.15 }}>
                                      {pctInfo.pct}%
                                      <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}> done</span>
                                    </div>
                                    {delta != null ? (
                                      <div
                                        style={{
                                          fontSize: '0.6875rem',
                                          fontWeight: 600,
                                          color:
                                            delta > 0
                                              ? 'var(--text-green-600)'
                                              : delta < 0
                                                ? 'var(--text-amber-800)'
                                                : 'var(--text-faint)',
                                        }}
                                      >
                                        {delta > 0 ? `▲ ${delta} today` : delta < 0 ? `▼ ${-delta} today` : 'no change today'}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null
                                const reportButton = canLeaveJobFieldReport(role) && blockJobId != null ? (
                                  <DashboardLeaveReportButton
                                    showReminder={reminderDue}
                                    reportCount={(blockJobId != null ? reportCountByJobId?.[blockJobId] : undefined) ?? 0}
                                    onViewReports={
                                      setViewReportsJob
                                        ? () =>
                                            setViewReportsJob({
                                              id: blockJobId,
                                              hcpNumber: effectiveJobLedgerNumber(jobMeta.hcp_number, jobMeta.click_number) || '—',
                                              jobName: fromAssigned?.job_name ?? rowLabel,
                                              jobAddress: jobMeta.job_address ?? '—',
                                            })
                                        : undefined
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setLeaveReportJob({
                                        id: blockJobId,
                                        hcpNumber: effectiveJobLedgerNumber(jobMeta.hcp_number, jobMeta.click_number) || '—',
                                        jobName: fromAssigned?.job_name ?? rowLabel,
                                        jobAddress: jobMeta.job_address ?? '—',
                                      })
                                    }}
                                  />
                                ) : null
                                if (!reportButton && !pctStack) return null
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    {reportButton}
                                    {pctStack}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                          {/* Full-width job number + zip-less address line (v2.1548);
                              the % done stack moved up under the Leave Report button (v2.1591). */}
                          {(() => {
                            const num = splitScheduleRowLabel(rowLabel).jobNumber
                            const addr = stripAddressZip(jobMeta.job_address ?? '')
                            if (!num && !addr) return null
                            return (
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-muted)',
                                  wordBreak: 'break-word',
                                  marginTop: '0.35rem',
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
                          {/* Progress bar (v2.1567) — only on days the job actually
                              moved: blue = where it started, green = today's gain
                              (amber tail = a downward correction). */}
                          {(() => {
                            const pctInfo = blockJobId != null ? pctTodayByJobId.get(blockJobId) : undefined
                            const delta = pctInfo?.delta ?? null
                            if (!pctInfo || delta == null || delta === 0) return null
                            const clamp = (n: number) => Math.max(0, Math.min(100, n))
                            const baseWidth = clamp(delta > 0 ? pctInfo.pct - delta : pctInfo.pct)
                            const changeWidth = clamp(Math.abs(delta))
                            return (
                              <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-muted)' }}>
                                  <span style={{ width: `${baseWidth}%`, background: '#3b82f6' }} />
                                  <span style={{ width: `${changeWidth}%`, background: delta > 0 ? '#16a34a' : '#d97706' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginTop: 2 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{pctInfo.pct}% done</span>
                                  <span style={{ fontWeight: 600, color: delta > 0 ? 'var(--text-green-600)' : 'var(--text-amber-800)' }}>
                                    {delta > 0 ? `▲ ${delta} today` : `▼ ${-delta} today`}
                                  </span>
                                </div>
                              </div>
                            )
                          })()}
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
      {addJobOpen ? (
        <DashboardAddJobToMyScheduleModal
          todayYmd={subScheduleDayPartition.todayYmd}
          tomorrowYmd={subScheduleDayPartition.tomorrowYmd}
          myBlocks={allMyBlocks}
          blockLabels={subScheduleLabels}
          onClose={() => setAddJobOpen(false)}
          onSaved={() => reloadSubSchedule?.()}
        />
      ) : null}
      {myDayOpen && authUser?.id ? (
        <DashboardMyDayEditorModal
          authUserId={authUser.id}
          blocks={allMyBlocks}
          blockLabels={subScheduleLabels}
          onClose={() => setMyDayOpen(false)}
          onSaved={() => reloadSubSchedule?.()}
        />
      ) : null}
    </div>
  )
}
