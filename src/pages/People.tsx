import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { type TeamSummaryInlineHandle } from '../components/people/teamSummary/TeamSummaryInline'
import type { TeamSummaryRow } from '../components/people/teamSummary/types'
import { WriteupsContractsSubTab } from '../components/writeups/WriteupsContractsSubTab'
import PeopleVehiclesTab from '../components/people/PeopleVehiclesTab'
import PeopleHousingTab from '../components/people/PeopleHousingTab'
import PeopleLicensesTab from '../components/people/PeopleLicensesTab'
import PeopleOffsetsTab from '../components/people/PeopleOffsetsTab'
import PeopleContractsTab from '../components/people/PeopleContractsTab'
import PeopleOverheadTab from '../components/people/PeopleOverheadTab'
import PeopleReviewTab from '../components/people/PeopleReviewTab'
import PeoplePayStubsTab, { type PayStubRow } from '../components/people/PeoplePayStubsTab'
import { PeopleUsersTab } from '../components/people/PeopleUsersTab'
import {
  buildUsersTabKindRoster,
  KIND_LABELS,
  KIND_TO_USER_ROLE,
  KINDS,
} from '../components/people/peopleUsersTabShared'
import { PeopleHoursSharing } from '../components/people/PeopleHoursSharing'
import { PeopleHoursTeams, type PeopleHoursTeam } from '../components/people/PeopleHoursTeams'
import { PeopleHoursDueSummaries } from '../components/people/PeopleHoursDueSummaries'
import { PeopleCostMatrix } from '../components/people/PeopleCostMatrix'
import { PeopleHoursSessions } from '../components/people/PeopleHoursSessions'
import { PeopleHoursWeekRange } from '../components/people/PeopleHoursWeekRange'
import { PeopleHoursGridJobHighlight, type HoursGridJobHighlightPick } from '../components/people/PeopleHoursGridJobHighlight'
import { PeopleHoursPendingBanner } from '../components/people/PeopleHoursPendingBanner'
import {
  getDaysInRange,
  HOURS_TAB_SECTION_ANCHOR_STYLE,
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
} from '../components/people/peopleHoursTabShared'
import { useSearchParams } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { HOURS_GRID_FIRST_COL_LABEL } from '../constants/hoursGridFirstCol'
import { formatCurrency } from '../lib/format'
import { decimalToHms, hmsToDecimal } from '../lib/people/hoursGridTime'
import { shouldOfferManualHoursSession } from '../lib/people/shouldOfferManualHoursSession'
import { buildPayStubHtml, openPayStubWindow } from '../lib/peopleDocuments/buildPayStubHtml'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { usePeopleAccess } from '../hooks/usePeopleAccess'
import { useCrewJobMap } from '../hooks/useCrewJobMap'
import { usePayConfig } from '../hooks/usePayConfig'
import { usePeopleHoursData, type PeopleHoursRealtimeCallbacks } from '../hooks/usePeopleHoursData'
import {
  usePeopleRoster,
  type Person,
  type UserRow,
  type PersonKind,
  type UsePeopleRosterDeps,
} from '../hooks/usePeopleRoster'
import { useUsersTabTags } from '../hooks/useUsersTabTags'
import {
  isPayStubFullyPaid,
  PAY_STUB_PAY_FULLY_TOLERANCE,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../lib/payStubPayments'
import { type PersonOffsetInitialDraft, PersonOffsetFormModal } from '../components/pay/PersonOffsetFormModal'
import { DraftPayrollModal } from '../components/pay/DraftPayrollModal'
import { PayrollForecastModal, type PayrollForecastUnpaidRow } from '../components/pay/PayrollForecastModal'
import { DraftPayrollPersonHoursBreakdownModal } from '../components/pay/DraftPayrollPersonHoursBreakdownModal'
import {
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
  stubNetPay,
  sumPayStubAdditionalAmounts,
  sumPayStubDeductionAmounts,
} from '../lib/payStubDeductions'
import { computePayReportAssignmentsBreakdown } from '../lib/payReportAssignmentsBreakdown'
import { findPersonUserDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import {
  type ContractSigningTrafficLight,
  rollupContractSigningStatusByPersonName,
} from '../lib/contractSigningRollup'
import { useAuth } from '../hooks/useAuth'
import { useDocumentVisibility } from '../hooks/useDocumentVisibility'
import { useHoursGridFirstColWidthPx } from '../hooks/useHoursGridFirstColWidthPx'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useToastContext } from '../contexts/ToastContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { HoursUnassignedModal } from '../components/HoursUnassignedModal'
import { PeopleHoursDayAuditModal } from '../components/PeopleHoursDayAuditModal'
import { PeopleHoursDashboardClockStrip } from '../components/people/PeopleHoursDashboardClockStrip'
import { ClockSessionEditSplitModal } from '../components/ClockSessionEditSplitModal'
import { DashboardMyTimeDayEditorModal } from '../components/DashboardMyTimeDayEditorModal'
import { PersonTimeDetailModal } from '../components/PersonTimeDetailModal'
import { ReviewHoursModal } from '../components/ReviewHoursModal'
import PeopleAppActivityPanel from '../components/people/PeopleAppActivityPanel'
import PeopleTeamsTab from '../components/people/PeopleTeamsTab'
import TeamFeedbackDevSettingsBlock from '../components/team-feedback/TeamFeedbackDevSettingsBlock'
import { PeoplePayConfigModal } from '../components/people/PeoplePayConfigModal'
import { SalariedWorkdaysBulkModal } from '../components/people/SalariedWorkdaysBulkModal'
import { buildPeopleHoursManualDraftSession, isDraftPeopleHoursSessionId } from '../lib/peopleHoursManualDraftSession'
import {
  buildJobBidLabelMapsFromClockRows,
  collectPeopleHoursDaySessionsForScale,
  scaleClosedSessionsToTargetHours,
  toDayEditorSession,
} from '../lib/peopleHoursProportionalScale'
import {
  buildPeopleHoursPendingByCellMap,
  pendingByCellKey,
  pendingUnapprovedCountsByWorkDate,
  personPendingExcessHours,
  summarizePeopleHoursPendingByCell,
  sumClosedPendingClockHoursForCell,
  workDateHasAnyPendingExcess,
  type PeopleHoursPendingCellEntry,
} from '../lib/peopleHoursPendingByCell'
import { PeopleHoursPendingCellPopover } from '../components/people/PeopleHoursPendingCellPopover'
import { PeopleHoursBulkApprovePendingModal } from '../components/people/PeopleHoursBulkApprovePendingModal'
import type { DayEditorSession } from '../lib/myTimeDayTimeline'
import type { ClockSessionRow } from '../types/clockSessions'

function todayYyyyMmDdLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

function paidAtIsoFromYyyyMmDd(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toISOString()
}

/** Pay History overlays: base layer; nested dialogs (e.g. Record payment from Draft Payroll) must be higher. */
const Z_PEOPLE_PAY_MODAL = 1100
const Z_PEOPLE_PAY_MODAL_NESTED = 1200
/** Above Record payment / nested pay dialogs when opening PersonOffsetFormModal from Pay History. */
const Z_PEOPLE_OFFSET_FORM = 1210
/** Above Draft Payroll when opening per-person hours / job breakdown. */
const Z_PEOPLE_DRAFT_PAYROLL_HOURS_BREAKDOWN = 1215

/** People → Hours tab: collapsible section keys + DOM ids for in-page navigation. */
type HoursTabSectionId =
  | 'week'
  | 'clockStrip'
  | 'sessions'
  | 'grid'
  | 'payTools'
  | 'dueSummaries'
  | 'costMatrix'
  | 'teams'
  | 'sharing'

/** Sections with chevron open/close state (`payTools` toolbar and `week` range are always visible). */
type HoursTabCollapsibleSectionId = Exclude<HoursTabSectionId, 'payTools' | 'week'>

const HOURS_TAB_SECTION_SCROLL_ID: Record<HoursTabSectionId, string> = {
  week: 'people-hours-week',
  clockStrip: 'people-hours-clock-strip',
  sessions: 'people-hours-sessions',
  grid: 'people-hours-grid',
  payTools: 'people-hours-pay-tools',
  dueSummaries: 'people-hours-due-summaries',
  costMatrix: 'cost-matrix',
  teams: 'people-hours-teams',
  sharing: 'people-hours-sharing',
}

const INITIAL_HOURS_TAB_SECTIONS_OPEN: Record<HoursTabCollapsibleSectionId, boolean> = {
  clockStrip: true,
  sessions: true,
  grid: true,
  dueSummaries: false,
  costMatrix: true,
  teams: false,
  sharing: false,
}

const HOURS_TAB_SECTIONS_STACK_GAP = '0.75rem'

const HOURS_TAB_SECTIONS_STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: HOURS_TAB_SECTIONS_STACK_GAP,
}

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

/** Active project rows for People Users tab “Active projects” line (workflow links use project id). */
type PersonActiveProject = { id: string; name: string }

type PeopleTab =
  | 'review'
  | 'users'
  | 'teams'
  | 'overhead'
  | 'pay_stubs'
  | 'hours'
  | 'offsets'
  | 'vehicles'
  | 'housing'
  | 'licenses'
  | 'contracts'
  | 'writeups'
  | 'feedback'
  | 'activity'

/** Users tab: email/phone on its own row below the name line at ≤640px. */
/** Max UUIDs in Realtime `user_id=in.(...)` for People Hours (avoid oversized filters). */
const PEOPLE_HOURS_CLOCK_REALTIME_MAX_USER_IDS = 150

export default function People() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser, role: authRole } = useAuth()
  const isDocVisible = useDocumentVisibility()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const narrowViewport = useNarrowViewport640()
  const { widthPx: hoursGridFirstColWidthPx, measurer: hoursGridFirstColMeasurer } = useHoursGridFirstColWidthPx()
  const hoursGridFirstColW = hoursGridFirstColWidthPx ?? 200
  const rosterDepsRef = useRef(null as unknown as UsePeopleRosterDeps)
  const {
    users,
    people,
    setPeople,
    archivedPeople,
    setArchivedPeople,
    creatorNames,
    formOpen,
    editing,
    kind,
    setKind,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    notes,
    setNotes,
    saving,
    loadPeople,
    loadArchivedPeople,
    handleSave,
    openAdd,
    openEdit,
    closeForm,
  } = usePeopleRoster(authUser?.id, rosterDepsRef)
  const usersRef = useRef<UserRow[]>([])
  usersRef.current = users
  const peopleHoursClockRealtimeInFilter = useMemo(() => {
    const ids = [...new Set(users.map((u) => u.id).filter(Boolean))].sort()
    if (ids.length === 0 || ids.length > PEOPLE_HOURS_CLOCK_REALTIME_MAX_USER_IDS) return null
    return `user_id=in.(${ids.join(',')})`
  }, [users])
  const peopleRosterRef = useRef<Person[]>([])
  peopleRosterRef.current = people
  const offsetPersonNameOptions = useMemo(
    () =>
      [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])]
        .filter((n): n is string => Boolean(n?.trim()))
        .sort((a, b) => a.localeCompare(b)),
    [people, users],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteConfirm, setInviteConfirm] = useState<Person | null>(null)
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)
  const [personProjects, setPersonProjects] = useState<Record<string, PersonActiveProject[]>>({})
  /** People Users tab: External Subcontractor rows — expanded IDs show Active projects links */
  const [externalSubProjectsExpanded, setExternalSubProjectsExpanded] = useState(() => new Set<string>())
  const [activeTab, setActiveTab] = useState<PeopleTab>('users')

  // Pay/Hours tab state
  const [hoursTabLoading, setHoursTabLoading] = useState(false)
  /** True once the Hours tab load effect has entered its first loading cycle (past the 80ms delay). Used so deep-link scroll runs after content is stable, not during the pre-load gap that is followed by a loading spinner that unmounts the anchor. */
  const hoursTabFirstLoadCycleStartedRef = useRef(false)
  const hoursTableScrollRef = useRef<HTMLDivElement>(null)
  const hoursFocusClearTimeoutRef = useRef<number | null>(null)
  const { canAccessPay, canAccessHours, canAccessLicenses, canAccessContracts, canViewCostMatrixShared, isDev, canSeePushStatus } = usePeopleAccess(authUser?.id)
  const canOpenHoursTab = canAccessPay || canAccessHours || canViewCostMatrixShared
  const usersTabTags = useUsersTabTags({
    isDev,
    activeTab,
    people,
    users,
    authUserId: authUser?.id,
    showToast,
  })
  const [activityAccessResolved, setActivityAccessResolved] = useState(false)
  const [isActivityViewer, setIsActivityViewer] = useState(false)
  const canSeeActivityTab = isDev || isActivityViewer
  const [pushEnabledUserIds, setPushEnabledUserIds] = useState<Set<string>>(new Set())
  const [locationEnabledUserIds, setLocationEnabledUserIds] = useState<Set<string>>(new Set())
  const [contractSigningStatusByPersonName, setContractSigningStatusByPersonName] = useState<
    Record<string, ContractSigningTrafficLight>
  >({})
  /** Live mirror of `payConfigRosterSections` (defined later) so usePayConfig can read it without a render-order dependency. */
  const payConfigRosterSectionsRef = useRef<Array<{ label: string; names: string[] }>>([])
  const {
    payConfig,
    payConfigDraft,
    payConfigSaving,
    salaryTemplateByPersonName,
    loadPayConfig,
    loadPayConfigSalaryTemplateIndicators,
    upsertPayConfig,
    updatePayConfigHourlyWage,
  } = usePayConfig({
    canAccessPay,
    canAccessHours,
    canViewCostMatrixShared,
    setError,
    showToast,
    peopleRosterRef,
    usersRef,
    payConfigRosterSectionsRef,
  })
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  const [payConfigModalOpen, setPayConfigModalOpen] = useState(false)
  const [salariedWorkdaysModalOpen, setSalariedWorkdaysModalOpen] = useState(false)

  useEffect(() => {
    if (activeTab !== 'hours') {
      setPayConfigModalOpen(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'hours') {
      setSalariedWorkdaysModalOpen(false)
    }
  }, [activeTab])
  const [personTimeDetailModalPerson, setPersonTimeDetailModalPerson] = useState<string | null>(null)
  const [reviewHoursModalOpen, setReviewHoursModalOpen] = useState(false)
  const [hoursReviewedSet, setHoursReviewedSet] = useState<Set<string>>(new Set())
  const [costMatrixShareCandidates, setCostMatrixShareCandidates] = useState<Array<{ id: string; name: string; email: string | null; role: string }>>([])
  const [costMatrixSharedUserIds, setCostMatrixSharedUserIds] = useState<Set<string>>(new Set())
  const [costMatrixShareSaving, setCostMatrixShareSaving] = useState(false)
  const [costMatrixShareError, setCostMatrixShareError] = useState<string | null>(null)
  const [archivedUserNames, setArchivedUserNames] = useState<Set<string>>(new Set())
  const [rejectedSectionOpen, setRejectedSectionOpen] = useState(false)
  const [hoursTabSectionsOpen, setHoursTabSectionsOpen] = useState<Record<HoursTabCollapsibleSectionId, boolean>>(
    () => ({ ...INITIAL_HOURS_TAB_SECTIONS_OPEN }),
  )

  const jumpToHoursTabSection = useCallback((id: HoursTabSectionId) => {
    if (id !== 'payTools' && id !== 'week') {
      setHoursTabSectionsOpen((prev) => ({ ...prev, [id]: true }))
    }
    const domId = HOURS_TAB_SECTION_SCROLL_ID[id]
    requestAnimationFrame(() => {
      document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])
  const [selectedJobHighlight, setSelectedJobHighlight] = useState<HoursGridJobHighlightPick | null>(null)
  const [editClockSession, setEditClockSession] = useState<ClockSessionRow | null>(null)
  const [hoursMyTimeEditor, setHoursMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
    dateStr: string
  } | null>(null)
  const [hoursManualDraftEditor, setHoursManualDraftEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
    dateStr: string
    draftSessions: DayEditorSession[]
    personName: string
    jobLabels?: Record<string, string>
    bidLabels?: Record<string, string>
  } | null>(null)
  const [hoursDaysCorrect, setHoursDaysCorrect] = useState<Set<string>>(new Set())
  /** Live mirror of hoursDaysCorrect so usePeopleHoursData.saveHours can guard against locked days. */
  const hoursDaysCorrectRef = useRef(hoursDaysCorrect)
  hoursDaysCorrectRef.current = hoursDaysCorrect
  const [teams, setTeams] = useState<PeopleHoursTeam[]>([])
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [teamPeriodStart, setTeamPeriodStart] = useState(() => {
    const d = new Date()
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return start.toLocaleDateString('en-CA')
  })
  const [teamPeriodEnd, setTeamPeriodEnd] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [showMaxHours, setShowMaxHours] = useState(false)
  const [costMatrixTags, setCostMatrixTags] = useState<Record<string, string>>({})
  const [costMatrixTagColors, setCostMatrixTagColors] = useState<Record<string, string>>({})
  const [matrixSortBy, setMatrixSortBy] = useState<'cost' | 'tag' | 'name'>('cost')
  const [showMaxHoursTeams, setShowMaxHoursTeams] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<{ id: string; name: string } | null>(null)
  const [teamDeletingId, setTeamDeletingId] = useState<string | null>(null)
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  // Pay History tab state
  type PayStubsLoadSnapshot = {
    stubs: PayStubRow[]
    paymentsByStubId: Record<string, PayStubPaymentRow[]>
    deductionsByStubId: Record<string, PayStubDeductionRow[]>
    additionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  }
  const [payStubs, setPayStubs] = useState<PayStubRow[]>([])
  const [payStubPaymentsByStubId, setPayStubPaymentsByStubId] = useState<Record<string, PayStubPaymentRow[]>>({})
  const [payStubDeductionsByStubId, setPayStubDeductionsByStubId] = useState<Record<string, PayStubDeductionRow[]>>({})
  const [payStubAdditionalByStubId, setPayStubAdditionalByStubId] = useState<Record<string, PayStubAdditionalLineRow[]>>({})
  const [payStubPeriodStart, setPayStubPeriodStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  const [payStubPeriodEnd, setPayStubPeriodEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
  const [deletingPayStubId, setDeletingPayStubId] = useState<string | null>(null)
  const [markingPayStubId, setMarkingPayStubId] = useState<string | null>(null)
  const [generatingPayStubPerson, setGeneratingPayStubPerson] = useState<string | null>(null)
  const [bulkGeneratingPayStubs, setBulkGeneratingPayStubs] = useState(false)
  const [draftPayrollModalOpen, setDraftPayrollModalOpen] = useState(false)
  const [forecastModalOpen, setForecastModalOpen] = useState(false)
  const [draftPayrollHoursBreakdownPerson, setDraftPayrollHoursBreakdownPerson] = useState<string | null>(null)
  const [draftPayrollPendingApprovalCount, setDraftPayrollPendingApprovalCount] = useState<number | null>(null)
  const [draftPayrollPendingApprovalLoading, setDraftPayrollPendingApprovalLoading] = useState(false)
  const [draftPayrollPendingApprovalError, setDraftPayrollPendingApprovalError] = useState<string | null>(null)
  const draftPayrollRealtimeSnapRef = useRef({
    draftOpen: false,
    activeTab: '' as string,
    canAccessPay: false,
    periodStart: '',
    periodEnd: '',
  })
  const [hoursFocusRequest, setHoursFocusRequest] = useState<{ workDate: string; personName: string } | null>(null)
  const [hoursFlashWorkDate, setHoursFlashWorkDate] = useState<string | null>(null)
  const [hoursFlashPersonName, setHoursFlashPersonName] = useState<string | null>(null)
  const [payStubDeleteConfirm, setPayStubDeleteConfirm] = useState<PayStubRow | null>(null)
  const [payStubMarkPaidTarget, setPayStubMarkPaidTarget] = useState<PayStubRow | null>(null)
  const [payStubMarkPaidDate, setPayStubMarkPaidDate] = useState('')
  const [payStubMarkPaidAmount, setPayStubMarkPaidAmount] = useState('')
  const [payStubMarkPaidNote, setPayStubMarkPaidNote] = useState('')
  /** After Add offset save from Record payment employee-credit path: reload stub row and reset amount to remaining. */
  const recordPaymentRefreshAfterEmployeeCreditRef = useRef(false)
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
  /** Stable fan-out behaviors for the hours/clock Realtime subscription; assigned below once the refresh refs exist. */
  const realtimeCallbacksRef = useRef<PeopleHoursRealtimeCallbacks>({
    onPeopleHoursChange: () => {},
    onClockSessionsChange: () => {},
  })
  const {
    peopleHours,
    pendingClockSessions,
    approvedClockSessions,
    rejectedClockSessions,
    activeClockSessions,
    pendingApprovalClockSessions,
    activeClockSessionsFiltered,
    pendingApprovalClockSessionsFiltered,
    approvedClockSessionsFiltered,
    rejectedClockSessionsFiltered,
    hoursClockSessionsSearch,
    setHoursClockSessionsSearch,
    hoursClockSessionsSearching,
    noClockSessionsMatchSearch,
    loadPeopleHours,
    loadPendingClockSessions,
    loadApprovedClockSessions,
    loadRejectedClockSessions,
    loadAllClockSessions,
    saveHours,
  } = usePeopleHoursData({
    canAccessHours,
    canAccessPay,
    canViewCostMatrixShared,
    prefixMap,
    peopleRosterRef,
    authUser,
    hoursDaysCorrectRef,
    setError,
    activeTab,
    hoursDateStart,
    hoursDateEnd,
    isDocVisible,
    peopleHoursClockRealtimeInFilter,
    realtimeCallbacksRef,
  })
  const {
    crewJobsByDatePerson,
    loadCrewJobsForHoursRange,
    mergeCrewJobsForDateRange,
    loadCrewJobsRef,
    draftPayrollCrewMergeFetchIdRef,
  } = useCrewJobMap(hoursDateStart, hoursDateEnd)
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')
  /** People → Hours: anchor + entry for the inline pending sessions popover. */
  const [pendingCellPopover, setPendingCellPopover] = useState<{
    anchorEl: HTMLElement
    entry: PeopleHoursPendingCellEntry
  } | null>(null)
  const [bulkApprovePendingOpen, setBulkApprovePendingOpen] = useState(false)
  const [editingUserNote, setEditingUserNote] = useState<{ id: string; name: string; notes: string; phone: string } | null>(null)
  const [userNoteSaving, setUserNoteSaving] = useState(false)
  const [authUserRole, setAuthUserRole] = useState<string | null>(null)
  // Page-owned dependencies the roster loaders/handlers reach into. Assigned
  // here (after the values they reference are declared) and read lazily by
  // usePeopleRoster via the ref, so the hook can be called at the top of the
  // component while still observing the latest values when a handler runs.
  rosterDepsRef.current = {
    setLoading,
    setError,
    setAuthUserRole,
    loadPersonProjects,
    isDev,
    authUserRole,
  }
  const canAccessTeamsTab =
    authRole !== null && ['dev', 'master_technician', 'assistant'].includes(authRole)
  const canAccessOverheadTab =
    authRole !== null && ['dev', 'master_technician'].includes(authRole)
  const canDeletePeopleContracts =
    authRole !== null && ['dev', 'master_technician'].includes(authRole)

  // Hours tab state (unassigned hours modal, crew jobs by date)
  type CrewJobAssignment = { job_id: string; pct: number }
  type CrewJobRow = { job_assignments: CrewJobAssignment[] }
  type CrewBidAssignment = { bid_id: string; pct: number }
  type CrewBidRow = { bid_assignments: CrewBidAssignment[] }
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)
  const [hoursDayAuditModal, setHoursDayAuditModal] = useState<{ personName: string; workDate: string } | null>(null)

  // Offset form state — only the Record-payment "employee credit" entry point lives here.
  // The Offsets tab UI (list, search, apply-to-stub, add/edit) is in PeopleOffsetsTab.
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [offsetFormInitialCreateDraft, setOffsetFormInitialCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [, setOffsetFormError] = useState<string | null>(null)

  // Drilldown modal awareness: while a drilldown modal is open we defer
  // any data-driven refresh so the user's current investigation isn't
  // wiped out (the React table would re-sort and the open modal's body
  // would re-derive on the new rows mid-read). When the modal closes
  // we drain any pending refresh by bumping `teamSummaryDrainTick`.
  const teamSummaryModalOpenRef = useRef(false)
  const teamSummaryRefreshPendingRef = useRef(false)
  const [teamSummaryDrainTick, setTeamSummaryDrainTick] = useState(0)
  // Review → Hours-breakdown → click day-header bridge. The TeamSummaryInline
  // component calls `onOpenDayEditor(personName, workDate)`; we mount
  // DashboardMyTimeDayEditorModal via the shared `hoursMyTimeEditor` state.
  // After save we refresh the Team Summary AND re-open the Hours drilldown
  // for that person so updated numbers show immediately:
  //   1. `reviewHoursDayEditorPersonRef` remembers which person triggered the
  //      editor; set on open, read in onSaved, cleared on close.
  //   2. On save we bust `teamSummaryDataCacheRef`, flip `teamSummaryModalOpenRef`
  //      off (so the deferred-refresh guard doesn't skip), bump
  //      `teamSummaryDrainTick`, and stash personName in
  //      `reviewHoursReopenAfterLoadRef`.
  //   3. After the new rows render we call `teamSummaryInlineRef.openDrilldown`
  //      directly — no postMessage round-trip the iframe needed.
  const teamSummaryInlineRef = useRef<TeamSummaryInlineHandle | null>(null)
  const reviewHoursDayEditorPersonRef = useRef<string | null>(null)
  const reviewHoursReopenAfterLoadRef = useRef<string | null>(null)
  // v2.542 — cache the rows the inline iframe just rendered so the popup
  // ("Open in new window") doesn't re-issue `loadTeamSummaryData()` against
  // Supabase for the exact same period. The auto-refresh effect clears this
  // when any dep changes; `loadTeamSummaryData().then(...)` re-populates it
  // with the cache key snapshotted at fetch time.
  const teamSummaryDataCacheRef = useRef<{
    rows: TeamSummaryRow[]
    cacheKey: string
  } | null>(null)
  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => {
    if (
      activeTab === 'hours' &&
      (canAccessHours || canAccessPay || canViewCostMatrixShared)
    ) {
      loadPeopleHours(hoursDateStart, hoursDateEnd)
    }
  }

  async function loadPersonProjects() {
    // Get all steps with assigned people
    const { data: steps, error: stepsErr } = await supabase
      .from('project_workflow_steps')
      .select('workflow_id, assigned_to_name')
      .not('assigned_to_name', 'is', null)
    if (stepsErr) {
      console.error('Error loading steps:', stepsErr)
      return
    }
    if (!steps || steps.length === 0) {
      setPersonProjects({})
      return
    }
    
    // Get unique workflow IDs
    const workflowIds = [...new Set((steps as Array<{ workflow_id: string }>).map((s) => s.workflow_id))]
    
    // Get workflows with project_id
    const { data: workflows, error: workflowsErr } = await supabase
      .from('project_workflows')
      .select('id, project_id')
      .in('id', workflowIds)
    if (workflowsErr) {
      console.error('Error loading workflows:', workflowsErr)
      return
    }
    
    // Get unique project IDs
    const projectIds = [...new Set((workflows as Array<{ project_id: string }>).map((w) => w.project_id))]
    
    // Get active projects
    const { data: projects, error: projectsErr } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
      .eq('status', 'active')
    if (projectsErr) {
      console.error('Error loading projects:', projectsErr)
      return
    }
    
    // Build map: workflow_id -> { project id, name }
    const workflowToProject = new Map<string, PersonActiveProject>()
    if (workflows && projects) {
      for (const wf of workflows as Array<{ id: string; project_id: string }>) {
        const proj = (projects as Array<{ id: string; name: string }>).find((p) => p.id === wf.project_id)
        if (proj) workflowToProject.set(wf.id, { id: proj.id, name: proj.name })
      }
    }

    // Group by person name (dedupe by project id)
    const projectsByPerson: Record<string, PersonActiveProject[]> = {}
    if (steps) {
      for (const step of steps as Array<{ workflow_id: string; assigned_to_name: string }>) {
        const personName = step.assigned_to_name?.trim()
        if (!personName) continue
        const entry = workflowToProject.get(step.workflow_id)
        if (!entry) continue
        if (!projectsByPerson[personName]) projectsByPerson[personName] = []
        if (!projectsByPerson[personName].some((p) => p.id === entry.id)) {
          projectsByPerson[personName].push(entry)
        }
      }
    }
    for (const k of Object.keys(projectsByPerson)) {
      const list = projectsByPerson[k]
      if (list) list.sort((a, b) => a.name.localeCompare(b.name))
    }
    setPersonProjects(projectsByPerson)
  }

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'team_costs') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'hours')
        return next
      }, { replace: true })
      setActiveTab('hours')
    } else if (tab === 'pay') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'hours')
        return next
      }, { replace: true })
      setActiveTab('hours')
    } else if (
      tab === 'users' ||
      tab === 'teams' ||
      tab === 'overhead' ||
      tab === 'pay_stubs' ||
      tab === 'hours' ||
      tab === 'vehicles' ||
      tab === 'housing' ||
      tab === 'offsets' ||
      tab === 'licenses' ||
      tab === 'contracts' ||
      tab === 'writeups' ||
      tab === 'review' ||
      tab === 'feedback' ||
      tab === 'activity'
    ) {
      if (tab === 'teams' && !canAccessTeamsTab) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'users')
          return next
        }, { replace: true })
        setActiveTab('users')
        return
      }
      if (tab === 'overhead' && !canAccessOverheadTab) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'users')
          return next
        }, { replace: true })
        setActiveTab('users')
        return
      }
      if (tab === 'activity' && activityAccessResolved && !canSeeActivityTab) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'users')
          return next
        }, { replace: true })
        setActiveTab('users')
        return
      }
      if (tab === 'writeups' && !canAccessContracts) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'users')
          return next
        }, { replace: true })
        setActiveTab('users')
        return
      }
      setActiveTab(tab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'users')
        return next
      }, { replace: true })
    }
  }, [searchParams, activityAccessResolved, canSeeActivityTab, canAccessContracts, canAccessTeamsTab, canAccessOverheadTab, setSearchParams])

  useEffect(() => {
    if (searchParams.get('tab') !== 'contracts') return
    if (searchParams.get('contracts_sub') !== 'writeups') return
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'writeups')
      next.delete('contracts_sub')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (activeTab !== 'hours') return
    const syncCostMatrixHash = () => {
      if (window.location.hash !== '#cost-matrix') return
      setHoursTabSectionsOpen((prev) => ({ ...prev, costMatrix: true }))
      requestAnimationFrame(() => {
        document.getElementById('cost-matrix')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    syncCostMatrixHash()
    window.addEventListener('hashchange', syncCostMatrixHash)
    return () => window.removeEventListener('hashchange', syncCostMatrixHash)
  }, [activeTab])

  useEffect(() => {
    const section = searchParams.get('section')
    if (section !== 'rejected' || !canAccessHours) return
    const tab = searchParams.get('tab')
    if (tab !== 'hours') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'hours')
        return next
      }, { replace: true })
    }
  }, [searchParams, canAccessHours, setSearchParams])

  useLayoutEffect(() => {
    const section = searchParams.get('section')
    if (section !== 'rejected' || activeTab !== 'hours' || !canAccessHours) return
    if (hoursTabLoading) return
    if (!hoursTabFirstLoadCycleStartedRef.current) return
    setHoursTabSectionsOpen((prev) => ({ ...prev, sessions: true }))
    setRejectedSectionOpen(true)
    const el = document.getElementById('people-hours-rejected')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('section')
      return next
    }, { replace: true })
  }, [searchParams, activeTab, canAccessHours, hoursTabLoading, setSearchParams])

  useEffect(() => {
    if (activeTab === 'hours') return
    if (hoursFocusClearTimeoutRef.current !== null) {
      window.clearTimeout(hoursFocusClearTimeoutRef.current)
      hoursFocusClearTimeoutRef.current = null
    }
    setHoursFocusRequest(null)
    setHoursFlashWorkDate(null)
    setHoursFlashPersonName(null)
  }, [activeTab])

  useLayoutEffect(() => {
    if (activeTab !== 'hours' || !canAccessHours || hoursTabLoading || !hoursFocusRequest) return
    const wd = hoursFocusRequest.workDate
    if (!getDaysInRange(hoursDateStart, hoursDateEnd).includes(wd)) return

    setHoursFlashWorkDate(wd)
    setHoursFlashPersonName(hoursFocusRequest.personName)

    const pn = hoursFocusRequest.personName
    const scroll = () => {
      const el = document.getElementById(`people-hours-col-${wd}`)
      const wrap = hoursTableScrollRef.current
      if (el && wrap) {
        const center =
          el.offsetLeft - wrap.clientWidth / 2 + el.offsetWidth / 2
        wrap.scrollTo({ left: Math.max(0, center), behavior: 'smooth' })
      }
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      const row = document.querySelector(`[data-hours-person="${CSS.escape(pn)}"]`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(scroll)
    })

    if (hoursFocusClearTimeoutRef.current !== null) {
      window.clearTimeout(hoursFocusClearTimeoutRef.current)
    }
    hoursFocusClearTimeoutRef.current = window.setTimeout(() => {
      setHoursFlashWorkDate(null)
      setHoursFlashPersonName(null)
      setHoursFocusRequest(null)
      hoursFocusClearTimeoutRef.current = null
    }, 2500)

    return () => {
      if (hoursFocusClearTimeoutRef.current !== null) {
        window.clearTimeout(hoursFocusClearTimeoutRef.current)
        hoursFocusClearTimeoutRef.current = null
      }
    }
  }, [activeTab, canAccessHours, hoursTabLoading, hoursFocusRequest, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    if (!authUser?.id) {
      setActivityAccessResolved(false)
      setIsActivityViewer(false)
      return
    }
    let cancelled = false
    setActivityAccessResolved(false)
    void (async () => {
      try {
        const { data: me } = await supabase.from('users').select('role').eq('id', authUser.id).single()
        const role = (me as { role?: string } | null)?.role
        if (role === 'dev') {
          if (!cancelled) {
            setIsActivityViewer(false)
            setActivityAccessResolved(true)
          }
          return
        }
        const row = await withSupabaseRetry(
          async () =>
            await supabase.from('user_app_activity_viewers').select('viewer_user_id').eq('viewer_user_id', authUser.id).maybeSingle(),
          'activity viewer check'
        )
        if (!cancelled) {
          setIsActivityViewer(!!row)
          setActivityAccessResolved(true)
        }
      } catch {
        if (!cancelled) {
          setIsActivityViewer(false)
          setActivityAccessResolved(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canEditCrewJobs = canAccessPay || (authUserRole === 'assistant' && canAccessHours)

  const openHoursMyTimeFromSession = useCallback((s: ClockSessionRow) => {
    if (!s.user_id?.trim()) return
    setHoursMyTimeEditor({
      subjectUserId: s.user_id,
      subjectDisplayName: s.users?.name?.trim() ?? 'Unknown',
      dateStr: s.work_date,
    })
  }, [])

  const openHoursMyTimeForGridCell = useCallback((personName: string, workDate: string) => {
    const u = users.find((x) => (x.name ?? '').trim() === personName.trim())
    if (!u?.id) return
    setHoursMyTimeEditor({
      subjectUserId: u.id,
      subjectDisplayName: u.name?.trim() ?? personName,
      dateStr: workDate,
    })
  }, [users])

  const hoursAllowNcnsFromMyTime =
    isDev || authUserRole === 'master_technician' || authUserRole === 'assistant'

  useEffect(() => {
    if (!canSeePushStatus) return
    supabase
      .from('push_subscriptions')
      .select('user_id')
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
        setPushEnabledUserIds(ids)
      })
  }, [canSeePushStatus])

  useEffect(() => {
    if (!isDev) return
    supabase
      .from('clock_sessions')
      .select('user_id')
      .or('clock_in_lat.not.is.null,clock_out_lat.not.is.null')
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
        setLocationEnabledUserIds(ids)
      })
  }, [isDev])

  useEffect(() => {
    if (!canAccessContracts) return
    supabase
      .from('person_contract_documents')
      .select('person_name, contract_lineage_id, lineage_version, status')
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{
          person_name: string
          contract_lineage_id: string
          lineage_version: number
          status: string
        }>
        setContractSigningStatusByPersonName(rollupContractSigningStatusByPersonName(rows))
      })
  }, [canAccessContracts])

  async function archivePerson(id: string) {
    if (!confirm('Archive this person? They will be hidden from the roster but can be restored.')) return
    setArchivingId(id)
    setError(null)
    const { error: err } = await supabase.from('people').update({ archived_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else setPeople((prev) => prev.filter((p) => p.id !== id))
    setArchivingId(null)
    await loadArchivedPeople()
  }

  async function restorePerson(id: string) {
    setRestoringId(id)
    setError(null)
    const { error: err } = await supabase.from('people').update({ archived_at: null }).eq('id', id)
    if (err) setError(err.message)
    else {
      setArchivedPeople((prev) => prev.filter((p) => p.id !== id))
      await loadPeople()
    }
    setRestoringId(null)
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  async function inviteAsUser(p: Person) {
    if (!p.email?.trim()) {
      setError('Add an email in Edit to invite as user.')
      return
    }
    if (isAlreadyUser(p.email)) {
      setError('This email already has an account.')
      return
    }
    setInvitingId(p.id)
    setError(null)
    const role = KIND_TO_USER_ROLE[p.kind as PersonKind]
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body: { email: p.email.trim(), role, name: p.name || undefined },
    })
    setInvitingId(null)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setError(err)
      return
    }
    await loadPeople()
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email, name')
      .is('archived_at', null)
      .in('role', ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'])
    const usersAfterInvite = (usersData ?? []) as Array<{ id: string; email: string | null; name: string }>
    const dups = findPersonUserDuplicates(people, usersAfterInvite, payConfig)
    const invitedDup = dups.find((d) => d.email.toLowerCase() === p.email?.trim().toLowerCase())
    if (invitedDup) {
      const userId = usersAfterInvite.find((u) => u.email?.toLowerCase() === invitedDup.email?.toLowerCase())?.id
      try {
        await mergePersonIntoUser(
          invitedDup.personName,
          invitedDup.userDisplayName,
          payConfig,
          userId,
          people.map((p) => ({ id: p.id, name: p.name, email: p.email })),
        )
        await loadPayConfig()
        setMergeDuplicates((prev) => prev.filter((x) => x.personName !== invitedDup.personName))
      } catch (mergeErr) {
        setError(mergeErr instanceof Error ? mergeErr.message : 'Merge failed')
      }
    }
  }

  function confirmAndInvite() {
    if (!inviteConfirm) return
    const p = inviteConfirm
    setInviteConfirm(null)
    inviteAsUser(p)
  }

  async function handleMergeDuplicate(dup: { personName: string; userDisplayName: string; email: string }) {
    setMergingPersonName(dup.personName)
    setError(null)
    let userId: string | undefined
    if (dup.email?.trim()) {
      userId = users.find((u) => u.email?.toLowerCase() === dup.email?.toLowerCase())?.id
    } else {
      userId = users.find((u) => u.name?.trim() === dup.personName)?.id ?? users.find((u) => u.name?.trim() === dup.userDisplayName)?.id
    }
    try {
      await mergePersonIntoUser(
        dup.personName,
        dup.userDisplayName,
        payConfig,
        userId,
        people.map((p) => ({ id: p.id, name: p.name, email: p.email })),
      )
      await loadPayConfig()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
      if (activeTab === 'hours') {
        loadPeopleHours(hoursDateStart, hoursDateEnd)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  const payConfigRosterSections = useMemo(() => {
    const assigned = new Set<string>()
    const sections: Array<{ label: string; names: string[] }> = []
    for (const k of KINDS) {
      if (k === 'sub') {
        const items = buildUsersTabKindRoster('sub', users, people)
        const subSlices: Array<{ label: string; slice: typeof items }> = [
          { label: 'Subcontractors (with account)', slice: items.filter((i) => i.source === 'user') },
          { label: 'External Subcontractors', slice: items.filter((i) => i.source === 'people') },
        ]
        for (const { label, slice } of subSlices) {
          const raw = slice.map((item) => item.name?.trim()).filter((n): n is string => Boolean(n))
          const uniqueInSection = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b))
          const names = uniqueInSection.filter((n) => {
            if (assigned.has(n)) return false
            assigned.add(n)
            return true
          })
          if (names.length > 0) {
            sections.push({ label, names })
          }
        }
        continue
      }
      if (k === 'helper') {
        const items = buildUsersTabKindRoster('helper', users, people)
        const helperSlices: Array<{ label: string; slice: typeof items }> = [
          { label: 'Helper (with account)', slice: items.filter((i) => i.source === 'user') },
          { label: 'External Helpers', slice: items.filter((i) => i.source === 'people') },
        ]
        for (const { label, slice } of helperSlices) {
          const raw = slice.map((item) => item.name?.trim()).filter((n): n is string => Boolean(n))
          const uniqueInSection = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b))
          const names = uniqueInSection.filter((n) => {
            if (assigned.has(n)) return false
            assigned.add(n)
            return true
          })
          if (names.length > 0) {
            sections.push({ label, names })
          }
        }
        continue
      }
      const items = buildUsersTabKindRoster(k, users, people)
      const raw = items.map((item) => item.name?.trim()).filter((n): n is string => Boolean(n))
      const uniqueInSection = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b))
      const names = uniqueInSection.filter((n) => {
        if (assigned.has(n)) return false
        assigned.add(n)
        return true
      })
      sections.push({ label: KIND_LABELS[k], names })
    }
    return sections
  }, [people, users])
  // Keep the ref in sync so usePayConfig's salary-template loader reads the latest grouping.
  payConfigRosterSectionsRef.current = payConfigRosterSections

  useEffect(() => {
    if (!payConfigModalOpen || !canAccessPay) return
    void loadPayConfigSalaryTemplateIndicators()
    // payConfigRosterSections + users kept in deps so indicators refresh if the roster changes while the modal is open (matches pre-extraction behavior).
  }, [payConfigModalOpen, canAccessPay, payConfigRosterSections, users, loadPayConfigSalaryTemplateIndicators])

  async function loadArchivedUserNames() {
    if (!canAccessPay && !canAccessHours && !canViewCostMatrixShared) return
    const { data, error } = await supabase.rpc('get_archived_user_names')
    if (error) return
    const arr = Array.isArray(data) ? data : []
    const names = arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    setArchivedUserNames(new Set(names))
  }

  async function loadHoursReviewed() {
    if (!canAccessPay) return
    const { data } = await supabase
      .from('hours_reviewed')
      .select('person_name')
      .eq('start_date', hoursDateStart)
    const set = new Set((data ?? []).map((r: { person_name: string }) => r.person_name))
    setHoursReviewedSet(set)
  }

  const draftPayrollPendingFetchIdRef = useRef(0)
  const loadDraftPayrollPendingApprovalsRef = useRef<(periodStart: string, periodEnd: string) => void>(() => {})

  const loadDraftPayrollPendingApprovals = useCallback(async (periodStart: string, periodEnd: string) => {
    if (!canAccessPay || periodStart > periodEnd) return
    const fetchId = ++draftPayrollPendingFetchIdRef.current
    setDraftPayrollPendingApprovalLoading(true)
    setDraftPayrollPendingApprovalError(null)
    try {
      const count = await withSupabaseRetry(
        async () => {
          const result = await supabase
            .from('clock_sessions')
            .select('*', { count: 'exact', head: true })
            .is('approved_at', null)
            .is('rejected_at', null)
            .gte('work_date', periodStart)
            .lte('work_date', periodEnd)
          if (result.error) return { data: null as number | null, error: result.error }
          return { data: result.count ?? 0, error: null }
        },
        'draft payroll pending approvals count',
      )
      if (fetchId !== draftPayrollPendingFetchIdRef.current) return
      setDraftPayrollPendingApprovalCount(count)
    } catch (e) {
      if (fetchId !== draftPayrollPendingFetchIdRef.current) return
      setDraftPayrollPendingApprovalError(formatErrorMessage(e, 'Could not load pending approvals'))
      setDraftPayrollPendingApprovalCount(null)
    } finally {
      if (fetchId === draftPayrollPendingFetchIdRef.current) {
        setDraftPayrollPendingApprovalLoading(false)
      }
    }
  }, [canAccessPay])

  loadDraftPayrollPendingApprovalsRef.current = loadDraftPayrollPendingApprovals

  async function loadHoursDaysCorrect(start: string, end: string) {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data, error } = await (supabase as any)
      .from('hours_days_correct')
      .select('work_date')
      .gte('work_date', start)
      .lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    setHoursDaysCorrect((prev) => {
      const next = new Set(prev)
      for (const d of getDaysInRange(start, end)) next.delete(d)
      for (const r of (data ?? []) as { work_date: string }[]) next.add(r.work_date)
      return next
    })
  }

  async function toggleHoursDayCorrect(workDate: string) {
    if (!canAccessHours && !canAccessPay) return
    const isCorrect = hoursDaysCorrect.has(workDate)
    if (isCorrect) {
      const { error } = await (supabase as any).from('hours_days_correct').delete().eq('work_date', workDate)
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.delete(workDate); return next })
    } else {
      const { error } = await (supabase as any).from('hours_days_correct').insert({ work_date: workDate, marked_by: authUser?.id ?? null })
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.add(workDate); return next })
    }
  }

  async function loadPayStubs(): Promise<PayStubsLoadSnapshot | null> {
    if (!canAccessPay) return null
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('pay_stubs')
            .select('id, person_name, period_start, period_end, hours_total, gross_pay, created_at, paid_at, paid_by, paid_note')
            .order('created_at', { ascending: false }),
        'load pay stubs'
      )
      const stubs = (data ?? []) as PayStubRow[]
      setPayStubs(stubs)
      const ids = stubs.map((s) => s.id)
      if (ids.length === 0) {
        setPayStubPaymentsByStubId({})
        setPayStubDeductionsByStubId({})
        setPayStubAdditionalByStubId({})
        return {
          stubs: [],
          paymentsByStubId: {},
          deductionsByStubId: {},
          additionalByStubId: {},
        }
      }
      const byStub: Record<string, PayStubPaymentRow[]> = {}
      const dedByStub: Record<string, PayStubDeductionRow[]> = {}
      const addByStub: Record<string, PayStubAdditionalLineRow[]> = {}
      const chunkSize = 200
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const [payments, deductions, additional] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('pay_stub_payments')
                .select('id, pay_stub_id, amount, paid_at, memo, created_at, created_by')
                .in('pay_stub_id', chunk)
                .order('paid_at', { ascending: true }),
            'load pay stub payments',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('pay_stub_deductions')
                .select('id, pay_stub_id, amount, source, person_offset_id, description, created_at, created_by')
                .in('pay_stub_id', chunk)
                .order('created_at', { ascending: true }),
            'load pay stub deductions',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('pay_stub_additional_lines')
                .select('id, pay_stub_id, description, quantity, rate, line_total, created_at, created_by, source_clock_session_id')
                .in('pay_stub_id', chunk)
                .order('created_at', { ascending: true }),
            'load pay stub additional lines',
          ),
        ])
        for (const p of (payments ?? []) as PayStubPaymentRow[]) {
          const list = byStub[p.pay_stub_id] ?? []
          list.push(p)
          byStub[p.pay_stub_id] = list
        }
        for (const d of (deductions ?? []) as PayStubDeductionRow[]) {
          const list = dedByStub[d.pay_stub_id] ?? []
          list.push(d)
          dedByStub[d.pay_stub_id] = list
        }
        for (const a of (additional ?? []) as PayStubAdditionalLineRow[]) {
          const list = addByStub[a.pay_stub_id] ?? []
          list.push(a)
          addByStub[a.pay_stub_id] = list
        }
      }
      setPayStubPaymentsByStubId(byStub)
      setPayStubDeductionsByStubId(dedByStub)
      setPayStubAdditionalByStubId(addByStub)
      return {
        stubs,
        paymentsByStubId: byStub,
        deductionsByStubId: dedByStub,
        additionalByStubId: addByStub,
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pay reports')
      return null
    }
  }

  async function getVehiclesForPersonInPeriod(
    personName: string,
    periodStart: string,
    periodEnd: string
  ): Promise<Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }>> {
    const n = personName.trim()
    const user = users.find((u) => (u.name ?? '').trim().toLowerCase() === n.toLowerCase())
    if (!user) return []
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, start_date')
      .eq('user_id', user.id)
      .lte('start_date', periodEnd)
      .or(`end_date.is.null,end_date.gte.${periodStart}`)
      .order('start_date', { ascending: false })
    const poss = (possData ?? []) as { vehicle_id: string; start_date: string }[]
    const vehicleIds = [...new Set(poss.filter((p) => p.start_date <= periodEnd).map((p) => p.vehicle_id))]
    const result: Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }> = []
    for (const vehicleId of vehicleIds) {
      const { data: vehicleData } = await supabase.from('vehicles').select('year, make, model, vin, weekly_insurance_cost, weekly_registration_cost').eq('id', vehicleId).single()
      if (!vehicleData) continue
      const v = vehicleData as { year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }
      result.push({
        year: v.year ?? 0,
        make: v.make ?? '',
        model: v.model ?? '',
        vin: v.vin ?? null,
        weekly_insurance_cost: v.weekly_insurance_cost ?? 0,
        weekly_registration_cost: v.weekly_registration_cost ?? 0,
      })
    }
    return result
  }

  async function getHousingForPersonInPeriod(
    personName: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<
    Array<{ address: string; rent_per_week: number; utilities_per_week: number; insurance_per_week: number }>
  > {
    const n = personName.trim()
    const user = users.find((u) => (u.name ?? '').trim().toLowerCase() === n.toLowerCase())
    if (!user) return []
    const { data: possData } = await supabase
      .from('housing_possessions')
      .select('housing_id, start_date')
      .eq('user_id', user.id)
      .lte('start_date', periodEnd)
      .or(`end_date.is.null,end_date.gte.${periodStart}`)
      .order('start_date', { ascending: false })
    const poss = (possData ?? []) as { housing_id: string; start_date: string }[]
    const housingIds = [...new Set(poss.filter((p) => p.start_date <= periodEnd).map((p) => p.housing_id))]
    const result: Array<{
      address: string
      rent_per_week: number
      utilities_per_week: number
      insurance_per_week: number
    }> = []
    for (const hid of housingIds) {
      const { data: row } = await supabase
        .from('housing_units')
        .select('address, rent_per_week, utilities_per_week, insurance_per_week')
        .eq('id', hid)
        .single()
      if (!row) continue
      const h = row as {
        address: string
        rent_per_week: number
        utilities_per_week: number
        insurance_per_week: number
      }
      result.push({
        address: h.address ?? '',
        rent_per_week: Number(h.rent_per_week) || 0,
        utilities_per_week: Number(h.utilities_per_week) || 0,
        insurance_per_week: Number(h.insurance_per_week) || 0,
      })
    }
    return result
  }

  async function getPendingOffsetsForPayReport(personName: string): Promise<
    Array<{ type: string; amount: number; description: string | null }>
  > {
    const pending: Array<{ type: string; amount: number; description: string | null }> = []
    const { data: pendingData } = await supabase
      .from('person_offsets')
      .select('type, amount, description')
      .eq('person_name', personName.trim())
      .is('pay_stub_id', null)
    for (const r of (pendingData ?? []) as { type: string; amount: number; description: string | null }[]) {
      pending.push({ type: r.type, amount: r.amount, description: r.description })
    }
    return pending
  }

  function getPersonContact(personName: string): { email: string | null; phone: string | null } {
    const n = personName.trim()
    const p = people.find((x) => x.name?.trim() === n)
    if (p) return { email: p.email ?? null, phone: p.phone ?? null }
    const u = users.find((x) => x.name?.trim() === n)
    if (u) return { email: u.email ?? null, phone: u.phone ?? null }
    return { email: null, phone: null }
  }

  async function generatePayStub(
    personNameArg: string,
    options?: { openPreview?: boolean },
  ): Promise<boolean> {
    const openPreview = options?.openPreview !== false
    const personName = personNameArg.trim()
    if (!authUser?.id || !personName) return false
    const start = payStubPeriodStart
    const end = payStubPeriodEnd
    const { data: hoursData } = await supabase
      .from('people_hours')
      .select('work_date, hours')
      .eq('person_name', personName)
      .gte('work_date', start)
      .lte('work_date', end)
    const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[])
      .sort((a, b) => a.work_date.localeCompare(b.work_date))
      .map((r) => ({ date: r.work_date, hours: r.hours }))
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const isSalary = cfg?.is_salary ?? false
    const daysInRange = getDaysInRange(start, end)
    const dayRows: Array<{ work_date: string; hours: number; paid_amount: number }> = []
    for (const d of daysInRange) {
      const hrs = isSalary
        ? (() => {
            const day = new Date(d + 'T12:00:00').getDay()
            return day >= 1 && day <= 5 ? 8 : 0
          })()
        : hoursRows.find((r) => r.date === d)?.hours ?? 0
      const paidAmount = hrs * wage
      dayRows.push({ work_date: d, hours: hrs, paid_amount: paidAmount })
    }
    const hoursTotal = dayRows.reduce((s, r) => s + r.hours, 0)
    const grossPay = dayRows.reduce((s, r) => s + r.paid_amount, 0)
    const { data: stubData, error: stubErr } = await supabase
      .from('pay_stubs')
      .insert({
        person_name: personName,
        period_start: start,
        period_end: end,
        hours_total: hoursTotal,
        gross_pay: grossPay,
        created_by: authUser.id,
      })
      .select('id')
      .single()
    if (stubErr || !stubData) {
      setError(stubErr?.message ?? 'Failed to create pay report')
      return false
    }
    const payStubId = stubData.id as string
    const { error: daysErr } = await supabase.from('pay_stub_days').insert(
      dayRows.map((r) => ({
        pay_stub_id: payStubId,
        person_name: personName,
        work_date: r.work_date,
        hours_at_time: r.hours,
        rate_at_time: wage,
        paid_amount: r.paid_amount,
      }))
    )
    if (daysErr) {
      setError(daysErr.message)
      return false
    }
    await loadPayStubs()
    const [{ data: crewData }, { data: crewBidsData }] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = {
        bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
      }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${personName}`]
      const jobAssignments = row?.job_assignments ?? []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${personName}`]
      const bidAssignments = bidRow?.bid_assignments ?? []
      for (const a of bidAssignments) bidIds.add(a.bid_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    const bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    if (bidIds.size > 0) {
      const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
      for (const b of (bidsData ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
        bidsMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportAssignmentsBreakdown(personName, dayRows, crewByDatePerson, crewBidsByDatePerson, jobsMap, bidsMap)
    const [vehicles, housingRowsGen, pendingOffsets, dedRes, addRes] = await Promise.all([
      getVehiclesForPersonInPeriod(personName, start, end),
      getHousingForPersonInPeriod(personName, start, end),
      getPendingOffsetsForPayReport(personName),
      supabase
        .from('pay_stub_deductions')
        .select('amount, description, source')
        .eq('pay_stub_id', payStubId)
        .order('created_at', { ascending: true }),
      supabase
        .from('pay_stub_additional_lines')
        .select('description, quantity, rate, line_total')
        .eq('pay_stub_id', payStubId)
        .order('created_at', { ascending: true }),
    ])
    const additionalLinesGen = ((addRes.data ?? []) as { description: string; quantity: number; rate: number; line_total: number }[]).map(
      (r) => ({
        description: r.description,
        quantity: r.quantity,
        rate: r.rate,
        line_total: r.line_total,
      }),
    )
    const lessLines = ((dedRes.data ?? []) as { amount: number; description: string; source: string }[]).map((r) => ({
      amount: r.amount,
      description: r.description,
      source: r.source,
    }))
    const html = buildPayStubHtml({
      personName,
      contact: getPersonContact(personName),
      periodStart: start,
      periodEnd: end,
      hourlyWage: wage,
      hoursRows: dayRows.map((r) => ({ date: r.work_date, hours: r.hours })),
      hoursTotal,
      grossPay,
      rowsWithJobs,
      vehicles,
      additionalLines: additionalLinesGen,
      lessDeductionLines: lessLines,
      pendingOffsets,
      physicalPayments: [],
      housingRows: housingRowsGen,
    })
    if (openPreview) openPayStubWindow(html, false)
    return true
  }

  async function bulkGenerateMissingPayStubsInModal() {
    const start = payStubPeriodStart
    const end = payStubPeriodEnd
    if (start > end) {
      showToast('Invalid date range.', 'warning')
      return
    }
    const days = getDaysInRange(start, end)
    const candidates = showPeopleForHours.filter((person) => {
      const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
      const estGross = days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
      return estGross > 0 && !stub
    })
    if (candidates.length === 0) {
      showToast('No missing pay reports with hours for this period.', 'info')
      return
    }
    if (
      !window.confirm(
        `Generate ${candidates.length} pay report(s) for ${start} through ${end}?\n\nPeople who already have a report for this period are skipped.`,
      )
    )
      return
    setBulkGeneratingPayStubs(true)
    setError(null)
    let ok = 0
    try {
      for (const person of candidates) {
        const success = await generatePayStub(person, { openPreview: false })
        if (success) ok += 1
      }
    } finally {
      setBulkGeneratingPayStubs(false)
    }
    if (ok === candidates.length) {
      showToast(`Generated ${ok} pay report(s).`, 'success')
    } else {
      showToast(`Generated ${ok} of ${candidates.length} pay report(s). Some failed; check the error message above.`, 'warning')
    }
  }

  async function viewPayStub(stub: PayStubRow) {
    const start = stub.period_start
    const end = stub.period_end
    const cfg = payConfig[stub.person_name]
    const isSalary = cfg?.is_salary ?? false
    const { data: daysData } = await supabase.from('pay_stub_days').select('work_date, hours_at_time').eq('pay_stub_id', stub.id).order('work_date')
    let dayRows: Array<{ work_date: string; hours: number }>
    if (daysData && daysData.length > 0) {
      dayRows = (daysData as { work_date: string; hours_at_time: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours_at_time }))
    } else {
      const { data: hoursData } = await supabase.from('people_hours').select('work_date, hours').eq('person_name', stub.person_name).gte('work_date', start).lte('work_date', end)
      const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours }))
      const daysInRange = getDaysInRange(start, end)
      dayRows = daysInRange.map((d) => {
        const hrs = isSalary ? (() => { const day = new Date(d + 'T12:00:00').getDay(); return day >= 1 && day <= 5 ? 8 : 0 })() : (hoursRows.find((r) => r.work_date === d)?.hours ?? 0)
        return { work_date: d, hours: hrs }
      })
    }
    const wage = cfg?.hourly_wage ?? 0
    const [{ data: crewData }, { data: crewBidsData }] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = { bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [] }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const jobAssignments = row?.job_assignments ?? []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${stub.person_name}`]
      const bidAssignments = bidRow?.bid_assignments ?? []
      for (const a of bidAssignments) bidIds.add(a.bid_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    const bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    if (bidIds.size > 0) {
      const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
      for (const b of (bidsData ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
        bidsMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportAssignmentsBreakdown(stub.person_name, dayRows, crewByDatePerson, crewBidsByDatePerson, jobsMap, bidsMap)
    const hoursRows = dayRows.map((r) => ({ date: r.work_date, hours: r.hours }))
    const [vehicles, housingRowsView, pendingOffsets, payData, dedRes, addResView] = await Promise.all([
      getVehiclesForPersonInPeriod(stub.person_name, start, end),
      getHousingForPersonInPeriod(stub.person_name, start, end),
      getPendingOffsetsForPayReport(stub.person_name),
      supabase.from('pay_stub_payments').select('paid_at, amount, memo').eq('pay_stub_id', stub.id).order('paid_at', { ascending: true }),
      supabase
        .from('pay_stub_deductions')
        .select('amount, description, source')
        .eq('pay_stub_id', stub.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('pay_stub_additional_lines')
        .select('description, quantity, rate, line_total')
        .eq('pay_stub_id', stub.id)
        .order('created_at', { ascending: true }),
    ])
    const additionalLinesView = ((addResView.data ?? []) as { description: string; quantity: number; rate: number; line_total: number }[]).map(
      (r) => ({
        description: r.description,
        quantity: r.quantity,
        rate: r.rate,
        line_total: r.line_total,
      }),
    )
    const lessLines = ((dedRes.data ?? []) as { amount: number; description: string; source: string }[]).map((r) => ({
      amount: r.amount,
      description: r.description,
      source: r.source,
    }))
    const physicalPayments = ((payData.data ?? []) as { paid_at: string; amount: number; memo: string | null }[]).map((r) => ({
      paid_at: r.paid_at,
      amount: r.amount,
      memo: r.memo,
    }))
    const html = buildPayStubHtml({
      personName: stub.person_name,
      contact: getPersonContact(stub.person_name),
      periodStart: start,
      periodEnd: end,
      hourlyWage: wage,
      hoursRows,
      hoursTotal: stub.hours_total,
      grossPay: stub.gross_pay,
      rowsWithJobs,
      vehicles,
      additionalLines: additionalLinesView,
      lessDeductionLines: lessLines,
      pendingOffsets,
      physicalPayments,
      housingRows: housingRowsView,
    })
    openPayStubWindow(html, false)
  }

  async function printPayStub(stub: PayStubRow) {
    const start = stub.period_start
    const end = stub.period_end
    const cfg = payConfig[stub.person_name]
    const isSalary = cfg?.is_salary ?? false
    const { data: daysData } = await supabase.from('pay_stub_days').select('work_date, hours_at_time').eq('pay_stub_id', stub.id).order('work_date')
    let dayRows: Array<{ work_date: string; hours: number }>
    if (daysData && daysData.length > 0) {
      dayRows = (daysData as { work_date: string; hours_at_time: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours_at_time }))
    } else {
      const { data: hoursData } = await supabase.from('people_hours').select('work_date, hours').eq('person_name', stub.person_name).gte('work_date', start).lte('work_date', end)
      const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours }))
      const daysInRange = getDaysInRange(start, end)
      dayRows = daysInRange.map((d) => {
        const hrs = isSalary ? (() => { const day = new Date(d + 'T12:00:00').getDay(); return day >= 1 && day <= 5 ? 8 : 0 })() : (hoursRows.find((r) => r.work_date === d)?.hours ?? 0)
        return { work_date: d, hours: hrs }
      })
    }
    const wage = cfg?.hourly_wage ?? 0
    const [{ data: crewData }, { data: crewBidsData }] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = { bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [] }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const jobAssignments = row?.job_assignments ?? []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${stub.person_name}`]
      const bidAssignments = bidRow?.bid_assignments ?? []
      for (const a of bidAssignments) bidIds.add(a.bid_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    const bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    if (bidIds.size > 0) {
      const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
      for (const b of (bidsData ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
        bidsMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportAssignmentsBreakdown(stub.person_name, dayRows, crewByDatePerson, crewBidsByDatePerson, jobsMap, bidsMap)
    const hoursRows = dayRows.map((r) => ({ date: r.work_date, hours: r.hours }))
    const [vehicles, housingRowsPrint, pendingOffsets, payData, dedResPrint, addResPrint] = await Promise.all([
      getVehiclesForPersonInPeriod(stub.person_name, start, end),
      getHousingForPersonInPeriod(stub.person_name, start, end),
      getPendingOffsetsForPayReport(stub.person_name),
      supabase.from('pay_stub_payments').select('paid_at, amount, memo').eq('pay_stub_id', stub.id).order('paid_at', { ascending: true }),
      supabase
        .from('pay_stub_deductions')
        .select('amount, description, source')
        .eq('pay_stub_id', stub.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('pay_stub_additional_lines')
        .select('description, quantity, rate, line_total')
        .eq('pay_stub_id', stub.id)
        .order('created_at', { ascending: true }),
    ])
    const additionalLinesPrint = ((addResPrint.data ?? []) as { description: string; quantity: number; rate: number; line_total: number }[]).map(
      (r) => ({
        description: r.description,
        quantity: r.quantity,
        rate: r.rate,
        line_total: r.line_total,
      }),
    )
    const lessLinesPrint = ((dedResPrint.data ?? []) as { amount: number; description: string; source: string }[]).map((r) => ({
      amount: r.amount,
      description: r.description,
      source: r.source,
    }))
    const physicalPayments = ((payData.data ?? []) as { paid_at: string; amount: number; memo: string | null }[]).map((r) => ({
      paid_at: r.paid_at,
      amount: r.amount,
      memo: r.memo,
    }))
    const html = buildPayStubHtml({
      personName: stub.person_name,
      contact: getPersonContact(stub.person_name),
      periodStart: start,
      periodEnd: end,
      hourlyWage: wage,
      hoursRows,
      hoursTotal: stub.hours_total,
      grossPay: stub.gross_pay,
      rowsWithJobs,
      vehicles,
      additionalLines: additionalLinesPrint,
      lessDeductionLines: lessLinesPrint,
      pendingOffsets,
      physicalPayments,
      housingRows: housingRowsPrint,
    })
    openPayStubWindow(html, true)
  }

  async function deletePayStub(stub: PayStubRow) {
    setDeletingPayStubId(stub.id)
    setError(null)
    const { error: err } = await supabase.from('pay_stubs').delete().eq('id', stub.id)
    if (err) {
      setError(err.message)
    } else {
      setPayStubs((prev) => prev.filter((s) => s.id !== stub.id))
      setPayStubPaymentsByStubId((prev) => {
        const next = { ...prev }
        delete next[stub.id]
        return next
      })
      setPayStubDeductionsByStubId((prev) => {
        const next = { ...prev }
        delete next[stub.id]
        return next
      })
      setPayStubAdditionalByStubId((prev) => {
        const next = { ...prev }
        delete next[stub.id]
        return next
      })
      setPayStubDeleteConfirm(null)
    }
    setDeletingPayStubId(null)
  }

  function openPayStubMarkPaidModal(stub: PayStubRow) {
    const paidSoFar = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
    const dedSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id])
    const addSum = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id])
    const netPay = stubNetPay(stub.gross_pay, dedSum, addSum)
    const remaining = remainingPayStubBalance(netPay, paidSoFar)
    setPayStubMarkPaidTarget(stub)
    setPayStubMarkPaidDate(todayYyyyMmDdLocal())
    setPayStubMarkPaidAmount(remaining > 0 ? remaining.toFixed(2) : '')
    setPayStubMarkPaidNote('')
  }

  function closePayStubMarkPaidModal() {
    setPayStubMarkPaidTarget(null)
    setPayStubMarkPaidDate('')
    setPayStubMarkPaidAmount('')
    setPayStubMarkPaidNote('')
  }

  function openEmployeeCreditFromRecordPayment() {
    if (!payStubMarkPaidTarget) return
    const stub = payStubMarkPaidTarget
    const paidSoFar = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
    const dedSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id])
    const addSum = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id])
    const netPay = stubNetPay(stub.gross_pay, dedSum, addSum)
    const remaining = remainingPayStubBalance(netPay, paidSoFar)
    const amtRaw = payStubMarkPaidAmount.trim().replace(/,/g, '')
    const totalPaid = parseFloat(amtRaw)
    let amountStr = ''
    if (Number.isFinite(totalPaid) && totalPaid > remaining + PAY_STUB_PAY_FULLY_TOLERANCE) {
      amountStr = (Math.round((totalPaid - remaining) * 100) / 100).toFixed(2)
    }
    const memo = payStubMarkPaidNote.trim()
    const periodLine = `Pay period ${stub.period_start} – ${stub.period_end}`
    const description = [memo, periodLine].filter(Boolean).join(' · ')
    recordPaymentRefreshAfterEmployeeCreditRef.current = true
    openOffsetFormWithDraft({
      personName: stub.person_name,
      type: 'employee_credit',
      amount: amountStr,
      description,
      occurredDate: payStubMarkPaidDate.trim() || todayYyyyMmDdLocal(),
    })
  }

  async function confirmPayStubMarkPaid() {
    if (!authUser?.id || !payStubMarkPaidTarget) return
    const stub = payStubMarkPaidTarget
    const noteTrim = payStubMarkPaidNote.trim()
    const paidAt = paidAtIsoFromYyyyMmDd(payStubMarkPaidDate.trim() || todayYyyyMmDdLocal())
    const amtRaw = payStubMarkPaidAmount.trim().replace(/,/g, '')
    const amount = parseFloat(amtRaw)
    const paidSoFar = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
    const dedSumMark = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id])
    const addSumMark = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id])
    const netPayMark = stubNetPay(stub.gross_pay, dedSumMark, addSumMark)
    const remaining = remainingPayStubBalance(netPayMark, paidSoFar)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount greater than zero.')
      return
    }
    if (remaining <= PAY_STUB_PAY_FULLY_TOLERANCE) {
      setError('No remaining balance to apply this payment to.')
      return
    }
    const applied = Math.round(Math.min(amount, remaining) * 100) / 100
    if (applied <= 0) {
      setError('No remaining balance to apply this payment to.')
      return
    }
    setMarkingPayStubId(stub.id)
    setError(null)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('pay_stub_payments').insert({
            pay_stub_id: stub.id,
            amount: applied,
            paid_at: paidAt,
            memo: noteTrim || null,
            created_by: authUser.id,
          }),
        'record pay stub payment'
      )
      closePayStubMarkPaidModal()
      await loadPayStubs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment')
    }
    setMarkingPayStubId(null)
  }

  async function loadTeams() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from('people_teams').select('id, name, sequence_order').order('sequence_order', { ascending: true }),
      supabase.from('people_team_members').select('team_id, person_name'),
    ])
    if (teamsRes.error) return
    const teamList = (teamsRes.data ?? []) as Array<{ id: string; name: string; sequence_order: number }>
    const membersByTeam = new Map<string, string[]>()
    for (const m of (membersRes.data ?? []) as Array<{ team_id: string; person_name: string }>) {
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, [])
      membersByTeam.get(m.team_id)!.push(m.person_name)
    }
    setTeams(teamList.map((t) => ({ id: t.id, name: t.name, members: membersByTeam.get(t.id) ?? [] })))
  }

  async function loadCostMatrixShares() {
    if (!isDev) return
    const [candidatesRes, sharesRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').is('archived_at', null).in('role', ['master_technician', 'assistant', 'dev']).order('name'),
      supabase.from('cost_matrix_teams_shares').select('shared_with_user_id'),
    ])
    if (candidatesRes.data) setCostMatrixShareCandidates(candidatesRes.data as Array<{ id: string; name: string; email: string | null; role: string }>)
    if (sharesRes.data) setCostMatrixSharedUserIds(new Set((sharesRes.data as { shared_with_user_id: string }[]).map((r) => r.shared_with_user_id)))
  }

  async function toggleCostMatrixShare(userId: string, isShared: boolean) {
    if (!isDev) return
    setCostMatrixShareSaving(true)
    setCostMatrixShareError(null)
    if (isShared) {
      const { error } = await supabase.from('cost_matrix_teams_shares').insert({ shared_with_user_id: userId })
      if (error) setCostMatrixShareError(error.message)
      else setCostMatrixSharedUserIds((prev) => new Set(prev).add(userId))
    } else {
      const { error } = await supabase.from('cost_matrix_teams_shares').delete().eq('shared_with_user_id', userId)
      if (error) setCostMatrixShareError(error.message)
      else setCostMatrixSharedUserIds((prev) => { const next = new Set(prev); next.delete(userId); return next })
    }
    setCostMatrixShareSaving(false)
  }

  async function loadCostMatrixTags() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const { data } = await supabase.from('people_cost_matrix_tags').select('person_name, tags')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { person_name: string; tags: string }[]) {
      map[r.person_name] = r.tags ?? ''
    }
    setCostMatrixTags(map)
  }

  async function loadCostMatrixTagColors() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const { data } = await supabase.from('cost_matrix_tag_colors').select('tag, color')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { tag: string; color: string }[]) {
      map[r.tag] = r.color ?? '#e5e7eb'
    }
    setCostMatrixTagColors(map)
  }

  useEffect(() => {
    if (activeTab === 'hours' && canAccessPay && Object.keys(payConfig).length > 0) {
      const dups = findPersonUserDuplicates(people, users, payConfig)
      setMergeDuplicates(dups)
    } else {
      setMergeDuplicates([])
    }
  }, [activeTab, payConfig, people, users])

  useEffect(() => {
    if (activeTab === 'hours' && isDev && (canAccessPay || canViewCostMatrixShared)) {
      const t = setTimeout(() => loadCostMatrixShares(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, isDev, canAccessPay, canViewCostMatrixShared])

  async function loadHoursDisplayOrder() {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function moveHoursRow(personName: string, direction: 'up' | 'down') {
    const idx = showPeopleForHours.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeopleForHours.length) return
    const otherName = showPeopleForHours[otherIdx]
    if (!otherName) return
    const newOrderA = otherIdx
    const newOrderB = idx
    setHoursDisplayOrder((prev) => ({
      ...prev,
      [personName]: newOrderA,
      [otherName]: newOrderB,
    }))
    await Promise.all([
      supabase.from('people_hours_display_order').upsert({ person_name: personName, sequence_order: newOrderA }, { onConflict: 'person_name' }),
      supabase.from('people_hours_display_order').upsert({ person_name: otherName, sequence_order: newOrderB }, { onConflict: 'person_name' }),
    ])
  }

  async function saveCostMatrixTags(personName: string, tags: string) {
    if (!canAccessPay) return
    const trimmed = (tags ?? '').trim()
    setCostMatrixTags((prev) => ({ ...prev, [personName]: trimmed }))
    await supabase.from('people_cost_matrix_tags').upsert(
      { person_name: personName, tags: trimmed },
      { onConflict: 'person_name' }
    )
  }

  async function saveTagColor(tag: string, color: string) {
    if (!canAccessPay) return
    const trimmedTag = tag.trim()
    if (!trimmedTag) return
    setCostMatrixTagColors((prev) => ({ ...prev, [trimmedTag]: color }))
    await supabase.from('cost_matrix_tag_colors').upsert(
      { tag: trimmedTag, color },
      { onConflict: 'tag' }
    )
  }

  async function moveMatrixRow(personName: string, direction: 'up' | 'down') {
    const idx = showPeopleForMatrix.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeopleForMatrix.length) return
    const otherName = showPeopleForMatrix[otherIdx]
    if (!otherName) return
    const newOrderA = otherIdx
    const newOrderB = idx
    setHoursDisplayOrder((prev) => ({
      ...prev,
      [personName]: newOrderA,
      [otherName]: newOrderB,
    }))
    await Promise.all([
      supabase.from('people_hours_display_order').upsert({ person_name: personName, sequence_order: newOrderA }, { onConflict: 'person_name' }),
      supabase.from('people_hours_display_order').upsert({ person_name: otherName, sequence_order: newOrderB }, { onConflict: 'person_name' }),
    ])
  }

  useEffect(() => {
    if (activeTab !== 'hours' || !canOpenHoursTab) {
      hoursTabFirstLoadCycleStartedRef.current = false
      return
    }
    const t = setTimeout(() => {
      hoursTabFirstLoadCycleStartedRef.current = true
      setHoursTabLoading(true)
      const matrixOrPay = canAccessPay || canViewCostMatrixShared
      const loads: Promise<unknown>[] = [
        loadPayConfig(),
        loadPeopleHours(hoursDateStart, hoursDateEnd),
        loadHoursDisplayOrder(),
      ]
      if (canAccessHours) {
        loads.push(
          loadHoursDaysCorrect(hoursDateStart, hoursDateEnd),
          loadPendingClockSessions(hoursDateStart, hoursDateEnd),
          loadApprovedClockSessions(hoursDateStart, hoursDateEnd),
          loadRejectedClockSessions(hoursDateStart, hoursDateEnd),
        )
      }
      if (matrixOrPay) {
        loads.push(
          loadTeams(),
          loadCostMatrixTags(),
          loadCostMatrixTagColors(),
          loadArchivedUserNames(),
          loadHoursReviewed(),
        )
      }
      void Promise.all(loads).finally(() => setHoursTabLoading(false))
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab, canOpenHoursTab, canAccessHours, canAccessPay, canViewCostMatrixShared, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    if (activeTab === 'pay_stubs' && canAccessPay && payStubPeriodStart <= payStubPeriodEnd) {
      const t = setTimeout(() => {
        loadPeopleHours(payStubPeriodStart, payStubPeriodEnd)
        loadHoursDaysCorrect(payStubPeriodStart, payStubPeriodEnd)
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay, payStubPeriodStart, payStubPeriodEnd])

  useEffect(() => {
    draftPayrollRealtimeSnapRef.current = {
      draftOpen: draftPayrollModalOpen,
      activeTab,
      canAccessPay,
      periodStart: payStubPeriodStart,
      periodEnd: payStubPeriodEnd,
    }
  }, [draftPayrollModalOpen, activeTab, canAccessPay, payStubPeriodStart, payStubPeriodEnd])

  useEffect(() => {
    if (!draftPayrollModalOpen) setDraftPayrollHoursBreakdownPerson(null)
  }, [draftPayrollModalOpen])

  useEffect(() => {
    if (!draftPayrollModalOpen || !canAccessPay) {
      if (!draftPayrollModalOpen) {
        setDraftPayrollPendingApprovalCount(null)
        setDraftPayrollPendingApprovalLoading(false)
        setDraftPayrollPendingApprovalError(null)
      }
      return
    }
    if (payStubPeriodStart > payStubPeriodEnd) {
      setDraftPayrollPendingApprovalCount(null)
      setDraftPayrollPendingApprovalLoading(false)
      return
    }
    const t = setTimeout(() => {
      void loadDraftPayrollPendingApprovals(payStubPeriodStart, payStubPeriodEnd)
    }, 80)
    return () => clearTimeout(t)
  }, [draftPayrollModalOpen, canAccessPay, payStubPeriodStart, payStubPeriodEnd, loadDraftPayrollPendingApprovals])

  function openOffsetFormWithDraft(draft: PersonOffsetInitialDraft) {
    setOffsetFormInitialCreateDraft(draft)
    setOffsetFormOpen(true)
  }

  function closeOffsetForm() {
    recordPaymentRefreshAfterEmployeeCreditRef.current = false
    setOffsetFormOpen(false)
    setOffsetFormInitialCreateDraft(null)
    setOffsetFormError(null)
  }

  useEffect(() => {
    if (activeTab === 'review' && isDev) {
      const t = setTimeout(() => {
        void loadPayConfig()
        void loadArchivedUserNames()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, isDev])

  // ---- Inline Team Summary callbacks (replace the old iframe postMessage handlers) ----
  //
  // The React `<TeamSummaryInline>` component calls these directly when
  // the user clicks a name cell or a day header inside the Hours
  // breakdown drilldown. Behavior parity with the iframe version is
  // intentional: name-click toggles the per-person panel below the
  // table, day-click opens DashboardMyTimeDayEditorModal (looking up
  // the linked user from `usersRef`).
  const handleInlineOpenDayEditor = useCallback(
    (personName: string, workDate: string) => {
      const trimmedName = personName.trim()
      const trimmedDate = workDate.trim()
      if (!trimmedName || !trimmedDate) return
      const u = usersRef.current.find(
        (x) => (x.name ?? '').trim() === trimmedName,
      )
      if (!u?.id) {
        showToast(
          `No user account is linked to "${trimmedName}". Link the roster name in People → Users to open My Time.`,
          'error',
        )
        return
      }
      reviewHoursDayEditorPersonRef.current = trimmedName
      setHoursMyTimeEditor({
        subjectUserId: u.id,
        subjectDisplayName: u.name?.trim() ?? trimmedName,
        dateStr: trimmedDate,
      })
    },
    [showToast],
  )
  // Drilldown modal open/close — defer auto-refresh while a modal is
  // open so the user's open breakdown doesn't get re-derived under
  // them. Mirrors the iframe `team-summary-modal-open/close` bridge.
  const handleInlineDrilldownOpenChange = useCallback((open: boolean) => {
    teamSummaryModalOpenRef.current = open
    if (!open && teamSummaryRefreshPendingRef.current) {
      teamSummaryRefreshPendingRef.current = false
      setTeamSummaryDrainTick((n) => n + 1)
    }
  }, [])


  useEffect(() => {
    if (!draftPayrollModalOpen || !canAccessPay) return
    if (payStubPeriodStart > payStubPeriodEnd) return
    const t = setTimeout(() => {
      void loadHoursDaysCorrect(payStubPeriodStart, payStubPeriodEnd)
      mergeCrewJobsForDateRange(payStubPeriodStart, payStubPeriodEnd)
    }, 80)
    return () => {
      clearTimeout(t)
      draftPayrollCrewMergeFetchIdRef.current += 1
    }
  }, [draftPayrollModalOpen, canAccessPay, payStubPeriodStart, payStubPeriodEnd])

  useEffect(() => {
    if (activeTab !== 'hours' || !canAccessHours) return
    const t = setTimeout(() => loadCrewJobsForHoursRange(), 80)
    return () => clearTimeout(t)
  }, [activeTab, hoursDateStart, hoursDateEnd, canAccessHours])

  const loadAllClockSessionsRef = useRef<() => void>()
  loadAllClockSessionsRef.current = () => {
    loadAllClockSessions(hoursDateStart, hoursDateEnd)
  }

  // Fan-out behaviors for the Realtime subscription owned by usePeopleHoursData. Assigned each render
  // (reads the live refresh refs, which are also used by the clock-session mutator callbacks below).
  realtimeCallbacksRef.current.onPeopleHoursChange = () => {
    loadPeopleHoursRef.current?.()
  }
  realtimeCallbacksRef.current.onClockSessionsChange = () => {
    loadAllClockSessionsRef.current?.()
    const snap = draftPayrollRealtimeSnapRef.current
    if (
      snap.draftOpen &&
      snap.activeTab === 'pay_stubs' &&
      snap.canAccessPay &&
      snap.periodStart <= snap.periodEnd
    ) {
      void loadDraftPayrollPendingApprovalsRef.current(snap.periodStart, snap.periodEnd)
    }
  }

  /** Hours matrix blur: open My Time — proportional scale of existing closed sessions, else single draft. Open session → fetch modal + toast. */
  function openManualHoursDraftFromBlur(personName: string, workDate: string, hoursDecimal: number) {
    const u = users.find((x) => (x.name ?? '').trim() === personName.trim())
    if (!u?.id) {
      showToast(
        'No user account matches this roster name — hours saved to the grid only. Link the name to open My Time next time.',
        'error',
      )
      void saveHours(personName, workDate, hoursDecimal)
      setEditingHoursCell(null)
      return
    }
    const dayRows = collectPeopleHoursDaySessionsForScale(
      pendingClockSessions,
      approvedClockSessions,
      u.id,
      workDate,
    )
    if (dayRows.some((r) => !r.clocked_out_at)) {
      showToast(
        'Close open clock sessions before scaling hours from the grid. Edit time is open with live sessions.',
        'info',
      )
      setHoursMyTimeEditor({
        subjectUserId: u.id,
        subjectDisplayName: u.name?.trim() ?? personName,
        dateStr: workDate,
      })
      setEditingHoursCell(null)
      return
    }
    try {
      const mapped = dayRows.map(toDayEditorSession)
      mapped.sort((a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime())
      const scaled = scaleClosedSessionsToTargetHours(mapped, hoursDecimal)
      if (scaled != null && scaled.length > 0) {
        const { jobLabels, bidLabels } = buildJobBidLabelMapsFromClockRows(dayRows, prefixMap)
        setHoursManualDraftEditor({
          subjectUserId: u.id,
          subjectDisplayName: u.name?.trim() ?? personName,
          dateStr: workDate,
          draftSessions: scaled,
          personName,
          jobLabels,
          bidLabels,
        })
      } else {
        const draft = buildPeopleHoursManualDraftSession(workDate, hoursDecimal)
        setHoursManualDraftEditor({
          subjectUserId: u.id,
          subjectDisplayName: u.name?.trim() ?? personName,
          dateStr: workDate,
          draftSessions: [draft],
          personName,
        })
      }
      setEditingHoursCell(null)
    } catch {
      showToast('Could not build draft session for that date.', 'error')
      setEditingHoursCell(null)
    }
  }

  async function addTeam() {
    if (!canAccessPay) return
    const { data, error } = await supabase.from('people_teams').insert({ name: 'New Team', sequence_order: teams.length }).select('id').single()
    if (error) setError(error.message)
    else if (data) setTeams((prev) => [...prev, { id: (data as { id: string }).id, name: 'New Team', members: [] }])
  }

  async function updateTeamName(teamId: string, name: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_teams').update({ name }).eq('id', teamId)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)))
  }

  async function addTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').insert({ team_id: teamId, person_name: personName })
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: [...t.members, personName] } : t)))
  }

  async function removeTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').delete().eq('team_id', teamId).eq('person_name', personName)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: t.members.filter((m) => m !== personName) } : t)))
  }

  async function deleteTeam(teamId: string) {
    if (!canAccessPay) return
    setTeamDeletingId(teamId)
    setError(null)
    const { error } = await supabase.from('people_teams').delete().eq('id', teamId)
    if (error) {
      setError(error.message)
      setTeamDeletingId(null)
      return
    }
    setTeams((prev) => prev.filter((t) => t.id !== teamId))
    setTeamToDelete(null)
    setTeamDeletingId(null)
  }

  function getHoursForPersonDate(personName: string, workDate: string): number {
    const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function getEffectiveHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary) {
      const day = new Date(workDate + 'T12:00:00').getDay()
      if (day === 0 || day === 6) return 0
      return 8
    }
    return getHoursForPersonDate(personName, workDate)
  }

  function canEditHours(personName: string): boolean {
    const cfg = payConfig[personName]
    return !(cfg?.is_salary ?? false) || (cfg?.record_hours_but_salary ?? false)
  }

  function getDisplayHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary && !(cfg?.record_hours_but_salary ?? false)) return getEffectiveHours(personName, workDate)
    return getHoursForPersonDate(personName, workDate)
  }

  /**
   * Pending (unapproved) closed clock sessions on the Hours grid: avoids showing 0 after creating
   * a session from manual entry until approval merges into people_hours. Excludes revoked sessions
   * (which still load via the `approved_at IS NULL AND rejected_at IS NULL` filter because revoke
   * only sets `revoked_at`) so revoked hours drop off the grid as soon as `people_hours` updates.
   */
  function sumClosedPendingClockHoursForPersonDate(personName: string, workDate: string): number {
    const uid = users.find((u) => (u.name ?? '').trim() === personName.trim())?.id
    return sumClosedPendingClockHoursForCell(pendingClockSessions, uid, workDate)
  }

  /** Hours matrix: max(people_hours, pending clock) so manual-offer → session path stays visible; salary-only rows unchanged. */
  function getHoursGridDisplayHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary && !(cfg?.record_hours_but_salary ?? false)) return getEffectiveHours(personName, workDate)
    return Math.max(getHoursForPersonDate(personName, workDate), sumClosedPendingClockHoursForPersonDate(personName, workDate))
  }

  function getCostForPersonDate(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const hrs = getEffectiveHours(personName, workDate)
    return wage * hrs
  }

  function getCostForPersonDateMatrix(personName: string, workDate: string): number {
    if (!showMaxHours) return getCostForPersonDate(personName, workDate)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const day = new Date(workDate + 'T12:00:00').getDay()
    if (day >= 1 && day <= 5) return wage * 8
    return getCostForPersonDate(personName, workDate)
  }

  function getCostForPersonDateTeams(personName: string, workDate: string): number {
    if (!showMaxHoursTeams) return getCostForPersonDate(personName, workDate)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const day = new Date(workDate + 'T12:00:00').getDay()
    if (day >= 1 && day <= 5) return wage * 8
    return getCostForPersonDate(personName, workDate)
  }

  /** Widens Hours tab range if needed so a payroll-modal date can appear as a column (en-CA strings sort chronologically). */
  function ensureHoursRangeIncludesDate(workDate: string) {
    if (workDate < hoursDateStart) setHoursDateStart(workDate)
    if (workDate > hoursDateEnd) setHoursDateEnd(workDate)
  }

  const showPeopleForHours = Object.keys(payConfig)
    .filter((n) => (payConfig[n]?.show_in_hours ?? false) && !archivedUserNames.has(n.trim()))
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
  const showPeopleForMatrixBase = Object.keys(payConfig)
    .filter((n) => (payConfig[n]?.show_in_cost_matrix ?? false) && !archivedUserNames.has(n.trim()))
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })

  const showPeopleForMatrix =
    matrixSortBy === 'cost'
      ? [...showPeopleForMatrixBase].sort((a, b) => {
          const days = getDaysInRange(hoursDateStart, hoursDateEnd)
          const totalA = days.reduce((s, d) => s + getCostForPersonDateMatrix(a, d), 0)
          const totalB = days.reduce((s, d) => s + getCostForPersonDateMatrix(b, d), 0)
          return totalB - totalA
        })
      : matrixSortBy === 'tag'
        ? [...showPeopleForMatrixBase].sort((a, b) => {
            const tagsA = (costMatrixTags[a] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
            const tagsB = (costMatrixTags[b] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
            const firstA = tagsA[0] ?? 'zzz'
            const firstB = tagsB[0] ?? 'zzz'
            return firstA.localeCompare(firstB) || a.localeCompare(b)
          })
        : [...showPeopleForMatrixBase].sort((a, b) => a.localeCompare(b))


  /**
   * Unpaid pay-stub rows surfaced into the Payroll Forecast modal.
   * Same net-pay math the Ledger summary uses, but emits one row per
   * stub instead of aggregate counts. Sorted by oldest balance first
   * so the most urgent obligations show at the top of the table — the
   * forecast UX is "which old balances will this incoming bar cover?"
   */
  const forecastUnpaidRows = useMemo<PayrollForecastUnpaidRow[]>(() => {
    const rows: PayrollForecastUnpaidRow[] = []
    for (const stub of payStubs) {
      const payRows = payStubPaymentsByStubId[stub.id] ?? []
      const paidSum = sumPayStubPaymentAmounts(payRows)
      const lessSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? [])
      const addSumLedger = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? [])
      const netPayLedger = stubNetPay(stub.gross_pay, lessSum, addSumLedger)
      if (isPayStubFullyPaid(netPayLedger, paidSum)) continue
      const rem = remainingPayStubBalance(netPayLedger, paidSum)
      if (rem <= 0) continue
      rows.push({
        stubId: stub.id,
        personName: stub.person_name,
        // `period_end` reads naturally as "balance from this date" — it
        // marks when the work was complete and the obligation crystallized.
        balanceCreatedYmd: stub.period_end,
        remaining: rem,
      })
    }
    rows.sort((a, b) => {
      if (a.balanceCreatedYmd !== b.balanceCreatedYmd) {
        return a.balanceCreatedYmd < b.balanceCreatedYmd ? -1 : 1
      }
      return a.personName.localeCompare(b.personName)
    })
    return rows
  }, [
    payStubs,
    payStubPaymentsByStubId,
    payStubDeductionsByStubId,
    payStubAdditionalByStubId,
  ])

  const teamsFiltered = useMemo(
    () =>
      teams.map((t) => ({
        ...t,
        members: t.members.filter((m) => !archivedUserNames.has(m.trim())),
      })),
    [teams, archivedUserNames]
  )


  function shiftHoursWeek(delta: number) {
    const dStart = new Date(hoursDateStart + 'T12:00:00')
    const dEnd = new Date(hoursDateEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setHoursDateStart(dStart.toLocaleDateString('en-CA'))
    setHoursDateEnd(dEnd.toLocaleDateString('en-CA'))
  }

  /** Prior full Sun–Sat week from local today (en-CA), for Draft Payroll default period. */
  function getPriorWeekPayStubRangeEnCa(): { periodStart: string; periodEnd: string } {
    const d = new Date()
    const day = d.getDay()
    const sundayThisWeek = new Date(d)
    sundayThisWeek.setDate(d.getDate() - day)
    const priorSunday = new Date(sundayThisWeek)
    priorSunday.setDate(sundayThisWeek.getDate() - 7)
    const priorSaturday = new Date(priorSunday)
    priorSaturday.setDate(priorSunday.getDate() + 6)
    return {
      periodStart: priorSunday.toLocaleDateString('en-CA'),
      periodEnd: priorSaturday.toLocaleDateString('en-CA'),
    }
  }

  function shiftPayStubWeek(delta: number) {
    const dStart = new Date(payStubPeriodStart + 'T12:00:00')
    const dEnd = new Date(payStubPeriodEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setPayStubPeriodStart(dStart.toLocaleDateString('en-CA'))
    setPayStubPeriodEnd(dEnd.toLocaleDateString('en-CA'))
  }

  /** Align Hours tab range with Draft Payroll period so pending sessions match the banner count. */
  function openHoursForDraftPayrollPeriod(periodStart: string, periodEnd: string) {
    if (!canAccessHours) return
    if (periodStart <= periodEnd) {
      setHoursDateStart(periodStart)
      setHoursDateEnd(periodEnd)
    }
    setDraftPayrollModalOpen(false)
    setActiveTab('hours')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'hours')
      return next
    })
  }

  function navigateToHoursForReviewDate(workDate: string, personName: string) {
    ensureHoursRangeIncludesDate(workDate)
    setHoursFocusRequest({ workDate, personName })
    setActiveTab('hours')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'hours')
      return next
    })
  }

  const hoursDays = getDaysInRange(hoursDateStart, hoursDateEnd)
  const matrixDays = hoursDays

  const pendingUnapprovedCountByWorkDate = useMemo(
    () => pendingUnapprovedCountsByWorkDate(pendingClockSessions),
    [pendingClockSessions],
  )

  /** People → Hours: per-cell pending closed sessions where pending hours > saved people_hours. Drives the amber badge, column dot, person row total badge, and roll-up pill. */
  const peopleHoursPendingByCellMap = useMemo(
    () =>
      buildPeopleHoursPendingByCellMap({
        pendingClockSessions,
        peopleHours,
        peopleNames: showPeopleForHours,
        workDates: hoursDays,
        users,
        isSalaryOnly: (name) => !canEditHours(name),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingClockSessions, peopleHours, showPeopleForHours, hoursDays, users, payConfig],
  )
  const peopleHoursPendingSummary = useMemo(
    () => summarizePeopleHoursPendingByCell(peopleHoursPendingByCellMap),
    [peopleHoursPendingByCellMap],
  )

  /** Refresh / dismiss the per-cell pending popover when the underlying data changes (post-approve / post-reject). */
  useEffect(() => {
    if (!pendingCellPopover) return
    const key = pendingByCellKey(
      pendingCellPopover.entry.personName,
      pendingCellPopover.entry.workDate,
    )
    const next = peopleHoursPendingByCellMap.get(key)
    if (!next) {
      setPendingCellPopover(null)
      return
    }
    if (next !== pendingCellPopover.entry) {
      setPendingCellPopover((prev) => (prev ? { ...prev, entry: next } : prev))
    }
  }, [peopleHoursPendingByCellMap, pendingCellPopover])
  /** Close bulk approve modal when nothing is pending anymore. */
  useEffect(() => {
    if (bulkApprovePendingOpen && peopleHoursPendingSummary.totalSessions === 0) {
      setBulkApprovePendingOpen(false)
    }
  }, [bulkApprovePendingOpen, peopleHoursPendingSummary.totalSessions])

  const { jobHighlightPeople, jobHighlightCells } = useMemo(() => {
    const people = new Set<string>()
    const cells = new Set<string>()
    const jobId = selectedJobHighlight?.id
    if (!jobId) {
      return { jobHighlightPeople: people, jobHighlightCells: cells }
    }
    for (const personName of showPeopleForHours) {
      for (const d of hoursDays) {
        const key = `${d}:${personName}`
        const row = crewJobsByDatePerson[key]
        const unified = row?.unifiedAssignments ?? []
        if (unified.some((a) => a.type === 'job' && a.id === jobId)) {
          people.add(personName)
          cells.add(`${personName}:${d}`)
        }
      }
    }
    return { jobHighlightPeople: people, jobHighlightCells: cells }
  }, [selectedJobHighlight?.id, hoursDays, showPeopleForHours, crewJobsByDatePerson])

  function hasAssignmentsForDate(personName: string, workDate: string): boolean {
    const key = `${workDate}:${personName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return false
    return (row.unifiedAssignments?.length ?? 0) > 0
  }

  function isCorrectDayMissingJob(personName: string, workDate: string): boolean {
    if (!hoursDaysCorrect.has(workDate)) return false
    const hours = getDisplayHours(personName, workDate)
    if (hours <= 0) return false
    return !hasAssignmentsForDate(personName, workDate)
  }

  function getRunPayrollReviewDayItems(
    personName: string,
    periodDays: string[]
  ): Array<{ workDate: string; issue: 'not_correct' | 'missing_job' }> {
    const items: Array<{ workDate: string; issue: 'not_correct' | 'missing_job' }> = []
    for (const d of periodDays) {
      if (!hoursDaysCorrect.has(d)) {
        items.push({ workDate: d, issue: 'not_correct' })
      } else if (isCorrectDayMissingJob(personName, d)) {
        items.push({ workDate: d, issue: 'missing_job' })
      }
    }
    items.sort((a, b) => a.workDate.localeCompare(b.workDate))
    return items
  }

  function hasUnassignedCorrectDays(personName: string): boolean {
    return hoursDays.some((d) => isCorrectDayMissingJob(personName, d))
  }

  const canEditUserNotes = authUserRole !== null && ['dev', 'master_technician', 'assistant'].includes(authUserRole)
  const canCreatePeopleInRoster = canEditUserNotes
  const showSalariedWorkdaysHoursButton = canEditUserNotes && activeTab === 'hours' && canAccessHours

  const writeupUserSelectOptions = useMemo(
    () =>
      [...users]
        .filter((u) => (u.name ?? '').trim().length > 0)
        .map((u) => ({ value: u.id, label: u.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users]
  )

  if (loading) return <p>Loading...</p>

  return (
    <div>
      {hoursGridFirstColMeasurer}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {isDev && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('review')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'review')
                return next
              })
            }}
            style={tabStyle(activeTab === 'review')}
          >
            Review
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setActiveTab('users')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'users')
              return next
            })
          }}
          style={tabStyle(activeTab === 'users')}
        >
          Users
        </button>
        {canAccessTeamsTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('teams')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'teams')
                return next
              })
            }}
            style={tabStyle(activeTab === 'teams')}
          >
            Teams
          </button>
        )}
        {canAccessOverheadTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('overhead')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'overhead')
                return next
              })
            }}
            style={tabStyle(activeTab === 'overhead')}
          >
            Overhead
          </button>
        )}
        {(canAccessTeamsTab || canAccessOverheadTab) && canOpenHoursTab ? (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              color: '#d1d5db',
              fontWeight: 400,
              padding: '0 0.35rem',
              userSelect: 'none',
            }}
          >
            |
          </span>
        ) : null}
        {canOpenHoursTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('hours')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'hours')
                return next
              })
            }}
            style={tabStyle(activeTab === 'hours')}
          >
            Hours
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('pay_stubs')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'pay_stubs')
                return next
              })
            }}
            style={tabStyle(activeTab === 'pay_stubs')}
          >
            Payroll
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('offsets')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'offsets')
                return next
              })
            }}
            style={tabStyle(activeTab === 'offsets')}
          >
            Offsets
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('vehicles')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'vehicles')
                return next
              })
            }}
            style={tabStyle(activeTab === 'vehicles')}
          >
            Vehicles
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('housing')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'housing')
                return next
              })
            }}
            style={tabStyle(activeTab === 'housing')}
          >
            Housing
          </button>
        )}
        {canAccessPay && canAccessLicenses ? (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              color: '#d1d5db',
              fontWeight: 400,
              padding: '0 0.35rem',
              userSelect: 'none',
            }}
          >
            |
          </span>
        ) : null}
        {canAccessLicenses && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('licenses')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'licenses')
                return next
              })
            }}
            style={tabStyle(activeTab === 'licenses')}
          >
            Licenses
          </button>
        )}
        {canAccessContracts && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('contracts')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'contracts')
                return next
              })
            }}
            style={tabStyle(activeTab === 'contracts')}
          >
            Contracts
          </button>
        )}
        {canAccessContracts && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('writeups')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'writeups')
                return next
              })
            }}
            style={tabStyle(activeTab === 'writeups')}
          >
            Writeups
          </button>
        )}
        {isDev && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('feedback')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'feedback')
                return next
              })
            }}
            style={tabStyle(activeTab === 'feedback')}
          >
            Feedback
          </button>
        )}
        {canSeeActivityTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('activity')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'activity')
                return next
              })
            }}
            style={tabStyle(activeTab === 'activity')}
          >
            Activity
          </button>
        )}
          </div>
        </div>
        <h1 style={{ flexShrink: 0, margin: 0, marginLeft: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>People</h1>
      </div>

      {activeTab === 'users' && (
        <PeopleUsersTab
          isDev={isDev}
          narrowViewport={narrowViewport}
          users={users}
          people={people}
          error={error}
          setError={setError}
          contractSigningStatusByPersonName={contractSigningStatusByPersonName}
          canAccessContracts={canAccessContracts}
          canSeePushStatus={canSeePushStatus}
          pushEnabledUserIds={pushEnabledUserIds}
          locationEnabledUserIds={locationEnabledUserIds}
          canEditUserNotes={canEditUserNotes}
          canCreatePeopleInRoster={canCreatePeopleInRoster}
          authUserId={authUser?.id}
          creatorNames={creatorNames}
          personProjects={personProjects}
          archivedPeople={archivedPeople}
          usersTabTags={usersTabTags}
          showToast={showToast}
          setEditingUserNote={setEditingUserNote}
          openAdd={openAdd}
          openEdit={openEdit}
          archivePerson={archivePerson}
          archivingId={archivingId}
          restorePerson={restorePerson}
          restoringId={restoringId}
          isAlreadyUser={isAlreadyUser}
          invitingId={invitingId}
          setInviteConfirm={setInviteConfirm}
          loggingInAsId={loggingInAsId}
          setLoggingInAsId={setLoggingInAsId}
          externalSubProjectsExpanded={externalSubProjectsExpanded}
          setExternalSubProjectsExpanded={setExternalSubProjectsExpanded}
          archivedSectionOpen={archivedSectionOpen}
          setArchivedSectionOpen={setArchivedSectionOpen}
        />
      )}

      {activeTab === 'teams' && canAccessTeamsTab && authUser?.id ? (
        <PeopleTeamsTab authUserId={authUser.id} authUserRole={authRole ?? authUserRole} />
      ) : null}

      {activeTab === 'overhead' && canAccessOverheadTab && (
        <PeopleOverheadTab
          payConfig={payConfig}
          authUser={authUser}
          setError={setError}
          canAccessOverheadTab={canAccessOverheadTab}
          isDev={isDev}
          loadPayConfig={loadPayConfig}
        />
      )}

      {activeTab === 'pay_stubs' && canAccessPay && (
        <PeoplePayStubsTab
          payStubs={payStubs}
          payStubPaymentsByStubId={payStubPaymentsByStubId}
          payStubDeductionsByStubId={payStubDeductionsByStubId}
          payStubAdditionalByStubId={payStubAdditionalByStubId}
          payConfig={payConfig}
          users={users}
          authUser={authUser}
          isDev={isDev}
          error={error}
          onError={setError}
          loadPayStubs={loadPayStubs}
          loadPayConfig={loadPayConfig}
          onPrintStub={printPayStub}
          onRecordPayment={openPayStubMarkPaidModal}
          markingPayStubId={markingPayStubId}
          onRequestDeleteStub={(stub) => setPayStubDeleteConfirm(stub)}
          deletingPayStubId={deletingPayStubId}
          onOpenMyTimeForDay={({ dateStr, subjectUserId, subjectDisplayName }) =>
            setHoursMyTimeEditor({ dateStr, subjectUserId, subjectDisplayName })
          }
          onOpenForecast={() => setForecastModalOpen(true)}
          forecastDisabled={forecastUnpaidRows.length === 0}
          onOpenDraftPayroll={() => {
            const { periodStart, periodEnd } = getPriorWeekPayStubRangeEnCa()
            setPayStubPeriodStart(periodStart)
            setPayStubPeriodEnd(periodEnd)
            setDraftPayrollModalOpen(true)
          }}
          draftPayrollDisabled={showPeopleForHours.length === 0}
        />
      )}

      {payStubDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL_NESTED }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Delete this pay report for {payStubDeleteConfirm.person_name} ({new Date(payStubDeleteConfirm.period_start + 'T12:00:00').toLocaleDateString()} – {new Date(payStubDeleteConfirm.period_end + 'T12:00:00').toLocaleDateString()})? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPayStubDeleteConfirm(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPayStubId === payStubDeleteConfirm.id}
                onClick={() => deletePayStub(payStubDeleteConfirm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: deletingPayStubId !== payStubDeleteConfirm.id ? '#dc2626' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingPayStubId !== payStubDeleteConfirm.id ? 'pointer' : 'not-allowed',
                }}
              >
                {deletingPayStubId === payStubDeleteConfirm.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payStubMarkPaidTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL_NESTED }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 440, width: '100%' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Record payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {payStubMarkPaidTarget.person_name} · Gross ${formatCurrency(payStubMarkPaidTarget.gross_pay)}
              {` · Net Pay $${formatCurrency(
                stubNetPay(
                  payStubMarkPaidTarget.gross_pay,
                  sumPayStubDeductionAmounts(payStubDeductionsByStubId[payStubMarkPaidTarget.id] ?? []),
                  sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubMarkPaidTarget.id] ?? []),
                ),
              )}`}{' '}
              · Remaining $
              {formatCurrency(
                remainingPayStubBalance(
                  stubNetPay(
                    payStubMarkPaidTarget.gross_pay,
                    sumPayStubDeductionAmounts(payStubDeductionsByStubId[payStubMarkPaidTarget.id] ?? []),
                    sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubMarkPaidTarget.id] ?? []),
                  ),
                  sumPayStubPaymentAmounts(payStubPaymentsByStubId[payStubMarkPaidTarget.id]),
                ),
              )}
            </p>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Amount paid</span>
              <input
                type="text"
                inputMode="decimal"
                value={payStubMarkPaidAmount}
                onChange={(e) => setPayStubMarkPaidAmount(e.target.value)}
                placeholder="0.00"
                style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', maxWidth: 200 }}
              />
            </label>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.4 }}>
              <strong>Confirm</strong> records up to the <strong>remaining balance</strong> shown above from this amount (partial payments allowed). If you paid more than the remainder, use <strong>Record employee credit…</strong> below; it opens <strong>Add offset</strong> on top of this dialog so you can save the excess without leaving this flow.
            </p>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Paid date (sent)</span>
              <input
                type="date"
                value={payStubMarkPaidDate}
                onChange={(e) => setPayStubMarkPaidDate(e.target.value)}
                style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', maxWidth: 200 }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Note (optional)</span>
              <textarea
                value={payStubMarkPaidNote}
                onChange={(e) => setPayStubMarkPaidNote(e.target.value)}
                rows={3}
                placeholder="e.g. check #, Venmo, GL code…"
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </label>
            {(() => {
              const stub = payStubMarkPaidTarget
              const paidSoFar = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
              const rem = remainingPayStubBalance(
                stubNetPay(
                  stub.gross_pay,
                  sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? []),
                  sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? []),
                ),
                paidSoFar,
              )
              const parsedPaid = parseFloat(payStubMarkPaidAmount.trim().replace(/,/g, ''))
              if (!Number.isFinite(parsedPaid) || parsedPaid <= rem + PAY_STUB_PAY_FULLY_TOLERANCE) return null
              const excess = Math.round((parsedPaid - rem) * 100) / 100
              return (
                <div
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.45 }}>
                    You entered <strong>${formatCurrency(parsedPaid)}</strong>, which is more than the remaining balance (<strong>${formatCurrency(rem)}</strong>).{' '}
                    <strong>Confirm</strong> will apply <strong>${formatCurrency(rem)}</strong> to this pay report.{' '}
                    <strong>Excess:</strong> ${formatCurrency(excess)} — use the button below to open <strong>Add offset</strong> (employee credit) on top of this dialog (optional; you can confirm the payment first).
                  </p>
                  <button
                    type="button"
                    onClick={openEmployeeCreditFromRecordPayment}
                    disabled={markingPayStubId === payStubMarkPaidTarget.id}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.875rem',
                      background: markingPayStubId === payStubMarkPaidTarget.id ? '#9ca3af' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: markingPayStubId === payStubMarkPaidTarget.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Record employee credit…
                  </button>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closePayStubMarkPaidModal}
                disabled={markingPayStubId === payStubMarkPaidTarget.id}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: markingPayStubId === payStubMarkPaidTarget.id ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={markingPayStubId === payStubMarkPaidTarget.id}
                onClick={() => void confirmPayStubMarkPaid()}
                style={{
                  padding: '0.5rem 1rem',
                  background: markingPayStubId !== payStubMarkPaidTarget.id ? '#059669' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: markingPayStubId !== payStubMarkPaidTarget.id ? 'pointer' : 'not-allowed',
                }}
              >
                {markingPayStubId === payStubMarkPaidTarget.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {forecastModalOpen && activeTab === 'pay_stubs' && canAccessPay && (
        <PayrollForecastModal
          open
          onClose={() => setForecastModalOpen(false)}
          unpaidRows={forecastUnpaidRows}
          zIndex={Z_PEOPLE_PAY_MODAL}
        />
      )}

      {draftPayrollModalOpen && activeTab === 'pay_stubs' && canAccessPay && (
        <DraftPayrollModal
          open
          onClose={() => setDraftPayrollModalOpen(false)}
          zIndex={Z_PEOPLE_PAY_MODAL}
          periodStart={payStubPeriodStart}
          periodEnd={payStubPeriodEnd}
          onChangePeriodStart={setPayStubPeriodStart}
          onChangePeriodEnd={setPayStubPeriodEnd}
          onShiftWeek={shiftPayStubWeek}
          bulkGenerating={bulkGeneratingPayStubs}
          pendingLoading={draftPayrollPendingApprovalLoading}
          pendingError={draftPayrollPendingApprovalError}
          pendingCount={draftPayrollPendingApprovalCount}
          canAccessHours={canAccessHours}
          onOpenHoursForPeriod={openHoursForDraftPayrollPeriod}
          peopleNames={showPeopleForHours}
          payStubs={payStubs}
          payStubPaymentsByStubId={payStubPaymentsByStubId}
          payStubDeductionsByStubId={payStubDeductionsByStubId}
          payStubAdditionalByStubId={payStubAdditionalByStubId}
          getCostForPersonDate={getCostForPersonDate}
          getEffectiveHours={getEffectiveHours}
          getRunPayrollReviewDayItems={getRunPayrollReviewDayItems}
          onBulkGenerateRemaining={bulkGenerateMissingPayStubsInModal}
          onGenerateReport={async (person) => {
            setGeneratingPayStubPerson(person)
            setError(null)
            await generatePayStub(person)
            setGeneratingPayStubPerson(null)
          }}
          onViewStub={(stub) => void viewPayStub(stub)}
          onRecordPayment={openPayStubMarkPaidModal}
          canDeletePayReports={isDev}
          onRequestDeleteStub={(stub) => setPayStubDeleteConfirm(stub)}
          deletingPayStubId={deletingPayStubId}
          markingPayStubId={markingPayStubId}
          generatingPayStubPerson={generatingPayStubPerson}
          showToast={showToast}
          onNavigateToHoursForReviewDate={navigateToHoursForReviewDate}
          onOpenHoursBreakdown={(name) => setDraftPayrollHoursBreakdownPerson(name)}
        />
      )}

      {draftPayrollHoursBreakdownPerson &&
      draftPayrollModalOpen &&
      activeTab === 'pay_stubs' &&
      canAccessPay ? (
        <DraftPayrollPersonHoursBreakdownModal
          open
          personName={draftPayrollHoursBreakdownPerson}
          periodStart={payStubPeriodStart}
          periodEnd={payStubPeriodEnd}
          hourlyWage={Number(payConfig[draftPayrollHoursBreakdownPerson]?.hourly_wage ?? 0)}
          isSalary={payConfig[draftPayrollHoursBreakdownPerson]?.is_salary ?? false}
          zIndex={Z_PEOPLE_DRAFT_PAYROLL_HOURS_BREAKDOWN}
          onClose={() => setDraftPayrollHoursBreakdownPerson(null)}
        />
      ) : null}


      {activeTab === 'hours' && canOpenHoursTab && (
        <>
        <div>
          {hoursTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {canAccessPay ? (
            <>
              <div
                id="people-hours-pay-tools"
                style={{
                  ...HOURS_TAB_SECTION_ANCHOR_STYLE,
                  marginBottom: HOURS_TAB_SECTIONS_STACK_GAP,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setReviewHoursModalOpen(true)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Review Hours <span style={{ color: '#059669' }}>✓</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayConfigModalOpen(true)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      margin: 0,
                      marginLeft: 'auto',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: '#f9fafb',
                      cursor: 'pointer',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                    }}
                  >
                    People pay config
                  </button>
                </div>
              </div>
              <PeoplePayConfigModal
                open={payConfigModalOpen}
                onClose={() => setPayConfigModalOpen(false)}
                rosterSections={payConfigRosterSections}
                payConfig={payConfig}
                payConfigDraft={payConfigDraft}
                payConfigSaving={payConfigSaving}
                isDev={isDev}
                salaryTemplateByPersonName={salaryTemplateByPersonName}
                onUpsertPayConfig={upsertPayConfig}
                onHourlyWageChange={updatePayConfigHourlyWage}
              />
              {reviewHoursModalOpen ? (
                <ReviewHoursModal
                  people={showPeopleForMatrix}
                  initialPersonIndex={0}
                  initialStartDate={hoursDateStart}
                  initialEndDate={hoursDateEnd}
                  hoursRowsForPerson={(p) =>
                    peopleHours.filter((h) => h.person_name === p).map((h) => ({ work_date: h.work_date, hours: h.hours }))
                  }
                  canAddToJob={canAccessPay}
                  canMarkReviewed={canAccessPay}
                  onReviewedChange={() => void loadHoursReviewed()}
                  onClose={() => setReviewHoursModalOpen(false)}
                />
              ) : null}
            </>
          ) : null}
          <div style={HOURS_TAB_SECTIONS_STACK}>
          <div
            id="people-hours-sections-nav"
            role="navigation"
            aria-label="Hours sections"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {canAccessHours ? (
              <button type="button" onClick={() => jumpToHoursTabSection('clockStrip')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Clock strip
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => jumpToHoursTabSection('week')}
              style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Week
            </button>
            {canAccessHours ? (
              <button type="button" onClick={() => jumpToHoursTabSection('grid')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Hours grid
              </button>
            ) : null}
            {canAccessHours ? (
              <button type="button" onClick={() => jumpToHoursTabSection('sessions')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Sessions
              </button>
            ) : null}
            {canAccessPay || canViewCostMatrixShared ? (
              <button type="button" onClick={() => jumpToHoursTabSection('dueSummaries')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Due totals
              </button>
            ) : null}
            {canAccessPay || canViewCostMatrixShared ? (
              <button type="button" onClick={() => jumpToHoursTabSection('costMatrix')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Cost matrix
              </button>
            ) : null}
            {canAccessPay || canViewCostMatrixShared ? (
              <button type="button" onClick={() => jumpToHoursTabSection('teams')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Teams
              </button>
            ) : null}
            {isDev || canAccessPay ? (
              <button type="button" onClick={() => jumpToHoursTabSection('sharing')} style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f3f4f6', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Sharing / tags
              </button>
            ) : null}
          </div>
          {canAccessHours ? (
          <section id="people-hours-clock-strip" style={HOURS_TAB_SECTION_SHELL}>
            <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.clockStrip)}>
              <button
                type="button"
                aria-expanded={hoursTabSectionsOpen.clockStrip}
                onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, clockStrip: !p.clockStrip }))}
                style={HOURS_TAB_SECTION_TOGGLE_BTN}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.clockStrip ? '▼' : '▶'}</span>
                Currently clocked in
              </button>
            </div>
            {hoursTabSectionsOpen.clockStrip ? <PeopleHoursDashboardClockStrip onSessionsChanged={() => loadAllClockSessionsRef.current?.()} /> : null}
          </section>
          ) : null}
          <PeopleHoursWeekRange
            narrowViewport={narrowViewport}
            hoursDateStart={hoursDateStart}
            hoursDateEnd={hoursDateEnd}
            setHoursDateStart={setHoursDateStart}
            setHoursDateEnd={setHoursDateEnd}
            shiftHoursWeek={shiftHoursWeek}
          />
          {canAccessHours && (
          <>
          <section id="people-hours-grid" style={HOURS_TAB_SECTION_SHELL}>
            <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.grid)}>
              <button
                type="button"
                aria-expanded={hoursTabSectionsOpen.grid}
                onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, grid: !p.grid }))}
                style={HOURS_TAB_SECTION_TOGGLE_BTN}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.grid ? '▼' : '▶'}</span>
                Hours grid
              </button>
            </div>
            {hoursTabSectionsOpen.grid ? (
            <>
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No people with Show in Hours selected. In Hours, open People pay config and check Show in Hours for people to track.</p>
          ) : (
            <>
              <PeopleHoursGridJobHighlight
                selectedJobHighlight={selectedJobHighlight}
                setSelectedJobHighlight={setSelectedJobHighlight}
              />
              {selectedJobHighlight && jobHighlightPeople.size === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                  No one in this list has that job on crew assignments this week.
                </p>
              ) : null}
              <PeopleHoursPendingBanner
                summary={peopleHoursPendingSummary}
                canAccessHours={canAccessHours}
                canAccessPay={canAccessPay}
                onReviewApprove={() => setBulkApprovePendingOpen(true)}
              />
              <div ref={hoursTableScrollRef} style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: hoursGridFirstColW }} />
                  {hoursDays.map((d) => (
                    <col key={d} style={{ width: 72 }} />
                  ))}
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th
                      style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        borderBottom: '1px solid #e5e7eb',
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        background: '#f9fafb',
                        boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                        maxWidth: hoursGridFirstColW,
                        minWidth: 0,
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                    >
                      Person
                    </th>
                    {hoursDays.map((d) => {
                      const dayHasPending = workDateHasAnyPendingExcess(peopleHoursPendingByCellMap, d)
                      return (
                        <th
                          key={d}
                          id={`people-hours-col-${d}`}
                          style={{
                            padding: '0.5rem 0.5rem',
                            textAlign: 'right',
                            borderBottom: '1px solid #e5e7eb',
                            ...(hoursFlashWorkDate === d
                              ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                              : {}),
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              justifyContent: 'flex-end',
                            }}
                          >
                            {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                            {dayHasPending ? (
                              <span
                                aria-label="Some people have pending hours on this day not yet in payroll"
                                title="Some people have pending hours on this day not yet in payroll"
                                style={{
                                  display: 'inline-block',
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: '#f59e0b',
                                  boxShadow: '0 0 0 1px rgba(146,64,14,0.35)',
                                }}
                              />
                            ) : null}
                          </span>
                        </th>
                      )
                    })}
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>HH:MM:SS</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForHours.map((personName, idx) => {
                    const isUnassigned = hasUnassignedCorrectDays(personName)
                    const isClickable = isUnassigned && canEditCrewJobs
                    return (
                      <tr
                        key={personName}
                        data-hours-person={personName}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          ...(isClickable && { cursor: 'pointer' }),
                          ...(jobHighlightPeople.has(personName)
                            ? { backgroundColor: 'rgba(219, 234, 254, 0.45)' }
                            : {}),
                          ...(hoursFlashPersonName === personName
                            ? {
                                backgroundColor: 'rgba(254, 243, 199, 0.25)',
                                boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.45)',
                              }
                            : {}),
                        }}
                        onClick={isClickable ? () => setHoursUnassignedModal({ personName }) : undefined}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={isClickable ? (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            setHoursUnassignedModal({ personName })
                          }
                        } : undefined}
                      >
                        <td
                          style={{
                            padding: '0.5rem 0.75rem',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            background:
                              hoursFlashPersonName === personName
                                ? 'rgba(254, 243, 199, 0.35)'
                                : jobHighlightPeople.has(personName)
                                  ? 'rgba(219, 234, 254, 0.75)'
                                  : 'white',
                            boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            maxWidth: hoursGridFirstColW,
                            minWidth: 0,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'up') }}
                                disabled={idx === 0}
                                title="Move up"
                                style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'down') }}
                                disabled={idx === showPeopleForHours.length - 1}
                                title="Move down"
                                style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                              >
                                ▼
                              </button>
                            </span>
                            <span style={{ minWidth: 0 }}>{personName}</span>
                          </div>
                        </td>
                        {hoursDays.map((d) => {
                          const dayLocked = hoursDaysCorrect.has(d)
                          const canEdit = canEditHours(personName)
                          const missingJob = isCorrectDayMissingJob(personName, d)
                          const missingJobTitle = 'Correct day with hours but no job assignment — assign in Crew Jobs / Bids'
                          const gridDisplayHrs = getHoursGridDisplayHours(personName, d)
                          const hoursRowUser = users.find((x) => (x.name ?? '').trim() === personName.trim())
                          const showMyTimeCorner = gridDisplayHrs > 0 && !!hoursRowUser?.id
                          const pendingEntry = peopleHoursPendingByCellMap.get(pendingByCellKey(personName, d))
                          const showPendingBadge = !!pendingEntry && (canAccessHours || canAccessPay)
                          return (
                            <td
                              key={d}
                              title={missingJob ? missingJobTitle : undefined}
                              style={{
                                padding: '0.35rem 0.5rem',
                                textAlign: canEdit ? 'right' : 'center',
                                ...(showMyTimeCorner || showPendingBadge ? { position: 'relative' } : {}),
                                ...(missingJob && {
                                  background: 'rgba(254, 242, 242, 0.9)',
                                  boxShadow: 'inset 0 0 0 1px rgba(252, 165, 165, 0.45)',
                                  borderRadius: 8,
                                }),
                                ...(jobHighlightCells.has(`${personName}:${d}`) && !missingJob
                                  ? {
                                      backgroundColor: 'rgba(219, 234, 254, 0.35)',
                                      boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.25)',
                                    }
                                  : {}),
                                ...(showPendingBadge && !missingJob
                                  ? {
                                      backgroundColor: 'rgba(254, 243, 199, 0.55)',
                                      boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.55)',
                                      borderRadius: 8,
                                    }
                                  : {}),
                                ...(hoursFlashWorkDate === d
                                  ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                                  : {}),
                              }}
                            >
                              {!canEdit ? (
                                <span style={{ color: '#6b7280' }}>{decimalToHms(gridDisplayHrs) || '-'}</span>
                              ) : dayLocked ? (
                                canEdit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setHoursDayAuditModal({ personName, workDate: d })
                                    }}
                                    title="Day marked Correct — click to view clock sessions and job assignments"
                                    style={{
                                      color: '#6b7280',
                                      cursor: 'pointer',
                                      width: '100%',
                                      textAlign: 'right',
                                      padding: '0.15rem 0',
                                      border: 'none',
                                      background: 'none',
                                      font: 'inherit',
                                    }}
                                  >
                                    {decimalToHms(gridDisplayHrs) || '-'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#6b7280' }} title="Day marked Correct — locked">
                                    {decimalToHms(gridDisplayHrs) || '-'}
                                  </span>
                                )
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(gridDisplayHrs)}
                                  placeholder="-"
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => {
                                    setEditingHoursCell({ personName, workDate: d })
                                    setEditingHoursValue(decimalToHms(gridDisplayHrs) || '')
                                    e.target.select()
                                  }}
                                  onChange={(e) => setEditingHoursValue(e.target.value)}
                                  onBlur={() => {
                                    const v = hmsToDecimal(editingHoursValue)
                                    const shouldOfferManualSession = shouldOfferManualHoursSession({
                                      hoursDecimal: v,
                                      canAccessHours,
                                      canAccessPay,
                                      canEditHours: canEditHours(personName),
                                      dayIsMarkedCorrect: hoursDaysCorrect.has(d),
                                    })
                                    if (shouldOfferManualSession) {
                                      openManualHoursDraftFromBlur(personName, d, v)
                                      return
                                    }
                                    void saveHours(personName, d, v)
                                    setEditingHoursCell(null)
                                  }}
                                  style={{ width: 72, padding: '0.25rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                                />
                              )}
                              {showMyTimeCorner ? (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    bottom: 0,
                                    width: 24,
                                    height: 24,
                                    zIndex: 6,
                                    pointerEvents: 'none',
                                  }}
                                >
                                  <button
                                    type="button"
                                    aria-label={`Open My Time for ${personName} on ${d}`}
                                    title="Open My Time for this person and day"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openHoursMyTimeForGridCell(personName, d)
                                    }}
                                    style={{
                                      pointerEvents: 'auto',
                                      width: '100%',
                                      height: '100%',
                                      padding: 0,
                                      margin: 0,
                                      border: 'none',
                                      cursor: 'pointer',
                                      clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                                      background: '#0f766e',
                                      color: '#fff',
                                      fontSize: '0.85rem',
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      display: 'flex',
                                      alignItems: 'flex-end',
                                      justifyContent: 'flex-start',
                                      paddingLeft: 3,
                                      paddingBottom: 2,
                                      fontFamily: 'inherit',
                                      boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                                    }}
                                  >
                                    {'\u2022'}
                                  </button>
                                </div>
                              ) : null}
                              {showPendingBadge && pendingEntry ? (
                                <button
                                  type="button"
                                  aria-label={`${pendingEntry.count} pending session${pendingEntry.count === 1 ? '' : 's'} for ${personName} on ${d} — adds ${pendingEntry.diffHours.toFixed(2)} hours to payroll. Click to review and approve.`}
                                  title={`+${pendingEntry.diffHours.toFixed(2)} h pending — click to approve`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const target = e.currentTarget
                                    setPendingCellPopover((prev) => {
                                      if (
                                        prev &&
                                        prev.entry.personName === pendingEntry.personName &&
                                        prev.entry.workDate === pendingEntry.workDate
                                      ) {
                                        return null
                                      }
                                      return { anchorEl: target, entry: pendingEntry }
                                    })
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    zIndex: 7,
                                    height: 16,
                                    padding: '0 5px',
                                    border: '1px solid rgba(217,119,6,0.55)',
                                    background: '#fbbf24',
                                    color: '#78350f',
                                    borderRadius: 9999,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                  }}
                                >
                                  <span aria-hidden>!</span>
                                  {pendingEntry.count}
                                </button>
                              ) : null}
                            </td>
                          )
                        })}
                        {(() => {
                          const personPendingHours = personPendingExcessHours(peopleHoursPendingByCellMap, personName)
                          return (
                            <>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                {decimalToHms(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)) || '-'}
                                {personPendingHours > 0 ? (
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      color: '#92400e',
                                      lineHeight: 1.1,
                                      marginTop: 1,
                                    }}
                                    title={`${personPendingHours.toFixed(2)} h on this row are pending and not yet in payroll`}
                                  >
                                    +{personPendingHours.toFixed(2)} pending
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                {(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)).toFixed(2)}
                              </td>
                            </>
                          )
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                  {(() => {
                    const grandTotal = showPeopleForHours.reduce((s, p) => s + hoursDays.reduce((ds, d) => ds + getHoursGridDisplayHours(p, d), 0), 0)
                    return (
                      <>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid #e5e7eb',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: '#f9fafb',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            {HOURS_GRID_FIRST_COL_LABEL}
                          </td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getHoursGridDisplayHours(p, d), 0)
                            return (
                              <td
                                key={d}
                                style={{
                                  padding: '0.5rem 0.5rem',
                                  textAlign: 'center',
                                  borderTop: '1px solid #e5e7eb',
                                  ...(hoursFlashWorkDate === d
                                    ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                                    : {}),
                                }}
                              >
                                {decimalToHms(daySum) || '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                            {decimalToHms(grandTotal) || '-'}
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>-</td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid #e5e7eb',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: '#f9fafb',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            Total (Decimal):
                          </td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getHoursGridDisplayHours(p, d), 0)
                            return (
                              <td
                                key={d}
                                style={{
                                  padding: '0.5rem 0.5rem',
                                  textAlign: 'center',
                                  borderTop: '1px solid #e5e7eb',
                                  ...(hoursFlashWorkDate === d
                                    ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                                    : {}),
                                }}
                              >
                                {daySum.toFixed(2)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>-</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                            {grandTotal.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid #e5e7eb',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: '#f9fafb',
                              fontWeight: 500,
                              fontSize: '0.8125rem',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                            title="Mark day as verified to lock from edits"
                          >
                            Correct:
                          </td>
                          {hoursDays.map((d) => {
                            const checked = hoursDaysCorrect.has(d)
                            return (
                              <td
                                key={d}
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  textAlign: 'center',
                                  borderTop: '1px solid #e5e7eb',
                                  ...(hoursFlashWorkDate === d
                                    ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                                    : {}),
                                }}
                              >
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={checked ? 'Uncheck to allow edits' : 'Check to lock this day'}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleHoursDayCorrect(d)}
                                  />
                                </label>
                              </td>
                            )
                          })}
                          <td colSpan={2} style={{ padding: '0.5rem 0.5rem', borderTop: '1px solid #e5e7eb' }} />
                        </tr>
                      </>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
            </>
          )}
            </>
            ) : null}
          </section>
          <PeopleHoursSessions
            open={hoursTabSectionsOpen.sessions}
            onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, sessions: !p.sessions }))}
            canAccessPay={canAccessPay}
            authUserId={authUser?.id}
            activeClockSessions={activeClockSessions}
            activeClockSessionsFiltered={activeClockSessionsFiltered}
            pendingApprovalClockSessions={pendingApprovalClockSessions}
            pendingApprovalClockSessionsFiltered={pendingApprovalClockSessionsFiltered}
            approvedClockSessions={approvedClockSessions}
            approvedClockSessionsFiltered={approvedClockSessionsFiltered}
            rejectedClockSessions={rejectedClockSessions}
            rejectedClockSessionsFiltered={rejectedClockSessionsFiltered}
            hoursClockSessionsSearch={hoursClockSessionsSearch}
            setHoursClockSessionsSearch={setHoursClockSessionsSearch}
            hoursClockSessionsSearching={hoursClockSessionsSearching}
            noClockSessionsMatchSearch={noClockSessionsMatchSearch}
            showSalariedWorkdaysHoursButton={showSalariedWorkdaysHoursButton}
            onOpenSalariedWorkdays={() => setSalariedWorkdaysModalOpen(true)}
            prefixMap={prefixMap}
            openHoursMyTimeFromSession={openHoursMyTimeFromSession}
            setEditClockSession={setEditClockSession}
            setError={setError}
            reloadSessions={() => loadAllClockSessionsRef.current?.()}
            reloadHours={() => loadPeopleHoursRef.current?.()}
            rejectedSectionOpen={rejectedSectionOpen}
            onToggleRejected={() => setRejectedSectionOpen((o) => !o)}
          />
          </>
          )}
          {(canAccessPay || canViewCostMatrixShared) && (
          <div style={HOURS_TAB_SECTIONS_STACK}>
            <>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <PeopleHoursDueSummaries
              open={hoursTabSectionsOpen.dueSummaries}
              onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, dueSummaries: !p.dueSummaries }))}
              matrixDays={matrixDays}
              showPeopleForMatrix={showPeopleForMatrix}
              costMatrixTags={costMatrixTags}
              teamsFiltered={teamsFiltered}
              teamPeriodStart={teamPeriodStart}
              teamPeriodEnd={teamPeriodEnd}
              hoursDateStart={hoursDateStart}
              hoursDateEnd={hoursDateEnd}
              getCostForPersonDateMatrix={getCostForPersonDateMatrix}
              getEffectiveHours={getEffectiveHours}
              getCostForPersonDateTeams={getCostForPersonDateTeams}
            />
            {personTimeDetailModalPerson && (
              <PersonTimeDetailModal
                personName={personTimeDetailModalPerson}
                startDate={hoursDateStart}
                endDate={hoursDateEnd}
                hoursRows={peopleHours.filter((h) => h.person_name === personTimeDetailModalPerson).map((h) => ({ work_date: h.work_date, hours: h.hours }))}
                onClose={() => setPersonTimeDetailModalPerson(null)}
              />
            )}
            <PeopleCostMatrix
              open={hoursTabSectionsOpen.costMatrix}
              onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, costMatrix: !p.costMatrix }))}
              canAccessPay={canAccessPay}
              canAccessHours={canAccessHours}
              showMaxHours={showMaxHours}
              setShowMaxHours={setShowMaxHours}
              matrixSortBy={matrixSortBy}
              setMatrixSortBy={setMatrixSortBy}
              matrixDays={matrixDays}
              pendingUnapprovedCountByWorkDate={pendingUnapprovedCountByWorkDate}
              showPeopleForMatrix={showPeopleForMatrix}
              payConfig={payConfig}
              getCostForPersonDateMatrix={getCostForPersonDateMatrix}
              hoursReviewedSet={hoursReviewedSet}
              moveMatrixRow={moveMatrixRow}
              setPersonTimeDetailModalPerson={setPersonTimeDetailModalPerson}
              costMatrixTags={costMatrixTags}
              setCostMatrixTags={setCostMatrixTags}
              saveCostMatrixTags={saveCostMatrixTags}
              costMatrixTagColors={costMatrixTagColors}
            />
            <PeopleHoursTeams
              open={hoursTabSectionsOpen.teams}
              onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, teams: !p.teams }))}
              canAccessPay={canAccessPay}
              canViewCostMatrixShared={canViewCostMatrixShared}
              teamPeriodStart={teamPeriodStart}
              setTeamPeriodStart={setTeamPeriodStart}
              teamPeriodEnd={teamPeriodEnd}
              setTeamPeriodEnd={setTeamPeriodEnd}
              teamsFiltered={teamsFiltered}
              setTeams={setTeams}
              showPeopleForMatrix={showPeopleForMatrix}
              showMaxHoursTeams={showMaxHoursTeams}
              setShowMaxHoursTeams={setShowMaxHoursTeams}
              addTeam={addTeam}
              updateTeamName={updateTeamName}
              addTeamMember={addTeamMember}
              removeTeamMember={removeTeamMember}
              deleteTeam={deleteTeam}
              teamToDelete={teamToDelete}
              setTeamToDelete={setTeamToDelete}
              teamDeletingId={teamDeletingId}
              getCostForPersonDateTeams={getCostForPersonDateTeams}
            />
            {canAccessPay && mergeDuplicates.length > 0 && (
            <section style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 4 }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#92400e' }}>
                Found {mergeDuplicates.length} duplicate{mergeDuplicates.length !== 1 ? 's' : ''}: person name vs user. Merge to consolidate.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {mergeDuplicates.map((dup) => (
                  <li key={dup.personName} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{dup.personName} → {dup.userDisplayName}</span>
                    <button
                      type="button"
                      onClick={() => handleMergeDuplicate(dup)}
                      disabled={mergingPersonName === dup.personName}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: mergingPersonName === dup.personName ? 'not-allowed' : 'pointer' }}
                    >
                      {mergingPersonName === dup.personName ? 'Merging…' : 'Merge'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            )}
            {(isDev || canAccessPay) && (
              <PeopleHoursSharing
                isDev={isDev}
                canAccessPay={canAccessPay}
                open={hoursTabSectionsOpen.sharing}
                onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, sharing: !p.sharing }))}
                costMatrixShareCandidates={costMatrixShareCandidates}
                costMatrixSharedUserIds={costMatrixSharedUserIds}
                costMatrixShareSaving={costMatrixShareSaving}
                costMatrixShareError={costMatrixShareError}
                toggleCostMatrixShare={toggleCostMatrixShare}
                costMatrixTags={costMatrixTags}
                costMatrixTagColors={costMatrixTagColors}
                saveTagColor={saveTagColor}
              />
            )}
            </>
          </div>
          )}
          </div>
          </>
          )}
        </div>
        {canAccessHours ? (
          <SalariedWorkdaysBulkModal
            open={salariedWorkdaysModalOpen}
            onClose={() => setSalariedWorkdaysModalOpen(false)}
            payConfig={payConfig}
            users={users}
          />
        ) : null}
        </>
      )}

      {activeTab === 'vehicles' && canAccessPay && (
        <PeopleVehiclesTab users={users} />
      )}

      {activeTab === 'housing' && canAccessPay && (
        <PeopleHousingTab users={users} />
      )}

      {activeTab === 'offsets' && canAccessPay && (
        <PeopleOffsetsTab people={people} users={users} payStubs={payStubs} loadPayStubs={loadPayStubs} />
      )}

      {activeTab === 'licenses' && canAccessLicenses && (
        <PeopleLicensesTab people={people} users={users} />
      )}

      {activeTab === 'contracts' && canAccessContracts && (
        <PeopleContractsTab
          people={people}
          users={users}
          canDeletePeopleContracts={canDeletePeopleContracts}
        />
      )}

      {activeTab === 'writeups' && canAccessContracts && authUser?.id ? (
        <WriteupsContractsSubTab
          users={users}
          userOptions={writeupUserSelectOptions}
          authUserId={authUser.id}
          isDev={isDev}
        />
      ) : null}

      {activeTab === 'review' && isDev && (
        <PeopleReviewTab
          payConfig={payConfig}
          archivedUserNames={archivedUserNames}
          authUser={authUser}
          isDev={isDev}
          users={users}
          people={people}
          onOpenDayEditor={handleInlineOpenDayEditor}
          onDrilldownOpenChange={handleInlineDrilldownOpenChange}
          teamSummaryInlineRef={teamSummaryInlineRef}
          teamSummaryDataCacheRef={teamSummaryDataCacheRef}
          teamSummaryModalOpenRef={teamSummaryModalOpenRef}
          teamSummaryRefreshPendingRef={teamSummaryRefreshPendingRef}
          reviewHoursReopenAfterLoadRef={reviewHoursReopenAfterLoadRef}
          teamSummaryDrainTick={teamSummaryDrainTick}
          getDaysInRange={getDaysInRange}
        />
      )}

      {activeTab === 'feedback' && isDev && (
        <div>
          <TeamFeedbackDevSettingsBlock layout="standalone" />
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          {!activityAccessResolved ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : canSeeActivityTab ? (
            <PeopleAppActivityPanel
              enabled={activityAccessResolved && canSeeActivityTab}
              isDev={isDev}
              users={users}
              authUserId={authUser?.id ?? null}
            />
          ) : null}
        </div>
      )}

      <PersonOffsetFormModal
        open={offsetFormOpen}
        onClose={closeOffsetForm}
        editingOffset={null}
        initialCreateDraft={offsetFormInitialCreateDraft}
        zIndex={Z_PEOPLE_OFFSET_FORM}
        personNameOptions={offsetPersonNameOptions}
        onSaved={async () => {
          const shouldRefreshRecordPayment = recordPaymentRefreshAfterEmployeeCreditRef.current
          recordPaymentRefreshAfterEmployeeCreditRef.current = false
          const recordStubId = payStubMarkPaidTarget?.id ?? null
          setOffsetFormInitialCreateDraft(null)
          const fresh = await loadPayStubs()
          if (!fresh) return
          if (recordStubId) {
            const stub = fresh.stubs.find((s) => s.id === recordStubId)
            if (stub) setPayStubMarkPaidTarget(stub)
            if (shouldRefreshRecordPayment && stub) {
              const net = stubNetPay(
                stub.gross_pay,
                sumPayStubDeductionAmounts(fresh.deductionsByStubId[stub.id] ?? []),
                sumPayStubAdditionalAmounts(fresh.additionalByStubId[stub.id] ?? []),
              )
              const rem = remainingPayStubBalance(net, sumPayStubPaymentAmounts(fresh.paymentsByStubId[stub.id] ?? []))
              setPayStubMarkPaidAmount(rem > 0 ? rem.toFixed(2) : '')
            }
          }
        }}
        onError={setOffsetFormError}
      />

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editing ? 'Edit person' : `Add ${KIND_LABELS[kind].slice(0, -1)}`}</h2>
            <form onSubmit={handleSave}>
              {!editing && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>List</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value as PersonKind)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} rows={2} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={closeForm} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <p style={{ marginBottom: '1rem' }}>They&apos;ll get an email to set their own password.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={confirmAndInvite} style={{ padding: '0.5rem 1rem' }}>Send invite</button>
              <button type="button" onClick={() => setInviteConfirm(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingUserNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: 500, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem' }}>Full name, title, and phone</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>{editingUserNote.name}</p>
            <label
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}
              htmlFor="editing-user-full-name-title"
            >
              Full name and title
            </label>
            <textarea
              id="editing-user-full-name-title"
              value={editingUserNote.notes}
              onChange={(e) => setEditingUserNote((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
              rows={4}
              placeholder="e.g. Jane Doe, Journeyman Plumber"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', resize: 'vertical' }}
              autoFocus
            />
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }} htmlFor="editing-user-phone">
              Phone
            </label>
            <input
              id="editing-user-phone"
              type="tel"
              value={editingUserNote.phone}
              onChange={(e) => setEditingUserNote((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
              placeholder="Phone number"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!editingUserNote) return
                  setUserNoteSaving(true)
                  setError(null)
                  const trimmedNotes = editingUserNote.notes.trim()
                  const trimmedPhone = editingUserNote.phone.trim()
                  const { error: err } = await supabase
                    .from('users')
                    .update({ notes: trimmedNotes || null, phone: trimmedPhone || null })
                    .eq('id', editingUserNote.id)
                  setUserNoteSaving(false)
                  if (err) setError(err.message)
                  else {
                    await loadPeople()
                    setEditingUserNote(null)
                  }
                }}
                disabled={userNoteSaving}
                style={{ padding: '0.5rem 1rem' }}
              >
                {userNoteSaving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingUserNote(null)} disabled={userNoteSaving} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {hoursUnassignedModal && canEditCrewJobs && (
        <HoursUnassignedModal
          personName={hoursUnassignedModal.personName}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onClose={() => setHoursUnassignedModal(null)}
          onSaved={() => loadCrewJobsRef.current?.()}
          canEditCrewJobs={canEditCrewJobs}
        />
      )}

      {hoursDayAuditModal && (
        <PeopleHoursDayAuditModal
          personName={hoursDayAuditModal.personName}
          workDate={hoursDayAuditModal.workDate}
          onClose={() => setHoursDayAuditModal(null)}
          initialCrewRow={crewJobsByDatePerson[`${hoursDayAuditModal.workDate}:${hoursDayAuditModal.personName}`] ?? null}
          canEditCrewJobs={canEditCrewJobs}
          crewJobsByDatePerson={crewJobsByDatePerson}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onCrewSaved={() => loadCrewJobsRef.current?.()}
          showToast={showToast}
        />
      )}

      {pendingCellPopover ? (
        <PeopleHoursPendingCellPopover
          entry={pendingCellPopover.entry}
          anchorEl={pendingCellPopover.anchorEl}
          authUserId={authUser?.id ?? null}
          canApprove={canAccessHours || canAccessPay}
          canReject={canAccessHours || canAccessPay}
          onClose={() => setPendingCellPopover(null)}
          onChanged={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
          }}
          onError={(message) => setError(message)}
          onShowToast={(message, variant) => showToast?.(message, variant)}
          onOpenInMyTime={() =>
            openHoursMyTimeForGridCell(
              pendingCellPopover.entry.personName,
              pendingCellPopover.entry.workDate,
            )
          }
        />
      ) : null}

      {bulkApprovePendingOpen ? (
        <PeopleHoursBulkApprovePendingModal
          pendingByCellMap={peopleHoursPendingByCellMap}
          onClose={() => setBulkApprovePendingOpen(false)}
          onApproved={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
          }}
          onError={(message) => setError(message)}
          onShowToast={(message, variant) => showToast?.(message, variant)}
        />
      ) : null}

      {editClockSession && (
        <ClockSessionEditSplitModal
          session={{
            id: editClockSession.id,
            user_id: editClockSession.user_id,
            clocked_in_at: editClockSession.clocked_in_at,
            clocked_out_at: editClockSession.clocked_out_at,
            work_date: editClockSession.work_date,
            notes: editClockSession.notes,
            job_ledger_id: editClockSession.job_ledger_id,
            bid_id: editClockSession.bid_id,
            approved_at: editClockSession.approved_at,
          }}
          onClose={() => setEditClockSession(null)}
          onSaved={() => loadAllClockSessionsRef.current?.()}
          showToast={showToast}
        />
      )}

      {hoursManualDraftEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={hoursManualDraftEditor.dateStr}
          sessions={hoursManualDraftEditor.draftSessions}
          subjectUserId={hoursManualDraftEditor.subjectUserId}
          subjectDisplayName={hoursManualDraftEditor.subjectDisplayName}
          jobLabels={hoursManualDraftEditor.jobLabels ?? {}}
          bidLabels={hoursManualDraftEditor.bidLabels ?? {}}
          peopleHoursGridProportionalSeed={hoursManualDraftEditor.draftSessions.some(
            (s) => !isDraftPeopleHoursSessionId(s.id),
          )}
          allowNcnsFromMyTime={false}
          onClose={() => setHoursManualDraftEditor(null)}
          onSaved={() => {
            setHoursManualDraftEditor((prev) => {
              if (prev) {
                const snap = {
                  personName: prev.personName,
                  dateStr: prev.dateStr,
                  subjectUserId: prev.subjectUserId,
                  draftSessions: prev.draftSessions,
                }
                void (async () => {
                  // Draft-only path: clear manual row so max(0, pending clock) shows new session until approve.
                  // Real sessions (e.g. proportional scale): sync people_hours to sum of approved closed sessions only;
                  // pending stays out of people_hours — getHoursGridDisplayHours uses max(ph, pending sum).
                  const hadOnlyDraft = snap.draftSessions.every((s) => isDraftPeopleHoursSessionId(s.id))
                  if (hadOnlyDraft) {
                    await saveHours(snap.personName, snap.dateStr, 0)
                  } else {
                    try {
                      const data = await withSupabaseRetry(
                        async () =>
                          supabase
                            .from('clock_sessions')
                            .select('clocked_in_at, clocked_out_at, approved_at')
                            .eq('user_id', snap.subjectUserId)
                            .eq('work_date', snap.dateStr)
                            .is('rejected_at', null)
                            .is('revoked_at', null),
                        'people hours sync after My Time manual blur save',
                      )
                      let approvedSum = 0
                      for (const row of data ?? []) {
                        const r = row as {
                          clocked_in_at: string
                          clocked_out_at: string | null
                          approved_at: string | null
                        }
                        if (!r.clocked_out_at || !r.approved_at) continue
                        const h =
                          (new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) /
                          3_600_000
                        approvedSum += Math.max(0, h)
                      }
                      await saveHours(snap.personName, snap.dateStr, approvedSum)
                    } catch {
                      await saveHours(snap.personName, snap.dateStr, 0)
                    }
                  }
                  loadAllClockSessionsRef.current?.()
                  loadPeopleHoursRef.current?.()
                })()
              } else {
                loadAllClockSessionsRef.current?.()
                loadPeopleHoursRef.current?.()
              }
              return null
            })
          }}
          onLinkedSessionsUpdated={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
          }}
          onPatchSeededSessionsJobBid={({ sessionId, job_ledger_id, bid_id }) => {
            setHoursManualDraftEditor((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                draftSessions: prev.draftSessions.map((s) =>
                  s.id === sessionId ? { ...s, job_ledger_id, bid_id } : s,
                ),
              }
            })
          }}
        />
      )}

      {hoursMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={hoursMyTimeEditor.dateStr}
          sessions={[]}
          subjectUserId={hoursMyTimeEditor.subjectUserId}
          subjectDisplayName={hoursMyTimeEditor.subjectDisplayName}
          jobLabels={{}}
          bidLabels={{}}
          allowNcnsFromMyTime={hoursAllowNcnsFromMyTime}
          onClose={() => {
            // Cancelling without saving: nothing changed, no Team Summary
            // refresh needed. Just clear the review-origin marker so a
            // subsequent unrelated open doesn't accidentally trigger a
            // re-open of the Hours drilldown.
            reviewHoursDayEditorPersonRef.current = null
            setHoursMyTimeEditor(null)
          }}
          onSaved={() => {
            const reopenPersonName = reviewHoursDayEditorPersonRef.current
            reviewHoursDayEditorPersonRef.current = null
            setHoursMyTimeEditor(null)
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
            // Review → Hours drilldown bridge: refresh the Team Summary
            // rows so the numbers reflect the save, then re-open the
            // Hours drilldown for the same person. After the new rows
            // commit, `openTeamSummaryWindow('inline')` calls
            // `teamSummaryInlineRef.openDrilldown(pn, 'hours')` and
            // clears the ref — see the early-return inline branch.
            if (reopenPersonName) {
              teamSummaryDataCacheRef.current = null
              teamSummaryModalOpenRef.current = false
              reviewHoursReopenAfterLoadRef.current = reopenPersonName
              setTeamSummaryDrainTick((n) => n + 1)
            }
          }}
          onLinkedSessionsUpdated={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
          }}
        />
      )}

    </div>
  )
}
