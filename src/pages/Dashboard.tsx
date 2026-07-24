import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { getCurrentUserName as getCurrentUserNameById } from '../lib/getCurrentUserName'
import { useAuth } from '../hooks/useAuth'
import { useDocumentVisibility } from '../hooks/useDocumentVisibility'
import { isAssistantLike, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import { useJobModeEnabled } from '../hooks/useJobModeEnabled'
import DashboardJobModeCard from '../components/jobMode/DashboardJobModeCard'
import TurnawayModal from '../components/jobMode/TurnawayModal'
import JobReportsModal from '../components/JobReportsModal'
import AdditionalReportModal from '../components/AdditionalReportModal'
import {
  DASHBOARD_CLOCK_STRIP_SCOPE_KEY,
  readClockStripScopeFromStorage,
  stripScopeEligible,
} from '../lib/dashboardClockStripScopeStorage'
import { billingJobMatchesSearch } from '../lib/jobs/billingTab'
import { DashboardUpcomingInspectionsSection } from '../components/dashboard/DashboardUpcomingInspectionsSection'
import { DashboardRecentReportsSection } from '../components/dashboard/DashboardRecentReportsSection'
import { DashboardMyBidsSection } from '../components/dashboard/DashboardMyBidsSection'
import { SectionDock } from '../components/SectionDock'
import {
  getPinnedForUserFromSupabase,
  type PinnedItem,
} from '../lib/pinnedTabs'
import { useToastContext } from '../contexts/ToastContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useWeeklyTeamLaborTotal } from '../hooks/useWeeklyTeamLaborTotal'
import { useBilledTotal } from '../hooks/useBilledTotal'
import { useSupplyHousesAPTotal } from '../hooks/useSupplyHousesAPTotal'
import { useSubLaborDueTotal } from '../hooks/useSubLaborDueTotal'
import { useIsMobile } from '../hooks/useIsMobile'
import { useNarrowViewport660 } from '../hooks/useNarrowViewport660'
import { useFirstAssistantDispatchPhone } from '../hooks/useFirstAssistantDispatchPhone'
import ClockInOutButton from '../components/ClockInOutButton'
import { DashboardContractSigningPromptModal } from '../components/DashboardContractSigningPromptModal'
import TeamFeedbackWizard from '../components/team-feedback/TeamFeedbackWizard'
import { fetchTeamFeedbackSettings } from '../lib/teamFeedback'
import DashboardMyTimeSection from '../components/DashboardMyTimeSection'
import { DashboardMyTimeDayEditorModal } from '../components/DashboardMyTimeDayEditorModal'
import DashboardDevRejectedNotification from '../components/DashboardDevRejectedNotification'
import DashboardMyTeamPendingBanner from '../components/DashboardMyTeamPendingBanner'
import DashboardFinancialsSection from '../components/DashboardFinancialsSection'
import { DashboardPinnedQuickRow } from '../components/dashboard/DashboardPinnedQuickRow'
import { filterPinnedByRole } from '../lib/dashboardPinnedRow'
import { DashboardTeamActiveClockStrip } from '../components/DashboardTeamActiveClockStrip'
import { useDashboardMyTeamSectionState } from '../hooks/useDashboardMyTeamSectionState'
import { useApplyScheduleProportions } from '../hooks/useApplyScheduleProportions'
import { ApplyScheduleApprovedConfirmModal } from '../components/clock-sessions/ApplyScheduleApprovedConfirmModal'
import { useDispatchInbox } from '../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../hooks/useEstimatorInbox'
import { DispatchDismissedItemsModal } from '../components/DispatchDismissedItemsModal'
import CreateTripChargeModal, { type CreateTripChargeTarget } from '../components/CreateTripChargeModal'
import { DashboardTeamsInboxCard } from '../components/dashboard/DashboardTeamsInboxCard'
import { DashboardProjectsCard } from '../components/dashboard/DashboardProjectsCard'
import { DashboardMyInboxCard } from '../components/dashboard/DashboardMyInboxCard'
import { type JobBillingContext } from '../lib/jobBillingContext'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import { denverCalendarDayKey, getDefaultWeekRange, getLastWeekRange } from '../utils/dateUtils'
import { withSupabaseRetry } from '../utils/errorHandling'
import { submitLinkJobPicturesDispatchRequestForJob } from '../lib/linkJobPicturesDispatchRequest'
import { readEdgeFunctionErrorBody } from '../lib/readEdgeFunctionErrorBody'
import { useDashboardBoot } from '../hooks/useDashboardBoot'
import { formatDatetime } from '../lib/dashboardProjectsCard'
import { displayNameFromAuthUser } from '../lib/displayNameFromAuthUser'
import { fetchHoursDaysCorrectWorkDates } from '../lib/fetchHoursDaysCorrectWorkDates'
import { resolveReadyToBillBillCustomerTarget } from '../lib/buildReadyToBillDashboardUnits'
import { isDashboardTeamReadyToBillRole } from '../lib/dashboardTeamAssignedJobRow'
import {
  dashboardJobHasCustomerForBilling,
  jobBillingFromDashboardInvoice,
  type InvoiceForDashboard,
} from '../lib/dashboardBillingInvoiceUnits'
import { useDashboardBillingInvoices } from '../hooks/useDashboardBillingInvoices'
import { syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import { fetchSalariedUserIdSetFromUserIds } from '../lib/salaryPayConfigGate'
import { recordNotComingInForUserAsStaff } from '../lib/notComingInTimeOff'
import { MyTeamSectionSkeleton } from '../components/dashboard/DashboardSkeletons'
import SubcontractorJobActivityModal from '../components/dashboard/SubcontractorJobActivityModal'
import { useDashboardSubSchedule } from '../hooks/useDashboardSubSchedule'
import { useDashboardAssignedJobs } from '../hooks/useDashboardAssignedJobs'
import { DashboardMyScheduleSection } from '../components/dashboard/DashboardMyScheduleSection'
import { DashboardTeamReadyToBillSection } from '../components/dashboard/DashboardTeamReadyToBillSection'
import { DashboardBillingPipelineSection } from '../components/dashboard/DashboardBillingPipelineSection'
import { DashboardAssignedJobsSection } from '../components/dashboard/DashboardAssignedJobsSection'
import { DashboardSuperintendentJobsSection } from '../components/dashboard/DashboardSuperintendentJobsSection'

const DashboardMyTeamSection = lazy(() => import('../components/DashboardMyTeamSection'))
import type { Database } from '../types/database'
import type { ClockSessionRow, DashboardStripSession } from '../types/clockSessions'

const HOURS_DAY_CORRECT_BLOCK_TOAST =
  'This day is marked correct in People → Hours. Unmark it there to edit time from the Dashboard.'

const DASHBOARD_MODAL_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
}
export default function Dashboard() {
  const jobDetailModal = useJobDetailModal()
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const isDocVisible = useDocumentVisibility()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const showStripSubjectMyTimeEditor =
    showClockStripScopeToggle || role === 'superintendent'
  const pendingClockBannerAtMyTeamTop = Boolean(authUser?.id && !showClockStripScopeToggle)
  const [clockStripScope, setClockStripScope] = useState<'team' | 'everyone'>(() =>
    readClockStripScopeFromStorage(role),
  )
  const setClockStripScopePersist = useCallback((next: 'team' | 'everyone') => {
    setClockStripScope(next)
    try {
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    if (!stripScopeEligible(role)) return
    try {
      if (typeof localStorage === 'undefined') return
      if (localStorage.getItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY) != null) return
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, 'everyone')
      setClockStripScope('everyone')
    } catch {
      /* ignore */
    }
  }, [role])
  const orgWideStripEnabled = showClockStripScopeToggle && clockStripScope === 'everyone'
  const myTeam = useDashboardMyTeamSectionState(authUser?.id, { orgWideStripEnabled })
  const reloadMyTeamPendingSilent = useCallback(() => {
    void myTeam.loadPending({ silent: true })
  }, [myTeam.loadPending])
  const applySchedule = useApplyScheduleProportions({
    authUserId: authUser?.id,
    onApplied: reloadMyTeamPendingSilent,
  })
  const goToPendingSessionsInMyTeam = useCallback(() => {
    myTeam.setMyTeamExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById('dashboard-my-team-pending-sessions')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    })
  }, [myTeam.setMyTeamExpanded])
  const sessionsForStrip = useMemo((): DashboardStripSession[] => {
    const isOpen = (s: DashboardStripSession) => s.clocked_out_at == null
    const base =
      showClockStripScopeToggle && clockStripScope === 'everyone'
        ? myTeam.orgWidePendingSessions
        : myTeam.pendingSessions
    const realOpen = base.filter(isOpen) as ClockSessionRow[]
    const merged: DashboardStripSession[] = [...realOpen, ...myTeam.stripSyntheticSalarySessions]
    merged.sort((a, b) => {
      const an = (a.users?.name ?? '').trim() || a.user_id
      const bn = (b.users?.name ?? '').trim() || b.user_id
      const c = an.localeCompare(bn, undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return a.clocked_in_at.localeCompare(b.clocked_in_at)
    })
    return merged
  }, [
    showClockStripScopeToggle,
    clockStripScope,
    myTeam.orgWidePendingSessions,
    myTeam.pendingSessions,
    myTeam.stripSyntheticSalarySessions,
  ])

  const hoursTodayForStrip = useMemo(() => {
    if (showClockStripScopeToggle && clockStripScope === 'everyone') {
      return myTeam.hoursTodayByUserIdOrg
    }
    return myTeam.hoursTodayByUserId
  }, [showClockStripScopeToggle, clockStripScope, myTeam.hoursTodayByUserIdOrg, myTeam.hoursTodayByUserId])

  const showClockActivityStrip = useMemo(
    () => sessionsForStrip.length > 0 || myTeam.clockedInTodayStripRows.length > 0,
    [sessionsForStrip, myTeam.clockedInTodayStripRows],
  )

  const stripPayGateUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (authUser?.id) ids.add(authUser.id)
    for (const id of myTeam.memberUserIds) ids.add(id)
    for (const s of sessionsForStrip) ids.add(s.user_id)
    for (const r of myTeam.clockedInTodayStripRows) ids.add(r.userId)
    return [...ids]
  }, [authUser?.id, myTeam.memberUserIds, sessionsForStrip, myTeam.clockedInTodayStripRows])

  const [stripSalariedUserIds, setStripSalariedUserIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (stripPayGateUserIds.length === 0) {
      setStripSalariedUserIds(new Set())
      return
    }
    let cancelled = false
    void fetchSalariedUserIdSetFromUserIds(stripPayGateUserIds).then((set) => {
      if (!cancelled) setStripSalariedUserIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [stripPayGateUserIds])

  const hoursDaysCorrectRange = useMemo(() => {
    const { start: w0, end: w1 } = getDefaultWeekRange()
    const { start: l0, end: l1 } = getLastWeekRange()
    const today = denverCalendarDayKey(Date.now())
    const strip = myTeam.clockStripWorkDateYmd
    const keys = [w0, w1, l0, l1, today, strip]
    const start = keys.reduce((a, b) => (a < b ? a : b))
    const end = keys.reduce((a, b) => (a > b ? a : b))
    return { start, end }
  }, [myTeam.clockStripWorkDateYmd])

  const [hoursDaysCorrectSet, setHoursDaysCorrectSet] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      try {
        const set = await fetchHoursDaysCorrectWorkDates(hoursDaysCorrectRange.start, hoursDaysCorrectRange.end)
        if (!cancelled) setHoursDaysCorrectSet(set)
      } catch {
        if (!cancelled) setHoursDaysCorrectSet(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, hoursDaysCorrectRange.start, hoursDaysCorrectRange.end])

  const [stripMyTimeEditor, setStripMyTimeEditor] = useState<{
    subjectUserId: string
    displayName: string
    dateStr: string
    showSalariedStripFooter: boolean
    clockTimesReadOnly: boolean
  } | null>(null)
  const openStripMyTimeEditor = useCallback(
    (p: { subjectUserId: string; displayName: string }) => {
      const dateStr = myTeam.clockStripWorkDateYmd
      if (hoursDaysCorrectSet.has(dateStr)) {
        showToast(HOURS_DAY_CORRECT_BLOCK_TOAST, 'warning')
        return
      }
      setStripMyTimeEditor({
        ...p,
        dateStr,
        showSalariedStripFooter: stripSalariedUserIds.has(p.subjectUserId),
        clockTimesReadOnly: !showClockStripScopeToggle,
      })
    },
    [
      hoursDaysCorrectSet,
      myTeam.clockStripWorkDateYmd,
      showClockStripScopeToggle,
      showToast,
      stripSalariedUserIds,
    ],
  )

  useEffect(() => {
    setStripMyTimeEditor((prev) => {
      if (!prev) return prev
      const shouldShow = stripSalariedUserIds.has(prev.subjectUserId)
      if (shouldShow === prev.showSalariedStripFooter) return prev
      return { ...prev, showSalariedStripFooter: shouldShow }
    })
  }, [stripSalariedUserIds])
  const isMobile = useIsMobile()
  const narrowViewport660 = useNarrowViewport660()
  const firstAssistantDispatchPhone = useFirstAssistantDispatchPhone(isSubcontractorLikeRole(role))
  const {
    subscribedSteps,
    assignedSteps,
    todayChecklist,
    setTodayChecklist,
    userError,
    setUserError,
    userLoading,
    checklistLoading,
    assignedLoading,
    subscribedLoading,
    userNames,
    userName,
    loadAssignedSteps,
  } = useDashboardBoot({ authUserId: authUser?.id })
  /** Mirrors DashboardMyInboxCard’s render gate (reported via onVisibleChange) for the SectionDock entry. */
  const [myInboxDockVisible, setMyInboxDockVisible] = useState(true)
  const [pinnedRoutes, setPinnedRoutes] = useState<PinnedItem[]>([])
  const {
    assignedJobs,
    setAssignedJobs,
    assignedJobsLoading,
    assignedReadyToBillJobs,
    setAssignedReadyToBillJobs,
    assignedReadyToBillLoading,
    superintendentJobs,
    setSuperintendentJobs,
    superintendentJobsLoading,
    refreshDashboardAssignedJobLists,
    refreshAssignedReadyToBill,
    resyncDashboardAfterUpdateJobStatusFailureRef,
  } = useDashboardAssignedJobs({ authUserId: authUser?.id, role })
  /** v2.841: Assigned Jobs card search — same predicate as the Jobs → Billing search. */
  const [assignedJobsSearch, setAssignedJobsSearch] = useState('')
  const filteredAssignedJobs = useMemo(
    () =>
      assignedJobsSearch.trim() === ''
        ? assignedJobs
        : assignedJobs.filter((j) => billingJobMatchesSearch(j, assignedJobsSearch)),
    [assignedJobs, assignedJobsSearch],
  )
  const [superintendentJobsExpanded, setSuperintendentJobsExpanded] = useState(true)
  const {
    subScheduleLoading,
    subScheduleLabels,
    subSchedulePhones,
    subScheduleDayPartition,
    leaveReportReminderForJobRow,
  } = useDashboardSubSchedule({
    authUserId: authUser?.id,
    role,
    assignedJobs,
    assignedReadyToBillJobs,
  })
  // Billing-invoices engine seam (v2.727): invoice/job lists + loaders +
  // refreshInvoices/updateJobStatus/revert/delete + locks live in the hook.
  // The resync ref's .current (quirk #10) is now assigned inside the hook's
  // body — still during render, same pass as before.
  const {
    readyToBillInvoices,
    readyToBillLoading,
    readyToBillDashboardUnits,
    waitingForPaymentLoading,
    billedWaitingDashboardUnits,
    shouldShowPrepareBillForFieldQueue,
    invoiceStatusUpdatingId,
    jobStatusUpdatingId,
    dashboardInvoiceSendBackConfirmLockRef,
    readyToBillDetailModalAssignedRows,
    updateJobStatus,
    moveJobToReadyToBillWithStripePrep,
    refreshInvoices,
    revertBilledDashboardInvoiceToReadyToBill,
    deleteInvoice,
  } = useDashboardBillingInvoices({
    authUserId: authUser?.id,
    role,
    setAssignedJobs,
    setAssignedReadyToBillJobs,
    setSuperintendentJobs,
    resyncDashboardAfterUpdateJobStatusFailureRef,
  })
  // Render-body ref assignment (quirk #10) — stays parent-side: every consumer
  // of `refreshInvoicesRef` lives in this file.
  const refreshInvoicesRef = useRef(refreshInvoices)
  refreshInvoicesRef.current = refreshInvoices
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [subcontractorJobActivityModalJob, setSubcontractorJobActivityModalJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
  } | null>(null)
  const [leaveReportJob, setLeaveReportJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [turnawayJob, setTurnawayJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [jobModeEnabled] = useJobModeEnabled(authUser?.id ?? null)
  // Component-local "show full dashboard" override; resets every page load so
  // the field-first paint is consistent. The Job Mode toggle in the gear menu
  // remains the persistent setting.
  const [jobModeShowFullDashboard, setJobModeShowFullDashboard] = useState(false)
  const [dashboardButtonVisibility, setDashboardButtonVisibility] = useState<Record<string, boolean> | null>(null)
  const [quickButtonsPlacement, setQuickButtonsPlacement] = useState<'top' | 'with_pins'>('with_pins')
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [sendRecordJobMeta, setSendRecordJobMeta] = useState<{ id: string } | null>(null)
  const clockDisplayName = useMemo(
    () => userName ?? displayNameFromAuthUser(authUser),
    [userName, authUser],
  )
  const [dashboardSelfIsSalary, setDashboardSelfIsSalary] = useState(false)
  /** Same rule as ClockInOutButton salaryUiActive: pay is_salary plus salary_work_schedule_templates row. */
  const [dashboardSalaryScheduleClockActive, setDashboardSalaryScheduleClockActive] = useState(false)
  useEffect(() => {
    const name = clockDisplayName?.trim()
    if (!name) {
      setDashboardSelfIsSalary(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle(),
          'dashboard self people_pay_config is_salary',
        )
        if (!cancelled) setDashboardSelfIsSalary(!!(row as { is_salary?: boolean } | null)?.is_salary)
      } catch {
        if (!cancelled) setDashboardSelfIsSalary(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clockDisplayName])
  useEffect(() => {
    const name = clockDisplayName?.trim()
    const uid = authUser?.id
    if (!name || !uid) {
      setDashboardSalaryScheduleClockActive(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [pay, tmpl] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle(),
            'dashboard salary schedule people_pay_config is_salary',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', uid).maybeSingle(),
            'dashboard salary_work_schedule_templates for user',
          ),
        ])
        if (cancelled) return
        const sal = !!(pay as { is_salary?: boolean } | null)?.is_salary
        setDashboardSalaryScheduleClockActive(sal && !!tmpl)
      } catch {
        if (!cancelled) setDashboardSalaryScheduleClockActive(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clockDisplayName, authUser?.id])
  const openMyTimePreviewFromClock = useCallback(() => {
    if (!authUser?.id) return
    const dateStr = denverCalendarDayKey(Date.now())
    if (hoursDaysCorrectSet.has(dateStr)) {
      showToast(HOURS_DAY_CORRECT_BLOCK_TOAST, 'warning')
      return
    }
    setStripMyTimeEditor({
      subjectUserId: authUser.id,
      displayName: clockDisplayName?.trim() || 'You',
      dateStr,
      showSalariedStripFooter: stripSalariedUserIds.has(authUser.id),
      clockTimesReadOnly: true,
    })
  }, [authUser?.id, clockDisplayName, hoursDaysCorrectSet, showToast, stripSalariedUserIds])
  const [teamFeedbackHomeEnabled, setTeamFeedbackHomeEnabled] = useState(false)
  const [teamFeedbackWizardOpen, setTeamFeedbackWizardOpen] = useState(false)
  const [contractSigningPromptOpen, setContractSigningPromptOpen] = useState(false)
  const [contractSigningPromptRows, setContractSigningPromptRows] = useState<
    Array<{ id: string; document_name: string; status: string }>
  >([])
  const [contractSigningPromptOpeningId, setContractSigningPromptOpeningId] = useState<string | null>(null)
  /** Guards salary visit-time RPC so React Strict Mode double-mount does not open the modal twice. */
  const contractSigningVisitPromptEpochRef = useRef(0)

  const fetchContractDashboardPromptRows = useCallback(async () => {
    return (await withSupabaseRetry(
      () => supabase.rpc('list_my_contract_dashboard_prompts'),
      'list_my_contract_dashboard_prompts',
    )) as Array<{ id: string; document_name: string; status: string }>
  }, [])

  const runContractSigningPromptFromRpc = useCallback(async () => {
    try {
      const rows = await fetchContractDashboardPromptRows()
      if (rows.length > 0) {
        setContractSigningPromptRows(rows)
        setContractSigningPromptOpen(true)
      }
    } catch {
      /* ignore — do not block clock-in on RPC failure */
    }
  }, [fetchContractDashboardPromptRows])

  const handleClockInSuccessContractPrompt = useCallback(async () => {
    if (!authUser?.id) return
    await runContractSigningPromptFromRpc()
  }, [authUser?.id, runContractSigningPromptFromRpc])

  useEffect(() => {
    if (!authUser?.id || !dashboardSalaryScheduleClockActive) return
    contractSigningVisitPromptEpochRef.current += 1
    const epoch = contractSigningVisitPromptEpochRef.current
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchContractDashboardPromptRows()
        if (cancelled || epoch !== contractSigningVisitPromptEpochRef.current) return
        if (rows.length > 0) {
          setContractSigningPromptRows(rows)
          setContractSigningPromptOpen(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, dashboardSalaryScheduleClockActive, fetchContractDashboardPromptRows])

  const [dispatchDismissedModalOpen, setDispatchDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  /** Data half of the My Bids dock gate, reported up by DashboardMyBidsSection (which owns the section state). */
  const [myBidsDockHasContent, setMyBidsDockHasContent] = useState(false)

  const isDev = role === 'dev'
  // Both inbox engines stay here (not in DashboardTeamsInboxCard): the
  // SectionDock entry + the card render gates need the eligibility flags, and
  // DispatchDismissedItemsModal (rendered once, outside both card positions)
  // needs fetchDismissedDispatchInboxRows.
  const dispatchInbox = useDispatchInbox()
  const { dispatchInboxEligible, fetchDismissedDispatchInboxRows } = dispatchInbox
  const estimatorInbox = useEstimatorInbox()
  const { estimatorInboxEligible } = estimatorInbox
  const billCustomer = useBillCustomerModal()
  const materializeSalarySessionForStrip = useCallback(
    async (userId: string) => {
      const { error } = await syncSalaryClockSessionsForUserDay(userId)
      if (error) {
        showToast(error, 'error')
        return
      }
      await myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending],
  )
  const handleStripMarkNotComingIn = useCallback(
    async (p: { subjectUserId: string; displayName: string; workDateYmd: string }) => {
      const result = await recordNotComingInForUserAsStaff({
        subjectUserId: p.subjectUserId,
        workDateYmd: p.workDateYmd,
      })
      if (result.ok && result.alreadyMarked) {
        showToast(`${p.displayName} already has unpaid time off on ${p.workDateYmd}.`, 'warning')
        return
      }
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      showToast(`Marked ${p.displayName} as not coming in (${p.workDateYmd}).`, 'success')
      if (result.syncWarning) {
        showToast(`Salary sync: ${result.syncWarning}`, 'warning')
      }
      void myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending],
  )
  const visiblePins = filterPinnedByRole(pinnedRoutes, role, estimatorProspectsAccess)
  const hasCostMatrixPin = visiblePins.some((p) => p.path === '/people' && p.tab === 'hours')
  const hasBilledPin = visiblePins.some((p) => p.path === '/jobs' && p.tab === 'billed')
  const hasSupplyHousesAPPin = visiblePins.some((p) => p.path === '/materials' && p.tab === 'supply-houses')
  const hasSubLaborDuePin = visiblePins.some((p) => p.path === '/jobs' && p.tab === 'sub_sheet_ledger')
  const [financialRefreshKey, setFinancialRefreshKey] = useState(0)
  /** Coalesce WAL bursts from financial-pin tables into one REST refresh (see dashboard-financial-pins channel). */
  const FINANCIAL_PINS_REALTIME_DEBOUNCE_MS = 1200
  const financialPinsRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFinancialPinsRefreshFromRealtime = useCallback(() => {
    if (!isDocVisible) return
    if (financialPinsRealtimeTimerRef.current) clearTimeout(financialPinsRealtimeTimerRef.current)
    financialPinsRealtimeTimerRef.current = setTimeout(() => {
      financialPinsRealtimeTimerRef.current = null
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      setFinancialRefreshKey((k) => k + 1)
    }, FINANCIAL_PINS_REALTIME_DEBOUNCE_MS)
  }, [isDocVisible])
  const { total: costMatrixTotal } = useWeeklyTeamLaborTotal(hasCostMatrixPin)
  const { count: billedCount, total: billedTotal } = useBilledTotal(hasBilledPin, financialRefreshKey)
  const { total: supplyHousesAPTotal } = useSupplyHousesAPTotal(hasSupplyHousesAPPin, financialRefreshKey)
  const { total: subLaborDueTotal } = useSubLaborDueTotal(hasSubLaborDuePin, financialRefreshKey)

  useEffect(() => {
    if (!authUser?.id) {
      setTeamFeedbackHomeEnabled(false)
      return
    }
    let cancelled = false
    void fetchTeamFeedbackSettings()
      .then((s) => {
        if (!cancelled) setTeamFeedbackHomeEnabled(!!s?.enabled && !!s?.home_entry_enabled)
      })
      .catch(() => {
        if (!cancelled) setTeamFeedbackHomeEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const openContractSigningPageForDoc = useCallback(
    async (personContractDocumentId: string) => {
      setContractSigningPromptOpeningId(personContractDocumentId)
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
        const { data: raw, error: fnErr } = await supabase.functions.invoke('get-contract-signing-link-for-self', {
          body: { person_contract_document_id: personContractDocumentId, public_origin: origin },
        })
        if (fnErr) {
          const detail = await readEdgeFunctionErrorBody(fnErr)
          showToast(detail ?? fnErr.message ?? 'Could not open signing page', 'error')
          return
        }
        const json = raw as { ok?: boolean; accept_url?: string; error?: string }
        if (!json?.ok || !json.accept_url) {
          showToast(json?.error ?? 'Could not open signing page', 'error')
          return
        }
        window.location.assign(json.accept_url)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not open signing page', 'error')
      } finally {
        setContractSigningPromptOpeningId(null)
      }
    },
    [showToast],
  )

  async function refreshPinned() {
    if (!authUser?.id) {
      setPinnedRoutes([])
      return
    }
    // Single source now (self + dev pins live in user_pinned_tabs), already ordered by sort_order.
    const fromDb = await getPinnedForUserFromSupabase(authUser.id)
    setPinnedRoutes(fromDb)
  }

  useEffect(() => {
    refreshPinned()
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) {
      setDashboardButtonVisibility(null)
      return
    }
    supabase
      .from('user_dashboard_buttons')
      .select('button_key, visible')
      .eq('user_id', authUser.id)
      .then(({ data }) => {
        const defaults: Record<string, boolean> = { job: true, job_labor: true, bid: true, project: true, part: true, assembly: true, prospect: true, inspections: true, builder_review: role === 'master_technician' }
        const map = { ...defaults }
        for (const r of (data ?? []) as Array<{ button_key: string; visible: boolean }>) {
          if (r.button_key in map) map[r.button_key] = r.visible
        }
        setDashboardButtonVisibility(map)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) {
      setQuickButtonsPlacement('top')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('user_dashboard_preferences')
              .select('quick_buttons_placement')
              .eq('user_id', authUser.id)
              .maybeSingle(),
          'load user dashboard preferences',
        )
        if (cancelled) return
        const p = (row as { quick_buttons_placement?: string } | null)?.quick_buttons_placement
        // Default is with_pins (one row, uniform height); an explicit 'top' choice is honored.
        setQuickButtonsPlacement(p === 'top' ? 'top' : 'with_pins')
      } catch {
        if (!cancelled) setQuickButtonsPlacement('with_pins')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  // user_dashboard_preferences was dropped from supabase_realtime as part of
  // the Tier 1 mitigation (see migration 20260520172210). Cross-tab sync of
  // quick_buttons_placement is gone, but the value is rarely changed and the
  // initial fetch elsewhere in this file covers first-paint. Listener removed.

  useEffect(() => {
    return () => {
      if (financialPinsRealtimeTimerRef.current) {
        clearTimeout(financialPinsRealtimeTimerRef.current)
        financialPinsRealtimeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onPinsChanged = () => {
      refreshPinned()
      setFinancialRefreshKey((k) => k + 1)
    }
    window.addEventListener('pipetooling-pins-changed', onPinsChanged)
    window.addEventListener('focus', onPinsChanged)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPinned()
        setFinancialRefreshKey((k) => k + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pipetooling-pins-changed', onPinsChanged)
      window.removeEventListener('focus', onPinsChanged)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authUser?.id])

  // user_pinned_tabs was dropped from supabase_realtime as part of the Tier 1
  // mitigation (see migration 20260520172210). The window-focus and
  // pipetooling-pins-changed listeners above already trigger refreshPinned()
  // on the surfaces that matter; cross-tab realtime sync was nice-to-have.

  // Realtime: refresh financial pin totals when underlying data changes.
  // Only jobs_ledger_invoices is in supabase_realtime today. If
  // supply_house_invoices, people_labor_jobs, people_labor_job_payments,
  // people_labor_job_items, or jobs_ledger are added to the publication
  // later, add them here in the same PR per
  // .cursor/rules/supabase-realtime.mdc — subscribing to a non-published
  // table is a silent no-op and misleads future readers.
  const dashboardFinancialPinsEnabled =
    !!authUser?.id && (hasBilledPin || hasSupplyHousesAPPin || hasSubLaborDuePin)
  const dashboardFinancialPinsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'jobs_ledger_invoices' }],
    [],
  )
  useRealtimeChannel(
    dashboardFinancialPinsEnabled,
    'dashboard-financial-pins',
    dashboardFinancialPinsFilters,
    () => scheduleFinancialPinsRefreshFromRealtime(),
    { debounceMs: 500 },
  )

  const detailModalAssignedJobsRows = useMemo(
    () => [...assignedJobs, ...assignedReadyToBillJobs],
    [assignedJobs, assignedReadyToBillJobs],
  )

  const openJobDetailFromDashboardJobRow = useCallback(
    (j: { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }) => {
      const hcp = (j.hcp_number ?? '').trim() || '—'
      const name = (j.job_name ?? '').trim() || '—'
      jobDetailModal?.openJobDetail({
        jobId: j.id,
        scheduleContext: null,
        prefillRowLabel: `${hcp} · ${name}`,
        prefillAddress: (j.job_address ?? '').trim() || null,
        assignedJobsRows: detailModalAssignedJobsRows,
      })
    },
    [jobDetailModal, detailModalAssignedJobsRows],
  )

  const openReadyToBillEditJob = useCallback(
    (jobId: string) => {
      jobFormModal?.openEditJob(jobId, { onSaved: () => void refreshInvoicesRef.current() })
    },
    [jobFormModal],
  )

  const submitLinkJobPicturesDispatchRequest = useCallback(
    (args: {
      jobId: string
      hcpNumber: string | null | undefined
      jobName: string | null | undefined
      jobAddress: string | null | undefined
    }) => submitLinkJobPicturesDispatchRequestForJob(authUser?.id, showToast, args),
    [authUser?.id, showToast],
  )

  const openReadyToBillDetailJobModal = useCallback(
    (args: { jobId: string; hcpNumber: string; jobName: string; jobAddress: string }) => {
      const h = args.hcpNumber.trim() || '—'
      const n = args.jobName.trim() || 'Job'
      jobDetailModal?.openJobDetail({
        jobId: args.jobId,
        scheduleContext: null,
        prefillRowLabel: `${h} · ${n}`,
        prefillAddress: args.jobAddress.trim() || null,
        assignedJobsRows: readyToBillDetailModalAssignedRows,
        onEditJobSaved: () => void refreshInvoicesRef.current(),
      })
    },
    [jobDetailModal, readyToBillDetailModalAssignedRows],
  )

  useEffect(() => {
    if (!sendRecordJobMeta) return
    let cancelled = false
    void (async () => {
      try {
        type JobBillingRow = Pick<
          Database['public']['Tables']['jobs_ledger']['Row'],
          | 'id'
          | 'master_user_id'
          | 'customer_id'
          | 'customer_name'
          | 'customer_email'
          | 'customer_phone'
          | 'hcp_number'
          | 'job_name'
          | 'job_address'
          | 'last_work_date'
        >
        const data = await withSupabaseRetry<JobBillingRow | null>(
          async () =>
            supabase
              .from('jobs_ledger')
              .select(
                'id, master_user_id, customer_id, customer_name, customer_email, customer_phone, hcp_number, job_name, job_address, last_work_date',
              )
              .eq('id', sendRecordJobMeta.id)
              .maybeSingle(),
          'load job for send invoice modal',
        )
        if (cancelled) return
        if (!data) {
          showToast?.('Could not load job', 'error')
          setSendRecordJobMeta(null)
          return
        }
        if (!dashboardJobHasCustomerForBilling(data.customer_id)) {
          showToast?.('Link this job to a customer before billing.', 'error')
          setSendRecordJobMeta(null)
          return
        }
        const ctx: JobBillingContext = {
          id: data.id,
          master_user_id: data.master_user_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          hcp_number: data.hcp_number,
          job_name: data.job_name,
          job_address: data.job_address,
          customer_phone: data.customer_phone,
          last_work_date: data.last_work_date,
        }
        billCustomer?.openBillCustomer({
          payload: { kind: 'job', job: ctx },
          onSuccess: async () => {
            await refreshInvoicesRef.current()
          },
          onAfterEnsureSuccess: async () => {
            await refreshInvoicesRef.current()
          },
        })
        setSendRecordJobMeta(null)
      } catch (e) {
        if (cancelled) return
        showToast?.(e instanceof Error ? e.message : 'Could not load job', 'error')
        setSendRecordJobMeta(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sendRecordJobMeta?.id, showToast, billCustomer])

  function openDashboardBillCustomerInvoice(inv: InvoiceForDashboard) {
    billCustomer?.openBillCustomer({
      payload: {
        kind: 'invoice',
        job: jobBillingFromDashboardInvoice(inv),
        invoice: {
          id: inv.id,
          amount: inv.amount,
          status: inv.status,
          stripe_invoice_memo: inv.stripe_invoice_memo,
          is_primary_rtb_bundle: inv.is_primary_rtb_bundle,
        },
      },
      onSuccess: refreshInvoices,
      onAfterEnsureSuccess: refreshInvoices,
    })
  }

  function handlePrepareBillFromFieldQueue(jobId: string) {
    const resolved = resolveReadyToBillBillCustomerTarget(jobId, readyToBillDashboardUnits)
    if (resolved.mode === 'none') {
      showToast?.(
        'This job is not in Ready to Bill. Open Jobs or refresh the dashboard.',
        'error',
      )
      return
    }
    if (resolved.mode === 'ambiguous') {
      showToast?.(
        `Multiple Ready to Bill lines for this job (${resolved.count}). Use the Ready to Bill section to pick one.`,
        'error',
      )
      return
    }
    if (resolved.mode === 'job') {
      if (!dashboardJobHasCustomerForBilling(resolved.job.customer_id)) {
        showToast?.('Link this job to a customer before billing.', 'error')
        return
      }
      setSendRecordJobMeta({ id: jobId })
      return
    }
    if (!dashboardJobHasCustomerForBilling(resolved.inv.customer_id)) {
      showToast?.('Link this job to a customer before billing.', 'error')
      return
    }
    openDashboardBillCustomerInvoice(resolved.inv)
  }

  // Billing Pipeline section (v2.728): one component mounted at BOTH role
  // positions (assistant branch + dev/master branch — quirk #1 collapsed; the
  // mutually exclusive gates mean exactly one copy mounts). The section owns
  // its expanded flags + the mark-paid/send-back modal cluster; sendRecordJobMeta
  // stays here (also opened by handlePrepareBillFromFieldQueue).
  const billingPipelineSectionProps = {
    authUserId: authUser?.id,
    role,
    readyToBillInvoices,
    readyToBillLoading,
    readyToBillDashboardUnits,
    waitingForPaymentLoading,
    billedWaitingDashboardUnits,
    invoiceStatusUpdatingId,
    jobStatusUpdatingId,
    dashboardInvoiceSendBackConfirmLockRef,
    updateJobStatus,
    refreshInvoices,
    revertBilledDashboardInvoiceToReadyToBill,
    deleteInvoice,
    shouldShowPrepareBillForFieldQueue,
    handlePrepareBillFromFieldQueue,
    openReadyToBillEditJob,
    openReadyToBillDetailJobModal,
    openDashboardBillCustomerInvoice,
    setSendRecordJobMeta,
    setViewReportsJob,
  }

  const getCurrentUserName = () => getCurrentUserNameById(authUser?.id)

  const showAssigned = assignedLoading || assignedSteps.length > 0
  const showSubscribed = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  /** Projects card wraps Assigned + Subscribed stages; visible if either sub-section would show. */
  const projectsCardVisible =
    userLoading || showAssigned || (showSubscribed && (subscribedLoading || subscribedSteps.length > 0))
  const showRecent = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
  const showFinancials = role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  const showDashboardQuickButtons = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const quickActionLinkStyle: CSSProperties = {
    padding: '0.75rem 1.25rem',
    background: '#3b82f6',
    color: 'white',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1rem',
  }
  const quickActionDefs = useMemo(() => {
    if (!showDashboardQuickButtons || role === null) {
      return [] as Array<{ key: string; label: string; to: string }>
    }
    return [
      { key: 'job', label: 'Job', to: '/jobs?tab=billing&newJob=true' },
      { key: 'job_labor', label: 'Job Labor', to: '/jobs?tab=sub_sheet_ledger&newJob=true' },
      { key: 'bid', label: 'Bid', to: '/bids?new=true' },
      { key: 'project', label: 'Project', to: '/projects/new' },
      { key: 'part', label: 'Part', to: '/materials?tab=parts-book&addPart=true' },
      { key: 'assembly', label: 'Assembly', to: '/materials?tab=assembly-book&addAssembly=true' },
      { key: 'prospect', label: 'Prospect', to: '/prospects?newProspect=true' },
      { key: 'inspections', label: 'Inspections', to: '/jobs?tab=inspections' },
      { key: 'builder_review', label: 'Builder Review', to: '/bids?tab=builder-review' },
    ]
      .filter((b) => (b.key === 'builder_review' ? role === 'master_technician' : true))
      .filter((b) => dashboardButtonVisibility?.[b.key] !== false)
  }, [showDashboardQuickButtons, role, dashboardButtonVisibility])

  // Banners + tally + Job Report + quick actions + pins row live in
  // DashboardPinnedQuickRow (v2.723), mounted at BOTH positions (Job Mode early
  // return + main return). pinnedRoutes/visiblePins and the financial pin total
  // hooks stay here: the has*Pin flags they derive from also enable the
  // dashboard-financial-pins realtime channel, and quick-button state stays
  // because dashboardButtonVisibility also gates the Upcoming-inspection
  // section and the top placement renders outside the block.
  const pinnedQuickRowSharedProps = {
    authUserId: authUser?.id,
    role,
    visiblePins,
    quickActionDefs,
    quickButtonsPlacement,
    showDashboardQuickButtons,
    costMatrixTotal,
    billedCount,
    billedTotal,
    supplyHousesAPTotal,
    subLaborDueTotal,
  }

  /** Above-the-fold: quick actions and clock first; checklist/assigned use skeletons until data arrives. */
  /** Mounted directly below the Job Report row via DashboardPinnedQuickRow's afterJobReportRow slot (all roles),
   *  and again in the Job Mode early return between the job card and "Show full dashboard". */
  const myScheduleSection = (
    <DashboardMyScheduleSection
      role={role}
      firstAssistantDispatchPhone={firstAssistantDispatchPhone}
      subScheduleLoading={subScheduleLoading}
      subScheduleDayPartition={subScheduleDayPartition}
      subScheduleLabels={subScheduleLabels}
      subSchedulePhones={subSchedulePhones}
      leaveReportReminderForJobRow={leaveReportReminderForJobRow}
      assignedJobs={assignedJobs}
      assignedReadyToBillJobs={assignedReadyToBillJobs}
      detailModalAssignedJobsRows={detailModalAssignedJobsRows}
      submitLinkJobPicturesDispatchRequest={submitLinkJobPicturesDispatchRequest}
      setLeaveReportJob={setLeaveReportJob}
    />
  )

  // Job Mode focused view: replaces top of Dashboard with one big card; rest of
  // Dashboard is hidden until user taps "Show full dashboard" (component-local;
  // resets every page load). Toggle lives in the header gear menu (Layout.tsx).
  if (jobModeEnabled && !jobModeShowFullDashboard && authUser?.id) {
    return (
      <div>
        {/* renderModals={false}: the tail modals never mounted in this early return (their openers are inert in Job Mode) — preserved.
            hideBanners: notification banners live in the Job Mode Inbox tab instead (v2.917). */}
        <DashboardPinnedQuickRow {...pinnedQuickRowSharedProps} renderModals={false} hideBanners />
        <DashboardJobModeCard
          userId={authUser.id}
          onLeaveReport={(j) => setLeaveReportJob(j)}
          onTurnaway={(j) => setTurnawayJob(j)}
        />
        <div style={{ marginTop: '0.75rem' }}>{myScheduleSection}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setJobModeShowFullDashboard(true)}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-gray-800)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Show full dashboard
          </button>
        </div>
        {leaveReportJob && (
          <AdditionalReportModal
            open={!!leaveReportJob}
            onClose={() => setLeaveReportJob(null)}
            onSaved={() => {
              setLeaveReportJob(null)
              void refreshDashboardAssignedJobLists()
            }}
            onReportSaved={() => void refreshDashboardAssignedJobLists()}
            authUserId={authUser?.id ?? null}
            userRole={role}
            jobId={leaveReportJob.id}
            hcpNumber={leaveReportJob.hcpNumber}
            jobName={leaveReportJob.jobName}
            jobAddress={leaveReportJob.jobAddress}
          />
        )}
        {turnawayJob && (
          <TurnawayModal
            open={!!turnawayJob}
            onClose={() => setTurnawayJob(null)}
            onSubmitted={() => {
              setTurnawayJob(null)
              void refreshDashboardAssignedJobLists()
            }}
            authUserId={authUser?.id ?? null}
            userRole={role}
            jobId={turnawayJob.id}
            hcpNumber={turnawayJob.hcpNumber}
            jobName={turnawayJob.jobName}
            jobAddress={turnawayJob.jobAddress}
          />
        )}
      </div>
    )
  }

  const dockAnchorStyle: CSSProperties = { scrollMarginTop: 8 }
  /** Sections offered by the floating bottom dock; mirrors each section's render gate. */
  const dockSections = [
    { id: 'dash-my-schedule', label: 'My Schedule', visible: Boolean(authUser?.id) },
    { id: 'dash-notifications', label: 'Notifications', visible: showFinancials },
    { id: 'dash-clocked-in', label: 'ClockedIn', visible: Boolean(authUser?.id && showClockActivityStrip) },
    { id: 'dash-my-inbox', label: 'My Inbox', visible: myInboxDockVisible },
    {
      id: 'dash-teams-inbox',
      label: 'Teams Inbox',
      visible: Boolean(authUser?.id && (dispatchInboxEligible || estimatorInboxEligible)),
    },
    {
      id: 'dash-bids',
      label: 'Bids',
      visible:
        (role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator' || role === 'primary') &&
        myBidsDockHasContent,
    },
    { id: 'dash-reports', label: 'Reports', visible: showRecent },
    {
      id: 'dash-ready-to-bill',
      label: 'Ready to Bill',
      visible:
        isDashboardTeamReadyToBillRole(role) &&
        (assignedReadyToBillLoading || assignedReadyToBillJobs.length > 0),
    },
    {
      id: 'dash-assigned-jobs',
      label: 'Assigned Jobs',
      visible: assignedJobsLoading || assignedJobs.length > 0,
    },
    {
      id: 'dash-billing',
      label: 'Billing',
      visible: isAssistantLike(role) || role === 'dev' || role === 'master_technician',
    },
    { id: 'dash-projects', label: 'Projects', visible: projectsCardVisible },
    { id: 'dash-me', label: 'Me', visible: Boolean(authUser?.id) },
  ].filter((sec) => sec.visible)

  const myInboxCard = (
    <DashboardMyInboxCard
      authUserId={authUser?.id}
      role={role}
      isMobile={isMobile}
      todayChecklist={todayChecklist}
      setTodayChecklist={setTodayChecklist}
      checklistLoading={checklistLoading}
      userLoading={userLoading}
      setUserError={setUserError}
      getCurrentUserName={getCurrentUserName}
      onVisibleChange={setMyInboxDockVisible}
    />
  )

  return (
    <div style={{ paddingBottom: dockSections.length > 1 ? '4.5rem' : 0 }}>
      {dockSections.length > 1 ? <SectionDock sections={dockSections} ariaLabel="Dashboard sections" /> : null}
      {showDashboardQuickButtons && quickButtonsPlacement === 'top' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', justifyContent: 'center' }}>
          {quickActionDefs.map((b) => (
            <Link key={b.key} to={b.to} style={quickActionLinkStyle}>
              {b.label}
            </Link>
          ))}
        </div>
      )}
      {authUser?.id && (
        <ClockInOutButton
          userId={authUser.id}
          userName={clockDisplayName}
          onOpenMyTimeDayEditor={dashboardSelfIsSalary ? undefined : openMyTimePreviewFromClock}
          onClockInSuccess={handleClockInSuccessContractPrompt}
          onFieldReportSaved={() => void refreshDashboardAssignedJobLists()}
        />
      )}
      <DashboardPinnedQuickRow
        {...pinnedQuickRowSharedProps}
        renderModals
        jobReportFirst
        afterJobReportRow={myScheduleSection}
        interstitial={
          showFinancials ? (
            <>
              <div id="dash-notifications" aria-hidden="true" style={dockAnchorStyle} />
              <DashboardFinancialsSection />
            </>
          ) : null
        }
      />
      {authUser?.id && teamFeedbackHomeEnabled && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setTeamFeedbackWizardOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #ea580c',
              borderRadius: 8,
              background: 'var(--bg-orange-tint)',
              color: 'var(--text-orange-700)',
              cursor: 'pointer',
            }}
          >
            Quick feedback
          </button>
        </div>
      )}
      {authUser?.id && teamFeedbackWizardOpen && (
        <TeamFeedbackWizard
          open
          onClose={() => setTeamFeedbackWizardOpen(false)}
          userId={authUser.id}
          source="home_button"
          skipIntro
        />
      )}
      <DashboardContractSigningPromptModal
        open={contractSigningPromptOpen}
        rows={contractSigningPromptRows}
        openingDocId={contractSigningPromptOpeningId}
        onClose={() => setContractSigningPromptOpen(false)}
        onOpenSigningPage={openContractSigningPageForDoc}
      />
      {isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <DashboardTeamActiveClockStrip
          sessions={sessionsForStrip}
          hoursTodayByUserId={hoursTodayForStrip}
          clockedInTodayRows={myTeam.clockedInTodayStripRows}
          jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
          jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
          jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
          jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
          showScopeToggle={showClockStripScopeToggle}
          clockStripScope={clockStripScope}
          onClockStripScopeChange={setClockStripScopePersist}
          showJobBidColumn={showClockStripScopeToggle}
          onJobBidSaved={(patch) => {
            myTeam.applyOptimisticClockSessionAssign(patch)
            void myTeam.loadPending({ silent: true })
          }}
          onJobBidAssignError={(msg) => showToast(msg, 'error')}
          onApplyScheduleProportionsForSession={applySchedule.requestApply}
          onOpenStripMyTimeEditor={
            showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined
          }
          authUserId={authUser.id}
          canApproveClockSessions={showClockStripScopeToggle}
          onClockSessionsMutated={() => {
            void myTeam.loadPending({ silent: true })
          }}
          onMaterializeSalarySession={
            showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
          }
          enableCopyDayJobMix={showClockStripScopeToggle}
          enableScheduleDayEmail={showClockStripScopeToggle}
          clockStripWorkDateYmd={myTeam.clockStripWorkDateYmd}
          enableCurrentlyInDispatchIcon={
            role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'superintendent'
          }
        />
      )}
      {isAssistantLike(role) && authUser?.id && (
        <DashboardMyTeamPendingBanner
          pendingApprovalCount={myTeam.pendingApprovalCount}
          loadingSessions={myTeam.loadingSessions}
          onGoToPendingSessions={goToPendingSessionsInMyTeam}
        />
      )}
      {isAssistantLike(role) && (
        <>
          {myInboxCard}
          {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && (
            <DashboardTeamsInboxCard
              dispatchInbox={dispatchInbox}
              estimatorInbox={estimatorInbox}
              showHelpFeedback={false}
              onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
              onLinkJobPictures={
                jobFormModal
                  ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
                  : undefined
              }
              onCreateTripCharge={(args) => setTripChargeTarget(args)}
            />
          )}
        </>
      )}
      {!isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {!isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <DashboardTeamActiveClockStrip
          sessions={sessionsForStrip}
          hoursTodayByUserId={hoursTodayForStrip}
          clockedInTodayRows={myTeam.clockedInTodayStripRows}
          jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
          jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
          jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
          jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
          showScopeToggle={showClockStripScopeToggle}
          clockStripScope={clockStripScope}
          onClockStripScopeChange={setClockStripScopePersist}
          showJobBidColumn={showClockStripScopeToggle}
          onJobBidSaved={(patch) => {
            myTeam.applyOptimisticClockSessionAssign(patch)
            void myTeam.loadPending({ silent: true })
          }}
          onJobBidAssignError={(msg) => showToast(msg, 'error')}
          onApplyScheduleProportionsForSession={applySchedule.requestApply}
          onOpenStripMyTimeEditor={
            showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined
          }
          authUserId={authUser.id}
          canApproveClockSessions={showClockStripScopeToggle}
          onClockSessionsMutated={() => {
            void myTeam.loadPending({ silent: true })
          }}
          onMaterializeSalarySession={
            showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
          }
          enableCopyDayJobMix={showClockStripScopeToggle}
          enableScheduleDayEmail={showClockStripScopeToggle}
          clockStripWorkDateYmd={myTeam.clockStripWorkDateYmd}
          enableCurrentlyInDispatchIcon={
            role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'superintendent'
          }
        />
      )}
      {(role === 'dev' || role === 'master_technician') && authUser?.id && (
        <DashboardMyTeamPendingBanner
          pendingApprovalCount={myTeam.pendingApprovalCount}
          loadingSessions={myTeam.loadingSessions}
          onGoToPendingSessions={goToPendingSessionsInMyTeam}
        />
      )}
      {stripMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={stripMyTimeEditor.dateStr}
          sessions={[]}
          subjectUserId={stripMyTimeEditor.subjectUserId}
          subjectDisplayName={stripMyTimeEditor.displayName}
          showSalariedLabelUnderVisualStrip={stripMyTimeEditor.showSalariedStripFooter}
          prefetchSalarySessionsWhenEmpty
          clockTimesReadOnly={stripMyTimeEditor.clockTimesReadOnly}
          jobLabels={{}}
          bidLabels={{}}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor
              ? () =>
                  handleStripMarkNotComingIn({
                    subjectUserId: stripMyTimeEditor.subjectUserId,
                    displayName: stripMyTimeEditor.displayName,
                    workDateYmd: stripMyTimeEditor.dateStr,
                  })
              : undefined
          }
          onClose={() => setStripMyTimeEditor(null)}
          onSaved={() => {
            void myTeam.loadPending({ silent: true })
            setStripMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void myTeam.loadPending({ silent: true })}
        />
      )}
      {isDev && authUser?.id && <DashboardDevRejectedNotification />}
      {authUser?.id && dispatchInboxEligible && (
        <DispatchDismissedItemsModal
          open={dispatchDismissedModalOpen}
          onClose={() => setDispatchDismissedModalOpen(false)}
          loadRows={fetchDismissedDispatchInboxRows}
        />
      )}
      {tripChargeTarget && (
        <CreateTripChargeModal
          target={tripChargeTarget}
          onClose={() => setTripChargeTarget(null)}
          onCreated={() => {
            setTripChargeTarget(null)
            void refreshInvoicesRef.current()
          }}
        />
      )}
      {(role === 'dev' || role === 'master_technician') && myInboxCard}
      {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && !isAssistantLike(role) && (
        <DashboardTeamsInboxCard
          dispatchInbox={dispatchInbox}
          estimatorInbox={estimatorInbox}
          showHelpFeedback={isDev}
          onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
          onLinkJobPictures={
            jobFormModal
              ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
              : undefined
          }
          onCreateTripCharge={
            role === 'dev' || role === 'master_technician'
              ? (args) => setTripChargeTarget(args)
              : undefined
          }
        />
      )}

      {!isAssistantLike(role) && role !== 'dev' && role !== 'master_technician' && myInboxCard}
      <DashboardMyBidsSection
        authUserId={authUser?.id}
        role={role}
        isMobile={isMobile}
        onContentVisibleChange={setMyBidsDockHasContent}
      />
      <DashboardRecentReportsSection
        authUserId={authUser?.id}
        role={role}
        submitLinkJobPicturesDispatchRequest={submitLinkJobPicturesDispatchRequest}
      />
      {userError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{userError}</p>}

      <DashboardTeamReadyToBillSection
        role={role}
        isMobile={isMobile}
        narrowViewport660={narrowViewport660}
        assignedReadyToBillJobs={assignedReadyToBillJobs}
        assignedReadyToBillLoading={assignedReadyToBillLoading}
        refreshAssignedReadyToBill={refreshAssignedReadyToBill}
        leaveReportReminderForJobRow={leaveReportReminderForJobRow}
        openJobDetailFromDashboardJobRow={openJobDetailFromDashboardJobRow}
        setViewReportsJob={setViewReportsJob}
        setLeaveReportJob={setLeaveReportJob}
        setSubcontractorJobActivityModalJob={setSubcontractorJobActivityModalJob}
      />


      {(assignedJobsLoading || assignedJobs.length > 0) && (
        <DashboardAssignedJobsSection
          role={role}
          isMobile={isMobile}
          assignedJobs={assignedJobs}
          assignedJobsLoading={assignedJobsLoading}
          assignedJobsSearch={assignedJobsSearch}
          setAssignedJobsSearch={setAssignedJobsSearch}
          filteredAssignedJobs={filteredAssignedJobs}
          openJobDetailFromDashboardJobRow={openJobDetailFromDashboardJobRow}
          setViewReportsJob={setViewReportsJob}
          setSubcontractorJobActivityModalJob={setSubcontractorJobActivityModalJob}
          leaveReportReminderForJobRow={leaveReportReminderForJobRow}
          setLeaveReportJob={setLeaveReportJob}
          setReadyForBillingJob={setReadyForBillingJob}
          setReadyForBillingChecked1={setReadyForBillingChecked1}
          setReadyForBillingChecked2={setReadyForBillingChecked2}
          jobStatusUpdatingId={jobStatusUpdatingId}
          formatDatetime={formatDatetime}
        />
      )}

      {(isAssistantLike(role) || role === 'dev' || role === 'master_technician') && (
        <>
          <div id="dash-billing" aria-hidden="true" style={dockAnchorStyle} />
          <DashboardBillingPipelineSection {...billingPipelineSectionProps} />
        </>
      )}

      <DashboardUpcomingInspectionsSection
        authUserId={authUser?.id}
        role={role}
        inspectionsButtonVisible={dashboardButtonVisibility?.inspections !== false}
      />

      <DashboardSuperintendentJobsSection
        role={role}
        superintendentJobs={superintendentJobs}
        superintendentJobsLoading={superintendentJobsLoading}
        superintendentJobsExpanded={superintendentJobsExpanded}
        setSuperintendentJobsExpanded={setSuperintendentJobsExpanded}
        assignedJobs={assignedJobs}
        openJobDetailFromDashboardJobRow={openJobDetailFromDashboardJobRow}
        setViewReportsJob={setViewReportsJob}
        isMobile={isMobile}
        setReadyForBillingJob={setReadyForBillingJob}
        setReadyForBillingChecked1={setReadyForBillingChecked1}
        setReadyForBillingChecked2={setReadyForBillingChecked2}
        jobStatusUpdatingId={jobStatusUpdatingId}
      />
      {projectsCardVisible && (
        <DashboardProjectsCard
          assignedSteps={assignedSteps}
          subscribedSteps={subscribedSteps}
          assignedLoading={assignedLoading}
          subscribedLoading={subscribedLoading}
          userLoading={userLoading}
          showAssigned={showAssigned}
          showSubscribed={showSubscribed}
          userNames={userNames}
          role={role}
          getCurrentUserName={getCurrentUserName}
          loadAssignedSteps={loadAssignedSteps}
        />
      )}

      {authUser?.id && (
        <Suspense fallback={<MyTeamSectionSkeleton />}>
          <DashboardMyTeamSection
            myTeam={myTeam}
            showPendingBannerAtTop={pendingClockBannerAtMyTeamTop}
            onGoToPendingSessions={goToPendingSessionsInMyTeam}
          />
        </Suspense>
      )}

      {authUser?.id && <div id="dash-me" aria-hidden="true" style={dockAnchorStyle} />}
      {authUser?.id && (
        <DashboardMyTimeSection
          userId={authUser.id}
          hoursDaysCorrect={hoursDaysCorrectSet}
          disableDayEditor={dashboardSelfIsSalary}
        />
      )}

      <ApplyScheduleApprovedConfirmModal {...applySchedule.approvedConfirm} />

      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
          userRole={role}
          onReportSaved={() => void refreshDashboardAssignedJobLists()}
        />
      )}
      {subcontractorJobActivityModalJob ? (
        <SubcontractorJobActivityModal
          open
          onClose={() => setSubcontractorJobActivityModalJob(null)}
          jobId={subcontractorJobActivityModalJob.id}
          hcpNumber={subcontractorJobActivityModalJob.hcpNumber}
          jobName={subcontractorJobActivityModalJob.jobName}
        />
      ) : null}
      {leaveReportJob && (
        <AdditionalReportModal
          open={!!leaveReportJob}
          onClose={() => setLeaveReportJob(null)}
          onSaved={() => {
            setLeaveReportJob(null)
            void refreshDashboardAssignedJobLists()
          }}
          onReportSaved={() => void refreshDashboardAssignedJobLists()}
          authUserId={authUser?.id ?? null}
          userRole={role}
          jobId={leaveReportJob.id}
          hcpNumber={leaveReportJob.hcpNumber}
          jobName={leaveReportJob.jobName}
          jobAddress={leaveReportJob.jobAddress}
        />
      )}
      {readyForBillingJob && (
        <div style={DASHBOARD_MODAL_OVERLAY_STYLE}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send to<br />Billing</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked1}
                  onChange={(e) => setReadyForBillingChecked1(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked2}
                  onChange={(e) => setReadyForBillingChecked2(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || jobStatusUpdatingId === readyForBillingJob.id}
                onClick={async () => {
                  if (!readyForBillingJob) return
                  const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id)
                  if (!ok) return
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {jobStatusUpdatingId === readyForBillingJob.id ? '…' : 'Send for billing'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendRecordJobMeta && (
        <div style={DASHBOARD_MODAL_OVERLAY_STYLE}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8 }}>Loading job…</div>
        </div>
      )}
    </div>
  )
}
