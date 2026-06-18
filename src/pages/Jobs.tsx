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
  filterLaborCrewNames,
  formatCurrency,
  formatCurrencyNoCents,
  formatEstimatedCompletionDisplay,
  formatJobNameTwoLines,
  formatJobSummaryDurationMinutes,
  formatJobSummaryInvoiceDate,
  formatJobSummaryMercuryPostedAt,
  formatJobSummarySessionDateTime,
  formatJobSummarySessionTimeOnly,
  formatPrintDaysSince,
  formatTimeSince,
  formatUsdNoCents,
  jobSummaryPartsCostIsZero,
} from '../lib/jobs/jobFormatting'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobStagesInvoiceJumpChipTargets,
  printBilledRowReferenceDate,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
  stagesJobLevelStripeEmailedHintInvoice,
  sumInvoiceAppliedFromJobPayments,
} from '../lib/jobs/invoiceBilling'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { useAuth } from '../hooks/useAuth'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useSendBackCollectPaymentFlowNotice } from '../hooks/useSendBackCollectPaymentFlowNotice'
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { usePartsLedgerData } from '../hooks/usePartsLedgerData'
import type { TallyPartRow } from '../types/tallyPart'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { laborItemsSubtotal, lineLaborCost } from '../lib/peopleLaborJobItemLineCost'
import { laborJobSubCost } from '../lib/jobs/subLaborCost'
import { buildClickToolingUrl, formatAddressTwoLines, resolvedLaborInvoiceLink } from '../lib/jobs/jobAddressUrls'
import JobsSubLaborTab from '../components/jobs/JobsSubLaborTab'
import type { LaborJob, LaborJobPayment, SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../types/laborJob'
import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import JobReportsModal from '../components/JobReportsModal'
import JobsInspectionsTab from '../components/jobs/JobsInspectionsTab'
import JobsReportsTab from '../components/jobs/JobsReportsTab'
import JobsPartsTab from '../components/jobs/JobsPartsTab'
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
import {
  JobSummaryCostCellDrilldownModal,
} from '../components/jobs/JobSummaryCostCellDrilldownModal'
import { StripeInvoiceSendFromStripeButton } from '../components/jobs/StripeInvoiceSendFromStripeButton'
import { JobThreadNotesPanel } from '../components/JobThreadNotesPanel'
import { ScheduleJobModal } from '../components/jobs/ScheduleJobModal'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { CrewJobsBlock } from '../components/CrewJobsBlock'
import type { Database } from '../types/database'
import type { JobSummaryClockSessionRow, JobSummaryInvoiceAllocationLine, JobSummaryMercuryAllocationRow } from '../types/jobSummary'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobFormModal, type OpenEditJobOptions } from '../contexts/JobFormModalContext'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { fetchJobsLedgerWithDetailsForStages } from '../lib/fetchJobsLedgerWithDetailsForStages'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'
import {
  applyMinHcpFilter,
  readJobSummaryMinHcpExclusiveFromStorage,
} from '../lib/jobSummaryHcpFilter'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { formatWorkDateYmdWeekdayLongFriendly, getDefaultWeekRange } from '../utils/dateUtils'
import { fetchAttributionsByMercuryTxIds } from '../lib/fetchMercuryRelationsByTxIds'
import { fetchMercuryJobAllocationsWithAttributionForJob } from '../lib/fetchMercuryJobAllocationsWithAttributionForJob'
import { formatDecimalWorkHoursToHhMm } from '../lib/formatDecimalWorkHoursHhMm'
import {
  buildJobSummaryPersonSummaryRows,
  partitionUnattributedFromJobSummaryPersonRows,
} from '../lib/jobSummaryPersonSummaryTable'
import {
  buildJobSummaryTeamLaborWorkDateTableRows,
  isJobSummaryNoWorkDateKey,
} from '../lib/jobSummaryTeamLaborWorkDateTable'
import {
  buildPartsPerPersonCostRows,
  type TallyLineForPersonRollup,
} from '../lib/partsPerPersonCostSummary'
import { normalizePersonNameKey } from '../lib/personNameKey'
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
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../lib/mercuryRawDebitCard'
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
  jobBillingUnallocatedDollars,
  locateStagesInvoiceSection,
  readyToBillRowsExposureTotal,
  stagesInvoiceVisibleWithEmptySearch,
  stagesJobsWithoutCustomerFromFiltered,
  stagesWorkingJobsWithoutPicturesFromWorking,
  type InvoiceWithJob,
  type StageRow,
} from '../lib/jobsStagesBoard'
import { jobLedgerHasCustomerForBilling } from '../lib/jobLedgerCustomerForBilling'
import {
  fetchJobIdsMatchingScheduleOrClockSessions,
  shouldFetchStagesScheduleSessionSearch,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from '../lib/jobsStagesScheduleSessionSearch'
import { showAiaG702G703 } from '../lib/aiaG702G703Eligibility'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string; notes: string | null }

type JobsTab = 'reports' | 'stages' | 'billing' | 'sub_sheet_ledger' | 'combined-labor' | 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'

/** Align with Layout mobile breakpoint; shortens primary create button to "New". */
const JOBS_SHORT_NEW_JOB_BUTTON_MQ = '(max-width: 640px)'

// Roster (for Labor / Sub Sheet Ledger)
type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type PersonKind =
  | 'assistant'
  | 'master_technician'
  | 'sub'
  | 'helper'
  | 'estimator'
  | 'primary'
  | 'superintendent'
const KIND_TO_USER_ROLE: Record<PersonKind, string> = {
  assistant: 'assistant',
  master_technician: 'master_technician',
  sub: 'subcontractor',
  helper: 'helpers',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

// Labor / Sub Sheet Ledger types
type ServiceType = { id: string; name: string; description: string | null; color: string | null; sequence_order: number; created_at: string; updated_at: string }
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type LaborBookEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
type LaborFixtureRow = {
  id: string
  fixture: string
  count: number
  hrs_per_unit: number
  is_fixed: boolean
  labor_rate: number
  direct_labor_amount: number | null
}
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

const LABOR_ASSIGNED_DELIMITER = ' | '


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
      authRole === 'assistant' ||
      authRole === 'superintendent',
    [authRole],
  )
  const shortNewJobButtonLabel = useMatchMedia(JOBS_SHORT_NEW_JOB_BUTTON_MQ)
  const { nicknameByDebitCard, nicknameByAccount } = useMercuryLedgerNicknames()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
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
  const [searchQuery, setSearchQuery] = useState('')
  const [billingSortAsc, setBillingSortAsc] = useState(false) // false = highest HCP first (desc, largest to smallest)
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

  // Labor tab state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  const [laborBookVersions, setLaborBookVersions] = useState<LaborBookVersion[]>([])
  const [selectedLaborBookVersionId, setSelectedLaborBookVersionId] = useState<string | null>(null)
  const [laborBookSectionOpen, setLaborBookSectionOpen] = useState(false)
  const [laborBookEntriesVersionId, setLaborBookEntriesVersionId] = useState<string | null>(null)
  const [laborBookEntries, setLaborBookEntries] = useState<LaborBookEntryWithFixture[]>([])
  const [applyingLaborBookHours, setApplyingLaborBookHours] = useState(false)
  const [laborBookApplyMessage, setLaborBookApplyMessage] = useState<string | null>(null)
  const [laborVersionFormOpen, setLaborVersionFormOpen] = useState(false)
  const [editingLaborVersion, setEditingLaborVersion] = useState<LaborBookVersion | null>(null)
  const [laborVersionNameInput, setLaborVersionNameInput] = useState('')
  const [savingLaborVersion, setSavingLaborVersion] = useState(false)
  const [laborEntryFormOpen, setLaborEntryFormOpen] = useState(false)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborBookEntryWithFixture | null>(null)
  const [laborEntryFixtureName, setLaborEntryFixtureName] = useState('')
  const [laborEntryAliasNames, setLaborEntryAliasNames] = useState('')
  const [laborEntryRoughIn, setLaborEntryRoughIn] = useState('')
  const [laborEntryTopOut, setLaborEntryTopOut] = useState('')
  const [laborEntryTrimSet, setLaborEntryTrimSet] = useState('')
  const [savingLaborEntry, setSavingLaborEntry] = useState(false)
  const [laborAssignedTo, setLaborAssignedTo] = useState<string[]>([])
  const [laborAddress, setLaborAddress] = useState('')
  const [laborDistance, setLaborDistance] = useState('0')
  const [laborJobNumber, setLaborJobNumber] = useState('')
  const [laborDate, setLaborDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [laborFixtureEntryMode, setLaborFixtureEntryMode] = useState<'simple' | 'itemized'>('simple')
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([
    { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: 20, direct_labor_amount: null },
  ])
  const [laborSaving, setLaborSaving] = useState(false)
  // Sub Sheet Ledger state
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobNamesByHcp, setLaborJobNamesByHcp] = useState<Record<string, string>>({})
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)
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
  const [laborModalOpen, setLaborModalOpen] = useState(false)
  const [laborModalInternalSubsOpen, setLaborModalInternalSubsOpen] = useState(false)
  const [laborModalOfficeTeamOpen, setLaborModalOfficeTeamOpen] = useState(false)
  const [laborCrewSearch, setLaborCrewSearch] = useState('')
  const [laborInvoiceLinkExpanded, setLaborInvoiceLinkExpanded] = useState(false)
  const [laborInvoiceLinkDraft, setLaborInvoiceLinkDraft] = useState('')
  const [laborInvoiceLinkCommitted, setLaborInvoiceLinkCommitted] = useState('')
  const [laborInvoiceLinkSaving, setLaborInvoiceLinkSaving] = useState(false)
  const [driveSettingsOpen, setDriveSettingsOpen] = useState(false)
  const [driveMileageCost, setDriveMileageCost] = useState<number | null>(null)
  const [driveTimePerMile, setDriveTimePerMile] = useState<number | null>(null)
  const [driveSettingsSaving, setDriveSettingsSaving] = useState(false)
  const [defaultLaborRateModalOpen, setDefaultLaborRateModalOpen] = useState(false)
  const [defaultLaborRateValue, setDefaultLaborRateValue] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const [showAddSubcontractorModal, setShowAddSubcontractorModal] = useState(false)
  const [newSubcontractor, setNewSubcontractor] = useState({ name: '', email: '', phone: '', notes: '' })
  const [addSubcontractorError, setAddSubcontractorError] = useState<string | null>(null)
  const [savingAddSubcontractor, setSavingAddSubcontractor] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)

  const canAccessBankingForParts = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      authRole === 'assistant' ||
      myRole === 'dev' ||
      myRole === 'master_technician' ||
      myRole === 'assistant',
    [authRole, myRole],
  )

  const laborMissingFields: string[] = []
  if (laborAssignedTo.length === 0) laborMissingFields.push('Assigned')
  if (!laborAddress.trim()) laborMissingFields.push('Address')
  if (laborDistance.trim() === '' || isNaN(parseFloat(laborDistance)) || parseFloat(laborDistance) < 0) laborMissingFields.push('Distance')
  if (laborFixtureEntryMode === 'simple') {
    if (
      laborFixtureRows.every((r) => {
        const hasFixture = (r.fixture ?? '').trim()
        return !hasFixture || !(Number(r.direct_labor_amount) > 0)
      })
    ) {
      laborMissingFields.push('Fixtures')
    }
  } else if (
    laborFixtureRows.every((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return !hasFixture || (!isFixed && Number(r.count) <= 0)
    })
  ) {
    laborMissingFields.push('Fixtures')
  }
  const laborCanSubmit = laborMissingFields.length === 0

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
  const [stagesSectionOpen, setStagesSectionOpen] = useState({
    waiting: false,
    working: true,
    readyToBill: true,
    billed: true,
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
  const [confirmJobStatusJob, setConfirmJobStatusJob] = useState<{ id: string; toStatus: 'billed' | 'paid'; message: string } | null>(null)
  const [stagesHamMode, setStagesHamMode] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-ham-mode') === 'true'
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
          color: '#1d4ed8',
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

  const focusStagesSection = useCallback((key: 'waiting' | 'working' | 'readyToBill' | 'billed') => {
    setStagesSectionOpen((prev) => ({ ...prev, [key]: true }))
    const elId =
      key === 'waiting'
        ? 'stages-waiting'
        : key === 'working'
          ? 'stages-working'
          : key === 'readyToBill'
            ? 'stages-ready-to-bill'
            : 'stages-billed'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [])

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
      authRole === 'assistant' ||
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
    const filtered = stagesFilteredJobs
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
      supabase.from('users').select('id, name, email, role, notes').in('role', ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']).order('name'),
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

  async function checkDuplicateName(nameToCheck: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    const [peopleRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name').is('archived_at', null),
      supabase.from('users').select('id, name'),
    ])
    const hasDuplicateInPeople = peopleRes.data?.some((p) => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersRes.data?.some((u) => u.name?.toLowerCase() === trimmedName) ?? false
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSaveAddSubcontractor(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    setSavingAddSubcontractor(true)
    setAddSubcontractorError(null)
    const trimmedName = newSubcontractor.name.trim()
    if (!trimmedName) {
      setAddSubcontractorError('Name is required')
      setSavingAddSubcontractor(false)
      return
    }
    const isDuplicate = await checkDuplicateName(trimmedName)
    if (isDuplicate) {
      setAddSubcontractorError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSavingAddSubcontractor(false)
      return
    }
    const { error: err } = await supabase
      .from('people')
      .insert({
        master_user_id: authUser.id,
        kind: 'sub',
        name: trimmedName,
        email: newSubcontractor.email.trim() || null,
        phone: newSubcontractor.phone.trim() || null,
        notes: newSubcontractor.notes.trim() || null,
      })
      .select('name')
      .single()
    if (err) {
      setAddSubcontractorError(err.message)
      setSavingAddSubcontractor(false)
      return
    }
    await loadRoster()
    setLaborAssignedTo((prev) => (prev.includes(trimmedName) ? prev : [...prev, trimmedName]))
    setShowAddSubcontractorModal(false)
    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
    setSavingAddSubcontractor(false)
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => u.role === userRole).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email }))
    const fromPeople = people.filter((p) => p.kind === k && !isAlreadyUser(p.email)).map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  function rosterNamesSubcontractors(): string[] {
    const fromSubs = byKind('sub')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    const fromPrimaries = byKind('primary')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    return [...new Set([...fromSubs, ...fromPrimaries])].sort((a, b) => a.localeCompare(b))
  }

  function rosterSubcontractorsWithAccount(): string[] {
    const fromSubs = byKind('sub')
      .filter((item) => item.source === 'user')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    const fromPrimaries = byKind('primary')
      .filter((item) => item.source === 'user')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    return [...new Set([...fromSubs, ...fromPrimaries])].sort((a, b) => a.localeCompare(b))
  }

  function rosterSubcontractorsWithoutAccount(): string[] {
    return byKind('sub')
      .filter((item) => item.source === 'people')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b))
  }

  function rosterNamesEveryoneElse(): string[] {
    const result: string[] = []
    const seen = new Set<string>()
    const kindsExceptSub: PersonKind[] = [
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent',
    ]
    for (const k of kindsExceptSub) {
      const names = byKind(k)
        .map((item) => item.name?.trim())
        .filter((n): n is string => !!n && !seen.has(n))
      names.forEach((n) => seen.add(n))
      result.push(...names.sort((a, b) => a.localeCompare(b)))
    }
    const devNames = users
      .filter((u) => u.role === 'dev')
      .map((u) => u.name?.trim())
      .filter((n): n is string => !!n && !seen.has(n))
    devNames.forEach((n) => seen.add(n))
    result.push(...devNames.sort((a, b) => a.localeCompare(b)))
    return result
  }

  const laborCrewSearchLower = laborCrewSearch.trim().toLowerCase()
  const laborCrewSearchActive = laborCrewSearch.trim().length > 0
  const laborModalExternalSubsAll = rosterSubcontractorsWithoutAccount()
  const laborModalExternalSubsShown = filterLaborCrewNames(laborModalExternalSubsAll, laborCrewSearchLower)
  const laborModalInternalSubsAll = rosterSubcontractorsWithAccount()
  const laborModalInternalSubsShown = filterLaborCrewNames(laborModalInternalSubsAll, laborCrewSearchLower)
  const laborModalOfficeTeamAll = rosterNamesEveryoneElse()
  const laborModalOfficeTeamShown = filterLaborCrewNames(laborModalOfficeTeamAll, laborCrewSearchLower)

  async function loadServiceTypes() {
    const { data, error } = await supabase.from('service_types' as any).select('*').order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    const firstId = types[0]?.id
    if (firstId) setSelectedServiceTypeId((prev) => (prev && types.some((st) => st.id === prev) ? prev : firstId))
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data } = await supabase.from('fixture_types').select('id, name').eq('service_type_id', selectedServiceTypeId).order('name', { ascending: true })
    if (data) setFixtureTypes(data)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase.from('labor_book_versions').select('*').eq('service_type_id', selectedServiceTypeId).order('name', { ascending: true })
    if (error) {
      setError(`Failed to load labor book versions: ${error.message}`)
      return
    }
    const versions = (data as LaborBookVersion[]) ?? []
    setLaborBookVersions(versions)
    const defaultVersion = versions.find((v) => v.name === 'Default') ?? versions[0]
    if (defaultVersion) setSelectedLaborBookVersionId(defaultVersion.id)
  }

  async function loadLaborBookEntries(versionId: string | null) {
    if (!versionId) {
      setLaborBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('labor_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_types(name)', { ascending: true })
    if (error) {
      setError(`Failed to load labor book entries: ${error.message}`)
      setLaborBookEntries([])
      return
    }
    setLaborBookEntries((data as LaborBookEntryWithFixture[]) ?? [])
  }

  async function loadLaborJobs() {
    if (!authUser?.id) return
    setLaborJobsLoading(true)
    setError(null)
    const { data: jobs, error: jobsErr } = await supabase
      .from('people_labor_jobs')
      .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, distance_miles, invoice_link')
      .order('created_at', { ascending: false })
    if (jobsErr) {
      setError(jobsErr.message)
      setLaborJobs([])
      setLaborJobNamesByHcp({})
    } else if (jobs?.length) {
      const jobIds = jobs.map((j) => j.id)
      const hcpNumbers = [...new Set((jobs as LaborJob[]).map((j) => (j.job_number ?? '').trim()).filter(Boolean))]
      const [itemsRes, paymentsRes, ledgerRes] = await Promise.all([
        supabase
          .from('people_labor_job_items')
          .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        supabase
          .from('people_labor_job_payments')
          .select('id, job_id, amount, memo, created_at')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        hcpNumbers.length > 0 ? supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: hcpNumbers }) : { data: [] },
      ])
      const { data: items } = itemsRes
      const { data: paymentsData } = paymentsRes
      const { data: ledgerJobs } = ledgerRes
      const itemsByJob = new Map<
        string,
        Array<{
          fixture: string
          count: number
          hrs_per_unit: number
          is_fixed?: boolean
          labor_rate?: number | null
          direct_labor_amount?: number | null
        }>
      >()
      for (const it of (items ?? []) as Array<{
        job_id: string
        fixture: string
        count: number
        hrs_per_unit: number
        is_fixed?: boolean
        labor_rate?: number | null
        direct_labor_amount?: number | null
      }>) {
        if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
        itemsByJob.get(it.job_id)!.push({
          fixture: it.fixture,
          count: it.count,
          hrs_per_unit: it.hrs_per_unit,
          is_fixed: it.is_fixed,
          labor_rate: it.labor_rate,
          direct_labor_amount: it.direct_labor_amount,
        })
      }
      const paymentsByJob = new Map<string, LaborJobPayment[]>()
      for (const p of (paymentsData ?? []) as Array<{ job_id: string; id: string; amount: number; memo: string | null; created_at: string }>) {
        if (!paymentsByJob.has(p.job_id)) paymentsByJob.set(p.job_id, [])
        paymentsByJob.get(p.job_id)!.push({ id: p.id, amount: Number(p.amount), memo: p.memo, created_at: p.created_at })
      }
      const jobNamesByHcp: Record<string, string> = {}
      for (const j of (ledgerJobs ?? []) as Array<{ hcp_number: string; job_name: string }>) {
        const key = (j.hcp_number ?? '').trim().toLowerCase()
        if (key && j.job_name) jobNamesByHcp[key] = j.job_name.trim()
      }
      setLaborJobNamesByHcp(jobNamesByHcp)
      const mappedJobs = (jobs as LaborJob[]).map((j) => ({ ...j, items: itemsByJob.get(j.id) ?? [], payments: paymentsByJob.get(j.id) ?? [] }))
      setLaborJobs(mappedJobs)
      setEditingLaborJob((prev) => {
        if (!prev) return prev
        const updated = mappedJobs.find((j) => j.id === prev.id)
        return updated ?? prev
      })
    } else {
      setLaborJobs([])
      setLaborJobNamesByHcp({})
    }
    setLaborJobsLoading(false)
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

  function getFixtureTypeIdByName(name: string): string | null {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return null
    const match = fixtureTypes.find((ft) => ft.name.toLowerCase() === normalized)
    return match?.id ?? null
  }

  async function getOrCreateFixtureTypeId(name: string): Promise<string | null> {
    const trimmedName = name.trim()
    if (!trimmedName) return null
    if (!selectedServiceTypeId) return null
    const existingId = getFixtureTypeIdByName(trimmedName)
    if (existingId) return existingId
    const maxSeqResult = await supabase
      .from('fixture_types')
      .select('sequence_order')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .single()
    const nextSeq = (maxSeqResult.data?.sequence_order ?? 0) + 1
    const { data, error } = await supabase
      .from('fixture_types')
      .insert({
        service_type_id: selectedServiceTypeId,
        name: trimmedName,
        category: 'Other',
        sequence_order: nextSeq,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('Failed to create fixture type:', error)
      return null
    }
    await loadFixtureTypes()
    return data.id
  }

  async function applyLaborBookHoursToPeople() {
    if (!selectedLaborBookVersionId || laborFixtureRows.length === 0) return
    setLaborBookApplyMessage(null)
    setApplyingLaborBookHours(true)
    setError(null)
    try {
      const { data: entries, error: fetchErr } = await supabase
        .from('labor_book_entries')
        .select('fixture_type_id, alias_names, rough_in_hrs, top_out_hrs, trim_set_hrs, fixture_types(name)')
        .eq('version_id', selectedLaborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (fetchErr) {
        setError(`Failed to load labor book entries: ${fetchErr.message}`)
        setApplyingLaborBookHours(false)
        return
      }
      const entriesByFixtureName = new Map<string, number>()
      for (const e of (entries as LaborBookEntryWithFixture[]) ?? []) {
        const total = Number(e.rough_in_hrs) + Number(e.top_out_hrs) + Number(e.trim_set_hrs)
        const primary = (e.fixture_types?.name ?? '').trim().toLowerCase()
        if (primary && !entriesByFixtureName.has(primary)) entriesByFixtureName.set(primary, total)
        for (const alias of e.alias_names ?? []) {
          const key = alias.trim().toLowerCase()
          if (key && !entriesByFixtureName.has(key)) entriesByFixtureName.set(key, total)
        }
      }
      setLaborFixtureRows((prev) =>
        prev.map((row) => {
          const fixtureName = (row.fixture ?? '').trim()
          if (!fixtureName) return row
          const matchedTotal = entriesByFixtureName.get(fixtureName.toLowerCase())
          if (matchedTotal != null) return { ...row, hrs_per_unit: matchedTotal, direct_labor_amount: null }
          return row
        })
      )
      setLaborBookApplyMessage('Labor book hours applied.')
      setTimeout(() => setLaborBookApplyMessage(null), 3000)
    } finally {
      setApplyingLaborBookHours(false)
    }
  }

  function openEditLaborVersion(v: LaborBookVersion) {
    setEditingLaborVersion(v)
    setLaborVersionNameInput(v.name)
    setLaborVersionFormOpen(true)
  }

  function closeLaborVersionForm() {
    setLaborVersionFormOpen(false)
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
  }

  async function saveLaborVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = laborVersionNameInput.trim()
    if (!name) return
    setSavingLaborVersion(true)
    setError(null)
    if (editingLaborVersion) {
      const { error: err } = await supabase.from('labor_book_versions').update({ name }).eq('id', editingLaborVersion.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('labor_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    }
    setSavingLaborVersion(false)
  }

  async function deleteLaborVersion(v: LaborBookVersion) {
    if (!confirm(`Delete labor book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('labor_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadLaborBookVersions()
      if (laborBookEntriesVersionId === v.id) {
        setLaborBookEntriesVersionId(null)
        setLaborBookEntries([])
      }
      if (selectedLaborBookVersionId === v.id) setSelectedLaborBookVersionId(null)
    }
  }

  function openNewLaborVersion() {
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
    setLaborVersionFormOpen(true)
  }

  function openNewLaborEntry() {
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function openEditLaborEntry(entry: LaborBookEntryWithFixture) {
    setEditingLaborEntry(entry)
    setLaborEntryFixtureName(entry.fixture_types?.name ?? '')
    setLaborEntryAliasNames((entry.alias_names ?? []).join(', '))
    setLaborEntryRoughIn(String(entry.rough_in_hrs))
    setLaborEntryTopOut(String(entry.top_out_hrs))
    setLaborEntryTrimSet(String(entry.trim_set_hrs))
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function closeLaborEntryForm() {
    setLaborEntryFormOpen(false)
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
  }

  async function saveLaborEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!laborBookEntriesVersionId) {
      setError('No labor book version selected')
      return
    }
    const fixtureName = laborEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }
    setSavingLaborEntry(true)
    setError(null)
    const fixtureTypeId = await getOrCreateFixtureTypeId(fixtureName)
    if (!fixtureTypeId) {
      setError(`Failed to create or find fixture type "${fixtureName}"`)
      setSavingLaborEntry(false)
      return
    }
    const aliasNames = laborEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const rough = parseFloat(laborEntryRoughIn) || 0
    const top = parseFloat(laborEntryTopOut) || 0
    const trim = parseFloat(laborEntryTrimSet) || 0
    if (editingLaborEntry) {
      const { error: err } = await supabase
        .from('labor_book_entries')
        .update({ fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim })
        .eq('id', editingLaborEntry.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    } else {
      const maxSeq = laborBookEntries.length === 0 ? 0 : Math.max(...laborBookEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('labor_book_entries')
        .insert({ version_id: laborBookEntriesVersionId, fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    }
    setSavingLaborEntry(false)
  }

  async function deleteLaborEntry(entry: LaborBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`)) return
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
  }

  function addLaborFixtureRow() {
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fixture: '',
        count: 1,
        hrs_per_unit: 0,
        is_fixed: false,
        labor_rate: defaultRate,
        direct_labor_amount: null,
      },
    ])
  }

  function removeLaborFixtureRow(id: string) {
    setLaborFixtureRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  function updateLaborFixtureRow(id: string, updates: Partial<LaborFixtureRow>) {
    setLaborFixtureRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  async function saveLaborJob() {
    if (!authUser?.id) return
    const assignedNames = laborAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = laborAddress.trim()

    const errors: string[] = []
    if (assignedNames.length === 0) {
      errors.push('Select at least one subcontractor or team member.')
    }
    if (!address) {
      errors.push('Enter a job address.')
    }
    const distanceNum = laborDistance.trim() ? parseFloat(laborDistance) : NaN
    if (laborDistance.trim() === '' || isNaN(distanceNum) || distanceNum < 0) {
      errors.push('Enter distance (mi) as a number 0 or greater.')
    }
    const validRows = laborFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      if (!hasFixture) return false
      if (laborFixtureEntryMode === 'simple') {
        return Number(r.direct_labor_amount) > 0
      }
      const isFixed = r.is_fixed ?? false
      return isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0
    })
    if (validRows.length === 0) {
      if (laborFixtureEntryMode === 'simple') {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCost = laborFixtureRows.some(
          (r) => (r.fixture ?? '').trim() && !(Number(r.direct_labor_amount) > 0),
        )
        if (!hasAnyFixture) {
          errors.push('Add at least one line item with a description.')
        } else if (hasInvalidCost) {
          errors.push('For each line item, enter a cost greater than 0.')
        } else {
          errors.push('Add at least one valid line item.')
        }
      } else {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCount = laborFixtureRows.some((r) => {
          const isFixed = r.is_fixed ?? false
          return (r.fixture ?? '').trim() && !isFixed && (Number(r.count) || 0) <= 0
        })
        const hasInvalidHrs = laborFixtureRows.some((r) => {
          const isFixed = r.is_fixed ?? false
          return (r.fixture ?? '').trim() && isFixed && Number(r.hrs_per_unit) < 0
        })
        if (!hasAnyFixture) {
          errors.push('Add at least one fixture or tie-in with a name.')
        } else if (hasInvalidCount) {
          errors.push('For each fixture (non-fixed), enter a count greater than 0.')
        } else if (hasInvalidHrs) {
          errors.push('For fixed fixtures, enter hours per unit of 0 or more.')
        } else {
          errors.push('Add at least one fixture or tie-in with a name and valid count or hours.')
        }
      }
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
      return
    }
    setLaborSaving(true)
    setError(null)
    const firstRowRate = validRows[0]?.labor_rate != null ? Number(validRows[0].labor_rate) : null
    const { data: job, error: jobErr } = await supabase
      .from('people_labor_jobs')
      .insert({
        master_user_id: authUser.id,
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: firstRowRate,
        job_date: laborDate.trim() ? laborDate.trim() : null,
        distance_miles: parseFloat(laborDistance) || 0,
        invoice_link: resolvedLaborInvoiceLink(laborInvoiceLinkCommitted),
      })
      .select('id')
      .single()
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!
      const { error: itemErr } = await supabase.from('people_labor_job_items').insert({
        job_id: job.id,
        fixture: r.fixture.trim(),
        count: laborFixtureEntryMode === 'simple' ? 1 : Number(r.count) || 1,
        hrs_per_unit: laborFixtureEntryMode === 'simple' ? 0 : Number(r.hrs_per_unit) || 0,
        is_fixed: laborFixtureEntryMode === 'simple' ? false : r.is_fixed ?? false,
        labor_rate: laborFixtureEntryMode === 'simple' ? null : r.labor_rate != null ? Number(r.labor_rate) : null,
        direct_labor_amount: laborFixtureEntryMode === 'simple' ? Number(r.direct_labor_amount) : null,
        sequence_order: i + 1,
      })
      if (itemErr) {
        setError(itemErr.message)
        setLaborSaving(false)
        return
      }
    }
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureEntryMode('simple')
    setLaborFixtureRows([
      { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null },
    ])
    setLaborSaving(false)
    setActiveTab('sub_sheet_ledger')
    closeLaborModal()
    await loadLaborJobs()
  }

  async function deleteLaborJob(id: string): Promise<boolean> {
    if (!confirm('Delete this job from the sub sheet ledger?')) return false
    setLaborJobDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setLaborJobDeletingId(null)
      return false
    }
    await loadLaborJobs()
    setLaborJobDeletingId(null)
    return true
  }

  async function updateLaborJobDate(jobId: string, jobDate: string | null) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_date: jobDate || null }).eq('id', jobId)
    if (err) setError(err.message)
    else {
      setLaborJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, job_date: jobDate } : j)))
    }
  }

  async function recordLaborJobPayment(jobId: string, amount: number, memo: string | null) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount, memo: memo?.trim() || null, sequence_order: nextOrder })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function recordLaborJobBackcharge(jobId: string, amount: number, memo: string) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount: -Math.abs(amount), memo: memo.trim(), sequence_order: nextOrder })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function deleteLaborJobPayment(paymentId: string) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_job_payments').delete().eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function updateLaborJobPayment(
    paymentId: string,
    amount: number,
    memo: string | null,
    isBackcharge: boolean
  ) {
    setError(null)
    const amt = isBackcharge ? -Math.abs(amount) : Math.abs(amount)
    const { error: err } = await supabase
      .from('people_labor_job_payments')
      .update({ amount: amt, memo: memo?.trim() || null })
      .eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  function handleLaborFixtureEntryModeToggle(nextItemized: boolean) {
    const jobLevelFallback = editingLaborJob?.labor_rate ?? laborFixtureRows[0]?.labor_rate ?? 20
    if (nextItemized) {
      setLaborFixtureRows((prev) => prev.map((r) => ({ ...r, direct_labor_amount: null })))
      setLaborFixtureEntryMode('itemized')
    } else {
      // Itemized → simple: preserve dollar totals as direct line amounts.
      setLaborFixtureRows((prev) =>
        prev.map((r) => ({
          ...r,
          direct_labor_amount: lineLaborCost(
            {
              count: r.count,
              hrs_per_unit: r.hrs_per_unit,
              is_fixed: r.is_fixed,
              labor_rate: r.labor_rate,
              direct_labor_amount: null,
            },
            jobLevelFallback,
          ),
        })),
      )
      setLaborFixtureEntryMode('simple')
    }
  }

  function resetLaborForm() {
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureEntryMode('simple')
    setLaborFixtureRows([
      { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null },
    ])
    setLaborModalInternalSubsOpen(false)
    setLaborModalOfficeTeamOpen(false)
    setLaborCrewSearch('')
    setLaborInvoiceLinkExpanded(false)
    setLaborInvoiceLinkDraft('')
    setLaborInvoiceLinkCommitted('')
  }

  function closeLaborModal() {
    setEditingLaborJob(null)
    setEditingPayment(null)
    setLaborModalOpen(false)
    setShowAddSubcontractorModal(false)
    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
    setAddSubcontractorError(null)
    resetLaborForm()
  }

  function openEditLaborJob(job: LaborJob) {
    setLaborModalInternalSubsOpen(false)
    setLaborModalOfficeTeamOpen(false)
    setLaborCrewSearch('')
    setEditingLaborJob(job)
    const names = job.assigned_to_name
      ? job.assigned_to_name.split(LABOR_ASSIGNED_DELIMITER).map((s) => s.trim()).filter(Boolean)
      : []
    setLaborAssignedTo(names)
    setLaborAddress(job.address)
    setLaborDistance(job.distance_miles != null ? String(job.distance_miles) : '0')
    setLaborJobNumber(job.job_number ?? '')
    setLaborDate(job.job_date ?? new Date().toLocaleDateString('en-CA'))
    const jobRate = job.labor_rate ?? 0
    const items = job.items ?? []
    const allDirect =
      items.length > 0 &&
      items.every((i) => i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount)))
    setLaborFixtureEntryMode(allDirect ? 'simple' : 'itemized')
    const rows = items.map((i) => ({
      id: crypto.randomUUID(),
      fixture: i.fixture ?? '',
      count: Number(i.count) || 1,
      hrs_per_unit: Number(i.hrs_per_unit) || 0,
      is_fixed: i.is_fixed ?? false,
      labor_rate: i.labor_rate != null ? Number(i.labor_rate) : jobRate,
      direct_labor_amount: i.direct_labor_amount != null ? Number(i.direct_labor_amount) : null,
    }))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows(
      rows.length > 0
        ? rows
        : [{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null }],
    )
    const invoiceLink = job.invoice_link?.trim() ?? ''
    setLaborInvoiceLinkCommitted(invoiceLink)
    setLaborInvoiceLinkDraft(invoiceLink)
    setLaborInvoiceLinkExpanded(false)
    setError(null)
  }

  async function saveLaborInvoiceLinkDraft() {
    const resolved = resolvedLaborInvoiceLink(laborInvoiceLinkDraft)
    const committedDisplay = resolved ?? ''
    setLaborInvoiceLinkCommitted(committedDisplay)
    setLaborInvoiceLinkDraft(committedDisplay)
    setLaborInvoiceLinkExpanded(false)
    if (!editingLaborJob) return
    setLaborInvoiceLinkSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('people_labor_jobs')
      .update({ invoice_link: resolved })
      .eq('id', editingLaborJob.id)
    setLaborInvoiceLinkSaving(false)
    if (err) {
      setError(err.message)
      setLaborInvoiceLinkCommitted(editingLaborJob.invoice_link?.trim() ?? '')
      setLaborInvoiceLinkDraft(editingLaborJob.invoice_link?.trim() ?? '')
      return
    }
    setEditingLaborJob((prev) => (prev ? { ...prev, invoice_link: resolved } : prev))
    setLaborJobs((prev) =>
      prev.map((j) => (j.id === editingLaborJob.id ? { ...j, invoice_link: resolved } : j)),
    )
  }

  function cancelLaborInvoiceLinkDraft() {
    setLaborInvoiceLinkDraft(laborInvoiceLinkCommitted)
    setLaborInvoiceLinkExpanded(false)
  }

  function openNewLaborJob() {
    setEditingLaborJob(null)
    resetLaborForm()
    setLaborModalOpen(true)
    setError(null)
  }

  async function saveEditedLaborJob(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLaborJob) return
    const assignedNames = laborAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = laborAddress.trim()

    const errors: string[] = []
    if (assignedNames.length === 0) {
      errors.push('Select at least one subcontractor or team member.')
    }
    if (!address) {
      errors.push('Enter a job address.')
    }
    const distanceNum = laborDistance.trim() ? parseFloat(laborDistance) : NaN
    if (laborDistance.trim() === '' || isNaN(distanceNum) || distanceNum < 0) {
      errors.push('Enter distance (mi) as a number 0 or greater.')
    }
    const validRows = laborFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      if (!hasFixture) return false
      if (laborFixtureEntryMode === 'simple') {
        return Number(r.direct_labor_amount) > 0
      }
      const isFixed = r.is_fixed ?? false
      return isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0
    })
    if (validRows.length === 0) {
      if (laborFixtureEntryMode === 'simple') {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCost = laborFixtureRows.some(
          (r) => (r.fixture ?? '').trim() && !(Number(r.direct_labor_amount) > 0),
        )
        if (!hasAnyFixture) {
          errors.push('Add at least one line item with a description.')
        } else if (hasInvalidCost) {
          errors.push('For each line item, enter a cost greater than 0.')
        } else {
          errors.push('Add at least one valid line item.')
        }
      } else {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCount = laborFixtureRows.some((r) => {
          const isFixed = r.is_fixed ?? false
          return (r.fixture ?? '').trim() && !isFixed && (Number(r.count) || 0) <= 0
        })
        const hasInvalidHrs = laborFixtureRows.some((r) => {
          const isFixed = r.is_fixed ?? false
          return (r.fixture ?? '').trim() && isFixed && Number(r.hrs_per_unit) < 0
        })
        if (!hasAnyFixture) {
          errors.push('Add at least one fixture or tie-in with a name.')
        } else if (hasInvalidCount) {
          errors.push('For each fixture (non-fixed), enter a count greater than 0.')
        } else if (hasInvalidHrs) {
          errors.push('For fixed fixtures, enter hours per unit of 0 or more.')
        } else {
          errors.push('Add at least one fixture or tie-in with a name and valid count or hours.')
        }
      }
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
      return
    }
    setLaborSaving(true)
    setError(null)
    const firstRowRate = validRows[0]?.labor_rate != null ? Number(validRows[0].labor_rate) : null
    const { error: jobErr } = await supabase
      .from('people_labor_jobs')
      .update({
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: firstRowRate,
        job_date: laborDate.trim() ? laborDate.trim() : null,
        distance_miles: parseFloat(laborDistance) || 0,
        invoice_link: resolvedLaborInvoiceLink(laborInvoiceLinkCommitted),
      })
      .eq('id', editingLaborJob.id)
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    const { error: delErr } = await supabase.from('people_labor_job_items').delete().eq('job_id', editingLaborJob.id)
    if (delErr) {
      setError(delErr.message)
      setLaborSaving(false)
      return
    }
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!
      const { error: itemErr } = await supabase.from('people_labor_job_items').insert({
        job_id: editingLaborJob.id,
        fixture: r.fixture.trim(),
        count: laborFixtureEntryMode === 'simple' ? 1 : Number(r.count) || 1,
        hrs_per_unit: laborFixtureEntryMode === 'simple' ? 0 : Number(r.hrs_per_unit) || 0,
        is_fixed: laborFixtureEntryMode === 'simple' ? false : r.is_fixed ?? false,
        labor_rate: laborFixtureEntryMode === 'simple' ? null : r.labor_rate != null ? Number(r.labor_rate) : null,
        direct_labor_amount: laborFixtureEntryMode === 'simple' ? Number(r.direct_labor_amount) : null,
        sequence_order: i + 1,
      })
      if (itemErr) {
        setError(itemErr.message)
        setLaborSaving(false)
        return
      }
    }
    setLaborSaving(false)
    closeLaborModal()
    await loadLaborJobs()
  }

  function printLaborSubSheet() {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = new Date().toLocaleDateString()
    const assignedLabel = laborAssignedTo.length > 0 ? laborAssignedTo.join(', ') : 'Labor'
    const title = escapeHtml(assignedLabel) + ' — ' + escapeHtml(laborAddress || 'Job') + ' — ' + dateStr

    const validRows = laborFixtureRows.filter((r) => (r.fixture ?? '').trim())
    const printFallbackRate = laborFixtureRows[0]?.labor_rate ?? 20
    const laborRowsHtml =
      validRows.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : validRows
            .map((row) => {
              const totalCost = lineLaborCost(row, printFallbackRate)
              const isDirect =
                row.direct_labor_amount != null && Number.isFinite(Number(row.direct_labor_amount))
              if (isDirect) {
                return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">—</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
              }
              const hrs = Number(row.hrs_per_unit) || 0
              const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
              const rate = row.labor_rate ?? 0
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${Number(row.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${rate.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (validRows.length > 0) {
      totalCost = validRows.reduce((sum, row) => sum + lineLaborCost(row, printFallbackRate), 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate ($/hr)</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printJobSubSheet(job: LaborJob) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = job.job_date ? new Date(job.job_date + 'T12:00:00').toLocaleDateString() : (job.created_at ? new Date(job.created_at).toLocaleDateString() : new Date().toLocaleDateString())
    const jobNumPart = job.job_number ? escapeHtml(job.job_number) + ' — ' : ''
    const title = escapeHtml(job.assigned_to_name) + ' — ' + jobNumPart + escapeHtml(job.address) + ' — ' + dateStr
    const jobRate = job.labor_rate ?? 0

    const items = job.items ?? []
    const laborRowsHtml =
      items.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : items
            .map((i) => {
              const totalCost = lineLaborCost(i, jobRate)
              const isDirect =
                i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount))
              if (isDirect) {
                return `<tr><td>${escapeHtml(i.fixture ?? '')}</td><td style="text-align:center">—</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
              }
              const hrs = Number(i.hrs_per_unit) || 0
              const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
              const rate = i.labor_rate ?? jobRate
              return `<tr><td>${escapeHtml(i.fixture ?? '')}</td><td style="text-align:center">${Number(i.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${rate.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (items.length > 0) {
      totalCost = items.reduce((sum, i) => sum + lineLaborCost(i, jobRate), 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate ($/hr)</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
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
    const escapeHtml = (s: string) =>
      (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const {
      job,
      teamLaborRow,
      teamLaborCost,
      subLaborJobs,
      partsFromTally,
      billedMaterialsSum,
      invoicesFromSupplyHouses,
      cardCharges,
      totalBill,
      profit,
      tallyPartsForJob,
      mileageCost,
      timePerMile,
    } = opts
    const jobId = job.id
    const generated = new Date().toLocaleString()
    const headerTitle = `${job.hcp_number ?? '—'} — ${job.job_name ?? '—'} — ${job.job_address ?? '—'}`

    let invoiceRows: JobSummaryInvoiceAllocationLine[] = []
    let invoiceNote = ''
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
        invoiceNote = '<p class="muted">Invoice line detail unavailable.</p>'
        invoiceRows = []
      }
    }

    let mRows: JobSummaryMercuryAllocationRow[] = []
    let mercuryNote = ''
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
        mercuryNote = '<p class="muted">Card charge line detail unavailable.</p>'
        mRows = []
      }
    }

    const tallyRollupForPrint: TallyLineForPersonRollup[] = tallyPartsForJob.map((r) => ({
      part_id: r.part_id,
      quantity: r.quantity,
      price_at_time: r.price_at_time,
      fixture_cost: r.fixture_cost,
      created_by_user_id: r.created_by_user_id,
      created_by_name: r.created_by_name,
    }))
    const {
      rows: ppRowsPrint,
      footer: ppFooterPrint,
      sumsOk: ppSumsOkPrint,
    } = buildPartsPerPersonCostRows({
      parts: tallyRollupForPrint,
      billedMaterialsSum,
      invoiceJobTotal: invoicesFromSupplyHouses,
      mercuryRows: mRows,
      parentCardTotal: cardCharges,
    })
    const teamBreakdownLite = (teamLaborRow?.breakdown ?? []).map((b) => ({
      personName: b.personName,
      cost: b.cost,
      hours: b.hours,
    }))
    const personRowsPrint = buildJobSummaryPersonSummaryRows({
      teamBreakdown: teamBreakdownLite,
      ppRows: ppRowsPrint,
    })
    const { rows: personRowsForTablePrint, unattributedCard: unattributedCardPrint } =
      partitionUnattributedFromJobSummaryPersonRows(personRowsPrint)
    const partsCostPrint = partsFromTally + invoicesFromSupplyHouses + billedMaterialsSum + cardCharges
    const subLaborTotalPrint = subLaborJobs.reduce(
      (s, lj) => s + laborJobSubCost(lj, mileageCost, timePerMile),
      0,
    )
    const teamLaborCell = teamLaborCost === 0 ? '—' : `$${formatCurrency(teamLaborCost)}`
    const subLaborCell = jobSummaryPartsCostIsZero(subLaborTotalPrint) ? '—' : `$${formatCurrency(subLaborTotalPrint)}`
    const partsCostCell = jobSummaryPartsCostIsZero(partsCostPrint) ? '—' : `$${formatCurrency(partsCostPrint)}`
    const totalBillCell = totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`
    const profitCell = `$${formatCurrency(profit)}`
    const summaryTableHtml = `<h2 class="print-section">Summary</h2>
<table class="print-key-table"><thead><tr>
<th>Team labor</th><th>Sub labor</th><th>Parts cost</th><th>Total bill</th><th>Revenue before overhead</th>
</tr></thead><tbody><tr>
<td style="text-align:right">${teamLaborCell}</td>
<td style="text-align:right">${subLaborCell}</td>
<td style="text-align:right">${partsCostCell}</td>
<td style="text-align:right">${totalBillCell}</td>
<td style="text-align:right">${profitCell}</td>
</tr></tbody></table>`

    const personFilterNote =
      '<p class="muted print-note">All people. The cost breakdown person search in the app does not apply to this print.</p>'

    const hasUnassignedRowContentPrint =
      !jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) || !jobSummaryPartsCostIsZero(unattributedCardPrint)
    const unassignedRowTotalPrint = unattributedCardPrint + Number(invoicesFromSupplyHouses ?? 0)
    const unassignedSupplyRowPrint = hasUnassignedRowContentPrint
      ? `<tr>
<td>Unassigned</td>
<td style="text-align:right">—</td>
<td style="text-align:right">—</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(unattributedCardPrint) ? '—' : `$${formatCurrency(unattributedCardPrint)}`
      }</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? '—' : `$${formatCurrency(invoicesFromSupplyHouses)}`
      }</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(unassignedRowTotalPrint) ? '—' : `$${formatCurrency(unassignedRowTotalPrint)}`
      }</td>
</tr>`
      : ''

    let personSummaryHtml = `<h2 class="print-section">Person summary</h2>${personFilterNote}`
    if (personRowsForTablePrint.length === 0 && !hasUnassignedRowContentPrint) {
      personSummaryHtml += '<p class="muted">No per-person team labor or card data.</p>'
    } else {
      const prTr = personRowsForTablePrint
        .map((r) => {
          const rowSum = r.teamLabor + r.card
          return `<tr>
<td>${escapeHtml(r.displayName)}</td>
<td style="text-align:right">${formatDecimalWorkHoursToHhMm(r.hours)}</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(r.teamLabor) ? '—' : `$${formatCurrency(r.teamLabor)}`}</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(r.card) ? '—' : `$${formatCurrency(r.card)}`}</td>
<td style="text-align:right;color:#6b7280">—</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(rowSum) ? '—' : `$${formatCurrency(rowSum)}`}</td>
</tr>`
        })
        .join('')
      const sumCardFromRows = personRowsForTablePrint.reduce((s, r) => s + r.card, 0)
      const footHours = teamLaborRow ? formatDecimalWorkHoursToHhMm(teamLaborRow.manHours) : '—'
      const footTeam = jobSummaryPartsCostIsZero(teamLaborCost) ? '—' : `$${formatCurrency(teamLaborCost)}`
      const footCard = jobSummaryPartsCostIsZero(cardCharges) ? '—' : `$${formatCurrency(cardCharges)}`
      const footTotalNumeric = teamLaborCost + cardCharges + Number(invoicesFromSupplyHouses ?? 0)
      const footTotal =
        jobSummaryPartsCostIsZero(footTotalNumeric) ? '—' : `$${formatCurrency(footTotalNumeric)}`
      personSummaryHtml += `<table>
<thead><tr>
<th style="text-align:left">Name</th>
<th style="text-align:right">Hours</th>
<th style="text-align:right">Team labor cost</th>
<th style="text-align:right">Card charges</th>
<th style="text-align:right">Supply houses</th>
<th style="text-align:right">Total</th>
</tr></thead>
<tbody>${prTr}${unassignedSupplyRowPrint}
<tr style="font-weight:600">
<td>Total</td>
<td style="text-align:right">${footHours}</td>
<td style="text-align:right">${footTeam}</td>
<td style="text-align:right">${footCard}</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? '—' : `$${formatCurrency(invoicesFromSupplyHouses)}`
      }</td>
<td style="text-align:right">${footTotal}</td>
</tr>
</tbody></table>`
      if (
        !jobSummaryPartsCostIsZero(cardCharges) &&
        Math.abs(sumCardFromRows + unattributedCardPrint - cardCharges) > 0.02
      ) {
        personSummaryHtml +=
          '<p class="muted" style="color:#b45309;font-size:0.85rem">Per-person card totals may not match job card total; check attributions.</p>'
      }
    }

    const clockSessions = jobSummaryClockSessionsByJobId.get(jobId) ?? []
    const clockLoaded = jobSummaryClockSessionsByJobId.has(jobId)

    let teamLaborHtml = ''
    if (teamLaborRow && teamLaborRow.breakdown.length > 0) {
      const bodyRows = teamLaborRow.breakdown
        .map(
          (b) =>
            `<tr><td>${escapeHtml(b.personName)}</td><td style="text-align:right">${formatCurrency(b.hours)}</td></tr>`,
        )
        .join('')
      teamLaborHtml = `<h2>Team Labor</h2><table><thead><tr><th>Person</th><th style="text-align:right">Hours</th></tr></thead><tbody>${bodyRows}<tr style="font-weight:600"><td>Total</td><td style="text-align:right">${formatCurrency(teamLaborRow.manHours)}</td></tr></tbody></table>`
      if (clockLoaded && teamLaborRow) {
        for (const b of teamLaborRow.breakdown) {
          const sessionsForPerson = clockSessions.filter(
            (s) => normalizePersonNameKey(s.users?.name ?? '') === normalizePersonNameKey(b.personName),
          )
          const printCombinedRows = buildJobSummaryTeamLaborWorkDateTableRows(b.byWorkDate, sessionsForPerson)
          if (printCombinedRows.length === 0) {
            teamLaborHtml += `<p class="muted">No crew allocation or clock sessions for this person.</p>`
          } else {
            const trs = printCombinedRows
              .map((row) => {
                if (row.kind === 'alloc') {
                  const w = isJobSummaryNoWorkDateKey(row.workDate)
                    ? '—'
                    : formatWorkDateYmdWeekdayLongFriendly(row.workDate)
                  return `<tr><td>${escapeHtml(w)}</td><td>—</td><td>—</td><td>—</td><td style="text-align:right">${formatCurrency(row.hours)}</td><td style="text-align:right">$${formatCurrency(row.cost)}</td></tr>`
                }
                const s = row.session
                const dur =
                  s.clocked_in_at && s.clocked_out_at
                    ? formatJobSummaryDurationMinutes(
                        new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime(),
                      )
                    : '—'
                const w = isJobSummaryNoWorkDateKey(row.workDate)
                  ? '—'
                  : formatWorkDateYmdWeekdayLongFriendly(row.workDate)
                return `<tr><td>${escapeHtml(w)}</td><td>${escapeHtml(formatJobSummarySessionTimeOnly(s.clocked_in_at))}</td><td>${escapeHtml(formatJobSummarySessionTimeOnly(s.clocked_out_at))}</td><td style="text-align:right">${escapeHtml(dur)}</td><td style="text-align:right">—</td><td style="text-align:right">—</td></tr>`
              })
              .join('')
            const printAllocTotals = printCombinedRows.reduce(
              (acc, r) => {
                if (r.kind === 'alloc') {
                  acc.hours += r.hours
                  acc.cost += r.cost
                }
                return acc
              },
              { hours: 0, cost: 0 },
            )
            const printTfoot = `<tfoot><tr style="font-weight:600;border-top:1px solid #ccc"><td colspan="4">Total</td><td style="text-align:right">${formatCurrency(printAllocTotals.hours)}</td><td style="text-align:right">$${formatCurrency(printAllocTotals.cost)}</td></tr></tfoot>`
            teamLaborHtml += `<table><thead><tr><th>Work date</th><th>In</th><th>Out</th><th style="text-align:right">Duration</th><th style="text-align:right">Hrs</th><th style="text-align:right">$</th></tr></thead><tbody>${trs}</tbody>${printTfoot}</table>`
          }
        }
        const nameKeys = new Set(teamLaborRow.breakdown.map((x) => normalizePersonNameKey(x.personName)))
        const orphan = clockSessions.filter((s) => {
          const kn = normalizePersonNameKey(s.users?.name ?? '')
          if (!kn) return true
          return !nameKeys.has(kn)
        })
        if (orphan.length > 0) {
          const or = orphan
            .map(
              (s) =>
                `<tr><td>${escapeHtml(s.users?.name ?? '—')}</td><td>${escapeHtml(s.work_date ? formatWorkDateYmdWeekdayLongFriendly(s.work_date) : '—')}</td><td>${escapeHtml(formatJobSummarySessionDateTime(s.clocked_in_at))}</td><td>${escapeHtml(formatJobSummarySessionDateTime(s.clocked_out_at))}</td></tr>`,
            )
            .join('')
          teamLaborHtml += `<h3 style="font-size:0.95rem;margin:0.75rem 0 0.35rem">Sessions not matched to a name above</h3><table><thead><tr><th>User</th><th>Work date</th><th>In</th><th>Out</th></tr></thead><tbody>${or}</tbody></table>`
        }
      }
    } else if (teamLaborCost === 0) {
      teamLaborHtml = `<h2>Team Labor</h2><p class="muted">No team labor for this job.</p>`
    } else {
      teamLaborHtml = `<h2>Team Labor</h2><p class="muted">Team labor total $${formatCurrency(teamLaborCost)} (no per-person breakdown).</p>`
    }

    let subLaborHtml = '<h2>Sub Labor</h2>'
    if (subLaborJobs.length > 0) {
      subLaborHtml += '<ul style="margin:0.35rem 0;padding-left:1.25rem">'
      for (const lj of subLaborJobs) {
        const c = laborJobSubCost(lj, mileageCost, timePerMile)
        subLaborHtml += `<li>${escapeHtml(lj.assigned_to_name ?? 'Contractor')}${lj.job_date ? ` · ${escapeHtml(lj.job_date)}` : ''}: $${formatCurrency(c)}</li>`
      }
      subLaborHtml += '</ul>'
    } else {
      subLaborHtml += '<p class="muted">No sub labor for this HCP.</p>'
    }

    let partsHtml = '<h2>Parts Cost</h2>'
    if (jobSummaryPartsCostIsZero(partsFromTally)) {
      partsHtml += `<p><strong>Parts from Tally</strong> $${formatCurrency(partsFromTally)}</p>`
    } else {
      partsHtml += `<h3 style="font-size:1rem">Parts from Tally — $${formatCurrency(partsFromTally)}</h3>`
      if (tallyPartsForJob.length > 0) {
        const tr = tallyPartsForJob
          .map((r) => {
            const lineCost =
              r.part_id == null
                ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
                : Number(r.price_at_time ?? 0) * Number(r.quantity)
            const label =
              r.part_id == null
                ? r.fixture_name || 'Fixture'
                : [r.part_name, r.fixture_name].filter(Boolean).join(' · ') || 'Part'
            return `<tr><td>${escapeHtml(label)}</td><td style="text-align:right">${r.quantity}</td><td style="text-align:right">$${formatCurrency(lineCost)}</td></tr>`
          })
          .join('')
        partsHtml += `<table><thead><tr><th>Fixture / Part</th><th style="text-align:right">Qty</th><th style="text-align:right">Line cost</th></tr></thead><tbody>${tr}</tbody></table>`
      } else {
        partsHtml += `<p class="muted">${partsFromTally > 0 ? 'Total reflects tally data; no line rows in view.' : 'No tally parts.'}</p>`
      }
    }
    if (jobSummaryPartsCostIsZero(billedMaterialsSum)) {
      partsHtml += `<p><strong>Other job charges</strong> $${formatCurrency(billedMaterialsSum)}</p>`
    } else {
      partsHtml += `<h3 style="font-size:1rem">Other job charges — $${formatCurrency(billedMaterialsSum)}</h3>`
      const matRows = [...(job.materials ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
      if (matRows.length > 0) {
        const mr = matRows
          .map(
            (m) =>
              `<tr><td>${escapeHtml(m.description?.trim() || '—')}</td><td style="text-align:right">$${formatCurrency(Number(m.amount ?? 0))}</td></tr>`,
          )
          .join('')
        partsHtml += `<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${mr}</tbody></table>`
      } else {
        partsHtml += `<p class="muted">${billedMaterialsSum > 0 ? 'No line items on file.' : 'No other job charges.'}</p>`
      }
    }
    if (jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) {
      partsHtml += `<p><strong>Invoices from supply houses</strong> $${formatCurrency(invoicesFromSupplyHouses)}</p>
<p class="muted">No allocated supply house invoices.</p>`
    } else {
      partsHtml += `<h3 style="font-size:1rem">Invoices from supply houses — $${formatCurrency(invoicesFromSupplyHouses)}</h3>${invoiceNote}`
      if (invoiceRows.length > 0) {
        const ir = invoiceRows
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.supply_house_name || '—')}</td><td>${escapeHtml(row.invoice_number)}</td><td>${escapeHtml(formatJobSummaryInvoiceDate(row.invoice_date))}</td><td style="text-align:right">$${formatCurrency(row.allocated_amount)}</td></tr>`,
          )
          .join('')
        partsHtml += `<table><thead><tr><th>Supply house</th><th>Invoice</th><th>Date</th><th style="text-align:right">Allocated</th></tr></thead><tbody>${ir}</tbody></table>`
      } else {
        partsHtml += `<p class="muted">${invoicesFromSupplyHouses > 0 ? 'No invoice allocation lines returned.' : 'No allocated supply house invoices.'}</p>`
      }
    }
    if (jobSummaryPartsCostIsZero(cardCharges)) {
      partsHtml += `<p><strong>Card charges</strong> $${formatCurrency(cardCharges)}</p>`
    } else {
      partsHtml += `<h3 style="font-size:1rem">Card charges — $${formatCurrency(cardCharges)}</h3>${mercuryNote}`
      if (mRows.length > 0) {
        const cr = mRows
          .map((row) => {
            const tx = row.mercury_transactions
            const posted = tx?.posted_at ? formatJobSummaryMercuryPostedAt(tx.posted_at) : '—'
            const allocAbs = Math.abs(Number(row.amount ?? 0))
            const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
            const debitCardDisplay =
              debitCardId != null
                ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId)
                : '—'
            const note = [row.note, tx?.note, tx?.external_memo].filter(Boolean).join(' · ') || '—'
            return `<tr><td>${escapeHtml(posted)}</td><td>${escapeHtml(tx?.counterparty_name ?? '—')}</td><td>${escapeHtml(row.attributionDisplayName ?? '—')}</td><td>${escapeHtml(debitCardDisplay)}</td><td style="text-align:right">$${formatCurrency(allocAbs)}</td><td>${escapeHtml(note)}</td></tr>`
          })
          .join('')
        partsHtml += `<table><thead><tr><th>Posted</th><th>Counterparty</th><th>User</th><th>Debit Card</th><th style="text-align:right">Allocated</th><th>Note</th></tr></thead><tbody>${cr}</tbody></table>`
      } else {
        partsHtml += `<p class="muted">${cardCharges > 0 ? 'No card allocation rows returned.' : 'No Mercury card allocations.'}</p>`
      }
    }

    if (!jobSummaryPartsCostIsZero(partsFromTally) || !jobSummaryPartsCostIsZero(cardCharges)) {
      if (
        ppRowsPrint.length > 0 ||
        !jobSummaryPartsCostIsZero(ppFooterPrint.partsFromTally) ||
        !jobSummaryPartsCostIsZero(ppFooterPrint.cardCharges)
      ) {
        partsHtml += `<h3 style="font-size:1rem">Cost by person (tally &amp; card)</h3>`
        partsHtml +=
          '<p class="muted" style="font-size:0.85rem">Other job charges and supply house invoices are job-level only (not split by person).</p>'
        const ppBody = ppRowsPrint
          .map((row) => {
            const rt = row.partsFromTally + row.cardCharges
            const tCell = jobSummaryPartsCostIsZero(row.partsFromTally) ? '—' : `$${formatCurrency(row.partsFromTally)}`
            const cCell = jobSummaryPartsCostIsZero(row.cardCharges) ? '—' : `$${formatCurrency(row.cardCharges)}`
            const rtCell = jobSummaryPartsCostIsZero(rt) ? '—' : `$${formatCurrency(rt)}`
            return `<tr><td>${escapeHtml(row.displayName)}</td><td style="text-align:right">${tCell}</td><td style="text-align:right">${cCell}</td><td style="text-align:right">${rtCell}</td></tr>`
          })
          .join('')
        const footRt = ppFooterPrint.partsFromTally + ppFooterPrint.cardCharges
        partsHtml += `<table><thead><tr><th>Person</th><th style="text-align:right">Parts from Tally</th><th style="text-align:right">Card charges</th><th style="text-align:right">Row total</th></tr></thead><tbody>${ppBody}<tr style="font-weight:600"><td>${escapeHtml(ppFooterPrint.displayName)}</td><td style="text-align:right">$${formatCurrency(ppFooterPrint.partsFromTally)}</td><td style="text-align:right">$${formatCurrency(ppFooterPrint.cardCharges)}</td><td style="text-align:right">$${formatCurrency(footRt)}</td></tr></tbody></table>`
        if (billedMaterialsSum > 0 || invoicesFromSupplyHouses > 0) {
          partsHtml += `<p class="muted" style="font-size:0.85rem">Job-level (not in table above): other job charges $${formatCurrency(billedMaterialsSum)} · supply invoices $${formatCurrency(invoicesFromSupplyHouses)}</p>`
        }
        if (!ppSumsOkPrint) {
          partsHtml +=
            '<p class="muted" style="color:#b45309;font-size:0.85rem">Row totals may not match job-level parts totals; check attributions and line items.</p>'
        }
      }
    }

    const totalsHtml = `<h2 class="print-section">Total bill</h2>
<p><strong>Revenue (billing):</strong> ${totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}</p>
<p><strong>Revenue before overhead:</strong> $${formatCurrency(profit)}</p>`

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(headerTitle)} — Cost breakdown</title><style>
body { font-family: sans-serif; margin: 1in; font-size: 0.875rem; }
h1 { font-size: 1.2rem; margin-bottom: 0.25rem; }
h2 { font-size: 1.05rem; margin: 1rem 0 0.35rem; }
.print-section { margin-top: 1.1rem; }
.print-key-table { max-width: 100%; }
.print-note { font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
.muted { color: #6b7280; margin: 0.35rem 0; }
table { width: 100%; border-collapse: collapse; margin: 0.35rem 0 0.75rem; font-size: 0.8125rem; }
th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
th { background: #f5f5f5; }
table.print-key-table th, table.print-key-table td { text-align: right; }
@media print { body { margin: 0.5in; } }
</style></head><body>
<h1>${escapeHtml(headerTitle)}</h1>
<p class="muted" style="margin-top:0">Cost breakdown · ${escapeHtml(generated)}</p>
${summaryTableHtml}
${personSummaryHtml}
${teamLaborHtml}
${subLaborHtml}
${partsHtml}
${totalsHtml}
</body></html>`
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Allow pop-ups to print the cost breakdown.', 'error')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printBilledAwaitingPaymentReport(rows: StageRow[], opts?: { searchFilter?: string }) {
    if (rows.length === 0) {
      showToast('Nothing to print in Billed Awaiting Payment.', 'warning')
      return
    }
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = new Date().toLocaleDateString()
    const title = escapeHtml(`Billed awaiting payment — ${dateStr}`)
    const filterNote = opts?.searchFilter?.trim()
      ? `<p style="margin:0.35rem 0 0; font-size:0.9rem; color:#4b5563;">Filtered (stages search): ${escapeHtml(opts.searchFilter.trim())}</p>`
      : ''
    const grandTotal = rows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)

    const groups = new Map<string, { displayName: string; rows: StageRow[] }>()
    for (const r of rows) {
      const job = r.job
      const nameNorm = (job.customer_name ?? '').trim().toLowerCase()
      const key = job.customer_id ?? (nameNorm.length > 0 ? `name:${nameNorm}` : '—')
      let g = groups.get(key)
      if (!g) {
        g = { displayName: (job.customer_name ?? '').trim() || '—', rows: [] }
        groups.set(key, g)
      }
      g.rows.push(r)
    }
    for (const g of groups.values()) {
      const named = g.rows.map((row) => (row.job.customer_name ?? '').trim()).find((n) => n.length > 0)
      if (named) g.displayName = named
    }

    const sortedGroups = [...groups.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    )

    const sectionsHtml = sortedGroups
      .map((g) => {
        const sortedRows = sortStageRowsForTotalByNameDetail(g.rows)
        const contactJob = sortedRows[0]!.job
        const phoneRaw = (contactJob.customer_phone ?? '').trim()
        const emailRaw = (contactJob.customer_email ?? '').trim()
        const sectionHeading =
          (g.displayName ?? '').trim() && g.displayName !== '—' ? g.displayName : 'Jobs with no customer linked'
        const contactBlock =
          phoneRaw || emailRaw
            ? `<p style="margin:0 0 0.5rem; font-size:0.875rem; color:#374151">Phone: ${escapeHtml(phoneRaw || '—')} · Email: ${escapeHtml(emailRaw || '—')}</p>`
            : ''
        const subtotal = sortedRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
        const linesHtml = sortedRows
          .map((r) => {
            const j = r.job
            const detail =
              r.kind === 'job' ? 'Job balance' : r.kind === 'job_with_merged_billed' ? 'Billed line' : `Invoice #${r.inv.sequence_order}`
            const amt = stageRowBilledRemainingAmount(r)
            const { display: dateDisplay, ageDays } = printBilledRowReferenceDate(r)
            return `<tr>
              <td>${escapeHtml(j.hcp_number ?? '—')}</td>
              <td style="line-height:1.2">${escapeHtml(j.job_name ?? '—')}<br />${escapeHtml(j.job_address ?? '—')}</td>
              <td>${escapeHtml(detail)}</td>
              <td style="text-align:center;line-height:1.2">${escapeHtml(dateDisplay)}<br />${escapeHtml(formatPrintDaysSince(ageDays))}</td>
              <td style="text-align:right">$${formatCurrency(amt)}</td>
            </tr>`
          })
          .join('')
        return `<section style="margin-bottom:1.25rem; page-break-inside:avoid">
  <h2 style="font-size:1.05rem; margin:0 0 0.35rem">${escapeHtml(sectionHeading)}</h2>
  ${contactBlock}
  <table>
    <thead><tr>
      <th>HCP</th><th style="text-align:left;line-height:1.15">Job<br />Address</th><th>Detail</th><th style="text-align:center;line-height:1.15">Billed<br />Days past</th><th style="text-align:right">Amount due</th>
    </tr></thead>
    <tbody>${linesHtml}
      <tr style="background:#f9fafb; font-weight:600">
        <td colspan="4" style="text-align:right">Subtotal:</td>
        <td style="text-align:right">$${formatCurrency(subtotal)}</td>
      </tr>
    </tbody>
  </table>
</section>`
      })
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  section h2 + p { word-break: break-word; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>${filterNote}
  ${sectionsHtml}
  <p style="margin-top:1rem; font-size:1rem; font-weight:600; text-align:right">Grand total: $${formatCurrency(grandTotal)}</p>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Allow pop-ups to print the report.', 'error')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
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
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
        .order('name')
      setCustomers((data as CustomerRow[]) ?? [])
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
    const isMasterOrAssistant = authRole === 'master_technician' || authRole === 'assistant' || myRole === 'master_technician' || myRole === 'assistant'
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
      setLaborModalOpen(true)
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
      openEditLaborJob(laborJob)
    } else {
      openNewLaborJob()
      setLaborJobNumber(editLaborHcp.trim())
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

  useEffect(() => {
    if (activeTab === 'sub_sheet_ledger') {
      const t = setTimeout(() => loadRoster(), 80)
      return () => clearTimeout(t)
    }
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && authUser?.id) loadServiceTypes()
  }, [authUser?.id, laborModalOpen, editingLaborJob])

  useEffect(() => {
    if (!(laborModalOpen || editingLaborJob)) return
    if (!laborCrewSearch.trim()) return
    setLaborModalInternalSubsOpen(true)
    setLaborModalOfficeTeamOpen(true)
  }, [laborCrewSearch, laborModalOpen, editingLaborJob])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && selectedServiceTypeId && authUser?.id) {
      setLaborBookEntriesVersionId(null)
      loadFixtureTypes()
      loadLaborBookVersions()
    }
  }, [laborModalOpen, editingLaborJob, selectedServiceTypeId, authUser?.id])

  useEffect(() => {
    if (laborBookEntriesVersionId) loadLaborBookEntries(laborBookEntriesVersionId)
    else setLaborBookEntries([])
  }, [laborBookEntriesVersionId])

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

  // Restore billing sort preference from localStorage (per user)
  useEffect(() => {
    if (authUser?.id && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`jobs_billing_sort_asc_${authUser.id}`)
        if (stored !== null) setBillingSortAsc(stored === 'true')
      } catch {
        /* ignore */
      }
    }
  }, [authUser?.id])

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

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q)
    )
  })

  const sortedBillingJobs = useMemo(() => {
    const arr = [...filteredJobs]
    arr.sort((a, b) => {
      const ha = (a.hcp_number ?? '').trim()
      const hb = (b.hcp_number ?? '').trim()
      const cmp = ha.localeCompare(hb, undefined, { numeric: true })
      return billingSortAsc ? cmp : -cmp
    })
    return arr
  }, [filteredJobs, billingSortAsc])

  const teamsSummaryData = useMemo(() => {
    const laborCostByName = new Map<string, number>()
    const billingByName = new Map<string, number>()

    for (const job of jobs) {
      const rev = job.revenue != null ? Number(job.revenue) : 0
      if (rev <= 0 || job.team_members.length === 0) continue
      const share = rev / job.team_members.length
      for (const tm of job.team_members) {
        const name = tm.users?.name ?? 'Unknown'
        billingByName.set(name, (billingByName.get(name) ?? 0) + share)
      }
    }

    for (const job of laborJobs) {
      const laborCost = laborJobSubCost(job, driveMileageCost ?? 0.70, driveTimePerMile ?? 0.02)
      const names = (job.assigned_to_name ?? '')
        .split(LABOR_ASSIGNED_DELIMITER)
        .map((n) => n.trim())
        .filter(Boolean)
      if (names.length === 0 || laborCost <= 0) continue
      const share = laborCost / names.length
      for (const name of names) {
        laborCostByName.set(name, (laborCostByName.get(name) ?? 0) + share)
      }
    }

    for (const row of teamLaborData) {
      for (const p of row.breakdown) {
        laborCostByName.set(p.personName, (laborCostByName.get(p.personName) ?? 0) + p.cost)
      }
    }

    const allNames = new Set<string>()
    for (const [name] of billingByName) allNames.add(name)
    for (const [name] of laborCostByName) allNames.add(name)
    const rows = [...allNames].sort((a, b) => a.localeCompare(b)).map((name) => ({
      name,
      laborCost: laborCostByName.get(name) ?? 0,
      billing: billingByName.get(name) ?? 0,
    }))

    const billingHcps = new Set(
      jobs.filter((j) => j.revenue != null && Number(j.revenue) > 0).map((j) => (j.hcp_number ?? '').trim().toLowerCase())
    )
    const laborHcps = new Set(
      laborJobs
        .filter((job) => laborItemsSubtotal(job.items, job.labor_rate ?? 0) > 0)
        .map((j) => (j.job_number ?? '').trim().toLowerCase())
    )
    const matchedHcps = new Set([...billingHcps].filter((h) => h && laborHcps.has(h)))

    const hcpByJobId = new Map<string, string>()
    for (const j of jobs) {
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) hcpByJobId.set(j.id, hcp)
    }

    let matchedLaborTotal = 0
    let matchedBillingTotal = 0
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    for (const job of laborJobs) {
      const hcp = (job.job_number ?? '').trim().toLowerCase()
      if (!hcp || !matchedHcps.has(hcp)) continue
      matchedLaborTotal += laborJobSubCost(job, mileageCost, timePerMile)
    }
    for (const row of teamLaborData) {
      const hcp = hcpByJobId.get(row.jobId)
      if (hcp && matchedHcps.has(hcp)) matchedLaborTotal += row.jobCost
    }
    for (const job of jobs) {
      const hcp = (job.hcp_number ?? '').trim().toLowerCase()
      if (!hcp || !matchedHcps.has(hcp) || job.revenue == null) continue
      matchedBillingTotal += Number(job.revenue)
    }

    return { rows, matchedLaborTotal, matchedBillingTotal }
  }, [jobs, laborJobs, teamLaborData, driveMileageCost, driveTimePerMile])

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

  const subLaborDueTotal = useMemo(() => {
    const q = subLaborSearch.trim().toLowerCase()
    const filtered = laborJobs.filter((job) => {
      if (!q) return true
      const contractor = (job.assigned_to_name ?? '').toLowerCase()
      const hcp = (job.job_number ?? '').toLowerCase()
      const addr = (job.address ?? '').toLowerCase()
      const jobName = laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]?.toLowerCase() ?? ''
      return contractor.includes(q) || hcp.includes(q) || addr.includes(q) || jobName.includes(q)
    })
    return filtered.reduce((sum, job) => {
      const jobRate = job.labor_rate ?? 0
      const laborTotal = laborItemsSubtotal(job.items, jobRate)
      let totalCost = laborTotal
      const jobPayments = job.payments ?? []
      const paid = jobPayments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
      const backcharges = jobPayments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
      if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
        totalCost = paid + backcharges
      }
      const balance = totalCost - paid - backcharges
      return sum + (balance > 0 ? balance : 0)
    }, 0)
  }, [laborJobs, subLaborSearch, laborJobNamesByHcp])

  function refreshCustomersAfterJobFormSave() {
    void (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
        .order('name')
      setCustomers((data as CustomerRow[]) ?? [])
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
    const remaining = Math.max(0, (Number(createPartialInvoiceJob.revenue ?? 0) - Number(createPartialInvoiceJob.payments_made ?? 0)))
    const amountToUseCents = Math.min(Math.round(amount * 100), Math.round(remaining * 100))
    const amountToUse = amountToUseCents / 100
    if (!(amountToUse > 0)) {
      setError('No remaining balance to bill')
      return
    }
    if (amountToUseCents < Math.round(amount * 100)) {
      showToast(`Adjusted to remaining balance ($${formatCurrency(amountToUse)})`, 'info')
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

  function fillLaborFromBilling() {
    const hcp = laborJobNumber.trim()
    if (!hcp) return
    const match = jobs.find((j) => (j.hcp_number ?? '').trim().toLowerCase() === hcp.toLowerCase())
    if (!match) return
    setLaborAddress(match.job_address ?? '')
    const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
    const teamNames = (match.team_members ?? [])
      .map((t) => t.users?.name?.trim())
      .filter((n): n is string => !!n && rosterNames.includes(n))
    setLaborAssignedTo(teamNames)
  }

  function fillLaborFromBillingJobAndSwitch(job: JobWithDetails) {
    setActiveTab('sub_sheet_ledger')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'sub_sheet_ledger')
      return next
    })
    resetLaborForm()
    setLaborJobNumber(job.hcp_number ?? '')
    setLaborAddress(job.job_address ?? '')
    const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
    const teamNames = (job.team_members ?? [])
      .map((t) => t.users?.name?.trim())
      .filter((n): n is string => !!n && rosterNames.includes(n))
    setLaborAssignedTo(teamNames)
    setLaborModalOpen(true)
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
    authRole !== 'master_technician' && authRole !== 'assistant' &&
    authRole !== 'superintendent' && myRole !== 'superintendent' &&
    myRole !== 'master_technician' && myRole !== 'assistant'
  const showTeamLaborTab = authRole !== 'assistant' && myRole !== 'assistant' &&
    authRole !== 'superintendent' && myRole !== 'superintendent'
  const showSuperintendentExtraTabs = !isSuperintendent

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', overflow: 'hidden' }}>
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
            style={pageUnderlineTabStyle(activeTab === 'teams-summary')}
          >
            Teams
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
            style={pageUnderlineTabStyle(activeTab === 'reports')}
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
            style={pageUnderlineTabStyle(activeTab === 'stages')}
          >
            Stages
          </button>
        )}
        {showPrimaryRestrictedTabs && (
          <>
          {showStagesAndBillingTabs && (
            <>
            <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
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
              style={pageUnderlineTabStyle(activeTab === 'billing')}
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
            style={pageUnderlineTabStyle(activeTab === 'combined-labor')}
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
            style={pageUnderlineTabStyle(activeTab === 'sub_sheet_ledger')}
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
            style={pageUnderlineTabStyle(activeTab === 'parts')}
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
            style={pageUnderlineTabStyle(activeTab === 'job-summary')}
          >
            Job Summary
          </button>
        )}
        {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
          <>
          <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
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
            style={pageUnderlineTabStyle(activeTab === 'inspections')}
          >
            Inspections
          </button>
          </>
        )}
          </div>
        </div>
        <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Jobs</h1>
      </div>

      {searchParams.get('customer') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.875rem' }}>
          <span style={{ color: '#1e40af' }}>Filtered by customer</span>
          <button
            type="button"
            onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('customer'); return n })}
            style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', color: '#1e40af', fontSize: '0.8125rem' }}
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
            <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error || jobsListError}</p>
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
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
            {(['dev', 'master_technician', 'assistant'] as const).some(
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
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: 'pointer',
                  color: '#6b7280',
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
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: stagesIncludeScheduleTimeInSearch ? '#eff6ff' : 'white',
                cursor: 'pointer',
                color: stagesIncludeScheduleTimeInSearch ? '#2563eb' : '#6b7280',
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
                  color: '#6b7280',
                  lineHeight: 1.25,
                  textAlign: 'left',
                }}
              >
                <span>Search includes schedule</span>
                <span>and session notes</span>
              </span>
            ) : null}
            {(['dev', 'assistant'] as const).includes((authRole || myRole) as 'dev' | 'assistant') && (
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
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: stagesHamMode ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  color: stagesHamMode ? '#2563eb' : '#6b7280',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M224 329.2C224 337.7 220.6 345.8 214.6 351.8L187.8 378.6C175.5 390.9 155.3 390 138.4 385.8C133.8 384.7 128.9 384 123.9 384C90.8 384 63.9 410.9 63.9 444C63.9 477.1 90.8 504 123.9 504C130.2 504 135.9 509.7 135.9 516C135.9 549.1 162.8 576 195.9 576C229 576 255.9 549.1 255.9 516C255.9 511 255.3 506.2 254.1 501.5C249.9 484.6 248.9 464.4 261.3 452.1L288.1 425.3C294.1 419.3 302.2 415.9 310.7 415.9L399.9 415.9C406.2 415.9 412.3 415.6 418.4 414.9C430.3 413.7 434.8 399.4 429.2 388.9C420.7 373.1 415.9 355.1 415.9 335.9C415.9 274 466 223.9 527.9 223.9C535.9 223.9 543.6 224.7 551.1 226.3C562.8 228.8 575.2 220.4 573.1 208.7C558.4 126.4 486.4 63.9 399.9 63.9C302.7 63.9 223.9 142.7 223.9 239.9L223.9 329.1z" />
                </svg>
              </button>
            )}
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
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} aria-hidden>
                <path
                  fill="currentColor"
                  d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 152C192 165.3 202.7 176 216 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L216 128C202.7 128 192 138.7 192 152zM192 248C192 261.3 202.7 272 216 272L264 272C277.3 272 288 261.3 288 248C288 234.7 277.3 224 264 224L216 224C202.7 224 192 234.7 192 248zM304 324L304 328C275.2 328.3 252 351.7 252 380.5C252 406.2 270.5 428.1 295.9 432.3L337.6 439.3C343.6 440.3 348 445.5 348 451.6C348 458.5 342.4 464.1 335.5 464.1L280 464C269 464 260 473 260 484C260 495 269 504 280 504L304 504L304 508C304 519 313 528 324 528C335 528 344 519 344 508L344 503.3C369 499.2 388 477.6 388 451.5C388 425.8 369.5 403.9 344.1 399.7L302.4 392.7C296.4 391.7 292 386.5 292 380.4C292 373.5 297.6 367.9 304.5 367.9L352 367.9C363 367.9 372 358.9 372 347.9C372 336.9 363 327.9 352 327.9L344 327.9L344 323.9C344 312.9 335 303.9 324 303.9C313 303.9 304 312.9 304 323.9z"
                />
              </svg>
            </button>
            {(['dev', 'master_technician', 'assistant'] as const).some(
              (r) => r === authRole || r === myRole,
            ) ? (
              <button
                type="button"
                onClick={() => setCombineSeparateModalOpen(true)}
                title="Combine two jobs or split Specific Work into a new job"
                aria-label="Combine or separate jobs"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
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
              color: '#374151',
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
                    color: '#1d4ed8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Waiting
                </button>
                <span>({stagesBoardLists.waiting.length})</span>
              </span>
              <span style={{ color: '#9ca3af', userSelect: 'none' }} aria-hidden>
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
                    color: '#1d4ed8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Working
                </button>
                <span>({stagesBoardLists.working.length})</span>
              </span>
              <span style={{ color: '#9ca3af', userSelect: 'none' }} aria-hidden>
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
                    color: '#1d4ed8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Ready to Bill
                </button>
                <span>({stagesBoardLists.readyToBillRows.length})</span>
              </span>
              <span style={{ color: '#9ca3af', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('billed')}
                  aria-label={`Jump to Billed Awaiting Payment, ${stagesBoardLists.billedRows.length} rows`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: '#1d4ed8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Billed Awaiting Payment
                </button>
                <span>({stagesBoardLists.billedRows.length})</span>
              </span>
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
                      background: '#fef2f2',
                      color: stagesNoCustomerBtnHover ? '#991b1b' : '#b91c1c',
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
                      background: '#fef2f2',
                      color: stagesNoJobPicturesBtnHover ? '#991b1b' : '#b91c1c',
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
                <p style={{ color: '#6b7280', margin: 0 }}>
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
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>Updating jobs…</p>
              )}
            </div>
          )}
          {(() => {
            const { waiting, working, paid, readyToBillRows, billedRows } = stagesBoardLists

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
              const t = (job.hcp_number ?? '').trim()
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
                      background: tagInfo ? borderColor : '#f3f4f6',
                      color: tagInfo ? '#fff' : '#374151',
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
                <div style={{ fontSize: '0.75rem', color: '#6b7280', ...extraWrap }}>—</div>
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
                color: '#6b7280',
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
                    color: '#6b7280',
                    marginTop: '0.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                  }}
                >
                  <span>Customer: {(job.customer_name ?? '').trim() || '—'}</span>
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
                        background: '#fef3c7',
                        color: '#92400e',
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
                    color: '#374151',
                    fontSize: '0.75rem',
                    lineHeight: 1.1,
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
                  {count > 0 ? (
                    <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>{count}</span>
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
                        color: '#374151',
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
                    {canOpenJobScheduleModal ? (
                      <button
                        type="button"
                        onClick={() => setScheduleModalJob(job)}
                        disabled={scheduleNoTeam}
                        title={scheduleNoTeam ? 'Assign team members to open schedule' : 'Open schedule'}
                        aria-label={scheduleNoTeam ? 'Schedule: assign team members first' : 'Open schedule'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.25rem',
                          border: 'none',
                          background: 'none',
                          cursor: scheduleNoTeam ? 'not-allowed' : 'pointer',
                          color: scheduleNoTeam ? '#9ca3af' : '#16a34a',
                          flexShrink: 0,
                          alignSelf: 'flex-start',
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
                      color: '#6b7280',
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
                        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>—</span>
                      </div>
                      {renderStagesStripeEmailedCustomerHint()}
                      {renderStagesInvoiceJumpChips(job)}
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
                        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>—</span>
                      </div>
                      {renderStagesStripeEmailedCustomerHint()}
                      {renderStagesInvoiceJumpChips(job)}
                    </div>
                  </td>
                )
              }
              const useReport = tReport != null && (tNote == null || tReport > tNote)
              const atIso = useReport ? stat.last_report_at! : stat.last_note_at!
              const meta = getDispatchNoteDisplayMeta(atIso)
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
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.2rem' }}>
                        {author ? <span>{author}</span> : null}
                        {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
                        <span>{meta.weekdayTimeChicago}</span>
                        <span style={{ marginLeft: '0.35rem' }}>({meta.daysAgoLabel})</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: '#374151',
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
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td
                    colSpan={colSpan}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#eff6ff',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <Link to={`/workflows/${projectId}`} style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}>
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
                <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
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

            function renderStagesTable(jobList: JobWithDetails[], actionLabel: React.ReactNode | null, onAction: (j: JobWithDetails) => void, showTimeOpen?: boolean, onSendBack?: (j: JobWithDetails) => void, onSendBackSimple?: (j: JobWithDetails) => void, showRemaining?: boolean, showFinalBill?: boolean, showPctComplete?: boolean) {
              const stagesTableColCount = 6 + (showPctComplete ? 1 : 0)
              return (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '6.75rem',
                          }}
                        >
                          {renderStagesThreeLineHeader('Assigned', 'HCP', 'Last-Activity')}
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>Last activity</th>
                        {showPctComplete && (
                          <th
                            style={{
                              padding: '0.75rem',
                              textAlign: 'center',
                              borderBottom: '1px solid #e5e7eb',
                              minWidth: '8.5rem',
                            }}
                          >
                            {renderStagesThreeLineHeader('% Complete', 'Value Created', 'Could Bill')}
                          </th>
                        )}
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            borderBottom: '1px solid #e5e7eb',
                            ...(showRemaining ? { minWidth: '7rem' } : {}),
                          }}
                        >
                          {showRemaining
                            ? renderStagesThreeLineHeader('Paid', 'Left', 'Total Bill')
                            : showFinalBill
                              ? 'Final Bill'
                              : 'Revenue'}
                        </th>
                        <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid #e5e7eb' }} />
                        <th style={{ padding: '0.75rem', width: 120, borderBottom: '1px solid #e5e7eb' }}>View<br />Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobList.length === 0 ? (
                        <tr>
                          <td colSpan={stagesTableColCount} style={{ padding: '0.75rem', color: '#6b7280' }}>
                            No jobs in this group
                          </td>
                        </tr>
                      ) : (
                        jobList.map((j) => (
                          <Fragment key={j.id}>
                          <tr
                            style={{
                              borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
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
                                        color: '#6b7280',
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
                                          background: 'white',
                                          border: '1px solid #d1d5db',
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
                                              color: '#6b7280',
                                              border: '1px solid #d1d5db',
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
                              {(() => {
                                const fmt = formatAddressTwoLines(j.job_address)
                                if (!fmt) return null
                                return (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                    <div>{fmt.line1}</div>
                                    {fmt.line2 && <div>{fmt.line2}</div>}
                                  </div>
                                )
                              })()}
                              {renderJobCustomerLine(j)}
                              {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                            </td>
                            {renderStagesLastActivityCell(j, stagesJobLevelStripeEmailedHintInvoice(j))}
                            {showPctComplete && (
                              <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.15rem' }}>
                                    <input
                                      key={`pct-${j.id}-${j.pct_complete ?? 'null'}`}
                                      type="number"
                                      min={0}
                                      max={100}
                                      defaultValue={j.pct_complete != null ? j.pct_complete : ''}
                                      onBlur={(e) => {
                                        const v = e.target.value.trim()
                                        if (v === '') {
                                          updateJobPctComplete(j.id, null)
                                          return
                                        }
                                        const n = Math.round(Number(v))
                                        if (!Number.isNaN(n) && n >= 0 && n <= 100) {
                                          updateJobPctComplete(j.id, n)
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur()
                                        }
                                      }}
                                      disabled={pctCompleteSavingId === j.id}
                                      placeholder=""
                                      style={{
                                        width: '3.5rem',
                                        padding: '0.25rem 0.35rem',
                                        fontSize: '0.8125rem',
                                        textAlign: 'center',
                                        border: 'none',
                                        borderBottom: '1px solid #d1d5db',
                                        borderRadius: 0,
                                        background: 'transparent',
                                      }}
                                    />
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>%</span>
                                  </div>
                                  <div style={{ fontSize: '0.8125rem' }}>
                                    {j.pct_complete != null
                                      ? `${formatUsdNoCents((Number(j.revenue ?? 0) * j.pct_complete) / 100)} done`
                                      : '—'}
                                  </div>
                                  {(() => {
                                    const totalBill = Number(j.revenue ?? 0)
                                    const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
                                    const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
                                    const toBill = valueCreated - (totalBill - remaining)
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        {valueCreated === 0 || toBill === 0 ? '—' : `${formatUsdNoCents(toBill)} to bill`}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              {showRemaining
                                ? (() => {
                                    const rev = j.revenue != null ? Number(j.revenue) : 0
                                    const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{pm > 0 ? `${formatUsdNoCents(pm)} paid` : '—'}</span>
                                        <span>{rev > 0 || pm > 0 ? `${formatUsdNoCents(rev - pm)} left` : '—'}</span>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{j.revenue != null ? `${formatUsdNoCents(Number(j.revenue))} bid` : '—'}</span>
                                      </div>
                                    )
                                  })()
                                : (j.revenue != null ? formatCurrency(Number(j.revenue)) : '—')}
                            </td>
                            <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {showTimeOpen && (
                                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
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
                                          color: '#6b7280',
                                          border: '1px solid #d1d5db',
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
                                          color: '#6b7280',
                                          border: '1px solid #d1d5db',
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
                                    {(() => {
                                      const rem = Math.max(0, (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)))
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                          disabled={rem <= 0}
                                          title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                          aria-label="Create partial invoice"
                                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? '#9ca3af' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                            <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
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
                                    <button
                                      type="button"
                                      onClick={() => openEdit(j)}
                                      title="Edit"
                                      aria-label="Edit"
                                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{
                                  fontSize: '0.8125rem',
                                  color: ((j.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                  fontWeight: ((j.report_count ?? 0) > 0) ? 600 : 400,
                                  textAlign: 'center',
                                }}>
                                  {(j.report_count ?? 0)} report{(j.report_count ?? 0) !== 1 ? 's' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  View<br />Reports
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedJobThreadId === j.id && (
                            <tr>
                              <td
                                colSpan={stagesTableColCount}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  background: '#f9fafb',
                                  borderBottom: '1px solid #e5e7eb',
                                }}
                              >
                                <JobThreadNotesPanel
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
              } = options
              const unifiedStagesColCount = 6
              const flashRowStyle = (invoiceId: string): CSSProperties =>
                flashInvoiceId === invoiceId
                  ? {
                      backgroundColor: '#fef3c7',
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
                color: '#6b7280',
                border: '1px solid #d1d5db',
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
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '6.75rem',
                          }}
                        >
                          {renderStagesThreeLineHeader('Assigned', 'HCP', 'Last-Activity')}
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>Last activity</th>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '7rem',
                          }}
                        >
                          {renderStagesThreeLineHeader('Paid', 'Left', 'Total Bill')}
                        </th>
                        <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid #e5e7eb' }} />
                        <th style={{ padding: '0.75rem', width: 120, borderBottom: '1px solid #e5e7eb' }}>View<br />Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={unifiedStagesColCount} style={{ padding: '0.75rem', color: '#6b7280' }}>
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
                                style={{
                                  borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                                  ...(bundleInv != null ? flashRowStyle(bundleInv.id) : {}),
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
                                          color: '#6b7280',
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
                                            background: 'white',
                                            border: '1px solid #d1d5db',
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
                                                color: '#6b7280',
                                                border: '1px solid #d1d5db',
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
                                  {(() => {
                                    const fmt = formatAddressTwoLines(j.job_address)
                                    if (!fmt) return null
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div>{fmt.line2}</div>}
                                      </div>
                                    )
                                  })()}
                                  {renderJobCustomerLine(j)}
                                  {bundleInv != null ? (
                                    <div
                                      style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '0.25rem' }}
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
                                        {showRemaining && (() => {
                                          const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                          return <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{pm > 0 ? `${formatUsdNoCents(pm)} paid` : '—'}</span>
                                        })()}
                                        <span>
                                          {showRemaining
                                            ? (() => {
                                                const u = jobBillingUnallocatedDollars(j)
                                                const rev = j.revenue != null ? Number(j.revenue) : 0
                                                const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                                return rev > 0 || pm > 0 || u > 0 ? (
                                                  <span title="Left on the job after draft and billed invoice lines">
                                                    {`${formatUsdNoCents(u)} left`}
                                                  </span>
                                                ) : (
                                                  '—'
                                                )
                                              })()
                                            : (j.revenue != null ? formatCurrencyNoCents(Number(j.revenue)) : '—')}
                                        </span>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{j.revenue != null ? `${formatUsdNoCents(Number(j.revenue))} bid` : '—'}</span>
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
                                      </>
                                    ) : (
                                      <>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                                          {row.kind === 'job_with_merged_billed'
                                            ? (() => {
                                                const ap = sumInvoiceAppliedFromJobPayments(j, bundleInv.id)
                                                return ap > 0 ? `${formatUsdNoCents(ap)} paid` : '—'
                                              })()
                                            : Number(j.payments_made ?? 0) > 0
                                              ? `${formatUsdNoCents(Number(j.payments_made ?? 0))} paid`
                                              : '—'}
                                        </span>
                                        <span>
                                          {row.kind === 'job_with_merged_billed'
                                            ? `${formatUsdNoCents(invoiceOpenRemainingOnJob(bundleInv, j))} left`
                                            : `${formatUsdNoCents(Number(bundleInv.amount))} remainder`}
                                        </span>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{j.revenue != null ? `${formatUsdNoCents(Number(j.revenue))} bid` : '—'}</span>
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
                                          background: 'white',
                                          color: '#2563eb',
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
                                          background: 'white',
                                          color: '#2563eb',
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
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
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
                                      {showCreatePartialInvoice && (() => {
                                        const rem = Math.max(0, (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)))
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                            disabled={rem <= 0}
                                            title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                            aria-label="Create partial invoice"
                                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? '#9ca3af' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                              <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
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
                                      <button
                                        type="button"
                                        onClick={() => openEdit(j)}
                                        title="Edit"
                                        aria-label="Edit"
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{
                                      fontSize: '0.8125rem',
                                      color: ((j.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                      fontWeight: ((j.report_count ?? 0) > 0) ? 600 : 400,
                                      textAlign: 'center',
                                    }}>
                                      {(j.report_count ?? 0)} report{(j.report_count ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View<br />Reports
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedJobThreadId === j.id && (
                                <tr>
                                  <td
                                    colSpan={unifiedStagesColCount}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      background: '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb',
                                    }}
                                  >
                                    <JobThreadNotesPanel
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
                                style={{
                                  borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid #e5e7eb',
                                  ...flashRowStyle(inv.id),
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
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
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
                                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{display}</div>
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
                                                border: '1px solid #d1d5db',
                                                borderRadius: 4,
                                                background: 'none',
                                                cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                                color: '#6b7280',
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
                                                border: '1px solid #d1d5db',
                                                borderRadius: 4,
                                                background: 'none',
                                                cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                                color: '#6b7280',
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
                                                color: '#374151',
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
                                        {fmt.line2 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                                      </>
                                    )
                                  })()}
                                  {(() => {
                                    const fmt = formatAddressTwoLines(job.job_address)
                                    if (!fmt) return null
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div>{fmt.line2}</div>}
                                      </div>
                                    )
                                  })()}
                                  {renderJobCustomerLine(job)}
                                  {renderStagesJobColumnEstimateFooter(job.linkedEstimateForStages)}
                                </td>
                                {renderStagesLastActivityCell(job, inv)}
                                <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                                      {Number(job.payments_made ?? 0) > 0 ? `${formatUsdNoCents(Number(job.payments_made ?? 0))} paid` : '—'}
                                    </span>
                                    <span title="Amount on this draft billing line">{`${formatUsdNoCents(Number(inv.amount))} draft`}</span>
                                    {showRemaining ? (() => {
                                      const u = jobBillingUnallocatedDollars(job)
                                      return u > 0 ? (
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }} title="Left on the job after all draft and billed lines">
                                          {`${formatUsdNoCents(u)} left`}
                                        </span>
                                      ) : null
                                    })() : null}
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{job.revenue != null ? `${formatUsdNoCents(Number(job.revenue))} bid` : '—'}</span>
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
                                          background: 'white',
                                          color: '#2563eb',
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
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{
                                      fontSize: '0.8125rem',
                                      color: ((job.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                      fontWeight: ((job.report_count ?? 0) > 0) ? 600 : 400,
                                      textAlign: 'center',
                                    }}>
                                      {(job.report_count ?? 0)} report{(job.report_count ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setViewReportsJob({ id: job.id, hcpNumber: job.hcp_number ?? '—', jobName: job.job_name ?? '—', jobAddress: job.job_address ?? '—' })}
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View<br />Reports
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedJobThreadId === job.id && (
                                <tr>
                                  <td
                                    colSpan={unifiedStagesColCount}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      background: '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb',
                                    }}
                                  >
                                    <JobThreadNotesPanel
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
            const billedTotal = billedRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
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
                  true, undefined, undefined, true, undefined, true
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
                    style={{ fontSize: '0.9375rem', color: '#6b7280', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  true, undefined, true
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
                      Billed Awaiting Payment ({billedRows.length}) - ${formatCurrency(billedTotal)}
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#6b7280' }}>
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
                          authRole === 'assistant' ||
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
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            authRole === 'assistant' ||
                            authRole === 'primary'
                          )
                            ? '#f3f4f6'
                            : 'white',
                        cursor:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            authRole === 'assistant' ||
                            authRole === 'primary'
                          )
                            ? 'not-allowed'
                            : 'pointer',
                        color: '#374151',
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
                    onClick={() => printBilledAwaitingPaymentReport(billedRows, { searchFilter: stagesSearchQuery })}
                    disabled={billedRows.length === 0}
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
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: billedRows.length === 0 ? '#f3f4f6' : 'white',
                      cursor: billedRows.length === 0 ? 'not-allowed' : 'pointer',
                      color: '#374151',
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
                {stagesSectionOpen.billed && renderUnifiedStagesTable(billedRows, {
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
                })}

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
                          <span style={{ color: '#dc2626' }}>Expand to load</span>)
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
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem' }} role="status">
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
                      false,
                      true,
                    )}
                  </>
                ) : null}

                {billedTotalByNameModalOpen && (() => {
                  const byNameRows = new Map<string, StageRow[]>()
                  for (const r of billedRows) {
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
                      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Billed Awaiting Payment by Job Name</h2>
                          <button
                            type="button"
                            onClick={() => printBilledAwaitingPaymentReport(billedRows, { searchFilter: stagesSearchQuery })}
                            disabled={billedRows.length === 0}
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
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: billedRows.length === 0 ? '#f3f4f6' : 'white',
                              cursor: billedRows.length === 0 ? 'not-allowed' : 'pointer',
                              color: '#374151',
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
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid #e5e7eb' }}>
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
                                          color: '#111827',
                                          fontSize: 'inherit',
                                          textAlign: 'left',
                                          maxWidth: '100%',
                                        }}
                                      >
                                        <span aria-hidden style={{ fontSize: '0.65rem', color: '#6b7280' }}>
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
                                            idx === entries.length - 1 ? 'none' : '1px solid #e5e7eb',
                                          background: '#f9fafb',
                                        }}
                                      >
                                        <div id={panelId} role="region" aria-labelledby={`total-by-name-toggle-${idx}`} style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Line</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Amount</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Age</th>
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
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: '#6b7280' }}>{ageLabel}</td>
                                                    </tr>
                                                    <tr
                                                      style={{
                                                        borderBottom: isLastBillInGroup ? 'none' : '1px solid #e5e7eb',
                                                      }}
                                                    >
                                                      <td
                                                        colSpan={3}
                                                        style={{
                                                          padding: '0 0.5rem 0.35rem',
                                                          fontSize: '0.75rem',
                                                          color: '#6b7280',
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
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Billed
                          </button>
                          <button type="button" onClick={() => setBilledTotalByNameModalOpen(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
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
                      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          Jobs in Working with billable value. Sorted by amount.
                        </p>
                        {rows.length === 0 ? (
                          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>No jobs with billable amount</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                                <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <div>{job.job_name || '—'}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{job.hcp_number || '—'}</div>
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
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
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
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Working
                          </button>
                          <button type="button" onClick={() => setCapableToBillModalOpen(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {whenInvoiceBillModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
                      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Est. bill date for partial invoice</h2>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        {whenInvoiceBillModal.jobName} ({whenInvoiceBillModal.hcpNumber})
                      </p>
                      <label style={{ display: 'block', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
                        <input
                          type="date"
                          value={whenInvoiceBillModalDate}
                          onChange={(e) => setWhenInvoiceBillModalDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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
          myRole={myRole}
          onNewLaborJob={openNewLaborJob}
          onEditLaborJob={openEditLaborJob}
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
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
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
        <div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
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
              type="search"
              placeholder="Search jobs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 200px',
                minWidth: 200,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
            <button
              type="button"
              onClick={() => {
                setBillingSortAsc((prev) => {
                  const next = !prev
                  if (authUser?.id && typeof window !== 'undefined') {
                    try {
                      localStorage.setItem(`jobs_billing_sort_asc_${authUser.id}`, String(next))
                    } catch {
                      /* ignore */
                    }
                  }
                  return next
                })
              }}
              title={billingSortAsc ? 'Lowest HCP first (click to reverse)' : 'Highest HCP first (click to reverse)'}
              aria-label={billingSortAsc ? 'Sort ascending' : 'Sort descending'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              {billingSortAsc ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M7 14l5-5 5 5H7z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M7 10l5 5 5-5H7z" />
                </svg>
              )}
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Assistants see jobs from their master and from other assistants adopted by the same master. If you don&apos;t see a colleague&apos;s jobs, the master must adopt both of you in Settings → Adopt Assistants.
          </p>
          {(error || jobsListError) && (
            <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error || jobsListError}</p>
          )}
          {jobsListLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : null}
          {jobsListRefreshing && !jobsListLoading && (
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Updating…</p>
          )}
          {!jobsListLoading && (sortedBillingJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No HCP jobs yet. Click New Job to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Specific Work</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Other job charges</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractors</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', width: 100, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedBillingJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {job.hcp_number || '—'}
                        {job.hcp_number && authRole !== 'primary' && !laborJobHcps.has((job.hcp_number ?? '').trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => fillLaborFromBillingJobAndSwitch(job)}
                            title="Add Labor: fill from Billing and open Labor"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                              <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                            </svg>
                          </button>
                        )}
                        {job.hcp_number && authRole !== 'primary' && !teamLaborLoading && !teamLaborJobIds.has(job.id) && (
                          <span
                            title="No Team Job Labor for this job"
                            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                              <path d="M240 104C240 73.1 265.1 48 296 48C326.9 48 352 73.1 352 104C352 134.9 326.9 160 296 160C265.1 160 240 134.9 240 104zM42.5 245.3C48.4 233.4 62.8 228.6 74.7 234.6L99.3 246.9L111.5 226.5C130.4 195 164.7 176 201.1 176C247.3 176 288.8 206.5 301.6 251.4L333.8 364.1L426.7 410.5L452.5 367.5C458.3 357.9 468.7 352 479.9 352C491.1 352 501.6 357.9 507.3 367.5L603.3 527.5C609.2 537.4 609.4 549.7 603.7 559.7C598 569.7 587.5 576 576 576L384 576C372.5 576 361.8 569.8 356.2 559.8C350.6 549.8 350.7 537.5 356.6 527.6L402 451.8L53.3 277.5C41.4 271.6 36.6 257.2 42.6 245.3zM126.3 371.4L238.3 427.4C249.1 432.8 256 443.9 256 456L256 544C256 561.7 241.7 576 224 576C206.3 576 192 561.7 192 544L192 475.8L130.7 445.1L94.4 554.1C88.8 570.9 70.7 579.9 53.9 574.3C37.1 568.7 28.1 550.6 33.7 533.9L81.7 389.9C84.6 381.1 91.2 374 99.8 370.5C108.4 367 118.1 367.3 126.4 371.4z" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{job.job_name || '—'}</div>
                        {(() => {
                          const fmt = formatAddressTwoLines(job.job_address)
                          if (!fmt) return null
                          return (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                              <div>{fmt.line1}</div>
                              {fmt.line2 && <div>{fmt.line2}</div>}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 180 }}>
                        {job.fixtures.length === 0
                          ? '—'
                          : job.fixtures
                              .filter((f) => (f.name ?? '').trim())
                              .map((f) => {
                                let line = f.count > 1 ? `${f.name} × ${f.count}` : f.name
                                if (
                                  f.line_unit_price != null &&
                                  Number.isFinite(Number(f.line_unit_price)) &&
                                  Number(f.line_unit_price) > 0
                                ) {
                                  line += ` @ $${formatCurrency(Number(f.line_unit_price))}`
                                }
                                const desc = (f.line_description ?? '').trim()
                                if (desc) line += `\n${desc}`
                                return line
                              })
                              .join('\n')}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                        {job.materials.length === 0
                          ? '—'
                          : job.materials
                              .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
                              .map((m) => `${(m.description || '').trim() || 'Item'}: $${formatCurrency(Number(m.amount))}`)
                              .join('\n')}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {job.team_members.length === 0
                          ? '—'
                          : job.team_members.map((t) => t.users?.name ?? 'Unknown').join(', ')}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {job.revenue != null ? `$${formatCurrency(Number(job.revenue))}` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {(job.google_drive_link?.trim() || job.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                              {job.google_drive_link?.trim() && (
                                <a
                                  href={job.google_drive_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.google_drive_link!.trim()) }}
                                  title="Google Drive"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.25rem' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                                  </svg>
                                </a>
                              )}
                              {job.job_plans_link?.trim() && (
                                <a
                                  href={job.job_plans_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.job_plans_link!.trim()) }}
                                  title="Job Plans"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.25rem' }}
                                >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(job)}
                            title="Edit"
                            aria-label="Edit"
                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                              <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'teams-summary' && (
        <div>
          {teamsSummaryData.rows.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Add billing jobs and labor jobs to see the summary.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Labor Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsSummaryData.rows.map((row) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem' }}>{row.name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.laborCost)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.billing)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600, background: '#f9fafb' }}>
                    <td style={{ padding: '0.75rem' }}>Total (matched jobs only)</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(teamsSummaryData.matchedLaborTotal)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(teamsSummaryData.matchedBillingTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
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
          setJobSummaryCostDrilldown={setJobSummaryCostDrilldown}
          printCostBreakdownJobId={printCostBreakdownJobId}
          setPrintCostBreakdownJobId={setPrintCostBreakdownJobId}
          canAccessBankingForParts={canAccessBankingForParts}
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

      {(laborModalOpen || editingLaborJob) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{editingLaborJob ? 'Edit Sub Labor' : 'New Sub Labor'}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editingLaborJob) saveEditedLaborJob(e)
                else saveLaborJob()
              }}
            >
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', whiteSpace: 'pre-line' }}>{error}</p>}
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: 0, marginBottom: '0.5rem' }}>
                {laborFixtureEntryMode === 'simple'
                  ? 'Required: Address, Distance (mi), at least one contractor (External Subs, Internal Subs, or Office Team), and at least one line item with a description and cost greater than 0.'
                  : 'Required: Address, Distance (mi), at least one contractor (External Subs, Internal Subs, or Office Team), and at least one fixture with a name and count > 0 (or hrs/unit for fixed items).'}
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                    <label style={{ fontWeight: 500, margin: 0 }}>HCP</label>
                    {!editingLaborJob && (
                      <button
                        type="button"
                        onClick={fillLaborFromBilling}
                        disabled={!laborJobNumber.trim()}
                        title="Fill Contractors and Address from Billing if HCP matches"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: laborJobNumber.trim() ? 'pointer' : 'default',
                          fontSize: '0.8125rem',
                          color: laborJobNumber.trim() ? '#2563eb' : '#9ca3af',
                        }}
                      >
                        fill
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={laborJobNumber}
                    onChange={(e) => setLaborJobNumber(e.target.value)}
                    maxLength={10}
                    placeholder="Optional"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="text"
                    value={laborAddress}
                    onChange={(e) => setLaborAddress(e.target.value)}
                    placeholder="Job address"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '0 0 110px', minWidth: 110 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, whiteSpace: 'nowrap' }}>Distance (mi) <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    step={0.1}
                    value={laborDistance}
                    onChange={(e) => setLaborDistance(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date of Labor</label>
                  <input
                    type="date"
                    value={laborDate}
                    onChange={(e) => setLaborDate(e.target.value)}
                    style={{ width: '11ch', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                {serviceTypes.length > 1 && (
                  <div style={{ flex: '0 0 auto' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Service type</label>
                    <select
                      value={selectedServiceTypeId}
                      onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                      style={{ width: 'max-content', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                    >
                      {serviceTypes.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Subcontractors <span style={{ color: '#b91c1c' }}>*</span></div>
                    <input
                      id="labor-crew-search"
                      type="search"
                      value={laborCrewSearch}
                      onChange={(e) => setLaborCrewSearch(e.target.value)}
                      placeholder="Search for crew"
                      aria-label="Search for crew"
                      autoComplete="off"
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '24rem',
                        marginTop: '0.35rem',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        marginBottom: '0.5rem',
                        padding: '0.4rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        fontSize: '0.875rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {laborCrewSearchActive &&
                      laborModalExternalSubsShown.length === 0 &&
                      laborModalInternalSubsShown.length === 0 &&
                      laborModalOfficeTeamShown.length === 0 && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center' }}>No crew match this search</p>
                    )}
                    {(!laborCrewSearchActive || laborModalExternalSubsShown.length > 0) && (
                      <>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem', marginTop: '0.5rem' }}>External Subs</div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto', flex: 1, minWidth: 0 }}>
                            {laborModalExternalSubsShown.map((n) => (
                              <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={laborAssignedTo.includes(n)}
                                  onChange={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                                  style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                />
                                <span>{n}</span>
                              </label>
                            ))}
                            {laborModalExternalSubsAll.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddSubcontractorModal(true)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                          >
                            Add Sub
                          </button>
                        </div>
                      </>
                    )}
                    {(!laborCrewSearchActive || laborModalInternalSubsShown.length > 0) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setLaborModalInternalSubsOpen((prev) => !prev)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: laborModalInternalSubsOpen ? 'flex-start' : 'center',
                            width: '100%',
                            gap: '0.35rem',
                            margin: 0,
                            marginTop: '0.5rem',
                            marginBottom: laborModalInternalSubsOpen ? '0.25rem' : 0,
                            padding: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: '#6b7280',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem' }}>{laborModalInternalSubsOpen ? '▼' : '▶'}</span>
                          Internal Subs
                        </button>
                        {laborModalInternalSubsOpen && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto' }}>
                            {laborModalInternalSubsShown.map((n) => (
                              <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={laborAssignedTo.includes(n)}
                                  onChange={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                                  style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                />
                                <span>{n}</span>
                              </label>
                            ))}
                            {laborModalInternalSubsAll.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                          </div>
                        )}
                      </>
                    )}
                  {(!laborCrewSearchActive || laborModalOfficeTeamShown.length > 0) && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setLaborModalOfficeTeamOpen((prev) => !prev)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: laborModalOfficeTeamOpen ? 'flex-start' : 'center',
                          width: '100%',
                          gap: '0.35rem',
                          margin: 0,
                          marginBottom: laborModalOfficeTeamOpen ? '0.25rem' : 0,
                          padding: 0,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#6b7280',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem' }}>{laborModalOfficeTeamOpen ? '▼' : '▶'}</span>
                        Office Team
                      </button>
                      {laborModalOfficeTeamOpen && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto' }}>
                          {laborModalOfficeTeamShown.map((n) => (
                            <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={laborAssignedTo.includes(n)}
                                onChange={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                                style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                              />
                              <span>{n}</span>
                            </label>
                          ))}
                          {laborModalOfficeTeamAll.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                {(() => {
                  const laborModalLineFallbackRate =
                    editingLaborJob?.labor_rate ??
                    laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
                    20
                  const laborModalLinesSubtotal = laborFixtureRows.reduce(
                    (s, r) => s + lineLaborCost(r, laborModalLineFallbackRate),
                    0
                  )
                  const itemizeTotalsFirstCell = (
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.875rem',
                          color: '#6b7280',
                          cursor: 'pointer',
                          userSelect: 'none',
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={laborFixtureEntryMode === 'itemized'}
                          onChange={(e) => handleLaborFixtureEntryModeToggle(e.target.checked)}
                          style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                        />
                        <span>Itemize hours and rate</span>
                      </label>
                    </td>
                  )
                  return (
                    <>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        {laborFixtureEntryMode === 'simple' ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f9fafb' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                  Specific Work (Line Items) <span style={{ color: '#b91c1c' }}>*</span>
                                </th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                                  Cost ($) <span style={{ color: '#b91c1c' }}>*</span>
                                </th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {laborFixtureRows.map((row) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <input
                                      type="text"
                                      value={row.fixture}
                                      onChange={(e) => updateLaborFixtureRow(row.id, { fixture: e.target.value })}
                                      placeholder="e.g. Toilet, Sink"
                                      style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={row.direct_labor_amount != null && row.direct_labor_amount !== 0 ? row.direct_labor_amount : ''}
                                      onChange={(e) => {
                                        const v = e.target.value.trim()
                                        updateLaborFixtureRow(row.id, {
                                          direct_labor_amount: v === '' ? null : parseFloat(v) || 0,
                                        })
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      placeholder="0"
                                      style={{ width: '6rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => removeLaborFixtureRow(row.id)}
                                      disabled={laborFixtureRows.length <= 1}
                                      style={{
                                        padding: '0.25rem',
                                        background: '#fee2e2',
                                        color: '#991b1c',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                                {itemizeTotalsFirstCell}
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(laborModalLinesSubtotal)}</td>
                                <td style={{ padding: '0.5rem' }} />
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f9fafb' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Specific Work (Line Items) <span style={{ color: '#b91c1c' }}>*</span></th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>hrs/unit</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>_</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Labor Hours</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Rate ($/hr)</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {laborFixtureRows.map((row) => {
                                const hrsPerUnit = Number(row.hrs_per_unit) || 0
                                const laborHrs = (row.is_fixed ?? false) ? hrsPerUnit : (Number(row.count) || 0) * hrsPerUnit
                                return (
                                  <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <input
                                        type="text"
                                        value={row.fixture}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { fixture: e.target.value })}
                                        placeholder="e.g. Toilet, Sink"
                                        style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={row.count || ''}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { count: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={row.hrs_per_unit || ''}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!row.is_fixed}
                                          onChange={(e) => updateLaborFixtureRow(row.id, { is_fixed: e.target.checked })}
                                          style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                        />
                                        <span style={{ color: '#6b7280' }}>fixed</span>
                                      </label>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500 }}>{laborHrs.toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={row.labor_rate != null && row.labor_rate !== 0 ? row.labor_rate : ''}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { labor_rate: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        placeholder="0"
                                        style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>
                                      ${formatCurrency(lineLaborCost(row, laborModalLineFallbackRate))}
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                      <button type="button" onClick={() => removeLaborFixtureRow(row.id)} disabled={laborFixtureRows.length <= 1} style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                                {itemizeTotalsFirstCell}
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                  {laborFixtureRows.reduce((s, r) => {
                                    const hrs = Number(r.hrs_per_unit) || 0
                                    return s + ((r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs)
                                  }, 0).toFixed(2)} hrs
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(laborModalLinesSubtotal)}</td>
                                <td style={{ padding: '0.5rem' }} />
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          marginTop: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (laborInvoiceLinkExpanded) {
                                cancelLaborInvoiceLinkDraft()
                              } else {
                                setLaborInvoiceLinkDraft(laborInvoiceLinkCommitted)
                                setLaborInvoiceLinkExpanded(true)
                              }
                            }}
                            style={{
                              padding: '0.5rem 1.25rem',
                              background: laborInvoiceLinkExpanded ? '#e5e7eb' : '#fff',
                              color: '#374151',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Link Invoice
                          </button>
                          {!laborInvoiceLinkExpanded && laborInvoiceLinkCommitted.trim() ? (
                            <span
                              style={{ fontSize: '0.8125rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(100%, 280px)' }}
                              title={laborInvoiceLinkCommitted}
                            >
                              Linked
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={addLaborFixtureRow}
                          style={{
                            padding: '0.5rem 1.25rem',
                            background: '#fff',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Add line item
                        </button>
                      </div>
                      {laborInvoiceLinkExpanded ? (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            background: '#f9fafb',
                          }}
                        >
                          <label htmlFor="labor-invoice-link" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>
                            Invoice link
                          </label>
                          <input
                            id="labor-invoice-link"
                            type="url"
                            value={laborInvoiceLinkDraft}
                            onChange={(e) => setLaborInvoiceLinkDraft(e.target.value)}
                            placeholder="https://..."
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.75rem' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={cancelLaborInvoiceLinkDraft}
                              disabled={laborInvoiceLinkSaving}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: '#f3f4f6',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: 4,
                                cursor: laborInvoiceLinkSaving ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveLaborInvoiceLinkDraft()}
                              disabled={laborInvoiceLinkSaving}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: laborInvoiceLinkSaving ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              {laborInvoiceLinkSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
                {laborFixtureRows.some((r) => (r.fixture ?? '').trim()) && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Total labor cost: ${formatCurrency(
                      laborItemsSubtotal(
                        laborFixtureRows,
                        editingLaborJob?.labor_rate ??
                          laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
                          20,
                      )
                    )}
                  </p>
                )}
              </div>
              {editingLaborJob && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                  {(() => {
                    const laborModalPayFallback =
                      editingLaborJob?.labor_rate ??
                      laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
                      20
                    const laborTotal = laborItemsSubtotal(laborFixtureRows, laborModalPayFallback)
                    let totalCost = laborTotal
                    const payments = editingLaborJob.payments ?? []
                    const paid = payments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
                    const backcharges = payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
                    if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
                      totalCost = paid + backcharges
                    }
                    const balance = totalCost - paid - backcharges
                    return (
                      <>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Total cost: ${formatCurrency(totalCost)} · Paid: ${formatCurrency(paid)} · Backcharges: ${formatCurrency(backcharges)} · {balance > 0 ? `$${formatCurrency(balance)} due` : balance < 0 ? `Over $${formatCurrency(-balance)}` : '$0.00 due'}</p>
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f9fafb' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Memo</th>
                                <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {(editingLaborJob.payments ?? []).map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>${formatCurrency(Number(p.amount))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo || '—'}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <button type="button" onClick={() => { setEditPaymentAmount(String(Math.abs(Number(p.amount)))); setEditPaymentMemo(p.memo ?? ''); setEditingPayment({ id: p.id, jobId: editingLaborJob.id, amount: Number(p.amount), memo: p.memo, isBackcharge: Number(p.amount) < 0 }) }} style={{ padding: '0.25rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>Edit</button>
                                  </td>
                                </tr>
                              ))}
                              {(editingLaborJob.payments ?? []).length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No payments yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => { setMakePaymentAmount(balance > 0 ? String(balance) : ''); setMakePaymentMemo(''); setMakePaymentLaborJob({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }) }} style={{ padding: '0.35rem 0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Payment</button>
                          <button type="button" onClick={() => { setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeLaborJob({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid }) }} style={{ padding: '0.35rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Backcharge</button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLaborBookSectionOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0,
                    marginBottom: laborBookSectionOpen ? '0.75rem' : 0,
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{laborBookSectionOpen ? '▼' : '▶'}</span>
                  Labor book
                </button>
                {laborBookSectionOpen && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Version</label>
                        <select
                          value={selectedLaborBookVersionId ?? ''}
                          onChange={(e) => setSelectedLaborBookVersionId(e.target.value || null)}
                          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '12rem' }}
                        >
                          {laborBookVersions.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={applyLaborBookHoursToPeople}
                        disabled={
                          applyingLaborBookHours ||
                          laborFixtureEntryMode === 'simple' ||
                          !selectedLaborBookVersionId ||
                          !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                        }
                        style={{
                          padding: '0.35rem 0.75rem',
                          background:
                            applyingLaborBookHours ||
                            laborFixtureEntryMode === 'simple' ||
                            !selectedLaborBookVersionId ||
                            !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                              ? '#9ca3af'
                              : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor:
                            applyingLaborBookHours ||
                            laborFixtureEntryMode === 'simple' ||
                            !selectedLaborBookVersionId ||
                            !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                              ? 'not-allowed'
                              : 'pointer',
                          fontSize: '0.875rem',
                        }}
                        title={laborFixtureEntryMode === 'simple' ? 'Switch to itemized mode to apply labor book hours' : undefined}
                      >
                        {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                      </button>
                      {laborBookApplyMessage && (
                        <span style={{ color: '#059669', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {laborBookVersions.map((v) => (
                        <span
                          key={v.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.35rem 0.5rem',
                            background: laborBookEntriesVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                            border: laborBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                            borderRadius: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => { setLaborBookEntriesVersionId(v.id); loadLaborBookEntries(v.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: laborBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                          >
                            {v.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditLaborVersion(v)}
                            style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                            title="Edit version name"
                          >
                            ✎
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={openNewLaborVersion}
                        style={{ padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        Add version
                      </button>
                    </div>
                    {laborBookEntriesVersionId && (
                      <>
                        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries (hrs per stage)</h4>
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f9fafb' }}>
                              <tr>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rough In (hrs)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Top Out (hrs)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Trim Set (hrs)</th>
                                <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {laborBookEntries.map((entry) => (
                                <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem' }}>
                                    {entry.fixture_types?.name ?? ''}
                                    {entry.alias_names?.length ? (
                                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                                    ) : null}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <button type="button" onClick={() => openEditLaborEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type="button"
                          onClick={openNewLaborEntry}
                          style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Add entry
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '1.25rem',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={closeLaborModal}
                  disabled={laborSaving}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: laborSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => editingLaborJob ? printJobSubSheet(editingLaborJob) : printLaborSubSheet()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#4b5563',
                    color: 'white',
                    border: '1px solid #4b5563',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Print
                </button>
                <button
                  type="submit"
                  disabled={!laborCanSubmit || laborSaving}
                  title={!laborCanSubmit ? `Required: ${laborMissingFields.join(', ')}` : undefined}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: laborCanSubmit && !laborSaving ? '#2563eb' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: laborCanSubmit && !laborSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {laborSaving ? 'Saving…' : 'Save'}
                </button>
                {!laborCanSubmit && !laborSaving && laborMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block', textAlign: 'left' }}>
                    <span style={{ display: 'block' }}>Required:</span>
                    {laborMissingFields.map((f) => (
                      <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                    ))}
                  </span>
                )}
                {editingLaborJob && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await deleteLaborJob(editingLaborJob.id)
                      if (ok) closeLaborModal()
                    }}
                    disabled={laborJobDeletingId === editingLaborJob.id}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: laborJobDeletingId === editingLaborJob.id ? '#fecaca' : '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: laborJobDeletingId === editingLaborJob.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {laborJobDeletingId === editingLaborJob.id ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSubcontractorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Add Sub</h3>
            {addSubcontractorError && (
              <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{addSubcontractorError}</p>
            )}
            <form onSubmit={handleSaveAddSubcontractor}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-name" style={{ display: 'block', marginBottom: 4 }}>Name <span style={{ color: '#b91c1c' }}>*</span></label>
                <input
                  id="new-sub-name"
                  type="text"
                  value={newSubcontractor.name}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, name: e.target.value }))}
                  required
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  id="new-sub-email"
                  type="email"
                  value={newSubcontractor.email}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, email: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input
                  id="new-sub-phone"
                  type="tel"
                  value={newSubcontractor.phone}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, phone: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  id="new-sub-notes"
                  value={newSubcontractor.notes}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, notes: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingAddSubcontractor} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingAddSubcontractor ? 'not-allowed' : 'pointer' }}>
                  {savingAddSubcontractor ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubcontractorModal(false)
                    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
                    setAddSubcontractorError(null)
                  }}
                  disabled={savingAddSubcontractor}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {defaultLaborRateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Default Labor Rate</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
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

      {laborVersionFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborVersionForm}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborVersion ? 'Edit version' : 'New version'}</h3>
            <form onSubmit={saveLaborVersion}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={laborVersionNameInput}
                onChange={(e) => setLaborVersionNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Default"
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborVersion && editingLaborVersion.name !== 'Default' && (
                    <button
                      type="button"
                      onClick={() => deleteLaborVersion(editingLaborVersion)}
                      style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete version
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborVersion ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {laborEntryFormOpen && laborBookEntriesVersionId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborEntryForm}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>{error}</div>
            )}
            <form onSubmit={saveLaborEntry}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
              <input
                type="text"
                list="jobs-labor-fixture-types"
                value={laborEntryFixtureName}
                onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Toilet"
              />
              <datalist id="jobs-labor-fixture-types">
                {fixtureTypes.map((ft) => (
                  <option key={ft.id} value={ft.name} />
                ))}
              </datalist>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Alias names (comma-separated)</label>
              <input
                type="text"
                value={laborEntryAliasNames}
                onChange={(e) => setLaborEntryAliasNames(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. WC, toilet"
              />
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Rough In (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Top Out (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Trim Set (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {editingLaborEntry && (
                  <button
                    type="button"
                    onClick={() => editingLaborEntry && deleteLaborEntry(editingLaborEntry)}
                    style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', marginRight: 'auto' }}
                  >
                    Delete entry
                  </button>
                )}
                <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Ready to Bill</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
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
              <button type="button" onClick={() => { setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id} onClick={async () => { if (!readyForBillingJob) return; const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id); if (!ok) return; setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {createPartialInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{createPartialInvoiceJob.hcp_number ?? '—'} · {createPartialInvoiceJob.job_name ?? '—'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(Math.max(0, (Number(createPartialInvoiceJob.revenue ?? 0) - Number(createPartialInvoiceJob.payments_made ?? 0))))}</div>
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
                    const rem = Math.max(
                      0,
                      Number(createPartialInvoiceJob.revenue ?? 0) - Number(createPartialInvoiceJob.payments_made ?? 0)
                    )
                    const raw = parseFloat(createPartialInvoiceAmount)
                    if (!Number.isFinite(raw)) return
                    const useCents = Math.min(Math.round(raw * 100), Math.round(rem * 100))
                    const clamped = useCents / 100
                    if (Math.round(raw * 100) !== useCents) {
                      setCreatePartialInvoiceAmount(String(clamped))
                      setError(null)
                    }
                  }}
                  placeholder="0"
                  style={{ width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </label>
              {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreatePartialInvoiceJob(null); setCreatePartialInvoiceAmount(''); setError(null) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Make Payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{makePaymentLaborJob.contractor} · {makePaymentLaborJob.hcp}</p>
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo (optional)</label>
              <textarea
                value={makePaymentMemo}
                onChange={(e) => setMakePaymentMemo(e.target.value)}
                placeholder="Optional note"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={makePaymentSaving || !(parseFloat(makePaymentAmount) > 0)} onClick={async () => { if (!makePaymentLaborJob) return; const amt = parseFloat(makePaymentAmount); if (!(amt > 0)) return; setMakePaymentSaving(true); await recordLaborJobPayment(makePaymentLaborJob.id, amt, makePaymentMemo || null); setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo(''); setMakePaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? 'not-allowed' : 'pointer' }}>{makePaymentSaving ? '…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Backcharge</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{backchargeLaborJob.contractor} · {backchargeLaborJob.hcp}</p>
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo <span style={{ color: '#b91c1c' }}>*</span></label>
              <textarea
                value={backchargeMemo}
                onChange={(e) => setBackchargeMemo(e.target.value)}
                placeholder="Required for backcharges"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim()} onClick={async () => { if (!backchargeLaborJob) return; const amt = parseFloat(backchargeAmount); if (!(amt > 0) || !backchargeMemo.trim()) return; setBackchargeSaving(true); await recordLaborJobBackcharge(backchargeLaborJob.id, amt, backchargeMemo); setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeSaving(false) }} style={{ padding: '0.5rem 1rem', background: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? 'not-allowed' : 'pointer' }}>{backchargeSaving ? '…' : 'Record Backcharge'}</button>
            </div>
          </div>
        </div>
      )}
      {editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo {editingPayment.isBackcharge ? <span style={{ color: '#b91c1c' }}>*</span> : '(optional)'}</label>
              <textarea
                value={editPaymentMemo}
                onChange={(e) => setEditPaymentMemo(e.target.value)}
                placeholder={editingPayment.isBackcharge ? 'Required for backcharges' : 'Optional note'}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (!editingPayment || !confirm('Remove this payment?')) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? '#9ca3af' : '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {`Job ${sendBackInvoice.inv.job.hcp_number || '—'} · ${sendBackInvoice.inv.job.job_name || '—'} · $${Number(sendBackInvoice.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            {sendBackInvoice.action === 'delete' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>This will remove the invoice from Ready to Bill.</p>
            )}
            {sendBackInvoice.action === 'revert' &&
              invoiceNeedsStripeVoidForRevert(sendBackInvoice.inv) &&
              sendBackInvoiceStripeExplainerAfterFailure && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#92400e' }}>
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
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {sendBackJob.hcpNumber} · {sendBackJob.jobName}
            </p>
            {sendBackJob.toStatus === 'working' && sendBackCollectPaymentNotice != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#92400e' }}>{sendBackCollectPaymentNotice}</p>
            )}
            {sendBackStatusEventLine != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                {sendBackStatusEventLine}
              </p>
            )}
            {sendBackJob.toStatus === 'ready_to_bill' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#92400e' }}>
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
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {confirmJobStatusJob.message}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmJobStatusJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
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
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
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
