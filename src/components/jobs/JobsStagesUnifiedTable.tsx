import { type CSSProperties, type ReactNode } from 'react'
import type { StagesPhoneRowsMode } from './stagesPhoneRowsMode'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { useNavigate } from 'react-router-dom'
import { type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import StagesProgressPaymentHeader from './StagesProgressPaymentHeader'
import { type InvoiceWithJob, type StageRow } from '../../lib/jobsStagesBoard'
import { type StagesExpandedThreadRowShared } from './StagesExpandedThreadRow'
import { StagesUnifiedInvoiceRow } from './StagesUnifiedInvoiceRow'
import { StagesUnifiedJobRow } from './StagesUnifiedJobRow'
import { stagesUnifiedRowKey } from '../../lib/jobs/stagesUnifiedRowKey'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useWideViewport1100 } from '../../hooks/useWideViewport1100'
import { useSessionNotesOpener } from './sessionNotesOpenerContext'
import {
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobCellActivityFooter as renderStagesJobCellActivityFooterWithCtx,
  renderStagesQuickActionsStack as renderStagesQuickActionsStackWithCtx,
  STAGES_TABLE_MIN_WIDTH,
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
  /** Phone rows (punch list #30, PR 2a): the card lists render two-line rows instead of cards. */
  phoneRows?: StagesPhoneRowsMode
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
  stagesWorkedByJobId: StagesRowRenderContext['stagesWorkedByJobId']
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

/**
 * Everything a row component reads (Stages tab decomposition PR 10, v2.3548): the table's
 * props after defaults, plus the helpers it builds once per render. The two row files
 * destructure only what they use.
 */
export type StagesUnifiedRowContext = Omit<JobsStagesUnifiedTableProps, 'jobSendBackLabel' | 'invoiceBundleActionLabel' | 'invoiceStandaloneActionLabel' | 'flashInvoiceId' | 'showClickTooling'> &
  Required<Pick<JobsStagesUnifiedTableProps, 'jobSendBackLabel' | 'invoiceBundleActionLabel' | 'invoiceStandaloneActionLabel' | 'flashInvoiceId' | 'showClickTooling'>> & {
    openTestReportFor: (job: JobWithDetails) => void
    stagesRowSharedCtx: StagesRowRenderContext
    renderStagesFieldAndBillingLines: (job: JobWithDetails) => ReactNode
    renderJobCustomerLine: (job: JobWithDetails) => ReactNode
    renderStagesJobCellActivityFooter: (job: JobWithDetails, billingLineForStripeHint?: JobsLedgerInvoice | null, opts?: { hideReportsButton?: boolean }) => ReactNode
    renderStagesQuickActionsStack: (job: JobWithDetails) => ReactNode
    renderJobNoteLine: (j: JobWithDetails) => ReactNode
    unifiedStagesColCount: number
    flashRowStyle: (invoiceId: string) => CSSProperties
    stagesSecondaryOutlineButtonBase: CSSProperties
    stagesCellButtonRowStyle: CSSProperties
    stagesCellButtonStyle: CSSProperties
    stagesInvoiceHcpBadgeStyle: CSSProperties
    threadRowShared: StagesExpandedThreadRowShared
    wideViewport: boolean
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
    jobSendBackLabel = 'Send back',
    invoiceBundleActionLabel = 'Remove line',
    invoiceStandaloneActionLabel = 'Send back',
    flashInvoiceId = null,
    showClickTooling = true,
    jobNoteLine,
    pctCompleteSavingId,
    commitStagesPctWithNote,
    canEditJobPctComplete,
    canManageJobPeople,
    setManageJobPeople,
    jobThreadNotesLoadingId,
    submitJobThreadNoteWithBody,
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
    stagesWorkedByJobId,
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
    stagesWorkedByJobId,
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
    stagesWorkedByJobId,
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

  const rowCtx: StagesUnifiedRowContext = {
    ...props,
    jobSendBackLabel,
    invoiceBundleActionLabel,
    invoiceStandaloneActionLabel,
    flashInvoiceId,
    showClickTooling,
    openTestReportFor,
    stagesRowSharedCtx,
    renderStagesFieldAndBillingLines,
    renderJobCustomerLine,
    renderStagesJobCellActivityFooter,
    renderStagesQuickActionsStack,
    renderJobNoteLine,
    unifiedStagesColCount,
    flashRowStyle,
    stagesSecondaryOutlineButtonBase,
    stagesCellButtonRowStyle,
    stagesCellButtonStyle,
    stagesInvoiceHcpBadgeStyle,
    threadRowShared,
    wideViewport,
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
            rows.map((row) =>
              row.kind === 'invoice' ? (
                <StagesUnifiedInvoiceRow key={stagesUnifiedRowKey(row)} row={row} t={rowCtx} />
              ) : (
                <StagesUnifiedJobRow key={stagesUnifiedRowKey(row)} row={row} t={rowCtx} />
              ),
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
