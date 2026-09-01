import { Fragment, type ReactNode } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatTimeSince } from '../../lib/jobs/jobFormatting'
import { stagesAddedStampLabel, type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import { jobBilledUnpaidDollars, stagesJobLevelStripeEmailedHintInvoice } from '../../lib/jobs/invoiceBilling'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { JobsStagesThreadPanel } from './JobsStagesThreadPanel'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { ShareJobButton } from './ShareJobButton'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { JobsStagesActivityBox } from './JobsStagesActivityBox'
import { useWideViewport1100 } from '../../hooks/useWideViewport1100'
import {
  accountManOnlyStripeStyle,
  renderJobAddressWithMap,
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesExpandedRowPanel,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
  renderStagesThreadFullscreenJobHeader,
  renderStagesJobCellActivityFooter as renderStagesJobCellActivityFooterWithCtx,
  renderStagesThreadExpandButton,
  renderStagesQuickActionsStack as renderStagesQuickActionsStackWithCtx,
  renderStagesProjectBannerRow,
  shouldSuppressStagesRowJobThreadToggle,
  stagesRowHasProjectBanner,
  STAGES_TABLE_MIN_WIDTH,
  STAGES_EDIT_MODE_RAIL_WIDTH,
  renderStagesEditModeRail,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages job-only section table (Waiting / Working / Paid in Full) — Jobs.tsx
 * decomposition step 9a (docs/JOBS_TABS_ARCHITECTURE.md "Section renderers").
 * Behavior-preserving move of the IIFE closure `renderStagesTable(jobList,
 * actionLabel, onAction, showTimeOpen?, onSendBack?, onSendBackSimple?,
 * showPctComplete?)`: the former parameters and every captured page value are
 * same-named props (wide prop list accepted for this step — the step-9b
 * JobsStagesTab becomes the single caller and absorbs most of them). The
 * quick-action stack's `navigate` + dispatch-task/checklist modal contexts are
 * consumed via their app-global hooks here instead of props.
 */
export type JobsStagesTableProps = {
  jobList: JobWithDetails[]
  /** Board sort mode (v2.1807): 'added' shows an "added <date>" stamp beside each job number. */
  stagesSortMode?: StagesBoardSortMode
  /** Follow-Up deck embed (v2.1740): the card names the columns' context itself, so skip the header row. */
  hideHeader?: boolean
  actionLabel: React.ReactNode | null
  onAction: (j: JobWithDetails) => void
  showTimeOpen?: boolean
  onSendBack?: (j: JobWithDetails) => void
  onSendBackSimple?: (j: JobWithDetails) => void
  showPctComplete?: boolean
  // --- captured page values (same names as in Jobs.tsx; step 9b's JobsStagesTab absorbs these) ---
  stagesJobFlashId: string | null
  /** ⋯ tools menu "Edit mode" (v2.1236): thin vertical EDIT rail on every job row → openEdit. */
  stagesEditMode: boolean
  renderStagesOpenDetailJobName: (j: JobWithDetails) => ReactNode
  stagesStatusUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesStatusUpdatingId']
  pctCompleteSavingId: ReturnType<typeof useJobsStagesMutations>['pctCompleteSavingId']
  updateJobPctComplete: ReturnType<typeof useJobsStagesMutations>['updateJobPctComplete']
  commitStagesPctWithNote: ReturnType<typeof useJobsStagesMutations>['commitStagesPctWithNote']
  setCreatePartialInvoiceAmount: (v: string) => void
  setCreatePartialInvoiceJob: (j: JobWithDetails | null) => void
  openEdit: (job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean; fixturesSectionHighlight?: boolean }) => void
  openStagesDetailJobModal: (j: JobWithDetails) => void
  setAiaG702StagesJob: (j: JobWithDetails | null) => void
  canCreateHazmatFee: boolean
  openHazmatFee: (j: JobWithDetails) => void
  /** Jobs with a live (non-voided) hazmat fee — their ☣ button wears a bright green box (v2.1040). */
  hazmatFeeJobIds?: ReadonlySet<string>
  canEditJobPctComplete: boolean
  canManageJobPeople: boolean
  setManageJobPeople: (v: { jobId: string; jobLabel: string; currentTeamUserIds: string[] } | null) => void
  jobThreadNotesLoadingId: ReturnType<typeof useJobThreadNotes>['jobThreadNotesLoadingId']
  jobThreadDraft: ReturnType<typeof useJobThreadNotes>['jobThreadDraft']
  jobThreadSubmittingId: ReturnType<typeof useJobThreadNotes>['jobThreadSubmittingId']
  setJobThreadDraft: ReturnType<typeof useJobThreadNotes>['setJobThreadDraft']
  submitJobThreadNote: ReturnType<typeof useJobThreadNotes>['submitJobThreadNote']
  /** Wide-screen Job activity box (v2.1587): body-based note submit + lazy activity loader. */
  submitJobThreadNoteWithBody?: ReturnType<typeof useJobThreadNotes>['submitJobThreadNoteWithBody']
  loadJobThreadNotesForJob?: ReturnType<typeof useJobThreadNotes>['loadJobThreadNotesForJob']
  authUser: ReturnType<typeof useAuth>['user']
  // --- shared row-render context inputs (navigate + the dispatch-task/checklist modals are consumed via hooks here) ---
  showToast: StagesRowRenderContext['showToast']
  customers: StagesRowRenderContext['customers']
  openEditJobAndCreateCustomerFlow: StagesRowRenderContext['openEditJobAndCreateCustomerFlow']
  stagesManHoursByJobId: StagesRowRenderContext['stagesManHoursByJobId']
  stagesManHoursLoading: StagesRowRenderContext['stagesManHoursLoading']
  stagesLaborBreakdownByJobId: StagesRowRenderContext['stagesLaborBreakdownByJobId']
  expandedJobThreadId: StagesRowRenderContext['expandedJobThreadId']
  toggleStagesJobThreadExpanded: StagesRowRenderContext['toggleStagesJobThreadExpanded']
  jobThreadStatsByJobId: StagesRowRenderContext['jobThreadStatsByJobId']
  jobThreadActivityByJobId: StagesRowRenderContext['jobThreadActivityByJobId']
  openJobThreadFullscreen: StagesRowRenderContext['openJobThreadFullscreen']
  openJobActivityExpand: StagesRowRenderContext['openJobActivityExpand']
  openJobCalendar: StagesRowRenderContext['openJobCalendar']
  stagesUpcomingByJobId: StagesRowRenderContext['stagesUpcomingByJobId']
  jobThreadFullscreen: boolean
  setJobThreadFullscreen: (v: boolean) => void
  applyStagesInvoiceFocus: StagesRowRenderContext['applyStagesInvoiceFocus']
  canOpenJobScheduleModal: StagesRowRenderContext['canOpenJobScheduleModal']
  setScheduleModalJob: StagesRowRenderContext['setScheduleModalJob']
  openQuickAssignForJob: StagesRowRenderContext['openQuickAssignForJob']
  /** Label for the send-back button(s); defaults to "Send back" (Working uses "Mark Waiting"). */
  sendBackLabel?: string
  authRole: StagesRowRenderContext['authRole']
  loadJobs: StagesRowRenderContext['loadJobs']
  onDevelopmentFilter?: StagesRowRenderContext['onDevelopmentFilter']
}

export default function JobsStagesTable(props: JobsStagesTableProps) {
  const {
    jobList,
    hideHeader,
    actionLabel,
    onAction,
    showTimeOpen,
    onSendBack,
    onSendBackSimple,
    showPctComplete,
    stagesJobFlashId,
    stagesEditMode,
    renderStagesOpenDetailJobName,
    stagesStatusUpdatingId,
    pctCompleteSavingId,
    updateJobPctComplete,
    commitStagesPctWithNote,
    openEdit,
    setAiaG702StagesJob,
    canCreateHazmatFee,
    openHazmatFee,
    hazmatFeeJobIds,
    canEditJobPctComplete,
    canManageJobPeople,
    setManageJobPeople,
    jobThreadNotesLoadingId,
    submitJobThreadNoteWithBody,
    loadJobThreadNotesForJob,
    authUser,
    showToast,
    customers,
    openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId,
    stagesManHoursLoading,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    openJobThreadFullscreen,
    openJobActivityExpand,
    openJobCalendar,
    stagesUpcomingByJobId,
    jobThreadFullscreen,
    setJobThreadFullscreen,
    applyStagesInvoiceFocus,
    canOpenJobScheduleModal,
    setScheduleModalJob,
    openQuickAssignForJob,
    sendBackLabel,
    authRole,
    loadJobs,
    onDevelopmentFilter,
  } = props
  const wideViewport = useWideViewport1100()
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()

  const customerProfileModal = useCustomerProfileModal()
  const jobHoursStoryModal = useJobHoursStoryModal()
  const stagesRowSharedCtx: StagesRowRenderContext = {
    openCustomerProfile: customerProfileModal?.openCustomerProfile,
    openJobHoursStory: jobHoursStoryModal?.openJobHoursStory,
    showToast,
    customers,
    openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId,
    stagesManHoursLoading,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    openJobThreadFullscreen,
    openJobActivityExpand,
    openJobCalendar,
    stagesUpcomingByJobId,
    applyStagesInvoiceFocus,
    canOpenJobScheduleModal,
    setScheduleModalJob,
    openQuickAssignForJob,
    navigate,
    authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs,
    onDevelopmentFilter,
  }
  const renderStagesFieldAndBillingLines = (job: JobWithDetails) =>
    renderStagesFieldAndBillingLinesWithCtx(stagesRowSharedCtx, job)
  const renderJobCustomerLine = (job: JobWithDetails) => renderJobCustomerLineWithCtx(stagesRowSharedCtx, job)
  const renderStagesJobCellActivityFooter = (job: JobWithDetails, billingLineForStripeHint?: JobsLedgerInvoice | null) =>
    renderStagesJobCellActivityFooterWithCtx(stagesRowSharedCtx, job, { billingLineForStripeHint })

  const renderStagesQuickActionsStack = (job: JobWithDetails) =>
    renderStagesQuickActionsStackWithCtx(stagesRowSharedCtx, job)

  const stagesTableColCount = 4
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
      {/* tableLayout: fixed (v2.967): column widths come from the colgroup, never from content
          measurement — lazy-loaded rows and search filtering used to re-measure auto layout and
          make the Job column jitter a few px. The two unspecified cols (Job, Activity) split the
          remaining width equally, so minWidth must exceed the colgroup's sized total
          (see STAGES_TABLE_MIN_WIDTH). */}
      <table style={{ width: '100%', minWidth: STAGES_TABLE_MIN_WIDTH, borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '9rem' }} />
          <col />
          <col style={{ width: '12rem' }} />
          <col style={{ width: 140 }} />
        </colgroup>
        {hideHeader ? null : (
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                borderBottom: '1px solid var(--border)',
                minWidth: '6.75rem',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>Crew &amp; Dates</span>
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
            <th
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                minWidth: '12rem',
              }}
            >
              Progress & payment
            </th>
            <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid var(--border)' }} />
          </tr>
        </thead>
        )}
        <tbody>
          {jobList.length === 0 ? (
            <tr>
              <td colSpan={stagesTableColCount} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                No jobs in this group
              </td>
            </tr>
          ) : (
            jobList.map((j) => (
              <Fragment key={j.id}>
              <tr
                data-stages-job-id={j.id}
                style={{
                  borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid var(--border-job-row)',
                  ...(stagesJobFlashId === j.id
                    ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                    : {}),
                }}
                onClick={(e) => {
                  if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                  toggleStagesJobThreadExpanded(j.id)
                }}
              >
                <td
                  style={{
                    padding: '0.75rem',
                    ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
                    position: 'relative',
                    verticalAlign: 'top',
                  }}
                >
                  {stagesEditMode ? renderStagesEditModeRail(j, openEdit) : null}
                  {/* v2.1530: the quick-action stack moved here from the Activity cell. */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                  {renderStagesQuickActionsStack(j)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                  {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' }, props.stagesSortMode === 'added' ? stagesAddedStampLabel(j.created_at) : null)}
                  {renderStagesFieldAndBillingLines(j)}
                  </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem', ...accountManOnlyStripeStyle(j) }}>
                  {/* Wide screens: identity keeps its natural width and the Job
                      activity box (v2.1587) absorbs the cell's dead middle. */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'wrap' }}>
                    {renderStagesOpenDetailJobName(j)}
                    {/* The activity box already carries the trail on wide screens —
                        the chevron+count beside the name is redundant there (v2.1588);
                        row click still expands the thread either way. */}
                    {!wideViewport ? renderStagesThreadExpandButton(stagesRowSharedCtx, j.id) : null}
                  </div>
                  {renderJobAddressWithMap(j.job_address)}
                  {renderJobCustomerLine(j)}
                  {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                  {renderStagesJobCellActivityFooter(j, stagesJobLevelStripeEmailedHintInvoice(j))}
                  </div>
                  {wideViewport ? (
                    <JobsStagesActivityBox
                      job={j}
                      ctx={stagesRowSharedCtx}
                      loadActivityForJob={loadJobThreadNotesForJob}
                      submitNoteWithBody={submitJobThreadNoteWithBody}
                    />
                  ) : null}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                  <StagesProgressPaymentCell
                    model={buildStagesMoneyBarModel({
                      totalBill: j.revenue != null ? Number(j.revenue) : null,
                      paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                      pctComplete: j.pct_complete ?? null,
                      billedUnpaid: jobBilledUnpaidDollars(j),
                    })}
                    pctComplete={j.pct_complete ?? null}
                    pctSaving={showPctComplete ? pctCompleteSavingId === j.id : undefined}
                    onPctCommit={showPctComplete ? (n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null) : undefined}
                    onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                  />
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {onSendBack && (
                          <button
                            type="button"
                            onClick={() => onSendBack(j)}
                            disabled={stagesStatusUpdatingId === j.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'none',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {sendBackLabel ?? 'Send back'}
                          </button>
                        )}
                        {onSendBackSimple && (
                          <button
                            type="button"
                            onClick={() => onSendBackSimple(j)}
                            disabled={stagesStatusUpdatingId === j.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'none',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {sendBackLabel ?? 'Send back'}
                          </button>
                        )}
                        {actionLabel && (
                          <button
                            type="button"
                            onClick={() => onAction(j)}
                            disabled={stagesStatusUpdatingId === j.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {stagesStatusUpdatingId === j.id ? '…' : actionLabel}
                          </button>
                        )}
                        {/* "Open N" sits right above Edit Job — same order the
                            billing stages use (owner call, v2.1690). */}
                        {showTimeOpen && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                            Open {formatTimeSince(j.created_at ?? null)}
                          </span>
                        )}
                      </div>
                      {/* marginTop tops the outer stack's 0.25rem gap up to the status
                          buttons' own 0.5rem rhythm — equal air above Edit Job (v2.1688). */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch', marginTop: '0.25rem' }}>
                        {/* One big Edit Job target (owner call, v2.1686) — replaces the
                            partial-invoice / Edit / Job detail icon trio. Job detail
                            stays a click away via the job name; partial invoicing
                            lives on the Bill tab (and the mobile card menu). */}
                        <button
                          type="button"
                          onClick={() => openEdit(j)}
                          title="Open the Edit tab for this job"
                          style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8125rem',
                            lineHeight: 1.2,
                            textAlign: 'center',
                            background: 'none',
                            color: 'var(--text-700)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            width: '100%',
                            minWidth: '7.5rem',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {/* Share first — same order as the billing stages' icon row
                                (v2.2576); closes the v2.1452 gap where Waiting/Working
                                rows missed the "every Pipeline row" promise. */}
                            <ShareJobButton
                              jobId={j.id}
                              fields={{ hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }}
                            />
                            <button
                              type="button"
                              onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                              title="Open Plumbing Tooling report (pre-fill customer info)"
                              aria-label="Open Plumbing Tooling"
                              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                              </svg>
                            </button>
                            {showAiaG702G703(authRole, j) ? (
                              <button
                                type="button"
                                onClick={() => setAiaG702StagesJob(j)}
                                title="AIA G702-G703"
                                aria-label="Open AIA G702-G703 workbook generator"
                                style={{
                                  padding: '0.25rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#16a34a',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <FileSpreadsheet size={16} aria-hidden />
                              </button>
                            ) : null}
                            {canCreateHazmatFee ? (
                              <button
                                type="button"
                                onClick={() => openHazmatFee(j)}
                                title={hazmatFeeJobIds?.has(j.id) ? 'This job has a hazmat fee — click to add another' : 'Hazmat Fee — document a biohazard incident and bill the customer'}
                                aria-label="Create a hazmat fee for this job"
                                style={{ padding: '0.25rem', background: hazmatFeeJobIds?.has(j.id) ? 'rgba(34, 197, 94, 0.14)' : 'none', border: hazmatFeeJobIds?.has(j.id) ? '2px solid #22c55e' : 'none', borderRadius: 6, cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M292 76.6C292 68.3 284.4 62.1 276.5 64.5C215.6 83.3 171.4 140.3 171.4 207.6C171.4 232.7 177.5 256.3 188.4 277.1C167.4 278.9 146.4 285.3 126.9 296.6C69 330.2 42.1 396.8 56 459.1C57.9 467.5 67.4 471.1 74.9 466.7C79.9 463.8 82.5 458.1 82 452.3C81.7 449 81.6 445.7 81.6 442.2C81.6 318.7 266 318.7 266 442.2C266 530.6 171.5 555.8 117.8 517.6C113.3 514.4 107.3 513.7 102.5 516.5C95.5 520.6 93.9 530.1 99.8 535.6C146.4 579.4 217.8 589.5 275.9 555.8C293.8 545.4 308.7 531.9 320.4 516.4C332.1 532 347 545.5 364.9 555.8C423 589.5 494.4 579.4 541 535.6C546.9 530.1 545.3 520.5 538.3 516.5C533.5 513.7 527.5 514.4 523 517.6C469.3 555.8 374.8 530.6 374.8 442.2C374.8 318.7 559.2 318.7 559.2 442.2C559.2 445.6 559.1 449 558.8 452.3C558.3 458.1 560.9 463.8 565.9 466.7C573.3 471 582.9 467.5 584.8 459.1C598.7 396.9 571.8 330.2 513.9 296.6C494.4 285.3 473.5 278.9 452.4 277.1C463.3 256.3 469.4 232.7 469.4 207.6C469.4 140.3 425.2 83.3 364.3 64.5C356.4 62.1 348.8 68.3 348.8 76.6C348.8 82.5 352.8 87.6 358.3 89.8C441.7 123.4 429.1 268.2 320.5 268.2C211.9 268.2 199.1 123.4 282.5 89.8C288 87.6 292 82.5 292 76.6zM280.4 352C280.4 329.9 298.3 312 320.4 312C342.5 312 360.4 329.9 360.4 352C360.4 374.1 342.5 392 320.4 392C298.3 392 280.4 374.1 280.4 352zM467 381.7C450.8 381.7 435.6 387.2 424.9 396.7C414.8 405.8 406.8 420.1 406.8 442.3C406.8 463.4 414 477.3 423.3 486.4C455.5 461.8 478.8 425.9 487.2 384.6C480.9 382.7 474 381.6 467 381.6zM234 442.3C234 420 226 405.7 215.9 396.7C205.2 387.1 190 381.7 173.8 381.7C166.8 381.7 159.9 382.7 153.6 384.7C162 426 185.2 461.9 217.5 486.5C226.9 477.4 234 463.4 234 442.3zM275.2 218C284.2 228.2 298.4 236.2 320.4 236.2C342.4 236.2 356.6 228.2 365.6 218C372.3 210.4 377.1 200.5 379.2 189.6C360.9 182.8 341 179.1 320.4 179.1C299.8 179.1 279.9 182.8 261.6 189.6C263.8 200.5 268.5 210.4 275.2 218.1z" /></svg>
                              </button>
                            ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
              </tr>
              {expandedJobThreadId === j.id && (
                <tr>
                  <td
                    colSpan={stagesTableColCount}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {renderStagesExpandedRowPanel(
                    <JobsStagesThreadPanel
                      job={j}
                      activity={jobThreadActivityByJobId[j.id] ?? []}
                      loading={jobThreadNotesLoadingId === j.id}
                      upcoming={stagesUpcomingByJobId[j.id] ?? null}
                      viewerRole={authRole}
                      {...(authUser ? { submitNoteWithBody: submitJobThreadNoteWithBody } : {})}
                      fullscreen={jobThreadFullscreen}
                      onToggleFullscreen={() => setJobThreadFullscreen(!jobThreadFullscreen)}
                      fullscreenHeader={renderStagesThreadFullscreenJobHeader(j)}
                      pctComplete={j.pct_complete ?? null}
                      canEditPct={canEditJobPctComplete}
                      pctSaving={pctCompleteSavingId === j.id}
                      onCommitPct={(value, note) => commitStagesPctWithNote(j.id, value, note)}
                      teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                      {...(canManageJobPeople
                        ? {
                            peopleAction: {
                              onClick: () =>
                                setManageJobPeople({
                                  jobId: j.id,
                                  jobLabel: `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
                                  currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                                }),
                            },
                          }
                        : {})}
                    />,
                    )}
                  </td>
                </tr>
              )}
              {renderStagesProjectBannerRow(j.project_id, j.project, stagesTableColCount)}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
