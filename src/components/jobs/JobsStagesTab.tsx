import {
  Fragment,
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ForwardedRef,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatCurrencyAbbrevTruncated, formatCurrencyNoCents, formatJobNameTwoLines } from '../../lib/jobs/jobFormatting'
import { useJobFollowupQueueCount } from '../../hooks/useJobFollowupQueueCount'
import { JobsGcReviewModal } from './JobsGcReviewModal'
import SendBackReasonField from './SendBackReasonField'
import { ensureRemainderResyncOutcome } from '../../lib/jobs/ensureRtbRemainderResult'
import { sendBackReasonError } from '../../lib/jobs/jobSendBackNote'
import {
  SEND_BACK_REWORK_REASON,
  SEND_BACK_STAGE_BILLED_REASON,
  sendBackJobBillingContext,
  sendBackRequiresVoidAttestation,
  type SendBackJobBillingContext,
} from '../../lib/jobs/jobSendBackContext'
import { postSendBackReasonNote } from '../../lib/jobs/postSendBackReasonNote'
import { JobsWeeklyMovementModal } from './JobsWeeklyMovementModal'
import { JobsWeeklyMoneyModal } from './JobsWeeklyMoneyModal'
import { buildGcStatementReportHtml } from '../../lib/jobsDocuments/gcStatementReport'
import { buildGcReviewRollup } from '../../lib/gcReviewRollup'
import { gcReviewWeekStartYmd, latestCertByGc, type GcReviewCertRow } from '../../lib/jobs/gcReviewCertification'
import { listGcReviewCertifications } from '../../lib/gcReviewCertifications'
import {
  buildStatementRound,
  deriveGcAccountMen,
  summarizeStatementRound,
  type RoundMarkRow,
} from '../../lib/jobs/gcStatementRounds'
import { listGcStatementRoundMarks, listGcStatementSenders } from '../../lib/gcStatementRoundIo'
import {
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcStatementEmailSubject,
} from '../../lib/jobsDocuments/gcStatementEmail'
import { getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import StagesSectionToolsIcon from '../icons/StagesSectionToolsIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import AccountManIcon from '../icons/AccountManIcon'
import {
  billedStageRowAgingBucket,
  billedStageRowHasNoBillLine,
  buildBilledAgingBuckets,
  buildBilledNoLineBucket,
  effectiveInvoiceEstBillDate,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
} from '../../lib/jobs/invoiceBilling'
import {
  billedExpectedPayModel,
  parsePaySpeedsRpc,
  parsePromisedPayDatesRpc,
  type PaySpeedData,
  type PromisedPayDate,
} from '../../lib/jobs/billedExpectedPay'
import BilledExpectedPayChip from './BilledExpectedPayChip'
import SetPromisedPayDateModal from './SetPromisedPayDateModal'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import JobContractModal from './JobContractModal'
import JobSignedAgreementModal, { type SignedCoverage } from './JobSignedAgreementModal'
import JobsContractSweepModal from './JobsContractSweepModal'
import {
  buildJobContractCoverage,
  filterJobsByContractCoverage,
  parseStagesContractFilter,
  STAGES_CONTRACT_FILTER_LABELS,
  STAGES_CONTRACT_FILTERS,
  type JobContractRowLike,
  type SignedEstimateLike,
  type StagesContractFilter,
} from '../../lib/jobs/jobContractCoverage'
import { PipelineOverview } from './PipelineOverview'
import { useSendBackCollectPaymentFlowNotice } from '../../hooks/useSendBackCollectPaymentFlowNotice'
import { useArBankUnallocatedCount } from '../../hooks/useArBankUnallocatedCount'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAuth } from '../../hooks/useAuth'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildBilledAwaitingPaymentReportHtml } from '../../lib/jobsDocuments/billedAwaitingPaymentReport'
import { ManageJobPeopleModal } from './ManageJobPeopleModal'
import { JobCalendarModal } from './JobCalendarModal'
import { JobsStagesActivityExpandModal } from './JobsStagesActivityExpandModal'
import { calendarYmdInAppTzFromIso, companyWeekStartSundayContaining, getDefaultWeekRange } from '../../utils/dateUtils'
import { fetchStagesUpcomingScheduleForJobs, type StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import JobsStagesTable from './JobsStagesTable'
import JobsStagesUnifiedTable from './JobsStagesUnifiedTable'
import JobsStagesCardList, { JobsStagesUnifiedCardList } from './JobsStagesCardList'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import BankPaymentsModal from './BankPaymentsModal'
import PaidInFullEmailSettingsModal from './PaidInFullEmailSettingsModal'
import BilledAgingChartModal from './BilledAgingChartModal'
import BilledPaymentForecastModal from './BilledPaymentForecastModal'
import PaymentChaseModal from './PaymentChaseModal'
import { buildPaymentChaseQueue, parseChaseTouchesRpc, summarizePaymentChase, type ChaseTouch } from '../../lib/jobs/paymentChase'
import type { StagesMoneyMoveKey } from '../../lib/jobs/stagesMoneyMoveLink'
import FixBillLinesModal from './FixBillLinesModal'
import { buildFixBillLineItems } from '../../lib/jobs/fixBillLines'
import BilledByCustomerBreakdownModal from './BilledByCustomerBreakdownModal'
import PaidProfitChartModal from './PaidProfitChartModal'
import BilledReportShareModal from './BilledReportShareModal'
import PaymentForecastShareModal from './PaymentForecastShareModal'
import JobBookModal from './JobBookModal'
import JobsCombineSeparateModal from './JobsCombineSeparateModal'
import StagesNoCustomerJobsModal from './StagesNoCustomerJobsModal'
import StagesAlertJobListModal from './StagesAlertJobListModal'
import BilledPaymentConfirmationModal from './BilledPaymentConfirmationModal'
import BilledBillViewModal from './BilledBillViewModal'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import LienToolingPrefillModal from './LienToolingPrefillModal'
import LienInstrumentsModal from './LienInstrumentsModal'
import LienReleaseModal from './LienReleaseModal'
import AiaG702G703Modal from './AiaG702G703Modal'
import { HazmatFeeModal, type HazmatFeeModalJob } from './HazmatFeeModal'
import { ScheduleJobModal } from './ScheduleJobModal'
import { jobWithDetailsToQuickAssignHubRow } from '../../lib/jobs/quickAssignFromPipeline'

/** Dispatch "Assign work" sheet, loaded on first use — keeps dispatch-mode code out of the Jobs bundle. */
const QuickAssignSheet = lazy(() => import('../dispatchMode/QuickAssignSheet'))
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRow } from '../../pages/Jobs'
import type { OpenEditJobOptions } from '../../contexts/JobFormModalContext'
import {
  clearReturnEditJobFromStages,
  peekReturnEditJobFromStages,
} from '../../lib/returnEditJobFromStages'
import { DELETE_DRAFT_BILL_LABEL } from '../../lib/deleteDraftBillLabel'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatMoveIntoStageByOnLine } from '../../lib/formatMoveIntoStageByOnLine'
import {
  invoiceNeedsStripeVoidForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { runJobsStagesSerializedPipeline } from '../../lib/jobsStagesSerializedPipeline'
import {
  buildJobsStagesBoardLists,
  filterJobsByGcCustomer,
  gcFilterOptionsFromJobs,
  STAGES_GC_FILTER_NO_GC,
  developmentFilterOptionsFromJobs,
  filterJobsByDevelopment,
  STAGES_DEVELOPMENT_FILTER_NONE,
  accountManFilterOptionsFromJobs,
  filterJobsByAccountMan,
  STAGES_ACCOUNT_MAN_FILTER_NONE,
  clampPartialInvoiceCentsToUnallocated,
  jobPartialInvoiceRemainingDollars,
  locateStagesInvoiceSection,
  readyToBillRowsExposureTotal,
  stagesInvoiceVisibleWithEmptySearch,
  stagesJobsWithoutCustomerFromFiltered,
  stagesSectionKeyForJobStatus,
  jobInCollections,
  stagesReadyToBillJobsWithoutEmail,
  stagesWorkingJobsWithoutPicturesFromWorking,
  type InvoiceWithJob,
  type StageRow,
  buildCapableToBillBreakdownRows,
  capableToBillTotalFromWorking,
} from '../../lib/jobsStagesBoard'
import {
  countStagesExclusions,
  filterJobsByExclusions,
  loadStagesExcludeFilters,
  saveStagesExcludeFilters,
  type StagesExcludeFilters,
} from '../../lib/jobsStagesExcludeFilters'
import {
  STAGES_SORT_MODE_LABELS,
  STAGES_SORT_MODES,
  loadStagesSortMode,
  saveStagesSortMode,
  type StagesBoardSortMode,
} from '../../lib/jobsStagesSortMode'
import { stagesJumpStripCount } from '../../lib/jobs/stagesJumpStrip'
import JobsRecentlyAddedList from './JobsRecentlyAddedList'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import JobsStagesHideGroupsModal from './JobsStagesHideGroupsModal'
import { StagesJobNumberJumpChip } from './StagesJobNumberJumpChip'
import { StagesSearchHighlightProvider, StagesSearchMark } from './StagesSearchMark'
import SessionNotesModal from './SessionNotesModal'
import { SessionNotesOpenerContext } from './sessionNotesOpenerContext'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'
import { findJobsByNumber, stagesSectionKeyForJobRow } from '../../lib/jobs/stagesJobNumberJump'
import { NON_PAID_SCOPES } from '../../lib/jobs/boardScopes'
import { fetchLeanJobIdsByNumber, fetchLeanJobSearchIds } from '../../lib/jobs/leanJobSearch'
import { fetchJobsLedgerWithDetailsForStages } from '../../lib/fetchJobsLedgerWithDetailsForStages'
import {
  readStagesSectionOpenPrefs,
  scopeForStagesSection,
  writeStagesSectionOpenPrefs,
  type StagesSectionOpenState,
} from '../../lib/jobs/stagesSectionPrefs'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { buildStagesSectionToolsMenu, type StagesSectionToolKey } from '../../lib/jobs/stagesSectionToolsMenu'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { extractContactFromCustomer } from '../../lib/jobs/jobFormCustomerDisplay'
import { setJobCollectionsFlag } from '../../lib/setJobCollectionsFlag'
import {
  fetchJobIdsMatchingScheduleOrClockSessions,
  parseStagesIncludeScheduleTimePref,
  shouldFetchStagesScheduleSessionSearch,
  STAGES_INCLUDE_SCHEDULE_TIME_STORAGE_KEY,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from '../../lib/jobsStagesScheduleSessionSearch'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { JobsFollowupModal, type JobsFollowupStageRowResult } from './JobsFollowupModal'
import { followupStagesCoveredByScopes } from '../../lib/jobs/jobFollowupQueue'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * The Stages tab surface — Jobs.tsx decomposition steps 9b+9c
 * (docs/JOBS_TABS_ARCHITECTURE.md). Behavior-preserving move of the
 * `activeTab === 'stages'` block (toolbar + jump nav + loading block + the
 * section-wiring IIFE + the three inline modals), the Stages-owned state
 * cluster, and the Stages-only modal tail out of src/pages/Jobs.tsx. This
 * component is the single caller of JobsStagesTable / JobsStagesUnifiedTable.
 *
 * ALWAYS MOUNTED: the page renders it unconditionally and passes
 * `active={activeTab === 'stages'}`. The Stages-owned state used to live at
 * page level and survived tab switches; keeping the component mounted (body
 * gated on `active`, the modal tail rendered regardless — exactly the
 * always-rendered shape it had in the page's modal tail) preserves those
 * semantics. Effects that were keyed on `activeTab === 'stages'` are keyed on
 * `active` verbatim.
 *
 * The page keeps the URL deep-link router, the jobs cache wiring, `customers`
 * / `users`, the app modal contexts, and the seam-hook call sites
 * (useJobsStagesMutations / useJobThreadNotes), and drives tab-owned state
 * through the imperative handle below (followMovedJob + the deep-link focus
 * methods).
 */
export type JobsStagesTabHandle = {
  /** "Follow cards I move": input to the page-side useJobsStagesMutations hook. */
  followMovedJob: (jobId: string, toStatus: string) => void
  /** `?stagesSection=` deep link: open + scroll to a section. */
  focusSection: (key: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections') => void
  /** `?stagesJob=` deep link: open the job's section, scroll + flash the row (toast when absent). */
  focusJob: (jobId: string) => void
  /** `?stagesInvoice=` deep link: focus + flash an invoice row (false when not on the board). */
  focusInvoice: (invoiceId: string) => boolean
  /** `?openBankPayments=` deep link: open the Accounts Receivable modal. */
  openBankPayments: () => void
  /** `?stagesWeekly=` deep link: open the Weekly movement modal (v2.1436). */
  openWeeklyMovement: () => void
  /** `?stagesMoney=` deep link: open the Weekly money movement modal (v2.1443). */
  openWeeklyMoney: () => void
  /** `?showBilledTotalByName=` deep link: open the Total by Name modal. */
  showBilledTotalByName: () => void
  /** `?stagesMove=` deep link (v2.2145): open what a Today's Money Opportunities card opens (Quickfill → Jobs Cleanup). */
  openMoneyMove: (key: StagesMoneyMoveKey) => void
}

export type JobsStagesTabProps = {
  /** `activeTab === 'stages'` — gates the rendered surface and the tab-keyed effects; state persists across tab switches. */
  active: boolean
  // --- page-global error (quirk #7) ---
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  // --- jobs cache wiring (stays in the page / JobsListCacheContext) ---
  jobs: JobWithDetails[]
  jobsListLoading: boolean
  jobsListRefreshing: boolean
  jobsListError: string | null
  paidJobsLoading: boolean
  jobsListDataKey: string | null
  paidJobsMergedForKey: string | null
  loadJobs: () => Promise<JobWithDetails[] | undefined>
  runFetchJobs: (customerFilter: string | null) => Promise<JobWithDetails[] | undefined>
  fetchPaidJobsIfNeeded: (customerFilter: string | null) => Promise<void>
  customerFilterForFetch: string | null
  scheduleLoadJobsAfterMutation: () => void
  // --- identity / roster / shared page context ---
  authUser: ReturnType<typeof useAuth>['user']
  authRole: ReturnType<typeof useAuth>['role']
  authProfileName: ReturnType<typeof useAuth>['profileName']
  myRole: string | null
  users: UserRow[]
  customers: StagesRowRenderContext['customers']
  showToast: StagesRowRenderContext['showToast']
  shortNewJobButtonLabel: boolean
  // --- page callbacks over the app modal contexts ---
  openNew: () => void
  openEdit: (job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean; fixturesSectionHighlight?: boolean }) => void
  openEditJobAndCreateCustomerFlow: (job: JobWithDetails) => void
  tryOpenEditJob: (jobId: string, options?: OpenEditJobOptions) => void
  openStagesDetailJobModal: (j: JobWithDetails) => void
  refreshCustomersAfterJobFormSave: () => void
  billCustomer: ReturnType<typeof useBillCustomerModal>
  // --- useJobsStagesMutations values (hook called in the page; followMovedJob flows back via the handle) ---
  stagesStatusUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesStatusUpdatingId']
  stagesInvoiceUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesInvoiceUpdatingId']
  updateJobStatus: ReturnType<typeof useJobsStagesMutations>['updateJobStatus']
  moveJobToReadyToBillWithStripePrep: ReturnType<typeof useJobsStagesMutations>['moveJobToReadyToBillWithStripePrep']
  revertBilledInvoiceToReadyToBill: ReturnType<typeof useJobsStagesMutations>['revertBilledInvoiceToReadyToBill']
  deleteInvoice: ReturnType<typeof useJobsStagesMutations>['deleteInvoice']
  invoiceEstimatedBillDateSavingId: ReturnType<typeof useJobsStagesMutations>['invoiceEstimatedBillDateSavingId']
  setInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['setInvoiceEstimatedBillDate']
  bumpInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['bumpInvoiceEstimatedBillDate']
  pctCompleteSavingId: ReturnType<typeof useJobsStagesMutations>['pctCompleteSavingId']
  updateJobPctComplete: ReturnType<typeof useJobsStagesMutations>['updateJobPctComplete']
  commitStagesPctWithNote: ReturnType<typeof useJobsStagesMutations>['commitStagesPctWithNote']
  // --- useJobThreadNotes values (hook called in the page; shared with Job Summary) ---
  expandedJobThreadId: ReturnType<typeof useJobThreadNotes>['expandedJobThreadId']
  setExpandedJobThreadId: ReturnType<typeof useJobThreadNotes>['setExpandedJobThreadId']
  jobThreadFullscreen: ReturnType<typeof useJobThreadNotes>['jobThreadFullscreen']
  setJobThreadFullscreen: ReturnType<typeof useJobThreadNotes>['setJobThreadFullscreen']
  openJobThreadFullscreen: ReturnType<typeof useJobThreadNotes>['openJobThreadFullscreen']
  jobThreadActivityByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadActivityByJobId']
  jobThreadNotesLoadingId: ReturnType<typeof useJobThreadNotes>['jobThreadNotesLoadingId']
  jobThreadSubmittingId: ReturnType<typeof useJobThreadNotes>['jobThreadSubmittingId']
  jobThreadDraft: ReturnType<typeof useJobThreadNotes>['jobThreadDraft']
  setJobThreadDraft: ReturnType<typeof useJobThreadNotes>['setJobThreadDraft']
  submitJobThreadNote: ReturnType<typeof useJobThreadNotes>['submitJobThreadNote']
  /** Body-based note submit + lazy activity loader — the wide-screen Job activity box (v2.1587) needs both. */
  submitJobThreadNoteWithBody?: ReturnType<typeof useJobThreadNotes>['submitJobThreadNoteWithBody']
  loadJobThreadNotesForJob?: ReturnType<typeof useJobThreadNotes>['loadJobThreadNotesForJob']
  jobThreadStatsByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadStatsByJobId']
  refreshJobThreadStatsForJobIds: ReturnType<typeof useJobThreadNotes>['refreshJobThreadStatsForJobIds']
}

/** Active-filter chip in the search bar (v2.1232): the GC/development selects
    live in the ⋯ tools menu now, so an applied filter must announce itself —
    a filtered board with no visible cause reads as missing jobs. Tap clears. */
/** Billed-header quiet action tier (v2.1311): uniform 28px, one visual step below the title. */
const billedHeaderActionStyle = (disabled: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  flexShrink: 0,
  height: 28,
  padding: '0 0.6rem',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: disabled ? 'var(--bg-muted)' : 'var(--surface)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
})

const stagesActiveFilterChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  flexShrink: 0,
  maxWidth: 'clamp(6rem, 30vw, 12rem)',
  padding: '0.2rem 0.6rem',
  border: 'none',
  borderRadius: 999,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-link)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const stagesToolsMenuFilterSelectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  textOverflow: 'ellipsis',
  cursor: 'pointer',
}

const stagesToolsMenuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.875rem',
  color: 'var(--text-gray-800)',
  textAlign: 'left',
  borderRadius: 4,
  whiteSpace: 'nowrap',
}

function renderStagesToolsMenuToggleState(on: boolean) {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        padding: '0.1rem 0.45rem',
        borderRadius: 999,
        background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
        color: on ? 'var(--text-link)' : 'var(--text-faint)',
      }}
    >
      {on ? 'On' : 'Off'}
    </span>
  )
}

const JobsStagesTab = forwardRef(function JobsStagesTabInner(
  props: JobsStagesTabProps,
  ref: ForwardedRef<JobsStagesTabHandle>,
) {
  const {
    active,
    error,
    setError,
    jobs,
    jobsListLoading,
    jobsListRefreshing,
    jobsListError,
    paidJobsLoading,
    jobsListDataKey,
    paidJobsMergedForKey,
    loadJobs,
    runFetchJobs,
    fetchPaidJobsIfNeeded,
    customerFilterForFetch,
    scheduleLoadJobsAfterMutation,
    authUser,
    authRole,
    authProfileName,
    myRole,
    users,
    customers,
    showToast,
    shortNewJobButtonLabel,
    openNew,
    openEdit,
    openEditJobAndCreateCustomerFlow,
    tryOpenEditJob,
    openStagesDetailJobModal,
    refreshCustomersAfterJobFormSave,
    billCustomer,
    stagesStatusUpdatingId,
    stagesInvoiceUpdatingId,
    updateJobStatus,
    moveJobToReadyToBillWithStripePrep,
    revertBilledInvoiceToReadyToBill,
    deleteInvoice,
    invoiceEstimatedBillDateSavingId,
    setInvoiceEstimatedBillDate,
    bumpInvoiceEstimatedBillDate,
    pctCompleteSavingId,
    updateJobPctComplete,
    commitStagesPctWithNote,
    expandedJobThreadId,
    setExpandedJobThreadId,
    jobThreadFullscreen,
    setJobThreadFullscreen,
    openJobThreadFullscreen,
    jobThreadActivityByJobId,
    jobThreadNotesLoadingId,
    jobThreadSubmittingId,
    jobThreadDraft,
    setJobThreadDraft,
    submitJobThreadNote,
    submitJobThreadNoteWithBody,
    loadJobThreadNotesForJob,
    jobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds,
  } = props
  /** Read-only here (loading block + return-to-edit banner); the URL router that WRITES params stays in Jobs.tsx. */
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Full-page Job activity modal — opened by the activity box's corner expand
  // button and the row's "N Reports" chip. One instance for the whole board.
  const [activityExpandJob, setActivityExpandJob] = useState<JobWithDetails | null>(null)
  const openJobActivityExpand = useCallback(
    (job: JobWithDetails) => {
      if (loadJobThreadNotesForJob) void loadJobThreadNotesForJob(job.id)
      setActivityExpandJob(job)
    },
    [loadJobThreadNotesForJob],
  )

  const canOpenJobScheduleModal = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'superintendent',
    [authRole],
  )
  // Matches the jobs_ledger UPDATE RLS (dev / master_technician / assistant / primary)
  // — who may set a job's % complete from the Stages expanded panel.
  const canEditJobPctComplete = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary',
    [authRole],
  )
  // Matches the jobs_ledger_team_members INSERT/DELETE RLS (dev / master_technician /
  // assistant only) — who may add or remove people from a job.
  const canManageJobPeople = useMemo(
    () => authRole === 'dev' || authRole === 'master_technician' || authRole === 'assistant',
    [authRole],
  )
  const [manageJobPeople, setManageJobPeople] = useState<
    { jobId: string; jobLabel: string; currentTeamUserIds: string[] } | null
  >(null)

  /** Set after Ready to Bill → See in Stages; cleared on timeout, dismiss, tab change, or reopening Edit Job. */
  const [returnEditBannerJobId, setReturnEditBannerJobId] = useState<string | null>(null)

  const [createPartialInvoiceJob, setCreatePartialInvoiceJob] = useState<JobWithDetails | null>(null)
  const [scheduleModalJob, setScheduleModalJob] = useState<JobWithDetails | null>(null)
  /** Job the dispatch "Assign work" sheet is open for (the schedule quick action). */
  const [quickAssignJob, setQuickAssignJob] = useState<JobWithDetails | null>(null)
  const openQuickAssignForJob = useCallback((j: JobWithDetails) => setQuickAssignJob(j), [])
  const [calendarJob, setCalendarJob] = useState<JobWithDetails | null>(null)
  // Next upcoming schedule appointment per job (the Activity column "Next:" line).
  const [stagesUpcomingByJobId, setStagesUpcomingByJobId] = useState<Record<string, StagesUpcomingAppointment>>({})
  useEffect(() => {
    const ids = jobs.map((j) => j.id)
    if (ids.length === 0) {
      setStagesUpcomingByJobId({})
      return
    }
    let cancelled = false
    void fetchStagesUpcomingScheduleForJobs(ids, scheduleTodayDateKey()).then((m) => {
      if (!cancelled) setStagesUpcomingByJobId(m)
    })
    return () => {
      cancelled = true
    }
  }, [jobs])
  /** Day highlighted in the Job Calendar when Schedule… was clicked — seeds ScheduleJobModal's date. */
  const [scheduleModalInitialDate, setScheduleModalInitialDate] = useState<string | null>(null)
  const [createPartialInvoiceAmount, setCreatePartialInvoiceAmount] = useState('')
  const [creatingPartialInvoiceFromModal, setCreatingPartialInvoiceFromModal] = useState(false)

  // Stages board: man-hours applied per job (lightweight get_man_hours_by_job RPC; mirrors teamLabor.ts math).
  const [stagesManHoursRows, setStagesManHoursRows] = useState<
    Array<{ job_id: string; person_name: string; man_hours: number }>
  >([])
  const [stagesManHoursLoading, setStagesManHoursLoading] = useState(false)
  const stagesManHoursLoadedRef = useRef(false)

  const [pendingStagesInvoiceFocusId, setPendingStagesInvoiceFocusId] = useState<string | null>(null)
  const [stagesInvoiceFlashId, setStagesInvoiceFlashId] = useState<string | null>(null)
  // "Follow cards I move": scroll to + flash a job row after a stage move (invoice-focus idiom).
  const [pendingStagesJobFocusId, setPendingStagesJobFocusId] = useState<string | null>(null)
  const [stagesJobFlashId, setStagesJobFlashId] = useState<string | null>(null)
  // v2.1824 (plan PR 3): per-device persistence — whatever you leave open is
  // what next visit fetches. Fresh devices open Ready to Bill only.
  const [stagesSectionOpen, setStagesSectionOpen] = useState<StagesSectionOpenState>(() => readStagesSectionOpenPrefs())
  useEffect(() => {
    writeStagesSectionOpenPrefs(stagesSectionOpen)
  }, [stagesSectionOpen])
  /**
   * Scope machinery straight from the cache context (the page threads the
   * pre-scope fields as props; the v2.1823 scope API is read here directly to
   * spare a five-layer prop drill).
   */
  const {
    mergedScopes: cacheMergedScopes,
    scopeLoading: cacheScopeLoading,
    fetchScopeIfNeeded: cacheFetchScopeIfNeeded,
    headerStats: cacheHeaderStats,
    leanBilledRows: cacheLeanBilledRows,
    setJobs: cacheSetJobs,
  } = useJobsListCache()
  // Fetch-on-expand: any open section whose scope isn't merged kicks its fetch
  // (idempotent; the context guards in-flight and merged states).
  useEffect(() => {
    if (!active) return
    for (const section of Object.keys(stagesSectionOpen) as Array<keyof StagesSectionOpenState>) {
      if (!stagesSectionOpen[section]) continue
      void cacheFetchScopeIfNeeded(scopeForStagesSection(section), customerFilterForFetch)
    }
  }, [active, stagesSectionOpen, cacheMergedScopes, customerFilterForFetch, cacheFetchScopeIfNeeded])

  const [billedTotalByNameModalOpen, setBilledTotalByNameModalOpen] = useState(false)
  /** Session notes: null = closed; `job` = the pinned job when opened from a row's "Sessions" door. */
  const [sessionNotesModal, setSessionNotesModal] = useState<{ job: SessionNotesJobIdentity | null } | null>(null)
  const [gcReviewModalOpen, setGcReviewModalOpen] = useState(false)
  /** Personal statement rounds (v2.2072): open GC Review straight into the round overlay. */
  const [gcReviewStartRound, setGcReviewStartRound] = useState(false)
  const [weeklyMovementModalOpen, setWeeklyMovementModalOpen] = useState(false)
  const [weeklyMoneyModalOpen, setWeeklyMoneyModalOpen] = useState(false)
  /** "Last sent" hints for GC Review's Email… (v2.1416). Best-effort: table may predate the db push. */
  const [gcLastSentByGcId, setGcLastSentByGcId] = useState<Record<string, string>>({})
  const refreshGcLastSent = useCallback(async () => {
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('gc_statement_emails')
            .select('gc_customer_id, sent_at')
            .order('sent_at', { ascending: false })
            .limit(500),
        'gc statement last-sent hints',
      )
      const map: Record<string, string> = {}
      for (const r of (rows ?? []) as Array<{ gc_customer_id: string | null; sent_at: string }>) {
        if (r.gc_customer_id && !map[r.gc_customer_id]) map[r.gc_customer_id] = r.sent_at
      }
      setGcLastSentByGcId(map)
    } catch {
      setGcLastSentByGcId({})
    }
  }, [])
  useEffect(() => {
    if (gcReviewModalOpen) void refreshGcLastSent()
  }, [gcReviewModalOpen, refreshGcLastSent])
  const [billedTotalByNameExpandedName, setBilledTotalByNameExpandedName] = useState<string | null>(null)
  const [stagesNoCustomerModalOpen, setStagesNoCustomerModalOpen] = useState(false)
  const [stagesNoJobPicturesModalOpen, setStagesNoJobPicturesModalOpen] = useState(false)
  const [jobBookModalOpen, setJobBookModalOpen] = useState(false)
  const [combineSeparateModalOpen, setCombineSeparateModalOpen] = useState(false)
  // "⋯" tools menu right of the Stages search (v2.1049) — home of every
  // toolbar control that is not New Job or search.
  const [stagesToolsMenuOpen, setStagesToolsMenuOpen] = useState(false)
  const [stagesSectionToolsMenuOpen, setStagesSectionToolsMenuOpen] = useState(false)
  const [capableToBillModalOpen, setCapableToBillModalOpen] = useState(false)
  const [whenInvoiceBillModal, setWhenInvoiceBillModal] = useState<{
    invoiceId: string
    jobId: string
    jobName: string
    hcpNumber: string
  } | null>(null)
  const [whenInvoiceBillModalDate, setWhenInvoiceBillModalDate] = useState('')
  const [stagesSearchQuery, setStagesSearchQuery] = useState('')
  const [stagesSearchExtraJobIds, setStagesSearchExtraJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const [stagesServerSearchIds, setStagesServerSearchIds] = useState<ReadonlySet<string>>(() => new Set())
  const [stagesServerSearchBusy, setStagesServerSearchBusy] = useState(false)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const stagesCombinedExtraJobIds = useMemo(() => {
    if (stagesServerSearchIds.size === 0) return stagesSearchExtraJobIds
    const u = new Set(stagesSearchExtraJobIds)
    for (const id of stagesServerSearchIds) u.add(id)
    return u
  }, [stagesSearchExtraJobIds, stagesServerSearchIds])
  const [stagesScheduleSessionSearchBusy, setStagesScheduleSessionSearchBusy] = useState(false)
  // stagesStatusUpdatingId / stagesInvoiceUpdatingId / stagesInvoiceMutationLockRef and the
  // invoiceEstimatedBillDateSavingId / pctCompleteSavingId busy flags live in
  // useJobsStagesMutations (v2.828) — they arrive here as props from the page.
  const stagesInvoiceSendBackConfirmLockRef = useRef(false)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [markPaidJob, setMarkPaidJob] = useState<JobWithDetails | null>(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceWithJob | null>(null)
  const [bankPaymentsModalOpen, setBankPaymentsModalOpen] = useState(false)
  /** ⚙ across from the Paid in Full header: "Customer paid" email recipients + preview/test (v2.965). */
  const [paidEmailSettingsOpen, setPaidEmailSettingsOpen] = useState(false)
  const [paymentEmailSettingsOpen, setPaymentEmailSettingsOpen] = useState(false)
  const [readyToBillNotifySettingsOpen, setReadyToBillNotifySettingsOpen] = useState(false)
  const [billedShareModalOpen, setBilledShareModalOpen] = useState(false)
  const [billedAgingChartOpen, setBilledAgingChartOpen] = useState(false)
  const [billedPaymentForecastOpen, setBilledPaymentForecastOpen] = useState(false)
  /** Email… on the Payment forecast header (v2.2226) — the payment_forecast stream's share modal. */
  const [forecastShareModalOpen, setForecastShareModalOpen] = useState(false)
  // WAITING ON CUSTOMERS card → "who owes what" breakdown (v2.1929).
  const [billedBreakdownOpen, setBilledBreakdownOpen] = useState(false)
  // The three billed money modals (aging chart / payment forecast / who owes
  // what) work from a collapsed section too: while any is open, keep kicking
  // the scope fetches until they merge — a one-shot call no-ops when the base
  // board fetch is still in flight (fetchScopeIfNeeded's loadInFlight guard),
  // so this mirrors the fetch-on-expand effect's retry-on-cache-change shape.
  // ALL non-paid scopes, not just billed (v2.2035's chase-queue fix): billed
  // invoices hang on working/waiting jobs too (a part-billed Working job is
  // exactly the bill that falls through cracks), and the board kernel routes
  // them into the billed section only when their job's scope is loaded.
  const billedMoneyModalOpen = billedAgingChartOpen || billedPaymentForecastOpen || billedBreakdownOpen
  useEffect(() => {
    if (!billedMoneyModalOpen) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [billedMoneyModalOpen, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
  // Same retry-until-merged shape for the paid profit chart (v2.1879).
  const [paidProfitChartOpen, setPaidProfitChartOpen] = useState(false)
  useEffect(() => {
    if (!paidProfitChartOpen) return
    void cacheFetchScopeIfNeeded(scopeForStagesSection('paid'), customerFilterForFetch)
  }, [paidProfitChartOpen, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
  // Billed header aging-chip filter (v2.1311): null = all rows; a bucket key
  // narrows the section list to rows the matching chip counts. 'no_line'
  // (v2.1931) = open rows with no bill line to age by — the shells the
  // Pipeline money card's "no bill line" money move points at.
  const [billedAgingFilter, setBilledAgingFilter] = useState<'30_90' | '90' | 'no_line' | null>(null)
  // "Fix bill lines" one-sitting modal (v2.1933): creates each shell's
  // missing billed line via create_billed_shell_invoice, backdated.
  const [fixBillLinesOpen, setFixBillLinesOpen] = useState(false)
  const { count: arBankTxUnallocatedCount } = useArBankUnallocatedCount({
    enabled: active,
    authUserId: authUser?.id,
    authRole,
    bankPaymentsModalOpen,
  })
  // Phones stack the Billed Awaiting Payment header: title / aging summary /
  // buttons on three rows, instead of squeezing the title to shreds beside the
  // Accounts Receivable + Print buttons.
  const isMobile = useIsMobile()
  const [viewBillInvoice, setViewBillInvoice] = useState<InvoiceWithJob | null>(null)
  const [lienToolingPrefillModal, setLienToolingPrefillModal] = useState<{
    job: JobWithDetails
    invoice: JobsLedgerInvoice | null
  } | null>(null)
  /** Lien instruments (v2.2640): the orange lien icon's new home — in-app demand letter; external prefill kept as fallback. */
  const [lienInstrumentsModal, setLienInstrumentsModal] = useState<{
    job: JobWithDetails
    invoice: JobsLedgerInvoice | null
  } | null>(null)
  // Jobs with a live SENT demand letter — the lien icon wears an amber box.
  const [demandOutJobIds, setDemandOutJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadDemandOutJobIds = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('job_demand_letters')
        .select('job_id')
        .is('voided_at', null)
        .not('sent_at', 'is', null)
      setDemandOutJobIds(new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id)))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [])
  useEffect(() => {
    void loadDemandOutJobIds()
  }, [loadDemandOutJobIds])
  // Contract coverage (Contract Desk PR 1): one job_contracts scan + one
  // customer-accepted estimates scan, folded per job by the coverage kernel.
  // Office-only read-back; a fetch failure leaves rows chipless.
  const canSeeJobContracts =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const [jobContractRows, setJobContractRows] = useState<JobContractRowLike[]>([])
  const [signedEstimateRows, setSignedEstimateRows] = useState<SignedEstimateLike[]>([])
  const loadJobContractCoverage = useCallback(async () => {
    if (!canSeeJobContracts) return
    try {
      const [contractsRes, estimatesRes] = await Promise.all([
        supabase
          .from('job_contracts')
          .select('id, job_id, status, revision, recipient_email, sent_at, last_sent_at, view_count, signed_at, signer_printed_name, signer_mode, voided_at')
          .is('voided_at', null),
        supabase
          .from('estimates')
          .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
          .eq('status', 'customer_accepted')
          .not('acceptor_consented_at', 'is', null),
      ])
      if (!contractsRes.error) setJobContractRows((contractsRes.data ?? []) as JobContractRowLike[])
      if (!estimatesRes.error) setSignedEstimateRows((estimatesRes.data ?? []) as SignedEstimateLike[])
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canSeeJobContracts])
  useEffect(() => {
    void loadJobContractCoverage()
  }, [loadJobContractCoverage])
  useEffect(() => {
    const onChanged = () => void loadJobContractCoverage()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [loadJobContractCoverage])
  const jobContractCoverageByJobId = useMemo(
    () => buildJobContractCoverage(jobs, jobContractRows, signedEstimateRows),
    [jobs, jobContractRows, signedEstimateRows],
  )
  /** The Contract modal (Contract Desk PR 2) — opened from the row chip and the ✍ quick action. */
  const [jobContractModalJob, setJobContractModalJob] = useState<JobWithDetails | null>(null)
  /** The signed-agreement view (v2.2709): a green chip opens the record, not the send form. */
  const [signedAgreement, setSignedAgreement] = useState<{ job: JobWithDetails; coverage: SignedCoverage } | null>(null)
  const openJobContract = canSeeJobContracts
    ? (j: JobWithDetails) => {
        const cov = jobContractCoverageByJobId.get(j.id)
        if (cov && cov.kind === 'signed') setSignedAgreement({ job: j, coverage: cov })
        else setJobContractModalJob(j)
      }
    : undefined
  /** The contract sweep (PR 4): every live job with nothing on file, one row each. ?contractSweep=1 deep-links it. */
  const [contractSweepOpen, setContractSweepOpen] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('contractSweep') === '1'
    } catch {
      return false
    }
  })
  const contractSweepCount = useMemo(() => {
    if (!canSeeJobContracts) return 0
    let n = 0
    for (const j of jobs) {
      if ((j.status ?? '') === 'paid') continue
      const cov = jobContractCoverageByJobId.get(j.id)
      if (!cov || cov.kind === 'none' || cov.kind === 'draft') n++
    }
    return n
  }, [canSeeJobContracts, jobs, jobContractCoverageByJobId])
  // ?contract=missing deep-links the board to the jobs with nothing on file
  // (Needs You, PR 4). Read-only init like ?view=recent — the tab never writes params.
  const [stagesContractFilter, setStagesContractFilter] = useState<StagesContractFilter | ''>(() => {
    try {
      return parseStagesContractFilter(new URLSearchParams(window.location.search).get('contract'))
    } catch {
      return ''
    }
  })
  const [aiaG702StagesJob, setAiaG702StagesJob] = useState<JobWithDetails | null>(null)
  /** Release of lien (v2.2579): in-app waiver-and-release modal — same office set as the hazmat gate. */
  const [lienReleaseModal, setLienReleaseModal] = useState<{
    job: JobWithDetails
    invoice: JobsLedgerInvoice | null
  } | null>(null)
  const [hazmatFeeJob, setHazmatFeeJob] = useState<HazmatFeeModalJob | null>(null)
  /** Same office set as the create_hazmat_fee_incident RPC gate. */
  const canCreateHazmatFee =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const openLienReleaseFromRow = canCreateHazmatFee
    ? (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => setLienReleaseModal(ctx)
    : undefined
  const openHazmatFee = (j: JobWithDetails) =>
    setHazmatFeeJob({
      id: j.id,
      jobNumber: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || '—',
      jobName: (j.job_name ?? '').trim() || 'Job',
      jobAddress: (j.job_address ?? '').trim() || '—',
      customerName: (j.customer_name ?? '').trim() || '—',
    })
  // Jobs with a live (non-voided) hazmat fee — the ☣ button wears a bright
  // green box on those rows (v2.1040). One tiny table-wide query (fees are
  // rare); a fetch failure just leaves every button plain.
  const [hazmatFeeJobIds, setHazmatFeeJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadHazmatFeeJobIds = useCallback(async () => {
    if (!canCreateHazmatFee) return
    try {
      const { data } = await supabase.from('job_hazmat_incidents').select('job_id').is('voided_at', null)
      setHazmatFeeJobIds(new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id)))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canCreateHazmatFee])
  useEffect(() => {
    void loadHazmatFeeJobIds()
  }, [loadHazmatFeeJobIds])
  // Jobs with a live (non-voided) lien release — their release button wears a
  // blue box (v2.2582). Same fail-soft posture as the hazmat lookup.
  const [lienReleaseJobIds, setLienReleaseJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadLienReleaseJobIds = useCallback(async () => {
    if (!canCreateHazmatFee) return
    try {
      const { data } = await supabase.from('job_lien_releases').select('job_id').is('voided_at', null)
      setLienReleaseJobIds(new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id)))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canCreateHazmatFee])
  useEffect(() => {
    void loadLienReleaseJobIds()
  }, [loadLienReleaseJobIds])
  // Customer pay speeds for the Billed Awaiting Payment expected-payment
  // chips (bill date + customer's median billed→paid gap, company-wide
  // fallback for thin history). Same fail-soft posture as the hazmat lookup:
  // an RPC error (including a not-yet-deployed function) leaves rows chipless.
  // Session notes doors (toolbar pill + per-job "Sessions") show for every office
  // role — owner call 2026-09-03. What the view returns still follows the
  // clock_sessions RLS, so a role without pay access sees only its own rows.
  const canOpenSessionNotes = (['dev', 'master_technician', 'assistant', 'controller'] as const).some(
    (r) => r === authRole || r === myRole,
  )
  const openSessionNotes = useCallback(
    (job?: SessionNotesJobIdentity | null) => setSessionNotesModal({ job: job ?? null }),
    [],
  )
  const canSeeBilledExpectedPay =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole) || authRole === 'primary'
  const [billedPaySpeeds, setBilledPaySpeeds] = useState<PaySpeedData | null>(null)
  // Extracted so the Data health drill-down can refresh medians right after
  // an exclusion toggles (v2.2290) — same fail-soft posture as the mount load.
  const refreshBilledPaySpeeds = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      const { data } = await supabase.rpc('get_billed_customer_pay_speeds' as never)
      setBilledPaySpeeds(parsePaySpeedsRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canSeeBilledExpectedPay])
  useEffect(() => {
    void refreshBilledPaySpeeds()
  }, [refreshBilledPaySpeeds])
  // Promised pay dates: real dates a customer named, marked by the office —
  // they override the statistical estimate (chip turns green, forecast
  // buckets by the promise). Same fail-soft posture as the pay-speed fetch.
  const canMarkPromisedPay =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const [promisedPayDates, setPromisedPayDates] = useState<Record<string, PromisedPayDate> | null>(null)
  const loadPromisedPayDates = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      const { data } = await supabase.rpc('list_job_promised_pay_dates' as never)
      setPromisedPayDates(parsePromisedPayDatesRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canSeeBilledExpectedPay])
  useEffect(() => {
    void loadPromisedPayDates()
  }, [loadPromisedPayDates])
  // Payment chase loop (v2.2025): the call log behind the follow-up queue.
  // Office-only (the marking roles); fail-soft like promises/pay-speeds — a
  // not-yet-deployed RPC just leaves the chase card hidden.
  const [chaseTouches, setChaseTouches] = useState<ChaseTouch[] | null>(null)
  const loadChaseTouches = useCallback(async () => {
    if (!canMarkPromisedPay) return
    try {
      const { data } = await supabase.rpc('list_payment_chase_touches' as never)
      setChaseTouches(parseChaseTouchesRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canMarkPromisedPay])
  useEffect(() => {
    void loadChaseTouches()
  }, [loadChaseTouches])
  const [chaseModalOpen, setChaseModalOpen] = useState(false)
  // Call mode reads FULL rows (names + send evidence) from EVERY non-paid
  // scope — billed invoices hang on working/waiting jobs too (a part-billed
  // working job is exactly the bill that falls through cracks), and the
  // board kernel routes them into the billed section only when their job's
  // scope is loaded. Same retry-until-merged shape as the forecast.
  useEffect(() => {
    if (!chaseModalOpen) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [chaseModalOpen, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
  const [promisedPayModalJob, setPromisedPayModalJob] = useState<{
    jobId: string
    jobLabel: string
    initialYmd: string | null
  } | null>(null)
  const billedExpectedPayChipRenderer = useCallback(
    (row: StageRow) => {
      // Job-shell rows (no bill line at all) can't have an expected date; wear
      // the "No bill line" hint the no_line chip filters by instead (v2.1931).
      const shell = row.kind === 'job'
      const promise = promisedPayDates?.[row.job.id] ?? null
      const model = billedExpectedPayModel(
        shell
          ? { billedAtIso: null, estBillYmd: null, customerId: row.job.customer_id }
          : {
              billedAtIso: row.inv.billed_at,
              estBillYmd: effectiveInvoiceEstBillDate(row.inv),
              customerId: row.job.customer_id,
            },
        billedPaySpeeds,
        calendarYmdInAppTzFromIso(new Date().toISOString()),
        promise,
      )
      if (!shell && !model && !canMarkPromisedPay) return null
      const number = effectiveJobLedgerNumber(row.job.hcp_number, row.job.click_number) || '—'
      const label = `${number} · ${(row.job.job_name ?? '').trim() || 'Job'}`
      return (
        <>
          {shell ? (
            <span
              title="This billed job's open money is on no bill line, so it can't age, be chased, or be forecast — Bill Customer or Edit Job creates the line"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
            >
              No bill line
            </span>
          ) : null}
          {model ? <BilledExpectedPayChip model={model} /> : null}
          {canMarkPromisedPay ? (
            <button
              type="button"
              onClick={() =>
                setPromisedPayModalJob({
                  jobId: row.job.id,
                  jobLabel: label,
                  initialYmd: promise?.promisedYmd ?? null,
                })
              }
              title="Record the payment date the customer named — it overrides the estimate"
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
            >
              {promise ? 'edit promised date…' : 'mark promised date…'}
            </button>
          ) : null}
        </>
      )
    },
    [billedPaySpeeds, promisedPayDates, canMarkPromisedPay],
  )
  const lienToolingSenderFallback = useMemo(() => {
    const job = lienToolingPrefillModal?.job
    const sessionName = authProfileName?.trim() ?? ''
    if (!job?.master_user_id) return sessionName
    const masterRow = users.find((u) => u.id === job.master_user_id)
    return masterRow?.notes?.trim() || masterRow?.name?.trim() || sessionName
  }, [users, lienToolingPrefillModal?.job?.id, lienToolingPrefillModal?.job?.master_user_id, authProfileName])
  const lienReleaseSignerFallback = useMemo(() => {
    const job = lienReleaseModal?.job
    const sessionName = authProfileName?.trim() ?? ''
    if (!job?.master_user_id) return sessionName
    const masterRow = users.find((u) => u.id === job.master_user_id)
    return masterRow?.notes?.trim() || masterRow?.name?.trim() || sessionName
  }, [users, lienReleaseModal?.job?.id, lienReleaseModal?.job?.master_user_id, authProfileName])
  const [sendBackJob, setSendBackJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    toStatus: 'working' | 'ready_to_bill'
    rtbDraftCount: number
    /** v2.2601: set on RTB → Working send-backs; drives the stage-billed framing. */
    billing?: SendBackJobBillingContext
  } | null>(null)
  const [sendBackInvoice, setSendBackInvoice] = useState<{ inv: InvoiceWithJob; action: 'delete' | 'revert' } | null>(null)
  const [sendBackInvoiceStripeExplainerAfterFailure, setSendBackInvoiceStripeExplainerAfterFailure] = useState(false)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  /** Required reason for RTB → Working send-backs (v2.2065) — posted as a "Sent back to Working — …" thread note. */
  const [sendBackReason, setSendBackReason] = useState('')
  const [sendBackStatusEventLine, setSendBackStatusEventLine] = useState<string | null>(null)
  const sendBackCollectPaymentNotice = useSendBackCollectPaymentFlowNotice(sendBackJob)
  /**
   * v2.2601: the "voiding this bill / call the Subcontractor" attestation gates
   * the send-back only when it actually voids something — Billed → RTB always
   * does; RTB → Working only when a deliberate draft carve is deleted. Missing
   * billing context (never expected for RTB → Working) fails safe: required.
   */
  const sendBackNeedsAttestation =
    sendBackJob != null &&
    (sendBackJob.toStatus === 'ready_to_bill' ||
      (sendBackJob.billing ? sendBackRequiresVoidAttestation(sendBackJob.billing) : true))
  const [sendBackConfirmJob, setSendBackConfirmJob] = useState<{ id: string; toStatus: 'waiting' | 'ready_to_bill' | 'billed' } | null>(null)
  // Collections flag confirm: 'to' = Billed → Collections (optional note), 'from' = Collections → Billed.
  const [collectionsConfirm, setCollectionsConfirm] = useState<{ job: JobWithDetails; direction: 'to' | 'from' } | null>(null)
  const [collectionsNoteDraft, setCollectionsNoteDraft] = useState('')
  const [collectionsSaving, setCollectionsSaving] = useState(false)
  const [confirmJobStatusJob, setConfirmJobStatusJob] = useState<{ id: string; toStatus: 'billed' | 'paid'; message: string } | null>(null)
  const [stagesHamMode, setStagesHamMode] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-ham-mode') === 'true'
    } catch {
      return false
    }
  })
  /** ⋯ tools menu "Edit mode" (v2.1236): EDIT rail on every job row → Edit Job in one tap. */
  const [stagesEditMode, setStagesEditMode] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-edit-mode') === 'true'
    } catch {
      return false
    }
  })
  /** ⋯ tools menu "Mobile cards" (v2.1241): render sections as full-width cards instead of tables. */
  const [stagesMobileCards, setStagesMobileCards] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-mobile-cards') === 'true'
    } catch {
      return false
    }
  })
  const [stagesFollowMoves, setStagesFollowMoves] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-follow-moves') === 'true'
    } catch {
      return false
    }
  })
  const [stagesIncludeScheduleTimeInSearch, setStagesIncludeScheduleTimeInSearch] = useState(() => {
    try {
      return parseStagesIncludeScheduleTimePref(
        localStorage.getItem(STAGES_INCLUDE_SCHEDULE_TIME_STORAGE_KEY),
      )
    } catch {
      return false
    }
  })
  /** Focus ring for the unified command bar (v2.1187) — the input inside is borderless. */
  const [stagesSearchBarFocused, setStagesSearchBarFocused] = useState(false)
  /** Job Follow-Up Mode deck (v2.1718). */
  const [followupOpen, setFollowupOpen] = useState(false)
  // Bumped when the deck closes so the button badge recounts (v2.2307).
  const [followupCountRefresh, setFollowupCountRefresh] = useState(0)
  const followupQueueCount = useJobFollowupQueueCount(followupCountRefresh)
  // Dashboard card entry (v2.1720): ?followups=1 opens the deck once, then
  // strips itself so refresh/back doesn't re-open it.
  const followupParamConsumedRef = useRef(false)
  useEffect(() => {
    if (followupParamConsumedRef.current) return
    if (searchParams.get('followups') === '1') {
      followupParamConsumedRef.current = true
      setFollowupOpen(true)
      const p = new URLSearchParams(searchParams)
      p.delete('followups')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])
  /** `?gcReview=1` deep link (v2.1984): the Dashboard Wednesday nudge opens GC Review directly. */
  const gcReviewParamConsumedRef = useRef(false)
  useEffect(() => {
    if (gcReviewParamConsumedRef.current) return
    if (searchParams.get('gcReview') === '1') {
      gcReviewParamConsumedRef.current = true
      setGcReviewModalOpen(true)
      const p = new URLSearchParams(searchParams)
      p.delete('gcReview')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])
  /** `?chase=1` deep link (v2.2025): open payment follow-up call mode directly. */
  const chaseParamConsumedRef = useRef(false)
  useEffect(() => {
    if (chaseParamConsumedRef.current) return
    if (searchParams.get('chase') === '1') {
      chaseParamConsumedRef.current = true
      setChaseModalOpen(true)
      const p = new URLSearchParams(searchParams)
      p.delete('chase')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])
  /** `?forecast=1` deep link (v2.2226): the forecast email's CTA opens the Payment forecast modal directly. */
  const forecastParamConsumedRef = useRef(false)
  useEffect(() => {
    if (forecastParamConsumedRef.current) return
    if (searchParams.get('forecast') === '1') {
      forecastParamConsumedRef.current = true
      setBilledPaymentForecastOpen(true)
      const p = new URLSearchParams(searchParams)
      p.delete('forecast')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])

  const renderStagesOpenDetailJobName = useCallback((j: JobWithDetails): ReactNode => {
    const fmt = formatJobNameTwoLines(j.job_name)
    if (!fmt) return <div>—</div>
    const n = (j.job_name ?? '').trim() || 'Job'
    return (
      <button
        type="button"
        onClick={() => openStagesDetailJobModal(j)}
        aria-label={`Open job detail for ${n}`}
        style={{
          // Click target hugs the words (v2.1155) — a full-width block made
          // dead space right of the name read as clickable.
          display: 'inline-block',
          maxWidth: '100%',
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
          color: 'var(--text-blue-700)',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
        }}
      >
        <span style={{ color: 'inherit', textDecoration: 'inherit' }}><StagesSearchMark text={fmt.line1} /></span>
        {fmt.line2 ? (
          <div style={{ fontSize: '0.75rem', color: 'inherit', marginTop: '0.15rem', textDecoration: 'inherit' }}><StagesSearchMark text={fmt.line2} /></div>
        ) : null}
      </button>
    )
  }, [openStagesDetailJobModal])

  /** Stages GC filter (v2.1183): '' = all, STAGES_GC_FILTER_NO_GC = jobs without a GC, else gc customer id. */
  const [stagesGcFilter, setStagesGcFilter] = useState('')
  const stagesGcFilterOptions = useMemo(() => gcFilterOptionsFromJobs(jobs), [jobs])
  /** Stages development filter: '' = all, STAGES_DEVELOPMENT_FILTER_NONE = jobs without one, else development id. */
  const [stagesDevelopmentFilter, setStagesDevelopmentFilter] = useState('')
  const stagesDevelopmentFilterOptions = useMemo(() => developmentFilterOptionsFromJobs(jobs), [jobs])
  /** Stages Account Man filter (v2.1477): '' = all, STAGES_ACCOUNT_MAN_FILTER_NONE = jobs without one, else user id. */
  const [stagesAccountManFilter, setStagesAccountManFilter] = useState('')

  const stagesAccountManFilterOptions = useMemo(() => accountManFilterOptionsFromJobs(jobs), [jobs])
  /** "Hide groups" exclusions (v2.1476): per-device; applied before the include filters and search. */
  const [stagesExcludeFilters, setStagesExcludeFiltersState] = useState<StagesExcludeFilters>(() => loadStagesExcludeFilters())
  // Cross-section modals and ACTIVE DISPLAY FILTERS (GC / development /
  // account-man / hidden groups) still need the whole non-paid board in
  // memory — filters apply to loaded rows, so the collapsed-header stats
  // (whole-section, unfiltered) would disagree with a filtered board.
  // Search stopped needing this in v2.1825: the lean lookup covers all jobs.
  const stagesNeedsAllScopesForModal =
    weeklyMoneyModalOpen ||
    weeklyMovementModalOpen ||
    gcReviewModalOpen ||
    billedTotalByNameModalOpen ||
    bankPaymentsModalOpen ||
    capableToBillModalOpen ||
    // ⋯ tools menu (v2.1827): its GC/development/account-man dropdowns derive
    // their options from loaded rows — open it, get the whole board.
    stagesToolsMenuOpen
  const stagesHasActiveDisplayFilter =
    countStagesExclusions(stagesExcludeFilters) > 0 ||
    Boolean(stagesGcFilter) ||
    Boolean(stagesDevelopmentFilter) ||
    Boolean(stagesAccountManFilter) ||
    Boolean(stagesContractFilter) ||
    contractSweepOpen ||
    // Billed aging / no-line filter (v2.2155): billed lines hang on working
    // and waiting jobs too, and the board routes them into Billed only once
    // their job's scope is loaded — with Working collapsed, "Show 90+" listed
    // 2 bills while the card (company-wide lean stats) promised 3.
    Boolean(billedAgingFilter)
  useEffect(() => {
    if (!active) return
    if (!stagesNeedsAllScopesForModal && !stagesHasActiveDisplayFilter) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [active, stagesNeedsAllScopesForModal, stagesHasActiveDisplayFilter, cacheMergedScopes, customerFilterForFetch, cacheFetchScopeIfNeeded])

  const [stagesHideGroupsModalOpen, setStagesHideGroupsModalOpen] = useState(false)
  const setStagesExcludeFilters = useCallback((next: StagesExcludeFilters) => {
    setStagesExcludeFiltersState(next)
    saveStagesExcludeFilters(next)
  }, [])
  // "Recently added" view (v2.1809): flat last-100-by-created_at list, any
  // status, replacing the sections while open. ?view=recent deep-links in
  // (read-only init — the tab never writes search params, per the seam).
  const [stagesRecentViewOpen, setStagesRecentViewOpen] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('view') === 'recent'
    } catch {
      return false
    }
  })
  const jobDetailModal = useJobDetailModal()
  // Row sort mode (v2.1807): classic newest-number-first, or by time added.
  // Lives in the ⋯ Pipeline tools menu; per-device persistence.
  const [stagesSortMode, setStagesSortModeState] = useState<StagesBoardSortMode>(() => loadStagesSortMode())
  const setStagesSortMode = useCallback((mode: StagesBoardSortMode) => {
    setStagesSortModeState(mode)
    saveStagesSortMode(mode)
  }, [])
  const stagesExclusionCount = countStagesExclusions(stagesExcludeFilters)
  const stagesBoardLists = useMemo(
    () =>
      buildJobsStagesBoardLists(
        filterJobsByContractCoverage(
          filterJobsByAccountMan(
            filterJobsByDevelopment(
              filterJobsByGcCustomer(filterJobsByExclusions(jobs, stagesExcludeFilters), stagesGcFilter || null),
              stagesDevelopmentFilter || null,
            ),
            stagesAccountManFilter || null,
          ),
          jobContractCoverageByJobId,
          stagesContractFilter,
        ),
        stagesSearchQuery,
        stagesCombinedExtraJobIds,
        stagesSortMode,
      ),
    [jobs, stagesExcludeFilters, stagesGcFilter, stagesDevelopmentFilter, stagesAccountManFilter, jobContractCoverageByJobId, stagesContractFilter, stagesSearchQuery, stagesCombinedExtraJobIds, stagesSortMode],
  )

  // Capable of Being Billed dollars, shared by the Working section header and
  // the jump-bar Section tools menu. Falls back to the lean header stats while
  // the Working scope hasn't loaded — the live list is empty then, which used
  // to make the menu say $0 while the collapsed section's header knew better.
  const capableDisplay = cacheMergedScopes.has(scopeForStagesSection('working'))
    ? formatCurrencyNoCents(capableToBillTotalFromWorking(stagesBoardLists.working))
    : cacheHeaderStats
      ? formatCurrencyNoCents(cacheHeaderStats.capableToBill)
      : '…'

  /**
   * UNFILTERED board lists — the single "what's true" derivation, as opposed
   * to stagesBoardLists' "what's shown". Money surfaces (follow-up cards, the
   * chase queue, the aging chart / payment forecast / who-owes-what modals,
   * GC Review) all read from THIS list: money must never fall out of a total
   * because a board group is cosmetically hidden, a GC/development/account-man
   * filter is set, or a search is live (money-never-hides, v2.1915). Any new
   * money surface consumes this, never stagesBoardLists.
   */
  const unfilteredBoardLists = useMemo(() => buildJobsStagesBoardLists(jobs, ''), [jobs])

  /** Personal statement rounds (v2.2072): data for the two-stage money-opportunity cards. */
  const isRoundOfficeRole = authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const roundWeekStart = gcReviewWeekStartYmd()
  const [roundCertRows, setRoundCertRows] = useState<GcReviewCertRow[]>([])
  const [roundMarks, setRoundMarks] = useState<RoundMarkRow[]>([])
  const [roundSenders, setRoundSenders] = useState<Map<string, string>>(new Map())
  // Full rows once the billed scope merges; the lean spine (first paint, id-only
  // GC stubs) until then — same lean-first pattern as the chase card.
  const roundBilledRows =
    unfilteredBoardLists.billedActiveRows.length > 0 ? unfilteredBoardLists.billedActiveRows : (cacheLeanBilledRows ?? [])
  const roundRollup = useMemo(
    () => (isRoundOfficeRole ? buildGcReviewRollup(roundBilledRows, [], { groupBy: 'gc' }) : null),
    [isRoundOfficeRole, roundBilledRows],
  )
  useEffect(() => {
    // Refetches when the modal toggles so the cards reflect round work done inside it.
    if (!isRoundOfficeRole) return
    let cancelled = false
    void listGcReviewCertifications(roundWeekStart).then(
      (r) => {
        if (!cancelled) setRoundCertRows(r)
      },
      () => {},
    )
    void listGcStatementRoundMarks(roundWeekStart).then(
      (r) => {
        if (!cancelled) setRoundMarks(r)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [isRoundOfficeRole, roundWeekStart, gcReviewModalOpen])
  const roundGcIds = useMemo(
    () => (roundRollup ? roundRollup.groups.flatMap((g) => (!g.isNoGc && g.gcId ? [g.gcId] : [])) : []),
    [roundRollup],
  )
  useEffect(() => {
    if (!isRoundOfficeRole || roundGcIds.length === 0) return
    let cancelled = false
    void listGcStatementSenders(roundGcIds).then((m) => {
      if (!cancelled) setRoundSenders(m)
    })
    return () => {
      cancelled = true
    }
  }, [isRoundOfficeRole, roundGcIds, gcReviewModalOpen])
  const gcRoundCards = useMemo(() => {
    if (!roundRollup) return null
    const items = buildStatementRound({
      groups: roundRollup.groups,
      certsByGc: latestCertByGc(roundCertRows),
      marks: roundMarks,
      senders: roundSenders,
      accountMen: deriveGcAccountMen(unfilteredBoardLists.billedActiveRows),
    })
    const s = summarizeStatementRound(items, authUser?.id ?? null)
    return {
      held: s.held,
      ready: { count: s.readyForUser.length, total: s.readyForUser.reduce((t, i) => t + i.amount, 0) },
    }
  }, [roundRollup, roundCertRows, roundMarks, roundSenders, unfilteredBoardLists, authUser?.id])

  /**
   * Payment chase queue (v2.2025). The CARD derives from the lean stats
   * spine (available on first paint, no names); call mode re-derives from
   * the full billed rows once the scope merges. Same kernel both times.
   */
  const chaseTodayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const chaseSummary = useMemo(() => {
    // chaseTouches null = the list RPC isn't deployed/readable yet — keep the
    // card hidden rather than offering call mode whose writes would fail.
    if (!canMarkPromisedPay || !cacheLeanBilledRows || chaseTouches == null) return null
    return summarizePaymentChase(
      buildPaymentChaseQueue(cacheLeanBilledRows, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd),
    )
  }, [canMarkPromisedPay, cacheLeanBilledRows, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd])
  const nonPaidScopesMerged = NON_PAID_SCOPES.every((s) => cacheMergedScopes.has(s))
  const chaseFullQueue = useMemo(() => {
    if (!chaseModalOpen || !nonPaidScopesMerged) return null
    return buildPaymentChaseQueue(
      unfilteredBoardLists.billedActiveRows,
      billedPaySpeeds,
      promisedPayDates,
      chaseTouches,
      chaseTodayYmd,
    )
  }, [chaseModalOpen, nonPaidScopesMerged, unfilteredBoardLists, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd])

  /** Jump-strip counts (v2.1959): stats-spine fallback for unfetched scopes — same rule as the section headers. */
  const jumpStripCounts = useMemo(() => {
    const searchActive = stagesSearchQuery.trim() !== ''
    const resolve = (
      section: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections',
      liveCount: number,
    ) =>
      stagesJumpStripCount({
        searchActive,
        scopeMerged: cacheMergedScopes.has(scopeForStagesSection(section)),
        statsCount: cacheHeaderStats?.[section]?.count ?? null,
        liveCount,
      })
    return {
      waiting: resolve('waiting', stagesBoardLists.waiting.length),
      working: resolve('working', stagesBoardLists.working.length),
      readyToBill: resolve('readyToBill', stagesBoardLists.readyToBillRows.length),
      billed: resolve('billed', stagesBoardLists.billedActiveRows.length),
      collections: resolve('collections', stagesBoardLists.collectionsRows.length),
    }
  }, [stagesBoardLists, stagesSearchQuery, cacheMergedScopes, cacheHeaderStats])

  /** #3 of the billing-email guardrails: soft heads-up the moment a job is marked Ready to Bill. */
  const nudgeMissingBillingEmail = useCallback(
    (jobId: string) => {
      const j = jobs.find((x) => x.id === jobId)
      if (j && !(j.customer_email ?? '').trim()) {
        showToast('Heads up: no customer email on this job — Stripe invoices will need one.', 'info', 6000)
      }
    },
    [jobs, showToast],
  )

  const stagesJobsWithoutCustomer = useMemo(
    () => stagesJobsWithoutCustomerFromFiltered(stagesBoardLists.filtered),
    [stagesBoardLists.filtered],
  )

  const stagesWorkingJobsWithoutPictures = useMemo(
    () => stagesWorkingJobsWithoutPicturesFromWorking(stagesBoardLists.working),
    [stagesBoardLists.working],
  )

  const stagesReadyToBillNoEmailJobs = useMemo(
    () => stagesReadyToBillJobsWithoutEmail(stagesBoardLists.readyToBillRows),
    [stagesBoardLists.readyToBillRows],
  )
  const [stagesNoEmailModalOpen, setStagesNoEmailModalOpen] = useState(false)

  const openStagesNoCustomerEditJob = useCallback(
    (jobId: string) => {
      setStagesNoCustomerModalOpen(false)
      tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
    },
    [tryOpenEditJob, loadJobs],
  )

  const openStagesNoJobPicturesEditJob = useCallback(
    (jobId: string) => {
      setStagesNoJobPicturesModalOpen(false)
      tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
    },
    [tryOpenEditJob, loadJobs],
  )

  useEffect(() => {
    if (stagesJobsWithoutCustomer.length === 0) {
      setStagesNoCustomerModalOpen(false)
    }
  }, [stagesJobsWithoutCustomer.length])

  useEffect(() => {
    if (stagesWorkingJobsWithoutPictures.length === 0) {
      setStagesNoJobPicturesModalOpen(false)
    }
  }, [stagesWorkingJobsWithoutPictures.length])

  useEffect(() => {
    if (stagesReadyToBillNoEmailJobs.length === 0) {
      setStagesNoEmailModalOpen(false)
    }
  }, [stagesReadyToBillNoEmailJobs.length])

  const focusStagesSection = useCallback((key: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections') => {
    setStagesSectionOpen((prev) => ({ ...prev, [key]: true }))
    const elId =
      key === 'waiting'
        ? 'stages-waiting'
        : key === 'working'
          ? 'stages-working'
          : key === 'readyToBill'
            ? 'stages-ready-to-bill'
            : key === 'collections'
              ? 'stages-collections'
              : 'stages-billed'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [])

  /**
   * `?rtb=1` deep link (v2.2276): the assistants' ready-to-bill banner lands
   * on the Ready to Bill section. Unlike the modal params above, this one
   * needs the board DOM, so the scroll polls for the section header while
   * data loads; and the strip re-runs unguarded because the tab-router
   * effect can resurrect the param from its own pre-strip snapshot.
   */
  useEffect(() => {
    if (searchParams.get('rtb') !== '1') return
    const p = new URLSearchParams(searchParams)
    p.delete('rtb')
    navigate({ search: p.toString() }, { replace: true })
    // Window-level arm (not a ref/state): survives the StrictMode double
    // mount that loses component state here, and expires so a later banner
    // tap re-arms. The scroll itself waits for the board's layout to hold
    // still — the section header exists while sections above it are still
    // streaming in, and scrolling early gets eaten by the growth.
    const w = window as unknown as { __rtbFocusArmedAt?: number }
    if (w.__rtbFocusArmedAt != null && Date.now() - w.__rtbFocusArmedAt < 5000) return
    w.__rtbFocusArmedAt = Date.now()
    // Stillness alone can't tell "loaded" from "not loaded yet" — the page is
    // perfectly still while the board query is in flight, so a single scroll
    // fires early and the sections above then grow and push the target back
    // down. Keep polling after the first scroll and re-pin whenever layout
    // settles with the section away from the top; stop once it holds there.
    let lastTop: number | null = null
    let tries = 0
    let focused = false
    const tick = () => {
      const el = document.getElementById('stages-ready-to-bill')
      if (el) {
        const top = Math.round(el.getBoundingClientRect().top)
        if (lastTop != null && Math.abs(top - lastTop) < 2) {
          if (!focused || Math.abs(top) > 40) {
            focusStagesSection('readyToBill')
            focused = true
          } else {
            return
          }
        }
        lastTop = top
      }
      if (++tries < 100) window.setTimeout(tick, 300)
    }
    window.setTimeout(tick, 400)
  }, [searchParams, navigate, focusStagesSection])

  /** "Follow cards I move": open the destination section, then scroll to + flash the job row. */
  const followMovedJob = useCallback(
    (jobId: string, toStatus: string) => {
      if (!stagesFollowMoves) return
      const section = stagesSectionKeyForJobStatus(toStatus)
      if (!section) return
      setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
      setPendingStagesJobFocusId(jobId)
      setStagesJobFlashId(jobId)
    },
    [stagesFollowMoves],
  )

  const stagesFilteredJobs = stagesBoardLists.filtered

  const STAGES_SCHEDULE_SESSION_DEBOUNCE_MS = 350
  useEffect(() => {
    if (!active) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    const q = stagesSearchQuery.trim()
    if (q.length < STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    if (!shouldFetchStagesScheduleSessionSearch(stagesIncludeScheduleTimeInSearch, q)) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setStagesScheduleSessionSearchBusy(true)
        const ids = jobs.map((j) => j.id)
        const { data, error: schedErr } = await fetchJobIdsMatchingScheduleOrClockSessions(ids, q)
        if (cancelled) return
        setStagesSearchExtraJobIds(data)
        setStagesScheduleSessionSearchBusy(false)
        if (schedErr) showToast(schedErr, 'warning')
      })()
    }, STAGES_SCHEDULE_SESSION_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      setStagesScheduleSessionSearchBusy(false)
    }
  }, [active, stagesSearchQuery, stagesIncludeScheduleTimeInSearch, jobs, showToast])

  /**
   * Server-side all-jobs search (v2.1825, plan PR 4): ≥2 chars → debounced
   * lean id lookup over EVERY job (any status, paid included) → full-detail
   * fetch for hits not in memory → ids ride the extra-ids channel so the
   * board's sections show them. Replaces the fetch-every-scope search net and
   * retires the v2.1819 paid chip.
   */
  useEffect(() => {
    if (!active) {
      setStagesServerSearchIds(new Set())
      setStagesServerSearchBusy(false)
      return
    }
    const q = stagesSearchQuery.trim()
    if (q.length < 2) {
      setStagesServerSearchIds(new Set())
      setStagesServerSearchBusy(false)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setStagesServerSearchBusy(true)
        const res = await fetchLeanJobSearchIds(q, customerFilterForFetch)
        if (cancelled) return
        if (!res.ok) {
          setStagesServerSearchBusy(false)
          return
        }
        const loaded = new Set(jobsRef.current.map((j) => j.id))
        const missing = res.ids.filter((id) => !loaded.has(id))
        if (missing.length > 0) {
          const full = await fetchJobsLedgerWithDetailsForStages({ ids: missing })
          if (cancelled) return
          if (full.ok) {
            const fetchedIds = new Set(full.jobs.map((j) => j.id))
            cacheSetJobs((prev) => [...prev.filter((p) => !fetchedIds.has(p.id)), ...full.jobs])
          }
        }
        setStagesServerSearchIds(new Set(res.ids))
        setStagesServerSearchBusy(false)
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      setStagesServerSearchBusy(false)
    }
  }, [active, stagesSearchQuery, customerFilterForFetch, cacheSetJobs])

  // v2.1819 (scoped-load plan PR 0): searching no longer auto-prefetches the
  // full paid list (~667 fully-embedded jobs on the first keystroke — the
  // app's most expensive accidental action). Paid inclusion is now opt-in via
  // the "Search Paid in Full too" chip beside the search box; the # jump keeps
  // its own paid fallback (v2.1808).

  /** Land the "#" jump on the first match: open its section, focus + flash the row. False = nothing to land on. */
  const jumpToNumberMatches = useCallback(
    (matches: JobWithDetails[], digits: string): boolean => {
      const hit = matches[0]
      if (!hit) return false
      const section = stagesSectionKeyForJobRow(hit)
      if (section) setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
      if (section === 'paid') {
        // Paid hits land in FILTER mode instead of scroll-hunting: the full
        // Paid in Full section is 600+ rows whose layout keeps inflating for
        // a long time as per-row data streams in, so no scroll position holds
        // (v2.1808). Filtering the board to the number shows the row
        // instantly; clearing the search restores the full board.
        setStagesSearchQuery(digits)
        showToast(`#${digits} is Paid in Full — board filtered to it; clear the search to go back`, 'info', 5000)
      }
      setPendingStagesJobFocusId(hit.id)
      setStagesJobFlashId(hit.id)
      if (matches.length > 1) {
        showToast(`${matches.length} jobs start with #${digits} — showing the first`, 'info', 4000)
      }
      return true
    },
    [showToast],
  )

  /**
   * Async "#" jump (v2.1825, plan PR 4): an Enter that misses the loaded
   * board asks the lean number lookup (every job, any status), fetches full
   * rows for the hits, merges them, and lands — the v2.1808/1813 pending-jump
   * resolver and paid-scope fallback retire with it.
   */
  const jumpViaLeanLookup = useCallback(
    async (digits: string): Promise<boolean> => {
      const res = await fetchLeanJobIdsByNumber(digits, customerFilterForFetch)
      if (!res.ok || res.ids.length === 0) return false
      const loaded = new Set(jobsRef.current.map((j) => j.id))
      const missing = res.ids.filter((id) => !loaded.has(id))
      let fetched: JobWithDetails[] = []
      if (missing.length > 0) {
        const full = await fetchJobsLedgerWithDetailsForStages({ ids: missing })
        if (full.ok) {
          fetched = full.jobs
          const fetchedIds = new Set(fetched.map((j) => j.id))
          cacheSetJobs((prev) => [...prev.filter((p) => !fetchedIds.has(p.id)), ...fetched])
        }
      }
      const idSet = new Set(res.ids)
      const candidates = [...jobsRef.current.filter((j) => idSet.has(j.id)), ...fetched]
      const matches = findJobsByNumber(candidates, digits)
      return jumpToNumberMatches(matches, digits)
    },
    [customerFilterForFetch, cacheSetJobs, jumpToNumberMatches],
  )

  const bankPaymentsModalBilledRows = useMemo(
    () => buildJobsStagesBoardLists(jobs, '').billedRows,
    [jobs],
  )

  const accountsReceivableButtonAccessibleName = useMemo(() => {
    const can =
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary'
    if (!can) return 'Only dev, master, assistant, and primary can record payments'
    const hasUnalloc =
      typeof arBankTxUnallocatedCount === 'number' && arBankTxUnallocatedCount > 0
    if (hasUnalloc) {
      return `Accounts Receivable, ${arBankTxUnallocatedCount} unallocated bank transaction${arBankTxUnallocatedCount === 1 ? '' : 's'}`
    }
    if (bankPaymentsModalBilledRows.length === 0) return 'No billed rows'
    return 'Accounts Receivable: apply bank deposits to billed lines (non-Stripe)'
  }, [authRole, bankPaymentsModalBilledRows.length, arBankTxUnallocatedCount])

  const billedAgingBuckets = useMemo(
    () =>
      cacheMergedScopes.has('billed_all')
        ? buildBilledAgingBuckets(stagesFilteredJobs)
        : (cacheHeaderStats?.billedAging ?? { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 }),
    [stagesFilteredJobs, cacheMergedScopes, cacheHeaderStats],
  )

  /** Debounce: stagesFilteredJobs changes every Stages search keystroke; avoids overlapping multi-chunk RPC bursts. */
  const THREAD_STATS_STAGES_DEBOUNCE_MS = 320
  useEffect(() => {
    if (!authUser?.id || !active) return
    const ids = [...new Set(stagesFilteredJobs.map((j) => j.id))]
    const t = window.setTimeout(() => {
      void refreshJobThreadStatsForJobIds(ids)
    }, THREAD_STATS_STAGES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [authUser?.id, active, stagesFilteredJobs, refreshJobThreadStatsForJobIds])

  function toggleStagesHamMode() {
    setStagesHamMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-ham-mode', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function toggleStagesEditMode() {
    setStagesEditMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-edit-mode', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function toggleStagesMobileCards() {
    setStagesMobileCards((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-mobile-cards', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  // Component switch (v2.1241): cards and tables share the exact props types,
  // so each section render site just swaps the tag.
  const StagesSectionList = stagesMobileCards ? JobsStagesCardList : JobsStagesTable
  const StagesUnifiedSectionList = stagesMobileCards ? JobsStagesUnifiedCardList : JobsStagesUnifiedTable

  /** Rails render only for the roles that can see the toggle — a stale
      localStorage flag on a shared browser must not surface them elsewhere. */
  const stagesEditModeActive =
    stagesEditMode &&
    (['dev', 'assistant', 'controller'] as const).includes((authRole || myRole) as 'dev' | 'assistant' | 'controller')

  function toggleStagesIncludeScheduleTimeInSearch() {
    setStagesIncludeScheduleTimeInSearch((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STAGES_INCLUDE_SCHEDULE_TIME_STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    if (!sendBackJob) {
      setSendBackStatusEventLine(null)
      return
    }
    const toStatusForEvent = sendBackJob.toStatus === 'working' ? 'ready_to_bill' : 'billed'
    supabase
      .from('job_status_events')
      .select('changed_at, users(name)')
      .eq('job_id', sendBackJob.id)
      .eq('to_status', toStatusForEvent)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { changed_at: string; users: { name: string | null } | null } | null
        setSendBackStatusEventLine(
          row
            ? formatMoveIntoStageByOnLine(toStatusForEvent, row.users?.name ?? null, row.changed_at)
            : null,
        )
      })
  }, [sendBackJob])

  useEffect(() => {
    if (sendBackInvoice) {
      setSendBackInvoiceStripeExplainerAfterFailure(false)
    }
  }, [sendBackInvoice])

  /** Stages board man-hours-per-job (load-once per visit; RLS-governed RPC, empty for roles without labor access). */
  async function loadStagesManHours() {
    if (stagesManHoursLoadedRef.current) return
    stagesManHoursLoadedRef.current = true
    setStagesManHoursLoading(true)
    const { data, error } = await supabase.rpc('get_man_hours_by_job')
    setStagesManHoursLoading(false)
    if (error) {
      stagesManHoursLoadedRef.current = false // allow retry on next Stages visit
      return
    }
    setStagesManHoursRows(
      (data ?? []) as Array<{ job_id: string; person_name: string; man_hours: number }>,
    )
  }

  function printBilledAwaitingPaymentReport(rows: StageRow[], opts?: { searchFilter?: string }) {
    if (rows.length === 0) {
      showToast('Nothing to print in Billed Awaiting Payment.', 'warning')
      return
    }
    if (!openHtmlPrintWindow(buildBilledAwaitingPaymentReportHtml(rows, opts))) {
      showToast('Allow pop-ups to print the report.', 'error')
    }
  }

  const applyStagesInvoiceFocus = useCallback(
    (invoiceId: string): boolean => {
      const raw = invoiceId.trim()
      if (!raw) return false
      const { readyToBillRows, billedRows } = buildJobsStagesBoardLists(
        jobs,
        stagesSearchQuery,
        stagesCombinedExtraJobIds,
      )
      const section = locateStagesInvoiceSection(raw, readyToBillRows, billedRows)
      if (section == null) {
        if (stagesInvoiceVisibleWithEmptySearch(raw, jobs)) {
          showToast('Clear the Stages search to see this invoice.', 'info')
        } else {
          showToast('That invoice isn’t on the Pipeline board right now.', 'info')
        }
        return false
      }
      if (section === 'readyToBill') {
        setStagesSectionOpen((prev) => ({ ...prev, readyToBill: true }))
      } else {
        setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
      }
      setPendingStagesInvoiceFocusId(raw)
      setStagesInvoiceFlashId(raw)
      return true
    },
    [jobs, stagesSearchQuery, stagesSearchExtraJobIds, showToast],
  )

  useEffect(() => {
    if (!active) {
      setReturnEditBannerJobId(null)
      clearReturnEditJobFromStages()
    }
  }, [active])

  useEffect(() => {
    if (!active || jobsListLoading) return
    const tabParam = searchParams.get('tab')
    const urlWantsStages = tabParam == null || tabParam === 'stages' || tabParam === 'billed'
    if (!urlWantsStages) return
    const id = peekReturnEditJobFromStages()
    if (id) setReturnEditBannerJobId(id)
  }, [active, jobsListLoading, searchParams])

  useEffect(() => {
    if (!returnEditBannerJobId) return
    const t = window.setTimeout(() => {
      clearReturnEditJobFromStages()
      setReturnEditBannerJobId(null)
    }, 10_000)
    return () => window.clearTimeout(t)
  }, [returnEditBannerJobId])

  useEffect(() => {
    if (!stagesInvoiceFlashId) return
    const t = window.setTimeout(() => setStagesInvoiceFlashId(null), 2600)
    return () => window.clearTimeout(t)
  }, [stagesInvoiceFlashId])

  useEffect(() => {
    if (!pendingStagesInvoiceFocusId) return
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-stages-invoice-id="${pendingStagesInvoiceFocusId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingStagesInvoiceFocusId(null)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [pendingStagesInvoiceFocusId])

  // "Follow cards I move" — job-row cousins of the invoice flash/focus effects above.
  useEffect(() => {
    if (!stagesJobFlashId) return
    const t = window.setTimeout(() => setStagesJobFlashId(null), 2600)
    return () => window.clearTimeout(t)
  }, [stagesJobFlashId])

  useEffect(() => {
    if (!pendingStagesJobFocusId) return
    const jobId = pendingStagesJobFocusId
    const scrollTo = () => {
      const el = document.querySelector(`[data-stages-job-id="${jobId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return !!el
    }
    // First attempt after the section-open re-render; one retry covers the destination row
    // appearing late (e.g. the post-move debounced refetch re-keying the lists).
    let retry: number | undefined
    const timer = window.setTimeout(() => {
      if (scrollTo()) {
        setPendingStagesJobFocusId(null)
        return
      }
      retry = window.setTimeout(() => {
        scrollTo()
        setPendingStagesJobFocusId(null)
      }, 700)
    }, 250)
    return () => {
      window.clearTimeout(timer)
      if (retry !== undefined) window.clearTimeout(retry)
    }
  }, [pendingStagesJobFocusId])

  useEffect(() => {
    if (!billedTotalByNameModalOpen) setBilledTotalByNameExpandedName(null)
  }, [billedTotalByNameModalOpen])

  useEffect(() => {
    if (active && authUser?.id) {
      const t = setTimeout(() => void loadStagesManHours(), 80)
      return () => clearTimeout(t)
    }
  }, [active, authUser?.id])

  /** Stages board: total man-hours per job id. */
  const stagesManHoursByJobId = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of stagesManHoursRows) {
      m.set(r.job_id, (m.get(r.job_id) ?? 0) + Number(r.man_hours ?? 0))
    }
    return m
  }, [stagesManHoursRows])

  /** Stages board: per-person man-hours per job id (descending), for the man-hours hover tooltip. */
  const stagesLaborBreakdownByJobId = useMemo(() => {
    const m = new Map<string, Array<{ personName: string; hours: number }>>()
    for (const r of stagesManHoursRows) {
      const arr = m.get(r.job_id) ?? []
      arr.push({ personName: r.person_name, hours: Number(r.man_hours ?? 0) })
      m.set(r.job_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => b.hours - a.hours)
    return m
  }, [stagesManHoursRows])

  async function createInvoiceFromModal() {
    if (!createPartialInvoiceJob) return
    const amount = parseFloat(createPartialInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = jobPartialInvoiceRemainingDollars(createPartialInvoiceJob)
    const amountToUseCents = clampPartialInvoiceCentsToUnallocated(createPartialInvoiceJob, amount)
    const amountToUse = amountToUseCents / 100
    if (!(amountToUse > 0)) {
      setError('No remaining balance to bill')
      return
    }
    if (amountToUseCents < Math.round(amount * 100)) {
      showToast(`Adjusted to remaining unallocated ($${formatCurrency(amountToUse)})`, 'info')
      setCreatePartialInvoiceAmount(String(amountToUse))
    }
    if (
      createPartialInvoiceJob.status === 'ready_to_bill' &&
      Math.round(amountToUse * 100) === Math.round(remaining * 100)
    ) {
      const job = createPartialInvoiceJob
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(null)
      if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
        showToast('Link this job to a customer before billing.', 'error')
        openEdit(job, { billingCustomerHighlight: true })
        return
      }
      billCustomer?.openBillCustomer({
        payload: { kind: 'job', job: jobBillingContextFromJob(job) },
        onSuccess: async () => {
          await loadJobs()
        },
        onAfterEnsureSuccess: async () => {
          await loadJobs()
        },
      })
      return
    }
    setCreatingPartialInvoiceFromModal(true)
    setError(null)
    try {
      const nextOrder = (createPartialInvoiceJob.invoices ?? []).length
      const { error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: createPartialInvoiceJob.id,
          amount: amountToUse,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: null,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      // Invoice already written — fully-allocated envelopes from the resync
      // are success; only a real failure is surfaced (after the board reload).
      let ensureFailure: string | null = null
      if (createPartialInvoiceJob.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: createPartialInvoiceJob.id,
            }),
          'ensure RTB remainder after partial invoice'
        )
        const outcome = ensureRemainderResyncOutcome(raw)
        if (!outcome.ok) ensureFailure = outcome.error
      }
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(
        ensureFailure ? `Invoice created, but the remainder draft did not re-sync: ${ensureFailure}` : null,
      )
      await loadJobs()
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingPartialInvoiceFromModal(false)
    }
  }

  // Imperative handle: the page's URL deep-link router effects and the
  // page-side useJobsStagesMutations hook drive tab-owned state through these
  // methods — each mirrors exactly what the page did before the move.
  /** Open the job's section, scroll to it, and flash the row (the `focusJob` handle + Session notes' "Open on board"). */
  const focusJobOnBoard = useCallback(
    (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId)
      if (job) {
        // A live search would filter out the row we're about to scroll to.
        setStagesSearchQuery('')
        const section = stagesSectionKeyForJobStatus(job.status)
        if (section) setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
        setPendingStagesJobFocusId(jobId)
        setStagesJobFlashId(jobId)
      } else {
        showToast('That job isn’t on the Pipeline board right now.', 'info')
      }
    },
    [jobs, showToast],
  )

  useImperativeHandle(
    ref,
    () => ({
      followMovedJob,
      focusSection: focusStagesSection,
      focusJob: focusJobOnBoard,
      focusInvoice: applyStagesInvoiceFocus,
      openBankPayments: () => setBankPaymentsModalOpen(true),
      openWeeklyMovement: () => setWeeklyMovementModalOpen(true),
      openWeeklyMoney: () => setWeeklyMoneyModalOpen(true),
      showBilledTotalByName: () => setBilledTotalByNameModalOpen(true),
      openMoneyMove: (key: StagesMoneyMoveKey) => {
        // Mirrors the PipelineOverview callbacks above (v2.1960: clear a live search first).
        setStagesSearchQuery('')
        switch (key) {
          case 'capable':
            setCapableToBillModalOpen(true)
            return
          case 'chase90':
            setBilledAgingFilter('90')
            focusStagesSection('billed')
            return
          case 'fixDates':
            setBilledAgingFilter('no_line')
            focusStagesSection('billed')
            return
          case 'ar':
            setBankPaymentsModalOpen(true)
            return
          case 'chase':
            setChaseModalOpen(true)
            return
          case 'gcRoundCertify':
            setGcReviewStartRound(false)
            setGcReviewModalOpen(true)
            return
          case 'gcRoundStart':
            setGcReviewStartRound(true)
            setGcReviewModalOpen(true)
            return
        }
      },
    }),
    [followMovedJob, focusStagesSection, focusJobOnBoard, applyStagesInvoiceFocus],
  )

  /**
   * Follow-Up deck (v2.1739): each deck card's bottom shows the job's real
   * Pipeline row — the same section renderers with the same section props,
   * jobList/rows narrowed to the one job. Board lists are rebuilt without the
   * page's search/exclusion filters so a filtered-out job still gets its row.
   */
  const renderFollowupStageRow = (jobId: string): JobsFollowupStageRowResult | null => {
    const job = jobs.find((x) => x.id === jobId)
    if (!job) return null
    // Bill detail for the card's line-items footer (v2.1744) — same math as the Bill tab's Job Total.
    const namedFixtures = [...(job.fixtures ?? [])]
      .filter((f) => (f.name ?? '').trim())
      .sort((a, b) => a.sequence_order - b.sequence_order)
    const rowExtras = {
      lineItems: namedFixtures.map((f) => ({
        name: f.name,
        count: Number(f.count ?? 1),
        unitPrice: f.line_unit_price != null ? Number(f.line_unit_price) : null,
      })),
      jobTotalDollars: revenueDollarsFromFixtures(
        namedFixtures.map((f) => ({ name: f.name, count: Number(f.count ?? 1), line_unit_price: f.line_unit_price != null ? Number(f.line_unit_price) : null })),
      ),
      bidDollars: Number(job.revenue ?? 0),
    }
    const shared = {
      stagesSortMode,
      stagesJobFlashId,
      stagesEditMode: stagesEditModeActive,
      renderStagesOpenDetailJobName,
      stagesStatusUpdatingId,
      pctCompleteSavingId,
      updateJobPctComplete,
      commitStagesPctWithNote,
      setCreatePartialInvoiceAmount,
      setCreatePartialInvoiceJob,
      openEdit,
      openStagesDetailJobModal,
      setAiaG702StagesJob,
      canCreateHazmatFee,
      openHazmatFee,
      hazmatFeeJobIds,
      canEditJobPctComplete,
      canManageJobPeople,
      setManageJobPeople,
      jobThreadNotesLoadingId,
      jobThreadDraft,
      jobThreadSubmittingId,
      setJobThreadDraft,
      submitJobThreadNote,
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
      toggleStagesJobThreadExpanded: (id: string) => setExpandedJobThreadId((prev) => (prev === id ? null : id)),
      jobThreadStatsByJobId,
      jobThreadActivityByJobId,
      openJobThreadFullscreen,
      openJobActivityExpand,
      jobThreadFullscreen,
      setJobThreadFullscreen,
      applyStagesInvoiceFocus,
      canOpenJobScheduleModal,
      openJobCalendar: setCalendarJob,
      stagesUpcomingByJobId,
      setScheduleModalJob,
      openQuickAssignForJob,
      authRole,
      loadJobs,
      onDevelopmentFilter: setStagesDevelopmentFilter,
      jobContractCoverageByJobId: canSeeJobContracts ? jobContractCoverageByJobId : undefined,
      onOpenJobContract: openJobContract,
    }
    const unifiedShared = {
      ...shared,
      onOpenLienRelease: openLienReleaseFromRow,
      lienReleaseJobIds,
      demandOutJobIds,
      stagesHamMode,
      flashInvoiceId: stagesInvoiceFlashId,
      stagesInvoiceUpdatingId,
      invoiceEstimatedBillDateSavingId,
      bumpInvoiceEstimatedBillDate,
      setWhenInvoiceBillModal,
      setWhenInvoiceBillModalDate,
    }
    const status = (job.status ?? 'working') as string
    if (status === 'waiting') {
      return { stage: 'waiting', ...rowExtras, node: (
        <StagesSectionList
          hideHeader
          jobList={[job]}
          actionLabel={'Move to Working'}
          onAction={(j) => void updateJobStatus(j.id, 'working')}
          showTimeOpen={true}
          onSendBack={undefined}
          onSendBackSimple={undefined}
          showPctComplete={true}
          {...shared}
        />
      ) }
    }
    if (status === 'working') {
      return { stage: 'working', ...rowExtras, node: (
        <StagesSectionList
          hideHeader
          jobList={[job]}
          actionLabel={'Ready to Bill'}
          onAction={(j) =>
            stagesHamMode
              ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
              : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' }))}
          showTimeOpen={true}
          onSendBack={undefined}
          onSendBackSimple={stagesHamMode
            ? (j) => void updateJobStatus(j.id, 'waiting')
            : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'waiting' })}
          sendBackLabel={'Mark Waiting'}
          showPctComplete={true}
          {...shared}
        />
      ) }
    }
    if (status === 'ready_to_bill') {
      const rows = unfilteredBoardLists.readyToBillRows.filter((r) => r.job.id === jobId)
      if (rows.length === 0) return null
      return { stage: 'ready_to_bill', ...rowExtras, node: (
        <StagesUnifiedSectionList
          hideHeader
          rows={rows}
          actionLabel={'Bill Customer'}
          onJobAction={(j) => {
            if (!jobLedgerHasCustomerForBilling(j.customer_id)) {
              showToast('Link this job to a customer before billing.', 'error')
              openEdit(j, { billingCustomerHighlight: true })
              return
            }
            billCustomer?.openBillCustomer({
              payload: { kind: 'job', job: jobBillingContextFromJob(j) },
              onSuccess: async () => {
                await loadJobs()
                followMovedJob(j.id, 'billed')
              },
              onAfterEnsureSuccess: async () => {
                await loadJobs()
              },
            })
          }}
          onInvoiceAction={(inv) => {
            if (!jobLedgerHasCustomerForBilling(inv.job.customer_id)) {
              showToast('Link this job to a customer before billing.', 'error')
              openEdit(inv.job, { billingCustomerHighlight: true })
              return
            }
            billCustomer?.openBillCustomer({
              payload: {
                kind: 'invoice',
                job: jobBillingContextFromJob(inv.job),
                invoice: {
                  id: inv.id,
                  amount: inv.amount,
                  status: inv.status,
                  stripe_invoice_memo: inv.stripe_invoice_memo ?? null,
                  is_primary_rtb_bundle: inv.is_primary_rtb_bundle ?? null,
                },
              },
              onSuccess: async () => {
                await loadJobs()
                followMovedJob(inv.job.id, 'billed')
              },
              onAfterEnsureSuccess: async () => {
                await loadJobs()
              },
            })
          }}
          onJobSendBack={(j) =>
            stagesHamMode
              ? void updateJobStatus(j.id, 'working')
              : (setSendBackChecked(false),
                setSendBackJob({
                  id: j.id,
                  hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                  jobName: j.job_name ?? '—',
                  toStatus: 'working',
                  rtbDraftCount: sendBackJobBillingContext(j.invoices).rtbDraftCount,
                  billing: sendBackJobBillingContext(j.invoices),
                }))}
          onInvoiceSendBack={(inv) => stagesHamMode ? deleteInvoice(inv.id) : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'delete' }))}
          showRemaining={true}
          showTimeOpen={true}
          showCreatePartialInvoice={true}
          jobSendBackLabel={'Send Job Back'}
          invoiceBundleActionLabel={DELETE_DRAFT_BILL_LABEL}
          invoiceStandaloneActionLabel={DELETE_DRAFT_BILL_LABEL}
          {...unifiedShared}
        />
      ) }
    }
    if (status === 'billed' && jobInCollections(job)) {
      const rows = unfilteredBoardLists.collectionsRows.filter((r) => r.job.id === jobId)
      if (rows.length === 0) return null
      return { stage: 'collections', ...rowExtras, node: (
        <StagesUnifiedSectionList
          hideHeader
          rows={rows}
          actionLabel={'Mark Paid'}
          onJobAction={(j) => setMarkPaidJob(j)}
          onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
          onViewBill={(inv) => setViewBillInvoice(inv)}
          showClickTooling={false}
          onOpenLienTooling={(ctx) =>
            setLienInstrumentsModal({ job: ctx.job, invoice: ctx.invoice })}
          onJobSendBack={(j) => setCollectionsConfirm({ job: j, direction: 'from' })}
          onInvoiceSendBack={(inv) => setCollectionsConfirm({ job: inv.job, direction: 'from' })}
          showRemaining={true}
          showTimeOpen={true}
          sendBackBelowRemaining={true}
          showCreatePartialInvoice={false}
          jobSendBackLabel={'Send back to Billed'}
          invoiceBundleActionLabel={'Send back to Billed'}
          invoiceStandaloneActionLabel={'Send back to Billed'}
          jobNoteLine={(j) => j.collections_note ?? null}
          {...unifiedShared}
        />
      ) }
    }
    if (status === 'billed') {
      const rows = unfilteredBoardLists.billedActiveRows.filter((r) => r.job.id === jobId)
      if (rows.length === 0) return null
      return { stage: 'billed', ...rowExtras, node: (
        <StagesUnifiedSectionList
          hideHeader
          rows={rows}
          actionLabel={'Mark Paid'}
          onJobAction={(j) => setMarkPaidJob(j)}
          onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
          onViewBill={(inv) => setViewBillInvoice(inv)}
          showClickTooling={false}
          onOpenLienTooling={(ctx) =>
            setLienInstrumentsModal({ job: ctx.job, invoice: ctx.invoice })}
          onJobSendBack={(j) =>
            stagesHamMode
              ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
              : (setSendBackChecked(false),
                setSendBackJob({
                  id: j.id,
                  hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                  jobName: j.job_name ?? '—',
                  toStatus: 'ready_to_bill',
                  rtbDraftCount: 0,
                }))}
          onInvoiceSendBack={(inv) =>
            stagesHamMode
              ? void revertBilledInvoiceToReadyToBill(inv)
              : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'revert' }))}
          showRemaining={true}
          showTimeOpen={true}
          sendBackBelowRemaining={true}
          showCreatePartialInvoice={false}
          invoiceBundleActionLabel={'Send back'}
          onJobMoveToCollections={(authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole))
            ? (j) => {
                setCollectionsNoteDraft('')
                setCollectionsConfirm({ job: j, direction: 'to' })
              }
            : undefined}
          {...unifiedShared}
        />
      ) }
    }
    return null
  }

  /** Deck label click-through (v2.1742): close the deck, open the row's section, scroll to + flash the row. */
  const openFollowupBoardRow = (jobId: string, stage: JobsFollowupStageRowResult['stage']) => {
    const section = stage === 'ready_to_bill' ? 'readyToBill' : stage
    setFollowupOpen(false)
    setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
    setPendingStagesJobFocusId(jobId)
    setStagesJobFlashId(jobId)
  }

  // Deck's Latest-activity box → the full-screen Job activity modal (z 1001,
  // above the deck at z 58) — the deck stays open underneath.
  const openFollowupActivity = (jobId: string) => {
    const job = jobs.find((x) => x.id === jobId)
    if (job) openJobActivityExpand(job)
  }

  // Live jobs_ledger ids for the deck: a card whose job disappears (deleted
  // from the Job window, migrated to a bid, …) drops immediately (v2.1756).
  // The ids only speak for the scopes the board has loaded (v2.1824 scoped
  // loading) — followupLiveJobStages tells the deck which stages those are,
  // so candidates in unloaded sections don't read as deleted.
  const followupLiveJobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs])
  const followupLiveJobStages = useMemo(() => followupStagesCoveredByScopes(cacheMergedScopes), [cacheMergedScopes])

  return (
    <StagesSearchHighlightProvider query={stagesSearchQuery.trim() || null}>
    <SessionNotesOpenerContext.Provider value={canOpenSessionNotes ? openSessionNotes : null}>
      {active && (
        <div>
          {(error || jobsListError) && (
            <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error || jobsListError}</p>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <span
              id="stages-search-supplemental-desc"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              When Schedule and time in search is enabled, results can include jobs matched by dispatch schedule or clock
              session notes, people, or dates.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openNew}
              aria-label="New job"
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {shortNewJobButtonLabel ? 'New' : 'New Job'}
            </button>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => setFollowupOpen(true)}
                aria-label={
                  followupQueueCount != null && followupQueueCount > 0
                    ? `Open job follow-ups — ${followupQueueCount} outstanding`
                    : 'Open job follow-ups'
                }
                style={{
                  padding: '0.5rem 0.9rem',
                  background: 'var(--bg-amber-tint)',
                  color: 'var(--text-amber-800)',
                  border: '1px solid var(--border-amber-soft)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Follow-ups
              </button>
              {followupQueueCount != null && followupQueueCount > 0 ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '-0.5rem',
                    right: '-0.5rem',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: '#f59e0b',
                    color: '#241a05',
                    borderRadius: 999,
                    padding: '0.1rem 0.4rem',
                    minWidth: '1.4em',
                    textAlign: 'center',
                    lineHeight: 1.4,
                    border: '2px solid var(--bg-page)',
                    pointerEvents: 'none',
                  }}
                >
                  {followupQueueCount}
                </span>
              ) : null}
            </span>
            {followupOpen ? (
              <JobsFollowupModal
                open
                onClose={() => {
                  setFollowupOpen(false)
                  setFollowupCountRefresh((n) => n + 1)
                }}
                renderStageRow={renderFollowupStageRow}
                onOpenBoardRow={openFollowupBoardRow}
                onOpenActivity={openFollowupActivity}
                activityExpandOpen={activityExpandJob != null}
                liveJobIds={followupLiveJobIds}
                liveJobStages={followupLiveJobStages}
              />
            ) : null}
            {canSeeBilledExpectedPay && (
              <button
                type="button"
                onClick={() => setBilledPaymentForecastOpen(true)}
                title="Open billed dollars bucketed by expected payment date (bill date + customer pay speed)"
                aria-label="Payment forecast"
                style={{
                  padding: '0.5rem 0.9rem',
                  background: 'var(--bg-green-tint)',
                  color: 'var(--text-green-700)',
                  border: '1px solid var(--border-green)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Forecast
              </button>
            )}
            {/* Unified command bar (v2.1187): search + jump chip + GC filter + tools in one container. */}
            <div
              style={{
                flex: '1 1 16rem',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: '2.5rem',
                padding: '0 0.25rem 0 0.65rem',
                background: 'var(--surface)',
                border: `1px solid ${stagesSearchBarFocused ? '#3b82f6' : 'var(--border-strong)'}`,
                borderRadius: 10,
                boxShadow: stagesSearchBarFocused ? '0 0 0 3px var(--bg-blue-tint)' : 'none',
                boxSizing: 'border-box',
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                style={{ flexShrink: 0, color: 'var(--text-muted)' }}
              >
                <circle cx={11} cy={11} r={7} />
                <line x1={21} y1={21} x2={16.4} y2={16.4} />
              </svg>
              <input
                type="text"
                placeholder={
                  stagesIncludeScheduleTimeInSearch
                    ? 'Search HCP, name, address, schedule notes, or clock notes'
                    : 'Search HCP, name, address'
                }
                value={stagesSearchQuery}
                onChange={(e) => setStagesSearchQuery(e.target.value)}
                onFocus={() => setStagesSearchBarFocused(true)}
                onBlur={() => setStagesSearchBarFocused(false)}
                aria-busy={stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy}
                aria-describedby={
                  stagesIncludeScheduleTimeInSearch ? 'stages-search-supplemental-desc' : undefined
                }
                style={{
                  flex: '1 1 6rem',
                  minWidth: '3.5rem',
                  padding: '0.45rem 0',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  fontSize: '0.9375rem',
                }}
              />
              {stagesServerSearchBusy ? (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  searching all jobs…
                </span>
              ) : null}
              {stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy ? (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + schedule &amp; clock…
                </span>
              ) : null}
              {canOpenSessionNotes ? (
                // Session notes door (v2.2683): lives in the command bar beside the
                // search it complements — same round chip grammar as the # jump.
                <button
                  type="button"
                  onClick={() => openSessionNotes(null)}
                  title="Session notes — every clock session on one line: what people wrote and where the time landed"
                  aria-label="Session notes"
                  style={{
                    width: '2.1rem',
                    height: '2.1rem',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 999,
                    background: 'var(--surface)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {/* Font Awesome Free 7 "clock" (solid) — owner-picked glyph. */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={17} height={17} aria-hidden>
                    <path
                      fill="currentColor"
                      d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"
                    />
                  </svg>
                </button>
              ) : null}
              <StagesJobNumberJumpChip
                onJump={(digits) => {
                  const matches = findJobsByNumber(jobs, digits)
                  if (matches.length > 0) return jumpToNumberMatches(matches, digits)
                  // Miss on the loaded board → lean lookup across every job
                  // (any status); the chip shows its checking state meanwhile.
                  return jumpViaLeanLookup(digits)
                }}
              />
              {/* v2.1232: the GC/development selects moved into the ⋯ tools menu.
                  The bar only shows an APPLIED filter, as a tap-to-clear chip —
                  hidden active filters would make the board look short. */}
              {stagesSortMode !== 'number' ? (
                <button
                  type="button"
                  onClick={() => setStagesSortMode('number')}
                  title="Rows are sorted by time added (newest first) — tap to go back to job-number order"
                  aria-label="Sorted by time added — tap to restore job-number order"
                  style={stagesActiveFilterChipStyle}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Sorted: time added</span>
                  <span aria-hidden style={{ flexShrink: 0 }}>×</span>
                </button>
              ) : null}
              {stagesContractFilter ? (
                <button
                  type="button"
                  onClick={() => setStagesContractFilter('')}
                  title="Filtered by contract state — tap to clear"
                  aria-label={`Clear contract filter: ${STAGES_CONTRACT_FILTER_LABELS[stagesContractFilter]}`}
                  style={stagesActiveFilterChipStyle}
                >
                  <span aria-hidden style={{ flexShrink: 0 }}>✍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {STAGES_CONTRACT_FILTER_LABELS[stagesContractFilter]}
                  </span>
                  <span aria-hidden style={{ flexShrink: 0 }}>
                    ×
                  </span>
                </button>
              ) : null}
              {stagesGcFilter ? (
                <button
                  type="button"
                  onClick={() => setStagesGcFilter('')}
                  title="Filtered by GC/Builder — tap to clear"
                  aria-label={`Clear GC filter: ${
                    stagesGcFilter === STAGES_GC_FILTER_NO_GC
                      ? 'No GC set'
                      : stagesGcFilterOptions.find((o) => o.id === stagesGcFilter)?.name ?? 'GC'
                  }`}
                  style={stagesActiveFilterChipStyle}
                >
                  <GcHardHatIcon size={13} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {stagesGcFilter === STAGES_GC_FILTER_NO_GC
                      ? 'No GC set'
                      : stagesGcFilterOptions.find((o) => o.id === stagesGcFilter)?.name ?? 'GC'}
                  </span>
                  <span aria-hidden style={{ flexShrink: 0 }}>
                    ×
                  </span>
                </button>
              ) : null}
              {stagesDevelopmentFilter ? (
                <button
                  type="button"
                  onClick={() => setStagesDevelopmentFilter('')}
                  title="Filtered by development — tap to clear"
                  aria-label={`Clear development filter: ${
                    stagesDevelopmentFilter === STAGES_DEVELOPMENT_FILTER_NONE
                      ? 'No development set'
                      : stagesDevelopmentFilterOptions.find((o) => o.id === stagesDevelopmentFilter)?.name ?? 'Development'
                  }`}
                  style={stagesActiveFilterChipStyle}
                >
                  <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {stagesDevelopmentFilter === STAGES_DEVELOPMENT_FILTER_NONE
                      ? 'No development set'
                      : stagesDevelopmentFilterOptions.find((o) => o.id === stagesDevelopmentFilter)?.name ?? 'Development'}
                  </span>
                  <span aria-hidden style={{ flexShrink: 0 }}>
                    ×
                  </span>
                </button>
              ) : null}
              {stagesAccountManFilter ? (
                <button
                  type="button"
                  onClick={() => setStagesAccountManFilter('')}
                  title="Filtered by Account Man — tap to clear"
                  aria-label={`Clear Account Man filter: ${
                    stagesAccountManFilter === STAGES_ACCOUNT_MAN_FILTER_NONE
                      ? 'No Account Man'
                      : stagesAccountManFilterOptions.find((o) => o.id === stagesAccountManFilter)?.name ?? 'Account Man'
                  }`}
                  style={stagesActiveFilterChipStyle}
                >
                  <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
                    <AccountManIcon size={13} />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {stagesAccountManFilter === STAGES_ACCOUNT_MAN_FILTER_NONE
                      ? 'No Account Man'
                      : stagesAccountManFilterOptions.find((o) => o.id === stagesAccountManFilter)?.name ?? 'Account Man'}
                  </span>
                  <span aria-hidden style={{ flexShrink: 0 }}>
                    ×
                  </span>
                </button>
              ) : null}
              {stagesExclusionCount > 0 ? (
                // Hidden-groups chip (v2.1476): same "the bar only shows an APPLIED
                // filter" rule as the GC/development chips above. Tap opens the
                // manage modal rather than clearing — several hides shouldn't
                // vanish on one accidental tap; "Show everything" lives inside.
                <button
                  type="button"
                  onClick={() => setStagesHideGroupsModalOpen(true)}
                  title="Some groups are hidden from this board — tap to review"
                  aria-label={`${stagesExclusionCount} group${stagesExclusionCount === 1 ? '' : 's'} hidden from the board — review`}
                  style={{
                    ...stagesActiveFilterChipStyle,
                    background: 'var(--bg-red-tint)',
                    color: 'var(--text-red-700)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    Hiding {stagesExclusionCount} group{stagesExclusionCount === 1 ? '' : 's'}
                  </span>
                </button>
              ) : null}
              <span aria-hidden style={{ flexShrink: 0, width: 1, height: '1.25rem', background: 'var(--border)' }} />
              <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setStagesToolsMenuOpen((o) => !o)}
                title="Pipeline tools"
                aria-label="Pipeline tools"
                aria-haspopup="menu"
                aria-expanded={stagesToolsMenuOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  padding: 0,
                  border: 'none',
                  borderRadius: 8,
                  background:
                    stagesToolsMenuOpen || stagesGcFilter || stagesDevelopmentFilter || stagesAccountManFilter || stagesExclusionCount > 0 || stagesSortMode !== 'number'
                      ? 'var(--bg-blue-tint)'
                      : 'transparent',
                  cursor: 'pointer',
                  color:
                    stagesToolsMenuOpen || stagesGcFilter || stagesDevelopmentFilter || stagesAccountManFilter || stagesExclusionCount > 0 || stagesSortMode !== 'number'
                      ? 'var(--text-link)'
                      : 'var(--text-muted)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                ⋯
              </button>
              {stagesToolsMenuOpen ? (
                <>
                  <div
                    onClick={() => setStagesToolsMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 120 }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 4px)',
                      zIndex: 121,
                      minWidth: 250,
                      padding: '0.3rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {/* Sort group (v2.1807) — row order inside every section.
                        Picking keeps the menu open, matching the filters below. */}
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.25rem 0.75rem 0.1rem' }}>
                      Sort
                    </div>
                    {STAGES_SORT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="menuitemradio"
                        aria-checked={stagesSortMode === mode}
                        onClick={() => setStagesSortMode(mode)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.3rem 0.75rem',
                          border: 'none',
                          borderRadius: 4,
                          background: stagesSortMode === mode ? 'var(--bg-blue-tint)' : 'transparent',
                          color: stagesSortMode === mode ? 'var(--text-link)' : 'var(--text-700)',
                          fontSize: '0.8125rem',
                          fontWeight: stagesSortMode === mode ? 600 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span aria-hidden style={{ width: 14, flexShrink: 0 }}>{stagesSortMode === mode ? '✓' : ''}</span>
                        {STAGES_SORT_MODE_LABELS[mode]}
                      </button>
                    ))}
                    {/* Filters group (v2.1232) — moved out of the search bar.
                        Selecting keeps the menu open so several can be set at once.
                        Always rendered since v2.1477 so "Hide groups…" has a stable home. */}
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.35rem 0.75rem 0.1rem', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                      Filters
                    </div>
                        {canSeeJobContracts ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem' }}>
                            <span aria-hidden style={{ color: 'var(--text-muted)', flexShrink: 0, width: 15, textAlign: 'center' }}>✍</span>
                            <select
                              value={stagesContractFilter}
                              onChange={(e) => setStagesContractFilter(parseStagesContractFilter(e.target.value))}
                              aria-label="Filter the Pipeline board by contract state"
                              title="Filter the Pipeline board by contract state"
                              style={{
                                ...stagesToolsMenuFilterSelectStyle,
                                background: stagesContractFilter ? 'var(--bg-blue-tint)' : 'var(--surface)',
                                color: stagesContractFilter ? 'var(--text-link)' : 'inherit',
                              }}
                            >
                              <option value="">Any contract state</option>
                              {STAGES_CONTRACT_FILTERS.map((f) => (
                                <option key={f} value={f}>
                                  {STAGES_CONTRACT_FILTER_LABELS[f]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {stagesGcFilterOptions.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem' }}>
                            <GcHardHatIcon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <select
                              value={stagesGcFilter}
                              onChange={(e) => setStagesGcFilter(e.target.value)}
                              aria-label="Filter the Pipeline board by GC/Builder"
                              title="Filter the Pipeline board by GC/Builder"
                              style={{
                                ...stagesToolsMenuFilterSelectStyle,
                                background: stagesGcFilter ? 'var(--bg-blue-tint)' : 'var(--surface)',
                                color: stagesGcFilter ? 'var(--text-link)' : 'inherit',
                              }}
                            >
                              <option value="">All GCs</option>
                              {stagesGcFilterOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                              <option value={STAGES_GC_FILTER_NO_GC}>No GC set</option>
                            </select>
                          </div>
                        ) : null}
                        {stagesDevelopmentFilterOptions.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem 0.35rem' }}>
                            <DevelopmentHouseIcon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <select
                              value={stagesDevelopmentFilter}
                              onChange={(e) => setStagesDevelopmentFilter(e.target.value)}
                              aria-label="Filter the Pipeline board by development"
                              title="Filter the Pipeline board by development"
                              style={{
                                ...stagesToolsMenuFilterSelectStyle,
                                background: stagesDevelopmentFilter ? 'var(--bg-blue-tint)' : 'var(--surface)',
                                color: stagesDevelopmentFilter ? 'var(--text-link)' : 'inherit',
                              }}
                            >
                              <option value="">All developments</option>
                              {stagesDevelopmentFilterOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                              <option value={STAGES_DEVELOPMENT_FILTER_NONE}>No development set</option>
                            </select>
                          </div>
                        ) : null}
                    {stagesAccountManFilterOptions.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem 0.35rem' }}>
                        <span aria-hidden style={{ display: 'inline-flex', color: 'var(--text-muted)', flexShrink: 0 }}>
                          <AccountManIcon size={15} />
                        </span>
                        <select
                          value={stagesAccountManFilter}
                          onChange={(e) => setStagesAccountManFilter(e.target.value)}
                          aria-label="Filter the Pipeline board by Account Man"
                          title="Filter the Pipeline board by Account Man"
                          style={{
                            ...stagesToolsMenuFilterSelectStyle,
                            background: stagesAccountManFilter ? 'var(--bg-blue-tint)' : 'var(--surface)',
                            color: stagesAccountManFilter ? 'var(--text-link)' : 'inherit',
                          }}
                        >
                          <option value="">All Account Men</option>
                          {stagesAccountManFilterOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                          <option value={STAGES_ACCOUNT_MAN_FILTER_NONE}>No Account Man</option>
                        </select>
                      </div>
                    ) : null}
                    {canSeeJobContracts ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStagesToolsMenuOpen(false)
                          setContractSweepOpen(true)
                        }}
                        title="Every live job with no agreement on file, one row each, with Send"
                        style={stagesToolsMenuItemStyle}
                      >
                        <span>Contract sweep…</span>
                        {contractSweepCount > 0 ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
                            {contractSweepCount} without
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setStagesToolsMenuOpen(false)
                        setStagesHideGroupsModalOpen(true)
                      }}
                      title="Hide chosen GCs, developments, or Account Men from the board"
                      style={stagesToolsMenuItemStyle}
                    >
                      <span>Hide groups…</span>
                      {stagesExclusionCount > 0 ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                          {stagesExclusionCount} hidden
                        </span>
                      ) : null}
                    </button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.2rem 0.3rem' }} />
                    {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
                      (r) => r === authRole || r === myRole,
                    ) ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStagesToolsMenuOpen(false)
                          setJobBookModalOpen(true)
                        }}
                        style={stagesToolsMenuItemStyle}
                      >
                        <span>Job Book…</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setStagesToolsMenuOpen(false)
                        setBilledTotalByNameModalOpen(true)
                      }}
                      style={stagesToolsMenuItemStyle}
                    >
                      <span>Total by Name…</span>
                    </button>
                    {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
                      (r) => r === authRole || r === myRole,
                    ) ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStagesToolsMenuOpen(false)
                          setCombineSeparateModalOpen(true)
                        }}
                        title="Combine two jobs or split Specific Work into a new job"
                        style={stagesToolsMenuItemStyle}
                      >
                        <span>Combine / Separate…</span>
                      </button>
                    ) : null}
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.2rem 0.3rem' }} />
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={stagesIncludeScheduleTimeInSearch}
                      onClick={toggleStagesIncludeScheduleTimeInSearch}
                      title="Also match dispatch schedule and clock sessions (notes, names, dates) while searching"
                      style={stagesToolsMenuItemStyle}
                    >
                      <span>Schedule &amp; time in search</span>
                      {renderStagesToolsMenuToggleState(stagesIncludeScheduleTimeInSearch)}
                    </button>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={stagesFollowMoves}
                      onClick={() =>
                        setStagesFollowMoves((prev) => {
                          const next = !prev
                          try {
                            localStorage.setItem('jobs-stages-follow-moves', String(next))
                          } catch {
                            // localStorage unavailable — session-only toggle
                          }
                          return next
                        })
                      }
                      title="After you move a card, scroll to it in its new section and highlight it"
                      style={stagesToolsMenuItemStyle}
                    >
                      <span>Follow cards I move</span>
                      {renderStagesToolsMenuToggleState(stagesFollowMoves)}
                    </button>
                    {(['dev', 'assistant', 'controller'] as const).includes((authRole || myRole) as 'dev' | 'assistant' | 'controller') ? (
                      <>
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={stagesHamMode}
                          onClick={toggleStagesHamMode}
                          title={stagesHamMode ? 'Ham mode on: faster shortcuts for some stage actions' : 'Ham mode off: all stage confirmations'}
                          style={stagesToolsMenuItemStyle}
                        >
                          <span>Ham mode</span>
                          {renderStagesToolsMenuToggleState(stagesHamMode)}
                        </button>
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={stagesEditMode}
                          onClick={toggleStagesEditMode}
                          title={
                            stagesEditMode
                              ? 'Edit mode on: every job row wears an EDIT tab that opens Edit Job in one tap'
                              : 'Edit mode off: open Edit Job through Job Detail as usual'
                          }
                          style={stagesToolsMenuItemStyle}
                        >
                          <span>Edit mode</span>
                          {renderStagesToolsMenuToggleState(stagesEditMode)}
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={stagesMobileCards}
                      onClick={toggleStagesMobileCards}
                      title={
                        stagesMobileCards
                          ? 'Mobile cards on: sections render as full-width cards built for phones'
                          : 'Mobile cards off: sections render as the classic desktop tables'
                      }
                      style={stagesToolsMenuItemStyle}
                    >
                      <span>Mobile cards</span>
                      {renderStagesToolsMenuToggleState(stagesMobileCards)}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            </div>
            </div>
          </div>
          {/* The Pipeline money story + Today's Money Opportunities (v2.1915,
              Old/New pills retired v2.2012 — this is the only view now). */}
          <PipelineOverview
            stats={cacheHeaderStats}
            canOpenAr={
              authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole) || authRole === 'primary'
            }
            canSeeCharts={authRole === 'dev' || authRole === 'controller'}
            canSeeCollected={authRole === 'dev' || authRole === 'controller'}
            arUnallocatedCount={typeof arBankTxUnallocatedCount === 'number' ? arBankTxUnallocatedCount : null}
            // Money-move buttons clear a live search first (v2.1960, owner
            // request) — a leftover query would narrow the very list each
            // button promises to show.
            onOpenCapable={() => {
              setStagesSearchQuery('')
              setCapableToBillModalOpen(true)
            }}
            onOpenBilledBreakdown={() => {
              setStagesSearchQuery('')
              setBilledBreakdownOpen(true)
            }}
            onOpenProfitChart={() => setPaidProfitChartOpen(true)}
            onOpenAr={() => {
              setStagesSearchQuery('')
              setBankPaymentsModalOpen(true)
            }}
            onFocusSection={focusStagesSection}
            fixupCounts={{
              noCustomer: stagesJobsWithoutCustomer.length,
              noPictures: stagesWorkingJobsWithoutPictures.length,
              noEmail: stagesReadyToBillNoEmailJobs.length,
            }}
            onFixup={(key) => {
              if (key === 'no-customer') setStagesNoCustomerModalOpen(true)
              else if (key === 'no-pictures') setStagesNoJobPicturesModalOpen(true)
              else setStagesNoEmailModalOpen(true)
            }}
            gcRound={gcRoundCards}
            onCertifyRound={() => {
              setGcReviewStartRound(false)
              setGcReviewModalOpen(true)
            }}
            onStartRound={() => {
              setGcReviewStartRound(true)
              setGcReviewModalOpen(true)
            }}
            onChase90={() => {
              setStagesSearchQuery('')
              setBilledAgingFilter('90')
              focusStagesSection('billed')
            }}
            onFixDates={() => {
              setStagesSearchQuery('')
              setBilledAgingFilter('no_line')
              focusStagesSection('billed')
            }}
            chase={chaseSummary}
            onStartChase={() => {
              setStagesSearchQuery('')
              setChaseModalOpen(true)
            }}
          />
          <div
            style={{
              marginBottom: '0.75rem',
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              color: 'var(--text-700)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '1 1 auto',
                gap: '0.35rem',
                textAlign: 'center',
                minWidth: 0,
              }}
            >
            {/* Section tools (v2.1419, hamburger + in-strip since v2.1421): the
                stage section headers' action buttons, reachable right from the
                jump strip without scrolling the board. */}
            <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStagesSectionToolsMenuOpen((o) => !o)}
                title="Section tools — quick access to the stage section buttons"
                aria-label="Section tools"
                aria-haspopup="menu"
                aria-expanded={stagesSectionToolsMenuOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  padding: 0,
                  border: 'none',
                  borderRadius: 6,
                  background: stagesSectionToolsMenuOpen ? 'var(--bg-blue-tint)' : 'transparent',
                  cursor: 'pointer',
                  color: stagesSectionToolsMenuOpen ? 'var(--text-link)' : 'var(--text-muted)',
                }}
              >
                <StagesSectionToolsIcon size={14} />
              </button>
              {stagesSectionToolsMenuOpen ? (
                <>
                  <div
                    onClick={() => setStagesSectionToolsMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 120 }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 'calc(100% + 4px)',
                      zIndex: 121,
                      minWidth: 250,
                      padding: '0.3rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {buildStagesSectionToolsMenu({
                      authRole,
                      // Unfiltered counts — GC Review must stay reachable even
                      // when a search/filter empties the visible billed group.
                      billedRowCount: unfilteredBoardLists.billedActiveRows.length,
                      collectionsRowCount: unfilteredBoardLists.collectionsRows.length,
                      arBankTxUnallocatedCount:
                        typeof arBankTxUnallocatedCount === 'number' ? arBankTxUnallocatedCount : null,
                      capableToBillTotalFormatted: capableDisplay,
                      recentViewOpen: stagesRecentViewOpen,
                    }).map((group) => (
                      <div key={group.section} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0.75rem 0.1rem', textAlign: 'center' }}>
                          {group.section}
                        </div>
                        {group.items.map((item) => {
                          const onSelect: Record<StagesSectionToolKey, () => void> = {
                            'recently-added': () => setStagesRecentViewOpen((o) => !o),
                            'weekly-movement': () => setWeeklyMovementModalOpen(true),
                            'weekly-money': () => setWeeklyMoneyModalOpen(true),
                            'capable-to-bill': () => setCapableToBillModalOpen(true),
                            'ready-to-bill-notifications': () => setReadyToBillNotifySettingsOpen(true),
                            'gc-review': () => setGcReviewModalOpen(true),
                            'accounts-receivable': () => setBankPaymentsModalOpen(true),
                            'billed-share-print': () => setBilledShareModalOpen(true),
                            'billed-aging-chart': () => setBilledAgingChartOpen(true),
                            'billed-payment-forecast': () => setBilledPaymentForecastOpen(true),
                            'paid-notifications': () => setPaymentEmailSettingsOpen(true),
                            'paid-profit-chart': () => setPaidProfitChartOpen(true),
                            'paid-in-full-notifications': () => setPaidEmailSettingsOpen(true),
                          }
                          return (
                            <button
                              key={item.key}
                              type="button"
                              disabled={item.disabled}
                              title={item.title}
                              onClick={() => {
                                setStagesSectionToolsMenuOpen(false)
                                onSelect[item.key]()
                              }}
                              style={{
                                ...stagesToolsMenuItemStyle,
                                ...(item.disabled ? { cursor: 'default', opacity: 0.5 } : {}),
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                {/* Fixed-width icon slot so labels align down the menu; same marks
                                    as the tools' board buttons (gc-review's hard-hat is a component,
                                    so the kernel leaves its icon to us). */}
                                <span aria-hidden style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {item.key === 'gc-review' ? <GcHardHatIcon size={13} style={{ flexShrink: 0 }} /> : item.icon}
                                </span>
                                <span>{item.label}</span>
                              </span>
                              {typeof item.badgeCount === 'number' ? (
                                <span
                                  aria-hidden
                                  style={{
                                    minWidth: 18,
                                    padding: '0 5px',
                                    height: 18,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 9999,
                                    background: '#f59e0b',
                                    color: '#1c1917',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    lineHeight: 1,
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {item.badgeCount > 99 ? '99+' : item.badgeCount}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('waiting')}
                  aria-label={`Jump to Waiting, ${jumpStripCounts.waiting} jobs`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Waiting
                </button>
                <span>({jumpStripCounts.waiting})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('working')}
                  aria-label={`Jump to Working, ${jumpStripCounts.working} jobs`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Working
                </button>
                <span>({jumpStripCounts.working})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('readyToBill')}
                  aria-label={`Jump to Ready to Bill, ${jumpStripCounts.readyToBill} rows`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Ready to Bill
                </button>
                <span>({jumpStripCounts.readyToBill})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('billed')}
                  aria-label={`Jump to Billed Awaiting Payment, ${jumpStripCounts.billed} rows`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Billed Awaiting Payment
                </button>
                <span>({jumpStripCounts.billed})</span>
              </span>
              {jumpStripCounts.collections !== '0' ? (
                <>
                  <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                    →
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                    <button
                      type="button"
                      onClick={() => focusStagesSection('collections')}
                      aria-label={`Jump to Collections, ${jumpStripCounts.collections} rows`}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                        color: 'var(--text-red-700)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                      }}
                    >
                      Collections
                    </button>
                    <span>({jumpStripCounts.collections})</span>
                  </span>
                </>
              ) : null}
            </div>
            {/* "Recently added" (v2.1809) lives in the ☰ tools menu since
                v2.1973; this pill now renders ONLY while the flat view is
                open, as the prominent way back to the board. */}
            {stagesRecentViewOpen && (
            <button
              type="button"
              onClick={() => setStagesRecentViewOpen((o) => !o)}
              aria-pressed={stagesRecentViewOpen}
              aria-label={stagesRecentViewOpen ? 'Back to the pipeline board' : 'Show the last 100 jobs added, any status'}
              title={stagesRecentViewOpen ? 'Back to the pipeline board' : 'Show the last 100 jobs added, any status'}
              style={{
                marginLeft: 'auto',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.65rem',
                borderRadius: 9999,
                border: '1px solid var(--border-strong)',
                background: stagesRecentViewOpen ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: stagesRecentViewOpen ? 'var(--text-link)' : 'var(--text-700)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden>🕒</span>
              {stagesRecentViewOpen ? 'Back to board' : 'Recently added'}
            </button>
            )}
            {/* The three data-gap alerts (No customer / No pictures / No email)
                live in the money card's Fix-ups strip (v2.1961) — the toolbar
                strip they used to dock in here retired with the Old view (v2.2012). */}
          </div>
          <StagesAlertJobListModal
            open={stagesNoEmailModalOpen}
            onClose={() => setStagesNoEmailModalOpen(false)}
            jobs={stagesReadyToBillNoEmailJobs}
            onSelectJob={(jobId) => {
              setStagesNoEmailModalOpen(false)
              tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
            }}
            titleId="stages-no-email-modal-title"
            title="Ready to Bill jobs without a customer email"
            description="Stripe and emailed invoices need a customer email. Open Edit Job to add one."
          />
          <StagesNoCustomerJobsModal
            open={stagesNoCustomerModalOpen}
            onClose={() => setStagesNoCustomerModalOpen(false)}
            jobs={stagesJobsWithoutCustomer}
            onSelectJob={openStagesNoCustomerEditJob}
          />
          <StagesAlertJobListModal
            open={stagesNoJobPicturesModalOpen}
            onClose={() => setStagesNoJobPicturesModalOpen(false)}
            jobs={stagesWorkingJobsWithoutPictures}
            onSelectJob={openStagesNoJobPicturesEditJob}
            titleId="stages-no-job-pictures-modal-title"
            title="Working jobs without Customer Pictures"
            description="Working jobs in the current Stages search with no Customer Pictures URL set. Open Edit Job to add a link."
          />
          {(jobsListLoading || (jobsListRefreshing && !jobsListLoading)) && (
            <div
              role="status"
              aria-live="polite"
              style={{ textAlign: 'center', marginTop: '0.35rem', marginBottom: '0.75rem' }}
            >
              {jobsListLoading && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Loading jobs…
                  {(searchParams.get('openBankPayments') === 'true' || searchParams.get('openBankPayments') === '1') && (
                    <>
                      <br />
                      <span style={{ fontSize: '0.8125rem' }}>Opening Accounts Receivable when ready.</span>
                    </>
                  )}
                </p>
              )}
              {jobsListRefreshing && !jobsListLoading && (
                <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', margin: 0 }}>Updating jobs…</p>
              )}
            </div>
          )}
          {(() => {
            // "Recently added" view (v2.1809) replaces the sections while open.
            if (stagesRecentViewOpen) {
              return <JobsRecentlyAddedList onOpenJob={(jobId) => jobDetailModal?.openJobDetail({ jobId })} />
            }
            const { waiting, working, paid, readyToBillRows, billedActiveRows, collectionsRows } = stagesBoardLists

            function toggleStages(key: keyof typeof stagesSectionOpen) {
              setStagesSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
            }

            function toggleStagesJobThreadExpanded(id: string) {
              setExpandedJobThreadId((prev) => (prev === id ? null : id))
            }

            const workingTotal = working.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const waitingTotal = waiting.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const capableToBillTotal = capableToBillTotalFromWorking(working)
            const readyToBillTotal = readyToBillRowsExposureTotal(readyToBillRows)
            const billedTotal = billedActiveRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            // Aging-chip filter (v2.1311): narrows the LIST only; the title count/total
            // and the chips themselves always describe the whole section.
            const billedNoLineBucket = buildBilledNoLineBucket(billedActiveRows)
            const billedListRows = billedAgingFilter
              ? billedActiveRows.filter((r) =>
                  billedAgingFilter === 'no_line'
                    ? stageRowBilledRemainingAmount(r) > 0 && billedStageRowHasNoBillLine(r)
                    : billedStageRowAgingBucket(r) === billedAgingFilter,
                )
              : billedActiveRows
            const collectionsTotal = collectionsRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            // v2.1824: sections whose scope isn't fetched render header numbers
            // from the lean stats layer ('…' bridges the first stats load);
            // their bodies show a loading line on expand instead of empty tables.
            // v2.1825: an active search forces every section visible — matches
            // must never hide inside a collapsed section. Toggles keep writing
            // the real (post-search) prefs underneath.
            const stagesSearchActive = stagesSearchQuery.trim() !== ''
            const sectionShown = (section: keyof StagesSectionOpenState) =>
              stagesSearchActive || stagesSectionOpen[section]
            const sectionMerged = (section: keyof StagesSectionOpenState) =>
              cacheMergedScopes.has(scopeForStagesSection(section))
            const sectionScopeBusy = (section: keyof StagesSectionOpenState) =>
              cacheScopeLoading.has(scopeForStagesSection(section))
            const sectionHdr = (
              section: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections',
              liveCount: number,
              liveTotal: number,
            ): { count: string; total: string } => {
              if (stagesSearchActive || sectionMerged(section)) {
                return { count: String(liveCount), total: formatCurrencyAbbrevTruncated(liveTotal) }
              }
              const v = cacheHeaderStats?.[section === 'readyToBill' ? 'readyToBill' : section]
              return v
                ? { count: String(v.count), total: formatCurrencyAbbrevTruncated(v.total) }
                : { count: '…', total: '…' }
            }
            const sectionLoadingSuffix = (section: keyof StagesSectionOpenState) =>
              stagesSectionOpen[section] && !sectionMerged(section) && sectionScopeBusy(section) ? ' — loading' : ''
            const sectionBodyLoading = (label: string) => (
              <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Loading {label}…
              </p>
            )
            const waitingHdr = sectionHdr('waiting', waiting.length, waitingTotal)
            const workingHdr = sectionHdr('working', working.length, workingTotal)
            const readyToBillHdr = sectionHdr('readyToBill', readyToBillRows.length, readyToBillTotal)
            const billedHdr = sectionHdr('billed', billedActiveRows.length, billedTotal)
            const collectionsHdr = sectionHdr('collections', collectionsRows.length, collectionsTotal)
            // Server RPC is authoritative; this only controls button visibility (same office pool as other stage moves).
            const canManageCollections =
              authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
            return (
              <>
                <div id="stages-waiting" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('waiting')}
                    aria-expanded={sectionShown('waiting')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('waiting') ? '▼' : '▶'}</span>
                    Waiting ({waitingHdr.count}) - ${waitingHdr.total}{sectionLoadingSuffix('waiting')}
                  </button>
                </div>
                {sectionShown('waiting') && !stagesSearchActive && !sectionMerged('waiting') && sectionBodyLoading('Waiting jobs')}
                {sectionShown('waiting') && (stagesSearchActive || sectionMerged('waiting')) && (
                  <StagesSectionList
                    jobList={waiting}
                    stagesSortMode={stagesSortMode}
                    actionLabel={'Move to Working'}
                    onAction={(j) => void updateJobStatus(j.id, 'working')}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={undefined}
                    showPctComplete={true}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesEditMode={stagesEditModeActive}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    hazmatFeeJobIds={hazmatFeeJobIds}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    openJobCalendar={setCalendarJob}
                    stagesUpcomingByJobId={stagesUpcomingByJobId}
                    setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                  />
                )}

                <div id="stages-working" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('working')}
                    aria-expanded={sectionShown('working')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('working') ? '\u25BC' : '\u25B6'}</span>
                    Working ({workingHdr.count}) - ${workingHdr.total}{sectionLoadingSuffix('working')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapableToBillModalOpen(true)}
                    style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Capable of Being Billed: <span style={{ fontWeight: 600 }}>${capableDisplay}</span>
                  </button>
                </div>
                {sectionShown('working') && !stagesSearchActive && !sectionMerged('working') && sectionBodyLoading('Working jobs')}
                {sectionShown('working') && (stagesSearchActive || sectionMerged('working')) && (
                  <StagesSectionList
                    jobList={working}
                    stagesSortMode={stagesSortMode}
                    actionLabel={'Ready to Bill'}
                    onAction={(j) =>
                      stagesHamMode
                        ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
                        : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' }))}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={stagesHamMode
                      ? (j) => void updateJobStatus(j.id, 'waiting')
                      : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'waiting' })}
                    sendBackLabel={'Mark Waiting'}
                    showPctComplete={true}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesEditMode={stagesEditModeActive}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    hazmatFeeJobIds={hazmatFeeJobIds}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    openJobCalendar={setCalendarJob}
                    stagesUpcomingByJobId={stagesUpcomingByJobId}
                    setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                  />
                )}

                {/* Header row mirrors the Paid in Full section: toggle left, gear flushed right. */}
                <div id="stages-ready-to-bill" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('readyToBill')}
                    aria-expanded={sectionShown('readyToBill')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', flex: 1, minWidth: 0 }}
                  >
                    <span aria-hidden>{sectionShown('readyToBill') ? '\u25BC' : '\u25B6'}</span>
                    Ready to Bill ({readyToBillHdr.count}) - ${readyToBillHdr.total}{sectionLoadingSuffix('readyToBill')}
                  </button>
                  {(authRole === 'dev' || authRole === 'master_technician') && (
                    <button
                      type="button"
                      onClick={() => setReadyToBillNotifySettingsOpen(true)}
                      title="Ready to Bill notification settings (email + push)"
                      aria-label="Ready to Bill notification settings"
                      style={billedHeaderActionStyle(false)}
                    >
                      <span aria-hidden>{'\u2699'}</span>
                      Ready to Bill notifications
                    </button>
                  )}
                </div>
                {sectionShown('readyToBill') && !stagesSearchActive && !sectionMerged('readyToBill') && sectionBodyLoading('Ready to Bill')}
                {sectionShown('readyToBill') && (stagesSearchActive || sectionMerged('readyToBill')) && (
                  <StagesUnifiedSectionList
                    rows={readyToBillRows}
                    stagesSortMode={stagesSortMode}
                    actionLabel={'Bill Customer'}
                    onOpenLienRelease={openLienReleaseFromRow}
                    lienReleaseJobIds={lienReleaseJobIds}
                    demandOutJobIds={demandOutJobIds}
                    onJobAction={(j) => {
                      if (!jobLedgerHasCustomerForBilling(j.customer_id)) {
                        showToast('Link this job to a customer before billing.', 'error')
                        openEdit(j, { billingCustomerHighlight: true })
                        return
                      }
                      billCustomer?.openBillCustomer({
                        payload: { kind: 'job', job: jobBillingContextFromJob(j) },
                        onSuccess: async () => {
                          await loadJobs()
                          followMovedJob(j.id, 'billed')
                        },
                        onAfterEnsureSuccess: async () => {
                          await loadJobs()
                        },
                      })
                    }}
                    onInvoiceAction={(inv) => {
                      if (!jobLedgerHasCustomerForBilling(inv.job.customer_id)) {
                        showToast('Link this job to a customer before billing.', 'error')
                        openEdit(inv.job, { billingCustomerHighlight: true })
                        return
                      }
                      billCustomer?.openBillCustomer({
                        payload: {
                          kind: 'invoice',
                          job: jobBillingContextFromJob(inv.job),
                          // Memo + bundle flag drive the modal's standalone-charge
                          // pre-fill (riders: hazmat fee, trip charge).
                          invoice: {
                            id: inv.id,
                            amount: inv.amount,
                            status: inv.status,
                            stripe_invoice_memo: inv.stripe_invoice_memo ?? null,
                            is_primary_rtb_bundle: inv.is_primary_rtb_bundle ?? null,
                          },
                        },
                        onSuccess: async () => {
                          await loadJobs()
                          followMovedJob(inv.job.id, 'billed')
                        },
                        onAfterEnsureSuccess: async () => {
                          await loadJobs()
                        },
                      })
                    }}
                    onJobSendBack={(j) =>
                      stagesHamMode
                        ? void updateJobStatus(j.id, 'working')
                        : (setSendBackChecked(false),
                          setSendBackJob({
                            id: j.id,
                            hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                            jobName: j.job_name ?? '—',
                            toStatus: 'working',
                            rtbDraftCount: sendBackJobBillingContext(j.invoices).rtbDraftCount,
                            billing: sendBackJobBillingContext(j.invoices),
                          }))}
                    onInvoiceSendBack={(inv) => stagesHamMode ? deleteInvoice(inv.id) : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'delete' }))}
                    showRemaining={true}
                    showTimeOpen={true}
                    showCreatePartialInvoice={true}
                    jobSendBackLabel={'Send Job Back'}
                    invoiceBundleActionLabel={DELETE_DRAFT_BILL_LABEL}
                    invoiceStandaloneActionLabel={DELETE_DRAFT_BILL_LABEL}
                    flashInvoiceId={stagesInvoiceFlashId}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    stagesEditMode={stagesEditModeActive}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    hazmatFeeJobIds={hazmatFeeJobIds}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    openJobCalendar={setCalendarJob}
                    stagesUpcomingByJobId={stagesUpcomingByJobId}
                    setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                )}

                <div id="stages-billed" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleStages('billed')}
                      aria-expanded={sectionShown('billed')}
                      style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span aria-hidden>{sectionShown('billed') ? '▼' : '▶'}</span>
                      Billed Awaiting Payment ({billedHdr.count}) - ${billedHdr.total}{sectionLoadingSuffix('billed')}
                    </button>
                    {([
                      { key: '30_90' as const, label: `30+ · ${billedAgingBuckets.count30_90} · $${formatCurrencyAbbrevTruncated(billedAgingBuckets.sum30_90)}`, title: 'Billed 30–90 days ago (by bill date; a hand-set est. bill date wins) with money still owed — click to show only these rows', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', count: billedAgingBuckets.count30_90 },
                      { key: '90' as const, label: `90+ · ${billedAgingBuckets.count90} · $${formatCurrencyAbbrevTruncated(billedAgingBuckets.sum90)}`, title: 'Billed over 90 days ago (by bill date; a hand-set est. bill date wins) with money still owed — click to show only these rows', bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', count: billedAgingBuckets.count90 },
                      { key: 'no_line' as const, label: `No line · ${billedNoLineBucket.count} · $${formatCurrencyAbbrevTruncated(billedNoLineBucket.sum)}`, title: "Billed jobs whose open money is on no bill line — it can't age, be chased, or be forecast. Click to show only these rows", bg: 'var(--bg-subtle)', fg: 'var(--text-700)', count: billedNoLineBucket.count },
                    ]).map((chip) => {
                      const active = billedAgingFilter === chip.key
                      const empty = chip.count === 0
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          disabled={empty && !active}
                          aria-pressed={active}
                          title={chip.title}
                          onClick={() => {
                            if (active) {
                              setBilledAgingFilter(null)
                              return
                            }
                            setBilledAgingFilter(chip.key)
                            if (!stagesSectionOpen.billed) toggleStages('billed')
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: 22,
                            padding: '0 9px',
                            borderRadius: 9999,
                            border: active ? `1px solid ${'var(--border-400)'}` : '1px solid transparent',
                            background: chip.bg,
                            color: chip.fg,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            cursor: empty && !active ? 'default' : 'pointer',
                            opacity: empty && !active ? 0.55 : 1,
                          }}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                  {/* Quiet action tier (v2.1311): one visual step below the title, uniform 28px. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setGcReviewModalOpen(true)}
                    disabled={billedActiveRows.length === 0 && collectionsRows.length === 0}
                    title="Billed Awaiting Payment grouped by GC/Builder with bill-out dates"
                    aria-label="GC Review: Billed Awaiting Payment grouped by General Contractor"
                    style={billedHeaderActionStyle(billedActiveRows.length === 0 && collectionsRows.length === 0)}
                  >
                    <GcHardHatIcon size={13} style={{ flexShrink: 0 }} />
                    GC Review
                  </button>
                  <div style={{ position: 'relative', flexShrink: 0, width: 'fit-content' }}>
                    <button
                      type="button"
                      onClick={() => setBankPaymentsModalOpen(true)}
                      disabled={
                        !(
                          authRole === 'dev' ||
                          authRole === 'master_technician' ||
                          isAssistantLike(authRole) ||
                          authRole === 'primary'
                        )
                      }
                      title={accountsReceivableButtonAccessibleName}
                      aria-label={accountsReceivableButtonAccessibleName}
                      style={{
                        ...billedHeaderActionStyle(
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            isAssistantLike(authRole) ||
                            authRole === 'primary'
                          ),
                        ),
                        // AR is the primary action here (live queue behind the badge) — one shade stronger.
                        color: 'var(--text-700)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      {/* Same money mark as the Pipeline card's allocate-deposits move. */}
                      <span aria-hidden>{'💵'}</span>
                      Accounts Receivable
                    </button>
                    {typeof arBankTxUnallocatedCount === 'number' && arBankTxUnallocatedCount > 0 ? (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 18,
                          padding: '0 5px',
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 9999,
                          background: '#f59e0b',
                          color: '#1c1917',
                          fontSize: 10,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}
                      >
                        {arBankTxUnallocatedCount > 99 ? '99+' : arBankTxUnallocatedCount}
                      </span>
                    ) : null}
                  </div>
                  {(authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)) && (
                    <button
                      type="button"
                      onClick={() => setBilledShareModalOpen(true)}
                      title="Email this report to a teammate — now or scheduled — or print it"
                      aria-label="Share or print billed awaiting payment report"
                      style={billedHeaderActionStyle(false)}
                    >
                      <span aria-hidden>⇪</span>
                      Share / Print
                    </button>
                  )}
                  {(authRole === 'dev' || authRole === 'controller') && (
                    <button
                      type="button"
                      onClick={() => setBilledAgingChartOpen(true)}
                      title="Aging bubble chart — open $ vs days waiting, bubble = our cost"
                      aria-label="Billed aging chart"
                      style={billedHeaderActionStyle(false)}
                    >
                      <span aria-hidden>{'📊'}</span>
                      Chart
                    </button>
                  )}
                  {canSeeBilledExpectedPay && (
                    <button
                      type="button"
                      onClick={() => setBilledPaymentForecastOpen(true)}
                      title="Open billed dollars bucketed by expected payment date (bill date + customer pay speed)"
                      aria-label="Payment forecast"
                      style={billedHeaderActionStyle(false)}
                    >
                      <span aria-hidden>{'📅'}</span>
                      Payment forecast
                    </button>
                  )}
                  {(authRole === 'dev' || authRole === 'master_technician') && (
                    <button
                      type="button"
                      onClick={() => setPaymentEmailSettingsOpen(true)}
                      title="Payment email settings"
                      aria-label="Payment email settings"
                      style={billedHeaderActionStyle(false)}
                    >
                      <span aria-hidden>⚙</span>
                      Paid notifications
                    </button>
                  )}
                  </div>
                </div>
                {billedAgingFilter && (
                  // Filter-active banner (v2.1960, owner request): a full-width
                  // centered orange bar so a narrowed list can't read as the
                  // whole section. Saturated status orange stays literal.
                  <p
                    role="status"
                    style={{
                      margin: '0 0 0.5rem',
                      padding: '0.45rem 1rem',
                      width: '100%',
                      textAlign: 'center',
                      background: '#f59e0b',
                      color: 'var(--text-on-amber-solid)',
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {billedAgingFilter === 'no_line'
                      ? 'Showing only jobs with no bill line — Bill Customer or Edit Job creates the line their money should ride on'
                      : `Showing only ${billedAgingFilter === '90' ? '90+ day' : '30–90 day'} rows`}{' '}
                    ({billedListRows.length} of {billedActiveRows.length}) ·{' '}
                    {billedAgingFilter === 'no_line' && canMarkPromisedPay && billedListRows.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setFixBillLinesOpen(true)}
                          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        >
                          Fix bill lines…
                        </button>
                        {' · '}
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setBilledAgingFilter(null)}
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '2px' }}
                    >
                      Show all
                    </button>
                  </p>
                )}
                                {sectionShown('billed') && !stagesSearchActive && !sectionMerged('billed') && sectionBodyLoading('Billed Awaiting Payment')}
                {sectionShown('billed') && (stagesSearchActive || sectionMerged('billed')) && (
                  <StagesUnifiedSectionList
                    rows={billedListRows}
                    stagesSortMode={stagesSortMode}
                    billedExpectedPayChip={billedExpectedPayChipRenderer}
                    actionLabel={'Mark Paid'}
                    onJobAction={(j) => setMarkPaidJob(j)}
                    onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
                    onViewBill={(inv) => setViewBillInvoice(inv)}
                    showClickTooling={false}
                    onOpenLienTooling={(ctx) =>
                      setLienInstrumentsModal({ job: ctx.job, invoice: ctx.invoice })}
                    onOpenLienRelease={openLienReleaseFromRow}
                    lienReleaseJobIds={lienReleaseJobIds}
                    demandOutJobIds={demandOutJobIds}
                    onJobSendBack={(j) =>
                      stagesHamMode
                        ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
                        : (setSendBackChecked(false),
                          setSendBackJob({
                            id: j.id,
                            hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                            jobName: j.job_name ?? '—',
                            toStatus: 'ready_to_bill',
                            rtbDraftCount: 0,
                          }))}
                    onInvoiceSendBack={(inv) =>
                      stagesHamMode
                        ? void revertBilledInvoiceToReadyToBill(inv)
                        : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'revert' }))}
                    showRemaining={true}
                    showTimeOpen={true}
                    sendBackBelowRemaining={true}
                    showCreatePartialInvoice={false}
                    invoiceBundleActionLabel={'Send back'}
                    flashInvoiceId={stagesInvoiceFlashId}
                    onJobMoveToCollections={canManageCollections
                      ? (j) => {
                          setCollectionsNoteDraft('')
                          setCollectionsConfirm({ job: j, direction: 'to' })
                        }
                      : undefined}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    stagesEditMode={stagesEditModeActive}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    hazmatFeeJobIds={hazmatFeeJobIds}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    openJobCalendar={setCalendarJob}
                    stagesUpcomingByJobId={stagesUpcomingByJobId}
                    setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                )}

                <div id="stages-collections" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('collections')}
                    aria-expanded={sectionShown('collections')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('collections') ? '▼' : '▶'}</span>
                    Collections ({collectionsHdr.count}) - ${collectionsHdr.total}{sectionLoadingSuffix('collections')}
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Billed jobs flagged difficult to collect — still awaiting payment
                  </span>
                </div>
                {sectionShown('collections') && !stagesSearchActive && !sectionMerged('collections') && sectionBodyLoading('Collections')}
                {sectionShown('collections') && (stagesSearchActive || sectionMerged('collections')) && (collectionsRows.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    No jobs in Collections. Use “Move to Collections” on a Billed Awaiting Payment row to park a hard-to-collect job here.
                  </p>
                ) : (
                  <StagesUnifiedSectionList
                    rows={collectionsRows}
                    stagesSortMode={stagesSortMode}
                    actionLabel={'Mark Paid'}
                    onJobAction={(j) => setMarkPaidJob(j)}
                    onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
                    onViewBill={(inv) => setViewBillInvoice(inv)}
                    showClickTooling={false}
                    onOpenLienTooling={(ctx) =>
                      setLienInstrumentsModal({ job: ctx.job, invoice: ctx.invoice })}
                    onOpenLienRelease={openLienReleaseFromRow}
                    lienReleaseJobIds={lienReleaseJobIds}
                    demandOutJobIds={demandOutJobIds}
                    onJobSendBack={(j) => setCollectionsConfirm({ job: j, direction: 'from' })}
                    onInvoiceSendBack={(inv) => setCollectionsConfirm({ job: inv.job, direction: 'from' })}
                    showRemaining={true}
                    showTimeOpen={true}
                    sendBackBelowRemaining={true}
                    showCreatePartialInvoice={false}
                    jobSendBackLabel={'Send back to Billed'}
                    invoiceBundleActionLabel={'Send back to Billed'}
                    invoiceStandaloneActionLabel={'Send back to Billed'}
                    flashInvoiceId={stagesInvoiceFlashId}
                    jobNoteLine={(j) => j.collections_note ?? null}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    stagesEditMode={stagesEditModeActive}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    hazmatFeeJobIds={hazmatFeeJobIds}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    openJobCalendar={setCalendarJob}
                    stagesUpcomingByJobId={stagesUpcomingByJobId}
                    setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                ))}

                {/* Header row mirrors the Billed section: toggle on the left, affordances flushed right. */}
                <div style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStagesSectionOpen((prev) => {
                      const nextOpen = !prev.paid
                      if (nextOpen) {
                        queueMicrotask(() => void fetchPaidJobsIfNeeded(customerFilterForFetch))
                      }
                      return { ...prev, paid: nextOpen }
                    })
                  }}
                  aria-expanded={sectionShown('paid')}
                  style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', flex: 1, minWidth: 0 }}
                >
                  <span aria-hidden>{sectionShown('paid') ? '\u25BC' : '\u25B6'}</span>
                  {(() => {
                    const countPart = paidJobsLoading
                      ? '…'
                      : paidJobsMergedForKey === jobsListDataKey && jobsListDataKey != null
                        ? paid.length
                        : 'Expand to load'
                    const suffix = paidJobsLoading ? ' — loading' : ''
                    if (countPart === 'Expand to load') {
                      return (
                        <>
                          Paid in Full (
                          <span style={{ color: 'var(--text-red-600)' }}>Expand to load</span>)
                          {suffix}
                        </>
                      )
                    }
                    return `Paid in Full (${countPart})${suffix}`
                  })()}
                </button>
                {(authRole === 'dev' || authRole === 'controller') && (
                  <button
                    type="button"
                    onClick={() => setPaidProfitChartOpen(true)}
                    title="Profit vs clocked hours — bubble = revenue, losses below the $0 line"
                    aria-label="Paid profit chart"
                    style={billedHeaderActionStyle(false)}
                  >
                    <span aria-hidden>{'📊'}</span>
                    Chart
                  </button>
                )}
                {(authRole === 'dev' || authRole === 'master_technician') && (
                  <button
                    type="button"
                    onClick={() => setPaidEmailSettingsOpen(true)}
                    title="Paid in Full email settings"
                    aria-label="Paid in Full email settings"
                    style={billedHeaderActionStyle(false)}
                  >
                    <span aria-hidden>⚙</span>
                    Paid in Full notifications
                  </button>
                )}
                </div>
                {sectionShown('paid') ? (
                  <>
                    {paidJobsLoading ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }} role="status">
                        Loading paid jobs…
                      </p>
                    ) : null}
                    <StagesSectionList
                      jobList={paid}
                      stagesSortMode={stagesSortMode}
                      actionLabel={null}
                      onAction={() => {}}
                      showTimeOpen={true}
                      onSendBack={undefined}
                      onSendBackSimple={stagesHamMode
                        ? (j) => updateJobStatus(j.id, 'billed')
                        : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' })}
                      showPctComplete={true}
                      stagesJobFlashId={stagesJobFlashId}
                      stagesEditMode={stagesEditModeActive}
                      renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                      stagesStatusUpdatingId={stagesStatusUpdatingId}
                      pctCompleteSavingId={pctCompleteSavingId}
                      updateJobPctComplete={updateJobPctComplete}
                      commitStagesPctWithNote={commitStagesPctWithNote}
                      setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                      setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                      openEdit={openEdit}
                      openStagesDetailJobModal={openStagesDetailJobModal}
                      setAiaG702StagesJob={setAiaG702StagesJob}
                      canCreateHazmatFee={canCreateHazmatFee}
                      openHazmatFee={openHazmatFee}
                      canEditJobPctComplete={canEditJobPctComplete}
                      canManageJobPeople={canManageJobPeople}
                      setManageJobPeople={setManageJobPeople}
                      jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                      jobThreadDraft={jobThreadDraft}
                      jobThreadSubmittingId={jobThreadSubmittingId}
                      setJobThreadDraft={setJobThreadDraft}
                      submitJobThreadNote={submitJobThreadNote}
                    submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
                    loadJobThreadNotesForJob={loadJobThreadNotesForJob}
                      authUser={authUser}
                      showToast={showToast}
                      customers={customers}
                      openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                      stagesManHoursByJobId={stagesManHoursByJobId}
                      stagesManHoursLoading={stagesManHoursLoading}
                      stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                      expandedJobThreadId={expandedJobThreadId}
                      toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                      jobThreadStatsByJobId={jobThreadStatsByJobId}
                      jobThreadActivityByJobId={jobThreadActivityByJobId}
                      openJobThreadFullscreen={openJobThreadFullscreen}
                    openJobActivityExpand={openJobActivityExpand}
                    jobThreadFullscreen={jobThreadFullscreen}
                    setJobThreadFullscreen={setJobThreadFullscreen}
                      applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                      canOpenJobScheduleModal={canOpenJobScheduleModal}
                      openJobCalendar={setCalendarJob}
                      stagesUpcomingByJobId={stagesUpcomingByJobId}
                      setScheduleModalJob={setScheduleModalJob}
                    openQuickAssignForJob={openQuickAssignForJob}
                      authRole={authRole}
                      loadJobs={loadJobs}
                    onDevelopmentFilter={setStagesDevelopmentFilter}

                    jobContractCoverageByJobId={canSeeJobContracts ? jobContractCoverageByJobId : undefined}


                    onOpenJobContract={openJobContract}
                    />
                  </>
                ) : null}

                <JobsWeeklyMovementModal
                  open={weeklyMovementModalOpen}
                  onClose={() => setWeeklyMovementModalOpen(false)}
                  users={users}
                  showToast={showToast}
                  canSchedule={authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)}
                />
                <JobsWeeklyMoneyModal
                  open={weeklyMoneyModalOpen}
                  onClose={() => setWeeklyMoneyModalOpen(false)}
                  showToast={showToast}
                  users={users}
                />
                <JobsGcReviewModal
                  open={gcReviewModalOpen}
                  onClose={() => {
                    setGcReviewModalOpen(false)
                    setGcReviewStartRound(false)
                  }}
                  startInRound={gcReviewStartRound}
                  billedActiveRows={unfilteredBoardLists.billedActiveRows}
                  collectionsRows={unfilteredBoardLists.collectionsRows}
                  users={users}
                  isDev={authRole === 'dev'}
                  canCertify={authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)}
                  onOpenJobDetail={(jobId) => jobDetailModal?.openJobDetail({ jobId })}
                  onOpenJob={(jobId) => {
                    // Edit Job stacks above (z 1010 vs 60); saving refetches, and the
                    // fresh rows re-derive the rollup with GC Review still open.
                    tryOpenEditJob(jobId, {
                      onSaved: () => {
                        void loadJobs()
                        refreshCustomersAfterJobFormSave()
                      },
                    })
                  }}
                  onPrint={(groups, groupBy) => {
                    if (!openHtmlPrintWindow(buildGcStatementReportHtml(groups, { groupBy }))) {
                      showToast('Allow pop-ups to print the report.', 'error')
                    }
                  }}
                  onCopyForEmail={(group, _groupBy, extra) => {
                    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const portalUrl = extra?.portalUrl ?? null
                    const subject = gcStatementEmailSubject(group, dateStr)
                    // Subject rides at the top of the copied block so it can be
                    // cut into the email's subject field; the table below it is
                    // the body. Rich HTML pastes as a real table in Gmail /
                    // Outlook / Apple Mail; plain text covers everything else.
                    const html =
                      `<p style="margin:0 0 10px;font-size:12px;color:#6b7280"><strong>Subject:</strong> ${subject}</p>` +
                      buildGcStatementEmailHtml(group, { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl })
                    const text = `Subject: ${subject}\n\n${buildGcStatementEmailText(group, { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl })}`
                    void copyRichHtmlToClipboard(html, text).then(
                      () => showToast(`Copied the ${group.gcName} statement — paste it into your email.`, 'success'),
                      () => showToast('Could not copy — try again.', 'error'),
                    )
                  }}
                  emailForGc={(gcId) => {
                    const c = customers.find((x) => x.id === gcId)
                    return c ? extractContactFromCustomer(c).email : ''
                  }}
                  lastSentByGcId={gcLastSentByGcId}
                  onSendStatement={async (p) => {
                    try {
                      const { data, error: fnErr } = await supabase.functions.invoke('send-gc-statement-email', {
                        body: {
                          gc_customer_id: p.gcCustomerId,
                          gc_name: p.gcName,
                          group_by: p.groupBy,
                          to_email: p.toEmail,
                          cc_emails: p.ccEmails ?? [],
                          subject: p.subject,
                          email_html: p.emailHtml,
                          email_text: p.emailText,
                          total: p.total,
                          job_count: p.jobCount,
                        },
                      })
                      const resp = data as { success?: boolean; error?: string } | null
                      if (resp && typeof resp.error === 'string' && resp.error.length > 0) {
                        return { ok: false, error: resp.error }
                      }
                      if (fnErr) {
                        return { ok: false, error: fnErr.message || 'Send failed' }
                      }
                      showToast(`Statement emailed to ${p.toEmail}.`, 'success')
                      void refreshGcLastSent()
                      return { ok: true }
                    } catch (e) {
                      return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
                    }
                  }}
                />
                {billedTotalByNameModalOpen && (() => {
                  const byNameRows = new Map<string, StageRow[]>()
                  for (const r of billedActiveRows) {
                    const name = r.job.job_name || '—'
                    const list = byNameRows.get(name) ?? []
                    list.push(r)
                    byNameRows.set(name, list)
                  }
                  const entries = [...byNameRows.entries()]
                    .map(([name, rows]) => ({
                      name,
                      rows,
                      total: rows.reduce((sum, row) => sum + stageRowBilledRemainingAmount(row), 0),
                    }))
                    .sort((a, b) => b.total - a.total)
                  return (
                    <div role="dialog" aria-modal="true" aria-label="Billed Awaiting Payment by Job Name" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Billed Awaiting Payment by Job Name</h2>
                          <button
                            type="button"
                            onClick={() => printBilledAwaitingPaymentReport(billedActiveRows, { searchFilter: stagesSearchQuery })}
                            disabled={billedActiveRows.length === 0}
                            title="Print customers, contacts, and amounts due"
                            aria-label="Print billed awaiting payment report"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              flexShrink: 0,
                              height: 36,
                              padding: '0 0.75rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: billedActiveRows.length === 0 ? 'var(--bg-muted)' : 'var(--surface)',
                              cursor: billedActiveRows.length === 0 ? 'not-allowed' : 'pointer',
                              color: 'var(--text-700)',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
                              <path
                                fill="currentColor"
                                d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
                              />
                            </svg>
                            Print
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job Name</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(({ name, total, rows }, idx) => {
                              const expanded = billedTotalByNameExpandedName === name
                              const panelId = `total-by-name-detail-${idx}`
                              const detailRows = sortStageRowsForTotalByNameDetail(rows)
                              return (
                                <Fragment key={name}>
                                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setBilledTotalByNameExpandedName((prev) => (prev === name ? null : name))
                                        }
                                        aria-expanded={expanded}
                                        aria-controls={panelId}
                                        id={`total-by-name-toggle-${idx}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          padding: 0,
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--text-strong)',
                                          fontSize: 'inherit',
                                          textAlign: 'left',
                                          maxWidth: '100%',
                                        }}
                                      >
                                        <span aria-hidden style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                          {expanded ? '\u25BC' : '\u25B6'}
                                        </span>
                                        {name}
                                      </button>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>${formatCurrency(total)}</td>
                                  </tr>
                                  {expanded && (
                                    <tr>
                                      <td
                                        colSpan={2}
                                        style={{
                                          padding: 0,
                                          borderBottom:
                                            idx === entries.length - 1 ? 'none' : '1px solid var(--border)',
                                          background: 'var(--bg-subtle)',
                                        }}
                                      >
                                        <div id={panelId} role="region" aria-labelledby={`total-by-name-toggle-${idx}`} style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Line</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Amount</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Age</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detailRows.map((r, detailIdx) => {
                                                const amt = stageRowBilledRemainingAmount(r)
                                                const days = stageRowBilledAgeDays(r)
                                                const ageLabel = days == null ? '—' : `${days} day${days !== 1 ? 's' : ''}`
                                                const rowKey =
                                                  r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`
                                                const addr = (r.job.job_address ?? '').trim() || '—'
                                                const isLastBillInGroup = detailIdx === detailRows.length - 1
                                                return (
                                                  <Fragment key={rowKey}>
                                                    <tr style={{ borderBottom: 'none' }}>
                                                      <td style={{ padding: '0.35rem 0.5rem' }}>{stageRowBilledLineLabel(r)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>${formatCurrency(amt)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{ageLabel}</td>
                                                    </tr>
                                                    <tr
                                                      style={{
                                                        borderBottom: isLastBillInGroup ? 'none' : '1px solid var(--border)',
                                                      }}
                                                    >
                                                      <td
                                                        colSpan={3}
                                                        style={{
                                                          padding: '0 0.5rem 0.35rem',
                                                          fontSize: '0.75rem',
                                                          color: 'var(--text-muted)',
                                                        }}
                                                      >
                                                        {addr}
                                                      </td>
                                                    </tr>
                                                  </Fragment>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setBilledTotalByNameModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
                              setTimeout(() => document.getElementById('stages-billed')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Billed
                          </button>
                          <button type="button" onClick={() => setBilledTotalByNameModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {capableToBillModalOpen && (() => {
                  const rows = buildCapableToBillBreakdownRows(working)
                  return (
                    <div role="dialog" aria-modal="true" aria-label="Capable of Being Billed — Breakdown" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(720px, calc(100vw - 2rem))', maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          Jobs in Working with value not yet paid, billed, or queued to bill. Sorted by amount.
                        </p>
                        {rows.length === 0 ? (
                          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No jobs with billable amount</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>%</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Done</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Open bills</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>To Bill</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 80 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ job, toBill, valueCreated, openBilling }) => (
                                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <div>{job.job_name || '—'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{job.pct_complete != null ? `${job.pct_complete}%` : '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(valueCreated)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(Number(job.payments_made ?? 0))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{openBilling > 0 ? formatCurrency(openBilling) : '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(toBill)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        tryOpenEditJob(job.id, {
                                          initialJob: job,
                                          onSaved: () => {
                                            void loadJobs()
                                            refreshCustomersAfterJobFormSave()
                                          },
                                        })
                                        setCapableToBillModalOpen(false)
                                      }}
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                                <td colSpan={5} style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(capableToBillTotal)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        )}
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCapableToBillModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, working: true }))
                              setTimeout(() => document.getElementById('stages-working')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Working
                          </button>
                          <button type="button" onClick={() => setCapableToBillModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {whenInvoiceBillModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
                      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Est. bill date for partial invoice</h2>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {whenInvoiceBillModal.jobName} ({whenInvoiceBillModal.hcpNumber})
                      </p>
                      <label style={{ display: 'block', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
                        <input
                          type="date"
                          value={whenInvoiceBillModalDate}
                          onChange={(e) => setWhenInvoiceBillModalDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            !whenInvoiceBillModalDate.trim() ||
                            invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                          }
                          onClick={async () => {
                            if (!whenInvoiceBillModalDate.trim() || !whenInvoiceBillModal) return
                            await setInvoiceEstimatedBillDate(
                              whenInvoiceBillModal.invoiceId,
                              whenInvoiceBillModal.jobId,
                              whenInvoiceBillModalDate.trim()
                            )
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor:
                              !whenInvoiceBillModalDate.trim() ||
                              invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
      {activityExpandJob && (
        <JobsStagesActivityExpandModal
          job={activityExpandJob}
          activity={jobThreadActivityByJobId[activityExpandJob.id] ?? null}
          upcoming={stagesUpcomingByJobId[activityExpandJob.id] ?? null}
          onClose={() => setActivityExpandJob(null)}
          submitNoteWithBody={submitJobThreadNoteWithBody}
          viewerRole={authRole}
          pctComplete={activityExpandJob.pct_complete ?? null}
          canEditPct={canEditJobPctComplete}
          pctSaving={pctCompleteSavingId === activityExpandJob.id}
          onCommitPct={async (value, notetext) => {
            await commitStagesPctWithNote(activityExpandJob.id, value, notetext)
            // Keep the snapshot's % readout current — the board list refreshes
            // on its own cadence but this modal holds a copy of the row.
            setActivityExpandJob((prev) => (prev && prev.id === activityExpandJob.id ? { ...prev, pct_complete: value } : prev))
          }}
          teamMembers={activityExpandJob.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
          peopleAction={
            canManageJobPeople
              ? {
                  onClick: () =>
                    setManageJobPeople({
                      jobId: activityExpandJob.id,
                      jobLabel: `${(activityExpandJob.hcp_number ?? '').trim() || '—'} · ${(activityExpandJob.job_name ?? '').trim() || 'Job'}`,
                      currentTeamUserIds: activityExpandJob.team_members?.map((t) => t.user_id) ?? [],
                    }),
                }
              : undefined
          }
        />
      )}
      {calendarJob && (
        <JobCalendarModal
          job={calendarJob}
          onClose={() => setCalendarJob(null)}
          canOpenJobScheduleModal={canOpenJobScheduleModal}
          onOpenSchedule={(selectedYmd) => {
            setScheduleModalInitialDate(selectedYmd)
            setScheduleModalJob(calendarJob)
          }}
          onOpenWeekDispatch={(selectedYmd) => {
            const week = (selectedYmd ? companyWeekStartSundayContaining(selectedYmd) : null) ?? getDefaultWeekRange().start
            setCalendarJob(null)
            navigate(
              `/schedule-dispatch?jobId=${encodeURIComponent(calendarJob.id)}&week=${encodeURIComponent(week)}`,
            )
          }}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Ready to Bill</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={readyForBillingChecked1} onChange={(e) => setReadyForBillingChecked1(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={readyForBillingChecked2} onChange={(e) => setReadyForBillingChecked2(e.target.checked)} style={{ marginTop: 4 }} />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id} onClick={async () => { if (!readyForBillingJob) return; nudgeMissingBillingEmail(readyForBillingJob.id); const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id); if (!ok) return; setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {createPartialInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(createPartialInvoiceJob.hcp_number, createPartialInvoiceJob.click_number) || '—'} · {createPartialInvoiceJob.job_name ?? '—'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(jobPartialInvoiceRemainingDollars(createPartialInvoiceJob))}</div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Amount ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createPartialInvoiceAmount}
                  onChange={(e) => setCreatePartialInvoiceAmount(e.target.value)}
                  onBlur={() => {
                    if (!createPartialInvoiceJob) return
                    const raw = parseFloat(createPartialInvoiceAmount)
                    if (!Number.isFinite(raw)) return
                    const useCents = clampPartialInvoiceCentsToUnallocated(createPartialInvoiceJob, raw)
                    const clamped = useCents / 100
                    if (Math.round(raw * 100) !== useCents) {
                      setCreatePartialInvoiceAmount(String(clamped))
                      setError(null)
                    }
                  }}
                  placeholder="0"
                  style={{ width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </label>
              {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreatePartialInvoiceJob(null); setCreatePartialInvoiceAmount(''); setError(null) }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0)} onClick={createInvoiceFromModal} style={{ padding: '0.5rem 1rem', background: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? 'not-allowed' : 'pointer' }}>{creatingPartialInvoiceFromModal ? '…' : 'Create invoice'}</button>
            </div>
          </div>
        </div>
      )}
      {paidEmailSettingsOpen && (
        <PaidInFullEmailSettingsModal onClose={() => setPaidEmailSettingsOpen(false)} />
      )}
      {paymentEmailSettingsOpen && (
        <PaidInFullEmailSettingsModal variant="payment" onClose={() => setPaymentEmailSettingsOpen(false)} />
      )}
      {readyToBillNotifySettingsOpen && (
        <PaidInFullEmailSettingsModal variant="ready_to_bill" onClose={() => setReadyToBillNotifySettingsOpen(false)} />
      )}
      {billedBreakdownOpen && (
        <BilledByCustomerBreakdownModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          canSeeCharts={authRole === 'dev' || authRole === 'controller'}
          authRole={authRole}
          onClose={() => setBilledBreakdownOpen(false)}
          onOpenBill={(bill) => {
            setBilledBreakdownOpen(false)
            if (bill.invoiceId) {
              applyStagesInvoiceFocus(bill.invoiceId)
            } else {
              setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
              setPendingStagesJobFocusId(bill.jobId)
              setStagesJobFlashId(bill.jobId)
            }
          }}
          onOpenAgingChart={() => {
            setBilledBreakdownOpen(false)
            setBilledAgingChartOpen(true)
          }}
          onShow90={() => {
            setBilledBreakdownOpen(false)
            setBilledAgingFilter('90')
            focusStagesSection('billed')
          }}
          onGoToBilled={() => {
            setBilledBreakdownOpen(false)
            focusStagesSection('billed')
          }}
        />
      )}
      {billedAgingChartOpen && (
        <BilledAgingChartModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          onClose={() => setBilledAgingChartOpen(false)}
          onOpenInvoice={(invoiceId) => {
            setBilledAgingChartOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
        />
      )}
      {sessionNotesModal ? (
        <SessionNotesModal
          initialJob={sessionNotesModal.job}
          users={users}
          jobs={jobs}
          onOpenJobOnBoard={(jobId) => {
            setSessionNotesModal(null)
            focusJobOnBoard(jobId)
          }}
          onClose={() => setSessionNotesModal(null)}
        />
      ) : null}
      {billedPaymentForecastOpen && (
        <BilledPaymentForecastModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          paySpeeds={billedPaySpeeds}
          promises={promisedPayDates}
          todayYmd={calendarYmdInAppTzFromIso(new Date().toISOString())}
          onClose={() => setBilledPaymentForecastOpen(false)}
          onOpenInvoice={(invoiceId) => {
            setBilledPaymentForecastOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
          onOpenJobDetail={(jobId) => {
            // Land on the Bill tab (v2.2303, owner call): payments + invoice
            // links are what these doors exist to fix.
            setBilledPaymentForecastOpen(false)
            tryOpenEditJob(jobId, { initialTab: 'bill' })
          }}
          canExcludePayments={authRole === 'dev' || authRole === 'master_technician'}
          isDev={authRole === 'dev'}
          canEmailMoneyWaiting={authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)}
          onOpenJobStacked={(jobId, onSaved) => {
            // v2.2311: the Job window (z 1010) stacks above the drill-down
            // (z 80) — nothing closes, and every save refreshes the list.
            tryOpenEditJob(jobId, { initialTab: 'bill', onSaved })
          }}
          onPaySpeedsChanged={() => void refreshBilledPaySpeeds()}
          onEmail={
            authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
              ? () => setForecastShareModalOpen(true)
              : undefined
          }
        />
      )}
      {forecastShareModalOpen && <PaymentForecastShareModal onClose={() => setForecastShareModalOpen(false)} />}
      {chaseModalOpen && (
        <PaymentChaseModal
          queue={chaseFullQueue}
          loading={!nonPaidScopesMerged}
          paySpeeds={billedPaySpeeds}
          todayYmd={chaseTodayYmd}
          authRole={authRole}
          onClose={() => setChaseModalOpen(false)}
          onRecorded={() => {
            void loadChaseTouches()
            void loadPromisedPayDates()
          }}
          onOpenInvoice={(invoiceId) => {
            setChaseModalOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
        />
      )}
      {fixBillLinesOpen && (
        <FixBillLinesModal
          items={buildFixBillLineItems(stagesBoardLists.billedActiveRows)}
          onClose={() => setFixBillLinesOpen(false)}
          onAnyFixed={() => void loadJobs()}
        />
      )}
      {promisedPayModalJob && (
        <SetPromisedPayDateModal
          jobId={promisedPayModalJob.jobId}
          jobLabel={promisedPayModalJob.jobLabel}
          initialYmd={promisedPayModalJob.initialYmd}
          onClose={() => setPromisedPayModalJob(null)}
          onSaved={() => void loadPromisedPayDates()}
        />
      )}
      {paidProfitChartOpen && (
        <PaidProfitChartModal
          paidJobs={stagesBoardLists.paid}
          onClose={() => setPaidProfitChartOpen(false)}
          onOpenJob={(job) => {
            setPaidProfitChartOpen(false)
            openStagesDetailJobModal(job)
          }}
        />
      )}
      {billedShareModalOpen && (
        <BilledReportShareModal
          onClose={() => setBilledShareModalOpen(false)}
          onPrint={() => printBilledAwaitingPaymentReport(stagesBoardLists.billedActiveRows, { searchFilter: stagesSearchQuery })}
          printDisabled={stagesBoardLists.billedActiveRows.length === 0}
        />
      )}
      <BankPaymentsModal
        open={bankPaymentsModalOpen}
        onClose={() => setBankPaymentsModalOpen(false)}
        authUserId={authUser?.id}
        authRole={authRole}
        billedRows={bankPaymentsModalBilledRows}
        billedTargetsLoading={jobsListLoading && bankPaymentsModalBilledRows.length === 0}
        onApplied={async () => {
          await loadJobs()
        }}
        onOpenEditJob={(jobId) => tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })}
      />
      <JobBookModal
        open={jobBookModalOpen}
        onClose={() => setJobBookModalOpen(false)}
        onDbError={(msg) => showToast(msg, 'error')}
      />
      <JobsStagesHideGroupsModal
        open={stagesHideGroupsModalOpen}
        onClose={() => setStagesHideGroupsModalOpen(false)}
        jobs={jobs}
        filters={stagesExcludeFilters}
        onChange={setStagesExcludeFilters}
      />
      <JobsCombineSeparateModal
        open={combineSeparateModalOpen}
        onClose={() => setCombineSeparateModalOpen(false)}
        onAfterSuccess={() => void runJobsStagesSerializedPipeline(() => Promise.resolve(loadJobs()))}
      />
      <BilledBillViewModal
        invoice={viewBillInvoice}
        onClose={() => {
          setViewBillInvoice(null)
        }}
        onAfterVoidStripeInvoiceSuccess={() => {
          scheduleLoadJobsAfterMutation()
        }}
        onAfterStripeDetailsLoaded={() => {
          void (async () => {
            let list = await runFetchJobs(customerFilterForFetch)
            // `runFetchJobs` can return undefined when a coalesced fetch is already in flight; retry once.
            if (list == null) list = await runFetchJobs(customerFilterForFetch)
            if (list == null) return
            setViewBillInvoice((prev) => {
              if (!prev) return null
              const merged = findInvoiceWithJobFromJobs(list, prev.id)
              return merged ?? prev
            })
          })()
        }}
      />
      <LienInstrumentsModal
        open={lienInstrumentsModal != null}
        onClose={() => setLienInstrumentsModal(null)}
        job={lienInstrumentsModal?.job ?? null}
        invoice={lienInstrumentsModal?.invoice ?? null}
        signerNameFallback={lienReleaseSignerFallback}
        authEmail={authUser?.email?.trim() ?? ''}
        onOpenExternalPrefill={() => {
          const ctx = lienInstrumentsModal
          setLienInstrumentsModal(null)
          if (ctx) setLienToolingPrefillModal(ctx)
        }}
        onRecorded={() => void loadDemandOutJobIds()}
      />
      <LienToolingPrefillModal
        open={lienToolingPrefillModal != null}
        onClose={() => setLienToolingPrefillModal(null)}
        job={lienToolingPrefillModal?.job ?? null}
        invoice={lienToolingPrefillModal?.invoice ?? null}
        senderNameFallback={lienToolingSenderFallback}
        authEmail={authUser?.email?.trim() ?? ''}
      />
      <LienReleaseModal
        open={lienReleaseModal != null}
        onClose={() => setLienReleaseModal(null)}
        job={lienReleaseModal?.job ?? null}
        invoice={lienReleaseModal?.invoice ?? null}
        signerNameFallback={lienReleaseSignerFallback}
        onIssued={() => void loadLienReleaseJobIds()}
      />
      <JobContractModal
        open={jobContractModalJob != null}
        onClose={() => setJobContractModalJob(null)}
        job={jobContractModalJob}
        onChanged={() => void loadJobContractCoverage()}
      />
      <JobSignedAgreementModal
        open={signedAgreement != null}
        onClose={() => setSignedAgreement(null)}
        job={signedAgreement?.job ?? null}
        coverage={signedAgreement?.coverage ?? null}
        onOpenJob={signedAgreement ? () => { const j = signedAgreement.job; setSignedAgreement(null); openEdit(j) } : undefined}
        onStartNewAgreement={signedAgreement ? () => { const j = signedAgreement.job; setSignedAgreement(null); setJobContractModalJob(j) } : undefined}
      />
      <JobsContractSweepModal
        open={contractSweepOpen}
        onClose={() => setContractSweepOpen(false)}
        jobs={jobs}
        coverage={jobContractCoverageByJobId}
        onEditJob={(j) => openEdit(j)}
        onSent={() => void loadJobContractCoverage()}
      />
      <AiaG702G703Modal
        open={aiaG702StagesJob != null}
        onClose={() => setAiaG702StagesJob(null)}
        job={aiaG702StagesJob}
        hcpForFilename={aiaG702StagesJob?.hcp_number ?? ''}
      />
      <HazmatFeeModal
        job={hazmatFeeJob}
        onClose={() => setHazmatFeeJob(null)}
        onCreated={() => {
          loadJobs()
          void loadHazmatFeeJobIds()
        }}
      />
      <BilledPaymentConfirmationModal
        mode="job"
        invoice={null}
        payments={undefined}
        job={
          markPaidJob
            ? {
                id: markPaidJob.id,
                hcp_number: markPaidJob.hcp_number,
                click_number: markPaidJob.click_number,
                job_name: markPaidJob.job_name,
                revenue: markPaidJob.revenue,
                payments_made: markPaidJob.payments_made,
              }
            : null
        }
        stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
        onClose={() => setMarkPaidJob(null)}
        onSuccess={async () => {
          await loadJobs()
        }}
      />
      <BilledPaymentConfirmationModal
        mode="invoice"
        invoice={markPaidInvoice}
        payments={markPaidInvoice?.job.payments}
        job={null}
        stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
        onClose={() => setMarkPaidInvoice(null)}
        onSuccess={async () => {
          await loadJobs()
        }}
      />
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {`Job ${effectiveJobLedgerNumber(sendBackInvoice.inv.job.hcp_number, sendBackInvoice.inv.job.click_number) || '—'} · ${sendBackInvoice.inv.job.job_name || '—'} · $${Number(sendBackInvoice.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            {sendBackInvoice.action === 'delete' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>This will remove the invoice from Ready to Bill.</p>
            )}
            {sendBackInvoice.action === 'revert' &&
              invoiceNeedsStripeVoidForRevert(sendBackInvoice.inv) &&
              sendBackInvoiceStripeExplainerAfterFailure && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                This bill was sent via Stripe. We will void or remove the Stripe invoice so the customer cannot pay an unpaid bill. If it is already paid in Stripe, send back will fail until you resolve it there.
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendBackChecked} onChange={(e) => setSendBackChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackInvoice(null)
                  setSendBackChecked(false)
                  setSendBackInvoiceStripeExplainerAfterFailure(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || stagesInvoiceUpdatingId === sendBackInvoice.inv.id}
                onClick={() => {
                  void (async () => {
                    if (!sendBackChecked || !sendBackInvoice) return
                    if (stagesInvoiceSendBackConfirmLockRef.current) return
                    stagesInvoiceSendBackConfirmLockRef.current = true
                    const { inv, action } = sendBackInvoice
                    try {
                      if (action === 'delete') {
                        setSendBackInvoice(null)
                        setSendBackChecked(false)
                        setSendBackInvoiceStripeExplainerAfterFailure(false)
                        await deleteInvoice(inv.id)
                      } else {
                        const ok = await revertBilledInvoiceToReadyToBill(inv)
                        if (ok) {
                          setSendBackInvoice(null)
                          setSendBackChecked(false)
                          setSendBackInvoiceStripeExplainerAfterFailure(false)
                        } else if (invoiceNeedsStripeVoidForRevert(inv)) {
                          setSendBackInvoiceStripeExplainerAfterFailure(true)
                        }
                      }
                    } finally {
                      stagesInvoiceSendBackConfirmLockRef.current = false
                    }
                  })()
                }}
                style={{ padding: '0.5rem 1rem', background: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? 'pointer' : 'not-allowed' }}
              >
                {stagesInvoiceUpdatingId === sendBackInvoice.inv.id ? '…' : sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackJob.toStatus === 'working' ? 'Send Job Back' : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
              {sendBackJob.toStatus === 'ready_to_bill'
                ? 'This will move the job back to Ready to Bill.'
                : sendBackJob.billing?.stageBilledContinues
                  ? `The job returns to Working. ${
                      sendBackJob.billing.billedCount === 1
                        ? 'Its billed line stays billed'
                        : `Its ${sendBackJob.billing.billedCount} billed lines stay billed`
                    } ($${formatCurrency(sendBackJob.billing.billedTotalDollars)}).${
                      sendBackJob.rtbDraftCount > 0
                        ? ' The unsent remainder draft is removed and comes back automatically the next time the job is ready to bill.'
                        : ''
                    }`
                  : sendBackJob.rtbDraftCount > 0
                  ? `This will move the job back to Assigned Jobs (Working). ${
                      sendBackJob.rtbDraftCount === 1
                        ? `This will also remove 1 Ready to Bill draft bill (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                        : `This will also remove ${sendBackJob.rtbDraftCount} Ready to Bill draft bills (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                    }`
                  : 'This will move the job back to Assigned Jobs (Working).'}
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {sendBackJob.hcpNumber} · {sendBackJob.jobName}
            </p>
            {sendBackJob.toStatus === 'working' && sendBackCollectPaymentNotice != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>{sendBackCollectPaymentNotice}</p>
            )}
            {sendBackStatusEventLine != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {sendBackStatusEventLine}
              </p>
            )}
            {sendBackJob.toStatus === 'ready_to_bill' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                Billed lines on this job will be removed (Stripe invoices voided first where applicable). Lines with recorded payments block send back until adjusted. Paid Stripe invoices block until resolved in Stripe.
              </p>
            )}
            {sendBackNeedsAttestation && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendBackChecked}
                    onChange={(e) => setSendBackChecked(e.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
                </label>
              </div>
            )}
            {sendBackJob.toStatus === 'working' && sendBackJob.billing?.stageBilledContinues && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {[SEND_BACK_STAGE_BILLED_REASON, SEND_BACK_REWORK_REASON].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSendBackReason(r)}
                    aria-pressed={sendBackReason === r}
                    style={{
                      font: 'inherit',
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 999,
                      border: sendBackReason === r ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                      background: sendBackReason === r ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                      color: 'var(--text-strong)',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            {sendBackJob.toStatus === 'working' && (
              <SendBackReasonField
                value={sendBackReason}
                onChange={setSendBackReason}
                disabled={stagesStatusUpdatingId === sendBackJob.id}
              />
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackJob(null)
                  setSendBackChecked(false)
                  setSendBackReason('')
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  (sendBackNeedsAttestation && !sendBackChecked) ||
                  (sendBackJob.toStatus === 'working' && sendBackReasonError(sendBackReason) != null) ||
                  stagesStatusUpdatingId === sendBackJob.id
                }
                onClick={async () => {
                  if (!sendBackJob) return
                  if (sendBackJob.toStatus === 'working' && sendBackReasonError(sendBackReason) != null) return
                  if (sendBackJob.toStatus === 'ready_to_bill') {
                    const token = await getAccessTokenForEdgeFunctions()
                    if (!token) {
                      setError('Not signed in')
                      return
                    }
                    const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
                      jobId: sendBackJob.id,
                      authRole,
                      accessToken: token,
                    })
                    if (!prep.ok) {
                      setError(prep.message)
                      return
                    }
                  }
                  const ok = await updateJobStatus(sendBackJob.id, sendBackJob.toStatus)
                  if (!ok) return
                  if (sendBackJob.toStatus === 'working') {
                    const noted = await postSendBackReasonNote(sendBackJob.id, authUser?.id, sendBackReason)
                    if (!noted) showToast('Sent back, but the reason note could not be posted — add it in Job activity.', 'warning')
                  }
                  setSendBackJob(null)
                  setSendBackChecked(false)
                  setSendBackReason('')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background:
                    (!sendBackNeedsAttestation || sendBackChecked) && stagesStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor:
                    (!sendBackNeedsAttestation || sendBackChecked) && stagesStatusUpdatingId !== sendBackJob.id
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackJob.id ? '…' : sendBackJob.toStatus === 'working' ? 'Send Job Back' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmJobStatusJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {confirmJobStatusJob.message}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmJobStatusJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === confirmJobStatusJob.id}
                onClick={async () => {
                  if (!confirmJobStatusJob) return
                  const ok = await updateJobStatus(confirmJobStatusJob.id, confirmJobStatusJob.toStatus)
                  if (!ok) return
                  setConfirmJobStatusJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== confirmJobStatusJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== confirmJobStatusJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === confirmJobStatusJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackConfirmJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {sendBackConfirmJob.toStatus === 'waiting'
                ? 'This will move the job back to Waiting.'
                : sendBackConfirmJob.toStatus === 'ready_to_bill'
                  ? 'This will move the job back to Ready to Bill.'
                  : 'This will move the job back to Billed Awaiting Payment.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSendBackConfirmJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === sendBackConfirmJob.id}
                onClick={async () => {
                  if (!sendBackConfirmJob) return
                  const ok = await updateJobStatus(sendBackConfirmJob.id, sendBackConfirmJob.toStatus)
                  if (!ok) return
                  setSendBackConfirmJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== sendBackConfirmJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== sendBackConfirmJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackConfirmJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {collectionsConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
              {collectionsConfirm.direction === 'to' ? 'Move to Collections?' : 'Send back to Billed?'}
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {collectionsConfirm.direction === 'to'
                ? `Flag ${(collectionsConfirm.job.hcp_number ?? '').trim() || (collectionsConfirm.job.click_number ?? '').trim() || '—'} · ${(collectionsConfirm.job.job_name ?? '').trim() || 'Job'} as difficult to collect? It stays Billed — this only moves it to the Collections section.`
                : `Return ${(collectionsConfirm.job.hcp_number ?? '').trim() || (collectionsConfirm.job.click_number ?? '').trim() || '—'} · ${(collectionsConfirm.job.job_name ?? '').trim() || 'Job'} to Billed Awaiting Payment?`}
            </p>
            {collectionsConfirm.direction === 'to' ? (
              <label style={{ display: 'block', margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                Note (optional)
                <textarea
                  value={collectionsNoteDraft}
                  onChange={(e) => setCollectionsNoteDraft(e.target.value)}
                  placeholder="e.g. customer disputing invoice, no response in 60 days"
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </label>
            ) : collectionsConfirm.job.collections_note ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', fontStyle: 'italic' }}>
                Collections note: {collectionsConfirm.job.collections_note}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setCollectionsConfirm(null)
                  setCollectionsNoteDraft('')
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={collectionsSaving}
                onClick={async () => {
                  if (!collectionsConfirm || collectionsSaving) return
                  const { job, direction } = collectionsConfirm
                  setCollectionsSaving(true)
                  try {
                    const res = await setJobCollectionsFlag(job.id, direction === 'to', direction === 'to' ? collectionsNoteDraft : undefined)
                    if (!res.ok) {
                      showToast(res.error ?? 'Could not update Collections.', 'error')
                      return
                    }
                    setCollectionsConfirm(null)
                    setCollectionsNoteDraft('')
                    showToast(direction === 'to' ? 'Job moved to Collections.' : 'Job returned to Billed Awaiting Payment.', 'success')
                    await loadJobs()
                    if (stagesFollowMoves) {
                      setStagesSectionOpen((prev) => ({ ...prev, [direction === 'to' ? 'collections' : 'billed']: true }))
                      setPendingStagesJobFocusId(job.id)
                      setStagesJobFlashId(job.id)
                    }
                  } finally {
                    setCollectionsSaving(false)
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: !collectionsSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !collectionsSaving ? 'pointer' : 'not-allowed',
                }}
              >
                {collectionsSaving ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {quickAssignJob ? (
        <Suspense fallback={null}>
          <QuickAssignSheet
            open
            initialJob={jobWithDetailsToQuickAssignHubRow(quickAssignJob)}
            onClose={() => setQuickAssignJob(null)}
            onScheduled={() => {
              // Targeted refresh only — the row's green NEXT line updates in
              // place; no loadJobs(), so scroll/search/expanded state survive.
              const id = quickAssignJob.id
              void fetchStagesUpcomingScheduleForJobs([id], scheduleTodayDateKey()).then((m) => {
                setStagesUpcomingByJobId((prev) => {
                  const next = { ...prev }
                  const up = m[id]
                  if (up) next[id] = up
                  else delete next[id]
                  return next
                })
              })
            }}
          />
        </Suspense>
      ) : null}
      {scheduleModalJob ? (
        <ScheduleJobModal
          key={scheduleModalJob.id}
          open
          onClose={() => {
            setScheduleModalJob(null)
            setScheduleModalInitialDate(null)
          }}
          jobId={scheduleModalJob.id}
          jobTitle={`${(scheduleModalJob.hcp_number ?? '').trim() || '—'} · ${(scheduleModalJob.job_name ?? '').trim() || 'Job'}`}
          teamMembers={(scheduleModalJob.team_members ?? []).map((tm) => ({
            user_id: tm.user_id,
            name: tm.users?.name ?? null,
          }))}
          assigneeCandidates={users.map((u) => ({ user_id: u.id, name: u.name }))}
          initialWorkDate={scheduleModalInitialDate}
        />
      ) : null}
      <ManageJobPeopleModal
        open={manageJobPeople != null}
        onClose={() => setManageJobPeople(null)}
        jobId={manageJobPeople?.jobId ?? null}
        jobLabel={manageJobPeople?.jobLabel ?? ''}
        currentTeamUserIds={manageJobPeople?.currentTeamUserIds ?? []}
        onChanged={() => void loadJobs()}
      />
      {returnEditBannerJobId && active ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            background: '#1e40af',
            color: 'white',
            borderRadius: 8,
            border: '2px solid #1d4ed8',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: 'min(360px, calc(100vw - 2rem))',
          }}
        >
          <button
            type="button"
            onClick={() => {
              const jid = returnEditBannerJobId
              clearReturnEditJobFromStages()
              setReturnEditBannerJobId(null)
              if (!jid) return
              tryOpenEditJob(jid, {
                initialJob: jobs.find((j) => j.id === jid),
                onSaved: () => {
                  void loadJobs()
                },
              })
            }}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.15rem 0',
            }}
          >
            Back to Edit Job
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              clearReturnEditJobFromStages()
              setReturnEditBannerJobId(null)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1.35rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 0.15rem',
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </SessionNotesOpenerContext.Provider>
    </StagesSearchHighlightProvider>
  )
})

export default JobsStagesTab
