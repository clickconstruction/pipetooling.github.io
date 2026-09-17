import { StagesCrewLine } from './StagesCrewLine'
import { Fragment, type ReactNode } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { useNavigate } from 'react-router-dom'
import { formatTimeSince } from '../../lib/jobs/jobFormatting'
import { stagesAddedStampLabel, type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import StagesProgressPaymentHeader from './StagesProgressPaymentHeader'
import { stagesJobLevelStripeEmailedHintInvoice } from '../../lib/jobs/invoiceBilling'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { StagesExpandedThreadRow } from './StagesExpandedThreadRow'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
import { ShareJobButton } from './ShareJobButton'
import { StagesAiaG702Button, StagesHazmatFeeButton, StagesTestReportButton } from './StagesRowActionButtons'
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
import { useSessionNotesOpener } from './sessionNotesOpenerContext'
import {
  accountManOnlyStripeStyle,
  renderJobAddressWithMap,
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
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
  /** Board sort mode (v2.1807): 'added' shows an "added <date>" stamp beside each job number; 'progress' (v2.3408) lights the column header. */
  stagesSortMode?: StagesBoardSortMode
  /** Click on the "Progress & payment" header (v2.3408): flip the % complete sort. Omit to render a plain header. */
  onToggleProgressSort?: () => void
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
  crewByJobId: StagesRowRenderContext['crewByJobId']
  stagesLaborBreakdownByJobId: StagesRowRenderContext['stagesLaborBreakdownByJobId']
  expandedJobThreadId: StagesRowRenderContext['expandedJobThreadId']
  toggleStagesJobThreadExpanded: StagesRowRenderContext['toggleStagesJobThreadExpanded']
  jobThreadStatsByJobId: StagesRowRenderContext['jobThreadStatsByJobId']
  jobThreadActivityByJobId: StagesRowRenderContext['jobThreadActivityByJobId']
  openJobThreadFullscreen: StagesRowRenderContext['openJobThreadFullscreen']
  openJobActivityExpand: StagesRowRenderContext['openJobActivityExpand']
  openNewReportForJob?: StagesRowRenderContext['openNewReportForJob']
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
  jobContractCoverageByJobId?: StagesRowRenderContext['jobContractCoverageByJobId']
  onOpenJobContract?: StagesRowRenderContext['onOpenJobContract']
}

export default function JobsStagesTable(props: JobsStagesTableProps) {
  // Test reports (v2.3298): the wrench opens the modal; without the provider (render smokes) it keeps the old site.
  const testReportModal = useTestReportModalOptional()
  const openTestReportFor = (job: JobWithDetails) => {
    if (testReportModal) testReportModal.openTestReport({ job })
    else openInExternalBrowser(buildClickToolingUrl(job))
  }
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
    crewByJobId,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    openJobThreadFullscreen,
    openJobActivityExpand,
    openNewReportForJob,
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
    jobContractCoverageByJobId,
    onOpenJobContract,
  } = props
  const wideViewport = useWideViewport1100()
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()

  const customerProfileModal = useCustomerProfileModal()
  const jobHoursStoryModal = useJobHoursStoryModal()
  const sessionNotesOpener = useSessionNotesOpener()
  const stagesRowSharedCtx: StagesRowRenderContext = {
    openSessionNotesForJob: sessionNotesOpener,
    openCustomerProfile: customerProfileModal?.openCustomerProfile,
    openJobHoursStory: jobHoursStoryModal?.openJobHoursStory,
    showToast,
    customers,
    openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId,
    stagesManHoursLoading,
    crewByJobId,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    openJobThreadFullscreen,
    openJobActivityExpand,
    openNewReportForJob,
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
    jobContractCoverageByJobId,
    onOpenJobContract,
  }
  const renderStagesFieldAndBillingLines = (job: JobWithDetails) =>
    renderStagesFieldAndBillingLinesWithCtx(stagesRowSharedCtx, job)
  const renderJobCustomerLine = (job: JobWithDetails) => renderJobCustomerLineWithCtx(stagesRowSharedCtx, job)
  const renderStagesJobCellActivityFooter = (job: JobWithDetails, billingLineForStripeHint?: JobsLedgerInvoice | null) =>
    renderStagesJobCellActivityFooterWithCtx(stagesRowSharedCtx, job, { billingLineForStripeHint })

  const renderStagesQuickActionsStack = (job: JobWithDetails) =>
    renderStagesQuickActionsStackWithCtx(stagesRowSharedCtx, job)

  const stagesTableColCount = 4
  /** The expanded thread row's inputs, built once (Stages decomposition PR 9, v2.3541). */
  const threadRowShared = {
    jobThreadActivityByJobId,
    jobThreadNotesLoadingId,
    stagesUpcomingByJobId,
    authRole,
    authUser,
    submitJobThreadNoteWithBody,
    jobThreadFullscreen,
    setJobThreadFullscreen,
    canEditJobPctComplete,
    pctCompleteSavingId,
    commitStagesPctWithNote,
    canManageJobPeople,
    setManageJobPeople,
  }

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
          {/* v2.3462: 14.5rem — wide enough that the legend's widest row ("100% Done, not billed" beside a six-figure amount) never wraps. */}
          <col style={{ width: '14.5rem' }} />
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
            <StagesProgressPaymentHeader
              sortedByProgress={props.stagesSortMode === 'progress'}
              onToggleSort={props.onToggleProgressSort}
            />
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
                  <StagesCrewLine job={j} />
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
                    model={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).model}
                    view={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).view}
                    pctComplete={j.pct_complete ?? null}
                    billSentAlert={stagesBillSentPctAlert(j)}
                    pctSaving={showPctComplete ? pctCompleteSavingId === j.id : undefined}
                    onPctCommit={showPctComplete ? (n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null) : undefined}
                    onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                    onStageClick={() => openEdit(j, { fixturesSectionHighlight: true })}
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
                            <StagesTestReportButton onClick={() => openTestReportFor(j)} />
                            {showAiaG702G703(authRole, j) ? <StagesAiaG702Button onClick={() => setAiaG702StagesJob(j)} /> : null}
                            {canCreateHazmatFee ? <StagesHazmatFeeButton onClick={() => openHazmatFee(j)} hasFee={hazmatFeeJobIds?.has(j.id) === true} /> : null}
                        </div>
                      </div>
                    </div>
                  </td>
              </tr>
              {expandedJobThreadId === j.id && <StagesExpandedThreadRow {...threadRowShared} job={j} colSpan={stagesTableColCount} />}
              {renderStagesProjectBannerRow(j.project_id, j.project, stagesTableColCount)}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
