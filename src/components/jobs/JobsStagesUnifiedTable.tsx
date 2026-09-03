import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { FileCheck2, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  formatCurrency,
  formatEstimatedCompletionDisplay,
  formatTimeSince,
  formatUsdNoCents,
} from '../../lib/jobs/jobFormatting'
import { stagesAddedStampLabel, type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobBilledUnpaidDollars,
  sumInvoiceAppliedFromJobPayments,
} from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars, type InvoiceWithJob, type StageRow } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { ShareJobButton } from './ShareJobButton'
import { JobsStagesThreadPanel } from './JobsStagesThreadPanel'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
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
  renderStagesExpandedRowPanel,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
  renderStagesThreadFullscreenJobHeader,
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
  /** Board sort mode (v2.1807): 'added' shows an "added <date>" stamp beside each job number. */
  stagesSortMode?: StagesBoardSortMode
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
  /** When false, hide the Plumbing Tooling (wrench) shortcut (e.g. Billed Awaiting Payment). Default true. */
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
                              model={buildStagesMoneyBarModel({
                                totalBill: j.revenue != null ? Number(j.revenue) : null,
                                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                                pctComplete: j.pct_complete ?? null,
                                billedUnpaid: jobBilledUnpaidDollars(j),
                              })}
                              pctComplete={j.pct_complete ?? null}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              footnote={showRemaining ? (() => {
                                const u = jobBillingUnallocatedDollars(j)
                                return u > 0 ? (
                                  <span title="Left on the job after draft and billed invoice lines">{`${formatUsdNoCents(u)} unallocated`}</span>
                                ) : null
                              })() : null}
                            />
                            {((sendBackBelowRemaining && onJobSendBack) || onJobMoveToCollections) && (
                              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {sendBackBelowRemaining && onJobSendBack && (
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
                                {onJobMoveToCollections && (
                                  <button
                                    type="button"
                                    onClick={() => onJobMoveToCollections(j)}
                                    title="Flag this job as difficult to collect (moves to the Collections section; stays Billed)"
                                    style={{ ...stagesSecondaryOutlineButtonBase, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
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
                              model={buildStagesMoneyBarModel({
                                totalBill: j.revenue != null ? Number(j.revenue) : null,
                                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                                pctComplete: j.pct_complete ?? null,
                                billedUnpaid: jobBilledUnpaidDollars(j),
                              })}
                              pctComplete={j.pct_complete ?? null}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                              footnote={
                                row.kind === 'job_with_merged_billed'
                                  ? (() => {
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
                              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                                  <button
                                    type="button"
                                    onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                                    disabled={stagesInvoiceUpdatingId === bundleInv.id}
                                    title="Remove this billing line (partial invoice row)"
                                    style={{
                                      ...stagesSecondaryOutlineButtonBase,
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
                                    style={{ ...stagesSecondaryOutlineButtonBase, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
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
                              {onOpenLienRelease ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenLienRelease({ job: j, invoice: bundleInv ?? null })}
                                  title={lienReleaseJobIds?.has(j.id) ? 'This job has an issued lien release — click to view or issue another' : 'Release of lien — generate a conditional or unconditional waiver and release'}
                                  aria-label="Release of lien"
                                  style={{ padding: '0.25rem', background: lienReleaseJobIds?.has(j.id) ? 'var(--bg-blue-tint)' : 'none', border: lienReleaseJobIds?.has(j.id) ? '2px solid #2563eb' : 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <FileCheck2 size={16} aria-hidden />
                                </button>
                              ) : null}
                              <ShareJobButton
                                jobId={j.id}
                                fields={{ hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }}
                              />
                              {showClickTooling && (
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
                              )}
                              {onOpenLienTooling &&
                                (() => {
                                  let invForLien: JobsLedgerInvoice | null = bundleInv ?? null
                                  if (!invForLien) {
                                    const billedOnly = (j.invoices ?? []).filter((i) => i.status === 'billed')
                                    invForLien = billedOnly.length === 1 ? billedOnly[0]! : null
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => onOpenLienTooling({ job: j, invoice: invForLien })}
                                      title={demandOutJobIds?.has(j.id) ? 'Lien instruments — a demand letter is out on this job' : 'Lien instruments — demand letter and lien forms'}
                                      aria-label="Lien instruments"
                                      style={{
                                        padding: '0.25rem',
                                        background: demandOutJobIds?.has(j.id) ? 'var(--bg-amber-tint)' : 'none',
                                        border: demandOutJobIds?.has(j.id) ? '2px solid #b45309' : 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: '#FF6600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
                                      </svg>
                                    </button>
                                  )
                                })()}
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
                        colSpan={unifiedStagesColCount}
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
                      <div>{(job.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
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
                          model={buildStagesMoneyBarModel({
                            totalBill: job.revenue != null ? Number(job.revenue) : null,
                            paymentsMade: job.payments_made != null ? Number(job.payments_made) : null,
                            pctComplete: job.pct_complete ?? null,
                            billedUnpaid: jobBilledUnpaidDollars(job),
                          })}
                          pctComplete={job.pct_complete ?? null}
                          pctSaving={pctCompleteSavingId === job.id}
                          onPctCommit={(n) => updateJobPctComplete(job.id, n, job.pct_complete ?? null)}
                          onNoBidValueClick={() => openEdit(job, { fixturesSectionHighlight: true })}
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
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {sendBackBelowRemaining && (
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
                            {onJobMoveToCollections && (
                              <button
                                type="button"
                                onClick={() => onJobMoveToCollections(job)}
                                title="Flag this job as difficult to collect (moves all its billed lines to the Collections section; stays Billed)"
                                style={{ ...stagesSecondaryOutlineButtonBase, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
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
                          {onOpenLienRelease ? (
                            <button
                              type="button"
                              onClick={() => onOpenLienRelease({ job, invoice: inv })}
                              title={lienReleaseJobIds?.has(job.id) ? 'This job has an issued lien release — click to view or issue another' : 'Release of lien — generate a conditional or unconditional waiver and release'}
                              aria-label="Release of lien"
                              style={{ padding: '0.25rem', background: lienReleaseJobIds?.has(job.id) ? 'var(--bg-blue-tint)' : 'none', border: lienReleaseJobIds?.has(job.id) ? '2px solid #2563eb' : 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <FileCheck2 size={16} aria-hidden />
                            </button>
                          ) : null}
                          <ShareJobButton
                            jobId={job.id}
                            fields={{ hcpNumber: job.hcp_number, jobName: job.job_name, jobAddress: job.job_address }}
                          />
                          {showClickTooling && (
                            <button
                              type="button"
                              onClick={() => openInExternalBrowser(buildClickToolingUrl(job))}
                              title="Open Plumbing Tooling report (pre-fill customer info)"
                              aria-label="Open Plumbing Tooling"
                              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                              </svg>
                            </button>
                          )}
                          {onOpenLienTooling ? (
                            <button
                              type="button"
                              onClick={() => onOpenLienTooling({ job, invoice: inv })}
                              title={demandOutJobIds?.has(job.id) ? 'Lien instruments — a demand letter is out on this job' : 'Lien instruments — demand letter and lien forms'}
                              aria-label="Lien instruments"
                              style={{
                                padding: '0.25rem',
                                background: demandOutJobIds?.has(job.id) ? 'var(--bg-amber-tint)' : 'none',
                                border: demandOutJobIds?.has(job.id) ? '2px solid #b45309' : 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#FF6600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
                              </svg>
                            </button>
                          ) : null}
                          {showAiaG702G703(authRole, job, inv) ? (
                            <button
                              type="button"
                              onClick={() => setAiaG702StagesJob(job)}
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
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedJobThreadId === job.id && (
                    <tr>
                      <td
                        colSpan={unifiedStagesColCount}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-subtle)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {renderStagesExpandedRowPanel(
                        <JobsStagesThreadPanel
                          job={job}
                          activity={jobThreadActivityByJobId[job.id] ?? []}
                          loading={jobThreadNotesLoadingId === job.id}
                          upcoming={stagesUpcomingByJobId[job.id] ?? null}
                          viewerRole={authRole}
                          {...(authUser ? { submitNoteWithBody: submitJobThreadNoteWithBody } : {})}
                          fullscreen={jobThreadFullscreen}
                          onToggleFullscreen={() => setJobThreadFullscreen(!jobThreadFullscreen)}
                          fullscreenHeader={renderStagesThreadFullscreenJobHeader(job)}
                          pctComplete={job.pct_complete ?? null}
                          canEditPct={canEditJobPctComplete}
                          pctSaving={pctCompleteSavingId === job.id}
                          onCommitPct={(value, note) => commitStagesPctWithNote(job.id, value, note)}
                          teamMembers={job.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                          {...(canManageJobPeople
                            ? {
                                peopleAction: {
                                  onClick: () =>
                                    setManageJobPeople({
                                      jobId: job.id,
                                      jobLabel: `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`,
                                      currentTeamUserIds: job.team_members?.map((t) => t.user_id) ?? [],
                                    }),
                                },
                              }
                            : {})}
                        />,
                        )}
                      </td>
                    </tr>
                  )}
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
