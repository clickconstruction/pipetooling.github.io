import { StagesCrewLine } from './StagesCrewLine'
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { useNavigate } from 'react-router-dom'
import {
  formatCurrency,
  formatEstimatedCompletionDisplay,
  formatTimeSince,
  formatUsdNoCents,
} from '../../lib/jobs/jobFormatting'
import { stagesAddedStampLabel, type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import StagesProgressPaymentHeader from './StagesProgressPaymentHeader'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  sumInvoiceAppliedFromJobPayments,
} from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars, type InvoiceWithJob, type StageRow } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { ShareJobButton } from './ShareJobButton'
import { StagesAiaG702Button, StagesHazmatFeeButton, StagesLienInstrumentsButton, StagesLienReleaseButton, StagesTestReportButton } from './StagesRowActionButtons'
import { StagesExpandedThreadRow } from './StagesExpandedThreadRow'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
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
  renderStagesViewReportsButton,
  renderStagesProjectBannerRow,
  shouldSuppressStagesRowJobThreadToggle,
  stagesRowHasProjectBanner,
  STAGES_TABLE_MIN_WIDTH,
  STAGES_EDIT_MODE_RAIL_WIDTH,
  renderStagesEditModeRail,
  stagesInvoiceRowAccentRowStyle,
  stagesInvoiceRowAccentRailStyle,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages mixed job/invoice-row section table (Ready to Bill / Billed Awaiting
 * Payment / Collections) — Jobs.tsx decomposition step 9a
 * (docs/JOBS_TABS_ARCHITECTURE.md "Section renderers"). Behavior-preserving
 * move of the IIFE closure `renderUnifiedStagesTable(rows, options)`: the
 * former ~20-key options object is flattened into same-named props (defaults
 * preserved in the destructure), and every captured page value is a same-named
 * prop (wide prop list accepted for this step — the step-9b JobsStagesTab
 * becomes the single caller and absorbs most of them). The quick-action
 * stack's `navigate` + dispatch-task/checklist modal contexts are consumed via
 * their app-global hooks here instead of props.
 */
export type JobsStagesUnifiedTableProps = {
  rows: StageRow[]
  /** Board sort mode (v2.1807): 'added' shows an "added <date>" stamp beside each job number; 'progress' (v2.3408) lights the column header. */
  stagesSortMode?: StagesBoardSortMode
  /** Click on the "Progress & payment" header (v2.3408): flip the % complete sort. Omit to render a plain header. */
  onToggleProgressSort?: () => void
  /** Follow-Up deck embed (v2.1740): the card names the columns' context itself, so skip the header row. */
  hideHeader?: boolean
  actionLabel: React.ReactNode | null
  onJobAction: (j: JobWithDetails) => void
  onInvoiceAction: (inv: InvoiceWithJob) => void
  /** Billed Awaiting Payment: open read-only bill (Stripe or outside). */
  onViewBill?: (inv: InvoiceWithJob) => void
  onJobSendBack?: (j: JobWithDetails) => void
  onInvoiceSendBack: (inv: InvoiceWithJob) => void
  showRemaining?: boolean
  showTimeOpen?: boolean
  sendBackBelowRemaining?: boolean
  showCreatePartialInvoice?: boolean
  jobSendBackLabel?: string
  invoiceBundleActionLabel?: string
  invoiceStandaloneActionLabel?: string
  /** Deep-link flash: row matching this invoice id gets a brief highlight. */
  flashInvoiceId?: string | null
  /** When false, hide the Test report (wrench) shortcut (e.g. Billed Awaiting Payment). Default true. */
  showClickTooling?: boolean
  /** Billed Awaiting Payment: open Lien Tooling prefill modal. */
  onOpenLienTooling?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
  /** Release of lien (v2.2579): open the in-app waiver-and-release modal. */
  onOpenLienRelease?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
  /** Jobs with a live (non-voided) release — their release button wears a blue box (v2.2582). */
  lienReleaseJobIds?: ReadonlySet<string>
  /** Jobs with a live SENT demand letter (v2.2640) — the lien icon wears an amber box. */
  demandOutJobIds?: ReadonlySet<string>
  /** Billed Awaiting Payment: flag the row's job as difficult-to-collect (Collections section). */
  onJobMoveToCollections?: (j: JobWithDetails) => void
  /** Collections: short muted note line under the amounts (e.g. the stored collections reason). */
  jobNoteLine?: (j: JobWithDetails) => string | null
  /** Billed Awaiting Payment: expected-payment chip for the row (bill date + customer pay speed). */
  billedExpectedPayChip?: (row: StageRow) => React.ReactNode
  // --- captured page values (same names as in Jobs.tsx; step 9b's JobsStagesTab absorbs these) ---
  stagesJobFlashId: string | null
  stagesHamMode: boolean
  /** ⋯ tools menu "Edit mode" (v2.1236): thin vertical EDIT rail on every job-backed row → openEdit. */
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
  authRole: StagesRowRenderContext['authRole']
  loadJobs: StagesRowRenderContext['loadJobs']
  onDevelopmentFilter?: StagesRowRenderContext['onDevelopmentFilter']
  jobContractCoverageByJobId?: StagesRowRenderContext['jobContractCoverageByJobId']
  onOpenJobContract?: StagesRowRenderContext['onOpenJobContract']
  stagesInvoiceUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesInvoiceUpdatingId']
  invoiceEstimatedBillDateSavingId: ReturnType<typeof useJobsStagesMutations>['invoiceEstimatedBillDateSavingId']
  bumpInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['bumpInvoiceEstimatedBillDate']
  setWhenInvoiceBillModal: (v: { invoiceId: string; jobId: string; jobName: string; hcpNumber: string } | null) => void
  setWhenInvoiceBillModalDate: (v: string) => void
}

export default function JobsStagesUnifiedTable(props: JobsStagesUnifiedTableProps) {
  // Test reports (v2.3298): the wrench opens the modal; without the provider (render smokes) it keeps the old site.
  const testReportModal = useTestReportModalOptional()
  const openTestReportFor = (job: JobWithDetails) => {
    if (testReportModal) testReportModal.openTestReport({ job })
    else openInExternalBrowser(buildClickToolingUrl(job))
  }
  const {
    rows,
    hideHeader,
    actionLabel,
    onJobAction,
    onInvoiceAction,
    onViewBill,
    onJobSendBack,
    onInvoiceSendBack,
    showRemaining,
    showTimeOpen,
    sendBackBelowRemaining,
    jobSendBackLabel = 'Send back',
    invoiceBundleActionLabel = 'Remove line',
    invoiceStandaloneActionLabel = 'Send back',
    flashInvoiceId = null,
    showClickTooling = true,
    onOpenLienTooling,
    onOpenLienRelease,
    lienReleaseJobIds,
    demandOutJobIds,
    onJobMoveToCollections,
    jobNoteLine,
    stagesJobFlashId,
    stagesHamMode,
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
    authRole,
    loadJobs,
    onDevelopmentFilter,
    jobContractCoverageByJobId,
    onOpenJobContract,
    stagesInvoiceUpdatingId,
    invoiceEstimatedBillDateSavingId,
    bumpInvoiceEstimatedBillDate,
    setWhenInvoiceBillModal,
    setWhenInvoiceBillModalDate,
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
  const renderStagesJobCellActivityFooter = (
    job: JobWithDetails,
    billingLineForStripeHint?: JobsLedgerInvoice | null,
    opts?: { hideReportsButton?: boolean },
  ) => renderStagesJobCellActivityFooterWithCtx(stagesRowSharedCtx, job, { billingLineForStripeHint, ...opts })

  const renderStagesQuickActionsStack = (job: JobWithDetails) =>
    renderStagesQuickActionsStackWithCtx(stagesRowSharedCtx, job)

  const renderJobNoteLine = (j: JobWithDetails) => {
    const note = jobNoteLine?.(j)
    if (!note) return null
    return (
      <span
        title={note}
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-red-700)',
          fontStyle: 'italic',
          maxWidth: '11rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {note}
      </span>
    )
  }
  const unifiedStagesColCount = 4
  const flashRowStyle = (invoiceId: string): CSSProperties =>
    flashInvoiceId === invoiceId
      ? {
          backgroundColor: 'var(--bg-amber-100)',
          outline: '2px solid #f59e0b',
          outlineOffset: -2,
          transition: 'background-color 0.35s ease',
        }
      : {}
  const stagesSecondaryOutlineButtonBase: CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.8125rem',
    lineHeight: 1.2,
    textAlign: 'center',
    background: 'none',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    width: 'fit-content',
    maxWidth: '100%',
    boxSizing: 'border-box',
  }
  /** Send back · Collections under the cell (v2.3459): one row, the two buttons
   *  sharing the cell's width, never stacked — the column is 176px and the pair
   *  at their natural widths wrapped onto two lines. */
  const stagesCellButtonRowStyle: CSSProperties = { display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'nowrap', width: '100%' }
  const stagesCellButtonStyle: CSSProperties = { ...stagesSecondaryOutlineButtonBase, flex: '1 1 0', minWidth: 0, width: 'auto', padding: '0.25rem 0.3rem', whiteSpace: 'nowrap' }
  const stagesInvoiceHcpBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 4,
    background: '#16a34a',
    color: 'white',
    lineHeight: 1.2,
    // "Invoice: 891" must never break after the colon in a narrow column.
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  }
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
      {/* tableLayout: fixed (v2.971, matching JobsStagesTable v2.967): widths come from the
          colgroup, never from content measurement — Billed/Collections rows loading or search
          filtering used to re-measure auto layout and jitter the columns. The one
          unspecified col (Job) takes all the remaining width, so minWidth must
          exceed the colgroup's sized total (see STAGES_TABLE_MIN_WIDTH). */}
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={unifiedStagesColCount} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                No jobs or invoices in this group
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              if (
                row.kind === 'job' ||
                row.kind === 'job_with_merged_billed' ||
                row.kind === 'job_with_primary_rtb'
              ) {
                const j = row.job
                const bundleInv =
                  row.kind === 'job_with_merged_billed' || row.kind === 'job_with_primary_rtb'
                    ? row.inv
                    : null
                const bundleInvWithJob: InvoiceWithJob | null =
                  bundleInv != null ? { ...bundleInv, job: j } : null
                const bundleRowKey =
                  bundleInv != null
                    ? row.kind === 'job_with_primary_rtb'
                      ? `job-${j.id}-rtb-${bundleInv.id}`
                      : `job-${j.id}-billed-${bundleInv.id}`
                    : `job-${j.id}`
                return (
                  <Fragment key={bundleRowKey}>
                  <tr
                    data-stages-invoice-id={bundleInv != null ? bundleInv.id : undefined}
                    data-stages-job-id={j.id}
                    style={{
                      borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid var(--border-job-row)',
                      ...(bundleInv != null ? flashRowStyle(bundleInv.id) : {}),
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
                        verticalAlign: 'top',
                        position: 'relative',
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
                      {bundleInv != null && row.kind === 'job_with_merged_billed' ? (
                        // The "Billed line: $X open" text was redundant with the
                        // Progress column (v2.1155) — the Reports pill moved here
                        // from the Activity cell instead.
                        <div style={{ marginTop: '0.25rem' }}>
                          {renderStagesViewReportsButton(stagesRowSharedCtx, j)}
                        </div>
                      ) : bundleInv != null ? (
                        <div
                          style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: '0.25rem' }}
                          title="Single billing line for this job (Stripe or external send)"
                        >
                          Billing line: {formatCurrency(Number(bundleInv.amount))}
                        </div>
                      ) : null}
                      {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                      {renderStagesJobCellActivityFooter(j, bundleInv ?? undefined, row.kind === 'job_with_merged_billed' ? { hideReportsButton: true } : undefined)}
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {!bundleInv ? (
                          <>
                            <StagesProgressPaymentCell
                              model={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).model}
                    view={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).view}
                              pctComplete={j.pct_complete ?? null}
                              billSentAlert={stagesBillSentPctAlert(j)}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              onStageClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              footnote={showRemaining ? (() => {
                                const u = jobBillingUnallocatedDollars(j)
                                return u > 0 ? (
                                  <span title="Left on the job after draft and billed invoice lines">{`${formatUsdNoCents(u)} unallocated`}</span>
                                ) : null
                              })() : null}
                            />
                            {((sendBackBelowRemaining && onJobSendBack) || onJobMoveToCollections) && (
                              <div style={stagesCellButtonRowStyle}>
                                {sendBackBelowRemaining && onJobSendBack && (
                                  <button
                                    type="button"
                                    onClick={() => onJobSendBack(j)}
                                    disabled={stagesStatusUpdatingId === j.id}
                                    style={{
                                      ...stagesCellButtonStyle,
                                      cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {jobSendBackLabel}
                                  </button>
                                )}
                                {onJobMoveToCollections && (
                                  <button
                                    type="button"
                                    onClick={() => onJobMoveToCollections(j)}
                                    title="Flag this job as difficult to collect (moves to the Collections section; stays Billed)"
                                    style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Collections
                                  </button>
                                )}
                              </div>
                            )}
                            {renderJobNoteLine(j)}
                          </>
                        ) : (
                          <>
                            <StagesProgressPaymentCell
                              model={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).model}
                    view={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).view}
                              pctComplete={j.pct_complete ?? null}
                              billSentAlert={stagesBillSentPctAlert(j)}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              onStageClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              footnote={
                                row.kind === 'job_with_merged_billed'
                                  ? (() => {
                                      // v2.3459: "This bill: $X paid · $Y left" only when the job carries
                                      // more than one sent bill — with a single bill the legend above
                                      // already prints the same two numbers.
                                      if ((j.invoices ?? []).filter((i) => i.status === 'billed').length < 2) return null
                                      const ap = sumInvoiceAppliedFromJobPayments(j, bundleInv.id)
                                      return (
                                        <span title="This row's billed line">
                                          {`This bill: ${formatUsdNoCents(ap)} paid · ${formatUsdNoCents(invoiceOpenRemainingOnJob(bundleInv, j))} left`}
                                        </span>
                                      )
                                    })()
                                  : (
                                      <span title="Amount on this billing line">{`${formatUsdNoCents(Number(bundleInv.amount))} remainder`}</span>
                                    )
                              }
                            />
                            {((sendBackBelowRemaining && bundleInvWithJob != null) || onJobMoveToCollections) && (
                              <div style={stagesCellButtonRowStyle}>
                                {sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                                  <button
                                    type="button"
                                    onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                                    disabled={stagesInvoiceUpdatingId === bundleInv.id}
                                    title="Remove this billing line (partial invoice row)"
                                    style={{
                                      ...stagesCellButtonStyle,
                                      cursor: stagesInvoiceUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {invoiceBundleActionLabel}
                                  </button>
                                )}
                                {onJobMoveToCollections && (
                                  <button
                                    type="button"
                                    onClick={() => onJobMoveToCollections(j)}
                                    title="Flag this job as difficult to collect (moves to the Collections section; stays Billed)"
                                    style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Collections
                                  </button>
                                )}
                              </div>
                            )}
                            {renderJobNoteLine(j)}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {onViewBill && bundleInvWithJob != null && row.kind === 'job_with_merged_billed' ? (
                          <ViewBillWithPdfTail
                            onViewBill={() => onViewBill(bundleInvWithJob)}
                            invoice={{ id: bundleInvWithJob.id, job_id: bundleInvWithJob.job_id }}
                          />
                        ) : null}
                        {onViewBill && !bundleInv && (j.invoices ?? []).filter((i) => i.status === 'billed').length === 1 ? (
                          (() => {
                            const b = (j.invoices ?? []).filter((i) => i.status === 'billed')
                            return (
                              <ViewBillWithPdfTail
                                onViewBill={() => onViewBill({ ...b[0], job: j } as InvoiceWithJob)}
                                invoice={{ id: b[0]!.id, job_id: b[0]!.job_id }}
                              />
                            )
                          })()
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {actionLabel && bundleInvWithJob != null ? (
                            <button
                              type="button"
                              onClick={() => onInvoiceAction(bundleInvWithJob)}
                              disabled={
                                stagesStatusUpdatingId === j.id ||
                                stagesInvoiceUpdatingId === bundleInvWithJob.id
                              }
                              title="Billing action for this invoice line (job + invoice merged row)"
                              style={{
                                padding: '0.35rem 0.75rem',
                                paddingLeft: '0.6rem',
                                fontSize: '0.8125rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderLeft: '4px solid #16a34a',
                                borderRadius: 4,
                                cursor:
                                  stagesStatusUpdatingId === j.id ||
                                  stagesInvoiceUpdatingId === bundleInvWithJob.id
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {stagesStatusUpdatingId === j.id ||
                              stagesInvoiceUpdatingId === bundleInvWithJob.id
                                ? '…'
                                : actionLabel}
                            </button>
                          ) : actionLabel ? (
                            <button
                              type="button"
                              onClick={() => onJobAction(j)}
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
                          ) : null}
                          {showTimeOpen && (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                              Open {formatTimeSince(j.created_at ?? null)}
                            </span>
                          )}
                          {!sendBackBelowRemaining && onJobSendBack && (
                            <button
                              type="button"
                              onClick={() => onJobSendBack(j)}
                              disabled={stagesStatusUpdatingId === j.id}
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {jobSendBackLabel}
                            </button>
                          )}
                          {!sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                            <button
                              type="button"
                              onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                              disabled={stagesInvoiceUpdatingId === bundleInvWithJob.id}
                              title="Remove billing line (partial invoice)"
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesInvoiceUpdatingId === bundleInvWithJob.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {invoiceBundleActionLabel}
                            </button>
                          )}
                        </div>
                        {props.billedExpectedPayChip?.(row)}
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
                            style={{ ...stagesSecondaryOutlineButtonBase, width: '100%', minWidth: '7.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-700)' }}
                          >
                            Edit
                          </button>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {onOpenLienRelease ? <StagesLienReleaseButton onClick={() => onOpenLienRelease({ job: j, invoice: bundleInv ?? null })} hasRelease={lienReleaseJobIds?.has(j.id) === true} /> : null}
                              <ShareJobButton
                                jobId={j.id}
                                fields={{ hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }}
                              />
                              {showClickTooling && (
                                <StagesTestReportButton onClick={() => openTestReportFor(j)} />
                              )}
                              {onOpenLienTooling &&
                                (() => {
                                  let invForLien: JobsLedgerInvoice | null = bundleInv ?? null
                                  if (!invForLien) {
                                    const billedOnly = (j.invoices ?? []).filter((i) => i.status === 'billed')
                                    invForLien = billedOnly.length === 1 ? billedOnly[0]! : null
                                  }
                                  return (
                                    <StagesLienInstrumentsButton onClick={() => onOpenLienTooling({ job: j, invoice: invForLien })} demandOut={demandOutJobIds?.has(j.id) === true} />
                                  )
                                })()}
                              {showAiaG702G703(authRole, j) ? <StagesAiaG702Button onClick={() => setAiaG702StagesJob(j)} /> : null}
                              {canCreateHazmatFee ? <StagesHazmatFeeButton onClick={() => openHazmatFee(j)} hasFee={hazmatFeeJobIds?.has(j.id) === true} /> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedJobThreadId === j.id && <StagesExpandedThreadRow {...threadRowShared} job={j} colSpan={unifiedStagesColCount} />}
                  {renderStagesProjectBannerRow(j.project_id, j.project, unifiedStagesColCount)}
                  </Fragment>
                )
              } else {
                const { inv, job } = row
                const invWithJob: InvoiceWithJob = { ...inv, job }
                const stagesInvoiceHcpTrimmed = (job.hcp_number ?? '').trim()
                const stagesInvoiceRowHcpLabel = stagesInvoiceHcpTrimmed
                  ? `Invoice: ${stagesInvoiceHcpTrimmed}`
                  : '—'
                return (
                  <Fragment key={`inv-${inv.id}`}>
                  <tr
                    data-stages-invoice-id={inv.id}
                    data-stages-job-id={job.id}
                    style={{
                      borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid var(--border-job-row)',
                      ...stagesInvoiceRowAccentRowStyle,
                      ...flashRowStyle(inv.id),
                      ...(stagesJobFlashId === job.id
                        ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                        : {}),
                    }}
                    onClick={(e) => {
                      if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                      toggleStagesJobThreadExpanded(job.id)
                    }}
                  >
                    <td
                      style={{
                        padding: '0.75rem',
                        ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
                        verticalAlign: 'top',
                        position: 'relative',
                        ...stagesInvoiceRowAccentRailStyle,
                      }}
                    >
                      {stagesEditMode ? renderStagesEditModeRail(job, openEdit) : null}
                      {/* v2.1530: the quick-action stack moved here from the Activity cell. */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                      {renderStagesQuickActionsStack(job)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                      <StagesCrewLine job={job} />
                      {stagesInvoiceHcpTrimmed ? (
                        <div style={{ marginTop: '0.15rem' }}>
                          <span style={stagesInvoiceHcpBadgeStyle}>{stagesInvoiceRowHcpLabel}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>
                          {stagesInvoiceRowHcpLabel}
                        </div>
                      )}
                      {renderStagesFieldAndBillingLines(job)}
                      {(() => {
                        const eff = effectiveInvoiceEstBillDate(inv)
                        const display = formatEstimatedCompletionDisplay(eff)
                        return (
                          <>
                            {display ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{display}</div>
                            ) : null}
                            {stagesHamMode ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  marginTop: '0.15rem',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, -1)
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    background: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, 1)
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    background: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWhenInvoiceBillModal({
                                      invoiceId: inv.id,
                                      jobId: job.id,
                                      jobName: job.job_name ?? '—',
                                      hcpNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
                                    })
                                    setWhenInvoiceBillModalDate(
                                      inv.estimated_bill_date?.trim().slice(0, 10) ?? ''
                                    )
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  title="Edit est. bill date"
                                  aria-label="Edit est. bill date"
                                  style={{
                                    padding: '0.25rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-700)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                    <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                  </svg>
                                </button>
                              </div>
                            ) : null}
                          </>
                        )
                      })()}
                      </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', ...accountManOnlyStripeStyle(job) }}>
                      {/* Same detail-opening name link as job-backed rows — Job detail
                          stays a click away here after the icon pair retired (v2.1686
                          parity for invoice rows). */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'wrap' }}>
                        {renderStagesOpenDetailJobName(job)}
                        {renderStagesThreadExpandButton(stagesRowSharedCtx, job.id)}
                      </div>
                      {renderJobAddressWithMap(job.job_address)}
                      {renderJobCustomerLine(job)}
                      {renderStagesJobColumnEstimateFooter(job.linkedEstimateForStages)}
                      {renderStagesJobCellActivityFooter(job, inv)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <StagesProgressPaymentCell
                          model={progressPaymentForJob(job, stagesRowSharedCtx.crewByJobId.get(job.id) ?? null).model}
                          view={progressPaymentForJob(job, stagesRowSharedCtx.crewByJobId.get(job.id) ?? null).view}
                          pctComplete={job.pct_complete ?? null}
                          billSentAlert={stagesBillSentPctAlert(job)}
                          pctSaving={pctCompleteSavingId === job.id}
                          onPctCommit={(n) => updateJobPctComplete(job.id, n, job.pct_complete ?? null)}
                          onNoBidValueClick={() => openEdit(job, { fixturesSectionHighlight: true })}
                          onStageClick={() => openEdit(job, { fixturesSectionHighlight: true })}
                          footnote={(() => {
                            const u = showRemaining ? jobBillingUnallocatedDollars(job) : 0
                            return (
                              <span>
                                <span title="Amount on this draft billing line">{`${formatUsdNoCents(Number(inv.amount))} draft`}</span>
                                {u > 0 ? (
                                  <span title="Left on the job after all draft and billed lines">{` · ${formatUsdNoCents(u)} unallocated`}</span>
                                ) : null}
                              </span>
                            )
                          })()}
                        />
                        {(sendBackBelowRemaining || onJobMoveToCollections) && (
                          <div style={stagesCellButtonRowStyle}>
                            {sendBackBelowRemaining && (
                              <button
                                type="button"
                                onClick={() => onInvoiceSendBack(invWithJob)}
                                disabled={stagesInvoiceUpdatingId === inv.id}
                                style={{
                                  ...stagesCellButtonStyle,
                                  cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {invoiceStandaloneActionLabel}
                              </button>
                            )}
                            {onJobMoveToCollections && (
                              <button
                                type="button"
                                onClick={() => onJobMoveToCollections(job)}
                                title="Flag this job as difficult to collect (moves all its billed lines to the Collections section; stays Billed)"
                                style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Collections
                              </button>
                            )}
                          </div>
                        )}
                        {renderJobNoteLine(job)}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {onViewBill ? (
                          <ViewBillWithPdfTail
                            onViewBill={() => onViewBill(invWithJob)}
                            invoice={{ id: invWithJob.id, job_id: invWithJob.job_id }}
                          />
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {actionLabel && (
                            <button
                              type="button"
                              onClick={() => onInvoiceAction(invWithJob)}
                              disabled={stagesInvoiceUpdatingId === inv.id}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8125rem',
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {stagesInvoiceUpdatingId === inv.id ? '…' : actionLabel}
                            </button>
                          )}
                          {!sendBackBelowRemaining && (
                            <button
                              type="button"
                              onClick={() => onInvoiceSendBack(invWithJob)}
                              disabled={stagesInvoiceUpdatingId === inv.id}
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {invoiceStandaloneActionLabel}
                            </button>
                          )}
                        </div>
                        {props.billedExpectedPayChip?.(row)}
                        {/* marginTop tops the outer stack's 0.25rem gap up to the status
                            buttons' own 0.5rem rhythm — equal air above Edit Job (v2.1688). */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch', marginTop: '0.25rem' }}>
                          {/* One big Edit Job target (owner call, v2.1686/this PR) —
                              replaces the Edit / Job detail icon pair on invoice rows.
                              Job detail stays a click away via the job name. */}
                          <button
                            type="button"
                            onClick={() => openEdit(job)}
                            title="Open the Edit tab for this job"
                            style={{ ...stagesSecondaryOutlineButtonBase, width: '100%', minWidth: '7.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-700)' }}
                          >
                            Edit
                          </button>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {onOpenLienRelease ? <StagesLienReleaseButton onClick={() => onOpenLienRelease({ job, invoice: inv })} hasRelease={lienReleaseJobIds?.has(job.id) === true} /> : null}
                          <ShareJobButton
                            jobId={job.id}
                            fields={{ hcpNumber: job.hcp_number, jobName: job.job_name, jobAddress: job.job_address }}
                          />
                          {showClickTooling && (
                            <StagesTestReportButton onClick={() => openTestReportFor(job)} />
                          )}
                          {onOpenLienTooling ? (
                            <StagesLienInstrumentsButton onClick={() => onOpenLienTooling({ job, invoice: inv })} demandOut={demandOutJobIds?.has(job.id) === true} />
                          ) : null}
                          {showAiaG702G703(authRole, job, inv) ? <StagesAiaG702Button onClick={() => setAiaG702StagesJob(job)} /> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedJobThreadId === job.id && <StagesExpandedThreadRow {...threadRowShared} job={job} colSpan={unifiedStagesColCount} />}
                  {renderStagesProjectBannerRow(job.project_id, job.project, unifiedStagesColCount)}
                  </Fragment>
                )
              }
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
