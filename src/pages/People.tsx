import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { pageSubTabStyle, pageTabStyle } from '../lib/pageTabStyle'
import {
  PEOPLE_TAB_GROUP_MEMORY_KEY,
  PEOPLE_TAB_LABELS,
  groupOfTab,
  isPeopleTab,
  landingViewForGroup,
  parseGroupMemory,
  rememberTab,
  visibleTabGroups,
  type PeopleTab,
  type PeopleTabGroupId,
} from '../lib/people/peopleTabGroups'
import { effectiveHoursForDisplay, canEditRecordedHours } from '../lib/salariedEffectiveHours'
import { type TeamSummaryInlineHandle } from '../components/people/teamSummary/TeamSummaryInline'
import type { TeamSummaryRow } from '../components/people/teamSummary/types'
import { WriteupsContractsSubTab } from '../components/writeups/WriteupsContractsSubTab'
import PeopleEmploymentTab from '../components/people/PeopleEmploymentTab'
import PeopleVehiclesTab from '../components/people/PeopleVehiclesTab'
import PeopleHousingTab from '../components/people/PeopleHousingTab'
import PeopleLicensesTab from '../components/people/PeopleLicensesTab'
import PeopleOffsetsTab from '../components/people/PeopleOffsetsTab'
import PeopleContractsTab from '../components/people/PeopleContractsTab'
import PeopleSubsTab from '../components/people/PeopleSubsTab'
import PeopleHrTab from '../components/people/PeopleHrTab'
import PeopleOverheadTab from '../components/people/PeopleOverheadTab'
import PeopleReviewTab from '../components/people/PeopleReviewTab'
import PeopleDayBookTab from '../components/people/PeopleDayBookTab'
import { dropDayBookDoorParams, type DayBookDoor } from '../lib/people/dayBookDoor'
import PeopleWhosWhereTab from '../components/people/PeopleWhosWhereTab'
import { PeopleScoreboardTab } from '../components/people/PeopleScoreboardTab'
import PeoplePayStubsTab, { type PayStubRow } from '../components/people/PeoplePayStubsTab'
import PeoplePayLedgerView from '../components/people/PeoplePayLedgerView'
import PayRunPaymentsView from '../components/people/PayRunPaymentsView'
import { PeopleUsersTab } from '../components/people/PeopleUsersTab'
import {
  KIND_LABELS,
  KIND_TO_USER_ROLE,
  KINDS,
} from '../components/people/peopleUsersTabShared'
import { PeopleHoursTeams } from '../components/people/PeopleHoursTeams'
import { usePeopleHoursTeams } from '../hooks/usePeopleHoursTeams'
import { PeopleHoursDueSummaries } from '../components/people/PeopleHoursDueSummaries'
import { PeopleHoursSessions } from '../components/people/PeopleHoursSessions'
import { PeopleHoursWeekRange } from '../components/people/PeopleHoursWeekRange'
import { clampHoursRangeToFloor } from '../lib/people/assistantHoursWindow'
import { useAssistantHoursWindow } from '../hooks/useAssistantHoursWindow'
import { PeopleHoursGrid } from '../components/people/PeopleHoursGrid'
import { PeopleHoursGridJobHighlight, type HoursGridJobHighlightPick } from '../components/people/PeopleHoursGridJobHighlight'
import { PeopleHoursAlignModal } from '../components/people/PeopleHoursAlignModal'
import { buildAlignHoursQueue } from '../lib/people/alignHoursQueue'
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
import { buildPayStubHtml, openPayStubWindow } from '../lib/peopleDocuments/buildPayStubHtml'
import { PayStubViewModal } from '../components/pay/PayStubViewModal'
import { withSupabaseRetry } from '../utils/errorHandling'
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
import { usePayStubsData } from '../hooks/usePayStubsData'
import { usePayrollPreviewPricing } from '../hooks/usePayrollPreviewPricing'
import { useDraftPayrollPendingApprovals } from '../hooks/useDraftPayrollPendingApprovals'
import { usePayrollCatchUp } from '../hooks/usePayrollCatchUp'
import { useBulkGeneratePayStubs } from '../hooks/useBulkGeneratePayStubs'
import { BulkGeneratePayStubsConfirm } from '../components/pay/BulkGeneratePayStubsConfirm'
import { payrollForecastUnpaidRows } from '../lib/pay/payrollForecastRows'
import { RecordPayStubPaymentModal } from '../components/pay/RecordPayStubPaymentModal'
import { useRecordPayStubPayment } from '../hooks/useRecordPayStubPayment'
import { DraftPayrollModal } from '../components/pay/DraftPayrollModal'
import { HoursApprovedNudgeChip } from '../components/people/HoursApprovedNudgeChip'
import { foldHoursApproved, type HoursApprovedNudge } from '../lib/people/payWeekLinks'
import { PayrollCatchUpModal } from '../components/pay/PayrollCatchUpModal'
import { HirePersonModal } from '../components/people/HirePersonModal'
import { PayrollForecastModal } from '../components/pay/PayrollForecastModal'
import { DraftPayrollPersonHoursBreakdownModal } from '../components/pay/DraftPayrollPersonHoursBreakdownModal'
import { summarizeStubDayBreakdown } from '../lib/officeJobRateSplit'
import { generatePayStubRecord, type GeneratePayStubResult } from '../lib/pay/generatePayStub'
import { fetchPayReportInputs } from '../lib/pay/payReportInputs'
import { findPersonUserDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import { buildAddSessionPeople } from '../lib/people/buildAddSessionPeople'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useDocumentVisibility } from '../hooks/useDocumentVisibility'
import { useHoursGridFirstColWidthPx } from '../hooks/useHoursGridFirstColWidthPx'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useToastContext } from '../contexts/ToastContext'
import { useRoleGate } from '../hooks/useRoleGate'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { HoursUnassignedModal } from '../components/HoursUnassignedModal'
import { MatchClockSessionsModal, fetchUnassignedClockSessionCount } from '../components/people/MatchClockSessionsModal'
import { PeopleHoursDayAuditModal } from '../components/PeopleHoursDayAuditModal'
import { PeopleHoursDashboardClockStrip } from '../components/people/PeopleHoursDashboardClockStrip'
import { buildHoursGridLiveByWorkDate } from '../lib/people/hoursGridLiveByCell'
import { buildHoursGridRoster, EMPTY_HOURS_ROSTER_MESSAGE, payConfigRowsForRoster } from '../lib/people/hoursGridRoster'
import { hoursGridDayCost, recordedHoursLookup, sortPeopleByTotalDesc } from '../lib/people/hoursGridCost'
import { buildPayRosterIndex, fetchRosterPeople, type PayRosterIndex } from '../lib/people/rosterPeople'
import { ClockSessionEditSplitModal } from '../components/ClockSessionEditSplitModal'
import { DashboardMyTimeDayEditorModal } from '../components/DashboardMyTimeDayEditorModal'
import { ReviewHoursModal } from '../components/ReviewHoursModal'
import PeopleAppActivityPanel from '../components/people/PeopleAppActivityPanel'
import TeamFeedbackDevSettingsBlock from '../components/team-feedback/TeamFeedbackDevSettingsBlock'
import { SalariedWorkdaysBulkModal } from '../components/people/SalariedWorkdaysBulkModal'
import { buildPeopleHoursManualDraftSession, isDraftPeopleHoursSessionId } from '../lib/peopleHoursManualDraftSession'
import {
  buildJobBidLabelMapsFromClockRows,
  collectPeopleHoursDaySessionsForScale,
  scaleClosedSessionsToTargetHours,
  toDayEditorSession,
} from '../lib/peopleHoursProportionalScale'
import { useTypedStamps } from '../hooks/useTypedStamps'
import { needsSecondLook, typedStampsVersion } from '../lib/clock/typedHours'
import {
  buildClosedPendingHoursSumsByCell,
  buildHoursGridNameJoin,
  buildPeopleHoursPendingByCellMap,
  pendingByCellKey,
  summarizePeopleHoursPendingByCell,
  type PeopleHoursPendingCellEntry,
} from '../lib/peopleHoursPendingByCell'
import { countClosedPendingSessions, describePendingOutsideVisibleWeek, pendingOutsideVisibleWeek } from '../lib/payWeekAnchor'
import { denverCalendarDayKey, formatWorkDateYmdWeekdayShortFriendly, localCalendarDayKey } from '../utils/dateUtils'
import { PeopleHoursPendingCellPopover } from '../components/people/PeopleHoursPendingCellPopover'
import { PeopleHoursBulkApprovePendingModal } from '../components/people/PeopleHoursBulkApprovePendingModal'
import { PeopleHoursApprovalsQueueModal } from '../components/people/PeopleHoursApprovalsQueueModal'
import { PeopleHoursPhoneView, type HoursPhoneViewKey } from '../components/people/PeopleHoursPhoneView'
import { PersonDeskPage } from '../components/personDesk/PersonDeskPage'
import { useOptionalPersonDesk } from '../contexts/PersonDeskContext'
import { canOpenPersonDesk } from '../lib/people/personDeskGates'
import { usePendingHoursApprovalsNudge } from '../hooks/usePendingHoursApprovalsNudge'
import type { DayEditorSession } from '../lib/myTimeDayTimeline'
import type { ClockSessionRow } from '../types/clockSessions'

/** The People page is the one caller that needs the App Activity gate resolved. */
const PEOPLE_PAGE_ACCESS_OPTIONS = { activityViewer: true }

/** Pay History overlays: base layer; nested dialogs (e.g. Record payment from Draft Payroll) must be higher. */
const Z_PEOPLE_PAY_MODAL = 1100
const Z_PEOPLE_PAY_MODAL_NESTED = 1200
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
  | 'teams'

/** Sections with chevron open/close state (`payTools` toolbar and `week` range are always visible). */
type HoursTabCollapsibleSectionId = Exclude<HoursTabSectionId, 'payTools' | 'week'>

const HOURS_TAB_SECTION_SCROLL_ID: Record<HoursTabSectionId, string> = {
  week: 'people-hours-week',
  clockStrip: 'people-hours-clock-strip',
  sessions: 'people-hours-sessions',
  grid: 'people-hours-grid',
  payTools: 'people-hours-pay-tools',
  dueSummaries: 'people-hours-due-summaries',
  teams: 'people-hours-teams',
}

const INITIAL_HOURS_TAB_SECTIONS_OPEN: Record<HoursTabCollapsibleSectionId, boolean> = {
  clockStrip: true,
  sessions: true,
  grid: true,
  dueSummaries: false,
  teams: false,
}

const HOURS_TAB_SECTIONS_STACK_GAP = '0.75rem'

const HOURS_TAB_SECTIONS_STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: HOURS_TAB_SECTIONS_STACK_GAP,
}

const tabStyle = pageTabStyle

/** `PeopleTab` (the 18 view keys) and their six groups live in `src/lib/people/peopleTabGroups.ts` (v2.2811). */

/** Users tab: email/phone on its own row below the name line at ≤640px. */
/** Max UUIDs in Realtime `user_id=in.(...)` for People Hours (avoid oversized filters). */
const PEOPLE_HOURS_CLOCK_REALTIME_MAX_USER_IDS = 150

export default function People() {
  const [searchParams, setSearchParams] = useSearchParams()
  /** Payroll tab view (v2.2168, dev-only): **Pay run** (the per-report table, key "reports") or **Balances** (the per-person ledger, key "ledger" — v2.3317 renamed the labels only; the key and the ?view=ledger&person=<name> deep-link are unchanged). */
  const [payrollView, setPayrollView] = useState<'reports' | 'ledger' | 'payments'>(() => {
    const v = searchParams.get('view')
    // v2.3577: a third view, Payments — one row per payment made; ?view=payments deep-links it.
    return v === 'ledger' ? 'ledger' : v === 'payments' ? 'payments' : 'reports'
  })
  const { user: authUser, role: authRole, readOnly: authReadOnly } = useAuth()
  const isDocVisible = useDocumentVisibility()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const confirmDialog = useConfirmDialog()
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
    linkPersonToAccount,
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
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteConfirm, setInviteConfirm] = useState<Person | null>(null)
  /** Add-to-roster follow-ons (v2.2762): invite by email and/or open the new person's desk. */
  const [rosterFormInviteAfter, setRosterFormInviteAfter] = useState(false)
  const [rosterFormOpenDeskAfter, setRosterFormOpenDeskAfter] = useState(true)
  const personDesk = useOptionalPersonDesk()
  async function handleRosterFormSubmit(e: React.FormEvent) {
    const wasEditing = Boolean(editing)
    const saved = await handleSave(e)
    if (!saved || wasEditing) return
    if (rosterFormInviteAfter && saved.email?.trim()) setInviteConfirm(saved)
    if (rosterFormOpenDeskAfter && personDesk?.canOpen) personDesk.open({ personId: saved.id, displayName: saved.name })
    setRosterFormInviteAfter(false)
  }
  const [activeTab, setActiveTab] = useState<PeopleTab>('users')
  /** Per-group last-view memory (v2.2811): clicking a group tab lands on the view you used last there. Device-local. */
  const [tabGroupMemory, setTabGroupMemory] = useState<Partial<Record<PeopleTabGroupId, PeopleTab>>>(() => {
    try {
      return parseGroupMemory(window.localStorage.getItem(PEOPLE_TAB_GROUP_MEMORY_KEY))
    } catch {
      return {}
    }
  })
  useEffect(() => {
    setTabGroupMemory((m) => {
      const next = rememberTab(m, activeTab)
      if (next !== m) {
        try {
          window.localStorage.setItem(PEOPLE_TAB_GROUP_MEMORY_KEY, JSON.stringify(next))
        } catch {
          /* private mode / blocked storage: memory is per-session only */
        }
      }
      return next
    })
  }, [activeTab])

  // Pay/Hours tab state
  const [hoursTabLoading, setHoursTabLoading] = useState(false)
  /** True once the Hours tab load effect has entered its first loading cycle (past the 80ms delay). Used so deep-link scroll runs after content is stable, not during the pre-load gap that is followed by a loading spinner that unmounts the anchor. */
  const hoursTabFirstLoadCycleStartedRef = useRef(false)
  const hoursTableScrollRef = useRef<HTMLDivElement>(null)
  const hoursFocusClearTimeoutRef = useRef<number | null>(null)
  const { canAccessPay, canAccessVehicles, canAccessHours, canAccessLicenses, canAccessContracts, isDev, isAssistant, canSeePushStatus, canSeeDayBook, canPickDayBookPerson, canSeeWhosWhere, accessResolved, canSeeActivityTab, activityAccessResolved } = usePeopleAccess(authUser?.id, PEOPLE_PAGE_ACCESS_OPTIONS)
  const canOpenHoursTab = canAccessPay || canAccessHours
  // Role gates that say something (v2.2882): a deep link to a Pay tab this role
  // can't open toasts once and lands on Users — no more tab strip over a blank page.
  const { bounce: roleGateBounce } = useRoleGate(authRole, authUser?.id)
  const usersTabTags = useUsersTabTags({
    isDev,
    activeTab,
    people,
    users,
    authUserId: authUser?.id,
    showToast,
  })
  const {
    payConfig,
    payConfigById,
    payConfigDraft,
    payConfigOfficeWageDraft,
    payConfigSaving,
    salaryTemplateByPersonName,
    loadPayConfig,
    loadPayConfigSalaryTemplateIndicators,
    upsertPayConfig,
    updatePayConfigHourlyWage,
    updatePayConfigOfficeHourlyWage,
  } = usePayConfig({
    canAccessPay,
    canAccessHours,
    setError,
    showToast,
    peopleRosterRef,
    usersRef,
  })
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  /** Hire (v2.3701): the one form for a new person, opened from People → Users. */
  const [hireOpen, setHireOpen] = useState(false)
  const [salariedWorkdaysModalOpen, setSalariedWorkdaysModalOpen] = useState(false)

  useEffect(() => {
    if (activeTab !== 'hours') {
      setSalariedWorkdaysModalOpen(false)
    }
  }, [activeTab])
  const [reviewHoursModalOpen, setReviewHoursModalOpen] = useState(false)
  const [archivedUserNames, setArchivedUserNames] = useState<Set<string>>(new Set())
  /** People spine (v2.3698): the roster view's verdict per pay row — who is a person. Null until loaded (no verdict). */
  const [payRoster, setPayRoster] = useState<PayRosterIndex | null>(null)
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
    /**
     * Set when opened from the Draft Payroll Hours breakdown: widens the editor's save fence to
     * the snapshotted pay period (saveableRangeOverride) and re-opens the breakdown for this
     * person on close/save.
     */
    payrollOrigin?: { personName: string; periodStart: string; periodEnd: string }
    /** Plain fence widening (e.g. Payroll ledger upcoming-week drilldown) with no reopen choreography. */
    saveableRange?: { start: string; end: string }
  } | null>(null)
  // Bumped after a My-Time save so the Payroll ledger's upcoming-payroll data refetches.
  const [ledgerUpcomingRefreshTick, setLedgerUpcomingRefreshTick] = useState(0)
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
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const {
    setTeams,
    teamsFiltered,
    teamPeriodStart,
    setTeamPeriodStart,
    teamPeriodEnd,
    setTeamPeriodEnd,
    showMaxHoursTeams,
    setShowMaxHoursTeams,
    teamToDelete,
    setTeamToDelete,
    teamDeletingId,
    loadTeams,
    addTeam,
    updateTeamName,
    addTeamMember,
    removeTeamMember,
    deleteTeam,
    getCostForPersonDateTeams,
  } = usePeopleHoursTeams({ canAccessPay, setError, archivedUserNames, payConfig, getCostForPersonDate })
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return localCalendarDayKey(start)
  })
  // Pay History tab state
  const {
    payStubs,
    payStubPaymentsByStubId,
    payStubDeductionsByStubId,
    payStubAdditionalByStubId,
    payStubLineMaps,
    loadPayStubs,
    deletePayStub,
    deletingPayStubId,
    payStubDeleteConfirm,
    setPayStubDeleteConfirm,
  } = usePayStubsData({ canAccessPay, setError })
  const recordPayment = useRecordPayStubPayment({ authUserId: authUser?.id, payStubLineMaps, loadPayStubs, setError })
  const { markingPayStubId, openPayStubMarkPaidModal } = recordPayment
  // Ledger Actions → View: in-app pay-stub viewer (full built HTML document + modal title).
  const [payStubViewModal, setPayStubViewModal] = useState<{ title: string; html: string } | null>(null)
  const [payStubPeriodStart, setPayStubPeriodStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return localCalendarDayKey(start)
  })
  const [payStubPeriodEnd, setPayStubPeriodEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return localCalendarDayKey(start)
  })
  const [generatingPayStubPerson, setGeneratingPayStubPerson] = useState<string | null>(null)
  const [draftPayrollModalOpen, setDraftPayrollModalOpen] = useState(false)
  /** T5-03 (J7-9): approvals since the Hours → Draft Payroll chip last cleared. */
  const [hoursApprovedNudge, setHoursApprovedNudge] = useState<HoursApprovedNudge | null>(null)
  const noteHoursApproved = (approved: number | null) => setHoursApprovedNudge((prev) => foldHoursApproved(prev, approved))
  const openDraftPayrollFromHours = () => {
    const week = hoursApprovedNudge?.week
    if (week) {
      setPayStubPeriodStart(week.start)
      setPayStubPeriodEnd(week.end)
    }
    setHoursApprovedNudge(null)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'pay_stubs')
      return next
    })
    setActiveTab('pay_stubs')
    setDraftPayrollModalOpen(true)
  }
  const [forecastModalOpen, setForecastModalOpen] = useState(false)
  const [draftPayrollHoursBreakdownPerson, setDraftPayrollHoursBreakdownPerson] = useState<string | null>(null)
  const draftPayrollRealtimeSnapRef = useRef({
    draftOpen: false,
    activeTab: '' as string,
    canAccessPay: false,
    periodStart: '',
    periodEnd: '',
  })
  const { draftPayrollPendingApprovalCount, draftPayrollPendingApprovalLoading, draftPayrollPendingApprovalError, loadDraftPayrollPendingApprovals } =
    useDraftPayrollPendingApprovals({ draftOpen: draftPayrollModalOpen, canAccessPay, periodStart: payStubPeriodStart, periodEnd: payStubPeriodEnd })
  /** The clock-session realtime feed re-counts through this, so it always calls the newest loader. */
  const loadDraftPayrollPendingApprovalsRef = useRef(loadDraftPayrollPendingApprovals)
  loadDraftPayrollPendingApprovalsRef.current = loadDraftPayrollPendingApprovals
  const [hoursFocusRequest, setHoursFocusRequest] = useState<{ workDate: string; personName: string } | null>(null)
  const [hoursFlashWorkDate, setHoursFlashWorkDate] = useState<string | null>(null)
  const [hoursFlashPersonName, setHoursFlashPersonName] = useState<string | null>(null)
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return localCalendarDayKey(start)
  })
  /** Earliest Hours-tab date visible to this viewer, or null for no limit (non-assistants, or the unlimited setting). */
  const { floorYmd: hoursFloorYmd } = useAssistantHoursWindow(isAssistant)
  // Snap-back invariant: no code path may leave the range below the floor.
  useEffect(() => {
    if (!hoursFloorYmd) return
    const clamped = clampHoursRangeToFloor(hoursDateStart, hoursDateEnd, hoursFloorYmd)
    if (clamped.start !== hoursDateStart) setHoursDateStart(clamped.start)
    if (clamped.end !== hoursDateEnd) setHoursDateEnd(clamped.end)
  }, [hoursFloorYmd, hoursDateStart, hoursDateEnd])
  const setHoursDateStartClamped = useCallback(
    (value: string) => setHoursDateStart(hoursFloorYmd && value < hoursFloorYmd ? hoursFloorYmd : value),
    [hoursFloorYmd]
  )
  const setHoursDateEndClamped = useCallback(
    (value: string) => setHoursDateEnd(hoursFloorYmd && value < hoursFloorYmd ? hoursFloorYmd : value),
    [hoursFloorYmd]
  )
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
    prefixMap,
    peopleRosterRef,
    authUser,
    hoursDaysCorrectRef,
    setError,
    showToast,
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
  /** People → Hours: anchor + entry for the inline pending sessions popover. */
  const [pendingCellPopover, setPendingCellPopover] = useState<{
    anchorEl: HTMLElement
    entry: PeopleHoursPendingCellEntry
  } | null>(null)
  const [bulkApprovePendingOpen, setBulkApprovePendingOpen] = useState(false)
  /** All-weeks approvals queue (the Needs You card's door; also the Hours header button + banner "All weeks"). */
  const [approvalsQueueOpen, setApprovalsQueueOpen] = useState(false)
  /** `&typed=1` beside `approvals=1` (the Needs You *Look at them* action): the queue opens on its Typed by hand filter. */
  const [approvalsQueueTypedOnly, setApprovalsQueueTypedOnly] = useState(false)
  /** `&typist=<user id>` beside `typed=1` (the *Hours added in bulk* door, v2.4281): the queue narrows to what that person typed. */
  const [approvalsQueueTypist, setApprovalsQueueTypist] = useState<{ id: string; name: string | null } | null>(null)
  const [approvalsQueueReloadKey, setApprovalsQueueReloadKey] = useState(0)
  /** Hours on a phone (v2.3889, punch list #30 PR 5d): Who's in · Approvals · Week & sessions; the tab as it was is the third view. */
  const [hoursPhoneView, setHoursPhoneView] = useState<HoursPhoneViewKey>('in')
  const hoursPhone = narrowViewport && canAccessHours
  const hoursPhoneRest = !hoursPhone || hoursPhoneView === 'sessions'
  /** People → Hours "Align hours" modal: week sessions with no job/bid, one pass to link them. */
  const [alignHoursOpen, setAlignHoursOpen] = useState(false)
  const alignHoursSessions = useMemo(
    () => [...pendingApprovalClockSessions, ...approvedClockSessions],
    [pendingApprovalClockSessions, approvedClockSessions],
  )
  const alignHoursQueueCount = useMemo(
    () => buildAlignHoursQueue(alignHoursSessions).totalSessions,
    [alignHoursSessions],
  )
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
    isDev,
    authUserRole,
  }
  // Overhead reads pay-gated data (clock_sessions RLS + people_pay_config
  // wages both require pay_approved_masters membership for masters), so a
  // non-approved master would only ever see a silently-zero tab — gate on
  // pay approval like the Payroll tab does.
  const canAccessOverheadTab =
    authRole === 'dev' || (authRole === 'master_technician' && canAccessPay)
  const canDeletePeopleContracts =
    authRole !== null && ['dev', 'master_technician'].includes(authRole)

  // Hours tab state (unassigned hours modal)
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)
  const [matchSessionsOpen, setMatchSessionsOpen] = useState(false)
  const [unassignedSessionCount, setUnassignedSessionCount] = useState<number | null>(null)
  /** Company-wide pending count (all weeks) for the Hours header's Approvals badge — the RPC re-gates by role. */
  const { approvals: pendingApprovalsAllWeeks, refresh: refreshPendingApprovalsCount } = usePendingHoursApprovalsNudge(
    activeTab === 'hours' && canOpenHoursTab,
  )
  const [hoursDayAuditModal, setHoursDayAuditModal] = useState<{ personName: string; workDate: string } | null>(null)

  // Offset form state — only the Record-payment "employee credit" entry point lives here.
  // The Offsets tab UI (list, search, apply-to-stub, add/edit) is in PeopleOffsetsTab.

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
      (canAccessHours || canAccessPay)
    ) {
      loadPeopleHours(hoursDateStart, hoursDateEnd)
    }
  }

  /** Badge for the Currently-clocked-in header's "Match sessions" button. */
  const refreshUnassignedSessionCount = useCallback(() => {
    void fetchUnassignedClockSessionCount().then(setUnassignedSessionCount)
  }, [])
  useEffect(() => {
    if (activeTab !== 'hours' || !canAccessHours) return
    refreshUnassignedSessionCount()
  }, [activeTab, canAccessHours, refreshUnassignedSessionCount])

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
    } else if (tab === 'teams') {
      // Legacy: the Teams tab was removed (v2.1292) — team leads live in the
      // Users tab's Team leads modal. Old links land on Users.
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'users')
        return next
      }, { replace: true })
      setActiveTab('users')
    } else if (isPeopleTab(tab)) {
      // 'scoreboard' has no URL gate deliberately — isDev resolves async and a
      // gate here bounces dev cold deep links to Users (the activity-tab race).
      // The render site is isDev-gated, matching Review's long-standing pattern.
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
      // Pay-group gates (v2.2882, C25 J7-5): Payroll / Employment / Offsets need
      // `canAccessPay`, Hours needs hours-or-pay. Every flag starts false while
      // usePeopleAccess loads, so gate only once `accessResolved` — before that the
      // tab is set and the (already flag-gated) render site simply waits. A role
      // that never gets the flag used to see the tab strip and then nothing.
      const payGated = tab === 'employment' || tab === 'pay_stubs' || tab === 'offsets'
      if (accessResolved && ((payGated && !canAccessPay) || (tab === 'hours' && !canOpenHoursTab))) {
        const { toTab } = roleGateBounce(tab === 'hours' ? 'hours' : 'payroll', `/people?tab=${tab}`)
        const target = (toTab ?? 'users') as PeopleTab
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', target)
          return next
        }, { replace: true })
        setActiveTab(target)
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
  }, [searchParams, activityAccessResolved, canSeeActivityTab, canAccessContracts, canAccessOverheadTab, canAccessPay, canOpenHoursTab, accessResolved, roleGateBounce, setSearchParams])

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

  // `?tab=hours&approvals=1` (the Dashboard Needs You "Open approvals" action) opens the
  // all-weeks queue on arrival and strips the flag so a reload doesn't reopen it.
  useEffect(() => {
    if (searchParams.get('approvals') !== '1') return
    if (!(canAccessHours || canAccessPay)) return
    setActiveTab('hours')
    setApprovalsQueueTypedOnly(searchParams.get('typed') === '1')
    const typistId = searchParams.get('typist')
    setApprovalsQueueTypist(typistId ? { id: typistId, name: searchParams.get('typistName') || null } : null)
    setApprovalsQueueOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'hours')
      next.delete('approvals')
      next.delete('typed')
      next.delete('typist')
      next.delete('typistName')
      return next
    }, { replace: true })
  }, [searchParams, canAccessHours, canAccessPay, setSearchParams])

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

  const canEditCrewJobs = canAccessPay || (isAssistantLike(authUserRole) && canAccessHours)

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
    isDev || authUserRole === 'master_technician' || isAssistantLike(authUserRole)

  async function archivePerson(id: string) {
    if (
      !(await confirmDialog({
        message: 'Archive this person? They will be hidden from the roster but can be restored.',
        confirmLabel: 'Archive',
      }))
    )
      return
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
      body: { email: p.email.trim(), role, name: p.name || undefined, redirectTo: `${window.location.origin}/accept-invite` },
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
      .in('role', ['assistant', 'controller' as 'assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'])
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

  // v2.3702: the Users tab's Pay lens edits the pay-config map, which only the Hours / Payroll / Review
  // tabs used to load — load it (and the salaried-template indicator) while the Users tab is up.
  // Found live: without this the lens showed every wage blank.
  useEffect(() => {
    if (activeTab !== 'users' || !canAccessPay) return
    void loadPayConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPayConfig is a stable page-level loader
  }, [activeTab, canAccessPay])
  useEffect(() => {
    if (activeTab !== 'users' || !canAccessPay) return
    void loadPayConfigSalaryTemplateIndicators()
  }, [activeTab, canAccessPay, payConfig, users, loadPayConfigSalaryTemplateIndicators])

  /** v2.3702 Account lens: training mode — the desk's own write, the same guard (`users_guard_privileged_columns`). */
  async function setTrainingMode(userId: string, on: boolean) {
    const { data, error: e } = await supabase.from('users').update({ read_only: on }).eq('id', userId).select('id, read_only')
    if (e) showToast(e.message, 'error')
    else if (!data?.[0]) showToast('That change did not apply — you may not have permission to change this account.', 'error')
    else {
      showToast(on ? 'Training mode on — every write is blocked for them' : 'Training mode off', 'success')
      void loadPeople()
    }
  }

  async function loadArchivedUserNames() {
    if (!canAccessPay && !canAccessHours && !canAccessContracts) return
    const { data, error } = await supabase.rpc('get_archived_user_names')
    if (error) return
    const arr = Array.isArray(data) ? data : []
    const names = arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    setArchivedUserNames(new Set(names))
  }

  /** People spine (v2.3698): the pay lists take the roster view's verdict — a sample, a twin or an archived person with a pay-config row is not on them. */
  async function loadRosterPeople() {
    if (!canAccessPay && !canAccessHours) return
    try {
      setPayRoster(buildPayRosterIndex(await fetchRosterPeople(supabase)))
    } catch {
      // No verdict: every pay row stays (the pre-v2.3698 list), never a blank grid.
    }
  }

  async function loadHoursDaysCorrect(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
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

  async function generatePayStub(
    personNameArg: string,
    options?: { periodStart?: string; periodEnd?: string },
  ): Promise<boolean> {
    const personName = personNameArg.trim()
    if (!authUser?.id || !personName) return false
    // Catch-up rows (v2.2034) generate for their own week; default unchanged.
    const start = options?.periodStart ?? payStubPeriodStart
    const end = options?.periodEnd ?? payStubPeriodEnd
    const cfg = payConfig[personName]
    // The money and the two inserts live in the kernel (v2.3700) so the Person desk's Leave flow
    // can generate the final report too. Nothing opens afterwards (v2.4216): the row turns into
    // View / Record payment and a toast says the report is there.
    const matches = users.filter((u) => (u.name ?? '').trim() === personName)
    let generated: GeneratePayStubResult
    try {
      generated = await generatePayStubRecord(supabase, {
        personName,
        periodStart: start,
        periodEnd: end,
        payConfig: cfg,
        userId: matches.length === 1 ? matches[0]!.id : null,
        createdBy: authUser.id,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create pay report')
      return false
    }
    for (const w of generated.warnings) showToast(w, 'info')
    await loadPayStubs()
    showToast(`Pay report drafted for ${personName} — View opens it, Record payment marks it paid.`, 'success')
    return true
  }

  /** Assemble the full pay-stub HTML document for a saved stub (shared by the window-view and modal-view paths). */
  async function buildPayStubViewHtml(stub: PayStubRow): Promise<string> {
    const start = stub.period_start
    const end = stub.period_end
    const cfg = payConfig[stub.person_name]
    const isSalary = cfg?.is_salary ?? false
    const { data: daysData } = await supabase.from('pay_stub_days').select('work_date, hours_at_time, office_hours, office_rate, job_hours, job_rate').eq('pay_stub_id', stub.id).order('work_date')
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
    const rateSplit = summarizeStubDayBreakdown((daysData ?? []) as Parameters<typeof summarizeStubDayBreakdown>[0]) ?? undefined
    const wage = cfg?.hourly_wage ?? 0
    const inputs = await fetchPayReportInputs(supabase, { personName: stub.person_name, periodStart: start, periodEnd: end, dayRows, payStubId: stub.id, users, people, includePayments: true })
    const html = buildPayStubHtml({
      personName: stub.person_name,
      periodStart: start,
      periodEnd: end,
      hourlyWage: wage,
      hoursRows: dayRows.map((r) => ({ date: r.work_date, hours: r.hours })),
      hoursTotal: stub.hours_total,
      grossPay: stub.gross_pay,
      ...inputs,
      rateSplit,
    })
    return html
  }

  async function viewPayStub(stub: PayStubRow) {
    openPayStubWindow(await buildPayStubViewHtml(stub), false)
  }

  /** Ledger Actions → View: same document as viewPayStub, shown in an in-app modal with a Print button. */
  async function viewPayStubInModal(stub: PayStubRow) {
    const html = await buildPayStubViewHtml(stub)
    setPayStubViewModal({
      title: `Pay report — ${stub.person_name} (${stub.period_start} – ${stub.period_end})`,
      html,
    })
  }

  /** Ledger Actions → Print: the same document as viewPayStub, sent to the print dialog (one builder since v2.3874). */
  async function printPayStub(stub: PayStubRow) {
    openPayStubWindow(await buildPayStubViewHtml(stub), true)
  }

  useEffect(() => {
    if (activeTab === 'hours' && canAccessPay && Object.keys(payConfig).length > 0) {
      const dups = findPersonUserDuplicates(people, users, payConfig)
      setMergeDuplicates(dups)
    } else {
      setMergeDuplicates([])
    }
  }, [activeTab, payConfig, people, users])

  async function loadHoursDisplayOrder() {
    if (!canAccessHours && !canAccessPay) return
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

  useEffect(() => {
    if (activeTab !== 'hours' || !canOpenHoursTab) {
      hoursTabFirstLoadCycleStartedRef.current = false
      return
    }
    const t = setTimeout(() => {
      hoursTabFirstLoadCycleStartedRef.current = true
      setHoursTabLoading(true)
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
      if (canAccessPay) {
        loads.push(loadTeams())
      }
      // J7-6: the archived-name set decides which pay-config rows the grid hides. It used to load
      // only under canAccessPay, so an hours-only assistant saw every archived helper as a
      // zero-hour row the owner's grid did not have. Every viewer who can open the grid loads it.
      if (canAccessHours || canAccessPay) {
        loads.push(loadArchivedUserNames())
        loads.push(loadRosterPeople())
      }
      void Promise.all(loads).finally(() => setHoursTabLoading(false))
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab, canOpenHoursTab, canAccessHours, canAccessPay, hoursDateStart, hoursDateEnd])

  // Employment tab reads payConfig + template indicators; load them here since the
  // hours-tab load cycle (the usual owner) may never have run this session.
  useEffect(() => {
    if (activeTab !== 'employment' || !canAccessPay) return
    const t = setTimeout(() => {
      void loadPayConfig()
      void loadPayConfigSalaryTemplateIndicators()
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab, canAccessPay])

  // Balances estimates unreported weeks at current pay config (v2.3689); the map's usual
  // owner is the hours-tab cycle, which may never have run this session.
  useEffect(() => {
    if (activeTab !== 'pay_stubs' || payrollView !== 'ledger' || !canAccessPay) return
    const t = setTimeout(() => void loadPayConfig(), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, payrollView, canAccessPay])

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
    if (!draftPayrollModalOpen) {
      setDraftPayrollHoursBreakdownPerson(null)
      // A payroll-origin day editor has no anchor once Draft Payroll closes underneath it.
      setHoursMyTimeEditor((prev) => (prev?.payrollOrigin ? null : prev))
    }
  }, [draftPayrollModalOpen])

  useEffect(() => {
    if (activeTab === 'review' && isDev) {
      const t = setTimeout(() => {
        void loadPayConfig()
        void loadArchivedUserNames()
        void loadRosterPeople()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, isDev])

  /** Contracts groups archived people at the bottom (v2.1409) and Offsets folds them into an Archived users section (v2.1669) — both need the archived-user-name set, which otherwise only loads for pay/hours/review surfaces. */
  useEffect(() => {
    if ((activeTab === 'contracts' && canAccessContracts) || activeTab === 'offsets') {
      const t = setTimeout(() => {
        void loadArchivedUserNames()
      }, 80)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadArchivedUserNames is a stable page-level loader (same convention as the review-tab effect above)
  }, [activeTab, canAccessContracts])

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
  // Draft Payroll → Hours breakdown → day click bridge. Hides the breakdown (the editor's
  // overlay z-index 1200 sits below the breakdown's 1215) and opens the shared My Time editor
  // with the pay period as the save fence (payrollOrigin → saveableRangeOverride). The breakdown
  // re-opens on editor close/save; its re-mount refetches fresh rows.
  const handleDraftPayrollBreakdownOpenDayEditor = useCallback(
    (personName: string, dateYmd: string) => {
      const trimmedName = personName.trim()
      const trimmedDate = dateYmd.trim()
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
      setDraftPayrollHoursBreakdownPerson(null)
      setHoursMyTimeEditor({
        subjectUserId: u.id,
        subjectDisplayName: u.name?.trim() ?? trimmedName,
        dateStr: trimmedDate,
        payrollOrigin: {
          personName: trimmedName,
          periodStart: payStubPeriodStart,
          periodEnd: payStubPeriodEnd,
        },
      })
    },
    [showToast, payStubPeriodStart, payStubPeriodEnd],
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
    } catch {
      showToast('Could not build draft session for that date.', 'error')
    }
  }

  function getHoursForPersonDate(personName: string, workDate: string): number {
    const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function canEditHours(personName: string): boolean {
    return canEditRecordedHours(payConfig[personName])
  }

  /** Hours-surface display (record_hours_but_salary people show their logged hours). */
  function getDisplayHours(personName: string, workDate: string): number {
    return effectiveHoursForDisplay(payConfig[personName], workDate, getHoursForPersonDate(personName, workDate))
  }

  /**
   * Pending (unapproved) closed clock sessions on the Hours grid: avoids showing 0 after creating
   * a session from manual entry until approval merges into people_hours. Excludes revoked sessions
   * (which still load via the `approved_at IS NULL AND rejected_at IS NULL` filter because revoke
   * only sets `revoked_at`) so revoked hours drop off the grid as soon as `people_hours` updates.
   */
  const hoursGridNameJoin = useMemo(() => buildHoursGridNameJoin(users), [users])
  /** v2.839: one memoized raw-sums map replaces per-cell users.find scans and shares the badge map's join, so cell and badge can never disagree. */
  const pendingHoursSumsByCell = useMemo(
    () => buildClosedPendingHoursSumsByCell(pendingClockSessions, hoursGridNameJoin.personNameByUserId),
    [pendingClockSessions, hoursGridNameJoin],
  )
  function sumClosedPendingClockHoursForPersonDate(personName: string, workDate: string): number {
    return pendingHoursSumsByCell.get(pendingByCellKey(personName.trim(), workDate)) ?? 0
  }
  /** Approved clock hours per cell (v2.4263): the grid stops before a typed 0 writes over them. */
  const approvedHoursSumsByCell = useMemo(
    () => buildClosedPendingHoursSumsByCell(approvedClockSessions, hoursGridNameJoin.personNameByUserId),
    [approvedClockSessions, hoursGridNameJoin],
  )
  const approvedClockHoursForCell = useCallback(
    (personName: string, workDate: string) => approvedHoursSumsByCell.get(pendingByCellKey(personName.trim(), workDate)) ?? 0,
    [approvedHoursSumsByCell],
  )
  const onTypedOverClockHours = useCallback(
    (personName: string, workDate: string, clockHours: number) => {
      void (async () => {
        const ok = await confirmDialog({
          message: `${personName} · ${formatWorkDateYmdWeekdayShortFriendly(workDate)} has ${clockHours.toFixed(2)} h approved from the clock. A 0 typed here would take those hours out of pay without changing the clock. Open the day and change the sessions instead — that is recorded, and someone else looks at it.`,
          confirmLabel: 'Open the day',
        })
        if (ok) openHoursMyTimeForGridCell(personName, workDate)
      })()
    },
    [confirmDialog, openHoursMyTimeForGridCell],
  )

  /** Hours matrix: max(people_hours, pending clock) so manual-offer → session path stays visible; salary-only rows unchanged. */
  function getHoursGridDisplayHours(personName: string, workDate: string): number {
    return effectiveHoursForDisplay(
      payConfig[personName],
      workDate,
      Math.max(getHoursForPersonDate(personName, workDate), sumClosedPendingClockHoursForPersonDate(personName, workDate)),
    )
  }

  function getCostForPersonDate(personName: string, workDate: string): number {
    return hoursGridDayCost(payConfig[personName], workDate, getHoursForPersonDate(personName, workDate))
  }

  const { getPayrollEffectiveHours, getPayrollCostForPersonDate } = usePayrollPreviewPricing({
    enabled: draftPayrollModalOpen && canAccessPay,
    periodStart: payStubPeriodStart,
    periodEnd: payStubPeriodEnd,
    payConfig,
    users,
    getHoursForPersonDate,
  })

  /** Widens Hours tab range if needed so a payroll-modal date can appear as a column (en-CA strings sort chronologically). Never widens below the assistant floor. */
  function ensureHoursRangeIncludesDate(workDate: string) {
    if (workDate < hoursDateStart) setHoursDateStartClamped(workDate)
    if (workDate > hoursDateEnd) setHoursDateEnd(workDate)
  }

  // One roster for every role (J7-6): pay-config rows minus archived account names, minus what the
  // roster view says is not a person (a twin, a sample, an archived roster row — v2.3698), in org
  // display order. Both the RPC and the view load for hours-only viewers too (see the hours-tab load
  // cycle) and run with owner rights, so every viewer gets the same list.
  const showPeopleForHours = useMemo(
    () => buildHoursGridRoster({ payConfigRows: payConfigRowsForRoster(payConfig), archivedUserNames, payRoster, displayOrder: hoursDisplayOrder }),
    [payConfig, archivedUserNames, payRoster, hoursDisplayOrder],
  )
  const hoursDays = useMemo(() => getDaysInRange(hoursDateStart, hoursDateEnd), [hoursDateStart, hoursDateEnd])
  // ── Payroll catch-up (v2.2034): earlier weeks with hours but no report ──
  const {
    catchUpModalOpen,
    setCatchUpModalOpen,
    catchUpRows,
    catchUpLoading,
    catchUpScanFrom,
    catchUpGeneratingKey,
    catchUpUnreportedCount,
    extendCatchUpScan,
    loadUnreportedWeeksForPerson,
    generateCatchUpReport,
  } = usePayrollCatchUp({
    enabled: draftPayrollModalOpen && canAccessPay,
    canAccessPay,
    periodStart: payStubPeriodStart,
    payConfig,
    peopleNames: showPeopleForHours,
    payStubs,
    generateReport: (personName, weekStart, weekEnd) => generatePayStub(personName, { periodStart: weekStart, periodEnd: weekEnd }),
    setError,
  })
  const { bulkGeneratingPayStubs, bulkGenerateConfirm, setBulkGenerateConfirm, bulkGenerateMissingPayStubsInModal, runBulkGeneratePayStubs } = useBulkGeneratePayStubs({
    periodStart: payStubPeriodStart,
    periodEnd: payStubPeriodEnd,
    peopleNames: showPeopleForHours,
    payStubs,
    costForPersonDate: getPayrollCostForPersonDate,
    generateReport: (personName) => generatePayStub(personName),
    setError,
    showToast,
  })
  const addSessionPeople = useMemo(
    () => buildAddSessionPeople(showPeopleForHours, users),
    [showPeopleForHours, users],
  )
  // Cost-desc, the old cost-matrix default order — Due summaries keep reading this list.
  // The same figure `getCostForPersonDate` gives, summed once per person over the range.
  const showPeopleForMatrix = useMemo(() => {
    const hoursFor = recordedHoursLookup(peopleHours)
    return sortPeopleByTotalDesc(showPeopleForHours, (p) => hoursDays.reduce((s, d) => s + hoursGridDayCost(payConfig[p], d, hoursFor(p, d)), 0))
  }, [showPeopleForHours, hoursDays, payConfig, peopleHours])

  const forecastUnpaidRows = useMemo(() => payrollForecastUnpaidRows(payStubs, payStubLineMaps), [payStubs, payStubLineMaps])

  function shiftHoursWeek(delta: number) {
    const dStart = new Date(hoursDateStart + 'T12:00:00')
    const dEnd = new Date(hoursDateEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    const clamped = clampHoursRangeToFloor(
      localCalendarDayKey(dStart),
      localCalendarDayKey(dEnd),
      hoursFloorYmd
    )
    setHoursDateStart(clamped.start)
    setHoursDateEnd(clamped.end)
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
      periodStart: localCalendarDayKey(priorSunday),
      periodEnd: localCalendarDayKey(priorSaturday),
    }
  }

  function shiftPayStubWeek(delta: number) {
    const dStart = new Date(payStubPeriodStart + 'T12:00:00')
    const dEnd = new Date(payStubPeriodEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setPayStubPeriodStart(localCalendarDayKey(dStart))
    setPayStubPeriodEnd(localCalendarDayKey(dEnd))
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
  // Typed hours (v2.4247): the pending sessions someone typed hours onto — the cell badge wears a pencil for them.
  const pendingClockSessionIds = useMemo(() => pendingClockSessions.map((s) => s.id), [pendingClockSessions])
  const pendingClockSessionsVersion = useMemo(() => typedStampsVersion(pendingClockSessions), [pendingClockSessions])
  const { stamps: pendingTypedStamps } = useTypedStamps(pendingClockSessionIds, pendingClockSessionsVersion)
  const typedPendingSessionIds = useMemo(() => {
    const out = new Set<string>()
    for (const [id, stamp] of pendingTypedStamps) if (needsSecondLook(stamp)) out.add(id)
    return out
  }, [pendingTypedStamps])
  /** People → Hours (J7-4): open sessions per day column, so the header can say "+N on the clock" next to a closed-sessions-only total. */
  const hoursGridLiveByWorkDate = useMemo(
    () =>
      buildHoursGridLiveByWorkDate({
        activeClockSessions,
        peopleNames: showPeopleForHours,
        workDates: hoursDays,
        users,
        nowMs: Date.now(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showPeopleForHours is rebuilt each render; payConfig/archived/roster/order are its inputs
    [activeClockSessions, hoursDays, users, payConfig, archivedUserNames, payRoster, hoursDisplayOrder],
  )
  const peopleHoursPendingSummary = useMemo(
    () => summarizePeopleHoursPendingByCell(peopleHoursPendingByCellMap),
    [peopleHoursPendingByCellMap],
  )
  /** "+N sessions in earlier weeks" (Tier-1 #15, J7-2): all-weeks RPC count minus the closed pending sessions loaded for the visible range. */
  const pendingOutsideWeekLine = useMemo(
    () =>
      describePendingOutsideVisibleWeek(
        pendingOutsideVisibleWeek(pendingApprovalsAllWeeks?.sessions ?? null, countClosedPendingSessions(pendingClockSessions)),
        hoursDateEnd,
        denverCalendarDayKey(Date.now()),
      ),
    [pendingApprovalsAllWeeks?.sessions, pendingClockSessions, hoursDateEnd],
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

  const canEditUserNotes = authUserRole !== null && ['dev', 'master_technician', 'assistant', 'controller'].includes(authUserRole)
  /** v2.3611 Supervision: who may flip a helper's or sub's switch — mirrors `users_guard_privileged_columns`. */
  const canSetNeedsSupervision = authUserRole !== null && ['dev', 'master_technician', 'assistant'].includes(authUserRole)
  const setNeedsSupervision = useCallback(
    async (userId: string, needsSupervision: boolean) => {
      setError(null)
      // Reconcile from what the DB returned: RLS filters a blocked UPDATE to zero rows, the guard raises.
      const { data, error: err } = await supabase.from('users').update({ needs_supervision: needsSupervision }).eq('id', userId).select('id, needs_supervision')
      if (err) {
        setError(err.message)
        return
      }
      if (!data?.[0]) {
        setError('That change did not apply — you may not have permission to change this account.')
        return
      }
      showToast(needsSupervision ? 'Back under supervision.' : 'Marked as able to run a job.', 'success')
      await loadPeople()
    },
    [loadPeople, showToast],
  )
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

  // Six top-level groups; every view keeps its own gate (v2.2811). A group shows when any of
  // its views would have shown as a tab before; the second row lists the active group's views.
  const visiblePeopleTabs: Partial<Record<PeopleTab, boolean>> = {
    users: true,
    subs: true,
    person: canOpenPersonDesk(authRole),
    day_book: canSeeDayBook,
    whos_where: canSeeWhosWhere,
    hours: canOpenHoursTab,
    pay_stubs: canAccessPay,
    offsets: canAccessPay,
    employment: canAccessPay,
    overhead: canAccessOverheadTab,
    contracts: canAccessContracts,
    licenses: canAccessLicenses,
    writeups: canAccessContracts,
    hr: isDev,
    vehicles: canAccessVehicles,
    housing: canAccessPay,
    review: isDev,
    scoreboard: isDev,
    activity: canSeeActivityTab,
    feedback: isDev,
  }
  const tabGroups = visibleTabGroups(visiblePeopleTabs)
  const activeGroupId = groupOfTab(activeTab)
  const activeGroup = tabGroups.find((g) => g.id === activeGroupId)
  /** The second row: only when the active group offers a choice. */
  const activeSubTabs = activeGroup && activeGroup.views.length > 1 ? activeGroup : null
  /** Where the Day book was left, for the next time its tab opens (its params leave the URL with it). */
  const dayBookMemoryRef = useRef<DayBookDoor | null>(null)
  function goToPeopleTab(tab: PeopleTab) {
    setActiveTab(tab)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      // The Day book's week and person leave the URL with it; the page remembers them.
      if (tab !== 'day_book') dropDayBookDoorParams(next)
      return next
    })
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      {hoursGridFirstColMeasurer}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: activeSubTabs ? 'none' : '1px solid var(--border)', marginBottom: activeSubTabs ? 0 : '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div role="tablist" aria-label="People sections" style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
            {tabGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === activeGroupId}
                onClick={() => {
                  const target = landingViewForGroup(g, tabGroupMemory)
                  if (!target) return
                  goToPeopleTab(target)
                }}
                style={tabStyle(g.id === activeGroupId)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <h1 style={{ flexShrink: 0, margin: 0, marginLeft: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>People</h1>
      </div>
      {activeSubTabs ? (
        <div
          role="tablist"
          aria-label={`${activeSubTabs.label} views`}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0 0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}
        >
          {activeSubTabs.views.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === activeTab}
              onClick={() => goToPeopleTab(v)}
              style={pageSubTabStyle(v === activeTab)}
              title={v === 'person' ? 'One person, every control — the Person Desk as a page' : undefined}
            >
              {PEOPLE_TAB_LABELS[v]}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'subs' && <PeopleSubsTab />}

      {activeTab === 'users' && (
        <PeopleUsersTab
          reloadRoster={() => void loadPeople()}
          isDev={isDev}
          narrowViewport={narrowViewport}
          users={users}
          people={people}
          error={error}
          setError={setError}
          canAccessContracts={canAccessContracts}
          canSeePushStatus={canSeePushStatus}
          canEditUserNotes={canEditUserNotes}
          setNeedsSupervision={canSetNeedsSupervision ? setNeedsSupervision : undefined}
          canCreatePeopleInRoster={canCreatePeopleInRoster}
          onOpenHire={canCreatePeopleInRoster && authUser?.id ? () => setHireOpen(true) : undefined}
          payLens={
            canAccessPay && Object.keys(payConfig).length > 0
              ? { payConfig, payConfigDraft, payConfigOfficeWageDraft, payConfigSaving, salaryTemplateByPersonName, onUpsertPayConfig: upsertPayConfig, onHourlyWageChange: updatePayConfigHourlyWage, onOfficeHourlyWageChange: updatePayConfigOfficeHourlyWage }
              : undefined
          }
          setTrainingMode={isDev || authUserRole === 'controller' || (authUserRole === 'master_technician' && canAccessPay) ? setTrainingMode : undefined}
          canEditWorkdayOverrides={isDev || authUserRole === 'master_technician' || authUserRole === 'assistant' || authUserRole === 'controller'}
          authUserId={authUser?.id}
          creatorNames={creatorNames}
          archivedPeople={archivedPeople}
          usersTabTags={usersTabTags}
          showToast={showToast}
          setEditingUserNote={setEditingUserNote}
          openAdd={openAdd}
          openEdit={openEdit}
          linkPersonToAccount={linkPersonToAccount}
          archivePerson={archivePerson}
          archivingId={archivingId}
          restorePerson={restorePerson}
          restoringId={restoringId}
          isAlreadyUser={isAlreadyUser}
          invitingId={invitingId}
          setInviteConfirm={setInviteConfirm}
        />
      )}

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

      {activeTab === 'pay_stubs' && canAccessPay && isDev ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <div role="tablist" aria-label="Payroll view" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
            {(
              [
                ['reports', 'Pay run'],
                ['ledger', 'Balances'],
                ['payments', 'Payments'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={payrollView === v}
                onClick={() => {
                  setPayrollView(v)
                  const next = new URLSearchParams(searchParams)
                  if (v === 'ledger' || v === 'payments') {
                    next.set('view', v)
                    if (v === 'payments') next.delete('person')
                  } else {
                    next.delete('view')
                    next.delete('person')
                  }
                  setSearchParams(next, { replace: true })
                }}
                style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.3rem 0.8rem', border: 'none', background: payrollView === v ? 'var(--text-link)' : 'var(--surface)', color: payrollView === v ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'pay_stubs' && canAccessPay && isDev && payrollView === 'ledger' && (
        <PeoplePayLedgerView
          payStubs={payStubs}
          payStubPaymentsByStubId={payStubPaymentsByStubId}
          payStubDeductionsByStubId={payStubDeductionsByStubId}
          payStubAdditionalByStubId={payStubAdditionalByStubId}
          onViewStub={(stub) => void viewPayStubInModal(stub)}
          onRecordPayment={openPayStubMarkPaidModal}
          onError={setError}
          loadPayStubs={loadPayStubs}
          loadUnreportedWeeks={loadUnreportedWeeksForPerson}
          onGenerateReport={generateCatchUpReport}
          authUserId={authUser?.id ?? null}
          showToast={showToast}
        />
      )}

      {activeTab === 'pay_stubs' && canAccessPay && isDev && payrollView === 'payments' && (
        <PayRunPaymentsView onViewStub={(stub) => void viewPayStubInModal(stub)} />
      )}

      {activeTab === 'pay_stubs' && canAccessPay && !(isDev && payrollView !== 'reports') && (
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
          onViewStub={(stub) => void viewPayStubInModal(stub)}
          onRecordPayment={openPayStubMarkPaidModal}
          markingPayStubId={markingPayStubId}
          onRequestDeleteStub={(stub) => setPayStubDeleteConfirm(stub)}
          deletingPayStubId={deletingPayStubId}
          onOpenMyTimeForDay={({ dateStr, subjectUserId, subjectDisplayName, saveableRange }) =>
            setHoursMyTimeEditor({ dateStr, subjectUserId, subjectDisplayName, saveableRange })
          }
          upcomingRefreshTick={ledgerUpcomingRefreshTick}
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

      {hireOpen && authUser?.id ? (
        <HirePersonModal
          authUserId={authUser.id}
          isDev={isDev}
          canAccessPay={canAccessPay}
          canAccessContracts={canAccessContracts}
          onClose={() => setHireOpen(false)}
          onHired={() => {
            void loadPeople()
            void loadPayConfig()
          }}
        />
      ) : null}
      {payStubDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL_NESTED }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Delete this pay report for {payStubDeleteConfirm.person_name} ({new Date(payStubDeleteConfirm.period_start + 'T12:00:00').toLocaleDateString()} – {new Date(payStubDeleteConfirm.period_end + 'T12:00:00').toLocaleDateString()})? A dev can put it back for 90 days from Settings → Data &amp; migration → Recently deleted.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPayStubDeleteConfirm(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
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

      <BulkGeneratePayStubsConfirm
        confirm={bulkGenerateConfirm}
        onCancel={() => setBulkGenerateConfirm(null)}
        onConfirm={(candidates) => {
          setBulkGenerateConfirm(null)
          void runBulkGeneratePayStubs(candidates)
        }}
      />

      <RecordPayStubPaymentModal recordPayment={recordPayment} personNameOptions={offsetPersonNameOptions} onOffsetError={(msg) => showToast(msg, 'error')} />

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
          getCostForPersonDate={getPayrollCostForPersonDate}
          getEffectiveHours={getPayrollEffectiveHours}
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
          catchUpCount={catchUpUnreportedCount}
          onOpenCatchUp={() => setCatchUpModalOpen(true)}
        />
      )}

      {draftPayrollModalOpen && activeTab === 'pay_stubs' && canAccessPay && (
        <PayrollCatchUpModal
          open={catchUpModalOpen}
          onClose={() => setCatchUpModalOpen(false)}
          zIndex={Z_PEOPLE_PAY_MODAL + 50}
          rows={catchUpRows ?? []}
          loading={catchUpLoading}
          scannedFrom={catchUpScanFrom}
          payStubs={payStubs}
          payStubPaymentsByStubId={payStubPaymentsByStubId}
          payStubDeductionsByStubId={payStubDeductionsByStubId}
          payStubAdditionalByStubId={payStubAdditionalByStubId}
          generatingKey={catchUpGeneratingKey}
          markingPayStubId={markingPayStubId}
          onGenerateForWeek={generateCatchUpReport}
          onViewStub={(stub) => void viewPayStub(stub)}
          onRecordPayment={openPayStubMarkPaidModal}
          onOpenWeek={(weekStart, weekEnd) => {
            setPayStubPeriodStart(weekStart)
            setPayStubPeriodEnd(weekEnd)
            setCatchUpModalOpen(false)
          }}
          onExtendScan={extendCatchUpScan}
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
          onOpenDayEditor={(d) => handleDraftPayrollBreakdownOpenDayEditor(draftPayrollHoursBreakdownPerson, d)}
        />
      ) : null}

      {activeTab === 'hours' && canOpenHoursTab && (
        <>
        <div>
          {hoursTabLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
          {hoursPhone ? (
            <PeopleHoursPhoneView
              view={hoursPhoneView}
              onView={setHoursPhoneView}
              viewer={{ role: authRole, isDev, canAccessPay, canAccessHours, canAccessVehicles, canAccessLicenses, canAccessContracts, readOnly: authReadOnly }}
              viewerUserId={authUser?.id ?? null}
              reloadKey={approvalsQueueReloadKey}
              onChanged={() => {
                loadAllClockSessionsRef.current?.()
                loadPeopleHoursRef.current?.()
                refreshPendingApprovalsCount()
              }}
            />
          ) : null}
          {canAccessPay && hoursPhoneRest ? (
            <>
              {hoursApprovedNudge ? (
                <HoursApprovedNudgeChip
                  nudge={hoursApprovedNudge}
                  onOpen={openDraftPayrollFromHours}
                  onDismiss={() => setHoursApprovedNudge(null)}
                />
              ) : null}
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Review Hours <span style={{ color: 'var(--text-green-600)' }}>✓</span>
                  </button>
                </div>
              </div>
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
                  onReviewedChange={() => {}}
                  onClose={() => setReviewHoursModalOpen(false)}
                />
              ) : null}
            </>
          ) : null}
          {/* On a phone the tab as it was — the clock strip, the grid with its day sheets, the sessions — is the third view (v2.3889): hidden, not unmounted, under the other two. */}
          <div style={hoursPhoneRest ? HOURS_TAB_SECTIONS_STACK : { display: 'none' }}>
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
              <button type="button" onClick={() => jumpToHoursTabSection('clockStrip')} style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Clock strip
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => jumpToHoursTabSection('week')}
              style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Week
            </button>
            {canAccessHours ? (
              <button type="button" onClick={() => jumpToHoursTabSection('grid')} style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Hours grid
              </button>
            ) : null}
            {canAccessHours ? (
              <button type="button" onClick={() => jumpToHoursTabSection('sessions')} style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Sessions
              </button>
            ) : null}
            {canAccessPay ? (
              <button type="button" onClick={() => jumpToHoursTabSection('dueSummaries')} style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Due totals
              </button>
            ) : null}
            {canAccessPay ? (
              <button type="button" onClick={() => jumpToHoursTabSection('teams')} style={{ padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Teams
              </button>
            ) : null}
          </div>
          {canAccessHours ? (
          <section id="people-hours-clock-strip" style={HOURS_TAB_SECTION_SHELL}>
            <div style={{ ...hoursTabSectionHeaderGap(hoursTabSectionsOpen.clockStrip), display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                aria-expanded={hoursTabSectionsOpen.clockStrip}
                onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, clockStrip: !p.clockStrip }))}
                style={HOURS_TAB_SECTION_TOGGLE_BTN}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.clockStrip ? '▼' : '▶'}</span>
                Currently clocked in
              </button>
              <button
                type="button"
                onClick={() => setMatchSessionsOpen(true)}
                aria-label="Match unassigned clock sessions to jobs and bids"
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.7rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                  // Amber "needs sorting" voice when sessions are waiting; quiet outline at zero.
                  ...((unassignedSessionCount ?? 0) > 0
                    ? { border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
                    : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }),
                }}
              >
                Match sessions
                {(unassignedSessionCount ?? 0) > 0 ? (
                  <span style={{ background: '#d97706', color: '#fff', borderRadius: 999, padding: '0 0.45rem', fontSize: '0.71875rem', fontWeight: 800, lineHeight: 1.5 }}>
                    {unassignedSessionCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setApprovalsQueueOpen(true)}
                aria-label="Open the hours approvals queue for every week"
                title="Every pending session, all weeks"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.7rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                  ...((pendingApprovalsAllWeeks?.sessions ?? 0) > 0
                    ? { border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
                    : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }),
                }}
              >
                Approvals
                {(pendingApprovalsAllWeeks?.sessions ?? 0) > 0 ? (
                  <span style={{ background: '#d97706', color: '#fff', borderRadius: 999, padding: '0 0.45rem', fontSize: '0.71875rem', fontWeight: 800, lineHeight: 1.5 }}>
                    {pendingApprovalsAllWeeks?.sessions}
                  </span>
                ) : null}
              </button>
            </div>
            {hoursTabSectionsOpen.clockStrip ? <PeopleHoursDashboardClockStrip onSessionsChanged={() => loadAllClockSessionsRef.current?.()} addSessionPeople={addSessionPeople} minDateYmd={hoursFloorYmd} /> : null}
          </section>
          ) : null}
          <PeopleHoursWeekRange
            narrowViewport={narrowViewport}
            hoursDateStart={hoursDateStart}
            hoursDateEnd={hoursDateEnd}
            setHoursDateStart={setHoursDateStartClamped}
            setHoursDateEnd={setHoursDateEndClamped}
            shiftHoursWeek={shiftHoursWeek}
            minDateYmd={hoursFloorYmd}
          />
          {canAccessHours && (
          <>
          <section id="people-hours-grid" style={HOURS_TAB_SECTION_SHELL}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', ...hoursTabSectionHeaderGap(hoursTabSectionsOpen.grid) }}>
              <button
                type="button"
                aria-expanded={hoursTabSectionsOpen.grid}
                onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, grid: !p.grid }))}
                style={HOURS_TAB_SECTION_TOGGLE_BTN}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.grid ? '▼' : '▶'}</span>
                Hours grid
              </button>
              {canEditCrewJobs ? (
                <button
                  type="button"
                  onClick={() => setAlignHoursOpen(true)}
                  disabled={alignHoursQueueCount === 0}
                  title="Link this week's clock sessions that have no job or bid"
                  style={{
                    padding: '0.25rem 0.55rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--bg-muted)',
                    cursor: alignHoursQueueCount === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8125rem',
                    color: alignHoursQueueCount === 0 ? 'var(--text-muted)' : undefined,
                  }}
                >
                  Align hours{alignHoursQueueCount > 0 ? ` (${alignHoursQueueCount})` : ''}
                </button>
              ) : null}
            </div>
            {hoursTabSectionsOpen.grid ? (
            <>
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{EMPTY_HOURS_ROSTER_MESSAGE}</p>
          ) : (
            <>
              <PeopleHoursGridJobHighlight
                selectedJobHighlight={selectedJobHighlight}
                setSelectedJobHighlight={setSelectedJobHighlight}
              />
              {selectedJobHighlight && jobHighlightPeople.size === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                  No one in this list has that job on crew assignments this week.
                </p>
              ) : null}
              <PeopleHoursPendingBanner
                summary={peopleHoursPendingSummary}
                canAccessHours={canAccessHours}
                canAccessPay={canAccessPay}
                onReviewApprove={() => setBulkApprovePendingOpen(true)}
                onOpenQueue={() => setApprovalsQueueOpen(true)}
                outsideWeekLine={pendingOutsideWeekLine}
              />
              <PeopleHoursGrid
                hoursTableScrollRef={hoursTableScrollRef}
                hoursGridFirstColW={hoursGridFirstColW}
                hoursDays={hoursDays}
                showPeopleForHours={showPeopleForHours}
                peopleHoursPendingByCellMap={peopleHoursPendingByCellMap}
                liveByWorkDate={hoursGridLiveByWorkDate}
                jobHighlightPeople={jobHighlightPeople}
                jobHighlightCells={jobHighlightCells}
                hoursFlashWorkDate={hoursFlashWorkDate}
                hoursFlashPersonName={hoursFlashPersonName}
                hoursDaysCorrect={hoursDaysCorrect}
                typedPendingSessionIds={typedPendingSessionIds}
                approvedClockHoursForCell={approvedClockHoursForCell}
                onTypedOverClockHours={onTypedOverClockHours}
                users={users}
                canEditCrewJobs={canEditCrewJobs}
                canAccessHours={canAccessHours}
                canAccessPay={canAccessPay}
                hasUnassignedCorrectDays={hasUnassignedCorrectDays}
                canEditHours={canEditHours}
                isCorrectDayMissingJob={isCorrectDayMissingJob}
                getHoursGridDisplayHours={getHoursGridDisplayHours}
                moveHoursRow={moveHoursRow}
                setHoursUnassignedModal={setHoursUnassignedModal}
                setHoursDayAuditModal={setHoursDayAuditModal}
                openHoursMyTimeForGridCell={openHoursMyTimeForGridCell}
                setPendingCellPopover={setPendingCellPopover}
                toggleHoursDayCorrect={toggleHoursDayCorrect}
                saveHours={saveHours}
                openManualHoursDraftFromBlur={openManualHoursDraftFromBlur}
              />
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
          {canAccessPay && (
          <div style={HOURS_TAB_SECTIONS_STACK}>
            <>
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            <PeopleHoursDueSummaries
              open={hoursTabSectionsOpen.dueSummaries}
              onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, dueSummaries: !p.dueSummaries }))}
              teamsFiltered={teamsFiltered}
              teamPeriodStart={teamPeriodStart}
              teamPeriodEnd={teamPeriodEnd}
              getCostForPersonDateTeams={getCostForPersonDateTeams}
            />
            <PeopleHoursTeams
              open={hoursTabSectionsOpen.teams}
              onToggle={() => setHoursTabSectionsOpen((p) => ({ ...p, teams: !p.teams }))}
              canAccessPay={canAccessPay}
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
            <section style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', border: '1px solid #f59e0b', borderRadius: 4 }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-amber-800)' }}>
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

      {activeTab === 'employment' && canAccessPay && (
        <PeopleEmploymentTab
          users={users}
          authUserId={authUser?.id ?? null}
          payConfig={payConfig}
          payConfigById={payConfigById}
          payConfigDraft={payConfigDraft}
          payConfigOfficeWageDraft={payConfigOfficeWageDraft}
          payConfigSaving={payConfigSaving}
          salaryTemplateByPersonName={salaryTemplateByPersonName}
          onUpsertPayConfig={upsertPayConfig}
          onHourlyWageChange={updatePayConfigHourlyWage}
          onOfficeHourlyWageChange={updatePayConfigOfficeHourlyWage}
          onViewPayReport={(stub) => void viewPayStubInModal(stub)}
        />
      )}

      {activeTab === 'vehicles' && canAccessVehicles && (
        <PeopleVehiclesTab users={users} />
      )}

      {activeTab === 'housing' && canAccessPay && (
        <PeopleHousingTab users={users} />
      )}

      {activeTab === 'offsets' && canAccessPay && (
        <PeopleOffsetsTab
          people={people}
          users={users}
          payStubs={payStubs}
          loadPayStubs={loadPayStubs}
          archivedUserNames={archivedUserNames}
          archivedPeople={archivedPeople}
        />
      )}

      {activeTab === 'licenses' && canAccessLicenses && (
        <PeopleLicensesTab people={people} users={users} />
      )}

      {activeTab === 'contracts' && canAccessContracts && (
        <PeopleContractsTab
          people={people}
          users={users}
          archivedPeople={archivedPeople}
          archivedUserNames={archivedUserNames}
          canDeletePeopleContracts={canDeletePeopleContracts}
          currentUserId={authUser?.id ?? null}
          isDev={isDev}
        />
      )}

      {activeTab === 'writeups' && canAccessContracts && authUser?.id ? (
        <WriteupsContractsSubTab
          users={users}
          userOptions={writeupUserSelectOptions}
          authUserId={authUser.id}
          isDev={isDev}
          myRole={authRole}
        />
      ) : null}

      {activeTab === 'scoreboard' && isDev && <PeopleScoreboardTab />}
      {/* 'hr' follows Scoreboard's pattern: no URL gate (isDev resolves async), render-site gated. */}
      {activeTab === 'hr' && isDev && <PeopleHrTab />}
      {/* 'person' (v2.2710): the Person Desk as a page; gate mirrors canOpenPersonDesk (office roles). */}
      {activeTab === 'person' && canOpenPersonDesk(authRole) && <PersonDeskPage />}
      {activeTab === 'review' && isDev && (
        <PeopleReviewTab
          payConfig={payConfig}
          archivedUserNames={archivedUserNames}
          payRoster={payRoster}
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

      {activeTab === 'day_book' && canSeeDayBook && (
        <PeopleDayBookTab authUserId={authUser?.id ?? null} authRole={authRole} canPickPerson={canPickDayBookPerson} memory={dayBookMemoryRef} />
      )}
      {activeTab === 'whos_where' && canSeeWhosWhere && <PeopleWhosWhereTab authRole={authRole} />}
      {activeTab === 'activity' && (
        <div>
          {!activityAccessResolved ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
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

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} onClick={(e) => { if (e.target === e.currentTarget && !saving) closeForm() }}>
          <div role="dialog" aria-modal="true" aria-labelledby="roster-form-title" style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(480px, 94vw)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <h2 id="roster-form-title" style={{ margin: 0, fontSize: '1.125rem' }}>{editing ? 'Edit person' : 'Add to roster'}</h2>
              {!editing ? (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  A roster row, no login. Their portal, paperwork and pay work from this alone. You can invite them to sign in now or later.
                </p>
              ) : null}
            </div>
            <form onSubmit={handleRosterFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!editing && (
                <div>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600 }}>They are a…</span>
                  <div role="radiogroup" aria-label="Kind" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={kind === k}
                        disabled={saving}
                        onClick={() => setKind(k)}
                        style={{ fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, padding: '0.15rem 0.65rem', cursor: 'pointer', fontFamily: 'inherit', border: kind === k ? '1px solid #2563eb' : '1px solid var(--border)', background: kind === k ? '#2563eb' : 'var(--surface)', color: kind === k ? '#fff' : 'var(--text-700)' }}
                      >
                        {KIND_LABELS[k].replace(/ies$/, 'y').replace(/s$/, '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="p-name" style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600 }}>Name *</label>
                <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} autoFocus style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label htmlFor="p-email" style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600 }}>Email</label>
                  <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.45rem' }} />
                </div>
                <div>
                  <label htmlFor="p-phone" style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600 }}>Phone</label>
                  <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.45rem' }} />
                </div>
              </div>
              <div>
                <label htmlFor="p-notes" style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600 }}>Notes</label>
                <textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} rows={2} style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              {!editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} title={email.trim() ? undefined : 'Needs an email'}>
                    <input type="checkbox" checked={rosterFormInviteAfter && Boolean(email.trim())} disabled={saving || !email.trim()} onChange={(e) => setRosterFormInviteAfter(e.target.checked)} />
                    Also invite them to sign in (sends an email)
                  </label>
                  {personDesk?.canOpen ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input type="checkbox" checked={rosterFormOpenDeskAfter} disabled={saving} onChange={(e) => setRosterFormOpenDeskAfter(e.target.checked)} />
                      Open their desk after saving
                    </label>
                  ) : null}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" disabled={saving} style={{ background: '#2563eb', color: '#fff', border: '1px solid #2563eb', borderRadius: 4, padding: '0.35rem 0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editing ? 'Save' : `Add${name.trim() ? ` ${name.trim()}` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {inviteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
          <div style={{ background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: 500, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem' }}>Full name, title, and phone</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{editingUserNote.name}</p>
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

      <MatchClockSessionsModal
        open={matchSessionsOpen}
        onClose={() => {
          setMatchSessionsOpen(false)
          refreshUnassignedSessionCount()
        }}
        onSessionsChanged={() => {
          refreshUnassignedSessionCount()
          loadAllClockSessionsRef.current?.()
          loadPeopleHoursRef.current?.()
        }}
      />

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
          onApproved={noteHoursApproved}
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

      {approvalsQueueOpen ? (
        <PeopleHoursApprovalsQueueModal
          reloadKey={approvalsQueueReloadKey}
          authUserId={authUser?.id}
          startTypedOnly={approvalsQueueTypedOnly}
          startTypist={approvalsQueueTypist}
          onOpenDay={(day) => setHoursMyTimeEditor({ subjectUserId: day.userId, subjectDisplayName: day.personName, dateStr: day.workDate })}
          onClose={() => {
            setApprovalsQueueOpen(false)
            setApprovalsQueueTypedOnly(false)
            setApprovalsQueueTypist(null)
          }}
          onChanged={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
            refreshPendingApprovalsCount()
          }}
          onApproved={noteHoursApproved}
          onEditSession={(s) => {
            setEditClockSession(s)
            setError(null)
          }}
        />
      ) : null}

      {bulkApprovePendingOpen ? (
        <PeopleHoursBulkApprovePendingModal
          pendingByCellMap={peopleHoursPendingByCellMap}
          payConfigFor={(name) => payConfig[name]}
          onClose={() => setBulkApprovePendingOpen(false)}
          onApproved={() => {
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
            noteHoursApproved(null)
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
          onSaved={() => {
            loadAllClockSessionsRef.current?.()
            setApprovalsQueueReloadKey((k) => k + 1)
          }}
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
          onPatchSeededSessionsTimes={({ sessionId, clocked_in_at, clocked_out_at, work_date }) => {
            setHoursManualDraftEditor((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                draftSessions: prev.draftSessions.map((s) =>
                  s.id === sessionId ? { ...s, clocked_in_at, clocked_out_at, work_date } : s,
                ),
              }
            })
          }}
        />
      )}

      {payStubViewModal && (
        <PayStubViewModal
          title={payStubViewModal.title}
          html={payStubViewModal.html}
          zIndex={Z_PEOPLE_PAY_MODAL}
          onClose={() => setPayStubViewModal(null)}
        />
      )}

      {alignHoursOpen && (
        <PeopleHoursAlignModal
          sessions={alignHoursSessions}
          authUserId={authUser?.id}
          onOpenDayEditor={openHoursMyTimeFromSession}
          onClose={() => {
            setAlignHoursOpen(false)
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
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
          saveableRangeOverride={
            hoursMyTimeEditor.payrollOrigin
              ? {
                  start: hoursMyTimeEditor.payrollOrigin.periodStart,
                  end: hoursMyTimeEditor.payrollOrigin.periodEnd,
                }
              : hoursMyTimeEditor.saveableRange
          }
          onClose={() => {
            // Cancelling without saving: nothing changed, no Team Summary
            // refresh needed. Just clear the review-origin marker so a
            // subsequent unrelated open doesn't accidentally trigger a
            // re-open of the Hours drilldown.
            const payrollOrigin = hoursMyTimeEditor.payrollOrigin
            reviewHoursDayEditorPersonRef.current = null
            setHoursMyTimeEditor(null)
            // Draft Payroll origin: bring the Hours breakdown back (it was hidden while the
            // editor was open — its overlay z sits above the editor's).
            if (payrollOrigin) setDraftPayrollHoursBreakdownPerson(payrollOrigin.personName)
          }}
          onSaved={() => {
            const payrollOrigin = hoursMyTimeEditor.payrollOrigin
            const reopenPersonName = reviewHoursDayEditorPersonRef.current
            reviewHoursDayEditorPersonRef.current = null
            setHoursMyTimeEditor(null)
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
            // Ledger upcoming-payroll data derives from clock sessions — refetch after any save.
            setLedgerUpcomingRefreshTick((n) => n + 1)
            if (payrollOrigin) {
              // Draft Payroll origin: explicit refresh — the hours-tab refreshers above are
              // gated to activeTab === 'hours' and the realtime clock-sessions handler only
              // reloads pending-approval counts, so the payroll totals would go stale.
              loadPeopleHours(payrollOrigin.periodStart, payrollOrigin.periodEnd)
              void loadHoursDaysCorrect(payrollOrigin.periodStart, payrollOrigin.periodEnd)
              void loadDraftPayrollPendingApprovals(payrollOrigin.periodStart, payrollOrigin.periodEnd)
              // Re-open the breakdown; the re-mount refetches fresh rows (people_hours was
              // resynced server-side by the save path).
              setDraftPayrollHoursBreakdownPerson(payrollOrigin.personName)
              return
            }
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
            // Draft Payroll origin: Adjust times saves fire this path (closing the editor with no
            // dirty timeline changes then exits via onClose, not onSaved), so refresh the
            // payroll-period data here or the Draft Payroll rows stay stale behind the breakdown.
            const payrollOrigin = hoursMyTimeEditor.payrollOrigin
            if (payrollOrigin) {
              loadPeopleHours(payrollOrigin.periodStart, payrollOrigin.periodEnd)
              void loadHoursDaysCorrect(payrollOrigin.periodStart, payrollOrigin.periodEnd)
              void loadDraftPayrollPendingApprovals(payrollOrigin.periodStart, payrollOrigin.periodEnd)
            }
          }}
        />
      )}

    </div>
  )
}
