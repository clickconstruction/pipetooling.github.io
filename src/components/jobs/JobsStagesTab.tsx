import { stageRowPayerCustomerId } from '../../lib/jobs/billToParty'
import { lienSignerNameFor, lienSignerPhoneFor } from '../../lib/jobs/lienSigner'
import { collectionsClaimGapWords } from '../../lib/jobs/lienClaimCorrection'
import {
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
import { useOrgDefault } from '../../hooks/useOrgDefault'
import { orgDefaultBool } from '../../lib/orgDefaults'
import { readDeviceString, writeDeviceString } from '../../lib/deviceString'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatCurrencyAbbrevTruncated, formatCurrencyNoCents, formatEstimatedCompletionDisplay, formatJobNameTwoLines } from '../../lib/jobs/jobFormatting'
import { useJobFollowupQuietDays } from '../../hooks/useJobFollowupQuietDays'
import { advanceConsequence, jobNextLine, type JobNextLine, type JobNextLineInput, type JobNextStage, type PhoneRowFilter } from '../../lib/jobs/jobNextLine'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'
import { deriveStagesBillingActivityDetail } from '../../lib/stagesJobReferenceDates'
import { JobsStagesPhoneStrip, PHONE_STAGE_ORDER, type PhoneStageKey } from './JobsStagesPhoneStrip'
import type { StagesPhoneRowsMode } from './stagesPhoneRowsMode'
import { useJobFollowupQueueCount } from '../../hooks/useJobFollowupQueueCount'
import { JobsGcReviewModal } from './JobsGcReviewModal'
import { ensureRemainderResyncOutcome } from '../../lib/jobs/ensureRtbRemainderResult'
import { sendBackReasonError } from '../../lib/jobs/jobSendBackNote'
import {
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
import { latestTemperatureByGc, trailingWeekStarts } from '../../lib/jobs/temperatureBoard'
import { listGcStatementRoundMarks, listGcStatementRoundMarksSince, listGcStatementSenders } from '../../lib/gcStatementRoundIo'
import {
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcStatementEmailSubject,
} from '../../lib/jobsDocuments/gcStatementEmail'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import {
  billedStageRowAgingBucket,
  billedStageRowHasNoBillLine,
  buildBilledAgingBuckets,
  buildBilledNoLineBucket,
  effectiveInvoiceEstBillDate,
  stageRowBilledAgeDays,
  stageRowBilledAgeReference,
  stageRowBilledRemainingAmount,
  billedRowsRemainingTotal,
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
import JobContractModal from './JobContractModal'
import JobSignedAgreementModal, { type SignedCoverage } from './JobSignedAgreementModal'
import { useJobContractsNudge } from '../../hooks/useJobContractsNudge'
import { useJobCrewPositions } from '../../hooks/useJobCrewPositions'
import type { ContractStage } from '../../lib/jobs/jobContractNudge'
import JobsContractSweepModal from './JobsContractSweepModal'
import {
  buildJobContractCoverage,
  filterJobsByContractCoverage,
  isContractGap,
  parseStagesContractFilter,
  type JobContractRowLike,
  type SignedEstimateLike,
  type StagesContractFilter,
} from '../../lib/jobs/jobContractCoverage'
import { PipelineOverview } from './PipelineOverview'
import { pipelineOverviewHiddenBySearch } from '../../lib/jobs/pipelineOverview'
import type { PipelineBurnAlert } from '../../lib/jobs/jobSummaryBurn'
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
import NewReportModal from '../NewReportModal'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, companyWeekStartSundayContaining, getDefaultWeekRange } from '../../utils/dateUtils'
import { fetchStagesUpcomingScheduleForJobs, type StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { fetchStagesWeekSoFarForJobs, type StagesWeekSoFar } from '../../lib/stagesWorkedDays'
import { stripWeekStartYmd } from '../../lib/jobs/stagesScheduleStrip'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import JobsStagesTable from './JobsStagesTable'
import JobsStagesUnifiedTable from './JobsStagesUnifiedTable'
import JobsStagesCardList, { JobsStagesUnifiedCardList } from './JobsStagesCardList'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import BankPaymentsModal from './BankPaymentsModal'
import PaidInFullEmailSettingsModal from './PaidInFullEmailSettingsModal'
import BilledAgingChartModal from './BilledAgingChartModal'
import BilledPaymentForecastModal from './BilledPaymentForecastModal'
import { useForecastWorkMonths } from '../../hooks/useForecastWorkMonths'
import PaymentChaseModal from './PaymentChaseModal'
import { buildPaymentChaseQueue, parseChaseTouchesRpc, summarizePaymentChase, type ChaseTouch } from '../../lib/jobs/paymentChase'
import { buildCustomerPromiseRecords, classifyPromises, parsePromiseRecordsRpc, type CustomerPromiseRecord } from '../../lib/jobs/paymentPromises'
import { buildReliabilityLine } from '../../lib/jobs/paymentReliability'
import BilledReliabilityLine from './BilledReliabilityLine'
import type { StagesMoneyMoveKey } from '../../lib/jobs/stagesMoneyMoveLink'
import FixBillLinesModal from './FixBillLinesModal'
import { buildFixBillLineItems } from '../../lib/jobs/fixBillLines'
import BilledByCustomerBreakdownModal from './BilledByCustomerBreakdownModal'
import PaidProfitChartModal from './PaidProfitChartModal'
import BilledReportShareModal from './BilledReportShareModal'
import PaymentForecastShareModal from './PaymentForecastShareModal'
import JobBookModal from './JobBookModal'
import LegalDeskModal from './legal/LegalDeskModal'
import { useLegalMatters } from '../../hooks/useLegalMatters'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import JobsCombineSeparateModal from './JobsCombineSeparateModal'
import StagesNoCustomerJobsModal from './StagesNoCustomerJobsModal'
import OwnerConfirmListModal from './OwnerConfirmListModal'
import StagesAlertJobListModal from './StagesAlertJobListModal'
import { StagesBilledTotalByNameModal } from './StagesBilledTotalByNameModal'
import { StagesCapableToBillModal } from './StagesCapableToBillModal'
import { StagesEstBillDateModal } from './StagesEstBillDateModal'
import BilledPaymentConfirmationModal from './BilledPaymentConfirmationModal'
import BilledBillViewModal from './BilledBillViewModal'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import LienToolingPrefillModal from './LienToolingPrefillModal'
import LienInstrumentsModal from './LienInstrumentsModal'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import LienDeskModal from './LienDeskModal'
import GcOnNoticeModal from './GcOnNoticeModal'
import { useLienDeskData } from '../../hooks/useLienDeskData'
import { syncLienDeskAfterRecord } from '../../lib/jobs/lienDeskIo'
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
  developmentFilterOptionsFromJobs,
  filterJobsByDevelopment,
  accountManFilterOptionsFromJobs,
  filterJobsByAccountMan,
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
  stagesJobsOpenBalanceTotal,
  planPartialInvoice,
  reclampedPartialInvoiceInput,
  sortStagesJobsByEffectiveNumberDesc,
} from '../../lib/jobsStagesBoard'
import { buildCapableToBillBreakdownRowsWithPlans, capableToBillTotalWithPlans } from '../../lib/jobs/capableToBillPlan'
import { useWorkingStagePlanInputs } from '../../hooks/useWorkingStagePlanInputs'
import {
  countStagesExclusions,
  filterJobsByExclusions,
  loadStagesExcludeFilters,
  saveStagesExcludeFilters,
  type StagesExcludeFilters,
} from '../../lib/jobsStagesExcludeFilters'
import {
  loadStagesSortMode,
  saveStagesSortMode,
  toggleStagesProgressSort,
  type StagesBoardSortMode,
  toggleStagesNextFirstSort,
} from '../../lib/jobsStagesSortMode'
import {
  countStagesWhenPills,
  filterJobsByStagesWhenPill,
  makeStagesNextFirstComparator,
  STAGES_WHEN_PILL_LABELS,
  STAGES_WHEN_PILLS,
  stagesWhenForJobs,
  type StagesWhenPill,
} from '../../lib/jobs/stagesWhenPills'
import { stagesJumpStripCount } from '../../lib/jobs/stagesJumpStrip'
import JobsRecentlyAddedList from './JobsRecentlyAddedList'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import JobsStagesHideGroupsModal from './JobsStagesHideGroupsModal'
import { JobsStagesToolsMenu, type StagesToolsFilters } from './JobsStagesToolsMenu'
import { JobsStagesCommandBar } from './JobsStagesCommandBar'
import { JobsStagesJumpStrip } from './JobsStagesJumpStrip'
import { StagesReadyForBillingConfirmModal } from './StagesReadyForBillingConfirmModal'
import { StagesSendBackSimpleConfirmModal } from './StagesSendBackSimpleConfirmModal'
import { StagesCollectionsConfirmModal } from './StagesCollectionsConfirmModal'
import { StagesSendBackInvoiceModal } from './StagesSendBackInvoiceModal'
import { StagesSendBackJobModal } from './StagesSendBackJobModal'
import { StagesCreatePartialInvoiceModal } from './StagesCreatePartialInvoiceModal'
import { JobsMapCard } from './JobsMapCard'
import { StagesSearchHighlightProvider, StagesSearchMark } from './StagesSearchMark'
import SessionNotesModal from './SessionNotesModal'
import { StagesCrewModalContext } from '../../contexts/StagesCrewModalContext'
import { StagesCrewModal } from './StagesCrewModal'
import { SessionNotesOpenerContext } from './sessionNotesOpenerContext'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'
import { findJobsByNumber, stagesSectionKeyForJobRow } from '../../lib/jobs/stagesJobNumberJump'
import { describeBoardSnapshotAge } from '../../lib/jobs/boardSnapshot'
import { NON_PAID_SCOPES } from '../../lib/jobs/boardScopes'
import { fetchLeanJobIdsByNumber, fetchLeanJobSearchIds } from '../../lib/jobs/leanJobSearch'
import { fetchJobsLedgerWithDetailsForStages } from '../../lib/fetchJobsLedgerWithDetailsForStages'
import {
  readStagesSectionOpenPrefs,
  scopeForStagesSection,
  writeStagesSectionOpenPrefs,
  type StagesSectionOpenState,
  stagesSectionElementId,
} from '../../lib/jobs/stagesSectionPrefs'
import * as stagesGates from '../../lib/jobs/stagesRoleGates'
import { accountsReceivableButtonName } from '../../lib/jobs/stagesAccountsReceivableButton'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import type { StagesSectionToolKey } from '../../lib/jobs/stagesSectionToolsMenu'
import { JobsStagesSectionToolsMenu } from './JobsStagesSectionToolsMenu'
import { stagesPaidHeaderSearchCount, stagesPaidSearchHint } from '../../lib/jobs/stagesPaidSearchHint'
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
import { useJobAccountEvidenceGapsNudge } from '../../hooks/useJobAccountEvidenceGapsNudge'
import { useOwnerConfirmRows } from '../../hooks/useOwnerConfirmRows'

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
  /** `?stagesMoney=` deep link: open the Weekly money movement modal (v2.1443). `weekMonday` (Tier-2 #17, `&stagesMoneyWeek=`) pins it to that week. */
  openWeeklyMoney: (weekMonday?: string | null) => void
  /** `?showBilledTotalByName=` deep link: open the Total by Name modal. */
  showBilledTotalByName: () => void
  /** `?stagesMove=` deep link (v2.2145): open what a Today's Money Opportunities card opens (Quickfill → Jobs Cleanup). */
  openMoneyMove: (key: StagesMoneyMoveKey) => void
  /** `?legal=<payer key | 1>` deep link (Legal desk PR 1, v2.3293): open the ⚖ Legal desk, on one account when a key is given. */
  openLegalDesk: (payerKey?: string | null, tab?: 'fees_steps' | null) => void
  /** The Lien desk (v2.3405), optionally landing on one job's item. */
  openLienDesk: (jobId?: string | null) => void
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
  /** v2.3610: set while the rows are the board this device remembered (see JobsListCacheContext). */
  jobsListSnapshotAt?: number | null
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
  /** Burn card on the money story (v2.3191): computed page-side from the Job Summary aggregates; null hides. */
  pipelineBurnAlert?: PipelineBurnAlert | null
  /** "Show all N" → the Job Summary tab, In progress, sorted worst projected margin first. */
  onShowBurnList?: () => void
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


/** v2.3610: the age of the remembered board, beside *Updating jobs…* while it is on screen. */
function BoardSnapshotAgeChip({ savedAt }: { savedAt: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: '0.4rem',
        padding: '0.05rem 0.5rem',
        borderRadius: 999,
        fontSize: '0.72rem',
        background: 'var(--bg-amber-100)',
        border: '1px solid var(--border-amber)',
        color: 'var(--text-amber-800)',
        verticalAlign: 'middle',
      }}
    >
      board from {describeBoardSnapshotAge(savedAt, Date.now())}
    </span>
  )
}

const STAGES_PHONE_OVERVIEW_KEY = 'jobs-stages-phone-overview-open'

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
    jobsListSnapshotAt = null,
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
    pipelineBurnAlert = null,
    onShowBurnList,
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
  // Job accounts at the counter (v2.3430): the Fix-ups chip's count — the RPC gates on the office set itself.
  const { gaps: jobAccountEvidenceGaps } = useJobAccountEvidenceGapsNudge(active && Boolean(authUser))
  // Owner of record to confirm (v2.3447): GC jobs with approved hours and no confirmed owner — office-gated in the RPC.
  const { rows: ownerConfirmRows, reload: reloadOwnerConfirmRows } = useOwnerConfirmRows(active && Boolean(authUser))
  const [ownerConfirmModalOpen, setOwnerConfirmModalOpen] = useState(false)

  // Full-page Job activity modal — opened by the activity box's corner expand
  // button and the row's "N Reports" chip. One instance for the whole board.
  const [activityExpandJob, setActivityExpandJob] = useState<JobWithDetails | null>(null)
  /** v2.3373: the crew modal — the Crew & Dates line (or the phone sheet's Crew and hours) opens it. */
  const [crewModalJob, setCrewModalJob] = useState<JobWithDetails | null>(null)
  const openJobActivityExpand = useCallback(
    (job: JobWithDetails) => {
      if (loadJobThreadNotesForJob) void loadJobThreadNotesForJob(job.id)
      setActivityExpandJob(job)
    },
    [loadJobThreadNotesForJob],
  )
  // v2.3197: the activity box's report pill — New Report preselected on the row's job.
  const [newReportJob, setNewReportJob] = useState<JobWithDetails | null>(null)
  const openNewReportForJob = useCallback((job: JobWithDetails) => setNewReportJob(job), [])

  const canOpenJobScheduleModal = useMemo(() => stagesGates.canOpenJobScheduleModal(authRole), [authRole])
  // Matches the jobs_ledger UPDATE RLS (dev / master_technician / assistant / primary)
  // — who may set a job's % complete from the Stages expanded panel.
  const canEditJobPctComplete = useMemo(() => stagesGates.canEditJobPctComplete(authRole), [authRole])
  // Matches the jobs_ledger_team_members INSERT/DELETE RLS (dev / master_technician /
  // assistant only) — who may add or remove people from a job.
  const canManageJobPeople = useMemo(() => stagesGates.canManageJobPeople(authRole), [authRole])
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
  // v2.3600: keyed on the id set and held until the list has loaded — a scope merge or the
  // enrichment patch re-mints `jobs` without changing which jobs are on the board.
  const stagesUpcomingIdsKey = useMemo(() => [...new Set(jobs.map((j) => j.id))].sort().join(','), [jobs])
  useEffect(() => {
    if (jobsListLoading) return
    if (stagesUpcomingIdsKey === '') {
      setStagesUpcomingByJobId({})
      return
    }
    let cancelled = false
    void fetchStagesUpcomingScheduleForJobs(stagesUpcomingIdsKey.split(','), scheduleTodayDateKey()).then((m) => {
      if (!cancelled) setStagesUpcomingByJobId(m)
    })
    return () => {
      cancelled = true
    }
  }, [stagesUpcomingIdsKey, jobsListLoading])
  // v2.3785: the week so far — days worked (the strip's ✓ cells) and days booked before today (hollow when
  // nobody clocked) — same id key as the upcoming read, two small batched queries.
  const [stagesWorkedByJobId, setStagesWorkedByJobId] = useState<Record<string, StagesWeekSoFar>>({})
  useEffect(() => {
    if (jobsListLoading) return
    if (stagesUpcomingIdsKey === '') {
      setStagesWorkedByJobId({})
      return
    }
    const today = scheduleTodayDateKey()
    const from = stripWeekStartYmd(today) ?? today
    let cancelled = false
    void fetchStagesWeekSoFarForJobs(stagesUpcomingIdsKey.split(','), from, today).then((m) => {
      if (!cancelled) setStagesWorkedByJobId(m)
    })
    return () => {
      cancelled = true
    }
  }, [stagesUpcomingIdsKey, jobsListLoading])
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
  /** `?round=1&gc=<id>` (v2.2812): the round email's per-GC button opens the overlay ON that GC. */
  const [gcReviewRoundGcId, setGcReviewRoundGcId] = useState<string | null>(null)
  const [weeklyMovementModalOpen, setWeeklyMovementModalOpen] = useState(false)
  const [weeklyMoneyModalOpen, setWeeklyMoneyModalOpen] = useState(false)
  /** Week the Weekly money modal opens on when a deep link asked for one (Moneyfill's "See the week's report"); null = the modal's own default. */
  const [weeklyMoneyInitialMonday, setWeeklyMoneyInitialMonday] = useState<string | null>(null)
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
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string; consequence?: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [markPaidJob, setMarkPaidJob] = useState<JobWithDetails | null>(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceWithJob | null>(null)
  const [bankPaymentsModalOpen, setBankPaymentsModalOpen] = useState(false)
  /** ⚖ Legal desk (v2.3293): the office's pre-release review of every Collections account. `payerKey` = the account to open on. */
  const [legalDesk, setLegalDesk] = useState<{ payerKey: string | null; tab?: 'fees_steps' | null } | null>(null)
  // The stored side of the desk (PR 2): matters, the firm, the row chip's source. Office roles only.
  const legalMatters = useLegalMatters(stagesGates.isStagesOfficeRole(authRole))
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
  // The ⚖ Legal desk (v2.3293) reads Collections rows — billed-status jobs the
  // board loads lazily — so opening it fetches the non-paid scopes the same way.
  useEffect(() => {
    if (legalDesk == null) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [legalDesk, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
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
    /** The forecast's Send notice… door lands on the § 53.056 tab. */
    initialTab?: 'demand' | 'notice' | 'affidavit' | 'release_record'
    /** The Lien desk's months for the notice (v2.3405). */
    noticeMonths?: string[] | null
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
    stagesGates.isStagesOfficeRole(authRole)
  const [jobContractRows, setJobContractRows] = useState<JobContractRowLike[]>([])
  const [signedEstimateRows, setSignedEstimateRows] = useState<SignedEstimateLike[]>([])
  const loadJobContractCoverage = useCallback(async () => {
    if (!canSeeJobContracts) return
    try {
      const [contractsRes, estimatesRes] = await Promise.all([
        supabase
          .from('job_contracts')
          .select('id, job_id, status, revision, recipient_email, sent_at, last_sent_at, view_count, signed_at, signer_printed_name, signer_mode, voided_at, signed_document_url')
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
  // Contract coverage card (v2.2738): company-wide counts per stage — the
  // board loads Billed/Collections lazily, so the card never reads off loaded rows.
  const { nudge: contractNudge } = useJobContractsNudge(canSeeJobContracts)
  // v2.3419: where the crew is, per row (clock-ins, sub sheets, reports) — the Progress & payment cell reads it.
  const crewJobIds = useMemo(() => jobs.map((j) => j.id), [jobs])
  // Held until the list has loaded (v2.3569): the ids grow as scopes merge, and each growth re-ran the RPC.
  const { crewByJobId } = useJobCrewPositions(crewJobIds, active && !!authUser?.id && !jobsListLoading)
  const pipelineContractCoverage = useMemo(
    () =>
      contractNudge
        ? {
            missingCount: contractNudge.missing.count,
            missingRevenue: contractNudge.missing.revenueTotal,
            liveTotal: contractNudge.liveTotal,
            byStage: contractNudge.byStage,
            underFloor: contractNudge.underFloor,
            notNeeded: contractNudge.notNeeded,
            floorCents: contractNudge.floorCents,
          }
        : null,
    [contractNudge],
  )
  /** The contract floor (PR 0) the board, the filter and the sweep all read — 0 until the nudge loads. */
  const contractFloorCents = contractNudge?.floorCents ?? 0
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
      if (isContractGap(jobContractCoverageByJobId.get(j.id), j.revenue, contractFloorCents)) n++
    }
    return n
  }, [canSeeJobContracts, jobs, jobContractCoverageByJobId, contractFloorCents])
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
  const canCreateHazmatFee = stagesGates.canCreateHazmatFee(authRole)
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
  const canOpenSessionNotes = stagesGates.canUseStagesOfficeTools(authRole, myRole)
  const openSessionNotes = useCallback(
    (job?: SessionNotesJobIdentity | null) => setSessionNotesModal({ job: job ?? null }),
    [],
  )
  const canSeeBilledExpectedPay = stagesGates.canSeeBilledExpectedPay(authRole)
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
    stagesGates.isStagesOfficeRole(authRole)
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
  // Their Word PR 3: the per-customer promise record (keeps N of M · usual
  // slip) behind the reliability line and the forecast's slip adjustment.
  // Office roles only — primary sees the pay-speed spread, not the record.
  // Fail-soft like the rest: a not-yet-pushed RPC just leaves it off.
  const [promiseRecordsByCustomer, setPromiseRecordsByCustomer] = useState<Map<string, CustomerPromiseRecord> | null>(null)
  const loadPromiseRecords = useCallback(async () => {
    if (!canMarkPromisedPay) return
    try {
      const { data } = await supabase.rpc('list_payment_promise_records' as never)
      const records = parsePromiseRecordsRpc(data as unknown)
      if (!records) return
      const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_CALENDAR_TZ })
      setPromiseRecordsByCustomer(buildCustomerPromiseRecords(classifyPromises(records, today)))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canMarkPromisedPay])
  useEffect(() => {
    void loadPromiseRecords()
  }, [loadPromiseRecords])
  const promiseSlipByCustomer = useMemo(() => {
    if (!promiseRecordsByCustomer) return null
    const out: Record<string, number> = {}
    for (const [id, rec] of promiseRecordsByCustomer) if (rec.usualSlipDays != null && rec.usualSlipDays >= 1) out[id] = rec.usualSlipDays
    return out
  }, [promiseRecordsByCustomer])
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
      // B6 / J4-10: a Collections shell has a clock the office set — the flag
      // day — so it ages from there instead of wearing "can't age" forever.
      const collectionsRef = shell ? stageRowBilledAgeReference(row) : null
      const collectionsDays = collectionsRef?.source === 'collections' ? stageRowBilledAgeDays(row) : null
      return (
        <>
          {shell && collectionsRef?.source === 'collections' ? (
            <span
              title={`Flagged difficult to collect ${collectionsRef.ymd}. Nothing is on a bill line, so the clock runs from the flag — Bill Customer or Edit Job creates the line`}
              style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
            >
              {collectionsDays == null ? 'In Collections' : `In Collections ${collectionsDays} day${collectionsDays === 1 ? '' : 's'}`} · no bill line
            </span>
          ) : shell ? (
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
              title="Record the payment date the customer named, who said it and how — it overrides the estimate, and every date they name stays on record"
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
            >
              {promise ? 'They said… (new date)' : 'They said…'}
            </button>
          ) : null}
          {!shell ? (
            <BilledReliabilityLine
              line={buildReliabilityLine(
                row.job.customer_id ? billedPaySpeeds?.receipts[row.job.customer_id] : null,
                canMarkPromisedPay ? promiseRecordsByCustomer?.get(stageRowPayerCustomerId(row) ?? '') ?? null : null,
              )}
            />
          ) : null}
        </>
      )
    },
    [billedPaySpeeds, promisedPayDates, canMarkPromisedPay, promiseRecordsByCustomer],
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
  /** ⋯ tools menu "Mobile cards" (v2.1241): render sections as full-width cards instead of tables.
   *  Width-gated default (v2.2877): with nothing stored, phones narrower than 560px start on cards. */
  const [stagesMobileCards, setStagesMobileCards] = useState(() => {
    try {
      const stored = localStorage.getItem('jobs-stages-mobile-cards')
      if (stored === 'true' || stored === 'false') return stored === 'true'
      return typeof window !== 'undefined' && window.matchMedia('(max-width: 559px)').matches
    } catch {
      return false
    }
  })
  // T5-08 (X16): with nothing stored on this device, the org / role default decides once it loads
  // ('auto' keeps the width gate). A device that chose for itself is never overridden.
  const mobileCardsOrgDefault = useOrgDefault('jobs.stages.mobile_cards', authRole, readDeviceString('jobs-stages-mobile-cards'))
  useEffect(() => {
    if (!mobileCardsOrgDefault.loaded || mobileCardsOrgDefault.source === 'device' || mobileCardsOrgDefault.source === 'fallback') return
    const b = orgDefaultBool(mobileCardsOrgDefault.value)
    if (b !== null) setStagesMobileCards(b)
  }, [mobileCardsOrgDefault.loaded, mobileCardsOrgDefault.source, mobileCardsOrgDefault.value])
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
  /** Job Follow-Up Mode deck (v2.1718). */
  const [followupOpen, setFollowupOpen] = useState(false)
  // Bumped when the deck closes so the button badge recounts (v2.2307).
  const [followupCountRefresh, setFollowupCountRefresh] = useState(0)
  const followupQueueCount = useJobFollowupQueueCount(followupCountRefresh)
  // The phone board (punch list #30, PR 2a): at phone width with Mobile cards on, the board is
  // one stage at a time under sticky stage chips, two-line rows from `jobNextLine`, and the
  // map / money / opportunities folded at the bottom. The desktop and the tables are untouched.
  const phoneBoard = isMobile && stagesMobileCards
  const [phoneRowFilter, setPhoneRowFilter] = useState<PhoneRowFilter>('all')
  const [phoneOverviewOpen, setPhoneOverviewOpen] = useState<boolean>(() => readDeviceString(STAGES_PHONE_OVERVIEW_KEY) === 'true')
  const followupQuietByJobId = useJobFollowupQuietDays(phoneBoard, followupCountRefresh)
  // One stage at a time: the first open section is the stage; picking one closes the rest, so
  // the section prefs and the fetch-on-expand effect carry the phone board unchanged.
  const phoneActiveStage: PhoneStageKey = PHONE_STAGE_ORDER.find((k) => stagesSectionOpen[k]) ?? 'working'
  const pickPhoneStage = useCallback((key: PhoneStageKey) => {
    setStagesSectionOpen((prev) => ({ ...prev, waiting: false, working: false, readyToBill: false, billed: false, collections: false, [key]: true }))
  }, [])
  useEffect(() => {
    if (!phoneBoard) return
    if (!PHONE_STAGE_ORDER.some((k) => stagesSectionOpen[k])) pickPhoneStage('working')
  }, [phoneBoard, stagesSectionOpen, pickPhoneStage])
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
  /** `?gcnotice=<customer id>` deep link (v2.3470): Bids → Customer review's Put on notice… lands here. */
  const gcNoticeParamConsumedRef = useRef(false)
  useEffect(() => {
    if (gcNoticeParamConsumedRef.current) return
    const id = searchParams.get('gcnotice')
    if (id) {
      gcNoticeParamConsumedRef.current = true
      setGcNotice({ gcId: id })
      const p = new URLSearchParams(searchParams)
      p.delete('gcnotice')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])
  /** `?liendesk=1` (+ `liendeskJob=<id>`) deep link (v2.3405): the Dashboard's Needs you cards open the Lien desk directly. */
  const lienDeskParamConsumedRef = useRef(false)
  useEffect(() => {
    if (lienDeskParamConsumedRef.current) return
    if (searchParams.get('liendesk') === '1') {
      lienDeskParamConsumedRef.current = true
      setLienDesk({ jobId: searchParams.get('liendeskJob'), kind: searchParams.get('kind') === 'affidavit' ? 'affidavit' : searchParams.get('kind') === 'timeline' ? 'timeline' : 'notice', pile: searchParams.get('liendeskPile') === 'missed' ? 'missed' : null })
      const p = new URLSearchParams(searchParams)
      p.delete('liendesk')
      p.delete('liendeskJob')
      p.delete('liendeskPile')
      p.delete('kind')
      navigate({ search: p.toString() }, { replace: true })
    }
  }, [searchParams, navigate])
  /** `?round=1` deep link (v2.2771): the Dashboard Needs You row + the round email open GC Review straight into the round overlay. */
  const roundParamConsumedRef = useRef(false)
  useEffect(() => {
    if (roundParamConsumedRef.current) return
    if (searchParams.get('round') === '1') {
      roundParamConsumedRef.current = true
      setGcReviewStartRound(true)
      setGcReviewRoundGcId(searchParams.get('gc') || null)
      setGcReviewModalOpen(true)
      const p = new URLSearchParams(searchParams)
      p.delete('round')
      p.delete('gc')
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
  // Jobs on a map (v2.3398): the board fetches a section's rows only while that section is open,
  // so with the sections folded the map drew one pin. The card flags that it is showing; the
  // effect asks for every live section's scope and re-asks as the snapshot / merged set changes —
  // `fetchScopeIfNeeded` silently no-ops until the initial board load has landed, so a one-shot
  // call from the card's mount was lost.
  const [mapWantsLiveRows, setMapWantsLiveRows] = useState(false)
  const requestLiveRowsForMap = useCallback(() => setMapWantsLiveRows(true), [])
  useEffect(() => {
    if (!active || !mapWantsLiveRows || jobsListLoading) return
    for (const section of ['waiting', 'working', 'readyToBill', 'billed', 'collections'] as const) {
      void cacheFetchScopeIfNeeded(scopeForStagesSection(section), customerFilterForFetch)
    }
  }, [active, mapWantsLiveRows, jobsListLoading, jobsListDataKey, cacheMergedScopes, customerFilterForFetch, cacheFetchScopeIfNeeded])
  // Row sort mode (v2.1807): classic newest-number-first, or by time added.
  // Lives in the ⋯ Pipeline tools menu; per-device persistence.
  const [stagesSortMode, setStagesSortModeState] = useState<StagesBoardSortMode>(() => loadStagesSortMode())
  const setStagesSortMode = useCallback((mode: StagesBoardSortMode) => {
    setStagesSortModeState(mode)
    saveStagesSortMode(mode)
  }, [])
  // The "Progress & payment" header click (v2.3408): % complete 0 → 100, or back
  // to job-number order. Session-only — saveStagesSortMode never stores it.
  const onToggleProgressSort = useCallback(() => {
    setStagesSortModeState((prev) => {
      const next = toggleStagesProgressSort(prev)
      saveStagesSortMode(next)
      return next
    })
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
          contractFloorCents,
        ),
        stagesSearchQuery,
        stagesCombinedExtraJobIds,
        stagesSortMode,
        // v2.3788: the next-first order reads the same upcoming map the strip draws.
        stagesSortMode === 'next' ? makeStagesNextFirstComparator(stagesUpcomingByJobId, sortStagesJobsByEffectiveNumberDesc) : null,
      ),
    [jobs, stagesExcludeFilters, stagesGcFilter, stagesDevelopmentFilter, stagesAccountManFilter, jobContractCoverageByJobId, stagesContractFilter, contractFloorCents, stagesSearchQuery, stagesCombinedExtraJobIds, stagesSortMode, stagesUpcomingByJobId],
  )
  // v2.3788: the Working header's schedule pills — All / Not scheduled / This week / Later,
  // counted from the strip's own "when" state; the pick filters the Working rows only.
  const [stagesWhenPill, setStagesWhenPill] = useState<StagesWhenPill>('all')
  const workingWhen = useMemo(
    () => stagesWhenForJobs(stagesBoardLists.working, stagesUpcomingByJobId, scheduleTodayDateKey()),
    [stagesBoardLists.working, stagesUpcomingByJobId],
  )
  const workingWhenCounts = useMemo(() => countStagesWhenPills(stagesBoardLists.working, workingWhen), [stagesBoardLists.working, workingWhen])
  const workingShown = useMemo(
    () => filterJobsByStagesWhenPill(stagesBoardLists.working, stagesWhenPill, workingWhen),
    [stagesBoardLists.working, stagesWhenPill, workingWhen],
  )

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
  // Capable of Being Billed reads each Working job's stage plan (stage-plan
  // residuals item 1): the windows / orders / sheets for every Working job
  // (the unfiltered list, so a search never refetches) land in one paged read;
  // a job with Order stages reads its plan's `billable()`, the rest keep the
  // % complete formula — and so does every job until the read lands.
  const workingScopeLoaded = cacheMergedScopes.has(scopeForStagesSection('working'))
  const workingStagePlanJobIds = useMemo(() => unfilteredBoardLists.working.map((j) => j.id), [unfilteredBoardLists])
  const workingStageInputs = useWorkingStagePlanInputs(workingStagePlanJobIds, workingScopeLoaded)
  // Capable of Being Billed dollars, shared by the Working section header and
  // the jump-bar Section tools menu. Falls back to the lean header stats while
  // the Working scope hasn't loaded — the live list is empty then, which used
  // to make the menu say $0 while the collapsed section's header knew better.
  const capableDisplay = workingScopeLoaded
    ? formatCurrencyNoCents(capableToBillTotalWithPlans(stagesBoardLists.working, workingStageInputs))
    : cacheHeaderStats
      ? formatCurrencyNoCents(cacheHeaderStats.capableToBill)
      : '…'
  // Work months under the forecast's rows (the lien clock's evidence): one
  // clock-sessions fetch for the open-bill jobs, only while the modal is open.
  const forecastWorkMonthJobs = useMemo(() => {
    if (!billedPaymentForecastOpen) return null
    const seen = new Map<string, { id: string; gc_customer_id: string | null; customer_address_id: string | null }>()
    for (const r of unfilteredBoardLists.billedActiveRows) {
      if (r.kind === 'job' || seen.has(r.job.id)) continue
      seen.set(r.job.id, { id: r.job.id, gc_customer_id: r.job.gc_customer_id ?? null, customer_address_id: r.job.customer_address_id ?? null })
    }
    return [...seen.values()]
  }, [billedPaymentForecastOpen, unfilteredBoardLists])
  const forecastTodayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const { byJob: forecastWorkMonths } = useForecastWorkMonths(forecastWorkMonthJobs, forecastTodayYmd)
  // The Lien desk (v2.3405): § 53.056 notices due per unpaid work month on sub
  // jobs. A light read keeps the menus' counts; the full read runs while open.
  const [lienDesk, setLienDesk] = useState<{ jobId: string | null; kind?: 'notice' | 'affidavit' | 'timeline'; pile?: 'missed' | null } | null>(null)
  const lienDeskEligible = stagesGates.isStagesOfficeRole(authRole)
  /** Put a GC on notice (v2.3470): every owner on every job with a failing GC, one approved run. */
  const [gcNotice, setGcNotice] = useState<{ gcId: string } | null>(null)
  const { data: lienDeskData, loading: lienDeskLoading, refetch: refetchLienDesk } = useLienDeskData(lienDeskEligible, forecastTodayYmd, { light: lienDesk == null })
  const lienDeskCount = lienDeskData ? lienDeskData.summary.office.jobs + lienDeskData.summary.leader.jobs + lienDeskData.summary.office.ready : null
  // Collections' note line (v2.3684): the account's note, then — on a job whose lien claim was set by hand under the balance — the unsecured part, named.
  const collectionsNoteLine = useCallback(
    (j: JobWithDetails): string | null => {
      const c = lienDeskData?.claimCorrectionsByJob[j.id] ?? null
      const gap = c ? collectionsClaimGapWords(Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), c) : ''
      return [j.collections_note?.trim(), gap].filter(Boolean).join(' · ') || null
    },
    [lienDeskData],
  )
  const lienDeskJobs = useMemo(
    () => (lienDesk && lienDeskData ? Object.values(lienDeskData.jobsById).map((j) => ({ id: j.id, gc_customer_id: j.gc_customer_id, customer_address_id: j.customer_address_id })) : null),
    [lienDesk, lienDeskData],
  )
  const { byJob: lienDeskWorkMonths } = useForecastWorkMonths(lienDeskJobs, forecastTodayYmd)
  const [lienDeskIssuerGen, setLienDeskIssuerGen] = useState(0)
  const lienDeskIssuer = useMemo(() => (lienDesk || gcNotice ? getPhysicalInvoiceIssuerDraft() : null), [lienDesk, gcNotice, lienDeskIssuerGen])
  useEffect(() => {
    if (!lienDesk && !gcNotice) return
    let cancelled = false
    void (async () => {
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole })
      if (!cancelled) setLienDeskIssuerGen((g) => g + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [lienDesk, gcNotice, authRole])
  const lienDeskSignerFor = useCallback((masterUserId: string | null) => lienSignerNameFor(users, masterUserId, authProfileName?.trim() ?? ''), [users, authProfileName])
  // The signer's own phone on the cover letters (v2.3753, counsel: the master is the callback); the letterhead's when he has none.
  const lienDeskSignerPhoneFor = useCallback((masterUserId: string | null) => lienSignerPhoneFor(users, masterUserId, lienDeskIssuer?.phone ?? ''), [users, lienDeskIssuer?.phone])

  /** Personal statement rounds (v2.2072): data for the two-stage money-opportunity cards. */
  const isRoundOfficeRole = stagesGates.isStagesOfficeRole(authRole)
  const roundWeekStart = gcReviewWeekStartYmd()
  const [roundCertRows, setRoundCertRows] = useState<GcReviewCertRow[]>([])
  const [roundMarks, setRoundMarks] = useState<RoundMarkRow[]>([])
  /** Six weeks of marks for the GC temperature map (v2.2813) — the chase queue sorts cold GCs first. */
  const [roundTempMarks, setRoundTempMarks] = useState<RoundMarkRow[]>([])
  const gcTemperatureById = useMemo(() => latestTemperatureByGc(roundTempMarks), [roundTempMarks])
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
    void listGcStatementRoundMarksSince(trailingWeekStarts(roundWeekStart, 6)[0] ?? roundWeekStart).then(
      (r) => {
        if (!cancelled) setRoundTempMarks(r)
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
  const roundGcIdsKey = useMemo(() => [...new Set(roundGcIds)].sort().join(','), [roundGcIds])
  useEffect(() => {
    if (!isRoundOfficeRole || roundGcIdsKey === '') return
    let cancelled = false
    void listGcStatementSenders(roundGcIdsKey.split(',')).then((m) => {
      if (!cancelled) setRoundSenders(m)
    })
    return () => {
      cancelled = true
    }
  }, [isRoundOfficeRole, roundGcIdsKey, gcReviewModalOpen])
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
      buildPaymentChaseQueue(cacheLeanBilledRows, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd, gcTemperatureById),
    )
  }, [canMarkPromisedPay, cacheLeanBilledRows, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd, gcTemperatureById])
  const nonPaidScopesMerged = NON_PAID_SCOPES.every((s) => cacheMergedScopes.has(s))
  const chaseFullQueue = useMemo(() => {
    if (!chaseModalOpen || !nonPaidScopesMerged) return null
    return buildPaymentChaseQueue(
      unfilteredBoardLists.billedActiveRows,
      billedPaySpeeds,
      promisedPayDates,
      chaseTouches,
      chaseTodayYmd,
      gcTemperatureById,
    )
  }, [chaseModalOpen, nonPaidScopesMerged, unfilteredBoardLists, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd, gcTemperatureById])

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
    const elId = stagesSectionElementId(key)
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
      const el = document.getElementById(stagesSectionElementId('readyToBill'))
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

  const accountsReceivableButtonAccessibleName = useMemo(
    () =>
      accountsReceivableButtonName({
        canRecordPayments: stagesGates.canRecordArPayments(authRole),
        unallocatedCount: arBankTxUnallocatedCount,
        billedRowCount: bankPaymentsModalBilledRows.length,
      }),
    [authRole, bankPaymentsModalBilledRows.length, arBankTxUnallocatedCount],
  )

  const billedAgingBuckets = useMemo(
    () =>
      cacheMergedScopes.has('billed_all')
        ? buildBilledAgingBuckets(stagesFilteredJobs)
        : (cacheHeaderStats?.billedAging ?? { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 }),
    [stagesFilteredJobs, cacheMergedScopes, cacheHeaderStats],
  )

  /** Debounce: stagesFilteredJobs changes every Stages search keystroke; avoids overlapping multi-chunk RPC bursts. */
  const THREAD_STATS_STAGES_DEBOUNCE_MS = 320
  // Keyed on the sorted id string, not the array identity, and held until the list has loaded
  // (v2.3569): the same rows re-merged as scopes landed used to re-run the stats RPC per merge.
  const threadStatsJobIdsKey = useMemo(() => [...new Set(stagesFilteredJobs.map((j) => j.id))].sort().join(','), [stagesFilteredJobs])
  useEffect(() => {
    if (!authUser?.id || !active || jobsListLoading) return
    const ids = threadStatsJobIdsKey ? threadStatsJobIdsKey.split(',') : []
    const t = window.setTimeout(() => {
      void refreshJobThreadStatsForJobIds(ids)
    }, THREAD_STATS_STAGES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [authUser?.id, active, jobsListLoading, threadStatsJobIdsKey, refreshJobThreadStatsForJobIds])

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

  function toggleStagesFollowMoves() {
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
    stagesEditMode && stagesGates.canSeeStagesPowerToggles(authRole, myRole)

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
    const plan = planPartialInvoice(createPartialInvoiceJob, createPartialInvoiceAmount)
    if (plan.kind === 'invalid' || plan.kind === 'nothing_left') {
      setError(plan.error)
      return
    }
    if (plan.adjustedFrom != null) {
      showToast(`Adjusted to remaining unallocated ($${formatCurrency(plan.amountDollars)})`, 'info')
      setCreatePartialInvoiceAmount(String(plan.amountDollars))
    }
    if (plan.kind === 'bill_customer') {
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
      const { error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: createPartialInvoiceJob.id,
          amount: plan.amountDollars,
          status: 'ready_to_bill',
          sequence_order: plan.nextSequenceOrder,
          estimated_bill_date: null,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      // Invoice already written — fully-allocated envelopes from the resync
      // are success; only a real failure is surfaced (after the board reload).
      let ensureFailure: string | null = null
      if (plan.ensureRemainder) {
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
  /** The dialog's on-blur re-clamp (page-global `error` clears with it — map quirk 4). */
  const reclampPartialInvoiceAmount = () => {
    if (!createPartialInvoiceJob) return
    const next = reclampedPartialInvoiceInput(createPartialInvoiceJob, createPartialInvoiceAmount)
    if (next != null) {
      setCreatePartialInvoiceAmount(next)
      setError(null)
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
      openLegalDesk: (payerKey, tab) => setLegalDesk({ payerKey: payerKey ?? null, tab: tab ?? null }),
      openLienDesk: (jobId) => setLienDesk({ jobId: jobId ?? null }),
      openWeeklyMovement: () => setWeeklyMovementModalOpen(true),
      openWeeklyMoney: (weekMonday) => {
        setWeeklyMoneyInitialMonday(weekMonday ?? null)
        setWeeklyMoneyModalOpen(true)
      },
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
  /**
   * The props every section table shares (the prop-bundle seam, v2.3538): built once here,
   * spread into the six section call sites and the follow-ups deck's rows. Per-section props
   * (rows, action labels, section flags) stay at each call site and win over the spread.
   */
  const stagesTableShared = {
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
    crewByJobId,
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
    stagesWorkedByJobId,
    setScheduleModalJob,
    openQuickAssignForJob,
    authRole,
    loadJobs,
    onDevelopmentFilter: setStagesDevelopmentFilter,
    jobContractCoverageByJobId: canSeeJobContracts ? jobContractCoverageByJobId : undefined,
    onOpenJobContract: openJobContract,
    legalMatterByJobId: legalMatters.byJobId,
    }
  /** The phone rows' kernel input for a job, from the same side maps the cards read. */
  const phoneTodayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const phoneNextInput = (job: JobWithDetails, row: StageRow | null, stage: JobNextStage): JobNextLineInput => {
    const crew = crewByJobId.get(job.id) ?? null
    const { model, view } = progressPaymentForJob(job, crew)
    const inv = row && row.kind !== 'job' ? row.inv : null
    const expectedPay =
      (stage === 'billed' || stage === 'collections') && inv
        ? billedExpectedPayModel(
            { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: job.customer_id },
            billedPaySpeeds,
            phoneTodayYmd,
            promisedPayDates?.[job.id] ?? null,
          )
        : null
    const bDetail = deriveStagesBillingActivityDetail(job)
    return {
      stage,
      view,
      money: model,
      billSentAlert: stagesBillSentPctAlert(job),
      quietDays: followupQuietByJobId.get(job.id) ?? null,
      expectedPay,
      contract: canSeeJobContracts ? (jobContractCoverageByJobId.get(job.id) ?? null) : undefined,
      upcoming: stagesUpcomingByJobId[job.id] ?? null,
      crew,
      billDisplay: bDetail ? formatEstimatedCompletionDisplay(bDetail.ymd) : null,
      createdAt: job.created_at ?? null,
      todayYmd: phoneTodayYmd,
    }
  }
  const phoneRowsFor = (stage: JobNextStage): StagesPhoneRowsMode | undefined => {
    if (!phoneBoard) return undefined
    return {
      filter: phoneRowFilter,
      nextLineFor: (job, row) => jobNextLine(phoneNextInput(job, row, stage)),
      // Waiting → Working has no window of its own; every other move opens the one the desktop uses.
      advanceConfirm: stage === 'waiting' ? 'sheet' : 'own',
      advanceConsequence: (job, row) => {
        const i = phoneNextInput(job, row, stage)
        return advanceConsequence(stage, { money: i.money, contract: i.contract, upcoming: i.upcoming })
      },
      onChip: (job, chip) => {
        if (chip.action === 'no-bid') openEdit(job, { fixturesSectionHighlight: true })
        else if (chip.action === 'contract' && openJobContract) openJobContract(job)
        else openStagesDetailJobModal(job)
      },
    }
  }
  /** The unified (job + invoice row) tables' extras on top of `stagesTableShared`. */
  const stagesUnifiedTableShared = {
    ...stagesTableShared,
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
          {...stagesTableShared}
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
          {...stagesTableShared}
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
          {...stagesUnifiedTableShared}
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
          jobNoteLine={collectionsNoteLine}
          {...stagesUnifiedTableShared}
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
          onJobMoveToCollections={stagesGates.canManageCollections(authRole)
            ? (j) => {
                setCollectionsNoteDraft('')
                setCollectionsConfirm({ job: j, direction: 'to' })
              }
            : undefined}
          {...stagesUnifiedTableShared}
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

  /** One object for the command bar's applied-filter chips and the ⋯ menu's selects (v2.3533). */
  const stagesToolsFilters: StagesToolsFilters = {
    sortMode: stagesSortMode,
    contract: stagesContractFilter,
    gc: stagesGcFilter,
    gcOptions: stagesGcFilterOptions,
    development: stagesDevelopmentFilter,
    developmentOptions: stagesDevelopmentFilterOptions,
    accountMan: stagesAccountManFilter,
    accountManOptions: stagesAccountManFilterOptions,
    exclusionCount: stagesExclusionCount,
  }
  /** The # jump chip: the loaded board first, then the lean lookup across every job (any status); the chip shows its checking state meanwhile. */
  const jumpToTypedNumber = (digits: string) => {
    const matches = findJobsByNumber(jobs, digits)
    if (matches.length > 0) return jumpToNumberMatches(matches, digits)
    return jumpViaLeanLookup(digits)
  }

  // The three small confirms' handlers (v2.3535): the dialogs moved to their own files; what
  // they write — stage moves, the Collections flag, the follow-moves focus — stays here.
  const closeReadyForBilling = () => {
    setReadyForBillingJob(null)
    setReadyForBillingChecked1(false)
    setReadyForBillingChecked2(false)
  }
  const confirmReadyForBilling = async () => {
    if (!readyForBillingJob) return
    nudgeMissingBillingEmail(readyForBillingJob.id)
    const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id)
    if (!ok) return
    closeReadyForBilling()
  }
  const confirmSendBackSimple = async () => {
    if (!sendBackConfirmJob) return
    const ok = await updateJobStatus(sendBackConfirmJob.id, sendBackConfirmJob.toStatus)
    if (!ok) return
    setSendBackConfirmJob(null)
  }
  const closeCollectionsConfirm = () => {
    setCollectionsConfirm(null)
    setCollectionsNoteDraft('')
  }
  const confirmCollectionsMove = async () => {
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
  }

  // The two send-back dialogs' handlers (v2.3536): the dialogs moved to their own files; the
  // writes, the re-entry lock and the Stripe void prep stay here. `sendBackChecked` is shared
  // by both dialogs (map quirk 12) and reset by every close.
  const closeSendBackInvoice = () => {
    setSendBackInvoice(null)
    setSendBackChecked(false)
    setSendBackInvoiceStripeExplainerAfterFailure(false)
  }
  const confirmSendBackInvoice = () => {
    void (async () => {
      if (!sendBackChecked || !sendBackInvoice) return
      if (stagesInvoiceSendBackConfirmLockRef.current) return
      stagesInvoiceSendBackConfirmLockRef.current = true
      const { inv, action } = sendBackInvoice
      try {
        if (action === 'delete') {
          closeSendBackInvoice()
          await deleteInvoice(inv.id)
        } else {
          const ok = await revertBilledInvoiceToReadyToBill(inv)
          if (ok) {
            closeSendBackInvoice()
          } else if (invoiceNeedsStripeVoidForRevert(inv)) {
            setSendBackInvoiceStripeExplainerAfterFailure(true)
          }
        }
      } finally {
        stagesInvoiceSendBackConfirmLockRef.current = false
      }
    })()
  }
  const closeSendBackJob = () => {
    setSendBackJob(null)
    setSendBackChecked(false)
    setSendBackReason('')
  }
  const confirmSendBackJob = async () => {
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
    closeSendBackJob()
  }

  /** The ☰ section-tools menu's doors (v2.3549): the menu closes itself, then calls the one picked. */
    const sectionToolsOnSelect: Record<StagesSectionToolKey, () => void> = {
      'recently-added': () => setStagesRecentViewOpen((o) => !o),
      'weekly-movement': () => setWeeklyMovementModalOpen(true),
      'weekly-money': () => {
        setWeeklyMoneyInitialMonday(null)
        setWeeklyMoneyModalOpen(true)
      },
      'capable-to-bill': () => setCapableToBillModalOpen(true),
      'ready-to-bill-notifications': () => setReadyToBillNotifySettingsOpen(true),
      'gc-review': () => setGcReviewModalOpen(true),
      'accounts-receivable': () => setBankPaymentsModalOpen(true),
      'billed-share-print': () => setBilledShareModalOpen(true),
      'billed-aging-chart': () => setBilledAgingChartOpen(true),
      'billed-payment-forecast': () => setBilledPaymentForecastOpen(true),
      'lien-desk': () => setLienDesk({ jobId: null }),
      'paid-notifications': () => setPaymentEmailSettingsOpen(true),
      'paid-profit-chart': () => setPaidProfitChartOpen(true),
      'paid-in-full-notifications': () => setPaidEmailSettingsOpen(true),
    }

  return (
    <StagesSearchHighlightProvider query={stagesSearchQuery.trim() || null}>
    <StagesCrewModalContext.Provider value={setCrewModalJob}>
    <SessionNotesOpenerContext.Provider value={canOpenSessionNotes ? openSessionNotes : null}>
      {active && (
        <div
          data-board-snapshot={jobsListSnapshotAt != null ? '' : undefined}
          className={phoneBoard ? `stagesPhoneBoard${stagesSearchQuery.trim() ? ' stagesPhoneSearch' : ''}` : undefined}
          style={phoneBoard ? { display: 'flex', flexDirection: 'column' } : undefined}
        >
          {(error || jobsListError) && (
            <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error || jobsListError}</p>
          )}
          <JobsStagesCommandBar
            onNewJob={openNew}
            shortNewJobButtonLabel={shortNewJobButtonLabel}
            followupQueueCount={followupQueueCount}
            onOpenFollowups={() => setFollowupOpen(true)}
            canSeeForecast={canSeeBilledExpectedPay}
            onOpenForecast={() => setBilledPaymentForecastOpen(true)}
            query={stagesSearchQuery}
            onQueryChange={setStagesSearchQuery}
            includeScheduleTimeInSearch={stagesIncludeScheduleTimeInSearch}
            scheduleSessionSearchBusy={stagesScheduleSessionSearchBusy}
            serverSearchBusy={stagesServerSearchBusy}
            onOpenSessionNotes={canOpenSessionNotes ? () => openSessionNotes(null) : null}
            onJumpToNumber={jumpToTypedNumber}
            filters={stagesToolsFilters}
            onClearSort={() => setStagesSortMode('number')}
            onClearContract={() => setStagesContractFilter('')}
            onClearGc={() => setStagesGcFilter('')}
            onClearDevelopment={() => setStagesDevelopmentFilter('')}
            onClearAccountMan={() => setStagesAccountManFilter('')}
            onOpenHideGroups={() => setStagesHideGroupsModalOpen(true)}
            toolsMenu={
                    <JobsStagesToolsMenu
                      open={stagesToolsMenuOpen}
                      onOpenChange={setStagesToolsMenuOpen}
                      filters={stagesToolsFilters}
                      onSortModeChange={setStagesSortMode}
                      onContractFilterChange={setStagesContractFilter}
                      onGcFilterChange={setStagesGcFilter}
                      onDevelopmentFilterChange={setStagesDevelopmentFilter}
                      onAccountManFilterChange={setStagesAccountManFilter}
                      gates={{
                        lienDesk: lienDeskEligible,
                        jobContracts: canSeeJobContracts,
                        officeTools: stagesGates.canUseStagesOfficeTools(authRole, myRole),
                        powerToggles: stagesGates.canSeeStagesPowerToggles(authRole, myRole),
                      }}
                      lienDeskCount={lienDeskCount}
                      contractSweepCount={contractSweepCount}
                      onOpenLienDesk={() => setLienDesk({ jobId: null })}
                      onPutGcOnNotice={(gcId) => setGcNotice({ gcId })}
                      onOpenContractSweep={() => setContractSweepOpen(true)}
                      onOpenHideGroups={() => setStagesHideGroupsModalOpen(true)}
                      onOpenJobBook={() => setJobBookModalOpen(true)}
                      onOpenTotalByName={() => setBilledTotalByNameModalOpen(true)}
                      onOpenCombineSeparate={() => setCombineSeparateModalOpen(true)}
                      toggles={{
                        includeScheduleTimeInSearch: stagesIncludeScheduleTimeInSearch,
                        followMoves: stagesFollowMoves,
                        hamMode: stagesHamMode,
                        editMode: stagesEditMode,
                        mobileCards: stagesMobileCards,
                      }}
                      onToggleIncludeScheduleTimeInSearch={toggleStagesIncludeScheduleTimeInSearch}
                      onToggleFollowMoves={toggleStagesFollowMoves}
                      onToggleHamMode={toggleStagesHamMode}
                      onToggleEditMode={toggleStagesEditMode}
                      onToggleMobileCards={toggleStagesMobileCards}
                    />
            }
          />
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
          {/* Jobs on a map (v2.3396): the Bid Board's map card on the Pipeline — a
              second view of the filtered rows, never a filter on them. Pins follow
              the search and every filter; a pin click lands on the row through the
              # jump's own path; the Paid chip asks the paid scope to load. */}
          {/* Phone board: the map, the money tiles and Today's Money Opportunities fold into one
              Overview at the bottom (`order: 99` in the column), closed by default, remembered per device. */}
          <div style={phoneBoard ? { order: 99, marginTop: '1rem' } : undefined}>
            {phoneBoard ? (
              <button
                type="button"
                aria-expanded={phoneOverviewOpen}
                onClick={() => {
                  const next = !phoneOverviewOpen
                  setPhoneOverviewOpen(next)
                  writeDeviceString(STAGES_PHONE_OVERVIEW_KEY, String(next))
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  marginBottom: phoneOverviewOpen ? '0.75rem' : 0,
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>Overview · map · money tiles · today's opportunities</span>
                <span style={{ fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{phoneOverviewOpen ? 'Hide ▴' : 'Show ▾'}</span>
              </button>
            ) : null}
            {!phoneBoard || phoneOverviewOpen ? (
              <>
          <JobsMapCard
            jobs={stagesBoardLists.filtered}
            isMobile={isMobile}
            loading={jobsListLoading}
            paidLoaded={cacheMergedScopes.has(scopeForStagesSection('paid'))}
            onLoadPaid={() => void cacheFetchScopeIfNeeded(scopeForStagesSection('paid'), customerFilterForFetch)}
            onNeedLiveRows={requestLiveRowsForMap}
            onOpenJob={(jobId) => jobDetailModal?.openJobDetail({ jobId })}
            onEditJob={(jobId) => tryOpenEditJob(jobId)}
            onFocusJob={(jobId, numberLabel) => {
              // The loaded row lands directly; a row the board hasn't loaded (a rewound paid job)
              // goes through the # jump's lean lookup, which fetches and merges it.
              const hit = jobs.find((j) => j.id === jobId)
              if (hit) {
                jumpToNumberMatches([hit], numberLabel)
                return
              }
              if (numberLabel && numberLabel !== '—') void jumpViaLeanLookup(numberLabel)
            }}
          />
          {/* The Pipeline money story + Today's Money Opportunities (v2.1915,
              Old/New pills retired v2.2012 — this is the only view now).
              v2.3184: steps aside while the search box has text, so the
              matches sit right under the query (owner call). */}
          {pipelineOverviewHiddenBySearch(stagesSearchQuery) ? null : (
            <PipelineOverview
              contractCoverage={canSeeJobContracts ? pipelineContractCoverage : null}
              onContractStageGap={(stage: ContractStage) => {
                setStagesContractFilter('missing')
                focusStagesSection(stage === 'ready_to_bill' ? 'readyToBill' : stage)
              }}
              onStartContractSweep={() => setContractSweepOpen(true)}
              stats={cacheHeaderStats}
              canOpenAr={stagesGates.isStagesOfficeRole(authRole)}
              canSeeCharts={stagesGates.canSeeStagesMoneyCharts(authRole)}
              canSeeCollected={stagesGates.canSeeStagesMoneyCharts(authRole)}
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
                noJobAccount: jobAccountEvidenceGaps?.jobs ?? 0,
                ownerConfirm: ownerConfirmRows.length,
              }}
              onFixup={(key) => {
                if (key === 'no-customer') setStagesNoCustomerModalOpen(true)
                else if (key === 'owner-confirm') setOwnerConfirmModalOpen(true)
                else if (key === 'no-pictures') setStagesNoJobPicturesModalOpen(true)
                else if (key === 'no-job-account') navigate('/materials?tab=job-accounts&filter=no_account')
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
              burnAlert={pipelineBurnAlert}
              onOpenBurnJob={(jobId) => {
                setStagesSearchQuery('')
                tryOpenEditJob(jobId, { initialTab: 'costs', onSaved: () => void loadJobs() })
              }}
              onShowBurnList={onShowBurnList}
            />
          )}
              </>
            ) : null}
          </div>
          {phoneBoard ? null : (
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
            <JobsStagesSectionToolsMenu
              inputs={{
      authRole,
      // Unfiltered counts — GC Review must stay reachable even
      // when a search/filter empties the visible billed group.
      billedRowCount: unfilteredBoardLists.billedActiveRows.length,
      collectionsRowCount: unfilteredBoardLists.collectionsRows.length,
      arBankTxUnallocatedCount:
        typeof arBankTxUnallocatedCount === 'number' ? arBankTxUnallocatedCount : null,
      capableToBillTotalFormatted: capableDisplay,
      recentViewOpen: stagesRecentViewOpen,
      lienDeskCount,
              }}
              onSelect={sectionToolsOnSelect}
            />
              <JobsStagesJumpStrip counts={jumpStripCounts} onFocusSection={focusStagesSection} />
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
          )}
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
          <OwnerConfirmListModal
            open={ownerConfirmModalOpen}
            onClose={() => setOwnerConfirmModalOpen(false)}
            rows={ownerConfirmRows}
            onSaved={reloadOwnerConfirmRows}
            userId={authUser?.id ?? null}
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
                <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', margin: 0 }}>
                  Updating jobs…
                  {jobsListSnapshotAt != null && <BoardSnapshotAgeChip savedAt={jobsListSnapshotAt} />}
                </p>
              )}
            </div>
          )}
          {jobsListSnapshotAt != null && !jobsListRefreshing && !jobsListLoading && (
            <p role="status" style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8125rem', marginTop: '0.35rem', marginBottom: '0.75rem' }}>
              Showing the board this device remembered — the refresh did not land.
              <BoardSnapshotAgeChip savedAt={jobsListSnapshotAt} />
            </p>
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

            const workingTotal = stagesJobsOpenBalanceTotal(working)
            const waitingTotal = stagesJobsOpenBalanceTotal(waiting)
            const capableToBillTotal = capableToBillTotalWithPlans(working, workingStageInputs)
            const readyToBillTotal = readyToBillRowsExposureTotal(readyToBillRows)
            const billedTotal = billedRowsRemainingTotal(billedActiveRows)
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
            const collectionsTotal = billedRowsRemainingTotal(collectionsRows)
            // v2.1824: sections whose scope isn't fetched render header numbers
            // from the lean stats layer ('…' bridges the first stats load);
            // their bodies show a loading line on expand instead of empty tables.
            // v2.1825: an active search forces every section visible — matches
            // must never hide inside a collapsed section. Toggles keep writing
            // the real (post-search) prefs underneath.
            const stagesSearchActive = stagesSearchQuery.trim() !== ''
            const sectionShown = (section: keyof StagesSectionOpenState) =>
              stagesSearchActive || (phoneBoard ? section === phoneActiveStage : stagesSectionOpen[section])
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
            // The phone strip's numbers: the stage chips read the headers; All / Needs me / Today
            // count the active stage's rows through the same kernel the rows print.
            const phoneStageOf: Record<PhoneStageKey, JobNextStage> = { waiting: 'waiting', working: 'working', readyToBill: 'ready_to_bill', billed: 'billed', collections: 'collections' }
            const phoneStageRows: Array<{ job: JobWithDetails; row: StageRow | null }> = !phoneBoard
              ? []
              : phoneActiveStage === 'waiting'
                ? waiting.map((job) => ({ job, row: null }))
                : phoneActiveStage === 'working'
                  ? working.map((job) => ({ job, row: null }))
                  : (phoneActiveStage === 'readyToBill' ? readyToBillRows : phoneActiveStage === 'billed' ? billedListRows : collectionsRows).map((row) => ({ job: row.job, row }))
            const phoneNexts: JobNextLine[] = phoneStageRows.map(({ job, row }) => jobNextLine(phoneNextInput(job, row, phoneStageOf[phoneActiveStage])))
            const phoneFilterCounts = { all: phoneNexts.length, needs: phoneNexts.filter((n) => n.needsMe).length, today: phoneNexts.filter((n) => n.today).length }
            const phoneStageLine = !phoneBoard
              ? null
              : phoneActiveStage === 'working'
                ? `Working · $${workingHdr.total} · $${capableDisplay} capable of billing`
                : phoneActiveStage === 'waiting'
                  ? `Waiting · $${waitingHdr.total}`
                  : phoneActiveStage === 'readyToBill'
                    ? `Ready to bill · $${readyToBillHdr.total}`
                    : phoneActiveStage === 'billed'
                      ? `Billed awaiting payment · $${billedHdr.total} open`
                      : `Collections · $${collectionsHdr.total} open`
            // Server RPC is authoritative; this only controls button visibility (same office pool as other stage moves).
            const canManageCollections = stagesGates.canManageCollections(authRole)
            // B6 / J3-3: where did the search land? Paid matches are already on
            // the client (v2.1825) but the section sits at the bottom of a board
            // whose open sections all read (0) — say so above the fold.
            const paidSearchHint = stagesPaidSearchHint({
              searchActive: stagesSearchActive,
              openMatchCount:
                waiting.length + working.length + readyToBillRows.length + billedActiveRows.length + collectionsRows.length,
              paidMatchCount: paid.length,
              serverSearchBusy: stagesServerSearchBusy,
            })
            return (
              <>
                {phoneBoard ? (
                  <JobsStagesPhoneStrip
                    counts={{ waiting: waitingHdr.count, working: workingHdr.count, readyToBill: readyToBillHdr.count, billed: billedHdr.count, collections: collectionsHdr.count }}
                    active={phoneActiveStage}
                    onPick={pickPhoneStage}
                    filter={phoneRowFilter}
                    onFilter={setPhoneRowFilter}
                    filterCounts={phoneFilterCounts}
                    stageLine={phoneStageLine}
                  />
                ) : null}
                {paidSearchHint ? (
                  <div
                    role="status"
                    data-testid="stages-paid-search-hint"
                    style={{
                      margin: '0.75rem 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {paidSearchHint.kind === 'paid_matches' ? (
                      <button
                        type="button"
                        onClick={() => document.getElementById(stagesSectionElementId('paid'))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        style={{
                          border: '1px solid var(--border-strong)',
                          background: 'var(--surface)',
                          color: 'var(--text-link)',
                          borderRadius: 9999,
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {paidSearchHint.label}
                      </button>
                    ) : (
                      <span>{paidSearchHint.label}</span>
                    )}
                  </div>
                ) : null}
                <div data-stages-section-header id={stagesSectionElementId('waiting')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('waiting')}
                    aria-expanded={sectionShown('waiting')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('waiting') ? '▼' : '▶'}</span>
                    Waiting ({waitingHdr.count}) - <span className="stagesMoney">${waitingHdr.total}</span>{sectionLoadingSuffix('waiting')}
                  </button>
                </div>
                {sectionShown('waiting') && !stagesSearchActive && !sectionMerged('waiting') && sectionBodyLoading('Waiting jobs')}
                {sectionShown('waiting') && (stagesSearchActive || sectionMerged('waiting')) && (
                  <StagesSectionList
                    {...stagesTableShared}
                    jobList={waiting}
                    phoneRows={phoneRowsFor('waiting')}
                    onToggleProgressSort={onToggleProgressSort}
                    actionLabel={'Move to Working'}
                    onAction={(j) => void updateJobStatus(j.id, 'working')}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={undefined}
                    showPctComplete={true}
                    openNewReportForJob={openNewReportForJob}
                  />
                )}

                <div data-stages-section-header id={stagesSectionElementId('working')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('working')}
                    aria-expanded={sectionShown('working')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('working') ? '\u25BC' : '\u25B6'}</span>
                    Working ({workingHdr.count}) - <span className="stagesMoney">${workingHdr.total}</span>{sectionLoadingSuffix('working')}
                  </button>
                  <div className="stagesWhenPills" role="group" aria-label="Show Working jobs by schedule">
                    {STAGES_WHEN_PILLS.map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        className={`stagesWhenPill${stagesWhenPill === pill ? ' isOn' : ''}${pill === 'unscheduled' && workingWhenCounts.unscheduled > 0 ? ' isWarn' : ''}`}
                        aria-pressed={stagesWhenPill === pill}
                        onClick={() => setStagesWhenPill(pill)}
                        title={
                          pill === 'unscheduled'
                            ? 'Nothing booked from today on, job under 100 %'
                            : pill === 'thisWeek'
                              ? 'A booked visit from today through Sunday'
                              : pill === 'later'
                                ? 'The next booked visit is after this week'
                                : 'Every Working job'
                        }
                      >
                        {STAGES_WHEN_PILL_LABELS[pill]} {workingWhenCounts[pill]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`stagesWhenPill isSort${stagesSortMode === 'next' ? ' isOn' : ''}`}
                      aria-pressed={stagesSortMode === 'next'}
                      onClick={() => setStagesSortMode(toggleStagesNextFirstSort(stagesSortMode))}
                      title="Order every section by the next booked visit — today's first, unbooked rows oldest-last-worked first, finished rows last"
                    >
                      ⇅ Next first
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapableToBillModalOpen(true)}
                    style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Capable of Being Billed: <span className="stagesMoney" style={{ fontWeight: 600 }}>${capableDisplay}</span>
                  </button>
                </div>
                {sectionShown('working') && !stagesSearchActive && !sectionMerged('working') && sectionBodyLoading('Working jobs')}
                {sectionShown('working') && (stagesSearchActive || sectionMerged('working')) && (
                  <StagesSectionList
                    {...stagesTableShared}
                    jobList={workingShown}
                    phoneRows={phoneRowsFor('working')}
                    onToggleProgressSort={onToggleProgressSort}
                    actionLabel={'Ready to Bill'}
                    onAction={(j) =>
                      stagesHamMode
                        ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
                        : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', consequence: phoneBoard ? phoneRowsFor('working')?.advanceConsequence(j, null) : undefined }))}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={stagesHamMode
                      ? (j) => void updateJobStatus(j.id, 'waiting')
                      : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'waiting' })}
                    sendBackLabel={'Mark Waiting'}
                    showPctComplete={true}
                    openNewReportForJob={openNewReportForJob}
                  />
                )}
                {sectionShown('working') && stagesWhenPill === 'unscheduled' && workingWhenCounts.done > 0 ? (
                  <div className="stagesWhenDoneNote">
                    {workingWhenCounts.done} finished with nothing booked {workingWhenCounts.done === 1 ? 'is' : 'are'} not listed — 100 % and no calendar is not a gap; the move is to Ready to Bill, not a booking.
                  </div>
                ) : null}

                {/* Header row mirrors the Paid in Full section: toggle left, gear flushed right. */}
                <div data-stages-section-header id={stagesSectionElementId('readyToBill')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('readyToBill')}
                    aria-expanded={sectionShown('readyToBill')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', flex: 1, minWidth: 0 }}
                  >
                    <span aria-hidden>{sectionShown('readyToBill') ? '\u25BC' : '\u25B6'}</span>
                    Ready to Bill ({readyToBillHdr.count}) - <span className="stagesMoney">${readyToBillHdr.total}</span>{sectionLoadingSuffix('readyToBill')}
                  </button>
                  {(stagesGates.isStagesOwnerRole(authRole)) && (
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
                    {...stagesUnifiedTableShared}
                    rows={readyToBillRows}
                    phoneRows={phoneRowsFor('ready_to_bill')}
                    onToggleProgressSort={onToggleProgressSort}
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
                    openNewReportForJob={openNewReportForJob}
                  />
                )}

                <div data-stages-section-header id={stagesSectionElementId('billed')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleStages('billed')}
                      aria-expanded={sectionShown('billed')}
                      style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span aria-hidden>{sectionShown('billed') ? '▼' : '▶'}</span>
                      Billed Awaiting Payment ({billedHdr.count}) - <span className="stagesMoney">${billedHdr.total}</span>{sectionLoadingSuffix('billed')}
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
                      disabled={!stagesGates.canRecordArPayments(authRole)}
                      title={accountsReceivableButtonAccessibleName}
                      aria-label={accountsReceivableButtonAccessibleName}
                      style={{
                        ...billedHeaderActionStyle(!stagesGates.canRecordArPayments(authRole)),
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
                  {(stagesGates.isStagesOfficeRole(authRole)) && (
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
                  {(stagesGates.canSeeStagesMoneyCharts(authRole)) && (
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
                  {(stagesGates.isStagesOwnerRole(authRole)) && (
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
                    {...stagesUnifiedTableShared}
                    rows={billedListRows}
                    phoneRows={phoneRowsFor('billed')}
                    onToggleProgressSort={onToggleProgressSort}
                    billedExpectedPayChip={billedExpectedPayChipRenderer}
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
                    onJobMoveToCollections={canManageCollections
                      ? (j) => {
                          setCollectionsNoteDraft('')
                          setCollectionsConfirm({ job: j, direction: 'to' })
                        }
                      : undefined}
                    openNewReportForJob={openNewReportForJob}
                  />
                )}

                <div data-stages-section-header id={stagesSectionElementId('collections')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('collections')}
                    aria-expanded={sectionShown('collections')}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{sectionShown('collections') ? '▼' : '▶'}</span>
                    Collections ({collectionsHdr.count}) - <span className="stagesMoney">${collectionsHdr.total}</span>{sectionLoadingSuffix('collections')}
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Billed jobs flagged difficult to collect — still awaiting payment
                  </span>
                  {canManageCollections ? (() => {
                    // ⚖ Legal (v2.3293): mirrors the Billed tier's Accounts Receivable button — a modal in place, `?legal=` deep link.
                    // Gate on the header's cached count, not the tier's rows: Collections loads its rows lazily on expand, so on a
                    // fresh page the rows are empty while the header already says "(8)" — the desk fetches the scope itself.
                    const legalEmpty = collectionsHdr.count === '0'
                    return (
                      <button
                        type="button"
                        onClick={() => setLegalDesk({ payerKey: null })}
                        disabled={legalEmpty}
                        title="Review every Collections account the way an attorney would receive it — before anything is released"
                        aria-label="Legal: review Collections accounts before release to an attorney"
                        style={{
                          ...billedHeaderActionStyle(legalEmpty),
                          marginLeft: isMobile ? undefined : 'auto',
                          color: legalEmpty ? undefined : 'var(--text-700)',
                          borderColor: legalEmpty ? undefined : 'var(--border-strong)',
                        }}
                      >
                        <span aria-hidden>{'⚖'}</span>
                        Legal
                      </button>
                    )
                  })() : null}
                  {lienDeskEligible ? (
                    <button
                      type="button"
                      onClick={() => setLienDesk({ jobId: null })}
                      title="Lien notices due per unpaid work month on sub jobs — draft, approve, send"
                      aria-label="Lien desk: notices due per unpaid work month"
                      style={{
                        ...billedHeaderActionStyle(false),
                        color: 'var(--text-700)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <span aria-hidden>{'⏱'}</span>
                      Lien desk{typeof lienDeskCount === 'number' && lienDeskCount > 0 ? ` · ${lienDeskCount}` : ''}
                    </button>
                  ) : null}
                </div>
                {sectionShown('collections') && !stagesSearchActive && !sectionMerged('collections') && sectionBodyLoading('Collections')}
                {sectionShown('collections') && (stagesSearchActive || sectionMerged('collections')) && (collectionsRows.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    No jobs in Collections. Use “Move to Collections” on a Billed Awaiting Payment row to park a hard-to-collect job here.
                  </p>
                ) : (
                  <StagesUnifiedSectionList
                    {...stagesUnifiedTableShared}
                    rows={collectionsRows}
                    phoneRows={phoneRowsFor('collections')}
                    onToggleProgressSort={onToggleProgressSort}
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
                    jobNoteLine={collectionsNoteLine}
                    openNewReportForJob={openNewReportForJob}
                  />
                ))}

                {/* Header row mirrors the Billed section: toggle on the left, affordances flushed right. */}
                <div data-stages-section-header id={stagesSectionElementId('paid')} style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                    // B6 / J3-3: during a search the header counts the MATCHES the
                    // lean lookup already merged — "Expand to load" was a lie there,
                    // the one that made a found paid job look lost.
                    const countPart = stagesSearchActive
                      ? stagesPaidHeaderSearchCount(paid.length, stagesServerSearchBusy)
                      : paidJobsLoading
                        ? '…'
                        : paidJobsMergedForKey === jobsListDataKey && jobsListDataKey != null
                          ? paid.length
                          : 'Expand to load'
                    const suffix = paidJobsLoading && !stagesSearchActive ? ' — loading' : ''
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
                {(stagesGates.canSeeStagesMoneyCharts(authRole)) && (
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
                {(stagesGates.isStagesOwnerRole(authRole)) && (
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
                      {...stagesTableShared}
                      jobList={paid}
                      onToggleProgressSort={onToggleProgressSort}
                      actionLabel={null}
                      onAction={() => {}}
                      showTimeOpen={true}
                      onSendBack={undefined}
                      onSendBackSimple={stagesHamMode
                        ? (j) => updateJobStatus(j.id, 'billed')
                        : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' })}
                      showPctComplete={true}
                    openNewReportForJob={openNewReportForJob}
                    />
                  </>
                ) : null}

                <JobsWeeklyMovementModal
                  open={weeklyMovementModalOpen}
                  onClose={() => setWeeklyMovementModalOpen(false)}
                  users={users}
                  showToast={showToast}
                  canSchedule={stagesGates.isStagesOfficeRole(authRole)}
                />
                <JobsWeeklyMoneyModal
                  open={weeklyMoneyModalOpen}
                  initialMondayYmd={weeklyMoneyInitialMonday}
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
                  startInRoundGcId={gcReviewRoundGcId}
                  billedActiveRows={unfilteredBoardLists.billedActiveRows}
                  collectionsRows={unfilteredBoardLists.collectionsRows}
                  users={users}
                  isDev={authRole === 'dev'}
                  canCertify={stagesGates.isStagesOfficeRole(authRole)}
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
                {billedTotalByNameModalOpen && (
                  <StagesBilledTotalByNameModal
                    rows={billedActiveRows}
                    expandedName={billedTotalByNameExpandedName}
                    onToggleName={(name) => setBilledTotalByNameExpandedName((prev) => (prev === name ? null : name))}
                    onPrint={() => printBilledAwaitingPaymentReport(billedActiveRows, { searchFilter: stagesSearchQuery })}
                    onGoToBilled={() => {
                      setBilledTotalByNameModalOpen(false)
                      setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
                      setTimeout(() => document.getElementById(stagesSectionElementId('billed'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                    }}
                    onClose={() => setBilledTotalByNameModalOpen(false)}
                  />
                )}
                {capableToBillModalOpen && (
                  <StagesCapableToBillModal
                    rows={buildCapableToBillBreakdownRowsWithPlans(working, workingStageInputs)}
                    total={capableToBillTotal}
                    onView={(job) => {
                      tryOpenEditJob(job.id, {
                        initialJob: job,
                        onSaved: () => {
                          void loadJobs()
                          refreshCustomersAfterJobFormSave()
                        },
                      })
                      setCapableToBillModalOpen(false)
                    }}
                    onGoToWorking={() => {
                      setCapableToBillModalOpen(false)
                      setStagesSectionOpen((prev) => ({ ...prev, working: true }))
                      setTimeout(() => document.getElementById(stagesSectionElementId('working'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                    }}
                    onClose={() => setCapableToBillModalOpen(false)}
                  />
                )}
                {whenInvoiceBillModal && (
                  <StagesEstBillDateModal
                    target={whenInvoiceBillModal}
                    date={whenInvoiceBillModalDate}
                    saving={invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId}
                    onDateChange={setWhenInvoiceBillModalDate}
                    onSave={async () => {
                      if (!whenInvoiceBillModalDate.trim() || !whenInvoiceBillModal) return
                      await setInvoiceEstimatedBillDate(
                        whenInvoiceBillModal.invoiceId,
                        whenInvoiceBillModal.jobId,
                        whenInvoiceBillModalDate.trim()
                      )
                      setWhenInvoiceBillModal(null)
                      setWhenInvoiceBillModalDate('')
                    }}
                    onCancel={() => {
                      setWhenInvoiceBillModal(null)
                      setWhenInvoiceBillModalDate('')
                    }}
                  />
                )}
              </>
            )
          })()}
        </div>
      )}
      {newReportJob ? (
        <NewReportModal
          open
          authUserId={authUser?.id ?? null}
          userRole={authRole}
          initialJob={{
            id: newReportJob.id,
            source: 'job_ledger',
            display_name: newReportJob.job_name ?? '',
            hcp_number: effectiveJobLedgerNumber(newReportJob.hcp_number, newReportJob.click_number) ?? '',
            address: newReportJob.job_address ?? undefined,
          }}
          onClose={() => setNewReportJob(null)}
          onSaved={() => {
            const id = newReportJob.id
            void loadJobs()
            void refreshJobThreadStatsForJobIds([id])
            if (loadJobThreadNotesForJob) void loadJobThreadNotesForJob(id)
          }}
        />
      ) : null}
      {crewModalJob ? <StagesCrewModal job={crewModalJob} onClose={() => setCrewModalJob(null)} /> : null}
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
        <StagesReadyForBillingConfirmModal
          job={readyForBillingJob}
          checked1={readyForBillingChecked1}
          checked2={readyForBillingChecked2}
          onChecked1Change={setReadyForBillingChecked1}
          onChecked2Change={setReadyForBillingChecked2}
          busy={stagesStatusUpdatingId === readyForBillingJob.id}
          onCancel={closeReadyForBilling}
          onConfirm={confirmReadyForBilling}
        />
      )}
      {createPartialInvoiceJob && (
        <StagesCreatePartialInvoiceModal
          job={createPartialInvoiceJob}
          amount={createPartialInvoiceAmount}
          onAmountChange={setCreatePartialInvoiceAmount}
          onAmountBlur={reclampPartialInvoiceAmount}
          error={error}
          creating={creatingPartialInvoiceFromModal}
          onCancel={() => {
            setCreatePartialInvoiceJob(null)
            setCreatePartialInvoiceAmount('')
            setError(null)
          }}
          onCreate={createInvoiceFromModal}
        />
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
          canSeeCharts={stagesGates.canSeeStagesMoneyCharts(authRole)}
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
          slipByCustomer={promiseSlipByCustomer}
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
          canExcludePayments={stagesGates.isStagesOwnerRole(authRole)}
          isDev={authRole === 'dev'}
          canEmailMoneyWaiting={stagesGates.isStagesOfficeRole(authRole)}
          onOpenJobStacked={(jobId, onSaved) => {
            // v2.2311: the Job window (z 1010) stacks above the drill-down
            // (z 80) — nothing closes, and every save refreshes the list.
            tryOpenEditJob(jobId, { initialTab: 'bill', onSaved })
          }}
          onPaySpeedsChanged={() => void refreshBilledPaySpeeds()}
          onEmail={
            stagesGates.isStagesOfficeRole(authRole)
              ? () => setForecastShareModalOpen(true)
              : undefined
          }
          workMonths={forecastWorkMonths}
          onOpenLienNotice={(jobId) => {
            // The Lien desk on that job (v2.3405) — draft, approve, send; the
            // forecast closes so the desk has the screen.
            setBilledPaymentForecastOpen(false)
            setLienDesk({ jobId })
          }}
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
          // B6 / J4-7: the board's typed confirm layers over call mode (z 80 > 70);
          // the session snapshot stays put while the flag writes.
          onMoveToCollections={
            // same office pool as the section's Collections button (server RPC is authoritative)
            stagesGates.isStagesOfficeRole(authRole)
              ? (jobId) => {
                  const job = jobs.find((j) => j.id === jobId)
                  if (!job) {
                    showToast('That job is not on the board any more — refresh and try again.', 'warning')
                    return
                  }
                  setCollectionsConfirm({ job, direction: 'to' })
                }
              : undefined
          }
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
          onSaved={() => {
            void loadPromisedPayDates()
            void loadPromiseRecords()
          }}
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
      <LegalDeskModal
        open={legalDesk != null}
        onClose={() => setLegalDesk(null)}
        collectionsJobs={stagesBoardLists.collectionsJobs}
        jobsLoading={!NON_PAID_SCOPES.every((sc) => cacheMergedScopes.has(sc))}
        contractCoverage={jobContractCoverageByJobId}
        users={users}
        companyName={PORTAL_COMPANY.name}
        initialPayerKey={legalDesk?.payerKey ?? null}
        initialTab={legalDesk?.tab ?? null}
        onOpenContract={(job) => {
          if (openJobContract) openJobContract(job)
        }}
        onOpenLienInstruments={(job) => setLienInstrumentsModal({ job, invoice: null })}
        onOpenEditJob={(jobId) => tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })}
        onOpenCallMode={() => setChaseModalOpen(true)}
        onOpenAccountsReceivable={() => setBankPaymentsModalOpen(true)}
        onOpenSessionNotes={(job) => openSessionNotes(job)}
        onOpenReports={(job) => openJobActivityExpand(job)}
        onOpenJobThread={(jobId) => openJobThreadFullscreen(jobId)}
        onOpenPromisedPay={(args) => setPromisedPayModalJob(args)}
        onFocusJob={(jobId) => {
          setLegalDesk(null)
          focusJobOnBoard(jobId)
        }}
        onAfterWriteDown={async () => {
          await loadJobs()
        }}
        legal={legalMatters}
        canMarkReady={authRole === 'dev'}
        canEditReview={stagesGates.isStagesOfficeRole(authRole)}
      />
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
      <LienDeskModal
        open={lienDesk != null}
        onClose={() => setLienDesk(null)}
        data={lienDeskData}
        loading={lienDeskLoading}
        todayYmd={forecastTodayYmd}
        authRole={authRole}
        authUserId={authUser?.id ?? null}
        authName={authProfileName?.trim() ?? ''}
        workMonths={lienDeskWorkMonths}
        issuer={lienDeskIssuer}
        signerNameFor={lienDeskSignerFor}
        signerPhoneFor={lienDeskSignerPhoneFor}
        initialJobId={lienDesk?.jobId ?? null}
        initialKind={lienDesk?.kind ?? 'notice'}
        initialPile={lienDesk?.pile ?? null}
        onOpenLegalDesk={() => {
          setLienDesk(null)
          setLegalDesk({ payerKey: null })
        }}
        onOpenLienAffidavit={(jobId) => {
          const job = jobs.find((j) => j.id === jobId)
          if (!job) {
            showToast('Open that job from the Pipeline board to file its affidavit — it is not loaded here yet.', 'info')
            return
          }
          setLienDesk(null)
          setLienInstrumentsModal({ job, invoice: null, initialTab: 'affidavit' })
        }}
        onChanged={refetchLienDesk}
        onOpenEditJob={(jobId, focus) => tryOpenEditJob(jobId, { onSaved: () => refetchLienDesk(), ...(focus === 'property-record' ? { propertyRecordFocus: true } : focus === 'gc' || focus === 'lien-contract' ? { focusRow: focus } : {}) })}
        onOpenCompanySettings={(field) => navigate(`/settings?tab=settings-jobs&focus=issuer.${field}`)}
        onOpenLienInstruments={(jobId) => {
          const months = lienDeskData?.queue.entries.find((e) => e.jobId === jobId)?.item?.months ?? []
          const openWith = (job: JobWithDetails) => {
            setLienDesk(null)
            setLienInstrumentsModal({ job, invoice: null, initialTab: 'notice', noticeMonths: months })
          }
          const loaded = jobs.find((j) => j.id === jobId)
          if (loaded) {
            openWith(loaded)
            return
          }
          // A book row (v2.3768) can name a job the board has not loaded — fetch it rather than turn the office away (v2.3781).
          void fetchJobWithDetailsById(jobId).then((job) => {
            if (job) openWith(job)
            else showToast('That job could not be loaded — open it from the Pipeline board.', 'error')
          })
        }}
        onPutGcOnNotice={(gcId) => {
          setLienDesk(null)
          setGcNotice({ gcId })
        }}
      />
      <GcOnNoticeModal
        open={gcNotice != null}
        gcId={gcNotice?.gcId ?? null}
        onClose={() => setGcNotice(null)}
        todayYmd={forecastTodayYmd}
        authRole={authRole}
        authUserId={authUser?.id ?? null}
        authName={authProfileName?.trim() ?? ''}
        issuer={lienDeskIssuer}
        signerNameFor={lienDeskSignerFor}
        signerPhoneFor={lienDeskSignerPhoneFor}
        onOpenEditJob={(jobId, focus) => tryOpenEditJob(jobId, { onSaved: () => refetchLienDesk(), ...(focus === 'property-record' ? { propertyRecordFocus: true } : focus === 'gc' || focus === 'lien-contract' ? { focusRow: focus } : {}) })}
        onChanged={refetchLienDesk}
      />
      <LienInstrumentsModal
        open={lienInstrumentsModal != null}
        onClose={() => setLienInstrumentsModal(null)}
        job={lienInstrumentsModal?.job ?? null}
        invoice={lienInstrumentsModal?.invoice ?? null}
        initialTab={lienInstrumentsModal?.initialTab}
        noticeMonths={lienInstrumentsModal?.noticeMonths ?? null}
        signerNameFallback={lienReleaseSignerFallback}
        authEmail={authUser?.email?.trim() ?? ''}
        onOpenExternalPrefill={() => {
          const ctx = lienInstrumentsModal
          setLienInstrumentsModal(null)
          if (ctx) setLienToolingPrefillModal(ctx)
        }}
        onRecorded={() => {
          void loadDemandOutJobIds()
          // A recorded notice that names the desk item's months sends the item (v2.3405).
          const jobId = lienInstrumentsModal?.job.id
          if (jobId) void syncLienDeskAfterRecord(jobId).finally(() => refetchLienDesk())
        }}
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
        onJobChanged={() => void loadJobs()}
        onEditJob={(j) => openEdit(j)}
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
        floorCents={contractFloorCents}
        onEditJob={(j) => openEdit(j)}
        onSent={() => void loadJobContractCoverage()}
        onJobChanged={() => void loadJobs()}
        onFilterBoard={() => {
          setContractSweepOpen(false)
          setStagesContractFilter('missing')
        }}
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
        billedYmd={markPaidInvoice?.billed_at ? markPaidInvoice.billed_at.slice(0, 10) : null}
        existingPromiseYmd={markPaidInvoice ? (promisedPayDates?.[markPaidInvoice.job.id]?.promisedYmd ?? null) : null}
        onClose={() => setMarkPaidInvoice(null)}
        onSuccess={async () => {
          await loadJobs()
          void loadPromisedPayDates()
          void loadPromiseRecords()
        }}
      />
      {sendBackInvoice && (
        <StagesSendBackInvoiceModal
          target={sendBackInvoice}
          checked={sendBackChecked}
          onCheckedChange={setSendBackChecked}
          showStripeExplainer={sendBackInvoiceStripeExplainerAfterFailure}
          busy={stagesInvoiceUpdatingId === sendBackInvoice.inv.id}
          onCancel={closeSendBackInvoice}
          onConfirm={confirmSendBackInvoice}
        />
      )}
      {sendBackJob && (
        <StagesSendBackJobModal
          target={sendBackJob}
          checked={sendBackChecked}
          onCheckedChange={setSendBackChecked}
          needsAttestation={sendBackNeedsAttestation}
          collectPaymentNotice={sendBackCollectPaymentNotice}
          statusEventLine={sendBackStatusEventLine}
          reason={sendBackReason}
          onReasonChange={setSendBackReason}
          busy={stagesStatusUpdatingId === sendBackJob.id}
          onCancel={closeSendBackJob}
          onConfirm={confirmSendBackJob}
        />
      )}
      {sendBackConfirmJob && (
        <StagesSendBackSimpleConfirmModal
          target={sendBackConfirmJob}
          busy={stagesStatusUpdatingId === sendBackConfirmJob.id}
          onCancel={() => setSendBackConfirmJob(null)}
          onConfirm={confirmSendBackSimple}
        />
      )}
      {collectionsConfirm && (
        <StagesCollectionsConfirmModal
          confirm={collectionsConfirm}
          noteDraft={collectionsNoteDraft}
          onNoteDraftChange={setCollectionsNoteDraft}
          saving={collectionsSaving}
          onCancel={closeCollectionsConfirm}
          onConfirm={confirmCollectionsMove}
        />
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
    </StagesCrewModalContext.Provider>
    </StagesSearchHighlightProvider>
  )
})

export default JobsStagesTab
