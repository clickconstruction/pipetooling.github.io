import type { Dispatch, SetStateAction } from 'react'
import { useRef, useState } from 'react'
import CallCustomerModal from './CallCustomerModal'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import { useJobCustomerPhones } from '../../hooks/useJobCustomerPhones'
import { submitAddJobPhoneDispatchRequestForJob } from '../../lib/addJobPhoneDispatchRequest'
import { useToastContext } from '../../contexts/ToastContext'

import { Link } from 'react-router-dom'
import { useAuth, type UserRole } from '../../hooks/useAuth'
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
  JobRowCallButton,
  JobRowMissingPhoneButton,
  JOB_ROW_LINK_ICON_STYLE,
  JOB_ROW_MOBILE_ICON_BUTTON_STYLE,
  JOB_ROW_PICTURES_ICON_WRAP_STYLE,
  JOB_ROW_REPORT_CHIP_STYLE,
  JobPlansGlyph,
  ReportFileGlyph,
  jobCardMobileActionButtonStyle,
  jobCardMobileStyle,
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
  reportCountByJobId,
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
  /** Reports visible to this user per job (Leave Report corner badge, v2.1547). */
  reportCountByJobId?: Record<string, number>
  setLeaveReportJob: (v: { id: string; hcpNumber: string; jobName: string; jobAddress: string } | null) => void
  setReadyForBillingJob: (v: { id: string; hcpNumber: string; jobName: string } | null) => void
  setReadyForBillingChecked1: (v: boolean) => void
  setReadyForBillingChecked2: (v: boolean) => void
  jobStatusUpdatingId: string | null
  formatDatetime: (iso: string) => string
}) {
  // v2.1006: phone icon -> CallCustomerModal (mis-click guard + call notes) on every row with a customer phone.
  const { phones, loaded: phonesLoaded } = useJobCustomerPhones(assignedJobs.map((j) => j.id))
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [callModal, setCallModal] = useState<{ phone: string; jobId: string; jobLabel: string } | null>(null)
  /** Header search button (v2.1550): expands the card, then focuses + scrolls the search box to the top. */
  const [searchExpandKey, setSearchExpandKey] = useState(0)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const openSearch = () => {
    setSearchExpandKey((k) => k + 1)
    window.setTimeout(() => {
      const el = searchInputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 60)
  }
  return (
    <>
        <DashboardGroupCard
          id="dash-assigned-jobs"
          title={`Assigned Jobs (${assignedJobs.length})`}
          collapseStorageKey="dash-assigned-jobs-collapsed"
          defaultCollapsed
          expandRequestKey={searchExpandKey}
          headerRight={
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search assigned jobs"
              title="Search assigned jobs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                margin: '-8px 0',
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-link)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {/* Icon: Font Awesome Free 6.x — magnifying-glass (OFL/CC-BY) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={18} height={18} fill="currentColor" aria-hidden focusable={false}>
                <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
              </svg>
            </button>
          }
        >
          {assignedJobsLoading && assignedJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              <input
                ref={searchInputRef}
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
                  scrollMarginTop: 8,
                }}
              />
              {filteredAssignedJobs.length === 0 && assignedJobsSearch.trim() !== '' && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.75rem 0 0.25rem' }}>
                  No assigned jobs match your search.
                </p>
              )}
              {filteredAssignedJobs.map((j, idx) => {
                const reminderDue = leaveReportReminderForJobRow(j)
                const rowReportCount = reportCountByJobId?.[j.id] ?? 0
                const openViewReports = () =>
                  setViewReportsJob({
                    id: j.id,
                    hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                    jobName: j.job_name ?? '—',
                    jobAddress: j.job_address ?? '—',
                  })
                return (
                <div
                  key={j.id}
                  style={
                    isMobile
                      ? // v2.2067: bordered card on phones (My Schedule idiom) — the
                        // amber rail carries Report due even before you reach the button.
                        jobCardMobileStyle(reminderDue)
                      : {
                          padding: '0.85rem 0',
                          borderBottom: idx < filteredAssignedJobs.length - 1 ? '1px solid var(--border)' : 'none',
                        }
                  }
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
                          <CustomerContactCardIcon size={13} style={{ flexShrink: 0 }} />
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
                    {isMobile ? (
                      /* v2.2067 mobile card: uniform 42px utility buttons + labeled
                         report chip on one row, full-width 44px actions on the next,
                         quiet meta footer. Desktop keeps the flex-wrap row below. */
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          {phones.get(j.id) ? (
                            <JobRowCallButton
                              boxed
                              phone={phones.get(j.id)!}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCallModal({ phone: phones.get(j.id)!, jobId: j.id, jobLabel: `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${j.job_name || '—'}` })
                              }}
                            />
                          ) : phonesLoaded ? (
                            <JobRowMissingPhoneButton
                              boxed
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
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={JOB_ROW_MOBILE_ICON_BUTTON_STYLE}
                            >
                              <DriveLinkGlyph />
                            </a>
                          )}
                          {j.job_pictures_link?.trim() && (
                            <span style={JOB_ROW_MOBILE_ICON_BUTTON_STYLE}>
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
                              style={JOB_ROW_MOBILE_ICON_BUTTON_STYLE}
                            >
                              <JobPlansGlyph />
                            </a>
                          )}
                          <span style={{ flex: 1 }} />
                          {rowReportCount > 0 && (
                            <button
                              type="button"
                              onClick={openViewReports}
                              aria-label={`View ${rowReportCount} ${rowReportCount === 1 ? 'report' : 'reports'} for this job`}
                              style={JOB_ROW_REPORT_CHIP_STYLE}
                            >
                              <ReportFileGlyph />
                              {rowReportCount > 99 ? '99+' : rowReportCount} {rowReportCount === 1 ? 'report' : 'reports'}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                          {canLeaveJobFieldReport(role) && (
                            <DashboardLeaveReportButton
                              grow
                              singleLine
                              showReminder={reminderDue}
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
                          {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary' || role === 'superintendent') && (
                            <button type="button" onClick={openViewReports} style={jobCardMobileActionButtonStyle('ghost')}>
                              View Reports
                            </button>
                          )}
                          {role !== 'helpers' && (
                            <button
                              type="button"
                              onClick={() => {
                                setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' })
                                setReadyForBillingChecked1(false)
                                setReadyForBillingChecked2(false)
                              }}
                              disabled={jobStatusUpdatingId === j.id}
                              style={jobCardMobileActionButtonStyle('ghost', jobStatusUpdatingId === j.id)}
                            >
                              {jobStatusUpdatingId === j.id ? '…' : 'Send to Billing'}
                            </button>
                          )}
                        </div>
                        <div style={{ marginTop: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-faint)', lineHeight: 1.35 }}>
                          {isSubcontractorLikeRole(role) ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.4rem' }}>
                              {j.created_at && (
                                <span title="Time since job created">Open {formatOpenAgeShort(j.created_at)}{' ·'}</span>
                              )}
                              {(() => {
                                const m = subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                                if (!m.clickable) {
                                  return (
                                    <span title={m.title} aria-label={m.aria}>
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
                                    style={{ lineHeight: 1.35, textAlign: 'left' }}
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
                          ) : j.created_at ? (
                            <span title="Time since job created">Open {formatTimeSince(j.created_at)}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                    )}
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
                )
              })}
            </div>
          )}
        </DashboardGroupCard>
      {callModal ? (
        <CallCustomerModal phone={callModal.phone} jobId={callModal.jobId} jobLabel={callModal.jobLabel} onClose={() => setCallModal(null)} />
      ) : null}
    </>
  )
}
