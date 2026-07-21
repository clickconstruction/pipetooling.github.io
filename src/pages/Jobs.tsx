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
import type { Database } from '../types/database'
import type { JobSummaryInvoiceAllocationLine, JobSummaryMercuryAllocationRow } from '../types/jobSummary'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobFormModal, type OpenEditJobOptions } from '../contexts/JobFormModalContext'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { fetchAttributionsByMercuryTxIds } from '../lib/fetchMercuryRelationsByTxIds'
import { useJobSummaryData } from '../hooks/useJobSummaryData'
import { PartsUnattributedMercuryListModal } from '../components/jobs/PartsUnattributedMercuryListModal'
import { PartsUnattributedAllJobsModal } from '../components/jobs/PartsUnattributedAllJobsModal'
import { MercuryTransactionAllocationsModal } from '../components/MercuryTransactionAllocationsModal'
import { useJobsMercuryAllocations } from '../hooks/useJobsMercuryAllocations'
import { useJobsStagesMutations } from '../hooks/useJobsStagesMutations'

type CustomerRow = Database['public']['Tables']['customers']['Row']
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
  const loadJobs = useCallback(() => {
    return runFetchJobs(customerFilterForFetch)
  }, [runFetchJobs, customerFilterForFetch])

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

  // Sub Sheet Ledger state (the payment/backcharge/edit-payment modal states moved to SubLaborPaymentModals in v2.824)
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
    stagesTabRef.current?.openBankPayments()
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



  useEffect(() => {
    if (activeTab === 'sub_sheet_ledger') {
      const t = setTimeout(() => loadRoster(), 80)
      return () => clearTimeout(t)
    }
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if (activeTab === 'stages' && searchParams.get('showBilledTotalByName') === 'true') {
      stagesTabRef.current?.showBilledTotalByName()
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('showBilledTotalByName')
        return next
      }, { replace: true })
    }
  }, [activeTab, searchParams, setSearchParams])


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
        jobThreadActivityByJobId={jobThreadActivityByJobId}
        jobThreadNotesLoadingId={jobThreadNotesLoadingId}
        jobThreadSubmittingId={jobThreadSubmittingId}
        jobThreadDraft={jobThreadDraft}
        setJobThreadDraft={setJobThreadDraft}
        submitJobThreadNote={submitJobThreadNote}
        jobThreadStatsByJobId={jobThreadStatsByJobId}
        refreshJobThreadStatsForJobIds={refreshJobThreadStatsForJobIds}
      />

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
        onOpenMakePayment={(target, defaultAmount) => subLaborPaymentModalsRef.current?.openMakePayment(target, defaultAmount)}
        onOpenBackcharge={(target) => subLaborPaymentModalsRef.current?.openBackcharge(target)}
        onOpenEditPayment={(payment, amountSeed, memoSeed) => subLaborPaymentModalsRef.current?.openEditPayment(payment, amountSeed, memoSeed)}
        onClearEditPayment={() => subLaborPaymentModalsRef.current?.clearEditPayment()}
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
