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
import { pageTabStyle } from '../lib/pageTabStyle'
import { filterActiveCustomersForPicker } from '../lib/customerArchive'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { usePartsLedgerData } from '../hooks/usePartsLedgerData'
import type { TallyPartRow } from '../types/tallyPart'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { buildJobSubSheetHtml } from '../lib/jobsDocuments/subLaborSheet'
import { buildJobSummaryCostBreakdownHtml } from '../lib/jobsDocuments/jobSummaryCostBreakdown'
import { buildSubLaborOutstandingByPerson, subLaborJobMatchesSearch } from '../lib/subLaborOutstanding'
import { laborJobSubCost } from '../lib/jobs/subLaborCost'
import JobsCrewPnlTab from '../components/jobs/JobsCrewPnlTab'
import JobsSubLaborTab from '../components/jobs/JobsSubLaborTab'
import JobsWorkOrdersTab from '../components/jobs/JobsWorkOrdersTab'
import JobsSubLaborFormModal, { type JobsSubLaborFormModalHandle } from '../components/jobs/JobsSubLaborFormModal'
import SubLaborPaymentModals, { type SubLaborPaymentModalsHandle } from '../components/jobs/SubLaborPaymentModals'
import type { LaborJob } from '../types/laborJob'
import JobsInspectionsTab from '../components/jobs/JobsInspectionsTab'
import JobsReportsTab from '../components/jobs/JobsReportsTab'
import JobsPartsTab from '../components/jobs/JobsPartsTab'
import JobsBillingTab from '../components/jobs/JobsBillingTab'
import JobsStagesTab, { type JobsStagesTabHandle } from '../components/jobs/JobsStagesTab'
import { canRoleSeeArBankUnallocatedOrgNudge } from '../hooks/useArBankUnallocatedCount'
import JobsJobSummaryTab from '../components/jobs/JobsJobSummaryTab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import {
  JobSummaryCostCellDrilldownModal,
} from '../components/jobs/JobSummaryCostCellDrilldownModal'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { useSubLaborLedger } from '../hooks/useSubLaborLedger'
import { CrewJobsBlock } from '../components/CrewJobsBlock'
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
import { PartsUnattributedMercuryListModal } from '../components/jobs/PartsUnattributedMercuryListModal'
import { PartsUnattributedAllJobsModal } from '../components/jobs/PartsUnattributedAllJobsModal'
import { MercuryTransactionAllocationsModal } from '../components/MercuryTransactionAllocationsModal'
import { useJobsMercuryAllocations } from '../hooks/useJobsMercuryAllocations'
import { useJobSummaryView } from '../hooks/useJobSummaryView'
import { useJobsStagesMutations } from '../hooks/useJobsStagesMutations'

type CustomerRow = Database['public']['Tables']['customers']['Row']
export type UserRow = { id: string; name: string; email: string | null; role: string; notes: string | null }

type JobsTab = 'reports' | 'stages' | 'billing' | 'work_orders' | 'sub_sheet_ledger' | 'combined-labor' | 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'

/** Align with Layout mobile breakpoint; shortens primary create button to "New". */
const JOBS_SHORT_NEW_JOB_BUTTON_MQ = '(max-width: 640px)'

// Roster (for Labor / Sub Sheet Ledger)
export type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
const JOBS_TABS: JobsTab[] = ['reports', 'stages', 'billing', 'work_orders', 'sub_sheet_ledger', 'combined-labor', 'teams-summary', 'parts', 'job-summary', 'inspections', 'billed']

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
  } = useJobSummaryData({ authUserId: authUser?.id, activeTab })
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
    laborJobNamesByHcp,
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


  const shouldLoadJobsListForActiveTab =
    // sub_sheet_ledger since v2.1621: the New Sub Labor job picker reads the
    // shared jobs cache — a deep link straight to the tab used to leave the
    // picker with zero rows ("No jobs match").
    // work_orders (v2.2819): the board labels orders by job and its assembler picks jobs from the same cache.
    activeTab === 'stages' || activeTab === 'billing' || activeTab === 'parts' || activeTab === 'sub_sheet_ledger' || activeTab === 'work_orders'

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
      // Handle-race guard (map rule, v2.834): on the earliest cold-load passes
      // the form modal's ref isn't attached yet, so an ungated call no-ops
      // while the param strips. Wait for the ledger's first load — by then the
      // ref is long attached. (Activating the tab above is what triggers it.)
      if (!laborJobsLoadedOnce) return
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
  const stagesMoneyParam = searchParams.get('stagesMoney')
  useEffect(() => {
    const wantsOpen = stagesMoneyParam === 'true' || stagesMoneyParam === '1'
    if (!wantsOpen) return
    const strip = () => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('stagesMoney')
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
    stagesTabRef.current?.openWeeklyMoney()
    strip()
  }, [stagesMoneyParam, activeTab, jobsListLoading, setSearchParams])

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
    if (activeTab === 'sub_sheet_ledger') {
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
    if ((activeTab === 'billing' || activeTab === 'sub_sheet_ledger' || activeTab === 'work_orders' || activeTab === 'combined-labor' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
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
    if ((activeTab === 'sub_sheet_ledger' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
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
  const jobSummaryView = useJobSummaryView({
    enabled: activeTab === 'job-summary',
    userId: authUser?.id,
    role: authRole,
    rows: jobSummaryData,
    reportPctByJobId: jobSummaryReportPctByJobId,
    search: jobSummarySearch,
    userNameById: jobSummaryUserNameById,
    initialView: searchParams.get('view'),
  })

  const subLaborOutstandingByPerson = useMemo(
    () =>
      buildSubLaborOutstandingByPerson(
        laborJobs.filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByHcp)),
        laborJobAssigneesByJobId,
      ),
    [laborJobs, subLaborSearch, laborJobNamesByHcp, laborJobAssigneesByJobId],
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
            Team Labor
          </button>
          )}
          {showSuperintendentExtraTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('work_orders')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'work_orders')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'work_orders')}
          >
            Work Orders
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

      {activeTab === 'work_orders' && (
        <JobsWorkOrdersTab
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
        />
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
          onNewLaborJob={() => subLaborFormRef.current?.openNew()}
          onEditLaborJob={(job) => subLaborFormRef.current?.openEdit(job)}
          onPrintJobSubSheet={printJobSubSheet}
          onUpdateLaborJobDate={updateLaborJobDate}
          onSetLaborJobStage={setLaborJobStage}
          onOpenMakePayment={(target, defaultAmount) => subLaborPaymentModalsRef.current?.openMakePayment(target, defaultAmount)}
          onOpenBackcharge={(target) => subLaborPaymentModalsRef.current?.openBackcharge(target)}
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
            /* v2.1636: on this tab only devs + controllers edit Crew Jobs / Bids
               (Quickfill keeps the wider pay-access editing for the
               unassigned-hours → payroll workflow). */
            canEdit={authRole === 'dev' || authRole === 'controller' || myRole === 'dev' || myRole === 'controller'}
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
