import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchActiveUsers } from '../lib/people/fetchActiveUsers'
import { pageTabStyle } from '../lib/pageTabStyle'
import { filterActiveCustomersForPicker } from '../lib/customerArchive'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { usePartsLedgerData } from '../hooks/usePartsLedgerData'
import type { TallyPartRow } from '../types/tallyPart'
import { useToastContext } from '../contexts/ToastContext'
import { useRoleGate } from '../hooks/useRoleGate'
import { withSupabaseRetry } from '../utils/errorHandling'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { buildJobSubSheetHtml } from '../lib/jobsDocuments/subLaborSheet'
import { buildJobSummaryCostBreakdownHtml } from '../lib/jobsDocuments/jobSummaryCostBreakdown'
import { buildSubLaborOutstandingByPerson, subLaborJobMatchesSearch } from '../lib/subLaborOutstanding'
import { laborJobSubCost } from '../lib/jobs/subLaborCost'
import JobsCrewPnlTab from '../components/jobs/JobsCrewPnlTab'
import JobsSubLaborTab, { SubLaborToolbar } from '../components/jobs/JobsSubLaborTab'
import { JobsSubsWorkView } from '../components/jobs/JobsSubsWorkView'
import { JobsSubsTab, subsViewFromParam, type SubsView } from '../components/jobs/JobsSubsTab'
import JobsSubLaborFormModal, { type JobsSubLaborFormModalHandle } from '../components/jobs/JobsSubLaborFormModal'
import SubLaborPaymentModals, { type SubLaborPaymentModalsHandle } from '../components/jobs/SubLaborPaymentModals'
import type { LaborJob } from '../types/laborJob'
import JobsInspectionsTab from '../components/jobs/JobsInspectionsTab'
import JobsReportsTab from '../components/jobs/JobsReportsTab'
import JobsPartsTab from '../components/jobs/JobsPartsTab'
import JobsBillingTab from '../components/jobs/JobsBillingTab'
import JobsStagesTab, { type JobsStagesTabHandle } from '../components/jobs/JobsStagesTab'
import { shouldLoadJobsListForTab } from '../lib/jobsListLoadGate'
import { parseStagesMoneyWeekParam, STAGES_MONEY_WEEK_PARAM } from '../lib/weeklyMoneyReportLink'
import { canRoleSeeArBankUnallocatedOrgNudge } from '../hooks/useArBankUnallocatedCount'
import JobsJobSummaryTab from '../components/jobs/JobsJobSummaryTab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import {
  JobSummaryCostCellDrilldownModal,
} from '../components/jobs/JobSummaryCostCellDrilldownModal'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { useSubLaborLedger } from '../hooks/useSubLaborLedger'
import { JobsTeamTab } from '../components/jobs/JobsTeamTab'
import { loadTeamLaborData as fetchTeamLaborRows, type TeamLaborRow } from '../utils/teamLabor'
import type { Database } from '../types/database'
import type { JobSummaryInvoiceAllocationLine, JobSummaryMercuryAllocationRow } from '../types/jobSummary'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobFormModal, type OpenEditJobOptions } from '../contexts/JobFormModalContext'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { readStagesSectionOpenPrefs, scopesForOpenStagesSections } from '../lib/jobs/stagesSectionPrefs'
import { parseStagesMoneyMoveKey } from '../lib/jobs/stagesMoneyMoveLink'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { fetchAttributionsByMercuryTxIds } from '../lib/fetchMercuryRelationsByTxIds'
import { useJobSummaryData } from '../hooks/useJobSummaryData'
import { showJobCostBreakdownTeamLabor } from '../lib/jobDetailModalRole'
import { buildPipelineBurnAlert, projectJobSummaryBurn } from '../lib/jobs/jobSummaryBurn'
import { useJobBudgetFootings } from '../hooks/useJobBudgetFootings'
import { resolveJobCurrentPercentFallback } from '../lib/jobSummaryPercentComplete'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import {
  MONEY_STORY_JOB_PARAM,
  MONEY_STORY_MISSING_TOAST,
  jobSummaryRowDomId,
  resolveMoneyStoryLanding,
} from '../lib/jobs/moneyStoryDoor'
import { PartsUnattributedMercuryListModal } from '../components/jobs/PartsUnattributedMercuryListModal'
import { PartsUnattributedAllJobsModal } from '../components/jobs/PartsUnattributedAllJobsModal'
import { MercuryTransactionAllocationsModal } from '../components/MercuryTransactionAllocationsModal'
import { useJobsMercuryAllocations } from '../hooks/useJobsMercuryAllocations'
import { useJobSummaryView } from '../hooks/useJobSummaryView'
import { useJobsStagesMutations } from '../hooks/useJobsStagesMutations'

type CustomerRow = Database['public']['Tables']['customers']['Row']
export type UserRow = { id: string; name: string; email: string | null; role: string; notes: string | null }

type JobsTab = 'reports' | 'stages' | 'billing' | 'subs' | 'combined-labor' | 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'

/** Align with Layout mobile breakpoint; shortens primary create button to "New". */
const JOBS_SHORT_NEW_JOB_BUTTON_MQ = '(max-width: 640px)'

// Roster (for Labor / Sub Sheet Ledger)
export type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
const JOBS_TABS: JobsTab[] = ['reports', 'stages', 'billing', 'subs', 'combined-labor', 'teams-summary', 'parts', 'job-summary', 'inspections', 'billed']
/** v2.2927: Work Orders and Sub Labor folded into Subs — old links keep landing. */
const SUBS_TAB_ALIASES: Record<string, SubsView> = { work_orders: 'work', sub_sheet_ledger: 'pay', labor: 'pay' }

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
  // v2.3051: Quickfill's Unassigned field time card links to a week with the exceptions filter on.
  const teamWeekParam = searchParams.get('teamWeek')?.trim() || null
  const teamExceptionsParam = searchParams.get('teamExceptions') === '1'
  const onFocusTeamLaborConsumed = useCallback(() => {
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('teamLaborJob')
      n.delete('teamWeek')
      n.delete('teamExceptions')
      return n
    }, { replace: true })
  }, [setSearchParams])

  const { user: authUser, role: authRole, loading: authLoading, profileName: authProfileName } = useAuth()
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
    runFetchScopes,
    refreshMergedScopes,
    refreshHeaderStats,
    fetchPaidJobsIfNeeded,
  } = useJobsListCache()
  const jobDetailModal = useJobDetailModal()
  const [activeTab, setActiveTab] = useState<JobsTab>('stages')
  const activeTabRef = useRef<JobsTab>('stages')
  // Burn card on the Pipeline money story (v2.3191): wage roles only, armed 2.5 s
  // after the board shows so the Job Summary cost loads (team labor, sub sheets,
  // parts, the report-% batch) never race the board's own fetches. Once armed it
  // stays armed — the loads are the same caches Job Summary reads.
  const pipelineBurnWanted = activeTab === 'stages' && showJobCostBreakdownTeamLabor(authRole)
  const [pipelineBurnArmed, setPipelineBurnArmed] = useState(false)
  useEffect(() => {
    if (!pipelineBurnWanted || pipelineBurnArmed) return
    const t = setTimeout(() => setPipelineBurnArmed(true), 2500)
    return () => clearTimeout(t)
  }, [pipelineBurnWanted, pipelineBurnArmed])
  const pipelineBurnReportIds = useMemo(
    () =>
      pipelineBurnArmed && pipelineBurnWanted
        ? jobs.filter((j) => j.status === 'waiting' || j.status === 'working' || j.status === 'ready_to_bill').map((j) => j.id)
        : null,
    [pipelineBurnArmed, pipelineBurnWanted, jobs],
  )
  activeTabRef.current = activeTab
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState<string | null>(null)
  // Job Summary data layer (ledger snapshot + lazy per-job caches + loaders) —
  // seam hook since v2.826; the destructure keeps every downstream name. Called
  // BEFORE useJobsMercuryAllocations, which consumes jobSummaryLedgerJobs (via
  // jobListForCardCharges) + touchJobSummaryMercuryAllocations; the
  // jobSummaryData P&L memo stays page-side because it reads
  // mercuryCardChargesByJobId back from that later hook.
  const {
    jobSummaryLedgerAllJobs,
    jobSummaryHiddenByMinHcp,
    jobSummaryMinHcpExclusive,
    setJobSummaryMinHcpExclusive,
    jobSummaryLedgerJobs,
    jobSummaryLedgerLoading,
    jobSummaryLedgerError,
    loadJobSummaryLedger,
    loadJobSummaryLedgerRef,
    jobSummaryLedgerSnapshotLoadedRef,
    jobSummaryClockSessionsByJobId,
    loadJobSummaryClockSessionsForJob,
    jobSummaryInvoiceLinesByJobId,
    loadJobSummaryInvoiceLinesForJob,
    jobSummaryMercuryAllocationsByJobId,
    loadJobSummaryMercuryAllocationsForJob,
    touchJobSummaryMercuryAllocations,
    jobSummaryReportsByJobId,
    loadJobSummaryReportsForJob,
    jobSummaryReportPctByJobId,
  } = useJobSummaryData({ authUserId: authUser?.id, activeTab, extraReportPctJobIds: pipelineBurnReportIds })
  /** Debounce timer for post-Stages-mutation refresh (coalesce rapid moves into one fetch). */
  const loadJobsAfterMutationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Coalesce rapid `useEffect` dependency churn (tab/customer) into one `loadJobs`. */
  const loadJobsFromEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LOAD_JOBS_AFTER_MUTATION_MS = 300
  const LOAD_JOBS_FROM_EFFECT_DEBOUNCE_MS = 50
  /** Sub Labor's job picker offers paid-in-full jobs too — merge the lazy paid scope on demand (no-op once merged). */
  const ensurePaidJobsLoaded = useCallback(() => {
    void fetchPaidJobsIfNeeded(customerFilterForFetch)
  }, [fetchPaidJobsIfNeeded, customerFilterForFetch])
  const loadJobs = useCallback(async () => {
    const rows = await runFetchJobs(customerFilterForFetch)
    // Direct loadJobs() calls are overwhelmingly post-mutation refetches (Bill
    // Customer, Mark Paid, Collections flag, send-backs, Edit Job saves) that
    // don't go through scheduleLoadJobsAfterMutation — force the header stats
    // past the v2.1917 TTL so section totals move with the rows (v2.1932).
    // The TTL still dedupes the visibility/scoped-load piggybacks.
    void refreshHeaderStats(customerFilterForFetch, { force: true })
    return rows
  }, [runFetchJobs, refreshHeaderStats, customerFilterForFetch])
  /**
   * Scoped first paint for the Pipeline (v2.1824, plan PR 3): fetch only the
   * sections the device left open (fresh devices: Ready to Bill). Every other
   * jobs-cache tab (Billing, Parts, Sub-sheet) still full-loads via loadJobs —
   * and once any full load has run, the scoped path is a no-op refresh of the
   * same scopes. Mutation refreshes stay full until plan PR 5.
   */
  const loadJobsScopedForStages = useCallback(() => {
    return runFetchScopes(scopesForOpenStagesSections(readStagesSectionOpenPrefs()), customerFilterForFetch)
  }, [runFetchScopes, customerFilterForFetch])

  const jobsListPipelineBusy = jobsListLoading || jobsListRefreshing

  /**
   * Job created via New Job: once the post-save refetch lands it in the cache,
   * clear the Pipeline search and show it (same focus flow as ?stagesJob=).
   */
  const [pendingNewJobFocusId, setPendingNewJobFocusId] = useState<string | null>(null)

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
      // v2.1827 (plan PR 5): Stages refreshes only the sections it has loaded
      // (merged paid rows ride along un-refetched); other tabs keep the full
      // reload they read from.
      if (activeTabRef.current === 'stages') void refreshMergedScopes(customerFilterForFetchRef.current ?? null)
      else void runFetchJobs(customerFilterForFetchRef.current ?? null)
      // Data just moved — bypass the header-stats TTL so the chips update now (v2.1917).
      void refreshHeaderStats(customerFilterForFetchRef.current ?? null, { force: true })
      if (activeTabRef.current === 'job-summary' || jobSummaryLedgerSnapshotLoadedRef.current) {
        void loadJobSummaryLedgerRef.current()
      }
    }, LOAD_JOBS_AFTER_MUTATION_MS)
  }
  /** Loaded for Stages/Billing implied-customer hints and refreshed when job form saves. */
  const [customers, setCustomers] = useState<CustomerRow[]>([])

  // Sub Sheet Ledger state (the payment/backcharge/edit-payment modal states moved to SubLaborPaymentModals in v2.824)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [driveMileageCost, setDriveMileageCost] = useState<number | null>(null)
  const [driveTimePerMile, setDriveTimePerMile] = useState<number | null>(null)
  const [defaultLaborRateValue, setDefaultLaborRateValue] = useState('')
  const {
    laborJobs,
    setLaborJobs,
    laborJobNamesByJobId,
    laborJobAssigneesByJobId,
    laborJobsLoading,
    laborJobsLoadedOnce,
    laborJobDeletingId,
    loadLaborJobs,
    deleteLaborJob,
    updateLaborJobDate,
    setLaborJobStage,
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
  } = useSubLaborLedger({
    authUserId: authUser?.id,
    authUserName: authProfileName,
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
  // Role gates that say something (v2.2882): every "this tab isn't for your
  // role" rewrite below toasts once and lands honestly instead of silently.
  const { bounce: roleGateBounce } = useRoleGate(authRole ?? myRole, authUser?.id)
  const subLaborFormRef = useRef<JobsSubLaborFormModalHandle>(null)
  const subLaborPaymentModalsRef = useRef<SubLaborPaymentModalsHandle>(null)
  /** Drives JobsStagesTab (always mounted): the URL router's deep-link writes + the mutation engine's followMovedJob. */
  const stagesTabRef = useRef<JobsStagesTabHandle>(null)

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
    isActive: activeTab === 'parts' || activeTab === 'job-summary' || pipelineBurnArmed,
    onError: setError,
  })
  const [tallyPartsSearch, setTallyPartsSearch] = useState('')
  const [showMyJobsOnly, setShowMyJobsOnly] = useState(false)
  const [subLaborSearch, setSubLaborSearch] = useState('')
  /** Where Subs → Work draws its toolbar: a slot on the Work / Pay row (`JobsSubsTab`), filled by portal. */
  const [subsWorkToolbarHost, setSubsWorkToolbarHost] = useState<HTMLDivElement | null>(null)
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
  const [jobSummaryCostDrilldown, setJobSummaryCostDrilldown] = useState<{ title: string; body: ReactNode } | null>(null)
  const jobListForCardCharges = useMemo(
    () => (activeTab === 'job-summary' && jobSummaryLedgerJobs !== null ? jobSummaryLedgerJobs : jobs),
    [activeTab, jobSummaryLedgerJobs, jobs],
  )
  const {
    mercuryCardChargesByJobId,
    mercuryInvoiceLinkedChargesByJobId,
    mercuryTagChargesByJobId,
    costLineTags,
    partsTabMercuryLoadedRef,
    partsTabMercuryAllocationsByJobId,
    partsUnattribFlowJobIdRef,
    partsUnattribListJobId,
    setPartsUnattribListJobId,
    partsAllocModalData,
    partsAllocModalOpen,
    bankingAttributionUsersOptions,
    allJobsUnattributedOpen,
    setAllJobsUnattributedOpen,
    allJobsUnattributedLoading,
    allJobsUnattributedLines,
    loadPartsTabMercuryForJob,
    dismissPartsUnattributedList,
    closeListOnlyForAssign,
    closeAllJobsListForAssign,
    handleAssignToTransactionFromParts,
    handleJobSummaryMercuryReassignFromDrilldown,
    closePartsAllocModal,
    refetchAllJobsUnattributedData,
    onPartsAllocSaved,
    partsUnattribBankingUsersForMatch,
    handleQuickAddUserFromParts,
  } = useJobsMercuryAllocations({
    jobListForCardCharges,
    canAccessBankingForParts,
    authUserId: authUser?.id,
    showToast,
    unattributedScopeInputs: { jobs, showMyJobsOnly, myJobIds },
    // Job Summary bridge: the lazy mercury cache lives in useJobSummaryData
    // (v2.826 — its touch function implements the v2.825 invalidate+force-reload
    // closure); the drilldown modal stays parent-side (quirk #11).
    onJobSummaryMercuryTouched: touchJobSummaryMercuryAllocations,
    onJobSummaryDrilldownClose: () => setJobSummaryCostDrilldown(null),
  })
  const [pendingScrollToPartsJobId, setPendingScrollToPartsJobId] = useState<string | null>(null)
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



  const {
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
  } = useJobThreadNotes(showToast, authUser?.id, authProfileName)


  // Job Summary expanded rows show the Stages-style Last activity header — stats for expanded ids only.
  useEffect(() => {
    if (!authUser?.id || activeTab !== 'job-summary' || expandedJobSummaryJobIds.size === 0) return
    void refreshJobThreadStatsForJobIds([...expandedJobSummaryJobIds])
  }, [authUser?.id, activeTab, expandedJobSummaryJobIds, refreshJobThreadStatsForJobIds])

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


  // Stages mutation engine (status moves, Stripe-prep revert, invoice delete,
  // est-bill-date + % complete row writes) — seam hook since v2.828; the
  // destructure keeps every downstream name. Called here because it needs
  // submitJobThreadNoteWithBody (useJobThreadNotes, above); followMovedJob
  // lives in JobsStagesTab since v2.831 and flows in via the imperative
  // handle. The serialized queue stays module-level in
  // lib/jobsStagesSerializedPipeline (quirk #14); optimistic-patch + 300 ms
  // debounce timings are untouched (quirk #12).
  const {
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
  } = useJobsStagesMutations({
    authRole,
    setError,
    showToast,
    setJobs,
    loadJobs,
    scheduleLoadJobsAfterMutation,
    followMovedJob: (jobId, toStatus) => stagesTabRef.current?.followMovedJob(jobId, toStatus),
    submitJobThreadNoteWithBody,
  })


  async function loadUsers() {
    if (!authUser?.id) return
    // Tier-2 #19: the crew picker (ScheduleJobModal team checklist, job-form team) reads the
    // shared active-people query — archived debris ("delete", "Merge Test…") and twins drop out.
    const [usersRes, meRes] = await Promise.all([
      fetchActiveUsers<UserRow>('id, name, email, role, notes', {
        roles: ['assistant', 'controller', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'],
      }),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = usersRes.data
    const role = (meRes.data as { role?: string } | null)?.role
    setMyRole(role ?? null)
    if (role === 'dev') {
      const { data: devUsers } = await fetchActiveUsers<UserRow>('id, name, email, role, notes', { roles: [], includeDev: true })
      if (devUsers.length) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = devUsers.filter((u) => !existingIds.has(u.id))
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


  async function loadTeamLaborData() {
    setTeamLaborLoading(true)
    try {
      setTeamLaborData(await fetchTeamLaborRows(supabase))
    } finally {
      setTeamLaborLoading(false)
    }
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


  // Which tabs kick the shared jobs-list load lives in `jobsListLoadGate.ts`
  // (tested). job-summary joined in Tier-2 #17: `jobsListLoading` initialises
  // true and only a load flips it, so Edit Job from a Job Summary row used to
  // say "Please wait until jobs finish loading" forever (J6-6).
  const shouldLoadJobsListForActiveTab = shouldLoadJobsListForTab(activeTab)

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    loadUsers()
    if (!shouldLoadJobsListForActiveTab) return
    if (loadJobsFromEffectTimerRef.current) {
      clearTimeout(loadJobsFromEffectTimerRef.current)
    }
    loadJobsFromEffectTimerRef.current = setTimeout(() => {
      loadJobsFromEffectTimerRef.current = null
      // Stages alone affords the scoped first paint; other tabs read the full
      // list, and a full load supersedes any scoped one for the session key.
      if (activeTabRef.current === 'stages') void loadJobsScopedForStages()
      else void loadJobs()
    }, LOAD_JOBS_FROM_EFFECT_DEBOUNCE_MS)
    return () => {
      if (loadJobsFromEffectTimerRef.current) {
        clearTimeout(loadJobsFromEffectTimerRef.current)
        loadJobsFromEffectTimerRef.current = null
      }
    }
  }, [authUser?.id, authLoading, customerParamForJobsReload, activeTab, loadJobs, loadJobsScopedForStages, shouldLoadJobsListForActiveTab])

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    if (!shouldLoadJobsListForActiveTab) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (activeTabRef.current === 'stages') void refreshMergedScopes(customerFilterForFetch, { kind: 'visibility' })
      else void runFetchJobs(customerFilterForFetch, { kind: 'visibility' })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authUser?.id, authLoading, activeTab, customerFilterForFetch, runFetchJobs, refreshMergedScopes, shouldLoadJobsListForActiveTab])

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
    // v2.2927: the old tab names (and ?tab=labor) land on Subs with the right view.
    if (tab && SUBS_TAB_ALIASES[tab]) {
      const view = SUBS_TAB_ALIASES[tab]!
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'subs')
        if (view === 'pay') next.set('view', 'pay')
        else next.delete('view')
        return next
      }, { replace: true })
      return
    }
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
    // When editLabor=hcp is present, force Subs → Pay so labor jobs load
    if (editLaborHcp) {
      setActiveTab('subs')
      if (tab !== 'subs' || searchParams.get('view') !== 'pay') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'subs')
          next.set('view', 'pay')
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
    // When openBankPayments (or `legal`, v2.3293) is present, force Stages tab so the deep link can open its modal
    const openBankPaymentsWant = searchParams.get('openBankPayments') === 'true' || searchParams.get('openBankPayments') === '1'
    const legalDeskWant = Boolean(searchParams.get('legal'))
    if ((openBankPaymentsWant || legalDeskWant) && canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
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
    // Role gates that say something (v2.2882, C25): a link to a tab that isn't
    // for this role toasts once and lands on a tab that is — never a silent
    // rewrite. `roleGateBounce` owns the landing + sentence (lib/roleGate.ts).
    const landOn = (toTab: string | null) => {
      const target = (toTab ?? 'reports') as JobsTab
      setActiveTab(target)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', target)
        return next
      }, { replace: true })
    }
    // Assistants: no Team Labor tab
    const isAssistant = authRole === 'assistant' || myRole === 'assistant'
    if (isAssistant && tab === 'combined-labor') {
      landOn(roleGateBounce('team-labor', `/jobs?tab=${tab}`).toTab)
      return
    }
    // Masters / assistants / controllers: no Crew P&L tab (owner only)
    const isMasterOrAssistant = authRole === 'master_technician' || isAssistantLike(authRole) || myRole === 'master_technician' || isAssistantLike(myRole)
    if (isMasterOrAssistant && tab === 'teams-summary') {
      landOn(roleGateBounce('crew-pnl', `/jobs?tab=${tab}`).toTab)
      return
    }
    // Superintendents: neither Team Labor nor Crew P&L
    if (isSuperintendent && (tab === 'combined-labor' || tab === 'teams-summary')) {
      landOn(roleGateBounce(tab === 'teams-summary' ? 'crew-pnl' : 'team-labor', `/jobs?tab=${tab}`).toTab)
      return
    }
    // Superintendent: reports and Subs (Pay view only); default reports
    if (isSuperintendent) {
      const superintendentTabs = ['reports', 'subs']
      if (tab && superintendentTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (tab) {
        landOn(roleGateBounce('jobs-tab', `/jobs?tab=${tab}`).toTab)
      } else {
        landOn('reports')
      }
      return
    }
    // Only primaries default to Reports; primaries only see Reports tab (Billing hidden)
    if (isPrimary) {
      const primaryTabs = ['reports']
      if (tab && primaryTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (tab) {
        landOn(roleGateBounce('jobs-tab', `/jobs?tab=${tab}`).toTab)
      } else {
        landOn('reports')
      }
      return
    }
    if (tab === 'billed') {
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
  }, [searchParams, myRole, authRole, roleGateBounce])

  useEffect(() => {
    const newJob = searchParams.get('newJob') === 'true'
    const tab = searchParams.get('tab')
    if (newJob && tab === 'subs' && searchParams.get('view') === 'pay') {
      setActiveTab('subs')
      // Handle-race guard (map rule, v2.834): on the earliest cold-load passes
      // the form modal's ref isn't attached yet, so an ungated call no-ops
      // while the param strips. Wait for the ledger's first load — by then the
      // ref is long attached. (Activating the tab above is what triggers it.)
      if (!laborJobsLoadedOnce) return
      subLaborFormRef.current?.open()
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
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
        onCreatedJobId: setPendingNewJobFocusId,
      })
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        next.delete('project')
        if (!next.get('tab')) next.set('tab', 'stages')
        return next
      }, { replace: true })
    }
  }, [searchParams, jobsListLoading, jobsListRefreshing, laborJobsLoadedOnce, jobFormModal, loadJobs])

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

  // `?stagesWeekly=` deep link (v2.1436): open the Weekly movement modal.
  // Same gating class as openBankPayments — wait for the imperative handle
  // (jobsListLoading) or the call silently no-ops on cold load (v2.832 rule).
  const stagesWeeklyParam = searchParams.get('stagesWeekly')
  useEffect(() => {
    const wantsOpen = stagesWeeklyParam === 'true' || stagesWeeklyParam === '1'
    if (!wantsOpen) return
    const strip = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('stagesWeekly')
          return next
        },
        { replace: true },
      )
    }
    if (activeTab !== 'stages') {
      strip()
      return
    }
    if (jobsListLoading) return
    stagesTabRef.current?.openWeeklyMovement()
    strip()
  }, [stagesWeeklyParam, activeTab, jobsListLoading, setSearchParams])

  // `?stagesMoney=` deep link (v2.1443): open the Weekly money movement modal.
  // Same jobsListLoading handle gate as ?stagesWeekly (v2.832 rule).
  // Dev / controller only (v2.2882, C25 J5-6) — the same gate as the menu item
  // and the `get_weekly_money_movement_payload` RPC. Anyone else used to get
  // the report shell and then the RPC's "not allowed"; now the link says whose
  // it is and they stay on the board.
  // `&stagesMoneyWeek=<ymd>` (Tier-2 #17): Moneyfill's "See the week's report"
  // pins the modal to the close week the picker was showing.
  const stagesMoneyParam = searchParams.get('stagesMoney')
  const stagesMoneyWeekParam = searchParams.get(STAGES_MONEY_WEEK_PARAM)
  const stagesMoneyRole = authRole ?? myRole
  useEffect(() => {
    const wantsOpen = stagesMoneyParam === 'true' || stagesMoneyParam === '1'
    if (!wantsOpen) return
    const strip = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('stagesMoney')
          next.delete(STAGES_MONEY_WEEK_PARAM)
          return next
        },
        { replace: true },
      )
    }
    if (stagesMoneyRole == null) return
    if (stagesMoneyRole !== 'dev' && stagesMoneyRole !== 'controller') {
      // Roles with no Pipeline board at all (primary, superintendent) are already
      // spoken to by the tab gate above — don't stack a second sentence.
      const onTheBoard = stagesMoneyRole === 'master_technician' || isAssistantLike(stagesMoneyRole)
      if (onTheBoard) roleGateBounce('pipeline-money', '/jobs?tab=stages&stagesMoney=1')
      strip()
      return
    }
    if (activeTab !== 'stages') {
      strip()
      return
    }
    if (jobsListLoading) return
    stagesTabRef.current?.openWeeklyMoney(parseStagesMoneyWeekParam(stagesMoneyWeekParam))
    strip()
  }, [stagesMoneyParam, stagesMoneyWeekParam, stagesMoneyRole, activeTab, jobsListLoading, setSearchParams, roleGateBounce])

  // `?stagesMove=` deep link (v2.2145): Quickfill → Jobs Cleanup card buttons
  // land here and open the same thing the Pipeline card opens. Same
  // jobsListLoading handle gate as the other stages deep links (v2.832 rule).
  const stagesMoveParam = searchParams.get('stagesMove')
  useEffect(() => {
    const key = parseStagesMoneyMoveKey(stagesMoveParam)
    if (!stagesMoveParam) return
    const strip = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('stagesMove')
          return next
        },
        { replace: true },
      )
    }
    if (!key || activeTab !== 'stages') {
      strip()
      return
    }
    if (jobsListLoading) return
    stagesTabRef.current?.openMoneyMove(key)
    strip()
  }, [stagesMoveParam, activeTab, jobsListLoading, setSearchParams])

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

    // authRole resolves AFTER auth loading (same class as the v2.833
    // role-bounce): null means "not known yet", not "denied" — stripping here
    // would eat the param before the role arrives. Wait; the effect re-runs
    // when authRole lands. (Found by the e2e smoke suite's cold-load test.)
    if (authRole == null) return
    if (!canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
      stripOpenBankPaymentsParam()
      return
    }
    if (activeTab !== 'stages') {
      stripOpenBankPaymentsParam()
      return
    }
    // Wait for the jobs list like the other stages deep links: on a cold load
    // the earliest effect passes run before JobsStagesTab's imperative handle
    // is attached, so an ungated `stagesTabRef.current?.` call silently no-ops
    // and the param strips without the modal ever opening (found live, v2.832).
    if (jobsListLoading) return
    stagesTabRef.current?.openBankPayments()
    stripOpenBankPaymentsParam()
  }, [openBankPaymentsParam, authRole, activeTab, jobsListLoading, setSearchParams])

  // `?legal=1` / `?legal=<payer key>` (Legal desk PR 1, v2.3293): open the ⚖ Legal
  // desk on the Collections accounts, on one account when a key is given. Same
  // gating class and wait-for-the-handle shape as openBankPayments above; the
  // roles match Collections management (dev / master / assistant-like).
  const legalParam = searchParams.get('legal')
  useEffect(() => {
    if (!legalParam) return
    const strip = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('legal')
          return next
        },
        { replace: true },
      )
    }
    if (authRole == null) return
    if (!canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
      strip()
      return
    }
    if (activeTab !== 'stages') {
      strip()
      return
    }
    if (jobsListLoading) return
    stagesTabRef.current?.openLegalDesk(legalParam === '1' || legalParam === 'true' ? null : legalParam)
    strip()
  }, [legalParam, authRole, activeTab, jobsListLoading, setSearchParams])

  // When editLabor=hcp is in URL and labor jobs are loaded, open edit or new labor modal
  const editLaborHcp = searchParams.get('editLabor')
  useEffect(() => {
    // laborJobsLoading starts false BEFORE the load begins, so on cold loads
    // this used to decide against an empty list (opening New instead of Edit
    // pre-v2.823; silently no-opping via the unattached ref after). Gate on
    // the first completed load (map handle-race rule, v2.834).
    if (!editLaborHcp || !laborJobsLoadedOnce || laborJobsLoading) return
    const hcpLower = editLaborHcp.trim().toLowerCase()
    // Sheet id wins over HCP: People → Subs' unattributed panel links by id
    // because job numbers repeat across sheets (and can be blank).
    const laborJob =
      laborJobs.find((j) => j.id === editLaborHcp.trim()) ??
      laborJobs.find((j) => (j.job_number ?? '').trim().toLowerCase() === hcpLower)
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
  }, [editLaborHcp, laborJobs, laborJobsLoadedOnce, laborJobsLoading])

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


  const stagesInvoiceParam = searchParams.get('stagesInvoice')
  useEffect(() => {
    const raw = stagesInvoiceParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    stagesTabRef.current?.focusInvoice(raw)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesInvoice')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesInvoiceParam, jobsListLoading, activeTab, setSearchParams])

  // ?stagesSection=waiting|working|readyToBill|billed|collections — deep link that opens + scrolls
  // to a Stages section (e.g. from the Dashboard Financials drill-downs), then strips itself.
  const stagesSectionParam = searchParams.get('stagesSection')
  useEffect(() => {
    const raw = stagesSectionParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    if (raw === 'waiting' || raw === 'working' || raw === 'readyToBill' || raw === 'billed' || raw === 'collections') {
      stagesTabRef.current?.focusSection(raw)
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesSection')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesSectionParam, jobsListLoading, activeTab, setSearchParams])

  // ?stagesJob=<jobId> — deep link (Job Detail / Edit Job trade-pill shortcut) that opens
  // the job's Stages section, scrolls to + flashes the job row, then strips itself.
  const stagesJobParam = searchParams.get('stagesJob')
  useEffect(() => {
    const raw = stagesJobParam?.trim()
    if (!raw || jobsListLoading || activeTab !== 'stages') return

    stagesTabRef.current?.focusJob(raw)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('stagesJob')
      if (!next.get('tab')) next.set('tab', 'stages')
      return next
    }, { replace: true })
  }, [stagesJobParam, jobsListLoading, activeTab, setSearchParams])

  // ?tab=job-summary&job=<jobId> — the "money story →" door (T5-02 / J6-9): once the
  // ledger is loaded, expand the job's row, scroll it into view, and strip the param.
  // A job not on the list (below the floor / outside the window) gets a toast, not silence.
  const moneyStoryJobParam = searchParams.get(MONEY_STORY_JOB_PARAM)
  useEffect(() => {
    if (activeTab !== 'job-summary') return
    const landing = resolveMoneyStoryLanding(
      moneyStoryJobParam,
      jobSummaryLedgerJobs ? new Set(jobSummaryLedgerJobs.map((j) => j.id)) : null,
    )
    if (landing.kind === 'none' || landing.kind === 'wait') return
    if (landing.kind === 'focus') {
      setExpandedJobSummaryJobIds((prev) => (prev.has(landing.jobId) ? prev : new Set(prev).add(landing.jobId)))
      window.setTimeout(() => {
        document.getElementById(jobSummaryRowDomId(landing.jobId))?.scrollIntoView({ block: 'center' })
      }, 50)
    } else {
      showToast(MONEY_STORY_MISSING_TOAST, 'info')
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete(MONEY_STORY_JOB_PARAM)
      return next
    }, { replace: true })
  }, [moneyStoryJobParam, activeTab, jobSummaryLedgerJobs, setSearchParams, showToast])

  // New job saved: wait for the onSaved refetch to land it in the cache, then
  // clear the Pipeline search and scroll to + flash its row (focusJob). Off the
  // Pipeline tab the pending id is dropped — no deferred surprise scroll later.
  useEffect(() => {
    if (!pendingNewJobFocusId) return
    if (activeTab !== 'stages') {
      setPendingNewJobFocusId(null)
      return
    }
    if (!jobs.some((j) => j.id === pendingNewJobFocusId)) return
    stagesTabRef.current?.focusJob(pendingNewJobFocusId)
    setPendingNewJobFocusId(null)
  }, [pendingNewJobFocusId, jobs, activeTab])



  useEffect(() => {
    if (activeTab === 'subs') {
      const t = setTimeout(() => loadRoster(), 80)
      return () => clearTimeout(t)
    }
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if (activeTab === 'stages' && searchParams.get('showBilledTotalByName') === 'true') {
      // Same cold-load handle race as ?openBankPayments= — wait for the jobs
      // list so the tab's imperative handle is guaranteed attached (v2.832).
      if (jobsListLoading) return
      stagesTabRef.current?.showBilledTotalByName()
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('showBilledTotalByName')
        return next
      }, { replace: true })
    }
  }, [activeTab, jobsListLoading, searchParams, setSearchParams])


  useEffect(() => {
    if ((activeTab === 'billing' || activeTab === 'subs' || activeTab === 'combined-labor' || activeTab === 'teams-summary' || activeTab === 'job-summary' || pipelineBurnArmed) && authUser?.id) {
      const t = setTimeout(() => loadLaborJobs(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id, pipelineBurnArmed])

  useEffect(() => {
    if ((activeTab === 'combined-labor' || activeTab === 'billing' || activeTab === 'teams-summary' || activeTab === 'job-summary' || pipelineBurnArmed) && authUser?.id) {
      const t = setTimeout(() => loadTeamLaborData(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id, pipelineBurnArmed])


  useEffect(() => {
    if (activeTab !== 'job-summary' || !authUser?.id) return
    const expandedKeys = [...jobSummaryTeamLaborPersonExpandedKeys]
    for (const jobId of expandedJobSummaryJobIds) {
      const prefix = `${jobId}::`
      if (!expandedKeys.some((k) => k.startsWith(prefix))) continue
      void loadJobSummaryClockSessionsForJob(jobId)
    }
  }, [activeTab, authUser?.id, expandedJobSummaryJobIds, jobSummaryTeamLaborPersonExpandedKeys, loadJobSummaryClockSessionsForJob])

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
    if (activeTab !== 'parts') setAllJobsUnattributedOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (!allJobsUnattributedOpen || activeTab !== 'parts') return
    void refetchAllJobsUnattributedData()
  }, [allJobsUnattributedOpen, activeTab, refetchAllJobsUnattributedData])

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
    if ((activeTab === 'subs' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      // v2.1631: the Drive Settings / Default Labor Rate modals are gone —
      // the VALUES still load here (drive cost on legacy rows, the rate that
      // seeds new line items); editing them is Settings-side now.
      const t = setTimeout(() => { void loadDriveSettings(); void loadDefaultLaborRate(); }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])


  async function loadDefaultLaborRate() {
    const { data } = await supabase.from('app_settings').select('value_num').eq('key', 'default_labor_rate').maybeSingle()
    const val = (data as { value_num: number | null } | null)?.value_num
    setDefaultLaborRateValue(val != null ? String(val) : '')
  }




  const laborJobHcps = useMemo(
    () => new Set(laborJobs.map((j) => (j.job_number ?? '').trim().toLowerCase()).filter(Boolean)),
    [laborJobs]
  )

  const teamLaborJobIds = useMemo(
    () => new Set(teamLaborData.map((r) => r.jobId)),
    [teamLaborData]
  )


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
        // A card charge linked to a supply-house invoice is the same purchase the
        // invoice allocation already counts — count it once (v2.2692).
        const cardChargesLinkedToInvoices = Math.min(cardCharges, mercuryInvoiceLinkedChargesByJobId.get(job.id) ?? 0)
        const partsCost = partsFromTally + invoicesFromSupplyHouses + billedMaterialsSum + cardCharges - cardChargesLinkedToInvoices
        // Cost-line tag slices of the card charges that count (label's tag, else the
        // bank category's tag — the same classifier People → Review uses, v2.2725).
        // Each slice is clamped so the lines never exceed the counted card charges.
        const tagCharges = mercuryTagChargesByJobId.get(job.id)
        let countedLeft = Math.max(0, cardCharges - cardChargesLinkedToInvoices)
        const costLines = costLineTags
          .map((t) => {
            const usd = Math.min(countedLeft, tagCharges?.get(t.id) ?? 0)
            countedLeft -= usd
            return { tagId: t.id, name: t.name, icon: t.icon, color: t.color, usd }
          })
          .filter((l) => l.usd > 0)
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
          cardChargesLinkedToInvoices,
          costLines,
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
    mercuryInvoiceLinkedChargesByJobId,
    mercuryTagChargesByJobId,
    costLineTags,
  ])

  // Job Summary ledger view (v2.2692): prefs + the job day ledger + enriched rows;
  // page-side so the tab stays presentational.
  const jobSummaryUserNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  // Budget footings (v2.3300): one job_budgets read for the rows Job Summary and the Pipeline burn card show.
  const jobSummaryJobIds = useMemo(() => jobSummaryData.map((r) => r.job.id), [jobSummaryData])
  const jobBudgetFootings = useJobBudgetFootings(jobSummaryJobIds, activeTab === 'job-summary' || (activeTab === 'stages' && pipelineBurnArmed && pipelineBurnWanted))
  const jobSummaryView = useJobSummaryView({
    enabled: activeTab === 'job-summary',
    userId: authUser?.id,
    role: authRole,
    rows: jobSummaryData,
    reportPctByJobId: jobSummaryReportPctByJobId,
    search: jobSummarySearch,
    userNameById: jobSummaryUserNameById,
    initialView: searchParams.get('view'),
    budgetByJobId: jobBudgetFootings,
  })

  // The Pipeline burn card (v2.3191): the Costs tab's arithmetic over the same
  // per-job aggregates Job Summary shows, for the board's open jobs. Direct
  // margin only here (no day ledger off the Job Summary tab); the Job Summary
  // column adds the overhead projection.
  const pipelineBurnAlert = useMemo(() => {
    if (!pipelineBurnArmed || !pipelineBurnWanted || activeTab !== 'stages') return null
    if (teamLaborData.length === 0) return null
    const target = jobSummaryView.prefs.targetTrueMarginPct
    const rows = jobSummaryData
      .filter((r) => r.job.status === 'waiting' || r.job.status === 'working' || r.job.status === 'ready_to_bill')
      .map((r) => {
        const pct = jobSummaryReportPctByJobId.get(r.job.id) ?? resolveJobCurrentPercentFallback(r.job)
        const fieldDays = r.teamLaborRow ? new Set(r.teamLaborRow.breakdown.flatMap((b) => b.byWorkDate.map((d) => d.workDate))).size : null
        const num = effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number)
        return {
          jobId: r.job.id,
          label: `${num ? `J${num} ` : ''}${(r.job.job_name ?? '').trim()}`.trim() || 'Job',
          burn: projectJobSummaryBurn({
            contractUsd: r.totalBill,
            spentUsd: r.teamLaborCost + r.subLaborCost + r.partsCost,
            pct,
            finished: pct === 100,
            fieldDays,
            overheadUsd: null,
            targetMarginPct: target,
            budgetFooting: jobBudgetFootings.get(r.job.id) ?? null,
          }),
        }
      })
    return buildPipelineBurnAlert(rows)
  }, [pipelineBurnArmed, pipelineBurnWanted, activeTab, teamLaborData.length, jobSummaryData, jobSummaryReportPctByJobId, jobSummaryView.prefs.targetTrueMarginPct, jobBudgetFootings])

  const subLaborOutstandingByPerson = useMemo(
    () =>
      buildSubLaborOutstandingByPerson(
        laborJobs.filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByJobId)),
        laborJobAssigneesByJobId,
      ),
    [laborJobs, subLaborSearch, laborJobNamesByJobId, laborJobAssigneesByJobId],
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
      onCreatedJobId: setPendingNewJobFocusId,
    })
  }

  function openEdit(job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean; fixturesSectionHighlight?: boolean }) {
    tryOpenEditJob(job.id, {
      initialJob: job,
      billingCustomerHighlight: opts?.billingCustomerHighlight,
      fixturesSectionHighlight: opts?.fixturesSectionHighlight,
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


   

  // updateJobPctComplete / commitStagesPctWithNote / setInvoiceEstimatedBillDate /
  // bumpInvoiceEstimatedBillDate live in useJobsStagesMutations (v2.828).

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
  const subsView = subsViewFromParam(searchParams.get('view'), showSuperintendentExtraTabs)

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
            Pipeline
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
            Team
          </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('subs')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'subs')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'subs')}
          >
            Subs
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

      {/* Stages (decomposition steps 9b+9c) — always mounted so the tab-owned
          state (search, section open/close, modal openers, focus/flash)
          survives tab switches exactly as it did at page level; `active` gates
          the rendered surface, and the imperative handle receives the URL
          router's deep-link writes + the mutation engine's followMovedJob. */}
      <JobsStagesTab
        ref={stagesTabRef}
        active={activeTab === 'stages'}
        error={error}
        setError={setError}
        jobs={jobs}
        jobsListLoading={jobsListLoading}
        jobsListRefreshing={jobsListRefreshing}
        jobsListError={jobsListError}
        paidJobsLoading={paidJobsLoading}
        jobsListDataKey={jobsListDataKey}
        paidJobsMergedForKey={paidJobsMergedForKey}
        loadJobs={loadJobs}
        runFetchJobs={runFetchJobs}
        fetchPaidJobsIfNeeded={fetchPaidJobsIfNeeded}
        customerFilterForFetch={customerFilterForFetch}
        scheduleLoadJobsAfterMutation={scheduleLoadJobsAfterMutation}
        authUser={authUser}
        authRole={authRole}
        authProfileName={authProfileName}
        myRole={myRole}
        users={users}
        customers={customers}
        showToast={showToast}
        shortNewJobButtonLabel={shortNewJobButtonLabel}
        openNew={openNew}
        openEdit={openEdit}
        openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
        tryOpenEditJob={tryOpenEditJob}
        pipelineBurnAlert={pipelineBurnAlert}
        onShowBurnList={() => {
          jobSummaryView.setPrefs({ status: 'in_progress', sortKey: 'projMargin', sortDir: 'asc' })
          setSearchParams((p) => {
            const next = new URLSearchParams(p)
            next.set('tab', 'job-summary')
            return next
          })
        }}
        openStagesDetailJobModal={openStagesDetailJobModal}
        refreshCustomersAfterJobFormSave={refreshCustomersAfterJobFormSave}
        billCustomer={billCustomer}
        stagesStatusUpdatingId={stagesStatusUpdatingId}
        stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
        updateJobStatus={updateJobStatus}
        moveJobToReadyToBillWithStripePrep={moveJobToReadyToBillWithStripePrep}
        revertBilledInvoiceToReadyToBill={revertBilledInvoiceToReadyToBill}
        deleteInvoice={deleteInvoice}
        invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
        setInvoiceEstimatedBillDate={setInvoiceEstimatedBillDate}
        bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
        pctCompleteSavingId={pctCompleteSavingId}
        updateJobPctComplete={updateJobPctComplete}
        commitStagesPctWithNote={commitStagesPctWithNote}
        expandedJobThreadId={expandedJobThreadId}
        setExpandedJobThreadId={setExpandedJobThreadId}
        jobThreadFullscreen={jobThreadFullscreen}
        setJobThreadFullscreen={setJobThreadFullscreen}
        openJobThreadFullscreen={openJobThreadFullscreen}
        jobThreadActivityByJobId={jobThreadActivityByJobId}
        jobThreadNotesLoadingId={jobThreadNotesLoadingId}
        jobThreadSubmittingId={jobThreadSubmittingId}
        jobThreadDraft={jobThreadDraft}
        setJobThreadDraft={setJobThreadDraft}
        submitJobThreadNote={submitJobThreadNote}
        submitJobThreadNoteWithBody={submitJobThreadNoteWithBody}
        loadJobThreadNotesForJob={loadJobThreadNotesForJob}
        jobThreadStatsByJobId={jobThreadStatsByJobId}
        refreshJobThreadStatsForJobIds={refreshJobThreadStatsForJobIds}
      />

      {activeTab === 'subs' && (
        <JobsSubsTab
          view={subsView}
          canSeeWork={showSuperintendentExtraTabs}
          onViewChange={(view) =>
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              if (view === 'pay') next.set('view', 'pay')
              else next.delete('view')
              return next
            })
          }
          work={
            showSuperintendentExtraTabs ? (
              <JobsSubsWorkView
                jobs={jobs}
                jobsLoading={jobsListLoading}
                authUserId={authUser?.id}
                deepLinkWorkOrderId={searchParams.get('wo')}
                initialFilter={searchParams.get('wof')}
                onOpenSheet={(sheetId) => {
                  const sheet = laborJobs.find((j) => j.id === sheetId)
                  if (sheet) subLaborFormRef.current?.openEdit(sheet)
                  else showToast('That sheet is still loading — try again in a moment', 'info')
                }}
                onDeepLinkConsumed={() =>
                  setSearchParams((p) => {
                    const next = new URLSearchParams(p)
                    next.delete('wo')
                    return next
                  }, { replace: true })
                }
                toolbarHost={subsWorkToolbarHost}
                onSetSheetStage={setLaborJobStage}
                onOpenMakePayment={(target, defaultAmount) => subLaborPaymentModalsRef.current?.openMakePayment(target, defaultAmount)}
              />
            ) : null
          }
          workToolbar={<div ref={setSubsWorkToolbarHost} style={{ display: 'contents' }} />}
          payToolbar={<SubLaborToolbar search={subLaborSearch} onSearchChange={setSubLaborSearch} onNewLaborJob={() => subLaborFormRef.current?.openNew()} />}
          pay={
              <JobsSubLaborTab
                hideToolbar
                error={error}
                subLaborSearch={subLaborSearch}
                onSubLaborSearchChange={setSubLaborSearch}
                laborJobs={laborJobs}
                laborJobsLoading={laborJobsLoading}
                laborJobNamesByJobId={laborJobNamesByJobId}
                jobs={jobs}
                authUserId={authUser?.id}
                laborJobAssigneesByJobId={laborJobAssigneesByJobId}
                subLaborDueTotal={subLaborDueTotal}
                subLaborOutstandingByPerson={subLaborOutstandingByPerson}
                onNewLaborJob={() => subLaborFormRef.current?.openNew()}
                onEditLaborJob={(job) => subLaborFormRef.current?.openEdit(job)}
                onPrintJobSubSheet={printJobSubSheet}
                onUpdateLaborJobDate={updateLaborJobDate}
                onSetLaborJobStage={setLaborJobStage}
                onOpenMakePayment={(target, defaultAmount) => subLaborPaymentModalsRef.current?.openMakePayment(target, defaultAmount)}
                onOpenBackcharge={(target) => subLaborPaymentModalsRef.current?.openBackcharge(target)}
                onReloadLaborJobs={() => void loadLaborJobs()}
              />
          }
        />
      )}

      {activeTab === 'combined-labor' && (
        <div>
          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
          {/* v2.2974: Team — the crew board (jobs × days against the dispatch plan) replaced the
              Crew Jobs / Bids matrix + Team Job Labor table (CrewJobsBlock, retired everywhere in v2.2986). */}
          <JobsTeamTab focusJobId={teamLaborJobParam} focusWeek={teamWeekParam} focusExceptions={teamExceptionsParam} onFocusConsumed={onFocusTeamLaborConsumed} />
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
          jobSummaryHiddenByMinHcp={jobSummaryHiddenByMinHcp}
          jobSummaryMinHcpExclusive={jobSummaryMinHcpExclusive}
          setJobSummaryMinHcpExclusive={setJobSummaryMinHcpExclusive}
          jobSummaryData={jobSummaryData}
          view={jobSummaryView}
          canOpenSessionNotes={(['dev', 'master_technician', 'assistant', 'controller'] as const).some((r) => r === authRole || r === myRole)}
          users={users}
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
          canEditOverheadDials={authRole === 'dev'}
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
        onOpenMakePayment={(target, defaultAmount) => subLaborPaymentModalsRef.current?.openMakePayment(target, defaultAmount)}
        onOpenBackcharge={(target) => subLaborPaymentModalsRef.current?.openBackcharge(target)}
        onOpenEditPayment={(payment, amountSeed, memoSeed) => subLaborPaymentModalsRef.current?.openEditPayment(payment, amountSeed, memoSeed)}
        onClearEditPayment={() => subLaborPaymentModalsRef.current?.clearEditPayment()}
        authUserId={authUser?.id}
        printJobSubSheet={printJobSubSheet}
        ensurePaidJobsLoaded={ensurePaidJobsLoaded}
        paidJobsLoading={paidJobsLoading}
      />



      <SubLaborPaymentModals
        ref={subLaborPaymentModalsRef}
        recordLaborJobPayment={recordLaborJobPayment}
        recordLaborJobBackcharge={recordLaborJobBackcharge}
        deleteLaborJobPayment={deleteLaborJobPayment}
        updateLaborJobPayment={updateLaborJobPayment}
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
