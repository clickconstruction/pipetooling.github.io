import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  addDaysToDate,
  calendarDaysSinceDateUtc,
  formatCurrency,
  formatCurrencyNoCents,
  formatEstimatedCompletionDisplay,
  formatJobNameTwoLines,
  formatTimeSince,
  formatUsdNoCents,
} from '../lib/jobs/jobFormatting'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobBilledUnpaidDollars,
  jobStagesInvoiceJumpChipTargets,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
  stagesJobLevelStripeEmailedHintInvoice,
  sumInvoiceAppliedFromJobPayments,
} from '../lib/jobs/invoiceBilling'
import { pageTabStyle } from '../lib/pageTabStyle'
import { filterActiveCustomersForPicker } from '../lib/customerArchive'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useSendBackCollectPaymentFlowNotice } from '../hooks/useSendBackCollectPaymentFlowNotice'
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { usePartsLedgerData } from '../hooks/usePartsLedgerData'
import type { TallyPartRow } from '../types/tallyPart'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { buildJobSubSheetHtml } from '../lib/jobsDocuments/subLaborSheet'
import { buildBilledAwaitingPaymentReportHtml } from '../lib/jobsDocuments/billedAwaitingPaymentReport'
import { buildJobSummaryCostBreakdownHtml } from '../lib/jobsDocuments/jobSummaryCostBreakdown'
import { buildSubLaborOutstandingByPerson, subLaborJobMatchesSearch } from '../lib/subLaborOutstanding'
import { laborJobSubCost } from '../lib/jobs/subLaborCost'
import { buildClickToolingUrl, formatAddressTwoLines, googleMapsSearchUrl } from '../lib/jobs/jobAddressUrls'
import JobsCrewPnlTab from '../components/jobs/JobsCrewPnlTab'
import JobsSubLaborTab from '../components/jobs/JobsSubLaborTab'
import JobsSubLaborFormModal, { type JobsSubLaborFormModalHandle } from '../components/jobs/JobsSubLaborFormModal'
import type { LaborJob, SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../types/laborJob'
import { formatDispatchNoteDaysAgoShortPhrase, formatDispatchNoteWeekdayShortTimeChicago, getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import { buildStagesMoneyBarModel } from '../lib/stagesMoneyBar'
import StagesProgressPaymentCell from '../components/jobs/StagesProgressPaymentCell'
import { JobAddressText } from '../components/jobs/JobAddressText'
import { composePctCompleteNoteBody } from '../lib/jobs/stagesPctNote'
import { ManageJobPeopleModal } from '../components/jobs/ManageJobPeopleModal'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../contexts/DispatchTaskModalContext'
import { showTaskDispatchButton } from '../lib/headerTaskDispatchEstimatorEligible'
import JobReportsModal from '../components/JobReportsModal'
import JobsInspectionsTab from '../components/jobs/JobsInspectionsTab'
import JobsReportsTab from '../components/jobs/JobsReportsTab'
import JobsPartsTab from '../components/jobs/JobsPartsTab'
import JobsBillingTab from '../components/jobs/JobsBillingTab'
import JobsJobSummaryTab from '../components/jobs/JobsJobSummaryTab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { jobBillingContextFromJob } from '../lib/jobBillingContext'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import {
  canRoleSeeArBankUnallocatedOrgNudge,
  useArBankUnallocatedCount,
} from '../hooks/useArBankUnallocatedCount'
import BankPaymentsModal from '../components/jobs/BankPaymentsModal'
import JobBookModal from '../components/jobs/JobBookModal'
import JobsCombineSeparateModal from '../components/jobs/JobsCombineSeparateModal'
import StagesNoCustomerJobsModal from '../components/jobs/StagesNoCustomerJobsModal'
import StagesAlertJobListModal from '../components/jobs/StagesAlertJobListModal'
import JobBookIcon from '../components/icons/JobBookIcon'
import BilledPaymentConfirmationModal from '../components/jobs/BilledPaymentConfirmationModal'
import BilledBillViewModal from '../components/jobs/BilledBillViewModal'
import { findInvoiceWithJobFromJobs } from '../lib/invoiceWithJobFromJobList'
import LienToolingPrefillModal from '../components/jobs/LienToolingPrefillModal'
import AiaG702G703Modal from '../components/jobs/AiaG702G703Modal'
import { HazmatFeeModal, type HazmatFeeModalJob } from '../components/jobs/HazmatFeeModal'
import {
  JobSummaryCostCellDrilldownModal,
} from '../components/jobs/JobSummaryCostCellDrilldownModal'
import { StripeInvoiceSendFromStripeButton } from '../components/jobs/StripeInvoiceSendFromStripeButton'
import { JobThreadNotesPanel } from '../components/JobThreadNotesPanel'
import { ScheduleJobModal } from '../components/jobs/ScheduleJobModal'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { useSubLaborLedger } from '../hooks/useSubLaborLedger'
import { CrewJobsBlock } from '../components/CrewJobsBlock'
import type { Database } from '../types/database'
import type { JobSummaryClockSessionRow, JobSummaryInvoiceAllocationLine, JobSummaryMercuryAllocationRow, JobSummaryReportRow } from '../types/jobSummary'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobFormModal, type OpenEditJobOptions } from '../contexts/JobFormModalContext'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { fetchJobsLedgerWithDetailsForStages } from '../lib/fetchJobsLedgerWithDetailsForStages'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'
import {
  applyMinHcpFilter,
  readJobSummaryMinHcpExclusiveFromStorage,
} from '../lib/jobSummaryHcpFilter'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { getDefaultWeekRange } from '../utils/dateUtils'
import { fetchAttributionsByMercuryTxIds } from '../lib/fetchMercuryRelationsByTxIds'
import { fetchMercuryJobAllocationsWithAttributionForJob } from '../lib/fetchMercuryJobAllocationsWithAttributionForJob'
import { formatDecimalWorkHoursToHhMm } from '../lib/formatDecimalWorkHoursHhMm'
import { loadMercuryAllocModalDataForTransaction, type MercuryAllocModalData } from '../lib/mercuryAllocModalData'
import {
  PartsUnattributedMercuryListModal,
  loadUsersOptionsForBankingAttribution,
} from '../components/jobs/PartsUnattributedMercuryListModal'
import { PartsUnattributedAllJobsModal } from '../components/jobs/PartsUnattributedAllJobsModal'
import {
  fetchUnattributedMercuryLinesForManyJobs,
  type UnattributedMercuryLineForJob,
} from '../lib/fetchUnattributedMercuryForManyJobs'
import {
  MercuryTransactionAllocationsModal,
  type MercuryAllocSavedDetail,
} from '../components/MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../components/SearchableSelect'
import { isSelectableOption } from '../components/SearchableSelect'
import { mercuryQuickAssignUserAttribution } from '../lib/mercuryQuickAssignUserAttribution'
import type { BankingAttributionUser } from '../lib/mercuryCardNicknameUserMatch'
import {
  deriveStagesBillingActivityDetail,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
} from '../lib/stagesJobReferenceDates'
import {
  clearReturnEditJobFromStages,
  peekReturnEditJobFromStages,
} from '../lib/returnEditJobFromStages'
import { DELETE_DRAFT_BILL_LABEL } from '../lib/deleteDraftBillLabel'
import { formatMoveIntoStageByOnLine } from '../lib/formatMoveIntoStageByOnLine'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import { runJobsStagesSerializedPipeline } from '../lib/jobsStagesSerializedPipeline'
import {
  shouldResyncJobsAfterUpdateJobStatusFailure,
  toastForUpdateJobStatusFailure,
} from '../lib/updateJobStatusClientFeedback'
import {
  buildBilledStageRows,
  buildJobsStagesBoardLists,
  clampPartialInvoiceCentsToUnallocated,
  jobBillingUnallocatedDollars,
  jobInCollections,
  locateStagesInvoiceSection,
  readyToBillRowsExposureTotal,
  stagesInvoiceVisibleWithEmptySearch,
  stagesJobsWithoutCustomerFromFiltered,
  stagesSectionKeyForJobStatus,
  stagesWorkingJobsWithoutPicturesFromWorking,
  type InvoiceWithJob,
  type StageRow,
} from '../lib/jobsStagesBoard'
import { jobLedgerHasCustomerForBilling } from '../lib/jobLedgerCustomerForBilling'
import { setJobCollectionsFlag } from '../lib/setJobCollectionsFlag'
import {
  fetchJobIdsMatchingScheduleOrClockSessions,
  shouldFetchStagesScheduleSessionSearch,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from '../lib/jobsStagesScheduleSessionSearch'
import { showAiaG702G703 } from '../lib/aiaG702G703Eligibility'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
export type UserRow = { id: string; name: string; email: string | null; role: string; notes: string | null }

type JobsTab = 'reports' | 'stages' | 'billing' | 'sub_sheet_ledger' | 'combined-labor' | 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'

/** Align with Layout mobile breakpoint; shortens primary create button to "New". */
const JOBS_SHORT_NEW_JOB_BUTTON_MQ = '(max-width: 640px)'

// Roster (for Labor / Sub Sheet Ledger)
export type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type CrewJobAssignment = { job_id: string; pct: number }
type CrewJobRow = { job_assignments: CrewJobAssignment[] }
type TeamLaborBreakdownEntry = {
  personName: string
  hours: number
  cost: number
  byWorkDate: Array<{ workDate: string; hours: number; cost: number }>
}
type TeamLaborRow = {
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  people: string[]
  manHours: number
  jobCost: number
  breakdown: TeamLaborBreakdownEntry[]
}


/** Stages table headers: one visual line per phrase when the table is narrow (no mid-phrase wrap). */
const stagesThreeLineHeaderLineStyle: CSSProperties = { display: 'block', whiteSpace: 'nowrap' }

function renderStagesThreeLineHeader(line1: string, line2: string, line3: string) {
  return (
    <>
      <span style={stagesThreeLineHeaderLineStyle}>{line1}</span>
      <span style={stagesThreeLineHeaderLineStyle}>{line2}</span>
      <span style={stagesThreeLineHeaderLineStyle}>{line3}</span>
    </>
  )
}

const JOBS_TABS: JobsTab[] = ['reports', 'stages', 'billing', 'sub_sheet_ledger', 'combined-labor', 'teams-summary', 'parts', 'job-summary', 'inspections', 'billed']

type JobDetailPrefillLocationState = {
  jobDetailPrefill?: { prefillRowLabel: string | null; prefillAddress: string | null }
}

export default function Jobs() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  /** `loadJobs()` only filters by this URL param; avoid refetching all jobs when unrelated search params change. */
  const customerParamForJobsReload = searchParams.get('customer')
  const customerFilterForFetch = useMemo(
    () => searchParams.get('customer')?.trim() || null,
    [searchParams],
  )
  const customerFilterForFetchRef = useRef<string | null>(null)
  customerFilterForFetchRef.current = customerFilterForFetch
  const teamLaborJobParam = searchParams.get('teamLaborJob')?.trim() || null
  const onFocusTeamLaborConsumed = useCallback(() => {
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('teamLaborJob')
      return n
    }, { replace: true })
  }, [setSearchParams])

  const { user: authUser, role: authRole, loading: authLoading, profileName: authProfileName } = useAuth()
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
  const shortNewJobButtonLabel = useMatchMedia(JOBS_SHORT_NEW_JOB_BUTTON_MQ)
  const { nicknameByDebitCard, nicknameByAccount } = useMercuryLedgerNicknames()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const checklistAddModal = useChecklistAddModal()
  const dispatchTaskModal = useDispatchTaskModal()
  const billCustomer = useBillCustomerModal()
  const {
    jobs,
    setJobs,
    jobsListLoading,
    jobsListRefreshing,
    paidJobsLoading,
    jobsListDataKey,
    paidJobsMergedForKey,
    jobsListError,
    runFetchJobs,
    fetchPaidJobsIfNeeded,
  } = useJobsListCache()
  const jobDetailModal = useJobDetailModal()
  const [activeTab, setActiveTab] = useState<JobsTab>('stages')
  const activeTabRef = useRef<JobsTab>('stages')
  activeTabRef.current = activeTab
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  /** Set after Ready to Bill → See in Stages; cleared on timeout, dismiss, tab change, or reopening Edit Job. */
  const [returnEditBannerJobId, setReturnEditBannerJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Full org job list for Job Summary tab (all statuses, ignores `?customer=`). */
  const [jobSummaryLedgerAllJobs, setJobSummaryLedgerAllJobs] = useState<JobWithDetails[] | null>(null)
  const [jobSummaryMinHcpExclusive, setJobSummaryMinHcpExclusive] = useState(() =>
    readJobSummaryMinHcpExclusiveFromStorage(),
  )
  const jobSummaryLedgerJobs = useMemo(() => {
    if (jobSummaryLedgerAllJobs == null) return null
    return applyMinHcpFilter(jobSummaryLedgerAllJobs, jobSummaryMinHcpExclusive)
  }, [jobSummaryLedgerAllJobs, jobSummaryMinHcpExclusive])
  const [jobSummaryLedgerLoading, setJobSummaryLedgerLoading] = useState(false)
  const [jobSummaryLedgerError, setJobSummaryLedgerError] = useState<string | null>(null)
  const loadJobSummaryLedgerRef = useRef<() => void>(() => {})
  const jobSummaryLedgerSnapshotLoadedRef = useRef(false)
  /** Debounce timer for post-Stages-mutation refresh (coalesce rapid moves into one fetch). */
  const loadJobsAfterMutationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Coalesce rapid `useEffect` dependency churn (tab/customer) into one `loadJobs`. */
  const loadJobsFromEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LOAD_JOBS_AFTER_MUTATION_MS = 300
  const LOAD_JOBS_FROM_EFFECT_DEBOUNCE_MS = 50
  const loadJobs = useCallback(() => {
    return runFetchJobs(customerFilterForFetch)
  }, [runFetchJobs, customerFilterForFetch])

  const loadJobSummaryLedger = useCallback(async () => {
    if (!authUser?.id) return
    setJobSummaryLedgerLoading(true)
    setJobSummaryLedgerError(null)
    try {
      const result = await fetchJobsLedgerWithDetailsForStages({
        customerFilter: null,
        statusScope: 'all',
        jobSummaryEnrich: true,
        minHcpExclusive: jobSummaryMinHcpExclusive,
      })
      if (!result.ok) {
        setJobSummaryLedgerError(result.error)
        return
      }
      setJobSummaryLedgerAllJobs(result.jobs)
      jobSummaryLedgerSnapshotLoadedRef.current = true
    } catch (e: unknown) {
      setJobSummaryLedgerError(e instanceof Error ? e.message : String(e))
    } finally {
      setJobSummaryLedgerLoading(false)
    }
  }, [authUser?.id, jobSummaryMinHcpExclusive])
  loadJobSummaryLedgerRef.current = () => {
    void loadJobSummaryLedger()
  }

  const jobsListPipelineBusy = jobsListLoading || jobsListRefreshing

  const tryOpenEditJob = useCallback(
    (jobId: string, options?: OpenEditJobOptions) => {
      if (jobsListPipelineBusy) {
        showToast('Please wait until jobs finish loading.', 'info')
        return
      }
      jobFormModal?.openEditJob(jobId, options ?? {})
    },
    [jobsListPipelineBusy, jobFormModal, showToast],
  )

  function scheduleLoadJobsAfterMutation() {
    if (loadJobsAfterMutationTimerRef.current) {
      clearTimeout(loadJobsAfterMutationTimerRef.current)
    }
    loadJobsAfterMutationTimerRef.current = setTimeout(() => {
      loadJobsAfterMutationTimerRef.current = null
      void runFetchJobs(customerFilterForFetchRef.current ?? null)
      if (activeTabRef.current === 'job-summary' || jobSummaryLedgerSnapshotLoadedRef.current) {
        void loadJobSummaryLedgerRef.current()
      }
    }, LOAD_JOBS_AFTER_MUTATION_MS)
  }
  /** Loaded for Stages/Billing implied-customer hints and refreshed when job form saves. */
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [createPartialInvoiceJob, setCreatePartialInvoiceJob] = useState<JobWithDetails | null>(null)
  const [scheduleModalJob, setScheduleModalJob] = useState<JobWithDetails | null>(null)
  const [createPartialInvoiceAmount, setCreatePartialInvoiceAmount] = useState('')
  const [creatingPartialInvoiceFromModal, setCreatingPartialInvoiceFromModal] = useState(false)

  // Sub Sheet Ledger state
  const [makePaymentLaborJob, setMakePaymentLaborJob] = useState<SubLaborPaymentTarget | null>(null)
  const [makePaymentAmount, setMakePaymentAmount] = useState('')
  const [makePaymentMemo, setMakePaymentMemo] = useState('')
  const [makePaymentSaving, setMakePaymentSaving] = useState(false)
  const [backchargeLaborJob, setBackchargeLaborJob] = useState<SubLaborBackchargeTarget | null>(null)
  const [backchargeAmount, setBackchargeAmount] = useState('')
  const [backchargeMemo, setBackchargeMemo] = useState('')
  const [backchargeSaving, setBackchargeSaving] = useState(false)
  const [editingPayment, setEditingPayment] = useState<{
    id: string
    jobId: string
    amount: number
    memo: string | null
    isBackcharge: boolean
  } | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentMemo, setEditPaymentMemo] = useState('')
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [driveSettingsOpen, setDriveSettingsOpen] = useState(false)
  const [driveMileageCost, setDriveMileageCost] = useState<number | null>(null)
  const [driveTimePerMile, setDriveTimePerMile] = useState<number | null>(null)
  const [driveSettingsSaving, setDriveSettingsSaving] = useState(false)
  const [defaultLaborRateModalOpen, setDefaultLaborRateModalOpen] = useState(false)
  const [defaultLaborRateValue, setDefaultLaborRateValue] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const {
    laborJobs,
    setLaborJobs,
    laborJobNamesByHcp,
    laborJobsLoading,
    laborJobDeletingId,
    loadLaborJobs,
    deleteLaborJob,
    updateLaborJobDate,
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
  } = useSubLaborLedger({
    authUserId: authUser?.id,
    setError,
    // Keep the open Edit Sub Labor modal in sync after each ledger reload.
    onLaborJobsReloaded: (mappedJobs) => {
      setEditingLaborJob((prev) => {
        if (!prev) return prev
        const updated = mappedJobs.find((j) => j.id === prev.id)
        return updated ?? prev
      })
    },
  })
  const [myRole, setMyRole] = useState<string | null>(null)
  const subLaborFormRef = useRef<JobsSubLaborFormModalHandle>(null)

  const canAccessBankingForParts = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      myRole === 'dev' ||
      myRole === 'master_technician' ||
      isAssistantLike(myRole),
    [authRole, myRole],
  )

  // Combined Labor tab (Team Job Labor) state
  const [teamLaborData, setTeamLaborData] = useState<TeamLaborRow[]>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)

  // Stages board: man-hours applied per job (lightweight get_man_hours_by_job RPC; mirrors teamLabor.ts math).
  const [stagesManHoursRows, setStagesManHoursRows] = useState<
    Array<{ job_id: string; person_name: string; man_hours: number }>
  >([])
  const [stagesManHoursLoading, setStagesManHoursLoading] = useState(false)
  const stagesManHoursLoadedRef = useRef(false)

  const {
    tallyParts,
    tallyPartsLoading,
    invoiceAmountByJob,
    deletingTallyPartId,
    updatingFixtureCostId,
    deleteTallyPart,
    updateFixtureCost,
  } = usePartsLedgerData({
    authUserId: authUser?.id ?? null,
    isActive: activeTab === 'parts' || activeTab === 'job-summary',
    onError: setError,
  })
  const [tallyPartsSearch, setTallyPartsSearch] = useState('')
  const [showMyJobsOnly, setShowMyJobsOnly] = useState(false)
  const [subLaborSearch, setSubLaborSearch] = useState('')
  const [jobSummarySearch, setJobSummarySearch] = useState('')
  const [printCostBreakdownJobId, setPrintCostBreakdownJobId] = useState<string | null>(null)
  const [myJobIds, setMyJobIds] = useState<Set<string> | null>(null)
  const [expandedPartsJobIds, setExpandedPartsJobIds] = useState<Set<string>>(new Set())
  const [expandedJobSummaryJobIds, setExpandedJobSummaryJobIds] = useState<Set<string>>(new Set())
  /** Job Summary Team Labor: `${jobId}::${breakdownIndex}` expanded (drives deferred clock_sessions fetch). */
  const [jobSummaryTeamLaborPersonExpandedKeys, setJobSummaryTeamLaborPersonExpandedKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [jobSummaryBreakdownPersonSearchByJobId, setJobSummaryBreakdownPersonSearchByJobId] = useState<
    Record<string, string>
  >({})
  const jobSummaryClockSessionsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryClockSessionsByJobId, setJobSummaryClockSessionsByJobId] = useState<Map<string, JobSummaryClockSessionRow[]>>(() => new Map())
  const jobSummaryInvoiceLinesLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryInvoiceLinesByJobId, setJobSummaryInvoiceLinesByJobId] = useState<
    Map<string, JobSummaryInvoiceAllocationLine[]>
  >(() => new Map())
  const jobSummaryMercuryAllocationsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryMercuryAllocationsByJobId, setJobSummaryMercuryAllocationsByJobId] = useState<
    Map<string, JobSummaryMercuryAllocationRow[]>
  >(() => new Map())

  const loadJobSummaryMercuryAllocationsForJob = useCallback(async (jobId: string, force = false) => {
    if (!force && jobSummaryMercuryAllocationsLoadedRef.current.has(jobId)) return
    if (force) jobSummaryMercuryAllocationsLoadedRef.current.delete(jobId)
    try {
      const rows = await fetchMercuryJobAllocationsWithAttributionForJob(jobId, 'job summary mercury')
      const mapped: JobSummaryMercuryAllocationRow[] = rows.map((r) => ({
        id: r.id,
        mercury_transaction_id: r.mercury_transaction_id,
        amount: r.amount,
        note: r.note,
        attributionDisplayName: r.attributionDisplayName,
        mercury_transactions: r.mercury_transactions
          ? {
              posted_at: r.mercury_transactions.posted_at,
              counterparty_name: r.mercury_transactions.counterparty_name,
              amount: r.mercury_transactions.amount,
              note: r.mercury_transactions.note,
              external_memo: r.mercury_transactions.external_memo,
              raw: r.mercury_transactions.raw,
            }
          : null,
      }))
      setJobSummaryMercuryAllocationsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, mapped)
        return next
      })
    } catch {
      setJobSummaryMercuryAllocationsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryMercuryAllocationsLoadedRef.current.add(jobId)
    }
  }, [])

  const loadJobSummaryInvoiceLinesForJob = useCallback(async (jobId: string) => {
    if (jobSummaryInvoiceLinesLoadedRef.current.has(jobId)) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase.rpc('get_invoice_allocation_lines_for_jobs', { p_job_ids: [jobId] }),
        'job summary invoice lines',
      )
      const rows = (data ?? []) as JobSummaryInvoiceAllocationLine[]
      setJobSummaryInvoiceLinesByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, rows)
        return next
      })
    } catch {
      setJobSummaryInvoiceLinesByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryInvoiceLinesLoadedRef.current.add(jobId)
    }
  }, [])

  /** Latest field-report completion % per job (Job Summary "%" column; report wins over pct_complete). */
  const jobSummaryReportPctRequestedRef = useRef<Set<string>>(new Set())
  const [jobSummaryReportPctByJobId, setJobSummaryReportPctByJobId] = useState<Map<string, number>>(
    () => new Map(),
  )

  const jobSummaryReportsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryReportsByJobId, setJobSummaryReportsByJobId] = useState<Map<string, JobSummaryReportRow[]>>(
    () => new Map(),
  )

  /** Field reports for the expanded-row Charges & Value timeline (lazy per expanded job). */
  const loadJobSummaryReportsForJob = useCallback(async (jobId: string) => {
    if (jobSummaryReportsLoadedRef.current.has(jobId)) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('reports')
            .select('id, created_at, field_values, users!reports_created_by_user_id_fkey(name)')
            .eq('job_ledger_id', jobId)
            .order('created_at', { ascending: true }),
        'job summary reports',
      )
      const rows = (data ?? []) as unknown as JobSummaryReportRow[]
      setJobSummaryReportsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, rows)
        return next
      })
    } catch {
      setJobSummaryReportsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryReportsLoadedRef.current.add(jobId)
    }
  }, [])

  const [mercuryCardChargesByJobId, setMercuryCardChargesByJobId] = useState<Map<string, number>>(() => new Map())
  const partsTabMercuryLoadedRef = useRef<Set<string>>(new Set())
  const partsTabMercuryInFlightRef = useRef<Set<string>>(new Set())
  const [partsTabMercuryAllocationsByJobId, setPartsTabMercuryAllocationsByJobId] = useState<
    Map<string, Awaited<ReturnType<typeof fetchMercuryJobAllocationsWithAttributionForJob>>>
  >(() => new Map())
  const partsUnattribFlowJobIdRef = useRef<string | null>(null)
  /** When opening Mercury alloc modal from Job Summary drilldown, refresh this job (+ targets) on save. */
  const jobSummaryMercuryEditFlowJobIdRef = useRef<string | null>(null)
  const [partsUnattribListJobId, setPartsUnattribListJobId] = useState<string | null>(null)
  const [partsAllocModalData, setPartsAllocModalData] = useState<MercuryAllocModalData | null>(null)
  const [jobSummaryCostDrilldown, setJobSummaryCostDrilldown] = useState<{ title: string; body: ReactNode } | null>(null)
  const [partsAllocModalOpen, setPartsAllocModalOpen] = useState(false)
  const [bankingAttributionUsersOptions, setBankingAttributionUsersOptions] = useState<SearchableSelectOption[]>([])
  const [allJobsUnattributedOpen, setAllJobsUnattributedOpen] = useState(false)
  const [allJobsUnattributedLoading, setAllJobsUnattributedLoading] = useState(false)
  const [allJobsUnattributedLines, setAllJobsUnattributedLines] = useState<UnattributedMercuryLineForJob[] | null>(null)
  const [pendingScrollToPartsJobId, setPendingScrollToPartsJobId] = useState<string | null>(null)
  const [pendingStagesInvoiceFocusId, setPendingStagesInvoiceFocusId] = useState<string | null>(null)
  const [stagesInvoiceFlashId, setStagesInvoiceFlashId] = useState<string | null>(null)
  // "Follow cards I move": scroll to + flash a job row after a stage move (invoice-focus idiom).
  const [pendingStagesJobFocusId, setPendingStagesJobFocusId] = useState<string | null>(null)
  const [stagesJobFlashId, setStagesJobFlashId] = useState<string | null>(null)
  const [stagesSectionOpen, setStagesSectionOpen] = useState({
    waiting: false,
    working: true,
    readyToBill: true,
    billed: true,
    collections: true,
    paid: false,
  })
  const [billedTotalByNameModalOpen, setBilledTotalByNameModalOpen] = useState(false)
  const [billedTotalByNameExpandedName, setBilledTotalByNameExpandedName] = useState<string | null>(null)
  const [stagesNoCustomerModalOpen, setStagesNoCustomerModalOpen] = useState(false)
  const [stagesNoCustomerBtnHover, setStagesNoCustomerBtnHover] = useState(false)
  const [stagesNoJobPicturesModalOpen, setStagesNoJobPicturesModalOpen] = useState(false)
  const [stagesNoJobPicturesBtnHover, setStagesNoJobPicturesBtnHover] = useState(false)
  const [jobBookModalOpen, setJobBookModalOpen] = useState(false)
  const [combineSeparateModalOpen, setCombineSeparateModalOpen] = useState(false)
  const [capableToBillModalOpen, setCapableToBillModalOpen] = useState(false)
  const [whenInvoiceBillModal, setWhenInvoiceBillModal] = useState<{
    invoiceId: string
    jobId: string
    jobName: string
    hcpNumber: string
  } | null>(null)
  const [whenInvoiceBillModalDate, setWhenInvoiceBillModalDate] = useState('')
  const [invoiceEstimatedBillDateSavingId, setInvoiceEstimatedBillDateSavingId] = useState<string | null>(null)
  const [stagesSearchQuery, setStagesSearchQuery] = useState('')
  const [stagesSearchExtraJobIds, setStagesSearchExtraJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const [stagesScheduleSessionSearchBusy, setStagesScheduleSessionSearchBusy] = useState(false)
  const [stagesStatusUpdatingId, setStagesStatusUpdatingId] = useState<string | null>(null)
  const [stagesInvoiceUpdatingId, setStagesInvoiceUpdatingId] = useState<string | null>(null)
  const stagesInvoiceMutationLockRef = useRef<string | null>(null)
  const stagesInvoiceSendBackConfirmLockRef = useRef(false)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [markPaidJob, setMarkPaidJob] = useState<JobWithDetails | null>(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceWithJob | null>(null)
  const [bankPaymentsModalOpen, setBankPaymentsModalOpen] = useState(false)
  const { count: arBankTxUnallocatedCount } = useArBankUnallocatedCount({
    enabled: activeTab === 'stages',
    authUserId: authUser?.id,
    authRole,
    bankPaymentsModalOpen,
  })
  const [viewBillInvoice, setViewBillInvoice] = useState<InvoiceWithJob | null>(null)
  const [lienToolingPrefillModal, setLienToolingPrefillModal] = useState<{
    job: JobWithDetails
    invoice: JobsLedgerInvoice | null
  } | null>(null)
  const [aiaG702StagesJob, setAiaG702StagesJob] = useState<JobWithDetails | null>(null)
  const [hazmatFeeJob, setHazmatFeeJob] = useState<HazmatFeeModalJob | null>(null)
  /** Same office set as the create_hazmat_fee_incident RPC gate. */
  const canCreateHazmatFee =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const openHazmatFee = (j: JobWithDetails) =>
    setHazmatFeeJob({
      id: j.id,
      jobNumber: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || '—',
      jobName: (j.job_name ?? '').trim() || 'Job',
      jobAddress: (j.job_address ?? '').trim() || '—',
      customerName: (j.customer_name ?? '').trim() || '—',
    })
  const lienToolingSenderFallback = useMemo(() => {
    const job = lienToolingPrefillModal?.job
    const sessionName = authProfileName?.trim() ?? ''
    if (!job?.master_user_id) return sessionName
    const masterRow = users.find((u) => u.id === job.master_user_id)
    return masterRow?.notes?.trim() || masterRow?.name?.trim() || sessionName
  }, [users, lienToolingPrefillModal?.job?.id, lienToolingPrefillModal?.job?.master_user_id, authProfileName])
  const [sendBackJob, setSendBackJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    toStatus: 'working' | 'ready_to_bill'
    rtbDraftCount: number
  } | null>(null)
  const [sendBackInvoice, setSendBackInvoice] = useState<{ inv: InvoiceWithJob; action: 'delete' | 'revert' } | null>(null)
  const [sendBackInvoiceStripeExplainerAfterFailure, setSendBackInvoiceStripeExplainerAfterFailure] = useState(false)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  const [sendBackStatusEventLine, setSendBackStatusEventLine] = useState<string | null>(null)
  const sendBackCollectPaymentNotice = useSendBackCollectPaymentFlowNotice(sendBackJob)
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
  const [stagesFollowMoves, setStagesFollowMoves] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-follow-moves') === 'true'
    } catch {
      return false
    }
  })
  const [stagesIncludeScheduleTimeInSearch, setStagesIncludeScheduleTimeInSearch] = useState(() => {
    try {
      const raw = localStorage.getItem('jobs-stages-search-include-schedule-time')
      if (raw === null) return true
      return raw === 'true'
    } catch {
      return true
    }
  })
  const [assignedEditJobId, setAssignedEditJobId] = useState<string | null>(null)
  const [assignedEditSelectedIds, setAssignedEditSelectedIds] = useState<string[]>([])
  const [assignedEditSavingId, setAssignedEditSavingId] = useState<string | null>(null)
  const [pctCompleteSavingId, setPctCompleteSavingId] = useState<string | null>(null)
  const assignedEditDropdownRef = useRef<HTMLDivElement | null>(null)
  const openStagesDetailJobModal = useCallback(
    (j: JobWithDetails) => {
      const h = (j.hcp_number ?? '').trim() || '—'
      const n = (j.job_name ?? '').trim() || 'Job'
      jobDetailModal?.openJobDetail({
        jobId: j.id,
        prefillRowLabel: `${h} · ${n}`,
        prefillAddress: (j.job_address ?? '').trim() || null,
        onEditJobSaved: () => void loadJobs(),
      })
    },
    [jobDetailModal, loadJobs],
  )

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
          display: 'block',
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
          width: '100%',
        }}
      >
        <span style={{ color: 'inherit', textDecoration: 'inherit' }}>{fmt.line1}</span>
        {fmt.line2 ? (
          <div style={{ fontSize: '0.75rem', color: 'inherit', marginTop: '0.15rem', textDecoration: 'inherit' }}>{fmt.line2}</div>
        ) : null}
      </button>
    )
  }, [openStagesDetailJobModal])

  const stagesBoardLists = useMemo(
    () => buildJobsStagesBoardLists(jobs, stagesSearchQuery, stagesSearchExtraJobIds),
    [jobs, stagesSearchQuery, stagesSearchExtraJobIds],
  )

  const stagesJobsWithoutCustomer = useMemo(
    () => stagesJobsWithoutCustomerFromFiltered(stagesBoardLists.filtered),
    [stagesBoardLists.filtered],
  )

  const stagesWorkingJobsWithoutPictures = useMemo(
    () => stagesWorkingJobsWithoutPicturesFromWorking(stagesBoardLists.working),
    [stagesBoardLists.working],
  )

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
    if (activeTab !== 'stages') {
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
  }, [activeTab, stagesSearchQuery, stagesIncludeScheduleTimeInSearch, jobs, showToast])

  // Stages search should match paid-status jobs too; lazy paid list loads on expand, so prefetch when searching.
  useEffect(() => {
    if (activeTab !== 'stages') return
    if (!stagesSearchQuery.trim()) return
    void fetchPaidJobsIfNeeded(customerFilterForFetch)
  }, [activeTab, stagesSearchQuery, customerFilterForFetch, fetchPaidJobsIfNeeded])

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

  const billedAgingBuckets = useMemo(() => {
    const st = (j: JobWithDetails) => (j.status ?? 'working') as string
    // Aging chips describe the Billed Awaiting Payment section, so parked Collections jobs are excluded.
    const filtered = stagesFilteredJobs.filter((j) => !jobInCollections(j))
    const billedJobsList = filtered.filter((j) => st(j) === 'billed')
    const billedInvoicesList = filtered.flatMap((j) =>
      (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j })),
    )
    const billedRowsAging = buildBilledStageRows(billedJobsList, billedInvoicesList)
    const now = new Date()
    let count30_90 = 0
    let sum30_90 = 0
    let count90 = 0
    let sum90 = 0
    for (const r of billedRowsAging) {
      const iso =
        r.kind === 'job' ? r.job.last_bill_date ?? null : effectiveInvoiceEstBillDate(r.inv, r.job)
      if (!iso) continue
      const days = calendarDaysSinceDateUtc(iso, now)
      if (days < 30) continue
      const amount = stageRowBilledRemainingAmount(r)
      if (amount <= 0) continue
      if (days < 90) {
        count30_90++
        sum30_90 += amount
      } else {
        count90++
        sum90 += amount
      }
    }
    return { count30_90, sum30_90, count90, sum90 }
  }, [stagesFilteredJobs])

  const {
    expandedJobThreadId,
    setExpandedJobThreadId,
    jobThreadActivityByJobId,
    jobThreadNotesLoadingId,
    jobThreadSubmittingId,
    jobThreadDraft,
    setJobThreadDraft,
    submitJobThreadNote,
    submitJobThreadNoteWithBody,
    jobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds,
  } = useJobThreadNotes(showToast, authUser?.id, authProfileName)

  /** Debounce: stagesFilteredJobs changes every Stages search keystroke; avoids overlapping multi-chunk RPC bursts. */
  const THREAD_STATS_STAGES_DEBOUNCE_MS = 320
  useEffect(() => {
    if (!authUser?.id || activeTab !== 'stages') return
    const ids = [...new Set(stagesFilteredJobs.map((j) => j.id))]
    const t = window.setTimeout(() => {
      void refreshJobThreadStatsForJobIds(ids)
    }, THREAD_STATS_STAGES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [authUser?.id, activeTab, stagesFilteredJobs, refreshJobThreadStatsForJobIds])

  // Job Summary expanded rows show the Stages-style Last activity header — stats for expanded ids only.
  useEffect(() => {
    if (!authUser?.id || activeTab !== 'job-summary' || expandedJobSummaryJobIds.size === 0) return
    void refreshJobThreadStatsForJobIds([...expandedJobSummaryJobIds])
  }, [authUser?.id, activeTab, expandedJobSummaryJobIds, refreshJobThreadStatsForJobIds])

  /** True when loaded customers include exactly one row matching name (prefer same master_user_id as the job). */
  function customerListImpliesLinkedRow(customersList: CustomerRow[], jobMasterUserId: string, customerNameTrimmed: string): boolean {
    const nameKey = customerNameTrimmed.trim().toLowerCase()
    if (!nameKey) return false
    const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
    const byMaster = byName.filter((c) => c.master_user_id === jobMasterUserId)
    if (byMaster.length === 1) return true
    if (byMaster.length === 0 && byName.length === 1) return true
    return false
  }

  useEffect(() => {
    return () => {
      if (loadJobsAfterMutationTimerRef.current) {
        clearTimeout(loadJobsAfterMutationTimerRef.current)
        loadJobsAfterMutationTimerRef.current = null
      }
      if (loadJobsFromEffectTimerRef.current) {
        clearTimeout(loadJobsFromEffectTimerRef.current)
        loadJobsFromEffectTimerRef.current = null
      }
    }
  }, [])

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

  function toggleStagesIncludeScheduleTimeInSearch() {
    setStagesIncludeScheduleTimeInSearch((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-search-include-schedule-time', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  /** RPC + loadJobs; not queued — use via `updateJobStatus` or inside `moveJobToReadyToBillWithStripePrep`’s serialized block only. */
  async function executeUpdateJobStatus(
    jobId: string,
    toStatus: 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid',
  ): Promise<boolean> {
    setStagesStatusUpdatingId(jobId)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
      if (err) {
        const { text, variant } = toastForUpdateJobStatusFailure(err.message)
        showToast(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(err.message)) void loadJobs()
        return false
      }
      const result = data as { error?: string } | null
      if (result?.error) {
        const { text, variant } = toastForUpdateJobStatusFailure(result.error)
        showToast(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(result.error)) void loadJobs()
        return false
      }
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: toStatus } : j)))
      followMovedJob(jobId, toStatus)
      scheduleLoadJobsAfterMutation()
      return true
    } finally {
      setStagesStatusUpdatingId(null)
    }
  }

  async function updateJobStatus(jobId: string, toStatus: 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid'): Promise<boolean> {
    return runJobsStagesSerializedPipeline(() => executeUpdateJobStatus(jobId, toStatus))
  }

  /** Void Stripe (or revert non-Stripe) on all billed lines, then move job to Ready to Bill. */
  async function moveJobToReadyToBillWithStripePrep(jobId: string): Promise<boolean> {
    return runJobsStagesSerializedPipeline(async () => {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        setError('Not signed in')
        return false
      }
      const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
        jobId,
        authRole,
        accessToken: token,
      })
      if (!prep.ok) {
        setError(prep.message)
        return false
      }
      return executeUpdateJobStatus(jobId, 'ready_to_bill')
    })
  }

  /** Send back from Billed: void Stripe when needed, else delete billed row (RPC). */
  async function revertBilledInvoiceToReadyToBill(inv: InvoiceWithJob): Promise<boolean> {
    return runJobsStagesSerializedPipeline(async () => {
      if (!invoiceNeedsStripeVoidForRevert(inv)) {
        if (stagesInvoiceMutationLockRef.current === inv.id) return false
        stagesInvoiceMutationLockRef.current = inv.id
        setStagesInvoiceUpdatingId(inv.id)
        setError(null)
        try {
          const data = await withSupabaseRetry(
            async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: inv.id }),
            'delete_billed_invoice_on_send_back',
          )
          const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
          if (!result?.ok) {
            setError(result?.error ?? 'Failed to send back invoice')
            return false
          }
          const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
          if (!sync.ok) {
            setError(sync.message)
            return false
          }
          followMovedJob(inv.job_id, 'ready_to_bill')
          scheduleLoadJobsAfterMutation()
          return true
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Failed to send back invoice')
          return false
        } finally {
          setStagesInvoiceUpdatingId(null)
          if (stagesInvoiceMutationLockRef.current === inv.id) {
            stagesInvoiceMutationLockRef.current = null
          }
        }
      }
      if (stagesInvoiceMutationLockRef.current === inv.id) return false
      stagesInvoiceMutationLockRef.current = inv.id
      setStagesInvoiceUpdatingId(inv.id)
      setError(null)
      try {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          setError('Not signed in')
          return false
        }
        const r = await invokeVoidStripeInvoiceForRevert({
          invoiceId: inv.id,
          stripeModeForBilling: stripeModeForBillingFromRole(authRole),
          accessToken: token,
        })
        if (!r.ok) {
          setError(r.message)
          return false
        }
        const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
        if (!cleaned.ok) {
          setError(cleaned.message)
          return false
        }
        const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
        if (!sync.ok) {
          setError(sync.message)
          return false
        }
        followMovedJob(inv.job_id, 'ready_to_bill')
        scheduleLoadJobsAfterMutation()
        return true
      } finally {
        setStagesInvoiceUpdatingId(null)
        if (stagesInvoiceMutationLockRef.current === inv.id) {
          stagesInvoiceMutationLockRef.current = null
        }
      }
    })
  }

  async function deleteInvoice(invoiceId: string) {
    await runJobsStagesSerializedPipeline(async () => {
      if (stagesInvoiceMutationLockRef.current === invoiceId) return
      stagesInvoiceMutationLockRef.current = invoiceId
      setStagesInvoiceUpdatingId(invoiceId)
      setError(null)
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId }),
          'delete_ready_to_bill_invoice',
        )
        const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        setError(result?.error ?? 'Failed to delete invoice')
        return
      }
      scheduleLoadJobsAfterMutation()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice')
    } finally {
      setStagesInvoiceUpdatingId(null)
      if (stagesInvoiceMutationLockRef.current === invoiceId) {
        stagesInvoiceMutationLockRef.current = null
      }
    }
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

  useEffect(() => {
    if (!assignedEditJobId) return
    function handleClickOutside(e: MouseEvent) {
      if (assignedEditDropdownRef.current && !assignedEditDropdownRef.current.contains(e.target as Node)) {
        setAssignedEditJobId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [assignedEditJobId])

  async function loadUsers() {
    if (!authUser?.id) return
    const [usersRes, meRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role, notes').in('role', ['assistant', 'controller' as 'assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']).order('name'),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const role = (meRes.data as { role?: string } | null)?.role
    setMyRole(role ?? null)
    if (role === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, name, email, role, notes').eq('role', 'dev')
      if (devUsers?.length) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    setUsers(usersList)
  }

  async function loadRoster() {
    if (!authUser?.id) return
    const { data: peopleData } = await supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').is('archived_at', null).order('kind').order('name')
    setPeople((peopleData as Person[]) ?? [])
    await loadUsers()
  }

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

  async function loadTeamLaborData() {
    setTeamLaborLoading(true)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const startDate = twoYearsAgo.toLocaleDateString('en-CA')
    const [crewRes, hoursRes, configRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', startDate),
      supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary'),
    ])
    setTeamLaborLoading(false)
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const hoursRows = (hoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const configRows = (configRes.data ?? []) as Array<{ person_name: string; hourly_wage: number | null; is_salary: boolean }>
    const configMap: Record<string, { hourly_wage: number; is_salary: boolean }> = {}
    for (const c of configRows) configMap[c.person_name] = { hourly_wage: c.hourly_wage ?? 0, is_salary: c.is_salary ?? false }
    const hoursMap: Record<string, number> = {}
    for (const h of hoursRows) hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const jobAgg: Record<string, { people: Set<string>; hoursByPerson: Record<string, number>; costByPerson: Record<string, number> }> = {}
    const jobDetailByPersonDate: Record<string, Record<string, Record<string, { hours: number; cost: number }>>> = {}
    for (const r of crewRows) {
      const assignments = crewByDatePerson[`${r.work_date}:${r.person_name}`]?.job_assignments ?? []
      const cfg = configMap[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        if (!jobAgg[a.job_id]) jobAgg[a.job_id] = { people: new Set(), hoursByPerson: {}, costByPerson: {} }
        const agg = jobAgg[a.job_id]!
        agg.people.add(r.person_name)
        const pctHrs = hours * (a.pct / 100)
        const costPart = pctHrs * rate
        agg.hoursByPerson[r.person_name] = (agg.hoursByPerson[r.person_name] ?? 0) + pctHrs
        agg.costByPerson[r.person_name] = (agg.costByPerson[r.person_name] ?? 0) + costPart
        if (!jobDetailByPersonDate[a.job_id]) jobDetailByPersonDate[a.job_id] = {}
        const byPerson = jobDetailByPersonDate[a.job_id]!
        if (!byPerson[r.person_name]) byPerson[r.person_name] = {}
        const byDate = byPerson[r.person_name]!
        const prev = byDate[r.work_date] ?? { hours: 0, cost: 0 }
        byDate[r.work_date] = { hours: prev.hours + pctHrs, cost: prev.cost + costPart }
      }
    }
    const jobIds = Object.keys(jobAgg)
    if (jobIds.length === 0) {
      setTeamLaborData([])
      return
    }
    const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
    }
    const rows: TeamLaborRow[] = jobIds.map((jobId) => {
      const agg = jobAgg[jobId]!
      const info = jobsMap[jobId] ?? { hcp_number: '', job_name: '', job_address: '' }
      const people = [...agg.people]
      const manHours = Object.values(agg.hoursByPerson).reduce((s, h) => s + h, 0)
      const jobCost = Object.values(agg.costByPerson).reduce((s, c) => s + c, 0)
      const byPersonDate = jobDetailByPersonDate[jobId] ?? {}
      const breakdown: TeamLaborBreakdownEntry[] = people.map((p) => {
        const h = agg.hoursByPerson[p] ?? 0
        const c = agg.costByPerson[p] ?? 0
        const dateMap = byPersonDate[p] ?? {}
        const byWorkDate = Object.keys(dateMap)
          .sort()
          .map((wd) => ({ workDate: wd, hours: dateMap[wd]!.hours, cost: dateMap[wd]!.cost }))
        return { personName: p, hours: h, cost: c, byWorkDate }
      })
      return { jobId, hcpNumber: info.hcp_number, jobName: info.job_name, jobAddress: info.job_address, people, manHours, jobCost, breakdown }
    })
    setTeamLaborData(rows)
  }

  function printJobSubSheet(job: LaborJob) {
    openHtmlPrintWindow(buildJobSubSheetHtml(job))
  }

  async function printJobSummaryCostBreakdown(opts: {
    job: JobWithDetails
    teamLaborRow: TeamLaborRow | null
    teamLaborCost: number
    subLaborJobs: LaborJob[]
    partsFromTally: number
    billedMaterialsSum: number
    invoicesFromSupplyHouses: number
    cardCharges: number
    totalBill: number
    profit: number
    tallyPartsForJob: TallyPartRow[]
    mileageCost: number
    timePerMile: number
  }) {
    const jobId = opts.job.id

    let invoiceRows: JobSummaryInvoiceAllocationLine[] = []
    let invoiceDetailUnavailable = false
    if (jobSummaryInvoiceLinesByJobId.has(jobId)) {
      invoiceRows = jobSummaryInvoiceLinesByJobId.get(jobId) ?? []
    } else {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase.rpc('get_invoice_allocation_lines_for_jobs', { p_job_ids: [jobId] }),
          'job summary print invoice lines',
        )
        invoiceRows = (data ?? []) as JobSummaryInvoiceAllocationLine[]
      } catch {
        invoiceDetailUnavailable = true
        invoiceRows = []
      }
    }

    let mRows: JobSummaryMercuryAllocationRow[] = []
    let cardDetailUnavailable = false
    if (jobSummaryMercuryAllocationsByJobId.has(jobId)) {
      mRows = jobSummaryMercuryAllocationsByJobId.get(jobId) ?? []
    } else {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('mercury_transaction_job_allocations')
              .select(
                'id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, note, external_memo, raw)',
              )
              .eq('job_id', jobId)
              .order('created_at', { ascending: true }),
          'job summary print mercury allocations',
        )
        const rawRows = (data ?? []) as Array<
          Omit<JobSummaryMercuryAllocationRow, 'attributionDisplayName'> & { mercury_transaction_id: string }
        >
        const attrByTxId = new Map<string, { person_id: string | null; user_id: string | null }>()
        const personNameById = new Map<string, string>()
        const userNameById = new Map<string, string>()
        try {
          const txIds = [...new Set(rawRows.map((r) => r.mercury_transaction_id))]
          if (txIds.length > 0) {
            const attrRows = await fetchAttributionsByMercuryTxIds(txIds, 'job summary print mercury')
            for (const a of attrRows) {
              attrByTxId.set(a.mercury_transaction_id, {
                person_id: a.person_id,
                user_id: a.user_id,
              })
            }
            const personIds = new Set<string>()
            const userIds = new Set<string>()
            for (const a of attrRows) {
              if (a.person_id) personIds.add(a.person_id)
              if (a.user_id) userIds.add(a.user_id)
            }
            if (personIds.size > 0) {
              const peopleData = await withSupabaseRetry(
                async () => supabase.from('people').select('id, name').in('id', [...personIds]),
                'job summary print mercury attribution people',
              )
              for (const p of peopleData ?? []) {
                const row = p as { id: string; name: string }
                personNameById.set(row.id, row.name)
              }
            }
            if (userIds.size > 0) {
              const usersData = await withSupabaseRetry(
                async () => supabase.from('users').select('id, name').in('id', [...userIds]),
                'job summary print mercury attribution users',
              )
              for (const u of usersData ?? []) {
                const row = u as { id: string; name: string }
                userNameById.set(row.id, row.name)
              }
            }
          }
        } catch {
          /* attribution optional */
        }
        mRows = rawRows.map((r) => {
          const attr = attrByTxId.get(r.mercury_transaction_id)
          let attributionDisplayName: string | null = null
          if (attr) {
            if (attr.person_id) attributionDisplayName = personNameById.get(attr.person_id) ?? null
            else if (attr.user_id) attributionDisplayName = userNameById.get(attr.user_id) ?? null
          }
          return {
            id: r.id,
            mercury_transaction_id: r.mercury_transaction_id,
            amount: r.amount,
            note: r.note,
            mercury_transactions: r.mercury_transactions,
            attributionDisplayName,
          }
        })
      } catch {
        cardDetailUnavailable = true
        mRows = []
      }
    }

    const html = buildJobSummaryCostBreakdownHtml({
      ...opts,
      invoiceRows,
      invoiceDetailUnavailable,
      mercuryRows: mRows,
      cardDetailUnavailable,
      clockSessions: jobSummaryClockSessionsByJobId.get(jobId) ?? [],
      clockSessionsLoaded: jobSummaryClockSessionsByJobId.has(jobId),
      nicknameByDebitCard,
    })
    if (!openHtmlPrintWindow(html)) {
      showToast('Allow pop-ups to print the cost breakdown.', 'error')
      return
    }
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

  const shouldLoadJobsListForActiveTab =
    activeTab === 'stages' || activeTab === 'billing' || activeTab === 'parts'

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    loadUsers()
    if (!shouldLoadJobsListForActiveTab) return
    if (loadJobsFromEffectTimerRef.current) {
      clearTimeout(loadJobsFromEffectTimerRef.current)
    }
    loadJobsFromEffectTimerRef.current = setTimeout(() => {
      loadJobsFromEffectTimerRef.current = null
      void loadJobs()
    }, LOAD_JOBS_FROM_EFFECT_DEBOUNCE_MS)
    return () => {
      if (loadJobsFromEffectTimerRef.current) {
        clearTimeout(loadJobsFromEffectTimerRef.current)
        loadJobsFromEffectTimerRef.current = null
      }
    }
  }, [authUser?.id, authLoading, customerParamForJobsReload, activeTab, loadJobs, shouldLoadJobsListForActiveTab])

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    if (!shouldLoadJobsListForActiveTab) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      void runFetchJobs(customerFilterForFetch, { kind: 'visibility' })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authUser?.id, authLoading, activeTab, customerFilterForFetch, runFetchJobs, shouldLoadJobsListForActiveTab])

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    const needCustomers = Boolean(jobFormModal?.isOpen) || activeTab === 'stages' || activeTab === 'billing'
    if (!needCustomers) return
    ;(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
        .order('name')
      // Feeds link-implication for NEW customer links — archived excluded.
      setCustomers(filterActiveCustomersForPicker((data as CustomerRow[]) ?? []))
    })()
  }, [jobFormModal?.isOpen, authUser?.id, authLoading, activeTab])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const editJobId = searchParams.get('edit')
    const editLaborHcp = searchParams.get('editLabor')
    const isPrimary = authRole === 'primary' || myRole === 'primary'
    const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
    // When edit=jobId is present, force Stages tab so jobs load
    if (editJobId) {
      setActiveTab('stages')
      if (tab !== 'stages') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'stages')
          return next
        }, { replace: true })
      }
      return
    }
    // When editLabor=hcp is present, force Sub Sheet Ledger tab so labor jobs load
    if (editLaborHcp) {
      setActiveTab('sub_sheet_ledger')
      if (tab !== 'sub_sheet_ledger') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'sub_sheet_ledger')
          return next
        }, { replace: true })
      }
      return
    }
    // When editParts=jobId is present, force Parts tab so tally parts load
    const editPartsJobId = searchParams.get('editParts')
    if (editPartsJobId) {
      setActiveTab('parts')
      if (tab !== 'parts') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'parts')
          return next
        }, { replace: true })
      }
      return
    }
    // When openBankPayments is present, force Stages tab so AR deep link can open the modal
    const openBankPaymentsWant = searchParams.get('openBankPayments') === 'true' || searchParams.get('openBankPayments') === '1'
    if (openBankPaymentsWant && canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
      setActiveTab('stages')
      if (tab !== 'stages') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'stages')
          return next
        }, { replace: true })
      }
      return
    }
    // Redirect old receivables URLs to reports
    if (tab === 'receivables') {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Redirect old ledger URLs to billing
    if (tab === 'ledger') {
      setActiveTab('billing')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'billing')
        return next
      }, { replace: true })
      return
    }
    // Redirect assistants away from Team Labor tab
    const isAssistant = authRole === 'assistant' || myRole === 'assistant'
    if (isAssistant && tab === 'combined-labor') {
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
        return next
      }, { replace: true })
      return
    }
    // Redirect masters/assistants away from Teams tab
    const isMasterOrAssistant = authRole === 'master_technician' || isAssistantLike(authRole) || myRole === 'master_technician' || isAssistantLike(myRole)
    if (isMasterOrAssistant && tab === 'teams-summary') {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Redirect superintendent away from Team Labor and Teams tabs
    if (isSuperintendent && (tab === 'combined-labor' || tab === 'teams-summary')) {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Superintendent: reports, sub_sheet_ledger only; default reports
    if (isSuperintendent) {
      const superintendentTabs = ['reports', 'sub_sheet_ledger']
      if (tab && superintendentTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (!tab || !superintendentTabs.includes(tab)) {
        setActiveTab('reports')
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'reports')
          return next
        }, { replace: true })
      }
      return
    }
    // Only primaries default to Reports; primaries only see Reports tab (Billing hidden)
    if (isPrimary) {
      const primaryTabs = ['reports']
      if (tab && primaryTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (!tab || !primaryTabs.includes(tab)) {
        setActiveTab('reports')
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'reports')
          return next
        }, { replace: true })
      }
      return
    }
    if (tab === 'labor') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'sub_sheet_ledger')
        return next
      }, { replace: true })
      setActiveTab('sub_sheet_ledger')
    } else if (tab === 'billed') {
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
        return next
      }, { replace: true })
    } else if (tab && JOBS_TABS.includes(tab as JobsTab)) {
      setActiveTab(tab as JobsTab)
    } else if (!tab) {
      // Default to Stages
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
        return next
      }, { replace: true })
    }
  }, [searchParams, myRole, authRole])

  useEffect(() => {
    const newJob = searchParams.get('newJob') === 'true'
    const tab = searchParams.get('tab')
    if (newJob && (tab === 'sub_sheet_ledger' || tab === 'labor')) {
      setActiveTab('sub_sheet_ledger')
      subLaborFormRef.current?.open()
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        if (tab === 'labor') next.set('tab', 'sub_sheet_ledger')
        return next
      }, { replace: true })
    } else if (newJob && (tab === 'billing' || tab === 'stages' || !tab)) {
      if (jobsListLoading || jobsListRefreshing) return
      const projectParam = searchParams.get('project')
      setActiveTab(tab === 'billing' ? 'billing' : 'stages')
      jobFormModal?.openNewJob({
        projectId: projectParam,
        onSaved: () => {
          void loadJobs()
        },
      })
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        next.delete('project')
        if (!next.get('tab')) next.set('tab', 'stages')
        return next
      }, { replace: true })
    }
  }, [searchParams, jobsListLoading, jobsListRefreshing, jobFormModal, loadJobs])

  // When edit=jobId is in URL, open the global job form modal
  const editJobId = searchParams.get('edit')
  useEffect(() => {
    if (!editJobId || jobsListLoading || jobsListRefreshing) return
    const job = jobs.find((j) => j.id === editJobId)
    tryOpenEditJob(editJobId, {
      initialJob: job,
      onSaved: () => {
        void loadJobs()
      },
    })
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('edit')
      return next
    }, { replace: true })
  }, [editJobId, jobs, jobsListLoading, jobsListRefreshing, tryOpenEditJob, loadJobs, setSearchParams])

  const jobDetailId = searchParams.get('jobDetail')
  useEffect(() => {
    if (!jobDetailId || !jobDetailModal) return
    const job = jobs.find((j) => j.id === jobDetailId)
    const prefill = (location.state as JobDetailPrefillLocationState | null)?.jobDetailPrefill
    if (job) {
      jobDetailModal.openJobDetail({
        jobId: job.id,
        prefillRowLabel: `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`,
        prefillAddress: (job.job_address ?? '').trim() || null,
        onEditJobSaved: () => void loadJobs(),
      })
    } else {
      jobDetailModal.openJobDetail({
        jobId: jobDetailId,
        prefillRowLabel: prefill?.prefillRowLabel ?? null,
        prefillAddress: prefill?.prefillAddress ?? null,
        onEditJobSaved: () => void loadJobs(),
      })
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('jobDetail')
      return next
    }, { replace: true })
    navigate('.', { replace: true, state: {} })
  }, [jobDetailId, jobs, jobDetailModal, loadJobs, setSearchParams, navigate, location.state])

  const openBankPaymentsParam = searchParams.get('openBankPayments')
  useEffect(() => {
    const wantsOpen = openBankPaymentsParam === 'true' || openBankPaymentsParam === '1'
    if (!wantsOpen) return

    const stripOpenBankPaymentsParam = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('openBankPayments')
          return next
        },
        { replace: true },
      )
    }

    if (!canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
      stripOpenBankPaymentsParam()
      return
    }
    if (activeTab !== 'stages') {
      stripOpenBankPaymentsParam()
      return
    }
    setBankPaymentsModalOpen(true)
    stripOpenBankPaymentsParam()
  }, [openBankPaymentsParam, authRole, activeTab, setSearchParams])

  // When editLabor=hcp is in URL and labor jobs are loaded, open edit or new labor modal
  const editLaborHcp = searchParams.get('editLabor')
  useEffect(() => {
    if (!editLaborHcp || laborJobsLoading) return
    const hcpLower = editLaborHcp.trim().toLowerCase()
    const laborJob = laborJobs.find((j) => (j.job_number ?? '').trim().toLowerCase() === hcpLower)
    if (laborJob) {
      subLaborFormRef.current?.openEdit(laborJob)
    } else {
      subLaborFormRef.current?.openNewWithJobNumber(editLaborHcp.trim())
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('editLabor')
      return next
    }, { replace: true })
  }, [editLaborHcp, laborJobs, laborJobsLoading])

  // When editParts=jobId is in URL and tally parts are loaded, expand job and scroll to it
  const editPartsJobId = searchParams.get('editParts')
  useEffect(() => {
    if (!editPartsJobId || tallyPartsLoading) return
    setActiveTab('parts')
    setExpandedPartsJobIds((prev) => new Set(prev).add(editPartsJobId))
    setTallyPartsSearch('')
    setPendingScrollToPartsJobId(editPartsJobId)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('editParts')
      next.set('tab', 'parts') // Keep Parts tab when clearing editParts
      return next
    }, { replace: true })
  }, [editPartsJobId, tallyPartsLoading])

  // Scroll to job row when it has been expanded for editParts
  useEffect(() => {
    if (!pendingScrollToPartsJobId || !expandedPartsJobIds.has(pendingScrollToPartsJobId)) return
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-job-id="${pendingScrollToPartsJobId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingScrollToPartsJobId(null)
    }, 100)
    return () => clearTimeout(timer)
  }, [pendingScrollToPartsJobId, expandedPartsJobIds])

  const applyStagesInvoiceFocus = useCallback(
    (invoiceId: string): boolean => {
      const raw = invoiceId.trim()
      if (!raw) return false
      const { readyToBillRows, billedRows } = buildJobsStagesBoardLists(
        jobs,
        stagesSearchQuery,
        stagesSearchExtraJobIds,
      )
      const section = locateStagesInvoiceSection(raw, readyToBillRows, billedRows)
      if (section == null) {
        if (stagesInvoiceVisibleWithEmptySearch(raw, jobs)) {
          showToast('Clear the Stages search to see this invoice.', 'info')
        } else {
          showToast('That invoice isn’t on the Stages board right now.', 'info')
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

  const stagesInvoiceParam = searchParams.get('stagesInvoice')
  useEffect(() => {
    const raw = stagesInvoiceParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    applyStagesInvoiceFocus(raw)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesInvoice')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesInvoiceParam, jobsListLoading, activeTab, applyStagesInvoiceFocus, setSearchParams])

  // ?stagesSection=waiting|working|readyToBill|billed|collections — deep link that opens + scrolls
  // to a Stages section (e.g. from the Dashboard Financials drill-downs), then strips itself.
  const stagesSectionParam = searchParams.get('stagesSection')
  useEffect(() => {
    const raw = stagesSectionParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    if (raw === 'waiting' || raw === 'working' || raw === 'readyToBill' || raw === 'billed' || raw === 'collections') {
      focusStagesSection(raw)
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesSection')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesSectionParam, jobsListLoading, activeTab, focusStagesSection, setSearchParams])

  // ?stagesJob=<jobId> — deep link (Job Detail / Edit Job trade-pill shortcut) that opens
  // the job's Stages section, scrolls to + flashes the job row, then strips itself.
  const stagesJobParam = searchParams.get('stagesJob')
  useEffect(() => {
    const raw = stagesJobParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    const job = jobs.find((j) => j.id === raw)
    if (job) {
      const section = stagesSectionKeyForJobStatus(job.status)
      if (section) setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
      setPendingStagesJobFocusId(raw)
      setStagesJobFlashId(raw)
    } else {
      showToast('That job isn’t on the Stages board right now.', 'info')
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesJob')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesJobParam, jobsListLoading, activeTab, jobs, showToast, setSearchParams])

  useEffect(() => {
    if (activeTab !== 'stages') {
      setReturnEditBannerJobId(null)
      clearReturnEditJobFromStages()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'stages' || jobsListLoading) return
    const tabParam = searchParams.get('tab')
    const urlWantsStages = tabParam == null || tabParam === 'stages' || tabParam === 'billed'
    if (!urlWantsStages) return
    const id = peekReturnEditJobFromStages()
    if (id) setReturnEditBannerJobId(id)
  }, [activeTab, jobsListLoading, searchParams])

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
    if (activeTab === 'sub_sheet_ledger') {
      const t = setTimeout(() => loadRoster(), 80)
      return () => clearTimeout(t)
    }
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if (activeTab === 'stages' && searchParams.get('showBilledTotalByName') === 'true') {
      setBilledTotalByNameModalOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('showBilledTotalByName')
        return next
      }, { replace: true })
    }
  }, [activeTab, searchParams, setSearchParams])

  useEffect(() => {
    if (!billedTotalByNameModalOpen) setBilledTotalByNameExpandedName(null)
  }, [billedTotalByNameModalOpen])

  useEffect(() => {
    if ((activeTab === 'billing' || activeTab === 'sub_sheet_ledger' || activeTab === 'combined-labor' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadLaborJobs(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((activeTab === 'combined-labor' || activeTab === 'billing' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadTeamLaborData(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if (activeTab === 'stages' && authUser?.id) {
      const t = setTimeout(() => void loadStagesManHours(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if (activeTab !== 'job-summary' || !authUser?.id) return
    const expandedKeys = [...jobSummaryTeamLaborPersonExpandedKeys]
    for (const jobId of expandedJobSummaryJobIds) {
      const prefix = `${jobId}::`
      if (!expandedKeys.some((k) => k.startsWith(prefix))) continue
      if (jobSummaryClockSessionsLoadedRef.current.has(jobId)) continue
      void (async () => {
        try {
          const data = await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select(CLOCK_SESSION_LIST_SELECT)
                .eq('job_ledger_id', jobId)
                .order('clocked_in_at', { ascending: true }),
            'job summary clock sessions',
          )
          const raw = (data ?? []) as JobSummaryClockSessionRow[]
          const filtered = raw.filter((s) => !s.revoked_at)
          setJobSummaryClockSessionsByJobId((prev) => {
            const next = new Map(prev)
            next.set(jobId, filtered)
            return next
          })
        } catch {
          setJobSummaryClockSessionsByJobId((prev) => {
            const next = new Map(prev)
            next.set(jobId, [])
            return next
          })
        } finally {
          jobSummaryClockSessionsLoadedRef.current.add(jobId)
        }
      })()
    }
  }, [activeTab, authUser?.id, expandedJobSummaryJobIds, jobSummaryTeamLaborPersonExpandedKeys])

  useEffect(() => {
    if (activeTab !== 'job-summary') return
    for (const jobId of expandedJobSummaryJobIds) {
      if ((mercuryCardChargesByJobId.get(jobId) ?? 0) > 0) {
        void loadJobSummaryMercuryAllocationsForJob(jobId)
      }
    }
  }, [activeTab, expandedJobSummaryJobIds, mercuryCardChargesByJobId, loadJobSummaryMercuryAllocationsForJob])

  useEffect(() => {
    if (activeTab !== 'job-summary') return
    for (const jobId of expandedJobSummaryJobIds) {
      if ((invoiceAmountByJob[jobId] ?? 0) > 0) {
        void loadJobSummaryInvoiceLinesForJob(jobId)
      }
    }
  }, [activeTab, expandedJobSummaryJobIds, invoiceAmountByJob, loadJobSummaryInvoiceLinesForJob])

  useEffect(() => {
    if (activeTab !== 'job-summary') return
    for (const jobId of expandedJobSummaryJobIds) {
      void loadJobSummaryReportsForJob(jobId)
    }
  }, [activeTab, expandedJobSummaryJobIds, loadJobSummaryReportsForJob])

  useEffect(() => {
    if (activeTab !== 'job-summary' || !jobSummaryLedgerJobs) return
    const missing = jobSummaryLedgerJobs
      .map((j) => j.id)
      .filter((id) => !jobSummaryReportPctRequestedRef.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) jobSummaryReportPctRequestedRef.current.add(id)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('list_latest_report_completion_pct', { p_job_ids: missing }),
          'job summary report completion pct',
        )
        const rows = (data ?? []) as Array<{ job_ledger_id: string; pct: number }>
        if (rows.length === 0) return
        setJobSummaryReportPctByJobId((prev) => {
          const next = new Map(prev)
          for (const r of rows) next.set(r.job_ledger_id, r.pct)
          return next
        })
      } catch {
        // Column falls back to jobs_ledger.pct_complete; un-mark so a later visit retries.
        for (const id of missing) jobSummaryReportPctRequestedRef.current.delete(id)
      }
    })()
  }, [activeTab, jobSummaryLedgerJobs])

  useEffect(() => {
    if (activeTab !== 'job-summary' || !authUser?.id) return
    const t = setTimeout(() => {
      void loadJobSummaryLedger()
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab, authUser?.id, loadJobSummaryLedger])

  useEffect(() => {
    if (activeTab !== 'job-summary') return
    const q = searchParams.get('jobSummaryHcp')?.trim()
    if (q) setJobSummarySearch(q)
  }, [activeTab, searchParams])

  useEffect(() => {
    if (authUser?.id) return
    setJobSummaryLedgerAllJobs(null)
    setJobSummaryLedgerError(null)
    jobSummaryLedgerSnapshotLoadedRef.current = false
  }, [authUser?.id])

  const jobListForCardCharges = useMemo(
    () => (activeTab === 'job-summary' && jobSummaryLedgerJobs !== null ? jobSummaryLedgerJobs : jobs),
    [activeTab, jobSummaryLedgerJobs, jobs],
  )
  const jobIdsKeyForCardCharges = useMemo(
    () => jobListForCardCharges.map((j) => j.id).sort().join(','),
    [jobListForCardCharges],
  )

  useEffect(() => {
    if (jobListForCardCharges.length === 0) {
      setMercuryCardChargesByJobId(new Map())
      return
    }
    const ids = jobListForCardCharges.map((j) => j.id)
    void withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_job_allocations').select('job_id, amount').in('job_id', ids),
      'mercury card charges by job',
    )
      .then((rows) => {
        const m = new Map<string, number>()
        for (const row of rows ?? []) {
          const jid = row.job_id
          m.set(jid, (m.get(jid) ?? 0) + Math.abs(Number(row.amount)))
        }
        setMercuryCardChargesByJobId(m)
      })
      .catch(() => setMercuryCardChargesByJobId(new Map()))
  }, [jobIdsKeyForCardCharges])

  const loadPartsTabMercuryForJob = useCallback(async (jobId: string) => {
    if (partsTabMercuryLoadedRef.current.has(jobId) || partsTabMercuryInFlightRef.current.has(jobId)) {
      return
    }
    partsTabMercuryInFlightRef.current.add(jobId)
    try {
      const rows = await fetchMercuryJobAllocationsWithAttributionForJob(jobId, 'parts tab')
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.set(jobId, rows)
        return n
      })
    } catch {
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.set(jobId, [])
        return n
      })
    } finally {
      partsTabMercuryInFlightRef.current.delete(jobId)
      partsTabMercuryLoadedRef.current.add(jobId)
    }
  }, [])

  const refreshPartsTabMercuryForJob = useCallback(
    (jobId: string) => {
      partsTabMercuryLoadedRef.current.delete(jobId)
      partsTabMercuryInFlightRef.current.delete(jobId)
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.delete(jobId)
        return n
      })
      void loadPartsTabMercuryForJob(jobId)
    },
    [loadPartsTabMercuryForJob],
  )

  const updateMercuryCardTotalForOneJob = useCallback((jobId: string) => {
    void withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_job_allocations').select('amount').eq('job_id', jobId),
      'mercury card charges for one job (parts refresh)',
    )
      .then((rows) => {
        const sum = (rows ?? []).reduce((a, r) => a + Math.abs(Number(r.amount)), 0)
        setMercuryCardChargesByJobId((m) => {
          const n = new Map(m)
          n.set(jobId, sum)
          return n
        })
      })
      .catch(() => {})
  }, [])

  const dismissPartsUnattributedList = useCallback(() => {
    setPartsUnattribListJobId(null)
    partsUnattribFlowJobIdRef.current = null
  }, [])

  const closeListOnlyForAssign = useCallback(() => {
    setPartsUnattribListJobId(null)
  }, [])

  const closeAllJobsListForAssign = useCallback(() => {
    setAllJobsUnattributedOpen(false)
  }, [])

  const handleAssignToTransactionFromParts = useCallback(
    async (mercuryTransactionId: string, jobIdForFlow?: string | null) => {
      jobSummaryMercuryEditFlowJobIdRef.current = null
      if (jobIdForFlow) partsUnattribFlowJobIdRef.current = jobIdForFlow
      const data = await loadMercuryAllocModalDataForTransaction(
        mercuryTransactionId,
        'Parts tab: open Mercury allocation',
      )
      setPartsAllocModalData(data)
      setPartsAllocModalOpen(true)
    },
    [],
  )

  const handleJobSummaryMercuryReassignFromDrilldown = useCallback(
    async (mercuryTransactionId: string, sourceJobId: string) => {
      partsUnattribFlowJobIdRef.current = null
      jobSummaryMercuryEditFlowJobIdRef.current = sourceJobId
      setJobSummaryCostDrilldown(null)
      try {
        const data = await loadMercuryAllocModalDataForTransaction(
          mercuryTransactionId,
          'Job Summary: edit Mercury allocation',
        )
        setPartsAllocModalData(data)
        setPartsAllocModalOpen(true)
      } catch (e) {
        jobSummaryMercuryEditFlowJobIdRef.current = null
        showToast(e instanceof Error ? e.message : 'Could not load allocation', 'error')
      }
    },
    [showToast],
  )

  const closePartsAllocModal = useCallback(() => {
    setPartsAllocModalOpen(false)
    setPartsAllocModalData(null)
    partsUnattribFlowJobIdRef.current = null
    jobSummaryMercuryEditFlowJobIdRef.current = null
  }, [])

  const partsUnattributedJobLabelById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const j of jobs) {
      const h = (j.hcp_number ?? '').trim() || '—'
      const n = (j.job_name ?? '').trim() || '—'
      m[j.id] = `${h} · ${n}`
    }
    return m
  }, [jobs])

  const partsUnattributedScopeJobIds = useMemo(() => {
    const ids: string[] = []
    for (const j of jobs) {
      if ((mercuryCardChargesByJobId.get(j.id) ?? 0) <= 0) continue
      if (showMyJobsOnly && myJobIds && !myJobIds.has(j.id)) continue
      ids.push(j.id)
    }
    return ids
  }, [jobs, mercuryCardChargesByJobId, showMyJobsOnly, myJobIds])

  const refetchAllJobsUnattributedData = useCallback(async () => {
    setAllJobsUnattributedLines(null)
    setAllJobsUnattributedLoading(true)
    if (partsUnattributedScopeJobIds.length === 0) {
      setAllJobsUnattributedLines([])
      setAllJobsUnattributedLoading(false)
      return
    }
    try {
      const lines = await fetchUnattributedMercuryLinesForManyJobs({
        jobIds: partsUnattributedScopeJobIds,
        jobLabelById: partsUnattributedJobLabelById,
        cacheByJobId: partsTabMercuryAllocationsByJobId,
        operationLabel: 'Parts tab: all jobs unattributed',
        concurrency: 5,
      })
      setAllJobsUnattributedLines(lines)
    } catch {
      setAllJobsUnattributedLines([])
    } finally {
      setAllJobsUnattributedLoading(false)
    }
  }, [partsUnattributedScopeJobIds, partsUnattributedJobLabelById, partsTabMercuryAllocationsByJobId])

  const onPartsAllocSaved = useCallback(
    (detail: MercuryAllocSavedDetail) => {
      const jobSummarySourceJobId = jobSummaryMercuryEditFlowJobIdRef.current
      const partsJobId = partsUnattribFlowJobIdRef.current
      jobSummaryMercuryEditFlowJobIdRef.current = null
      partsUnattribFlowJobIdRef.current = null

      setPartsAllocModalOpen(false)
      setPartsAllocModalData(null)
      setPartsUnattribListJobId(null)

      if (jobSummarySourceJobId) {
        setJobSummaryCostDrilldown(null)
        const touchJobSummaryMercury = (jid: string) => {
          jobSummaryMercuryAllocationsLoadedRef.current.delete(jid)
          void loadJobSummaryMercuryAllocationsForJob(jid, true)
          updateMercuryCardTotalForOneJob(jid)
        }
        touchJobSummaryMercury(jobSummarySourceJobId)
        const seen = new Set<string>([jobSummarySourceJobId])
        for (const a of detail.allocations) {
          if (!seen.has(a.job_id)) {
            seen.add(a.job_id)
            touchJobSummaryMercury(a.job_id)
          }
        }
      }

      if (partsJobId) {
        refreshPartsTabMercuryForJob(partsJobId)
        updateMercuryCardTotalForOneJob(partsJobId)
      }
      if (allJobsUnattributedOpen) {
        void refetchAllJobsUnattributedData()
      }
    },
    [
      refreshPartsTabMercuryForJob,
      updateMercuryCardTotalForOneJob,
      allJobsUnattributedOpen,
      refetchAllJobsUnattributedData,
      loadJobSummaryMercuryAllocationsForJob,
    ],
  )

  const partsUnattribBankingUsersForMatch = useMemo((): BankingAttributionUser[] => {
    return bankingAttributionUsersOptions
      .filter(isSelectableOption)
      .filter((o) => o.value.trim() !== '')
      .map((o) => ({ id: o.value, name: o.label }))
  }, [bankingAttributionUsersOptions])

  const handleQuickAddUserFromParts = useCallback(
    async (mercuryTransactionId: string, user: BankingAttributionUser, jobIdForFlow?: string | null) => {
      const jobId = jobIdForFlow ?? partsUnattribFlowJobIdRef.current
      if (jobIdForFlow) partsUnattribFlowJobIdRef.current = jobIdForFlow
      if (!jobId) return
      await mercuryQuickAssignUserAttribution({
        mercuryTransactionId,
        userId: user.id,
        operationLabel: 'Parts tab: quick assign from card nickname',
        recentPersonPicksStorageKey: authUser?.id ?? null,
      })
      showToast('Saved allocations.', 'success')
      refreshPartsTabMercuryForJob(jobId)
      updateMercuryCardTotalForOneJob(jobId)
      if (allJobsUnattributedOpen) {
        void refetchAllJobsUnattributedData()
      }
    },
    [
      authUser?.id,
      showToast,
      refreshPartsTabMercuryForJob,
      updateMercuryCardTotalForOneJob,
      allJobsUnattributedOpen,
      refetchAllJobsUnattributedData,
    ],
  )

  useEffect(() => {
    if (activeTab !== 'parts') setAllJobsUnattributedOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (!allJobsUnattributedOpen || activeTab !== 'parts') return
    void refetchAllJobsUnattributedData()
  }, [allJobsUnattributedOpen, activeTab, refetchAllJobsUnattributedData])

  useEffect(() => {
    if (!canAccessBankingForParts) {
      setBankingAttributionUsersOptions([])
      return
    }
    void loadUsersOptionsForBankingAttribution().then(setBankingAttributionUsersOptions)
  }, [canAccessBankingForParts])

  useEffect(() => {
    if (activeTab !== 'parts') return
    for (const jobId of expandedPartsJobIds) {
      if ((mercuryCardChargesByJobId.get(jobId) ?? 0) === 0) continue
      if (partsTabMercuryLoadedRef.current.has(jobId)) continue
      void loadPartsTabMercuryForJob(jobId)
    }
  }, [activeTab, expandedPartsJobIds, mercuryCardChargesByJobId, loadPartsTabMercuryForJob])

  // Fetch job IDs where current user is a team member (for "show my jobs only" filter)
  useEffect(() => {
    if (activeTab === 'parts' && authUser?.id) {
      supabase
        .from('jobs_ledger_team_members')
        .select('job_id')
        .eq('user_id', authUser.id)
        .then(({ data }) => setMyJobIds(new Set((data ?? []).map((r) => r.job_id))))
    }
  }, [activeTab, authUser?.id])

  async function loadDriveSettings() {
    if (!authUser?.id) return
    const { data: rows } = await supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile'])
    const byKey = new Map((rows ?? []).map((r) => [r.key, r.value_num]))
    setDriveMileageCost(byKey.get('drive_mileage_cost') ?? null)
    setDriveTimePerMile(byKey.get('drive_time_per_mile') ?? null)
  }

  useEffect(() => {
    if ((activeTab === 'sub_sheet_ledger' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadDriveSettings(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  async function saveDriveSettings(e: React.FormEvent) {
    e.preventDefault()
    setDriveSettingsSaving(true)
    setError(null)
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    const { error: err } = await supabase.from('app_settings').upsert(
      [
        { key: 'drive_mileage_cost', value_num: mileageCost },
        { key: 'drive_time_per_mile', value_num: timePerMile },
      ],
      { onConflict: 'key' }
    )
    setDriveSettingsSaving(false)
    if (err) setError(err.message)
    else setDriveSettingsOpen(false)
  }

  async function loadDefaultLaborRate() {
    const { data } = await supabase.from('app_settings').select('value_num').eq('key', 'default_labor_rate').maybeSingle()
    const val = (data as { value_num: number | null } | null)?.value_num
    setDefaultLaborRateValue(val != null ? String(val) : '')
  }

  async function saveDefaultLaborRate(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') {
      setError('Only devs can change the default labor rate.')
      return
    }
    setDefaultLaborRateSaving(true)
    setError(null)
    const val = defaultLaborRateValue.trim() === '' ? null : parseFloat(defaultLaborRateValue) || null
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'default_labor_rate', value_num: val }, { onConflict: 'key' })
    setDefaultLaborRateSaving(false)
    if (err) setError(err.message)
    else setDefaultLaborRateModalOpen(false)
  }



  const laborJobHcps = useMemo(
    () => new Set(laborJobs.map((j) => (j.job_number ?? '').trim().toLowerCase()).filter(Boolean)),
    [laborJobs]
  )

  const teamLaborJobIds = useMemo(
    () => new Set(teamLaborData.map((r) => r.jobId)),
    [teamLaborData]
  )

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

  // Crew P&L math lives in src/lib/crewPnlSummary.ts; the tab component owns its own state.

  const jobSummaryData = useMemo(() => {
    const sourceJobs =
      activeTab === 'job-summary' ? (jobSummaryLedgerJobs !== null ? jobSummaryLedgerJobs : []) : jobs
    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }
    const laborCostByHcp = new Map<string, number>()
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    for (const job of laborJobs) {
      const hcp = (job.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const laborCost = laborJobSubCost(job, mileageCost, timePerMile)
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }
    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of teamLaborData) {
      teamLaborCostByJobId.set(r.jobId, r.jobCost)
    }
    return sourceJobs
      .map((job) => {
        const hcp = (job.hcp_number ?? '').trim().toLowerCase()
        const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
        const teamLaborCost = teamLaborCostByJobId.get(job.id) ?? 0
        const laborCost = subLaborCost + teamLaborCost
        const partsFromTally = partsCostByJobId.get(job.id) ?? 0
        const invoicesFromSupplyHouses = invoiceAmountByJob[job.id] ?? 0
        const billedMaterialsSum = (job.materials ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0)
        const cardCharges = mercuryCardChargesByJobId.get(job.id) ?? 0
        const partsCost = partsFromTally + invoicesFromSupplyHouses + billedMaterialsSum + cardCharges
        const totalBill = job.revenue != null ? Number(job.revenue) : 0
        const profit = totalBill - partsCost - laborCost
        const teamLaborRow = teamLaborData.find((r) => r.jobId === job.id)
        const subLaborJobs = hcp ? laborJobs.filter((lj) => (lj.job_number ?? '').trim().toLowerCase() === hcp) : []
        const tallyPartsForJob = tallyParts.filter((r) => r.job_id === job.id)
        return {
          job,
          subLaborCost,
          teamLaborCost,
          partsCost,
          totalBill,
          profit,
          partsFromTally,
          invoicesFromSupplyHouses,
          billedMaterialsSum,
          cardCharges,
          teamLaborRow,
          subLaborJobs,
          tallyPartsForJob,
        }
      })
      .sort((a, b) => {
        const ha = (a.job.hcp_number ?? '').trim()
        const hb = (b.job.hcp_number ?? '').trim()
        const aEmpty = !ha
        const bEmpty = !hb
        if (aEmpty !== bEmpty) return aEmpty ? -1 : 1
        return -ha.localeCompare(hb, undefined, { numeric: true })
      })
  }, [
    activeTab,
    jobSummaryLedgerJobs,
    jobs,
    laborJobs,
    tallyParts,
    teamLaborData,
    driveMileageCost,
    driveTimePerMile,
    invoiceAmountByJob,
    mercuryCardChargesByJobId,
  ])

  const subLaborOutstandingByPerson = useMemo(
    () =>
      buildSubLaborOutstandingByPerson(
        laborJobs.filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByHcp)),
      ),
    [laborJobs, subLaborSearch, laborJobNamesByHcp],
  )
  const subLaborDueTotal = subLaborOutstandingByPerson.totalOutstanding

  function refreshCustomersAfterJobFormSave() {
    void (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
        .order('name')
      setCustomers(filterActiveCustomersForPicker((data as CustomerRow[]) ?? []))
    })()
  }

  function openNew() {
    if (jobsListPipelineBusy) {
      showToast('Please wait until jobs finish loading.', 'info')
      return
    }
    jobFormModal?.openNewJob({
      onSaved: () => {
        void loadJobs()
        refreshCustomersAfterJobFormSave()
      },
    })
  }

  function openEdit(job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean }) {
    tryOpenEditJob(job.id, {
      initialJob: job,
      billingCustomerHighlight: opts?.billingCustomerHighlight,
      onSaved: () => {
        void loadJobs()
        refreshCustomersAfterJobFormSave()
      },
    })
  }

  function openEditJobAndCreateCustomerFlow(job: JobWithDetails) {
    tryOpenEditJob(job.id, {
      initialJob: job,
      alsoOpenCreateCustomerModal: true,
      onSaved: () => {
        void loadJobs()
        refreshCustomersAfterJobFormSave()
      },
    })
  }

  async function createInvoiceFromModal() {
    if (!createPartialInvoiceJob) return
    const amount = parseFloat(createPartialInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = jobBillingUnallocatedDollars(createPartialInvoiceJob)
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
      const estBillModal =
        createPartialInvoiceJob.last_bill_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: createPartialInvoiceJob.id,
          amount: amountToUse,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: estBillModal,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      if (createPartialInvoiceJob.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: createPartialInvoiceJob.id,
            }),
          'ensure RTB remainder after partial invoice'
        )
        const obj = raw as Record<string, unknown> | null
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          throw new Error(obj.error)
        }
      }
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(null)
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

  function fillLaborFromBillingJobAndSwitch(job: JobWithDetails) {
    setActiveTab('sub_sheet_ledger')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'sub_sheet_ledger')
      return next
    })
    subLaborFormRef.current?.openWithBillingPrefill({
      jobNumber: job.hcp_number ?? '',
      address: job.job_address ?? '',
      teamMemberNames: (job.team_members ?? [])
        .map((t) => t.users?.name?.trim())
        .filter((n): n is string => !!n),
    })
  }

   
  async function updateJobTeamMembers(jobId: string, userIds: string[]) {
    setAssignedEditSavingId(jobId)
    try {
      const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', jobId)
      const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
      const toAdd = userIds.filter((id) => !existingTeamIds.has(id))
      const toRemove = [...existingTeamIds].filter((id) => !userIds.includes(id))
      for (const uid of toRemove) {
        const { error: delErr } = await supabase.from('jobs_ledger_team_members').delete().eq('job_id', jobId).eq('user_id', uid)
        if (delErr) throw delErr
      }
      for (const uid of toAdd) {
        const { error: insErr } = await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
        if (insErr) throw insErr
      }
      await loadJobs()
      setAssignedEditJobId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update assigned')
    } finally {
      setAssignedEditSavingId(null)
    }
  }

  async function updateJobPctComplete(jobId: string, value: number | null) {
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update % complete')
    } finally {
      setPctCompleteSavingId(null)
    }
  }

  /**
   * Stages "Set % complete" commit: post a thread note ("N% complete — <note>",
   * best-effort with its own toast) then write jobs_ledger.pct_complete. One saving
   * flag spans both so the editor stays disabled and closes when it clears.
   */
  async function commitStagesPctWithNote(jobId: string, value: number, note: string) {
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      await submitJobThreadNoteWithBody(jobId, composePctCompleteNoteBody(value, note), 'draft')
      const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update % complete')
    } finally {
      setPctCompleteSavingId(null)
    }
  }

  async function setInvoiceEstimatedBillDate(invoiceId: string, jobId: string, date: string | null) {
    setInvoiceEstimatedBillDateSavingId(invoiceId)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase
            .from('jobs_ledger_invoices')
            .update({ estimated_bill_date: date })
            .eq('id', invoiceId)
          return { data: r.data, error: r.error }
        },
        'update invoice estimated bill date'
      )
      setJobs((prev) =>
        prev.map((j) =>
          j.id !== jobId
            ? j
            : {
                ...j,
                invoices: (j.invoices ?? []).map((i) =>
                  i.id === invoiceId ? { ...i, estimated_bill_date: date } : i
                ),
              }
        )
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice bill date')
    } finally {
      setInvoiceEstimatedBillDateSavingId(null)
    }
  }

  /** Ham ±1: seed from invoice date, else job est. date, else today. */
  async function bumpInvoiceEstimatedBillDate(
    invoiceId: string,
    jobId: string,
    inv: JobsLedgerInvoice,
    job: JobWithDetails,
    deltaDays: number
  ) {
    const base =
      inv.estimated_bill_date ??
      job.last_bill_date ??
      new Date().toISOString().slice(0, 10)
    const newDate = addDaysToDate(base, deltaDays)
    await setInvoiceEstimatedBillDate(invoiceId, jobId, newDate)
  }

  // Hide primary-restricted tabs until role is known to prevent flash of wrong tabs
  const isPrimaryOrUnknown = (authRole === 'primary' || myRole === 'primary') || (authRole === null && myRole === null)
  const showPrimaryRestrictedTabs = !isPrimaryOrUnknown
  const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
  const showStagesAndBillingTabs = showPrimaryRestrictedTabs && !isSuperintendent
  const showTeamsTab = showPrimaryRestrictedTabs &&
    authRole !== 'master_technician' && !isAssistantLike(authRole) &&
    authRole !== 'superintendent' && myRole !== 'superintendent' &&
    myRole !== 'master_technician' && !isAssistantLike(myRole)
  const showTeamLaborTab = authRole !== 'assistant' && myRole !== 'assistant' &&
    authRole !== 'superintendent' && myRole !== 'superintendent'
  const showSuperintendentExtraTabs = !isSuperintendent

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {showTeamsTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('teams-summary')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'teams-summary')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'teams-summary')}
          >
            Crew P&L
          </button>
        )}
        <button
            type="button"
            onClick={() => {
              setActiveTab('reports')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'reports')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'reports')}
          >
            Reports
          </button>
        {showStagesAndBillingTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('stages')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'stages')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'stages')}
          >
            Stages
          </button>
        )}
        {showPrimaryRestrictedTabs && (
          <>
          {showStagesAndBillingTabs && (
            <>
            <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('billing')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'billing')
                  return next
                })
              }}
              style={pageTabStyle(activeTab === 'billing')}
            >
              Billing
            </button>
            </>
          )}
          {showTeamLaborTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('combined-labor')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'combined-labor')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'combined-labor')}
          >
            Team Labor
          </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('sub_sheet_ledger')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'sub_sheet_ledger')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'sub_sheet_ledger')}
          >
            Sub Labor
          </button>
          {showSuperintendentExtraTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('parts')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'parts')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'parts')}
          >
            Parts
          </button>
          )}
          </>
        )}
        {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('job-summary')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'job-summary')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'job-summary')}
          >
            Job Summary
          </button>
        )}
        {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
          <>
          <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('inspections')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'inspections')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'inspections')}
          >
            Inspections
          </button>
          </>
        )}
          </div>
        </div>
        <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>Jobs</h1>
      </div>

      {searchParams.get('customer') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', borderRadius: 6, fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-blue-800)' }}>Filtered by customer</span>
          <button
            type="button"
            onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('customer'); return n })}
            style={{ padding: '0.25rem 0.5rem', background: 'var(--surface)', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', color: 'var(--text-blue-800)', fontSize: '0.8125rem' }}
          >
            Clear filter
          </button>
        </div>
      )}

      {activeTab === 'reports' && (
        <ErrorBoundary>
          <JobsReportsTab
            authUserId={authUser?.id ?? null}
            authUserEmail={authUser?.email ?? null}
            authRole={authRole}
            authProfileName={authProfileName}
            myRole={myRole}
            jobs={jobs}
            loadJobs={loadJobs}
            tryOpenEditJob={tryOpenEditJob}
            jobDetailModal={jobDetailModal}
            showToast={showToast}
            error={error}
            onError={setError}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'stages' && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <input
              type="text"
              placeholder={
                stagesIncludeScheduleTimeInSearch
                  ? 'Search HCP, name, address, schedule notes, or clock notes'
                  : 'Search HCP, name, address'
              }
              value={stagesSearchQuery}
              onChange={(e) => setStagesSearchQuery(e.target.value)}
              aria-busy={stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy}
              aria-describedby={
                stagesIncludeScheduleTimeInSearch ? 'stages-search-supplemental-desc' : undefined
              }
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
            {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
              (r) => r === authRole || r === myRole,
            ) ? (
              <button
                type="button"
                onClick={() => setJobBookModalOpen(true)}
                title="Job Book"
                aria-label="Job Book"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  padding: 0,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <JobBookIcon size={20} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleStagesIncludeScheduleTimeInSearch}
              title={
                stagesIncludeScheduleTimeInSearch
                  ? 'Schedule and time in search on: also matches dispatch schedule and clock sessions (notes, assignee or puncher name, work date). Extra requests while you type. Click to search only HCP, name, and address.'
                  : 'Schedule and time in search off: only HCP, name, and address. Click to include schedule blocks and clock sessions in search.'
              }
              aria-label={
                stagesIncludeScheduleTimeInSearch
                  ? 'Schedule and time in search on, press to turn off'
                  : 'Schedule and time in search off, press to turn on'
              }
              aria-pressed={stagesIncludeScheduleTimeInSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: stagesIncludeScheduleTimeInSearch ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                color: stagesIncludeScheduleTimeInSearch ? 'var(--text-link)' : 'var(--text-muted)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
              </svg>
            </button>
            {stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy ? (
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.25,
                  textAlign: 'left',
                }}
              >
                <span>Search includes schedule</span>
                <span>and session notes</span>
              </span>
            ) : null}
            {(['dev', 'assistant', 'controller'] as const).includes((authRole || myRole) as 'dev' | 'assistant' | 'controller') && (
              <button
                type="button"
                onClick={toggleStagesHamMode}
                title={stagesHamMode ? 'Ham mode on: faster shortcuts for some stage actions' : 'Ham mode off: all stage confirmations'}
                aria-pressed={stagesHamMode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  padding: 0,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: stagesHamMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  cursor: 'pointer',
                  color: stagesHamMode ? 'var(--text-link)' : 'var(--text-muted)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M224 329.2C224 337.7 220.6 345.8 214.6 351.8L187.8 378.6C175.5 390.9 155.3 390 138.4 385.8C133.8 384.7 128.9 384 123.9 384C90.8 384 63.9 410.9 63.9 444C63.9 477.1 90.8 504 123.9 504C130.2 504 135.9 509.7 135.9 516C135.9 549.1 162.8 576 195.9 576C229 576 255.9 549.1 255.9 516C255.9 511 255.3 506.2 254.1 501.5C249.9 484.6 248.9 464.4 261.3 452.1L288.1 425.3C294.1 419.3 302.2 415.9 310.7 415.9L399.9 415.9C406.2 415.9 412.3 415.6 418.4 414.9C430.3 413.7 434.8 399.4 429.2 388.9C420.7 373.1 415.9 355.1 415.9 335.9C415.9 274 466 223.9 527.9 223.9C535.9 223.9 543.6 224.7 551.1 226.3C562.8 228.8 575.2 220.4 573.1 208.7C558.4 126.4 486.4 63.9 399.9 63.9C302.7 63.9 223.9 142.7 223.9 239.9L223.9 329.1z" />
                </svg>
              </button>
            )}
            <button
              type="button"
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
              aria-pressed={stagesFollowMoves}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: 36,
                padding: '0 0.7rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: stagesFollowMoves ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                color: stagesFollowMoves ? 'var(--text-link)' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                whiteSpace: 'nowrap',
              }}
            >
              Follow cards I move
            </button>
            <button
              type="button"
              onClick={() => setBilledTotalByNameModalOpen(true)}
              title="Total by Name"
              aria-label="Total by Name"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} aria-hidden>
                <path
                  fill="currentColor"
                  d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 152C192 165.3 202.7 176 216 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L216 128C202.7 128 192 138.7 192 152zM192 248C192 261.3 202.7 272 216 272L264 272C277.3 272 288 261.3 288 248C288 234.7 277.3 224 264 224L216 224C202.7 224 192 234.7 192 248zM304 324L304 328C275.2 328.3 252 351.7 252 380.5C252 406.2 270.5 428.1 295.9 432.3L337.6 439.3C343.6 440.3 348 445.5 348 451.6C348 458.5 342.4 464.1 335.5 464.1L280 464C269 464 260 473 260 484C260 495 269 504 280 504L304 504L304 508C304 519 313 528 324 528C335 528 344 519 344 508L344 503.3C369 499.2 388 477.6 388 451.5C388 425.8 369.5 403.9 344.1 399.7L302.4 392.7C296.4 391.7 292 386.5 292 380.4C292 373.5 297.6 367.9 304.5 367.9L352 367.9C363 367.9 372 358.9 372 347.9C372 336.9 363 327.9 352 327.9L344 327.9L344 323.9C344 312.9 335 303.9 324 303.9C313 303.9 304 312.9 304 323.9z"
                />
              </svg>
            </button>
            {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
              (r) => r === authRole || r === myRole,
            ) ? (
              <button
                type="button"
                onClick={() => setCombineSeparateModalOpen(true)}
                title="Combine two jobs or split Specific Work into a new job"
                aria-label="Combine or separate jobs"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface)',
                  color: 'var(--text-gray-800)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  fontSize: shortNewJobButtonLabel ? '0.8125rem' : undefined,
                }}
              >
                {shortNewJobButtonLabel ? 'C / S' : 'Combine / Separate'}
              </button>
            ) : null}
            </div>
          </div>
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
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('waiting')}
                  aria-label={`Jump to Waiting, ${stagesBoardLists.waiting.length} jobs`}
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
                <span>({stagesBoardLists.waiting.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('working')}
                  aria-label={`Jump to Working, ${stagesBoardLists.working.length} jobs`}
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
                <span>({stagesBoardLists.working.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('readyToBill')}
                  aria-label={`Jump to Ready to Bill, ${stagesBoardLists.readyToBillRows.length} rows`}
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
                <span>({stagesBoardLists.readyToBillRows.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('billed')}
                  aria-label={`Jump to Billed Awaiting Payment, ${stagesBoardLists.billedActiveRows.length} rows`}
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
                <span>({stagesBoardLists.billedActiveRows.length})</span>
              </span>
              {stagesBoardLists.collectionsRows.length > 0 ? (
                <>
                  <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                    →
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                    <button
                      type="button"
                      onClick={() => focusStagesSection('collections')}
                      aria-label={`Jump to Collections, ${stagesBoardLists.collectionsRows.length} rows`}
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
                    <span>({stagesBoardLists.collectionsRows.length})</span>
                  </span>
                </>
              ) : null}
            </div>
            {stagesJobsWithoutCustomer.length > 0 || stagesWorkingJobsWithoutPictures.length > 0 ? (
              <div
                style={{
                  marginLeft: 'auto',
                  flexShrink: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                {stagesJobsWithoutCustomer.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStagesNoCustomerModalOpen(true)}
                    onMouseEnter={() => setStagesNoCustomerBtnHover(true)}
                    onMouseLeave={() => setStagesNoCustomerBtnHover(false)}
                    title="List jobs missing a linked customer"
                    aria-label={`No linked customer: ${stagesJobsWithoutCustomer.length} jobs. Open list.`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: `1px solid ${stagesNoCustomerBtnHover ? '#f87171' : '#fecaca'}`,
                      borderRadius: 4,
                      background: 'var(--bg-red-tint)',
                      color: stagesNoCustomerBtnHover ? 'var(--text-red-800)' : 'var(--text-red-700)',
                      cursor: 'pointer',
                    }}
                  >
                    No customer ({stagesJobsWithoutCustomer.length})
                  </button>
                ) : null}
                {stagesWorkingJobsWithoutPictures.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStagesNoJobPicturesModalOpen(true)}
                    onMouseEnter={() => setStagesNoJobPicturesBtnHover(true)}
                    onMouseLeave={() => setStagesNoJobPicturesBtnHover(false)}
                    title="List working jobs missing Customer Pictures link"
                    aria-label={`Working jobs with no customer pictures link: ${stagesWorkingJobsWithoutPictures.length} jobs. Open list.`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: `1px solid ${stagesNoJobPicturesBtnHover ? '#f87171' : '#fecaca'}`,
                      borderRadius: 4,
                      background: 'var(--bg-red-tint)',
                      color: stagesNoJobPicturesBtnHover ? 'var(--text-red-800)' : 'var(--text-red-700)',
                      cursor: 'pointer',
                    }}
                  >
                    No customer pictures ({stagesWorkingJobsWithoutPictures.length})
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
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
            const { waiting, working, paid, readyToBillRows, billedActiveRows, collectionsRows } = stagesBoardLists

            /** Shared metrics so Job HCP badge and service-type pill match box height. */
            const stagesJobSublinePillBoxBase: CSSProperties = {
              display: 'inline-block',
              boxSizing: 'border-box',
              padding: '0.15rem 0.4rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              lineHeight: 1.2,
              borderRadius: 4,
              fontFamily: 'inherit',
            }
            const stagesJobHcpBadgeStyle: CSSProperties = {
              ...stagesJobSublinePillBoxBase,
              border: '1px solid rgba(255,255,255,0.5)',
              background: '#2563eb',
              color: 'white',
            }

            function renderStagesJobHcpSubline(job: JobWithDetails, extraWrap?: CSSProperties) {
              const t = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
              if (t) {
                const stName = job.serviceType?.name?.trim()
                const tagInfo = stName ? getBidServiceTypeTag(stName) : null
                const serviceLabel = stName
                  ? (tagInfo?.tag ?? stName.slice(0, 4)).toUpperCase()
                  : ''
                const borderColor = tagInfo?.color ?? '#d1d5db'
                const servicePillStyle: CSSProperties | null = stName
                  ? {
                      ...stagesJobSublinePillBoxBase,
                      marginTop: '0.15rem',
                      letterSpacing: '0.02em',
                      border: `1px solid ${borderColor}`,
                      background: tagInfo ? borderColor : 'var(--bg-muted)',
                      color: tagInfo ? '#fff' : 'var(--text-700)',
                    }
                  : null
                return (
                  <div style={extraWrap}>
                    <span style={stagesJobHcpBadgeStyle}>Job: {t}</span>
                    {servicePillStyle ? <span style={servicePillStyle}>{serviceLabel}</span> : null}
                  </div>
                )
              }
              return (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', ...extraWrap }}>—</div>
              )
            }

            function toggleStages(key: keyof typeof stagesSectionOpen) {
              setStagesSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
            }

            function renderStagesFieldAndBillingLines(job: JobWithDetails) {
              const jYmd = deriveStagesFieldReferenceYmd({
                lastWorkDate: job.last_work_date,
                lastScheduleWorkDate: job.last_schedule_work_date ?? null,
              })
              const bDetail = deriveStagesBillingActivityDetail(job)
              const jDisplay = jYmd ? formatEstimatedCompletionDisplay(jYmd) : null
              const bDisplay = bDetail ? formatEstimatedCompletionDisplay(bDetail.ymd) : null
              const jTitle = deriveStagesFieldTooltip({
                lastWorkDate: job.last_work_date,
                lastScheduleWorkDate: job.last_schedule_work_date ?? null,
                resolvedYmd: jYmd,
              })
              const lineStyle = {
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.15rem',
              } as const
              const jbLineButtonStyle: CSSProperties = {
                ...lineStyle,
                display: 'block',
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'inherit',
                font: 'inherit',
              }
              return (
                <>
                  <button
                    type="button"
                    style={jbLineButtonStyle}
                    title={jTitle ?? undefined}
                    aria-label="Field / job-activity date (click for explanation)"
                    onClick={(e) => {
                      e.stopPropagation()
                      showToast('Field / job-activity date', 'info', 2000, { clientX: e.clientX, clientY: e.clientY })
                    }}
                  >
                    j: {jDisplay ?? '—'}
                  </button>
                  <button
                    type="button"
                    style={jbLineButtonStyle}
                    title={bDetail?.tooltip}
                    aria-label="Billing-activity date (click for explanation)"
                    onClick={(e) => {
                      e.stopPropagation()
                      showToast('Billing-activity date', 'info', 2000, { clientX: e.clientX, clientY: e.clientY })
                    }}
                  >
                    b: {bDisplay ?? '—'}
                  </button>
                  {(() => {
                    const known = stagesManHoursByJobId.has(job.id)
                    const total = stagesManHoursByJobId.get(job.id) ?? 0
                    const display =
                      stagesManHoursLoading && !known ? '…' : formatDecimalWorkHoursToHhMm(total)
                    const breakdown = stagesLaborBreakdownByJobId.get(job.id) ?? []
                    const tip = breakdown.length
                      ? breakdown
                          .map((p) => `${p.personName} ${formatDecimalWorkHoursToHhMm(p.hours)}`)
                          .join(' · ')
                      : 'Man-hours applied (crew assignments)'
                    return (
                      <div
                        style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        title={tip}
                        aria-label={`Man-hours applied: ${display === '…' ? 'loading' : display}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width={11}
                          height={11}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                        {display}
                      </div>
                    )
                  })()}
                </>
              )
            }

            /** Job-column address: red map-pin icon + two-line address, linking to Google Maps. */
            function renderJobAddressWithMap(address: string | null | undefined) {
              const fmt = formatAddressTwoLines(address ?? null)
              if (!fmt) return null
              return (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {/* inline-flex so the clickable area hugs the icon + text instead of
                      stretching across the whole Job cell. */}
                  <a
                    href={googleMapsSearchUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Google Maps"
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'flex-start',
                      gap: '0.3rem',
                      maxWidth: '100%',
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 640 640"
                      width={12}
                      height={12}
                      fill="currentColor"
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-red-600)' }}
                    >
                      <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
                    </svg>
                    <JobAddressText line1={fmt.line1} line2={fmt.line2} />
                  </a>
                </div>
              )
            }

            function renderJobCustomerLine(job: JobWithDetails) {
              const hasCustomerInfo = ((job.customer_name ?? '').trim() || (job.customer_email ?? '').trim() || (job.customer_phone ?? '').trim())
              if (!hasCustomerInfo) return null
              const cn = (job.customer_name ?? '').trim()
              const impliedCustomerLink = !job.customer_id && customerListImpliesLinkedRow(customers, job.master_user_id, cn)
              const showNotInCustomersBadge = !job.customer_id && !impliedCustomerLink
              return (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 640 640"
                      width={13}
                      height={13}
                      fill="currentColor"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L160 64zM272 352L336 352C380.2 352 416 387.8 416 432C416 440.8 408.8 448 400 448L208 448C199.2 448 192 440.8 192 432C192 387.8 227.8 352 272 352zM248 256C248 225.1 273.1 200 304 200C334.9 200 360 225.1 360 256C360 286.9 334.9 312 304 312C273.1 312 248 286.9 248 256zM576 144C576 135.2 568.8 128 560 128C551.2 128 544 135.2 544 144L544 208C544 216.8 551.2 224 560 224C568.8 224 576 216.8 576 208L576 144zM576 272C576 263.2 568.8 256 560 256C551.2 256 544 263.2 544 272L544 336C544 344.8 551.2 352 560 352C568.8 352 576 344.8 576 336L576 272zM560 384C551.2 384 544 391.2 544 400L544 464C544 472.8 551.2 480 560 480C568.8 480 576 472.8 576 464L576 400C576 391.2 568.8 384 560 384z" />
                    </svg>
                    <span>{(job.customer_name ?? '').trim() || '—'}</span>
                  </span>
                  {showNotInCustomersBadge ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditJobAndCreateCustomerFlow(job)
                      }}
                      aria-label="Open Edit Job and create customer from job"
                      style={{
                        padding: '0.1rem 0.3rem',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        background: 'var(--bg-amber-100)',
                        color: 'var(--text-amber-800)',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Not in Customers
                    </button>
                  ) : null}
                </div>
              )
            }

            function toggleStagesJobThreadExpanded(id: string) {
              setExpandedJobThreadId((prev) => (prev === id ? null : id))
            }

            function shouldSuppressStagesRowJobThreadToggle(target: EventTarget | null): boolean {
              const el = target instanceof Element ? target : null
              if (!el) return false
              return !!el.closest('button, a, input, textarea, select, label, [role="button"]')
            }

            function renderStagesThreadExpandButton(jobId: string) {
              const expanded = expandedJobThreadId === jobId
              const stat = jobThreadStatsByJobId[jobId]
              const count = stat?.note_count ?? 0
              return (
                <button
                  type="button"
                  onClick={() => toggleStagesJobThreadExpanded(jobId)}
                  aria-expanded={expanded}
                  title={count > 0 ? `${count} thread note(s)` : 'Job notes thread'}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    padding: '0.25rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-700)',
                    fontSize: '0.75rem',
                    lineHeight: 1.1,
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
                  {count > 0 ? (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-link)', fontWeight: 600 }}>{count}</span>
                  ) : null}
                </button>
              )
            }

            function renderStagesLastActivityCell(
              job: JobWithDetails,
              billingLineForStripeHint?: JobsLedgerInvoice | null,
            ) {
              const jobId = job.id
              const stat = jobThreadStatsByJobId[jobId]
              const count = stat?.note_count ?? 0
              const activity = jobThreadActivityByJobId[jobId]
              let fromThreadBody = ''
              let lastChronologicalNoteAuthor: string | undefined
              if (activity?.length) {
                for (let i = activity.length - 1; i >= 0; i--) {
                  const it = activity[i]
                  if (it == null) continue
                  if (it.kind === 'note') {
                    fromThreadBody = (it.note.body ?? '').trim()
                    lastChronologicalNoteAuthor = it.note.author?.name?.trim() || undefined
                    break
                  }
                }
              }
              const titleForEmpty = 'Job notes thread'
              const reportCount = stat?.report_count ?? 0
              const titleParts: string[] = []
              if (count > 0) titleParts.push(`${count} thread note(s)`)
              if (reportCount > 0) titleParts.push(`${reportCount} field report(s)`)
              const titleWithNotes = titleParts.length > 0 ? titleParts.join(' · ') : titleForEmpty
              const expanded = expandedJobThreadId === jobId
              const scheduleNoTeam = (job.team_members?.length ?? 0) === 0
              const cellReportCount = job.report_count ?? 0

              function renderStagesViewReportsFooterButton() {
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setViewReportsJob({ id: job.id, hcpNumber: job.hcp_number ?? '—', jobName: job.job_name ?? '—', jobAddress: job.job_address ?? '—' })}
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        background: 'none',
                        color: 'var(--text-link)',
                        border: '1px solid #2563eb',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cellReportCount} Report{cellReportCount !== 1 ? 's' : ''}
                    </button>
                  </div>
                )
              }

              const stagesInvoiceJumpAmountChipStyle: CSSProperties = {
                padding: '0.15rem 0.4rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 4,
                background: '#16a34a',
                color: 'white',
                cursor: 'pointer',
                lineHeight: 1.2,
                fontFamily: 'inherit',
              }

              function renderStagesInvoiceJumpChips(forJob: JobWithDetails) {
                const invs = jobStagesInvoiceJumpChipTargets(forJob)
                if (invs.length === 0) return null
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginTop: 'auto',
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      maxWidth: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: 'var(--text-700)',
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      {invs.length === 1 ? 'Open Invoice:' : 'Open Invoices:'}
                    </span>
                    {invs.map((inv) => {
                      const amt = formatUsdNoCents(Number(inv.amount ?? 0))
                      const openCents = Math.round(invoiceOpenRemainingOnJob(inv, forJob) * 100)
                      const paidLabel = openCents === 0 ? 'Paid' : 'Unpaid'
                      const statusLabel = inv.status === 'billed' ? 'Billed' : 'Ready to bill'
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            applyStagesInvoiceFocus(inv.id)
                          }}
                          title={`Go to this invoice row on Stages (${statusLabel}, ${paidLabel})`}
                          aria-label={`Go to invoice ${inv.sequence_order} for ${amt}, ${paidLabel}, on Stages`}
                          style={stagesInvoiceJumpAmountChipStyle}
                        >
                          {amt}
                        </button>
                      )
                    })}
                  </div>
                )
              }

              const lastActivityMainColumnStyle: CSSProperties = {
                flex: 1,
                minWidth: 0,
                alignSelf: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                alignItems: 'stretch',
              }

              const tdShellStyle: CSSProperties = {
                padding: '0.75rem',
                verticalAlign: 'top',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: '0.35rem',
              }

              function renderStagesLastActivityLeadingControls() {
                const quickIconButtonStyle: CSSProperties = {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem',
                  border: 'none',
                  background: 'none',
                  flexShrink: 0,
                }
                const customerPhone = (job.customer_phone ?? '').trim()
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 2,
                      flexShrink: 0,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {canOpenJobScheduleModal ? (
                        <button
                          type="button"
                          onClick={() => setScheduleModalJob(job)}
                          disabled={scheduleNoTeam}
                          title={scheduleNoTeam ? 'Assign team members to open schedule' : 'Open schedule'}
                          aria-label={scheduleNoTeam ? 'Schedule: assign team members first' : 'Open schedule'}
                          style={{
                            ...quickIconButtonStyle,
                            cursor: scheduleNoTeam ? 'not-allowed' : 'pointer',
                            color: scheduleNoTeam ? 'var(--text-faint)' : '#16a34a',
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width={16}
                            height={16}
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
                          </svg>
                        </button>
                      ) : null}
                      {canOpenJobScheduleModal ? (
                        <button
                          type="button"
                          onClick={() => {
                            const week = getDefaultWeekRange().start
                            navigate(`/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`)
                          }}
                          disabled={scheduleNoTeam}
                          title={scheduleNoTeam ? 'Assign team members to open week dispatch' : 'Open week dispatch'}
                          aria-label={scheduleNoTeam ? 'Week dispatch: assign team members first' : 'Open week dispatch'}
                          style={{
                            ...quickIconButtonStyle,
                            cursor: scheduleNoTeam ? 'not-allowed' : 'pointer',
                            color: scheduleNoTeam ? 'var(--text-faint)' : 'var(--text-link)',
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width={16}
                            height={16}
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M128 96L512 96C547.3 96 576 124.7 576 160L576 480C576 515.3 547.3 544 512 544L128 544C92.7 544 64 515.3 64 480L64 160C64 124.7 92.7 96 128 96zM128 192L128 480L232 480L232 192L128 192zM280 192L280 480L360 480L360 192L280 192zM408 192L408 480L512 480L512 192L408 192z" />
                          </svg>
                        </button>
                      ) : null}
                      {customerPhone ? (
                        <a
                          href={`tel:${customerPhone}`}
                          title={`Call customer: ${customerPhone}`}
                          aria-label={`Call customer at ${customerPhone}`}
                          style={{ ...quickIconButtonStyle, color: '#0f766e', cursor: 'pointer' }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width={16}
                            height={16}
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C492.9 589.2 555.5 534 573.1 469.4L574.6 463.9C579.9 444.2 569.9 423.7 551 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 240.7 342.2 205.8 271.9L253 233.3C266.9 221.9 271.7 202.9 264.8 186.3L224.2 89z" />
                          </svg>
                        </a>
                      ) : null}
                      {showTaskDispatchButton(authRole) ? (
                        <button
                          type="button"
                          onClick={() =>
                            dispatchTaskModal?.openDispatchModal({
                              reference: {
                                source: 'job',
                                id: job.id,
                                hcp_number: job.hcp_number ?? '',
                                click_number: job.click_number ?? null,
                                job_name: job.job_name ?? '',
                                job_address: job.job_address ?? '',
                              },
                            })
                          }
                          title="Send this job to Dispatch with a note"
                          aria-label="Send job to Dispatch"
                          style={{ ...quickIconButtonStyle, color: '#0ea5e9', cursor: 'pointer' }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width={16}
                            height={16}
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z" />
                          </svg>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          const numLabel = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
                          const label = `${(numLabel ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
                          checklistAddModal?.openAddModal({
                            preset: {
                              title: `{{1:${label}}} — `,
                              links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(job.id)}`],
                            },
                          })
                        }}
                        title="Send this job to someone as a task"
                        aria-label="Send job as a task"
                        style={{ ...quickIconButtonStyle, color: '#7c3aed', cursor: 'pointer' }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          width={16}
                          height={16}
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M576 64L64 288L240 352L240 496L328 400L472 512L576 64z" />
                        </svg>
                      </button>
                    </div>
                    {renderStagesThreadExpandButton(jobId)}
                  </div>
                )
              }

              function lastActivityBodyInteractiveProps(title: string): {
                role: 'button'
                tabIndex: 0
                title: string
                'aria-expanded': boolean
                onClick: () => void
                onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
                style: CSSProperties
              } {
                return {
                  role: 'button',
                  tabIndex: 0,
                  title,
                  'aria-expanded': expanded,
                  onClick: () => toggleStagesJobThreadExpanded(jobId),
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleStagesJobThreadExpanded(jobId)
                    }
                  },
                  style: {
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer',
                  },
                }
              }

              function renderStagesStripeEmailedCustomerHint(): ReactNode {
                const line = billingLineForStripeHint
                if (!line) return null
                if (line.external_send_channel !== 'stripe') return null
                if (!String(line.stripe_invoice_id ?? '').trim()) return null
                const sentRaw = line.sent_to_customer_at
                if (sentRaw == null || !String(sentRaw).trim()) return null
                const sentMeta = getDispatchNoteDisplayMeta(String(sentRaw))
                const stripePaid =
                  String(line.stripe_invoice_status ?? '').toLowerCase() === 'paid'
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      width: '100%',
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.2,
                      textAlign: 'center',
                    }}
                  >
                    <span>Stripe emailed customer</span>
                    <span>
                      {sentMeta.weekdayTimeChicago} ({sentMeta.daysAgoLabel})
                    </span>
                    <StripeInvoiceSendFromStripeButton
                      jobsLedgerInvoiceId={line.id}
                      stripeInvoiceId={String(line.stripe_invoice_id).trim()}
                      customerEmail={job.customer_email ?? null}
                      stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
                      onSent={() => void loadJobs()}
                      compact
                      micro
                      unboxed
                      hideInlineSuccessLine
                      recordedLastSendAt={line.sent_to_customer_at}
                      buttonLabel="Resend invoice email"
                      sendDisabled={stripePaid}
                      sendDisabledTitle="This Stripe invoice is paid; Stripe will not send another email."
                    />
                  </div>
                )
              }

              function threadActivityWireMs(iso: string | null | undefined): number | null {
                if (iso == null || !String(iso).trim()) return null
                const t = Date.parse(String(iso))
                return Number.isNaN(t) ? null : t
              }

              if (!stat) {
                return (
                  <td style={tdShellStyle}>
                    {renderStagesLastActivityLeadingControls()}
                    <div style={lastActivityMainColumnStyle}>
                      <div {...lastActivityBodyInteractiveProps(titleForEmpty)}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
                      </div>
                      {renderStagesStripeEmailedCustomerHint()}
                      {renderStagesInvoiceJumpChips(job)}
                      {renderStagesViewReportsFooterButton()}
                    </div>
                  </td>
                )
              }
              const tNote = threadActivityWireMs(stat.last_note_at)
              const tReport = threadActivityWireMs(stat.last_report_at)
              if (tNote == null && tReport == null) {
                return (
                  <td style={tdShellStyle}>
                    {renderStagesLastActivityLeadingControls()}
                    <div style={lastActivityMainColumnStyle}>
                      <div {...lastActivityBodyInteractiveProps(titleForEmpty)}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
                      </div>
                      {renderStagesStripeEmailedCustomerHint()}
                      {renderStagesInvoiceJumpChips(job)}
                      {renderStagesViewReportsFooterButton()}
                    </div>
                  </td>
                )
              }
              const useReport = tReport != null && (tNote == null || tReport > tNote)
              const atIso = useReport ? stat.last_report_at! : stat.last_note_at!
              const author = useReport
                ? stat.last_report_author_name?.trim() || ''
                : stat.last_note_author_name?.trim() || lastChronologicalNoteAuthor || ''
              const body = useReport
                ? (() => {
                    const tmpl = (stat.last_report_template_name ?? '').trim() || 'Report'
                    const prev = (stat.last_report_preview ?? '').trim()
                    return prev ? `Report: ${tmpl}\n${prev}` : `Report: ${tmpl}`
                  })()
                : (stat.last_note_body ?? '').trim() || fromThreadBody
              return (
                <td style={{ ...tdShellStyle, maxWidth: 280 }}>
                  {renderStagesLastActivityLeadingControls()}
                  <div style={lastActivityMainColumnStyle}>
                    <div {...lastActivityBodyInteractiveProps(titleWithNotes)}>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        {author ? <span>{author}</span> : null}
                        {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
                        <span>{formatDispatchNoteWeekdayShortTimeChicago(atIso)}</span>
                        <span style={{ marginLeft: '0.35rem' }}>({formatDispatchNoteDaysAgoShortPhrase(atIso)})</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-700)',
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '4.2em',
                          overflow: 'hidden',
                        }}
                      >
                        {body || '—'}
                      </div>
                    </div>
                    {renderStagesStripeEmailedCustomerHint()}
                    {renderStagesInvoiceJumpChips(job)}
                    {renderStagesViewReportsFooterButton()}
                  </div>
                </td>
              )
            }

            function stagesRowHasProjectBanner(
              projectId: string | null,
              project: { name: string } | null | undefined
            ): boolean {
              return !!(projectId && project)
            }

            function renderStagesProjectBannerRow(
              projectId: string | null,
              project: { name: string } | null | undefined,
              colSpan: number
            ): React.ReactElement | null {
              if (!projectId || !project) return null
              return (
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td
                    colSpan={colSpan}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-blue-tint)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <Link to={`/workflows/${projectId}`} style={{ color: 'var(--text-blue-700)', textDecoration: 'none', fontWeight: 500 }}>
                      Project: {project.name}
                    </Link>
                  </td>
                </tr>
              )
            }

            const STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX = 56
            function renderStagesJobColumnEstimateFooter(linked: JobWithDetails['linkedEstimateForStages']): React.ReactElement | null {
              if (!linked) return null
              const raw = linked.title?.trim() ?? ''
              const title =
                raw.length > STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX
                  ? `${raw.slice(0, STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX)}…`
                  : raw
              return (
                <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Link
                    to={`/estimates/${linked.estimate_number}`}
                    style={{ color: '#15803d', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Quote #{linked.estimate_number}
                    {title ? ` — ${title}` : ''}
                  </Link>
                </div>
              )
            }

            function renderStagesTable(jobList: JobWithDetails[], actionLabel: React.ReactNode | null, onAction: (j: JobWithDetails) => void, showTimeOpen?: boolean, onSendBack?: (j: JobWithDetails) => void, onSendBackSimple?: (j: JobWithDetails) => void, showPctComplete?: boolean) {
              const stagesTableColCount = 5
              return (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
                          {renderStagesThreeLineHeader('Assigned', 'HCP', 'Last-Activity')}
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 200 }}>Last activity</th>
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
                              borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                              ...(stagesJobFlashId === j.id
                                ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                                : {}),
                            }}
                            onClick={(e) => {
                              if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                              toggleStagesJobThreadExpanded(j.id)
                            }}
                          >
                            <td style={{ padding: '0.75rem', position: 'relative', verticalAlign: 'top' }}>
                              {stagesHamMode ? (
                                <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (assignedEditJobId === j.id) {
                                          setAssignedEditJobId(null)
                                        } else {
                                          setAssignedEditJobId(j.id)
                                          setAssignedEditSelectedIds((j.team_members ?? []).map((t) => t.user_id))
                                        }
                                      }}
                                      disabled={assignedEditSavingId === j.id}
                                      title="Change assigned"
                                      aria-label="Change assigned"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 24,
                                        height: 24,
                                        padding: 0,
                                        border: 'none',
                                        borderRadius: 4,
                                        background: 'none',
                                        cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                        color: 'var(--text-muted)',
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                        <path d="M100.4 417.2C104.5 402.6 112.2 389.3 123 378.5L304.2 197.3L338.1 163.4C354.7 180 389.4 214.7 442.1 267.4L476 301.3L442.1 335.2L260.9 516.4C250.2 527.1 236.8 534.9 222.2 539L94.4 574.6C86.1 576.9 77.1 574.6 71 568.4C64.9 562.2 62.6 553.3 64.9 545L100.4 417.2zM156 413.5C151.6 418.2 148.4 423.9 146.7 430.1L122.6 517L209.5 492.9C215.9 491.1 221.7 487.8 226.5 483.2L155.9 413.5zM510 267.4C493.4 250.8 458.7 216.1 406 163.4L372 129.5C398.5 103 413.4 88.1 416.9 84.6C430.4 71 448.8 63.4 468 63.4C487.2 63.4 505.6 71 519.1 84.6L554.8 120.3C568.4 133.9 576 152.3 576 171.4C576 190.5 568.4 209 554.8 222.5C551.3 226 536.4 240.9 509.9 267.4z" />
                                      </svg>
                                    </button>
                                    {assignedEditJobId === j.id && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: '100%',
                                          left: 0,
                                          marginTop: 4,
                                          zIndex: 50,
                                          background: 'var(--surface)',
                                          border: '1px solid var(--border-strong)',
                                          borderRadius: 4,
                                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                          padding: '0.5rem',
                                          minWidth: 180,
                                          maxHeight: 200,
                                          overflowY: 'auto',
                                        }}
                                      >
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assigned</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          {users.map((u) => (
                                            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                              <input
                                                type="checkbox"
                                                checked={assignedEditSelectedIds.includes(u.id)}
                                                onChange={() => {
                                                  setAssignedEditSelectedIds((prev) =>
                                                    prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                                  )
                                                }}
                                                style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                              />
                                              <span>{u.name}</span>
                                            </label>
                                          ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                          <button
                                            type="button"
                                            onClick={() => updateJobTeamMembers(j.id, assignedEditSelectedIds)}
                                            disabled={assignedEditSavingId === j.id}
                                            style={{
                                              padding: '0.35rem 0.75rem',
                                              fontSize: '0.8125rem',
                                              background: '#3b82f6',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                            }}
                                          >
                                            {assignedEditSavingId === j.id ? '…' : 'Apply'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAssignedEditJobId(null)}
                                            style={{
                                              padding: '0.35rem 0.75rem',
                                              fontSize: '0.8125rem',
                                              background: 'none',
                                              color: 'var(--text-muted)',
                                              border: '1px solid var(--border-strong)',
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {renderStagesJobHcpSubline(j)}
                                  {renderStagesFieldAndBillingLines(j)}
                                </div>
                              ) : (
                                <>
                                  <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                  {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' })}
                                  {renderStagesFieldAndBillingLines(j)}
                                </>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {renderStagesOpenDetailJobName(j)}
                              {renderJobAddressWithMap(j.job_address)}
                              {renderJobCustomerLine(j)}
                              {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                            </td>
                            {renderStagesLastActivityCell(j, stagesJobLevelStripeEmailedHintInvoice(j))}
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
                                onPctCommit={showPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {showTimeOpen && (
                                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                                        Open {formatTimeSince(j.created_at ?? null)}
                                      </span>
                                    )}
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
                                        Send back
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
                                        Send back
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
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                        {(() => {
                                          const rem = jobBillingUnallocatedDollars(j)
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                              disabled={rem <= 0}
                                              title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                              aria-label="Create partial invoice"
                                              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? 'var(--text-faint)' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                                <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                                              </svg>
                                            </button>
                                          )
                                        })()}
                                        <button
                                          type="button"
                                          onClick={() => openEdit(j)}
                                          title="Edit"
                                          aria-label="Edit"
                                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                            <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openStagesDetailJobModal(j)}
                                          title="Job detail"
                                          aria-label={`Open job detail for ${(j.job_name ?? '').trim() || 'Job'}`}
                                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                            <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                          </svg>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                                          title="Open Click Tooling report (pre-fill customer info)"
                                          aria-label="Open Click Tooling"
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
                                            title="Hazmat Fee — document a biohazard incident and bill the customer"
                                            aria-label="Create a hazmat fee for this job"
                                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                <JobThreadNotesPanel
                                  pctComplete={j.pct_complete ?? null}
                                  canEditPct={canEditJobPctComplete}
                                  pctSaving={pctCompleteSavingId === j.id}
                                  onCommitPct={(value, note) => commitStagesPctWithNote(j.id, value, note)}
                                  teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                                  peopleAction={
                                    canManageJobPeople
                                      ? {
                                          onClick: () =>
                                            setManageJobPeople({
                                              jobId: j.id,
                                              jobLabel: `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
                                              currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                                            }),
                                        }
                                      : undefined
                                  }
                                  activity={jobThreadActivityByJobId[j.id] ?? []}
                                  loading={jobThreadNotesLoadingId === j.id}
                                  canPost={!!authUser}
                                  draft={jobThreadDraft}
                                  submitting={jobThreadSubmittingId === j.id}
                                  onDraftChange={setJobThreadDraft}
                                  onSubmit={() => void submitJobThreadNote(j.id)}
                                  scheduleAction={
                                    canOpenJobScheduleModal
                                      ? {
                                          onClick: () => setScheduleModalJob(j),
                                          disabled: (j.team_members?.length ?? 0) === 0,
                                        }
                                      : undefined
                                  }
                                  scheduleDispatchAction={
                                    canOpenJobScheduleModal
                                      ? {
                                          onClick: () => {
                                            const week = getDefaultWeekRange().start
                                            navigate(
                                              `/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`,
                                            )
                                          },
                                          disabled: (j.team_members?.length ?? 0) === 0,
                                        }
                                      : undefined
                                  }
                                  viewerRole={authRole}
                                />
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

            function renderUnifiedStagesTable(
              rows: StageRow[],
              options: {
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
                /** When false, hide the Click Tooling (wrench) shortcut (e.g. Billed Awaiting Payment). Default true. */
                showClickTooling?: boolean
                /** Billed Awaiting Payment: open Lien Tooling prefill modal. */
                onOpenLienTooling?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
                /** Billed Awaiting Payment: flag the row's job as difficult-to-collect (Collections section). */
                onJobMoveToCollections?: (j: JobWithDetails) => void
                /** Collections: short muted note line under the amounts (e.g. the stored collections reason). */
                jobNoteLine?: (j: JobWithDetails) => string | null
              }
            ) {
              const {
                actionLabel,
                onJobAction,
                onInvoiceAction,
                onViewBill,
                onJobSendBack,
                onInvoiceSendBack,
                showRemaining,
                showTimeOpen,
                sendBackBelowRemaining,
                showCreatePartialInvoice,
                jobSendBackLabel = 'Send back',
                invoiceBundleActionLabel = 'Remove line',
                invoiceStandaloneActionLabel = 'Send back',
                flashInvoiceId = null,
                showClickTooling = true,
                onOpenLienTooling,
                onJobMoveToCollections,
                jobNoteLine,
              } = options
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
              const unifiedStagesColCount = 5
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
                fontFamily: 'inherit',
              }
              return (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
                          {renderStagesThreeLineHeader('Assigned', 'HCP', 'Last-Activity')}
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 200 }}>Last activity</th>
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
                                  borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
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
                                <td style={{ padding: '0.75rem', verticalAlign: 'top', position: 'relative' }}>
                                  {stagesHamMode ? (
                                    <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        <span>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (assignedEditJobId === j.id) {
                                            setAssignedEditJobId(null)
                                          } else {
                                            setAssignedEditJobId(j.id)
                                            setAssignedEditSelectedIds((j.team_members ?? []).map((t) => t.user_id))
                                          }
                                        }}
                                        disabled={assignedEditSavingId === j.id}
                                        title="Change assigned"
                                        aria-label="Change assigned"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: 24,
                                          height: 24,
                                          padding: 0,
                                          border: 'none',
                                          borderRadius: 4,
                                          background: 'none',
                                          cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                          color: 'var(--text-muted)',
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                          <path d="M100.4 417.2C104.5 402.6 112.2 389.3 123 378.5L304.2 197.3L338.1 163.4C354.7 180 389.4 214.7 442.1 267.4L476 301.3L442.1 335.2L260.9 516.4C250.2 527.1 236.8 534.9 222.2 539L94.4 574.6C86.1 576.9 77.1 574.6 71 568.4C64.9 562.2 62.6 553.3 64.9 545L100.4 417.2zM156 413.5C151.6 418.2 148.4 423.9 146.7 430.1L122.6 517L209.5 492.9C215.9 491.1 221.7 487.8 226.5 483.2L155.9 413.5zM510 267.4C493.4 250.8 458.7 216.1 406 163.4L372 129.5C398.5 103 413.4 88.1 416.9 84.6C430.4 71 448.8 63.4 468 63.4C487.2 63.4 505.6 71 519.1 84.6L554.8 120.3C568.4 133.9 576 152.3 576 171.4C576 190.5 568.4 209 554.8 222.5C551.3 226 536.4 240.9 509.9 267.4z" />
                                        </svg>
                                      </button>
                                      {assignedEditJobId === j.id && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            marginTop: 4,
                                            zIndex: 50,
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border-strong)',
                                            borderRadius: 4,
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            padding: '0.5rem',
                                            minWidth: 180,
                                            maxHeight: 200,
                                            overflowY: 'auto',
                                          }}
                                        >
                                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assigned</div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {users.map((u) => (
                                              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                <input
                                                  type="checkbox"
                                                  checked={assignedEditSelectedIds.includes(u.id)}
                                                  onChange={() => {
                                                    setAssignedEditSelectedIds((prev) =>
                                                      prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                                    )
                                                  }}
                                                  style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                                />
                                                <span>{u.name}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                              type="button"
                                              onClick={() => updateJobTeamMembers(j.id, assignedEditSelectedIds)}
                                              disabled={assignedEditSavingId === j.id}
                                              style={{
                                                padding: '0.35rem 0.75rem',
                                                fontSize: '0.8125rem',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 4,
                                                cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                              }}
                                            >
                                              {assignedEditSavingId === j.id ? '…' : 'Apply'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setAssignedEditJobId(null)}
                                              style={{
                                                padding: '0.35rem 0.75rem',
                                                fontSize: '0.8125rem',
                                                background: 'none',
                                                color: 'var(--text-muted)',
                                                border: '1px solid var(--border-strong)',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' })}
                                    {renderStagesFieldAndBillingLines(j)}
                                  </div>
                                  ) : (
                                    <>
                                      <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                      {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' })}
                                      {renderStagesFieldAndBillingLines(j)}
                                    </>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {renderStagesOpenDetailJobName(j)}
                                  {renderJobAddressWithMap(j.job_address)}
                                  {renderJobCustomerLine(j)}
                                  {bundleInv != null ? (
                                    <div
                                      style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: '0.25rem' }}
                                      title="Single billing line for this job (Stripe or external send)"
                                    >
                                      {row.kind === 'job_with_merged_billed' ? (
                                        <>
                                          Billed line: {formatCurrency(invoiceOpenRemainingOnJob(bundleInv, j))} open
                                        </>
                                      ) : (
                                        <>Billing line: {formatCurrency(Number(bundleInv.amount))}</>
                                      )}
                                    </div>
                                  ) : null}
                                  {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                                </td>
                                {renderStagesLastActivityCell(j, bundleInv ?? undefined)}
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
                                          onPctCommit={(n) => updateJobPctComplete(j.id, n)}
                                          footnote={showRemaining ? (() => {
                                            const u = jobBillingUnallocatedDollars(j)
                                            return u > 0 ? (
                                              <span title="Left on the job after draft and billed invoice lines">{`${formatUsdNoCents(u)} unallocated`}</span>
                                            ) : null
                                          })() : null}
                                        />
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
                                            style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                                          >
                                            Move to Collections
                                          </button>
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
                                          onPctCommit={(n) => updateJobPctComplete(j.id, n)}
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
                                            style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                                          >
                                            Move to Collections
                                          </button>
                                        )}
                                        {renderJobNoteLine(j)}
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    {onViewBill && bundleInvWithJob != null && row.kind === 'job_with_merged_billed' ? (
                                      <button
                                        type="button"
                                        onClick={() => onViewBill(bundleInvWithJob)}
                                        style={{
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.8125rem',
                                          background: 'var(--surface)',
                                          color: 'var(--text-link)',
                                          border: '1px solid #2563eb',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontWeight: 500,
                                        }}
                                      >
                                        View Bill
                                      </button>
                                    ) : null}
                                    {onViewBill && !bundleInv && (j.invoices ?? []).filter((i) => i.status === 'billed').length === 1 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const b = (j.invoices ?? []).filter((i) => i.status === 'billed')
                                          onViewBill({ ...b[0], job: j } as InvoiceWithJob)
                                        }}
                                        style={{
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.8125rem',
                                          background: 'var(--surface)',
                                          color: 'var(--text-link)',
                                          border: '1px solid #2563eb',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontWeight: 500,
                                        }}
                                      >
                                        View Bill
                                      </button>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                          {showCreatePartialInvoice && (() => {
                                            const rem = jobBillingUnallocatedDollars(j)
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                                disabled={rem <= 0}
                                                title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                                aria-label="Create partial invoice"
                                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? 'var(--text-faint)' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                                  <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                                                </svg>
                                              </button>
                                            )
                                          })()}
                                          <button
                                            type="button"
                                            onClick={() => openEdit(j)}
                                            title="Edit"
                                            aria-label="Edit"
                                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                              <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                            </svg>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openStagesDetailJobModal(j)}
                                            title="Job detail"
                                            aria-label={`Open job detail for ${(j.job_name ?? '').trim() || 'Job'}`}
                                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                              <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                            </svg>
                                          </button>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                          {showClickTooling && (
                                            <button
                                              type="button"
                                              onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                                              title="Open Click Tooling report (pre-fill customer info)"
                                              aria-label="Open Click Tooling"
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
                                                  title="Lien Tooling — review and open demand / lien forms"
                                                  aria-label="Lien Tooling prefill"
                                                  style={{
                                                    padding: '0.25rem',
                                                    background: 'none',
                                                    border: 'none',
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
                                              title="Hazmat Fee — document a biohazard incident and bill the customer"
                                              aria-label="Create a hazmat fee for this job"
                                              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                    <JobThreadNotesPanel
                                      pctComplete={j.pct_complete ?? null}
                                      canEditPct={canEditJobPctComplete}
                                      pctSaving={pctCompleteSavingId === j.id}
                                      onCommitPct={(value, note) => commitStagesPctWithNote(j.id, value, note)}
                                      teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                                      peopleAction={
                                        canManageJobPeople
                                          ? {
                                              onClick: () =>
                                                setManageJobPeople({
                                                  jobId: j.id,
                                                  jobLabel: `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
                                                  currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                                                }),
                                            }
                                          : undefined
                                      }
                                      activity={jobThreadActivityByJobId[j.id] ?? []}
                                      loading={jobThreadNotesLoadingId === j.id}
                                      canPost={!!authUser}
                                      draft={jobThreadDraft}
                                      submitting={jobThreadSubmittingId === j.id}
                                      onDraftChange={setJobThreadDraft}
                                      onSubmit={() => void submitJobThreadNote(j.id)}
                                      scheduleAction={
                                        canOpenJobScheduleModal
                                          ? {
                                              onClick: () => setScheduleModalJob(j),
                                              disabled: (j.team_members?.length ?? 0) === 0,
                                            }
                                          : undefined
                                      }
                                      scheduleDispatchAction={
                                        canOpenJobScheduleModal
                                          ? {
                                              onClick: () => {
                                                const week = getDefaultWeekRange().start
                                                navigate(
                                                  `/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`,
                                                )
                                              },
                                              disabled: (j.team_members?.length ?? 0) === 0,
                                            }
                                          : undefined
                                      }
                                      viewerRole={authRole}
                                    />
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
                                  borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid #e5e7eb',
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
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div>{(job.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                  {stagesInvoiceHcpTrimmed ? (
                                    <div style={{ marginTop: '0.15rem' }}>
                                      <span style={stagesInvoiceHcpBadgeStyle}>{stagesInvoiceRowHcpLabel}</span>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                      {stagesInvoiceRowHcpLabel}
                                    </div>
                                  )}
                                  {renderStagesFieldAndBillingLines(job)}
                                  {(() => {
                                    const eff = effectiveInvoiceEstBillDate(inv, job)
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
                                                void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, -1)
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
                                                void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, 1)
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
                                                  hcpNumber: job.hcp_number ?? '—',
                                                })
                                                setWhenInvoiceBillModalDate(
                                                  inv.estimated_bill_date?.trim().slice(0, 10) ??
                                                    job.last_bill_date?.trim().slice(0, 10) ??
                                                    ''
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
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {(() => {
                                    const fmt = formatJobNameTwoLines(job.job_name)
                                    if (!fmt) return <div>—</div>
                                    return (
                                      <>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                                      </>
                                    )
                                  })()}
                                  {renderJobAddressWithMap(job.job_address)}
                                  {renderJobCustomerLine(job)}
                                  {renderStagesJobColumnEstimateFooter(job.linkedEstimateForStages)}
                                </td>
                                {renderStagesLastActivityCell(job, inv)}
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
                                      onPctCommit={(n) => updateJobPctComplete(job.id, n)}
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
                                        style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                                      >
                                        Move to Collections
                                      </button>
                                    )}
                                    {renderJobNoteLine(job)}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    {onViewBill ? (
                                      <button
                                        type="button"
                                        onClick={() => onViewBill(invWithJob)}
                                        style={{
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.8125rem',
                                          background: 'var(--surface)',
                                          color: 'var(--text-link)',
                                          border: '1px solid #2563eb',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontWeight: 500,
                                        }}
                                      >
                                        View Bill
                                      </button>
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
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                      {showClickTooling && (
                                        <button
                                          type="button"
                                          onClick={() => openInExternalBrowser(buildClickToolingUrl(job))}
                                          title="Open Click Tooling report (pre-fill customer info)"
                                          aria-label="Open Click Tooling"
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
                                          title="Lien Tooling — review and open demand / lien forms"
                                          aria-label="Lien Tooling prefill"
                                          style={{
                                            padding: '0.25rem',
                                            background: 'none',
                                            border: 'none',
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
                                      <button
                                        type="button"
                                        onClick={() => openEdit(job)}
                                        title="Edit"
                                        aria-label="Edit"
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openStagesDetailJobModal(job)}
                                        title="Job detail"
                                        aria-label={`Open job detail for ${(job.job_name ?? '').trim() || 'Job'}`}
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                        </svg>
                                      </button>
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
                                    <JobThreadNotesPanel
                                      pctComplete={job.pct_complete ?? null}
                                      canEditPct={canEditJobPctComplete}
                                      pctSaving={pctCompleteSavingId === job.id}
                                      onCommitPct={(value, note) => commitStagesPctWithNote(job.id, value, note)}
                                      teamMembers={job.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                                      peopleAction={
                                        canManageJobPeople
                                          ? {
                                              onClick: () =>
                                                setManageJobPeople({
                                                  jobId: job.id,
                                                  jobLabel: `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`,
                                                  currentTeamUserIds: job.team_members?.map((t) => t.user_id) ?? [],
                                                }),
                                            }
                                          : undefined
                                      }
                                      activity={jobThreadActivityByJobId[job.id] ?? []}
                                      loading={jobThreadNotesLoadingId === job.id}
                                      canPost={!!authUser}
                                      draft={jobThreadDraft}
                                      submitting={jobThreadSubmittingId === job.id}
                                      onDraftChange={setJobThreadDraft}
                                      onSubmit={() => void submitJobThreadNote(job.id)}
                                      scheduleAction={
                                        canOpenJobScheduleModal
                                          ? {
                                              onClick: () => setScheduleModalJob(job),
                                              disabled: (job.team_members?.length ?? 0) === 0,
                                            }
                                          : undefined
                                      }
                                      scheduleDispatchAction={
                                        canOpenJobScheduleModal
                                          ? {
                                              onClick: () => {
                                                const week = getDefaultWeekRange().start
                                                navigate(
                                                  `/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`,
                                                )
                                              },
                                              disabled: (job.team_members?.length ?? 0) === 0,
                                            }
                                          : undefined
                                      }
                                      viewerRole={authRole}
                                    />
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

            const workingTotal = working.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const waitingTotal = waiting.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const capableToBillTotal = working.reduce((s, j) => {
              const totalBill = Number(j.revenue ?? 0)
              const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
              const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
              const toBill = valueCreated - (totalBill - remaining)
              return s + Math.max(0, toBill)
            }, 0)
            const readyToBillTotal = readyToBillRowsExposureTotal(readyToBillRows)
            const billedTotal = billedActiveRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            const collectionsTotal = collectionsRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            // Server RPC is authoritative; this only controls button visibility (same office pool as other stage moves).
            const canManageCollections =
              authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
            return (
              <>
                <div id="stages-waiting" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('waiting')}
                    aria-expanded={stagesSectionOpen.waiting}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.waiting ? '▼' : '▶'}</span>
                    Waiting ({waiting.length}) - ${formatCurrency(waitingTotal)}
                  </button>
                </div>
                {stagesSectionOpen.waiting && renderStagesTable(
                  waiting,
                  'Move to Working',
                  (j) => void updateJobStatus(j.id, 'working'),
                  true, undefined, undefined, true
                )}

                <div id="stages-working" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('working')}
                    aria-expanded={stagesSectionOpen.working}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.working ? '\u25BC' : '\u25B6'}</span>
                    Working ({working.length}) - ${formatCurrency(workingTotal)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapableToBillModalOpen(true)}
                    style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Capable of Being Billed: <span style={{ fontWeight: 600 }}>${formatCurrencyNoCents(capableToBillTotal)}</span>
                  </button>
                </div>
                {stagesSectionOpen.working && renderStagesTable(
                  working,
                  'Ready to Bill',
                  (j) =>
                    stagesHamMode
                      ? void moveJobToReadyToBillWithStripePrep(j.id)
                      : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })),
                  true,
                  undefined,
                  stagesHamMode
                    ? (j) => void updateJobStatus(j.id, 'waiting')
                    : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'waiting' }),
                  true
                )}

                <div id="stages-ready-to-bill" style={{ margin: '1.5rem 0 0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('readyToBill')}
                    aria-expanded={stagesSectionOpen.readyToBill}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.readyToBill ? '\u25BC' : '\u25B6'}</span>
                    Ready to Bill ({readyToBillRows.length}) - ${formatCurrency(readyToBillTotal)}
                  </button>
                </div>
                {stagesSectionOpen.readyToBill && renderUnifiedStagesTable(readyToBillRows, {
                  actionLabel: 'Bill Customer',
                  onJobAction: (j) => {
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
                  },
                  onInvoiceAction: (inv) => {
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
                  },
                  onJobSendBack: (j) =>
                    stagesHamMode
                      ? void updateJobStatus(j.id, 'working')
                      : (setSendBackChecked(false),
                        setSendBackJob({
                          id: j.id,
                          hcpNumber: j.hcp_number ?? '—',
                          jobName: j.job_name ?? '—',
                          toStatus: 'working',
                          rtbDraftCount: (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').length,
                        })),
                  onInvoiceSendBack: (inv) => stagesHamMode ? deleteInvoice(inv.id) : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'delete' })),
                  showRemaining: true,
                  showTimeOpen: true,
                  showCreatePartialInvoice: true,
                  jobSendBackLabel: 'Send Job Back',
                  invoiceBundleActionLabel: DELETE_DRAFT_BILL_LABEL,
                  invoiceStandaloneActionLabel: DELETE_DRAFT_BILL_LABEL,
                  flashInvoiceId: stagesInvoiceFlashId,
                })}

                <div id="stages-billed" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleStages('billed')}
                      aria-expanded={stagesSectionOpen.billed}
                      style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span aria-hidden>{stagesSectionOpen.billed ? '\u25BC' : '\u25B6'}</span>
                      Billed Awaiting Payment ({billedActiveRows.length}) - ${formatCurrency(billedTotal)}
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {`30+ days: ${billedAgingBuckets.count30_90} | $${formatCurrency(billedAgingBuckets.sum30_90)} — 90+ days: ${billedAgingBuckets.count90} | $${formatCurrency(billedAgingBuckets.sum90)} · est. bill date`}
                    </span>
                  </div>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 36,
                        padding: '0 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            isAssistantLike(authRole) ||
                            authRole === 'primary'
                          )
                            ? 'var(--bg-muted)'
                            : 'var(--surface)',
                        cursor:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            isAssistantLike(authRole) ||
                            authRole === 'primary'
                          )
                            ? 'not-allowed'
                            : 'pointer',
                        color: 'var(--text-700)',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                      }}
                    >
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
                {stagesSectionOpen.billed && renderUnifiedStagesTable(billedActiveRows, {
                  actionLabel: 'Mark Paid',
                  onJobAction: (j) => setMarkPaidJob(j),
                  onInvoiceAction: (inv) => setMarkPaidInvoice(inv),
                  onViewBill: (inv) => setViewBillInvoice(inv),
                  showClickTooling: false,
                  onOpenLienTooling: (ctx) =>
                    setLienToolingPrefillModal({ job: ctx.job, invoice: ctx.invoice }),
                  onJobSendBack: (j) =>
                    stagesHamMode
                      ? void moveJobToReadyToBillWithStripePrep(j.id)
                      : (setSendBackChecked(false),
                        setSendBackJob({
                          id: j.id,
                          hcpNumber: j.hcp_number ?? '—',
                          jobName: j.job_name ?? '—',
                          toStatus: 'ready_to_bill',
                          rtbDraftCount: 0,
                        })),
                  onInvoiceSendBack: (inv) =>
                    stagesHamMode
                      ? void revertBilledInvoiceToReadyToBill(inv)
                      : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'revert' })),
                  showRemaining: true,
                  showTimeOpen: true,
                  sendBackBelowRemaining: true,
                  showCreatePartialInvoice: false,
                  invoiceBundleActionLabel: 'Send back',
                  flashInvoiceId: stagesInvoiceFlashId,
                  onJobMoveToCollections: canManageCollections
                    ? (j) => {
                        setCollectionsNoteDraft('')
                        setCollectionsConfirm({ job: j, direction: 'to' })
                      }
                    : undefined,
                })}

                <div id="stages-collections" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('collections')}
                    aria-expanded={stagesSectionOpen.collections}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.collections ? '▼' : '▶'}</span>
                    Collections ({collectionsRows.length}) - ${formatCurrency(collectionsTotal)}
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Billed jobs flagged difficult to collect — still awaiting payment
                  </span>
                </div>
                {stagesSectionOpen.collections && (collectionsRows.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    No jobs in Collections. Use “Move to Collections” on a Billed Awaiting Payment row to park a hard-to-collect job here.
                  </p>
                ) : renderUnifiedStagesTable(collectionsRows, {
                  actionLabel: 'Mark Paid',
                  onJobAction: (j) => setMarkPaidJob(j),
                  onInvoiceAction: (inv) => setMarkPaidInvoice(inv),
                  onViewBill: (inv) => setViewBillInvoice(inv),
                  showClickTooling: false,
                  onOpenLienTooling: (ctx) =>
                    setLienToolingPrefillModal({ job: ctx.job, invoice: ctx.invoice }),
                  onJobSendBack: (j) => setCollectionsConfirm({ job: j, direction: 'from' }),
                  onInvoiceSendBack: (inv) => setCollectionsConfirm({ job: inv.job, direction: 'from' }),
                  showRemaining: true,
                  showTimeOpen: true,
                  sendBackBelowRemaining: true,
                  showCreatePartialInvoice: false,
                  jobSendBackLabel: 'Send back to Billed',
                  invoiceBundleActionLabel: 'Send back to Billed',
                  invoiceStandaloneActionLabel: 'Send back to Billed',
                  flashInvoiceId: stagesInvoiceFlashId,
                  jobNoteLine: (j) => j.collections_note ?? null,
                }))}

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
                  aria-expanded={stagesSectionOpen.paid}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.paid ? '\u25BC' : '\u25B6'}</span>
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
                {stagesSectionOpen.paid ? (
                  <>
                    {paidJobsLoading ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }} role="status">
                        Loading paid jobs…
                      </p>
                    ) : null}
                    {renderStagesTable(
                      paid,
                      null,
                      () => {},
                      true,
                      undefined,
                      stagesHamMode
                        ? (j) => updateJobStatus(j.id, 'billed')
                        : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' }),
                      true,
                    )}
                  </>
                ) : null}

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
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
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
                  const rows = working
                    .map((j) => {
                      const totalBill = Number(j.revenue ?? 0)
                      const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
                      const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
                      const toBill = valueCreated - (totalBill - remaining)
                      return { job: j, toBill, valueCreated }
                    })
                    .filter((r) => r.toBill > 0)
                    .sort((a, b) => b.toBill - a.toBill)
                  return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          Jobs in Working with billable value. Sorted by amount.
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
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>To Bill</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 80 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ job, toBill, valueCreated }) => (
                                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <div>{job.job_name || '—'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.hcp_number || '—'}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{job.pct_complete != null ? `${job.pct_complete}%` : '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(valueCreated)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(Number(job.payments_made ?? 0))}</td>
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
                                <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>Total</td>
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

      {activeTab === 'sub_sheet_ledger' && (
        <JobsSubLaborTab
          error={error}
          subLaborSearch={subLaborSearch}
          onSubLaborSearchChange={setSubLaborSearch}
          laborJobs={laborJobs}
          laborJobsLoading={laborJobsLoading}
          laborJobNamesByHcp={laborJobNamesByHcp}
          subLaborDueTotal={subLaborDueTotal}
          subLaborOutstandingByPerson={subLaborOutstandingByPerson}
          myRole={myRole}
          onNewLaborJob={() => subLaborFormRef.current?.openNew()}
          onEditLaborJob={(job) => subLaborFormRef.current?.openEdit(job)}
          onOpenDriveSettings={() => { loadDriveSettings(); setDriveSettingsOpen(true); }}
          onOpenDefaultLaborRate={() => { loadDefaultLaborRate(); setDefaultLaborRateModalOpen(true); }}
          onPrintJobSubSheet={printJobSubSheet}
          onUpdateLaborJobDate={updateLaborJobDate}
          onOpenMakePayment={(target, defaultAmount) => { setMakePaymentAmount(defaultAmount); setMakePaymentMemo(''); setMakePaymentLaborJob(target) }}
          onOpenBackcharge={(target) => { setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeLaborJob(target) }}
        />
      )}

      {activeTab === 'combined-labor' && (
        <div>
          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
          <CrewJobsBlock
            showCrewJobsSection
            showTeamLabor
            jobIdsFilter={jobs.map((j) => j.id)}
            showTitle={false}
            collapsibleCrewJobs
            focusTeamLaborJobId={activeTab === 'combined-labor' ? teamLaborJobParam : null}
            onFocusTeamLaborConsumed={onFocusTeamLaborConsumed}
          />
        </div>
      )}

      {activeTab === 'billing' && (
        <JobsBillingTab
          jobs={jobs}
          jobsListLoading={jobsListLoading}
          jobsListRefreshing={jobsListRefreshing}
          jobsListError={jobsListError}
          error={error}
          authUserId={authUser?.id}
          authRole={authRole}
          shortNewJobButtonLabel={shortNewJobButtonLabel}
          laborJobHcps={laborJobHcps}
          teamLaborJobIds={teamLaborJobIds}
          teamLaborLoading={teamLaborLoading}
          openNew={openNew}
          openEdit={openEdit}
          onFillLaborFromBilling={fillLaborFromBillingJobAndSwitch}
        />
      )}

      {activeTab === 'teams-summary' && (
        <JobsCrewPnlTab
          jobs={jobs}
          laborJobs={laborJobs}
          teamLaborData={teamLaborData}
          loading={laborJobsLoading || teamLaborLoading}
          driveMileageCost={driveMileageCost}
          driveTimePerMile={driveTimePerMile}
          onOpenJobDetail={(jobId) => jobDetailModal?.openJobDetail({ jobId })}
        />
      )}

      {activeTab === 'parts' && (
        <JobsPartsTab
          error={error}
          authRole={authRole}
          myRole={myRole}
          jobs={jobs}
          tallyParts={tallyParts}
          tallyPartsLoading={tallyPartsLoading}
          invoiceAmountByJob={invoiceAmountByJob}
          deletingTallyPartId={deletingTallyPartId}
          updatingFixtureCostId={updatingFixtureCostId}
          deleteTallyPart={deleteTallyPart}
          updateFixtureCost={updateFixtureCost}
          tallyPartsSearch={tallyPartsSearch}
          setTallyPartsSearch={setTallyPartsSearch}
          showMyJobsOnly={showMyJobsOnly}
          setShowMyJobsOnly={setShowMyJobsOnly}
          myJobIds={myJobIds}
          expandedPartsJobIds={expandedPartsJobIds}
          setExpandedPartsJobIds={setExpandedPartsJobIds}
          mercuryCardChargesByJobId={mercuryCardChargesByJobId}
          partsTabMercuryAllocationsByJobId={partsTabMercuryAllocationsByJobId}
          canAccessBankingForParts={canAccessBankingForParts}
          partsUnattribFlowJobIdRef={partsUnattribFlowJobIdRef}
          setPartsUnattribListJobId={setPartsUnattribListJobId}
          allJobsUnattributedOpen={allJobsUnattributedOpen}
          setAllJobsUnattributedOpen={setAllJobsUnattributedOpen}
        />
      )}

      {activeTab === 'job-summary' && (
        <JobsJobSummaryTab
          error={error}
          jobSummaryLedgerError={jobSummaryLedgerError}
          jobSummaryLedgerLoading={jobSummaryLedgerLoading}
          jobSummaryLedgerJobs={jobSummaryLedgerJobs}
          jobSummaryLedgerAllJobs={jobSummaryLedgerAllJobs}
          jobSummaryMinHcpExclusive={jobSummaryMinHcpExclusive}
          setJobSummaryMinHcpExclusive={setJobSummaryMinHcpExclusive}
          jobSummaryData={jobSummaryData}
          jobSummarySearch={jobSummarySearch}
          setJobSummarySearch={setJobSummarySearch}
          expandedJobSummaryJobIds={expandedJobSummaryJobIds}
          setExpandedJobSummaryJobIds={setExpandedJobSummaryJobIds}
          jobSummaryTeamLaborPersonExpandedKeys={jobSummaryTeamLaborPersonExpandedKeys}
          setJobSummaryTeamLaborPersonExpandedKeys={setJobSummaryTeamLaborPersonExpandedKeys}
          jobSummaryBreakdownPersonSearchByJobId={jobSummaryBreakdownPersonSearchByJobId}
          setJobSummaryBreakdownPersonSearchByJobId={setJobSummaryBreakdownPersonSearchByJobId}
          jobSummaryClockSessionsByJobId={jobSummaryClockSessionsByJobId}
          jobSummaryInvoiceLinesByJobId={jobSummaryInvoiceLinesByJobId}
          jobSummaryMercuryAllocationsByJobId={jobSummaryMercuryAllocationsByJobId}
          jobSummaryReportsByJobId={jobSummaryReportsByJobId}
          jobSummaryReportPctByJobId={jobSummaryReportPctByJobId}
          jobThreadStatsByJobId={jobThreadStatsByJobId}
          onOpenJobDetail={(jobId) =>
            jobDetailModal?.openJobDetail({ jobId, onEditJobSaved: () => void loadJobSummaryLedger() })
          }
          onOpenEditJob={(jobId) => tryOpenEditJob(jobId, { onSaved: () => void loadJobSummaryLedger() })}
          setJobSummaryCostDrilldown={setJobSummaryCostDrilldown}
          printCostBreakdownJobId={printCostBreakdownJobId}
          setPrintCostBreakdownJobId={setPrintCostBreakdownJobId}
          canAccessBankingForParts={canAccessBankingForParts}
          showTeamLaborAndProfit={authRole === 'dev' || authRole === 'master_technician' || authRole === 'controller'}
          nicknameByDebitCard={nicknameByDebitCard}
          tallyPartsLoading={tallyPartsLoading}
          laborJobsLoading={laborJobsLoading}
          driveMileageCost={driveMileageCost}
          driveTimePerMile={driveTimePerMile}
          loadJobSummaryInvoiceLinesForJob={loadJobSummaryInvoiceLinesForJob}
          loadJobSummaryMercuryAllocationsForJob={loadJobSummaryMercuryAllocationsForJob}
          handleJobSummaryMercuryReassignFromDrilldown={handleJobSummaryMercuryReassignFromDrilldown}
          printJobSummaryCostBreakdown={printJobSummaryCostBreakdown}
        />
      )}

      {activeTab === 'inspections' && (
        <JobsInspectionsTab authUserId={authUser?.id ?? null} error={error} onError={setError} />
      )}

      <JobsSubLaborFormModal
        ref={subLaborFormRef}
        editingLaborJob={editingLaborJob}
        setEditingLaborJob={setEditingLaborJob}
        jobs={jobs}
        users={users}
        people={people}
        loadRoster={loadRoster}
        loadLaborJobs={loadLaborJobs}
        deleteLaborJob={deleteLaborJob}
        laborJobDeletingId={laborJobDeletingId}
        setLaborJobs={setLaborJobs}
        error={error}
        setError={setError}
        defaultLaborRateValue={defaultLaborRateValue}
        setActiveTab={setActiveTab}
        setEditingPayment={setEditingPayment}
        setEditPaymentAmount={setEditPaymentAmount}
        setEditPaymentMemo={setEditPaymentMemo}
        setMakePaymentLaborJob={setMakePaymentLaborJob}
        setMakePaymentAmount={setMakePaymentAmount}
        setMakePaymentMemo={setMakePaymentMemo}
        setBackchargeLaborJob={setBackchargeLaborJob}
        setBackchargeAmount={setBackchargeAmount}
        setBackchargeMemo={setBackchargeMemo}
        authUserId={authUser?.id}
        printJobSubSheet={printJobSubSheet}
      />

      {defaultLaborRateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Default Labor Rate</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              This rate is pre-filled when adding a new job. Leave empty for no default.
            </p>
            <form onSubmit={saveDefaultLaborRate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Labor rate ($/hr)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={defaultLaborRateValue}
                  onChange={(e) => setDefaultLaborRateValue(e.target.value)}
                  placeholder="e.g. 75.00"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={defaultLaborRateSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: defaultLaborRateSaving ? 'not-allowed' : 'pointer' }}>
                  {defaultLaborRateSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setDefaultLaborRateModalOpen(false)} disabled={defaultLaborRateSaving} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {driveSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Drive Settings</h2>
            <form onSubmit={saveDriveSettings}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Mileage cost ($/mi)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={driveMileageCost ?? ''}
                    onChange={(e) => setDriveMileageCost(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                    placeholder="0.70"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Time per mile (hrs/mi)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={driveTimePerMile ?? ''}
                    onChange={(e) => setDriveTimePerMile(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                    placeholder="0.02"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Drive cost = (miles × mileage cost) + (miles × time per mile × labor rate). Defaults: $0.70/mi, 0.02 hrs/mi (~1.2 min/mi).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={driveSettingsSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: driveSettingsSaving ? 'not-allowed' : 'pointer' }}>
                  {driveSettingsSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setDriveSettingsOpen(false)} disabled={driveSettingsSaving} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
          userRole={authRole}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
              <button type="button" disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id} onClick={async () => { if (!readyForBillingJob) return; const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id); if (!ok) return; setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {createPartialInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{createPartialInvoiceJob.hcp_number ?? '—'} · {createPartialInvoiceJob.job_name ?? '—'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(jobBillingUnallocatedDollars(createPartialInvoiceJob))}</div>
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
      <LienToolingPrefillModal
        open={lienToolingPrefillModal != null}
        onClose={() => setLienToolingPrefillModal(null)}
        job={lienToolingPrefillModal?.job ?? null}
        invoice={lienToolingPrefillModal?.invoice ?? null}
        senderNameFallback={lienToolingSenderFallback}
        authEmail={authUser?.email?.trim() ?? ''}
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
      {makePaymentLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Make Payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{makePaymentLaborJob.contractor} · {makePaymentLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(makePaymentLaborJob.totalCost)} · Paid: ${formatCurrency(makePaymentLaborJob.paid)} · Outstanding: ${formatCurrency(makePaymentLaborJob.outstanding)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={makePaymentAmount}
                onChange={(e) => setMakePaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo (optional)</label>
              <textarea
                value={makePaymentMemo}
                onChange={(e) => setMakePaymentMemo(e.target.value)}
                placeholder="Optional note"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={makePaymentSaving || !(parseFloat(makePaymentAmount) > 0)} onClick={async () => { if (!makePaymentLaborJob) return; const amt = parseFloat(makePaymentAmount); if (!(amt > 0)) return; setMakePaymentSaving(true); await recordLaborJobPayment(makePaymentLaborJob.id, amt, makePaymentMemo || null); setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo(''); setMakePaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? 'not-allowed' : 'pointer' }}>{makePaymentSaving ? '…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Backcharge</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{backchargeLaborJob.contractor} · {backchargeLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(backchargeLaborJob.totalCost)} · Paid: ${formatCurrency(backchargeLaborJob.paid)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={backchargeAmount}
                onChange={(e) => setBackchargeAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
              <textarea
                value={backchargeMemo}
                onChange={(e) => setBackchargeMemo(e.target.value)}
                placeholder="Required for backcharges"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim()} onClick={async () => { if (!backchargeLaborJob) return; const amt = parseFloat(backchargeAmount); if (!(amt > 0) || !backchargeMemo.trim()) return; setBackchargeSaving(true); await recordLaborJobBackcharge(backchargeLaborJob.id, amt, backchargeMemo); setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeSaving(false) }} style={{ padding: '0.5rem 1rem', background: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? 'not-allowed' : 'pointer' }}>{backchargeSaving ? '…' : 'Record Backcharge'}</button>
            </div>
          </div>
        </div>
      )}
      {editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{editingPayment.isBackcharge ? 'Edit Backcharge' : 'Edit Payment'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo {editingPayment.isBackcharge ? <span style={{ color: 'var(--text-red-700)' }}>*</span> : '(optional)'}</label>
              <textarea
                value={editPaymentMemo}
                onChange={(e) => setEditPaymentMemo(e.target.value)}
                placeholder={editingPayment.isBackcharge ? 'Required for backcharges' : 'Optional note'}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (!editingPayment || !confirm('Remove this payment?')) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? '#9ca3af' : 'var(--bg-red-100)', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {`Job ${sendBackInvoice.inv.job.hcp_number || '—'} · ${sendBackInvoice.inv.job.job_name || '—'} · $${Number(sendBackInvoice.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackJob.toStatus === 'working' ? 'Send Job Back' : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
              {sendBackJob.toStatus === 'ready_to_bill'
                ? 'This will move the job back to Ready to Bill.'
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
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || stagesStatusUpdatingId === sendBackJob.id}
                onClick={async () => {
                  if (!sendBackJob) return
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
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? 'pointer' : 'not-allowed',
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
      {scheduleModalJob ? (
        <ScheduleJobModal
          key={scheduleModalJob.id}
          open
          onClose={() => setScheduleModalJob(null)}
          jobId={scheduleModalJob.id}
          jobTitle={`${(scheduleModalJob.hcp_number ?? '').trim() || '—'} · ${(scheduleModalJob.job_name ?? '').trim() || 'Job'}`}
          teamMembers={(scheduleModalJob.team_members ?? []).map((tm) => ({
            user_id: tm.user_id,
            name: tm.users?.name ?? null,
          }))}
          assigneeCandidates={users.map((u) => ({ user_id: u.id, name: u.name }))}
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
      {partsUnattribListJobId ? (
        <PartsUnattributedMercuryListModal
          open
          onRequestClose={dismissPartsUnattributedList}
          onListCloseForAssign={closeListOnlyForAssign}
          jobId={partsUnattribListJobId}
          rows={partsTabMercuryAllocationsByJobId.get(partsUnattribListJobId) ?? null}
          onAssignToTransaction={handleAssignToTransactionFromParts}
          nicknameByDebitCard={nicknameByDebitCard}
          nicknameByAccount={nicknameByAccount}
          usersForMatch={partsUnattribBankingUsersForMatch}
          onQuickAddUser={canAccessBankingForParts ? handleQuickAddUserFromParts : undefined}
        />
      ) : null}
      {allJobsUnattributedOpen ? (
        <PartsUnattributedAllJobsModal
          open
          onRequestClose={() => setAllJobsUnattributedOpen(false)}
          onListCloseForAssign={closeAllJobsListForAssign}
          loading={allJobsUnattributedLoading}
          lines={allJobsUnattributedLines}
          onAssignToTransaction={canAccessBankingForParts ? handleAssignToTransactionFromParts : undefined}
          nicknameByDebitCard={nicknameByDebitCard}
          nicknameByAccount={nicknameByAccount}
          usersForMatch={partsUnattribBankingUsersForMatch}
          onQuickAddUser={canAccessBankingForParts ? handleQuickAddUserFromParts : undefined}
        />
      ) : null}
      {partsAllocModalOpen && partsAllocModalData ? (
        <MercuryTransactionAllocationsModal
          open
          onClose={closePartsAllocModal}
          transaction={partsAllocModalData.fullTx}
          initialAllocations={partsAllocModalData.initialAllocations}
          initialPersonId={partsAllocModalData.initialPersonId}
          initialUserId={partsAllocModalData.initialUserId}
          legacyPersonDisplayName={partsAllocModalData.legacyPersonDisplayName}
          jobLabelById={partsAllocModalData.jobLabelById}
          usersOptions={bankingAttributionUsersOptions}
          nicknameByDebitCard={partsAllocModalData.nicknameByDebitCard}
          nicknameByAccount={partsAllocModalData.nicknameByAccount}
          recentPersonPicksStorageKey={authUser?.id ?? null}
          onSaved={onPartsAllocSaved}
        />
      ) : null}
      {returnEditBannerJobId && activeTab === 'stages' ? (
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
      {jobSummaryCostDrilldown ? (
        <JobSummaryCostCellDrilldownModal
          open
          onClose={() => setJobSummaryCostDrilldown(null)}
          title={jobSummaryCostDrilldown.title}
        >
          {jobSummaryCostDrilldown.body}
        </JobSummaryCostCellDrilldownModal>
      ) : null}
    </div>
  )
}
