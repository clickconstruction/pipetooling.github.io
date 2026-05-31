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
import { Link, useSearchParams } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  PAY_REPORT_ADDRESS,
  PAY_REPORT_EIN,
  PAY_REPORT_EMPLOYER_NAME,
} from '../constants/payReportEmployerHeader'
import { HOURS_GRID_FIRST_COL_LABEL } from '../constants/hoursGridFirstCol'
import { formatCurrency } from '../lib/format'
import { buildPayReportDocumentTitle } from '../lib/payReportDocumentTitle'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { formatDateRangeLabel } from '../utils/dateRangeLabel'
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

import { approveClockSessions } from '../lib/approveClockSessions'
import {
  isPayStubFullyPaid,
  PAY_STUB_PAY_FULLY_TOLERANCE,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../lib/payStubPayments'
import { PayStubAdditionalModal } from '../components/pay/PayStubAdditionalModal'
import { PayStubLessModal } from '../components/pay/PayStubLessModal'
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
import { stripPrevailingWageTag } from '../lib/payStubPrevailingWageLine'
import { findPersonUserDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import {
  deleteLabel,
  fetchLabelUsageCounts,
  fetchLabelsForMasterIds,
  fetchPeopleLabelsForPersonIds,
  fetchUserLabelsForUserIds,
  insertLabel,
  setPersonLabels,
  setUserLabels,
  slugifyLabelName,
  type LabelRow,
} from '../lib/labels'
import {
  deleteUserTagOrg,
  fetchTagOrgOverridesForUserIds,
  fetchUserTagOrgSignals,
  upsertUserTagOrg,
  type UserTagOrgSignals,
} from '../lib/tagOrg'
import {
  contractSigningIconTitle,
  type ContractSigningTrafficLight,
  rollupContractSigningStatusByPersonName,
} from '../lib/contractSigningRollup'
import { resolveManagerUserIdForFeedback } from '../lib/teamFeedback'
import { loginAsUser } from '../lib/loginAsUser'
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
import {
  AssignSessionJobPopover,
  ClockSessionsTable,
  ClockSessionsSection,
  formatClockSessionJobOrBidLabel,
  RejectedClockSessionsSection,
} from '../components/clock-sessions'
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
import { PayStubDeleteIcon } from '../components/pay/PayStubDeleteIcon'
import { PayStubPaidNoteIcon } from '../components/pay/PayStubPaidNoteIcon'
import type { ClockSessionRow } from '../types/clockSessions'

const KINDS: PersonKind[] = [
  'master_technician',
  'assistant',
  'primary',
  'estimator',
  'superintendent',
  'sub',
  'helper',
]
const KIND_LABELS: Record<PersonKind, string> = {
  assistant: 'Assistants',
  master_technician: 'Master Technicians',
  sub: 'Subcontractors',
  helper: 'Helper',
  estimator: 'Estimators',
  primary: 'Primaries',
  superintendent: 'Superintendents',
}

const KIND_TO_USER_ROLE: Record<PersonKind, string> = {
  assistant: 'assistant',
  master_technician: 'master_technician',
  sub: 'subcontractor',
  helper: 'helpers',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

function todayYyyyMmDdLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

function paidAtIsoFromYyyyMmDd(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toISOString()
}

/** Pay History Ledger: M/D without year (e.g. 3/1–3/7). */
function ledgerPayPeriodShortLabel(periodStartYmd: string, periodEndYmd: string): string {
  const md = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${md(periodStartYmd)}–${md(periodEndYmd)}`
}

const SHOW_USERS_TAB_TAGS_KEY = 'people.usersTab.showTags'
const SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY = 'people.usersTab.showTagOrgSignals'
/** Pay History overlays: base layer; nested dialogs (e.g. Record payment from Draft Payroll) must be higher. */
const Z_PEOPLE_PAY_MODAL = 1100
const Z_PEOPLE_PAY_MODAL_NESTED = 1200
/** Above Record payment / nested pay dialogs when opening PersonOffsetFormModal from Pay History. */
const Z_PEOPLE_OFFSET_FORM = 1210
/** Above Draft Payroll when opening per-person hours / job breakdown. */
const Z_PEOPLE_DRAFT_PAYROLL_HOURS_BREAKDOWN = 1215

/** Display order for People → Users tab sections (master roster + user-only roles + devs last). */
type UsersTabSection = { type: 'personKind'; kind: PersonKind } | { type: 'dev' }

const USERS_TAB_SECTIONS: UsersTabSection[] = [
  { type: 'personKind', kind: 'master_technician' },
  { type: 'personKind', kind: 'assistant' },
  { type: 'personKind', kind: 'primary' },
  { type: 'personKind', kind: 'estimator' },
  { type: 'personKind', kind: 'superintendent' },
  { type: 'personKind', kind: 'sub' },
  { type: 'personKind', kind: 'helper' },
  { type: 'dev' },
]

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

const HOURS_TAB_SECTION_ANCHOR_STYLE: CSSProperties = { scrollMarginTop: '3.5rem' }

const HOURS_TAB_SECTIONS_STACK_GAP = '0.75rem'

const HOURS_TAB_SECTIONS_STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: HOURS_TAB_SECTIONS_STACK_GAP,
}

/** Uniform card shell for People → Hours collapsible sections */
const HOURS_TAB_SECTION_SHELL: CSSProperties = {
  ...HOURS_TAB_SECTION_ANCHOR_STYLE,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  background: '#fafafa',
  boxSizing: 'border-box',
}

/** Primary section header control (chevron + label) */
const HOURS_TAB_SECTION_TOGGLE_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.35rem 0.55rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#111827',
  fontFamily: 'inherit',
  lineHeight: 1.25,
  textAlign: 'left',
}

const HOURS_TAB_SECTION_CHEVRON: CSSProperties = {
  fontSize: '0.65rem',
  color: '#6b7280',
  flexShrink: 0,
  lineHeight: 1,
}

function hoursTabSectionHeaderGap(open: boolean): CSSProperties {
  return { marginBottom: open ? '0.75rem' : 0 }
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
function usersTabContactRowStyle(narrow: boolean): CSSProperties {
  return narrow
    ? {
        display: 'block',
        fontSize: '0.875rem',
        color: '#6b7280',
        marginLeft: 0,
        marginTop: '0.25rem',
      }
    : {
        fontSize: '0.875rem',
        color: '#6b7280',
        marginLeft: '0.5rem',
      }
}

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
  const [showUsersTabTags, setShowUsersTabTags] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(SHOW_USERS_TAB_TAGS_KEY) === '1',
  )
  /** When Tags is on: show Tag org, Signals, and New tag / Add tag for user rows (dev). Default on if unset. */
  const [showUsersTabTagOrgSignals, setShowUsersTabTagOrgSignals] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY) !== '0',
  )
  const [usersTabLabels, setUsersTabLabels] = useState<LabelRow[]>([])
  const [usersTabLabelsByPersonId, setUsersTabLabelsByPersonId] = useState<Record<string, string[]>>({})
  const [usersTabLabelsByUserId, setUsersTabLabelsByUserId] = useState<Record<string, string[]>>({})
  const [usersTabMasterByUserId, setUsersTabMasterByUserId] = useState<Record<string, string | null>>({})
  /** Explicit DB row for tag org (null = no row); used for user-only rows. */
  const [usersTabTagOrgSavedMasterId, setUsersTabTagOrgSavedMasterId] = useState<Record<string, string | null>>({})
  const [usersTabTagSignalsByUserId, setUsersTabTagSignalsByUserId] = useState<Record<string, UserTagOrgSignals>>({})
  const [tagOrgMasterSelectOptions, setTagOrgMasterSelectOptions] = useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([])
  const [usersTabTagOrgSavingUserId, setUsersTabTagOrgSavingUserId] = useState<string | null>(null)
  const [usersTabLabelUsageById, setUsersTabLabelUsageById] = useState<
    Record<string, { people: number; users: number }>
  >({})
  const [usersTabLabelUsageLoading, setUsersTabLabelUsageLoading] = useState(false)
  const [usersTabLabelCatalogDeletingId, setUsersTabLabelCatalogDeletingId] = useState<string | null>(null)
  const [usersTabTagsLoading, setUsersTabTagsLoading] = useState(false)
  /** Saving key: `p:${personId}` or `u:${userId}` */
  const [usersTabSavingTagKey, setUsersTabSavingTagKey] = useState<string | null>(null)
  const [usersTabTagDraftByKey, setUsersTabTagDraftByKey] = useState<Record<string, string>>({})
  const [usersTabSearch, setUsersTabSearch] = useState('')
  const usersTabSearchQ = useMemo(() => usersTabSearch.trim().toLowerCase(), [usersTabSearch])
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
    if (activeTab !== 'users') {
      setUsersTabSearch('')
    }
  }, [activeTab])

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
  const [costMatrixShareSectionOpen, setCostMatrixShareSectionOpen] = useState(false)
  const [costMatrixTagColorsSectionOpen, setCostMatrixTagColorsSectionOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#e5e7eb')
  const [tagLedgerModalTag, setTagLedgerModalTag] = useState<string | null>(null)
  const [teamLedgerModalTeam, setTeamLedgerModalTeam] = useState<PeopleTeam | null>(null)
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
  type HoursGridJobHighlightPick = { id: string; hcp_number: string; job_name: string }
  const [hoursGridJobHighlightSearch, setHoursGridJobHighlightSearch] = useState('')
  const [hoursGridJobHighlightResults, setHoursGridJobHighlightResults] = useState<
    Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
  >([])
  const [hoursGridJobHighlightListOpen, setHoursGridJobHighlightListOpen] = useState(false)
  const [selectedJobHighlight, setSelectedJobHighlight] = useState<HoursGridJobHighlightPick | null>(null)
  const hoursGridJobHighlightBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  type PeopleTeam = { id: string; name: string; members: string[] }
  const [teams, setTeams] = useState<PeopleTeam[]>([])
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [teamPeriodStart, setTeamPeriodStart] = useState(() => {
    const d = new Date()
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return start.toLocaleDateString('en-CA')
  })
  const [teamPeriodEnd, setTeamPeriodEnd] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [showMaxHours, setShowMaxHours] = useState(false)
  const [payEditArrangement, setPayEditArrangement] = useState(false)
  const [payEditTags, setPayEditTags] = useState(false)
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
  type PayStubRow = { id: string; person_name: string; period_start: string; period_end: string; hours_total: number; gross_pay: number; created_at: string | null; paid_at: string | null; paid_by: string | null; paid_note: string | null }
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
  const [payStubLessModalStub, setPayStubLessModalStub] = useState<PayStubRow | null>(null)
  const [payStubAdditionalModalStub, setPayStubAdditionalModalStub] = useState<PayStubRow | null>(null)
  const payStubAdditionalSubjectUserId = useMemo(() => {
    if (!payStubAdditionalModalStub) return null
    const n = payStubAdditionalModalStub.person_name.trim()
    const u = users.find((x) => (x.name ?? '').trim() === n)
    return u?.id ?? null
  }, [payStubAdditionalModalStub, users])
  const payStubAdditionalBaseHourlyWage = useMemo(() => {
    if (!payStubAdditionalModalStub) return 0
    return Number(payConfig[payStubAdditionalModalStub.person_name]?.hourly_wage ?? 0)
  }, [payStubAdditionalModalStub, payConfig])
  const [payStubsLoading, setPayStubsLoading] = useState(false)
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
  const [payStubCalendarPerson, setPayStubCalendarPerson] = useState<string | null>(null)
  const [payStubCalendarYear, setPayStubCalendarYear] = useState(() => new Date().getFullYear())
  const [payStubCalendarData, setPayStubCalendarData] = useState<{ earnedByDate: Record<string, number>; paidByDate: Record<string, number> } | null>(null)
  const [payStubCalendarLoading, setPayStubCalendarLoading] = useState(false)
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
  const [payStubNoteDetail, setPayStubNoteDetail] = useState<PayStubRow | null>(null)
  const [deletingPayStubPaymentId, setDeletingPayStubPaymentId] = useState<string | null>(null)
  const [ledgerPersonSearch, setLedgerPersonSearch] = useState('')
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
    if (!isDev || activeTab !== 'users' || !showUsersTabTags) return
    let cancelled = false
    setUsersTabTagsLoading(true)
    void (async () => {
      try {
        const userIds = users.map((u) => u.id)
        const [overrides, signals, mastersRes] = await Promise.all([
          fetchTagOrgOverridesForUserIds(userIds),
          fetchUserTagOrgSignals(userIds),
          withSupabaseRetry(
            async () =>
              supabase
                .from('users')
                .select('id, name, email')
                .eq('role', 'master_technician')
                .is('archived_at', null)
                .order('name', { ascending: true }),
            'tag org master dropdown'
          ),
        ])
        if (cancelled) return
        setUsersTabTagSignalsByUserId(signals)
        setTagOrgMasterSelectOptions(
          (mastersRes ?? []) as Array<{ id: string; name: string | null; email: string | null }>,
        )
        const saved: Record<string, string | null> = {}
        for (const id of userIds) {
          saved[id] = overrides[id] ?? null
        }
        setUsersTabTagOrgSavedMasterId(saved)

        const masterByUser: Record<string, string | null> = {}
        for (const id of userIds) {
          if (overrides[id]) masterByUser[id] = overrides[id]
        }
        const needHeuristic = userIds.filter((id) => !overrides[id])
        const heuristicPairs = await Promise.all(
          needHeuristic.map(async (id) => ({ id, master: await resolveManagerUserIdForFeedback(id) })),
        )
        if (cancelled) return
        for (const { id, master } of heuristicPairs) {
          masterByUser[id] = master
        }
        setUsersTabMasterByUserId(masterByUser)

        const masterIdsFromPeople = [...new Set(people.map((p) => p.master_user_id))]
        const masterIdsFromUsers = [
          ...new Set(
            [...Object.values(masterByUser), ...Object.values(overrides)].filter((m): m is string => m != null),
          ),
        ]
        const allMasterIds = [...new Set([...masterIdsFromPeople, ...masterIdsFromUsers])]
        const personIds = people.map((p) => p.id)
        const [labelsRows, plMap, ulMap] = await Promise.all([
          fetchLabelsForMasterIds(allMasterIds),
          fetchPeopleLabelsForPersonIds(personIds),
          fetchUserLabelsForUserIds(userIds),
        ])
        if (cancelled) return
        setUsersTabLabels(labelsRows)
        setUsersTabLabelsByPersonId(plMap)
        setUsersTabLabelsByUserId(ulMap)
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load tags', 'error')
        }
      } finally {
        if (!cancelled) setUsersTabTagsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev, activeTab, showUsersTabTags, people, users])

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

  function usersTabRowMatchesSearch(
    fields: {
      name: string
      email: string | null | undefined
      phone: string | null | undefined
      notes: string | null | undefined
    },
    q: string,
  ): boolean {
    if (!q) return true
    const hay = [fields.name ?? '', fields.email ?? '', fields.phone ?? '', fields.notes ?? '']
      .join('\n')
      .toLowerCase()
    return hay.includes(q)
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null; phone: string | null; notes: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users
      .filter((u) => u.role === userRole)
      .map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email, phone: u.phone ?? null, notes: u.notes }))
    const fromPeople = people
      .filter((p) => p.kind === k && !isAlreadyUser(p.email))
      .map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  const usersTabSectionHasVisibleRows = useCallback(
    (sec: UsersTabSection): boolean => {
      if (sec.type === 'dev') {
        if (!isDev) return false
        if (!usersTabSearchQ) return true
        const devUsersAll = users.filter((u) => u.role === 'dev')
        return devUsersAll.some((u) => usersTabRowMatchesSearch(u, usersTabSearchQ))
      }
      const k = sec.kind
      if (!usersTabSearchQ) return true
      if (k === 'sub' || k === 'helper') {
        const items = byKind(k)
        if (items.length === 0) return false
        const withAccount = items.filter((i) => i.source === 'user')
        const external = items.filter((i) => i.source === 'people')
        const q = usersTabSearchQ
        const withAccountF = withAccount.filter((i) => usersTabRowMatchesSearch(i, q))
        const externalF = external.filter((i) => usersTabRowMatchesSearch(i, q))
        return withAccountF.length > 0 || externalF.length > 0
      }
      const kindItems = byKind(k)
      if (kindItems.length === 0) return false
      return kindItems.some((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
    },
    [usersTabSearchQ, isDev, users, people],
  )

  const usersTabSearchShowsNoSections = useMemo(() => {
    if (!usersTabSearchQ) return false
    return USERS_TAB_SECTIONS.every((sec) => !usersTabSectionHasVisibleRows(sec))
  }, [usersTabSearchQ, usersTabSectionHasVisibleRows])

  const payConfigRosterSections = useMemo(() => {
    const assigned = new Set<string>()
    const sections: Array<{ label: string; names: string[] }> = []
    for (const k of KINDS) {
      if (k === 'sub') {
        const items = byKind('sub')
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
        const items = byKind('helper')
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
      const items = byKind(k)
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

  const resolvePersonIdForUsersRow = useCallback(
    (
      item: { source: 'people' | 'user'; id: string; email: string | null },
      sectionKind: PersonKind | null,
    ): string | null => {
      if (item.source === 'people') return item.id
      const e = item.email?.trim().toLowerCase()
      if (!e) return null
      if (sectionKind) {
        const p = people.find((x) => x.kind === sectionKind && x.email?.toLowerCase() === e)
        return p?.id ?? null
      }
      const p = people.find((x) => x.email?.toLowerCase() === e)
      return p?.id ?? null
    },
    [people],
  )

  type UsersTabTagAnchor =
    | { kind: 'person'; personId: string }
    | { kind: 'user'; userId: string }

  function resolveUsersTabTagAnchor(
    item: { source: 'user' | 'people'; id: string; email: string | null },
    sectionKind: PersonKind | null,
  ): UsersTabTagAnchor {
    const personId = resolvePersonIdForUsersRow(item, sectionKind)
    if (personId) return { kind: 'person', personId }
    return { kind: 'user', userId: item.id }
  }

  const usersTabLabelById = useMemo(() => {
    const m = new Map<string, LabelRow>()
    for (const l of usersTabLabels) m.set(l.id, l)
    return m
  }, [usersTabLabels])

  const usersTabLabelIdsCatalogKey = useMemo(
    () => [...new Set(usersTabLabels.map((l) => l.id))].filter(Boolean).sort().join(','),
    [usersTabLabels],
  )

  useEffect(() => {
    if (!isDev || activeTab !== 'users' || !showUsersTabTags || !showUsersTabTagOrgSignals) {
      setUsersTabLabelUsageById({})
      setUsersTabLabelUsageLoading(false)
      return
    }
    const ids = usersTabLabelIdsCatalogKey ? usersTabLabelIdsCatalogKey.split(',') : []
    if (ids.length === 0) {
      setUsersTabLabelUsageById({})
      setUsersTabLabelUsageLoading(false)
      return
    }
    let cancelled = false
    setUsersTabLabelUsageLoading(true)
    void fetchLabelUsageCounts(ids)
      .then((m) => {
        if (!cancelled) setUsersTabLabelUsageById(m)
      })
      .catch((e) => {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load label usage', 'error')
          setUsersTabLabelUsageById({})
        }
      })
      .finally(() => {
        if (!cancelled) setUsersTabLabelUsageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDev, activeTab, showUsersTabTags, showUsersTabTagOrgSignals, usersTabLabelIdsCatalogKey, showToast])

  const tagOrgMasterLabel = useCallback(
    (masterId: string) => {
      const m = tagOrgMasterSelectOptions.find((x) => x.id === masterId)
      return m ? m.name?.trim() || m.email?.trim() || masterId : masterId
    },
    [tagOrgMasterSelectOptions],
  )

  const applyUserTagOrgChange = useCallback(
    async (userId: string, nextMasterId: string) => {
      if (!authUser?.id) return
      setUsersTabTagOrgSavingUserId(userId)
      try {
        let resolvedMaster: string | null
        if (!nextMasterId) {
          await deleteUserTagOrg(userId)
          setUsersTabTagOrgSavedMasterId((prev) => ({ ...prev, [userId]: null }))
          resolvedMaster = await resolveManagerUserIdForFeedback(userId)
        } else {
          await upsertUserTagOrg(userId, nextMasterId, authUser.id)
          setUsersTabTagOrgSavedMasterId((prev) => ({ ...prev, [userId]: nextMasterId }))
          resolvedMaster = nextMasterId
        }
        setUsersTabMasterByUserId((prev) => {
          const next = { ...prev, [userId]: resolvedMaster }
          const allMasterIds = [
            ...new Set([
              ...people.map((p) => p.master_user_id),
              ...Object.values(next).filter((m): m is string => m != null),
            ]),
          ]
          void fetchLabelsForMasterIds(allMasterIds).then((rows) => setUsersTabLabels(rows))
          return next
        })
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to save tag org', 'error')
      } finally {
        setUsersTabTagOrgSavingUserId(null)
      }
    },
    [authUser?.id, people, showToast],
  )

  function renderUsersTabTagsSection(anchor: UsersTabTagAnchor) {
    if (!showUsersTabTags) return null
    if (usersTabTagsLoading) {
      return <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Loading tags…</div>
    }

    const usersTabTagsPanelStyle: React.CSSProperties = {
      width: '100%',
      marginTop: '0.25rem',
      padding: '0.35rem 0 0',
      borderTop: '1px solid #e5e7eb',
      boxSizing: 'border-box',
    }

    const masterUserId =
      anchor.kind === 'person'
        ? people.find((p) => p.id === anchor.personId)?.master_user_id
        : usersTabMasterByUserId[anchor.userId] ?? null

    const tagUserId = anchor.kind === 'user' ? anchor.userId : null
    const signals = tagUserId ? usersTabTagSignalsByUserId[tagUserId] : undefined
    const savedTagOrg = tagUserId ? usersTabTagOrgSavedMasterId[tagUserId] : null
    const signalMasterUnion: string[] =
      tagUserId && signals
        ? [
            ...signals.assistantMasters,
            ...signals.superintendentMasters,
            ...signals.primaryMasters,
            ...signals.jobMasters.map((j) => j.masterId),
            ...(signals.peopleEmailMaster ? [signals.peopleEmailMaster] : []),
          ].filter((id, i, a) => a.indexOf(id) === i)
        : []
    const tagOrgConflict =
      !!savedTagOrg && signalMasterUnion.length > 0 && !signalMasterUnion.includes(savedTagOrg)

    const tagOrgControls =
      tagUserId != null ? (
        <div style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#374151' }}>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#6b7280',
              letterSpacing: '0.02em',
              marginBottom: '0.25rem',
              textAlign: 'left',
            }}
          >
            Tag org (saved)
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: '0.35rem',
            }}
          >
            <select
              value={savedTagOrg ?? ''}
              disabled={usersTabTagOrgSavingUserId === tagUserId}
              onChange={(ev) => void applyUserTagOrgChange(tagUserId, ev.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #d1d5db', minWidth: 200 }}
            >
              <option value="">Heuristic (no override)</option>
              {tagOrgMasterSelectOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name?.trim() || m.email?.trim() || m.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={usersTabTagOrgSavingUserId === tagUserId || savedTagOrg == null}
              onClick={() => void applyUserTagOrgChange(tagUserId, '')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
            >
              Clear override
            </button>
          </div>
          {signals && (
            <div
              style={{
                width: '100%',
                textAlign: 'left',
                color: '#6b7280',
                lineHeight: 1.45,
                marginBottom: tagOrgConflict ? '0.25rem' : 0,
              }}
            >
              <span style={{ fontWeight: 600, color: '#9ca3af' }}>Signals </span>
              {signals.assistantMasters.length > 0 && (
                <span>
                  Assistant: {signals.assistantMasters.map(tagOrgMasterLabel).join(', ')}.{' '}
                </span>
              )}
              {signals.superintendentMasters.length > 0 && (
                <span>
                  Superintendent: {signals.superintendentMasters.map(tagOrgMasterLabel).join(', ')}.{' '}
                </span>
              )}
              {signals.primaryMasters.length > 0 && (
                <span>
                  Primary: {signals.primaryMasters.map(tagOrgMasterLabel).join(', ')}.{' '}
                </span>
              )}
              {signals.jobMasters.length > 0 && (
                <span>
                  Jobs:{' '}
                  {signals.jobMasters
                    .map((j) => `${tagOrgMasterLabel(j.masterId)} (${j.jobCount})`)
                    .join(', ')}
                  .{' '}
                </span>
              )}
              {signals.peopleEmailMaster != null && (
                <span>People email: {tagOrgMasterLabel(signals.peopleEmailMaster)}.</span>
              )}
              {signalMasterUnion.length === 0 && (
                <span>No adoption or job team links detected for this user.</span>
              )}
            </div>
          )}
          {tagOrgConflict && (
            <div
              style={{
                width: '100%',
                textAlign: 'left',
                fontSize: '0.75rem',
                color: '#b45309',
                marginTop: '0.2rem',
              }}
            >
              Saved org does not match any detected signal — review adoption or roster email.
            </div>
          )}
        </div>
      ) : null

    if (!masterUserId) {
      return (
        <div style={usersTabTagsPanelStyle}>
          {showUsersTabTagOrgSignals ? tagOrgControls : null}
          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'left' }}>
            {anchor.kind === 'person'
              ? 'No roster row'
              : showUsersTabTagOrgSignals
                ? 'Cannot determine org for tags — set Tag org above or fix roster/adoption.'
                : 'Cannot determine org for tags — turn on “Tag org, signals & new tag” below to set override, or fix roster/adoption.'}
          </div>
        </div>
      )
    }
    const catalog = usersTabLabels
      .filter((l) => l.master_user_id === masterUserId)
      .sort((a, b) => a.name.localeCompare(b.name))
    const selectedIds =
      anchor.kind === 'person'
        ? usersTabLabelsByPersonId[anchor.personId] ?? []
        : usersTabLabelsByUserId[anchor.userId] ?? []
    const catalogUnselected = catalog.filter((l) => !selectedIds.includes(l.id))
    const draftKey = anchor.kind === 'person' ? `p:${anchor.personId}` : `u:${anchor.userId}`
    const busy = usersTabSavingTagKey === draftKey
    const draft = usersTabTagDraftByKey[draftKey] ?? ''

    const applyIds = async (next: string[]) => {
      setUsersTabSavingTagKey(draftKey)
      try {
        if (anchor.kind === 'person') {
          await setPersonLabels(anchor.personId, next)
          setUsersTabLabelsByPersonId((prev) => ({ ...prev, [anchor.personId]: next }))
        } else {
          await setUserLabels(anchor.userId, next)
          setUsersTabLabelsByUserId((prev) => ({ ...prev, [anchor.userId]: next }))
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to update tags', 'error')
      } finally {
        setUsersTabSavingTagKey(null)
      }
    }

    const toggleLabel = (labelId: string, checked: boolean) => {
      const next = checked ? [...selectedIds, labelId] : selectedIds.filter((id) => id !== labelId)
      void applyIds(next)
    }

    const addNewTag = async () => {
      const name = draft.trim()
      if (!name) return
      const slug = slugifyLabelName(name)
      try {
        const row = await insertLabel({ master_user_id: masterUserId, name, slug })
        setUsersTabLabels((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
        await applyIds([...selectedIds, row.id])
        setUsersTabTagDraftByKey((prev) => ({ ...prev, [draftKey]: '' }))
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        const dup =
          /duplicate|unique/i.test(raw) ||
          raw.toLowerCase().includes('labels_slug') ||
          raw.toLowerCase().includes('labels_master')
        showToast(dup ? 'A tag with that name or slug already exists for this master.' : raw, 'error')
      }
    }

    return (
      <div style={usersTabTagsPanelStyle}>
        {showUsersTabTagOrgSignals ? tagOrgControls : null}
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#6b7280',
            marginBottom: '0.2rem',
            textAlign: 'left',
          }}
        >
          Tags
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginBottom: '0.35rem',
          }}
        >
          {selectedIds.map((id) => {
            const label = usersTabLabelById.get(id)
            if (!label) return null
            return (
              <span
                key={id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.06rem 0.4rem',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: 999,
                  fontSize: '0.75rem',
                }}
              >
                {label.name}
                <button
                  type="button"
                  aria-label={`Remove ${label.name}`}
                  onClick={() => void applyIds(selectedIds.filter((x) => x !== id))}
                  disabled={busy}
                  style={{
                    padding: 0,
                    margin: 0,
                    border: 'none',
                    background: 'none',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    lineHeight: 1,
                    color: '#4f46e5',
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        {catalog.length > 0 && catalogUnselected.length === 0 ? (
          <p
            style={{
              fontSize: '0.8125rem',
              color: '#9ca3af',
              margin: '0 0 0.35rem 0',
            }}
          >
            All catalog tags applied.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: '0.35rem',
            }}
          >
            {catalogUnselected.map((l) => (
              <label
                key={l.id}
                style={{
                  fontSize: '0.8125rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={false}
                  disabled={busy}
                  onChange={(ev) => toggleLabel(l.id, ev.target.checked)}
                />
                {l.name}
              </label>
            ))}
          </div>
        )}
        {showUsersTabTagOrgSignals ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-start' }}>
            <input
              type="text"
              value={draft}
              onChange={(ev) =>
                setUsersTabTagDraftByKey((prev) => ({ ...prev, [draftKey]: ev.target.value }))
              }
              placeholder="New tag name"
              disabled={busy}
              style={{ fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 120 }}
            />
            <button
              type="button"
              onClick={() => void addNewTag()}
              disabled={busy || !draft.trim()}
              style={{ fontSize: '0.8125rem', padding: '0.2rem 0.5rem' }}
            >
              Add tag
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  type UsersTabRosterListRow = ReturnType<typeof byKind>[number]

  function renderUsersTabRosterListItem(sectionKind: PersonKind, item: UsersTabRosterListRow) {
    const activeProjectRows = personProjects[item.name.trim()]
    const activeProjectCount = activeProjectRows?.length ?? 0
    const isExternalSubRoster =
      (sectionKind === 'sub' || sectionKind === 'helper') && item.source === 'people'

    const contractsSigningLight = contractSigningStatusByPersonName[item.name]

    return (
      <li
        key={item.source === 'user' ? `user-${item.id}` : `people-${item.id}`}
        style={{
          padding: '0.5rem 0',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: narrowViewport ? 'flex-start' : 'center',
          gap: '0.5rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div>
            {item.source === 'user' && canSeePushStatus && pushEnabledUserIds.has(item.id) && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill="#22c55e"
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>Push notifications enabled</title>
                <path d="M320 64C302.3 64 288 78.3 288 96L288 99.2C215 114 160 178.6 160 256L160 277.7C160 325.8 143.6 372.5 113.6 410.1L103.8 422.3C98.7 428.6 96 436.4 96 444.5C96 464.1 111.9 480 131.5 480L508.4 480C528 480 543.9 464.1 543.9 444.5C543.9 436.4 541.2 428.6 536.1 422.3L526.3 410.1C496.4 372.5 480 325.8 480 277.7L480 256C480 178.6 425 114 352 99.2L352 96C352 78.3 337.7 64 320 64zM258 528C265.1 555.6 290.2 576 320 576C349.8 576 374.9 555.6 382 528L258 528z" />
              </svg>
            )}
            {item.source === 'user' && isDev && locationEnabledUserIds.has(item.id) && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill="#22c55e"
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>Location service enabled</title>
                <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
              </svg>
            )}
            {canAccessContracts && contractsSigningLight && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill={
                  contractsSigningLight === 'green'
                    ? '#22c55e'
                    : contractsSigningLight === 'yellow'
                      ? '#eab308'
                      : '#ef4444'
                }
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>{contractSigningIconTitle(contractsSigningLight)}</title>
                <path d="M64.1 128C64.1 92.7 92.8 64 128.1 64L277.6 64C294.6 64 310.9 70.7 322.9 82.7L429.3 189.3C441.3 201.3 448 217.6 448 234.6L448 332.1L316 464.1L273.9 464.1L257.8 410.5C253.1 394.8 238.7 384.1 222.3 384.1C211 384.1 200.4 389.2 193.4 398L133.3 473C125 483.3 126.7 498.5 137 506.7C147.3 514.9 162.5 513.3 170.7 502.9L217.8 444.1L233 494.8C236 505 245.4 511.9 256 511.9L287.5 511.9C286.6 515 285.8 518.2 285.2 521.4L274.3 575.9L128.1 575.9C92.8 575.9 64.1 547.2 64.1 511.9L64.1 127.9zM272.1 122.5L272.1 216C272.1 229.3 282.8 240 296.1 240L389.6 240L272.1 122.5zM332.3 530.9C334.8 518.5 340.9 507.1 349.8 498.2L468.7 379.3L548.7 459.3L429.8 578.2C420.9 587.1 409.5 593.2 397.1 595.7L337.5 607.6C336.6 607.8 335.6 607.9 334.6 607.9C326.6 607.9 320 601.4 320 593.3C320 592.3 320.1 591.4 320.3 590.4L332.2 530.8zM600.1 407.9L571.3 436.7L491.3 356.7L520.1 327.9C542.2 305.8 578 305.8 600.1 327.9C622.2 350 622.2 385.8 600.1 407.9z" />
              </svg>
            )}
            {isDev && item.source === 'user' && item.email && (
              <>
                {window.location.hostname === 'pipetooling.com' && (
                <button
                  type="button"
                  title="imitate (pipetooling.com)"
                  onClick={async () => {
                    setLoggingInAsId(item.id)
                    setError(null)
                    try {
                      await loginAsUser(item, 'https://pipetooling.com/dashboard')
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to imitate')
                    } finally {
                      setLoggingInAsId(null)
                    }
                  }}
                  disabled={loggingInAsId === item.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: 0,
                    marginRight: '0.35rem',
                    background: 'none',
                    border: 'none',
                    cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                    verticalAlign: 'middle',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                    <path d="M96 64C60.7 64 32 92.7 32 128L32 200C32 213.3 42.7 224 56 224C69.3 224 80 213.3 80 200L80 128C80 119.2 87.2 112 96 112L168 112C181.3 112 192 101.3 192 88C192 74.7 181.3 64 168 64L96 64zM472 64C458.7 64 448 74.7 448 88C448 101.3 458.7 112 472 112L544 112C552.8 112 560 119.2 560 128L560 200C560 213.3 570.7 224 584 224C597.3 224 608 213.3 608 200L608 128C608 92.7 579.3 64 544 64L472 64zM80 440C80 426.7 69.3 416 56 416C42.7 416 32 426.7 32 440L32 512C32 547.3 60.7 576 96 576L168 576C181.3 576 192 565.3 192 552C192 538.7 181.3 528 168 528L96 528C87.2 528 80 520.8 80 512L80 440zM608 440C608 426.7 597.3 416 584 416C570.7 416 560 426.7 560 440L560 512C560 520.8 552.8 528 544 528L472 528C458.7 528 448 538.7 448 552C448 565.3 458.7 576 472 576L544 576C579.3 576 608 547.3 608 512L608 440zM320 280C350.9 280 376 254.9 376 224C376 193.1 350.9 168 320 168C289.1 168 264 193.1 264 224C264 254.9 289.1 280 320 280zM320 320C267 320 224 363 224 416L224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440L416 416C416 363 373 320 320 320zM512 256C512 229.5 490.5 208 464 208C437.5 208 416 229.5 416 256C416 282.5 437.5 304 464 304C490.5 304 512 282.5 512 256zM200 336.3C150.7 340.4 112 381.6 112 432L112 442.7C112 454.5 121.6 464 133.3 464L180.1 464C177.4 456.5 176 448.4 176 440L176 416C176 386.5 184.8 359.1 200 336.3zM459.9 464L506.7 464C518.5 464 528 454.4 528 442.7L528 432C528 381.7 489.3 340.4 440 336.3C455.2 359.1 464 386.5 464 416L464 440C464 448.4 462.6 456.5 459.9 464zM224 256C224 229.5 202.5 208 176 208C149.5 208 128 229.5 128 256C128 282.5 149.5 304 176 304C202.5 304 224 282.5 224 256z" />
                  </svg>
                </button>
                )}
                {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <button
                  type="button"
                  title="imitate (localhost)"
                  onClick={async () => {
                    setLoggingInAsId(item.id)
                    setError(null)
                    try {
                      await loginAsUser(item, 'http://localhost:5173/dashboard')
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to imitate')
                    } finally {
                      setLoggingInAsId(null)
                    }
                  }}
                  disabled={loggingInAsId === item.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: 0,
                    marginRight: '0.35rem',
                    background: 'none',
                    border: 'none',
                    cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                    verticalAlign: 'middle',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                    <path d="M31 31C21.7 40.4 21.7 55.6 31 65L87 121C96.4 130.4 111.6 130.4 120.9 121C130.2 111.6 130.3 96.4 120.9 87.1L65 31C55.6 21.6 40.4 21.6 31.1 31zM609 31C599.6 21.6 584.4 21.6 575.1 31L519 87C509.6 96.4 509.6 111.6 519 120.9C528.4 130.2 543.6 130.3 552.9 120.9L609 65C618.4 55.6 618.4 40.4 609 31.1zM65 609L121 553C130.4 543.6 130.4 528.4 121 519.1C111.6 509.8 96.4 509.7 87.1 519.1L31 575C21.6 584.4 21.6 599.6 31 608.9C40.4 618.2 55.6 618.3 64.9 608.9zM609 609C618.4 599.6 618.4 584.4 609 575.1L553 519.1C543.6 509.7 528.4 509.7 519.1 519.1C509.8 528.5 509.7 543.7 519.1 553L575.1 609C584.5 618.4 599.7 618.4 609 609zM320 272C355.3 272 384 243.3 384 208C384 172.7 355.3 144 320 144C284.7 144 256 172.7 256 208C256 243.3 284.7 272 320 272zM320 304C258.1 304 208 354.1 208 416L208 424C208 437.3 218.7 448 232 448L408 448C421.3 448 432 437.3 432 424L432 416C432 354.1 381.9 304 320 304zM536 224C536 193.1 510.9 168 480 168C449.1 168 424 193.1 424 224C424 254.9 449.1 280 480 280C510.9 280 536 254.9 536 224zM451.2 324.4C469.4 350.3 480 381.9 480 416L480 424C480 432.4 478.6 440.5 475.9 448L554.7 448C566.5 448 576 438.4 576 426.7L576 416C576 363 533 320 480 320C470 320 460.3 321.5 451.2 324.4zM188.8 324.4C179.7 321.5 170 320 160 320C107 320 64 363 64 416L64 426.7C64 438.5 73.6 448 85.3 448L164.1 448C161.4 440.5 160 432.4 160 424L160 416C160 381.9 170.6 350.3 188.8 324.4zM216 224C216 193.1 190.9 168 160 168C129.1 168 104 193.1 104 224C104 254.9 129.1 280 160 280C190.9 280 216 254.9 216 224z" />
                  </svg>
                </button>
                )}
              </>
            )}
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            {isExternalSubRoster &&
              (activeProjectCount === 0 ? (
                <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>0 active</span>
              ) : (
                <button
                  type="button"
                  aria-expanded={externalSubProjectsExpanded.has(item.id)}
                  aria-label={`${activeProjectCount} active projects for ${item.name}. Toggle list.`}
                  onClick={() => {
                    setExternalSubProjectsExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }}
                  style={{
                    marginLeft: '0.5rem',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    textDecoration: 'underline',
                  }}
                >
                  {activeProjectCount} active {activeProjectCount === 1 ? 'project' : 'projects'}
                </button>
              ))}
            {item.source === 'user' && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>(account)</span>
            )}
            {(item.email || item.phone) && (
              <span style={usersTabContactRowStyle(narrowViewport)}>
                {item.email && (
                  <a href={`mailto:${item.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    {item.email}
                  </a>
                )}
                {item.email && item.phone && ' \u00B7 '}
                {item.phone && (
                  <a href={`tel:${item.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    {item.phone}
                  </a>
                )}
              </span>
            )}
            {item.source === 'user' && 'notes' in item && item.notes && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>— {item.notes}</span>
            )}
          </div>
          {(() => {
            if (sectionKind === 'primary' || sectionKind === 'superintendent') return null
            if (isExternalSubRoster) {
              if (
                activeProjectCount > 0 &&
                externalSubProjectsExpanded.has(item.id) &&
                activeProjectRows &&
                activeProjectRows.length > 0
              ) {
                return (
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Active projects:{' '}
                    {activeProjectRows.map((row, i) => (
                      <span key={row.id}>
                        {i > 0 ? ', ' : null}
                        <Link to={`/workflows/${row.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {row.name}
                        </Link>
                      </span>
                    ))}
                  </div>
                )
              }
              return null
            }
            return activeProjectRows && activeProjectRows.length > 0 ? (
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Active projects:{' '}
                {activeProjectRows.map((row, i) => (
                  <span key={row.id}>
                    {i > 0 ? ', ' : null}
                    <Link to={`/workflows/${row.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                      {row.name}
                    </Link>
                  </span>
                ))}
              </div>
            ) : null
          })()}
          {isDev &&
            showUsersTabTags &&
            renderUsersTabTagsSection(
              resolveUsersTabTagAnchor(
                { source: item.source, id: item.id, email: item.email },
                sectionKind,
              ),
            )}
        </div>
        {item.source === 'people' && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {!isAlreadyUser(item.email) && (
              <button
                type="button"
                onClick={() => setInviteConfirm(item as Person)}
                disabled={!item.email?.trim() || invitingId === item.id}
                title={!item.email?.trim() ? 'Add email in Edit to invite' : undefined}
                style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
              >
                {invitingId === item.id ? 'Sending…' : 'Invite as user'}
              </button>
            )}
            <button type="button" onClick={() => openEdit(item)} style={{ padding: '2px 6px', fontSize: '0.8125rem' }}>
              Edit
            </button>
            {item.master_user_id === authUser?.id ? (
              <button
                type="button"
                onClick={() => archivePerson(item.id)}
                disabled={archivingId === item.id}
                style={{ padding: '2px 6px', fontSize: '0.8125rem', color: '#b91c1c' }}
              >
                {archivingId === item.id ? '...' : 'Archive'}
              </button>
            ) : (
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Created by {creatorNames[item.master_user_id] ?? 'Unknown'}
              </span>
            )}
          </div>
        )}
        {item.source === 'user' && canEditUserNotes && (
          <button
            type="button"
            title="Update full name, title, and phone"
            aria-label="Update full name, title, and phone"
            onClick={() =>
              setEditingUserNote({
                id: item.id,
                name: item.name,
                notes: ('notes' in item ? item.notes : null) ?? '',
                phone: ('phone' in item ? item.phone : null) ?? '',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
              <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
            </svg>
          </button>
        )}
      </li>
    )
  }

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

  async function loadPayStubCalendarData(personName: string, year: number) {
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    setPayStubCalendarLoading(true)
    setPayStubCalendarData(null)
    const [hoursRes, paidRes] = await Promise.all([
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      supabase.from('pay_stub_days').select('work_date, paid_amount').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
    ])
    setPayStubCalendarLoading(false)
    if (hoursRes.error || paidRes.error) {
      setError(hoursRes.error?.message ?? paidRes.error?.message ?? 'Failed to load calendar data')
      return
    }
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const isSalary = cfg?.is_salary ?? false
    const hoursMap = new Map<string, number>()
    for (const r of (hoursRes.data ?? []) as { work_date: string; hours: number }[]) {
      hoursMap.set(r.work_date, r.hours)
    }
    const paidMap = new Map<string, number>()
    for (const r of (paidRes.data ?? []) as { work_date: string; paid_amount: number }[]) {
      paidMap.set(r.work_date, (paidMap.get(r.work_date) ?? 0) + r.paid_amount)
    }
    const earnedByDate: Record<string, number> = {}
    const paidByDate: Record<string, number> = {}
    const d = new Date(start + 'T12:00:00')
    const endD = new Date(end + 'T12:00:00')
    while (d <= endD) {
      const key = d.toLocaleDateString('en-CA')
      const hrs = isSalary ? (d.getDay() >= 1 && d.getDay() <= 5 ? 8 : 0) : hoursMap.get(key) ?? 0
      earnedByDate[key] = hrs * wage
      paidByDate[key] = paidMap.get(key) ?? 0
      d.setDate(d.getDate() + 1)
    }
    setPayStubCalendarData({ earnedByDate, paidByDate })
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

  function buildPayStubHtml(
    personName: string,
    periodStart: string,
    periodEnd: string,
    hourlyWage: number,
    hoursRows: Array<{ date: string; hours: number }>,
    hoursTotal: number,
    grossPay: number,
    rowsWithJobs?: Array<{ date: string; hours: number; jobsText: string }>,
    vehicles?: Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }>,
    additionalLines?: Array<{ description: string; quantity: number; rate: number; line_total: number }>,
    lessDeductionLines?: Array<{ amount: number; description: string; source: string }>,
    pendingOffsets?: Array<{ type: string; amount: number; description: string | null }>,
    physicalPayments?: Array<{ paid_at: string; amount: number; memo: string | null }>,
    housingRows?: Array<{ address: string; rent_per_week: number; utilities_per_week: number; insurance_per_week: number }>,
  ): string {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateWithDay = (dateStr: string) => {
      const d = new Date(dateStr + 'T12:00:00')
      const day = d.toLocaleDateString('en-US', { weekday: 'short' })
      return `${dateStr} (${day})`
    }
    const { email, phone } = getPersonContact(personName)
    const periodLabel = `Pay Period: ${new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    const wageDisplay = hourlyWage > 0 ? `$${formatCurrency(hourlyWage)}/hr` : '—'
    const hasJobs = rowsWithJobs && rowsWithJobs.length > 0
    const tableRows = hasJobs
      ? rowsWithJobs!.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td><td>${escapeHtml(r.jobsText)}</td></tr>`).join('')
      : hoursRows.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td></tr>`).join('')
    const tableHeader = hasJobs
      ? '<thead><tr><th>Date</th><th style="text-align:right">Hours</th><th>Jobs / Bids</th></tr></thead>'
      : '<thead><tr><th>Date</th><th style="text-align:right">Hours</th></tr></thead>'
    const tableFooter = hasJobs
      ? `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td><td></td></tr></tfoot>`
      : `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td></tr></tfoot>`
    const payReportDocumentTitle = buildPayReportDocumentTitle(personName, periodStart, periodEnd)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(payReportDocumentTitle)}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      .pay-report-employer-header { text-align: center; margin-bottom: 1.25rem; }
      .pay-report-employer-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem; letter-spacing: 0.02em; }
      .pay-report-employer-meta { color: #666; font-size: 0.9rem; line-height: 1.4; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      .meta { margin-bottom: 0.5rem; color: #666; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <div class="pay-report-employer-header">
        <div class="pay-report-employer-name">${PAY_REPORT_EMPLOYER_NAME}</div>
        <div class="pay-report-employer-meta">EIN: ${PAY_REPORT_EIN}</div>
        <div class="pay-report-employer-meta">${PAY_REPORT_ADDRESS}</div>
      </div>
      <h1>Pay Report</h1>
      <div style="margin-bottom: 0.5rem;"><strong>${escapeHtml(personName)}</strong></div>
      ${email ? `<div class="meta">${escapeHtml(email)}</div>` : ''}
      ${phone ? `<div class="meta">${escapeHtml(phone)}</div>` : ''}
      <div class="meta">${periodLabel}</div>
      <div class="meta">Hourly wage: ${wageDisplay}</div>
      <table>
        ${tableHeader}
        <tbody>${tableRows}</tbody>
        ${tableFooter}
      </table>
      <div style="margin-top: 1rem; font-weight: 600;">Gross Pay: $${formatCurrency(grossPay)}</div>
      ${(() => {
        const addLines = additionalLines ?? []
        const addTotal = Math.round(addLines.reduce((s, x) => s + x.line_total, 0) * 100) / 100
        const lessLines = lessDeductionLines ?? []
        const lessTotal = Math.round(lessLines.reduce((s, x) => s + x.amount, 0) * 100) / 100
        const netPay = stubNetPay(grossPay, lessTotal, addTotal)
        let block = ''
        if (addLines.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Additional</strong></div>'
          for (const A of addLines) {
            block += `<div class="meta">- ${escapeHtml(stripPrevailingWageTag(A.description))}: ${A.quantity} × $${formatCurrency(A.rate)} = $${formatCurrency(A.line_total)}</div>`
          }
          block += `<div class="meta"><strong>Total Additional: $${formatCurrency(addTotal)}</strong></div>`
        }
        if (lessLines.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Less</strong></div>'
          for (const L of lessLines) {
            const tag = L.source === 'offset' ? 'Offset' : 'Manual'
            block += `<div class="meta">- ${escapeHtml(tag)}: ${escapeHtml(L.description)} — $${formatCurrency(L.amount)}</div>`
          }
          block += `<div class="meta"><strong>Total Less: $${formatCurrency(lessTotal)}</strong></div>`
        }
        block += `<div class="meta" style="margin-top: 0.75rem; font-weight: 600;">Net Pay: $${formatCurrency(netPay)}</div>`
        const pending = pendingOffsets ?? []
        if (pending.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Pending Offsets (not yet on a pay report):</strong></div>'
          for (const o of pending) {
            const pendingTypeLabel =
              o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
            block += `<div class="meta">- ${escapeHtml(pendingTypeLabel)}${o.description ? ` (${escapeHtml(o.description)})` : ''}: $${formatCurrency(o.amount)}</div>`
          }
        }
        return block
      })()}
      ${physicalPayments && physicalPayments.length > 0
        ? (() => {
            const total = physicalPayments.reduce((s, p) => s + p.amount, 0)
            let block = '<div style="margin-top: 1rem;"><strong>Physical payments</strong></div>'
            for (const p of physicalPayments) {
              const d = new Date(p.paid_at)
              const line = `$${formatCurrency(p.amount)} on ${escapeHtml(d.toLocaleDateString())}${p.memo?.trim() ? ` — ${escapeHtml(p.memo.trim())}` : ''}`
              block += `<div class="meta">${line}</div>`
            }
            block += `<div class="meta" style="font-weight:600;">Total paid: $${formatCurrency(total)}</div></div>`
            return block
          })()
        : ''}
      ${vehicles && vehicles.length > 0 ? `<div style="margin-top: 1rem;">${vehicles.map((v) => `<div class="meta">Vehicle: ${escapeHtml(String(v.year))} ${escapeHtml(v.make)} ${escapeHtml(v.model)}${v.vin ? ` (VIN: ${escapeHtml(v.vin)})` : ''}</div><div class="meta">Weekly insurance: $${formatCurrency(v.weekly_insurance_cost)} | Weekly registration: $${formatCurrency(v.weekly_registration_cost)}</div>`).join('')}</div>` : ''}
      ${
        housingRows && housingRows.length > 0
          ? `<div style="margin-top: 1rem;"><strong>Housing</strong>${housingRows
              .map(
                (h) =>
                  `<div class="meta">Address: ${escapeHtml(h.address)}</div><div class="meta">Rent/week: $${formatCurrency(h.rent_per_week)} | Utilities/week: $${formatCurrency(h.utilities_per_week)} | Insurance/week: $${formatCurrency(h.insurance_per_week)}</div>`,
              )
              .join('')}</div>`
          : ''
      }
    </body></html>`
    return html
  }

  function openPayStubWindow(html: string, doPrint: boolean) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    if (doPrint) {
      win.print()
      win.onafterprint = () => win.close()
    }
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
    const html = buildPayStubHtml(
      personName,
      start,
      end,
      wage,
      dayRows.map((r) => ({ date: r.work_date, hours: r.hours })),
      hoursTotal,
      grossPay,
      rowsWithJobs,
      vehicles,
      additionalLinesGen,
      lessLines,
      pendingOffsets,
      [],
      housingRowsGen,
    )
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
    const html = buildPayStubHtml(
      stub.person_name,
      start,
      end,
      wage,
      hoursRows,
      stub.hours_total,
      stub.gross_pay,
      rowsWithJobs,
      vehicles,
      additionalLinesView,
      lessLines,
      pendingOffsets,
      physicalPayments,
      housingRowsView,
    )
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
    const html = buildPayStubHtml(
      stub.person_name,
      start,
      end,
      wage,
      hoursRows,
      stub.hours_total,
      stub.gross_pay,
      rowsWithJobs,
      vehicles,
      additionalLinesPrint,
      lessLinesPrint,
      pendingOffsets,
      physicalPayments,
      housingRowsPrint,
    )
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

  function openPayStubNoteDetail(stub: PayStubRow) {
    setPayStubNoteDetail(stub)
  }

  function closePayStubNoteDetail() {
    setPayStubNoteDetail(null)
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

  async function deletePayStubPayment(paymentId: string) {
    setDeletingPayStubPaymentId(paymentId)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stub_payments').delete().eq('id', paymentId),
        'delete pay stub payment',
      )
      await loadPayStubs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete payment')
    }
    setDeletingPayStubPaymentId(null)
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
    if (activeTab === 'pay_stubs' && canAccessPay) {
      const t = setTimeout(() => {
        setPayStubsLoading(true)
        Promise.all([loadPayConfig(), loadPayStubs()]).finally(() => setPayStubsLoading(false))
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay])

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

  useEffect(() => {
    if (payStubCalendarPerson) {
      loadPayStubCalendarData(payStubCalendarPerson, payStubCalendarYear)
    } else {
      setPayStubCalendarData(null)
    }
  }, [payStubCalendarPerson, payStubCalendarYear])

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

  useEffect(() => {
    const t = setTimeout(() => {
      const q = hoursGridJobHighlightSearch.trim()
      if (!q) {
        setHoursGridJobHighlightResults([])
        return
      }
      void supabase.rpc('search_jobs_ledger', { search_text: q }).then(({ data }) => {
        setHoursGridJobHighlightResults(
          (data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
        )
      })
    }, 300)
    return () => clearTimeout(t)
  }, [hoursGridJobHighlightSearch])

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

  function textColorForBackground(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) return '#374151'
    const r = parseInt(m[1] ?? '00', 16) / 255
    const g = parseInt(m[2] ?? '00', 16) / 255
    const b = parseInt(m[3] ?? '00', 16) / 255
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance < 0.5 ? '#ffffff' : '#374151'
  }

  function getDaysInRange(start: string, end: string): string[] {
    const days: string[] = []
    const d = new Date(start + 'T12:00:00')
    const endD = new Date(end + 'T12:00:00')
    while (d <= endD) {
      days.push(d.toLocaleDateString('en-CA'))
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  /** Widens Hours tab range if needed so a payroll-modal date can appear as a column (en-CA strings sort chronologically). */
  function ensureHoursRangeIncludesDate(workDate: string) {
    if (workDate < hoursDateStart) setHoursDateStart(workDate)
    if (workDate > hoursDateEnd) setHoursDateEnd(workDate)
  }

  function decimalToHms(decimal: number): string {
    if (!decimal || decimal <= 0) return ''
    const h = Math.floor(decimal)
    const m = Math.floor((decimal - h) * 60)
    const s = Math.round(((decimal - h) * 60 - m) * 60)
    if (s > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${h}:${String(m).padStart(2, '0')}:00`
  }

  function hmsToDecimal(str: string): number {
    const trimmed = str.trim()
    if (!trimmed) return 0
    // "8.5" (one digit after dot) = 8.5 decimal hours. "8.30" (two digits, ≤59) = 8:30.
    if (!trimmed.includes(':') && /^\d+\.(\d+)$/.test(trimmed)) {
      const m = trimmed.match(/^\d+\.(\d+)$/)!
      const frac = m[1]!
      if (frac.length === 1) return parseFloat(trimmed) // 8.5 → 8.5 hrs
      if (parseInt(frac, 10) > 59) return parseFloat(trimmed) // 8.75 → 8.75 hrs
    }
    const normalized = trimmed.replace(/\./g, ':').replace(/\s+/g, ':')
    const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0)
    const [h = 0, m = 0, s = 0] = parts
    return h + m / 60 + s / 3600
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


  const ledgerFilteredPayStubs = useMemo(() => {
    const q = ledgerPersonSearch.trim().toLowerCase()
    if (!q) return payStubs
    return payStubs.filter((s) => s.person_name.toLowerCase().includes(q))
  }, [payStubs, ledgerPersonSearch])

  const ledgerOpenBalanceSummary = useMemo(() => {
    let openCount = 0
    let totalRemaining = 0
    for (const stub of ledgerFilteredPayStubs) {
      const payRows = payStubPaymentsByStubId[stub.id] ?? []
      const paidSum = sumPayStubPaymentAmounts(payRows)
      const lessSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? [])
      const addSumLedger = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? [])
      const netPayLedger = stubNetPay(stub.gross_pay, lessSum, addSumLedger)
      const rem = remainingPayStubBalance(netPayLedger, paidSum)
      const fully = isPayStubFullyPaid(netPayLedger, paidSum)
      if (!fully) openCount += 1
      totalRemaining += rem
    }
    return {
      openCount,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
    }
  }, [
    ledgerFilteredPayStubs,
    payStubPaymentsByStubId,
    payStubDeductionsByStubId,
    payStubAdditionalByStubId,
  ])

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
        <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '1.25rem', width: '100%' }}>
            <input
              type="search"
              value={usersTabSearch}
              onChange={(e) => setUsersTabSearch(e.target.value)}
              placeholder="Search by name, email, phone…"
              aria-label="Search people on Users tab"
              style={{
                width: '100%',
                padding: '0.3rem 0.65rem',
                fontSize: '0.875rem',
                lineHeight: 1.35,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
          </div>
          {usersTabSearchShowsNoSections ? (
            <p role="status" style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
              No matches.
            </p>
          ) : null}
          {USERS_TAB_SECTIONS.map((sec) => {
            if (sec.type === 'dev') {
              if (!isDev) return null
              if (usersTabSearchQ && !usersTabSectionHasVisibleRows(sec)) return null
              return (
            <section key="users-tab-devs" style={{ marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Devs</h2>
              {(() => {
                const devUsersAll = users.filter((u) => u.role === 'dev')
                if (devUsersAll.length === 0) {
                  return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                }
                const devUsersFiltered = usersTabSearchQ
                  ? devUsersAll.filter((u) => usersTabRowMatchesSearch(u, usersTabSearchQ))
                  : devUsersAll
                return (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {devUsersFiltered
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((u) => {
                      const contractsSigningLight = contractSigningStatusByPersonName[u.name]
                      return (
                      <li
                        key={u.id}
                        style={{
                          padding: '0.5rem 0',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: narrowViewport ? 'flex-start' : 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div>
                            {pushEnabledUserIds.has(u.id) && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 640 640"
                                width={14}
                                height={14}
                                fill="#22c55e"
                                role="img"
                                aria-hidden
                                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                              >
                                <title>Push notifications enabled</title>
                                <path d="M320 64C302.3 64 288 78.3 288 96L288 99.2C215 114 160 178.6 160 256L160 277.7C160 325.8 143.6 372.5 113.6 410.1L103.8 422.3C98.7 428.6 96 436.4 96 444.5C96 464.1 111.9 480 131.5 480L508.4 480C528 480 543.9 464.1 543.9 444.5C543.9 436.4 541.2 428.6 536.1 422.3L526.3 410.1C496.4 372.5 480 325.8 480 277.7L480 256C480 178.6 425 114 352 99.2L352 96C352 78.3 337.7 64 320 64zM258 528C265.1 555.6 290.2 576 320 576C349.8 576 374.9 555.6 382 528L258 528z" />
                              </svg>
                            )}
                            {locationEnabledUserIds.has(u.id) && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 640 640"
                                width={14}
                                height={14}
                                fill="#22c55e"
                                role="img"
                                aria-hidden
                                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                              >
                                <title>Location service enabled</title>
                                <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
                              </svg>
                            )}
                            {canAccessContracts && contractsSigningLight && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 640 640"
                                width={14}
                                height={14}
                                fill={
                                  contractsSigningLight === 'green'
                                    ? '#22c55e'
                                    : contractsSigningLight === 'yellow'
                                      ? '#eab308'
                                      : '#ef4444'
                                }
                                role="img"
                                aria-hidden
                                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                              >
                                <title>{contractSigningIconTitle(contractsSigningLight)}</title>
                                <path d="M64.1 128C64.1 92.7 92.8 64 128.1 64L277.6 64C294.6 64 310.9 70.7 322.9 82.7L429.3 189.3C441.3 201.3 448 217.6 448 234.6L448 332.1L316 464.1L273.9 464.1L257.8 410.5C253.1 394.8 238.7 384.1 222.3 384.1C211 384.1 200.4 389.2 193.4 398L133.3 473C125 483.3 126.7 498.5 137 506.7C147.3 514.9 162.5 513.3 170.7 502.9L217.8 444.1L233 494.8C236 505 245.4 511.9 256 511.9L287.5 511.9C286.6 515 285.8 518.2 285.2 521.4L274.3 575.9L128.1 575.9C92.8 575.9 64.1 547.2 64.1 511.9L64.1 127.9zM272.1 122.5L272.1 216C272.1 229.3 282.8 240 296.1 240L389.6 240L272.1 122.5zM332.3 530.9C334.8 518.5 340.9 507.1 349.8 498.2L468.7 379.3L548.7 459.3L429.8 578.2C420.9 587.1 409.5 593.2 397.1 595.7L337.5 607.6C336.6 607.8 335.6 607.9 334.6 607.9C326.6 607.9 320 601.4 320 593.3C320 592.3 320.1 591.4 320.3 590.4L332.2 530.8zM600.1 407.9L571.3 436.7L491.3 356.7L520.1 327.9C542.2 305.8 578 305.8 600.1 327.9C622.2 350 622.2 385.8 600.1 407.9z" />
                              </svg>
                            )}
                            <span style={{ fontWeight: 500 }}>{u.name}</span>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>(account)</span>
                            {(u.email || u.phone) && (
                              <span style={usersTabContactRowStyle(narrowViewport)}>
                                {u.email && (
                                  <a href={`mailto:${u.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                    {u.email}
                                  </a>
                                )}
                                {u.email && u.phone && ' \u00B7 '}
                                {u.phone && (
                                  <a href={`tel:${u.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                    {u.phone}
                                  </a>
                                )}
                              </span>
                            )}
                            {u.notes && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>— {u.notes}</span>
                            )}
                          </div>
                          {isDev &&
                            showUsersTabTags &&
                            renderUsersTabTagsSection(
                              resolveUsersTabTagAnchor({ source: 'user', id: u.id, email: u.email }, null),
                            )}
                        </div>
                        {canEditUserNotes && (
                          <button
                            type="button"
                            title="Update full name, title, and phone"
                            aria-label="Update full name, title, and phone"
                            onClick={() => setEditingUserNote({ id: u.id, name: u.name, notes: u.notes ?? '', phone: u.phone ?? '' })}
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                              <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
                            </svg>
                          </button>
                        )}
                      </li>
                    )
                    })}
                </ul>
                )
              })()}
            </section>
              )
            }
            if (sec.type === 'personKind') {
              const k = sec.kind
              if (usersTabSearchQ && !usersTabSectionHasVisibleRows(sec)) return null
              return (
                        <section key={`users-tab-kind-${k}`} style={{ marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{KIND_LABELS[k]}</h2>
                            {canCreatePeopleInRoster ? (
                              <button type="button" onClick={() => openAdd(k)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                                Add
                              </button>
                            ) : null}
                          </div>
                          {(() => {
                            const usersTabRosterUlStyle = { listStyle: 'none' as const, padding: 0, margin: 0 }
                            if (k === 'sub') {
                              const subItems = byKind('sub')
                              if (subItems.length === 0) {
                                return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                              }
                              const withAccount = subItems.filter((i) => i.source === 'user')
                              const external = subItems.filter((i) => i.source === 'people')
                              const withAccountF = usersTabSearchQ
                                ? withAccount.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                                : withAccount
                              const externalF = usersTabSearchQ
                                ? external.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                                : external
                              return (
                                <>
                                  {withAccountF.length > 0 ? (
                                    <ul style={usersTabRosterUlStyle}>
                                      {withAccountF.map((item) => renderUsersTabRosterListItem('sub', item))}
                                    </ul>
                                  ) : null}
                                  {externalF.length > 0 ? (
                                    <>
                                      <h3
                                        style={{
                                          margin: withAccountF.length > 0 ? '1rem 0 0.5rem 0' : '0 0 0.5rem 0',
                                          fontSize: '1.125rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        External Subcontractors
                                      </h3>
                                      <ul style={usersTabRosterUlStyle}>
                                        {externalF.map((item) => renderUsersTabRosterListItem('sub', item))}
                                      </ul>
                                    </>
                                  ) : null}
                                </>
                              )
                            }
                            if (k === 'helper') {
                              const helperItems = byKind('helper')
                              if (helperItems.length === 0) {
                                return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                              }
                              const withAccount = helperItems.filter((i) => i.source === 'user')
                              const external = helperItems.filter((i) => i.source === 'people')
                              const withAccountF = usersTabSearchQ
                                ? withAccount.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                                : withAccount
                              const externalF = usersTabSearchQ
                                ? external.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                                : external
                              return (
                                <>
                                  {withAccountF.length > 0 ? (
                                    <ul style={usersTabRosterUlStyle}>
                                      {withAccountF.map((item) => renderUsersTabRosterListItem('helper', item))}
                                    </ul>
                                  ) : null}
                                  {externalF.length > 0 ? (
                                    <>
                                      <h3
                                        style={{
                                          margin: withAccountF.length > 0 ? '1rem 0 0.5rem 0' : '0 0 0.5rem 0',
                                          fontSize: '1.125rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        External Helpers
                                      </h3>
                                      <ul style={usersTabRosterUlStyle}>
                                        {externalF.map((item) => renderUsersTabRosterListItem('helper', item))}
                                      </ul>
                                    </>
                                  ) : null}
                                </>
                              )
                            }
                            const kindItems = byKind(k)
                            if (kindItems.length === 0) {
                              return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                            }
                            const kindItemsF = usersTabSearchQ
                              ? kindItems.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                              : kindItems
                            return (
                              <ul style={usersTabRosterUlStyle}>
                                {kindItemsF.map((item) => renderUsersTabRosterListItem(k, item))}
                              </ul>
                            )
                          })()}
                        </section>
              )
            }
            return null
          })}


          {/* Archived people */}
          <div style={{ marginTop: '2rem', maxWidth: 640 }}>
            <button
              type="button"
              onClick={() => setArchivedSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{archivedSectionOpen ? '▼' : '▶'}</span>
              Archived people ({archivedPeople.length})
            </button>
            {archivedSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem' }}>
                {archivedPeople.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No archived people.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Archived</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedPeople.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{p.email ?? '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                              {p.archived_at ? new Date(p.archived_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => restorePerson(p.id)}
                                disabled={restoringId === p.id}
                                style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                              >
                                {restoringId === p.id ? 'Restoring…' : 'Restore'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          {isDev && (
            <>
              <div
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  alignSelf: 'stretch',
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '0.75rem 1rem',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.875rem',
                    color: '#374151',
                    fontWeight: 500,
                  }}
                >
                  <span>Tags</span>
                  <input
                    type="checkbox"
                    checked={showUsersTabTags}
                    onChange={(e) => {
                      const v = e.target.checked
                      setShowUsersTabTags(v)
                      try {
                        localStorage.setItem(SHOW_USERS_TAB_TAGS_KEY, v ? '1' : '0')
                      } catch {
                        /* ignore quota / private mode */
                      }
                    }}
                  />
                </label>
                {showUsersTabTags && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontWeight: 500,
                    }}
                  >
                    <span>{'·'}</span>
                    <span>{'Tag org, signals & new tag'}</span>
                    <input
                      type="checkbox"
                      checked={showUsersTabTagOrgSignals}
                      onChange={(e) => {
                        const v = e.target.checked
                        setShowUsersTabTagOrgSignals(v)
                        try {
                          localStorage.setItem(SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY, v ? '1' : '0')
                        } catch {
                          /* ignore quota / private mode */
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              {showUsersTabTags && showUsersTabTagOrgSignals && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    width: '100%',
                    maxWidth: '56rem',
                  }}
                >
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
                    Label catalog
                  </h3>
                  {usersTabLabelUsageLoading ? (
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Loading label usage…</p>
                  ) : usersTabLabels.length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>No labels loaded yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Tag</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Master</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>People</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Users</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Total</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...usersTabLabels]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((row) => {
                              const usage = usersTabLabelUsageById[row.id] ?? { people: 0, users: 0 }
                              const total = usage.people + usage.users
                              const masterDisp = tagOrgMasterLabel(row.master_user_id)
                              return (
                                <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '0.45rem 0.75rem' }}>{row.name}</td>
                                  <td style={{ padding: '0.45rem 0.75rem', color: '#4b5563' }}>{masterDisp}</td>
                                  <td style={{ padding: '0.45rem 0.75rem' }}>{usage.people}</td>
                                  <td style={{ padding: '0.45rem 0.75rem' }}>{usage.users}</td>
                                  <td style={{ padding: '0.45rem 0.75rem' }}>{total}</td>
                                  <td style={{ padding: '0.45rem 0.75rem' }}>
                                    <button
                                      type="button"
                                      disabled={total !== 0 || usersTabLabelCatalogDeletingId === row.id}
                                      title={
                                        total !== 0
                                          ? 'Remove all assignments before deleting this tag'
                                          : 'Delete unused tag from catalog'
                                      }
                                      onClick={async () => {
                                        if (total !== 0) return
                                        setUsersTabLabelCatalogDeletingId(row.id)
                                        try {
                                          await deleteLabel(row.id)
                                          setUsersTabLabels((prev) => prev.filter((l) => l.id !== row.id))
                                          setUsersTabLabelUsageById((prev) => {
                                            const next = { ...prev }
                                            delete next[row.id]
                                            return next
                                          })
                                          setUsersTabLabelsByPersonId((prev) => {
                                            const next: Record<string, string[]> = {}
                                            for (const [pid, arr] of Object.entries(prev)) {
                                              next[pid] = arr.filter((lid) => lid !== row.id)
                                            }
                                            return next
                                          })
                                          setUsersTabLabelsByUserId((prev) => {
                                            const next: Record<string, string[]> = {}
                                            for (const [uid, arr] of Object.entries(prev)) {
                                              next[uid] = arr.filter((lid) => lid !== row.id)
                                            }
                                            return next
                                          })
                                          showToast('Tag removed from catalog', 'success')
                                        } catch (e) {
                                          showToast(e instanceof Error ? e.message : 'Failed to delete tag', 'error')
                                        } finally {
                                          setUsersTabLabelCatalogDeletingId(null)
                                        }
                                      }}
                                      style={{
                                        padding: '0.2rem 0.5rem',
                                        fontSize: '0.75rem',
                                        opacity: total !== 0 ? 0.45 : 1,
                                      }}
                                    >
                                      {usersTabLabelCatalogDeletingId === row.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
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
        <div>
          {payStubsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
              <section>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Ledger</h2>
                      {payStubs.length > 0 && ledgerFilteredPayStubs.length > 0 ? (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }} aria-live="polite">
                          {ledgerOpenBalanceSummary.openCount > 0
                            ? `${ledgerOpenBalanceSummary.openCount} open · $${formatCurrency(ledgerOpenBalanceSummary.totalRemaining)} remaining`
                            : 'All paid'}
                        </p>
                      ) : null}
                    </div>
                    {/* Right-side action cluster: Forecast (planning tool)
                        sits immediately left of Draft Payroll so the two
                        flows are visually paired. Forecast is dev/admin
                        territory — it doesn't write anything, just lets
                        you plan how to allocate incoming cash across
                        unpaid balances when the well is running dry. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setForecastModalOpen(true)}
                        disabled={forecastUnpaidRows.length === 0}
                        title={
                          forecastUnpaidRows.length === 0
                            ? 'Nothing to forecast — all pay stubs are fully paid.'
                            : 'Plan how upcoming cash bars will be split across unpaid balances'
                        }
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.9375rem',
                          background: 'white',
                          color: forecastUnpaidRows.length === 0 ? '#9ca3af' : '#374151',
                          border: `1px solid ${forecastUnpaidRows.length === 0 ? '#e5e7eb' : '#d1d5db'}`,
                          borderRadius: 6,
                          cursor: forecastUnpaidRows.length === 0 ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Forecast
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const { periodStart, periodEnd } = getPriorWeekPayStubRangeEnCa()
                          setPayStubPeriodStart(periodStart)
                          setPayStubPeriodEnd(periodEnd)
                          setDraftPayrollModalOpen(true)
                        }}
                        disabled={showPeopleForHours.length === 0}
                        title={
                          showPeopleForHours.length === 0
                            ? 'In Hours, open People pay config and check Show in Hours for people to track'
                            : undefined
                        }
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.9375rem',
                          background: showPeopleForHours.length === 0 ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: showPeopleForHours.length === 0 ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Draft Payroll
                      </button>
                    </div>
                  </div>
                  <input
                    id="ledger-person-search"
                    type="search"
                    value={ledgerPersonSearch}
                    onChange={(e) => setLedgerPersonSearch(e.target.value)}
                    placeholder="Name…"
                    autoComplete="off"
                    aria-label="Search ledger by person name"
                    aria-describedby="ledger-person-search-hint"
                    style={{
                      marginTop: '0.75rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.35rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                    }}
                  />
                  <p id="ledger-person-search-hint" style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    Search filters the ledger by person name.
                  </p>
                </div>
                {payStubs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                    No pay reports yet. Use Draft Payroll.
                  </p>
                ) : ledgerFilteredPayStubs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No pay reports match this search.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Person</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Period</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hours</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Gross Pay</th>
                          <th
                            style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}
                            title="Deductions and applied offsets. Click the amount to edit."
                          >
                            Less
                          </th>
                          <th
                            style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}
                            title="Additional pay (quantity × rate). Click the amount to edit."
                          >
                            Additional
                          </th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Net Pay</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid to date</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Balance</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Payment</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerFilteredPayStubs.map((stub) => {
                          const payRows = payStubPaymentsByStubId[stub.id] ?? []
                          const paidSum = sumPayStubPaymentAmounts(payRows)
                          const lessSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? [])
                          const addSumLedger = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? [])
                          const netPayLedger = stubNetPay(stub.gross_pay, lessSum, addSumLedger)
                          const rem = remainingPayStubBalance(netPayLedger, paidSum)
                          const fully = isPayStubFullyPaid(netPayLedger, paidSum)
                          const partial = paidSum > 0 && !fully
                          const paymentLabel = fully ? 'Paid' : partial ? 'Partial' : 'Unpaid'
                          const paymentColor = fully ? '#059669' : partial ? '#ca8a04' : '#6b7280'
                          const showPayDetail =
                            payRows.length > 0 || Boolean(stub.paid_note?.trim()) || Boolean(stub.paid_at)
                          return (
                          <tr key={stub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => setPayStubCalendarPerson(stub.person_name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit',
                                }}
                              >
                                {stub.person_name}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{stub.hours_total.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(stub.gross_pay)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              {fully ? (
                                <span
                                  title="Fully paid — change payments first to edit Less"
                                  aria-label={`Less for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(lessSum)}, not editable, fully paid`}
                                >
                                  ${formatCurrency(lessSum)}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPayStubLessModalStub(stub)}
                                  title="Edit Less (deductions)"
                                  aria-label={`Less for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(lessSum)}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    color: '#2563eb',
                                    textDecoration: 'underline',
                                    fontSize: 'inherit',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  ${formatCurrency(lessSum)}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              {fully ? (
                                <span
                                  title="Fully paid — change payments first to edit Additional"
                                  aria-label={`Additional for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(addSumLedger)}, not editable, fully paid`}
                                >
                                  ${formatCurrency(addSumLedger)}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPayStubAdditionalModalStub(stub)}
                                  title="Edit Additional pay lines"
                                  aria-label={`Additional for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(addSumLedger)}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    color: '#2563eb',
                                    textDecoration: 'underline',
                                    fontSize: 'inherit',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  ${formatCurrency(addSumLedger)}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(netPayLedger)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(paidSum)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: '0.35rem',
                                  width: '100%',
                                }}
                              >
                                <span>
                                  ${formatCurrency(rem)}
                                </span>
                                <button
                                  type="button"
                                  title="Copy balance"
                                  aria-label={`Copy balance ${formatCurrency(rem)} for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}`}
                                  onClick={() => {
                                    void (async () => {
                                      const text = formatCurrency(rem)
                                      try {
                                        if (!navigator.clipboard?.writeText) {
                                          showToast('Clipboard not available.', 'warning')
                                          return
                                        }
                                        await navigator.clipboard.writeText(text)
                                        showToast('Balance copied.', 'success')
                                      } catch {
                                        showToast('Could not copy balance.', 'error')
                                      }
                                    })()
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 2,
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    color: '#6b7280',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#2563eb'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#6b7280'
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    width={16}
                                    height={16}
                                    aria-hidden
                                    style={{ display: 'block' }}
                                  >
                                    <path
                                      fill="currentColor"
                                      d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"
                                    />
                                  </svg>
                                </button>
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: paymentColor }}>{paymentLabel}</span>
                                {showPayDetail ? (
                                  <button
                                    type="button"
                                    onClick={() => openPayStubNoteDetail(stub)}
                                    aria-label="View payment details"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: 0,
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      borderRadius: 4,
                                      verticalAlign: 'middle',
                                      color: '#2563eb',
                                    }}
                                  >
                                    <PayStubPaidNoteIcon />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openPayStubMarkPaidModal(stub)}
                                  disabled={markingPayStubId === stub.id || fully}
                                  title={fully ? 'Fully paid' : 'Record a payment'}
                                  style={{ padding: '2px 6px', fontSize: '0.8125rem', background: markingPayStubId === stub.id || fully ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: markingPayStubId === stub.id || fully ? 'not-allowed' : 'pointer' }}
                                >
                                  {markingPayStubId === stub.id ? '...' : 'Record payment'}
                                </button>
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {stub.created_at ? new Date(stub.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => printPayStub(stub)}
                                style={{ padding: '2px 6px', fontSize: '0.8125rem', marginRight: isDev ? '0.35rem' : 0, background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Print
                              </button>
                              {isDev && (
                                <button
                                  type="button"
                                  onClick={() => setPayStubDeleteConfirm(stub)}
                                  disabled={deletingPayStubId === stub.id}
                                  title="Delete pay report"
                                  aria-label="Delete pay report"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 2,
                                    marginLeft: '0.35rem',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: deletingPayStubId === stub.id ? '#9ca3af' : '#dc2626',
                                    cursor: deletingPayStubId === stub.id ? 'not-allowed' : 'pointer',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  {deletingPayStubId === stub.id ? (
                                    <span style={{ fontSize: '0.75rem', lineHeight: 1, color: '#9ca3af' }}>…</span>
                                  ) : (
                                    <PayStubDeleteIcon color="currentColor" size={16} />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {payStubLessModalStub ? (
        <PayStubLessModal
          stub={payStubLessModalStub}
          deductions={payStubDeductionsByStubId[payStubLessModalStub.id] ?? []}
          additionalSum={sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubLessModalStub.id] ?? [])}
          payments={payStubPaymentsByStubId[payStubLessModalStub.id] ?? []}
          authUserId={authUser?.id ?? null}
          onClose={() => setPayStubLessModalStub(null)}
          onSaved={async () => {
            await loadPayStubs()
          }}
          showToast={showToast}
        />
      ) : null}

      {payStubAdditionalModalStub ? (
        <PayStubAdditionalModal
          stub={payStubAdditionalModalStub}
          lines={payStubAdditionalByStubId[payStubAdditionalModalStub.id] ?? []}
          deductions={payStubDeductionsByStubId[payStubAdditionalModalStub.id] ?? []}
          payments={payStubPaymentsByStubId[payStubAdditionalModalStub.id] ?? []}
          authUserId={authUser?.id ?? null}
          subjectUserId={payStubAdditionalSubjectUserId}
          baseHourlyWage={payStubAdditionalBaseHourlyWage}
          onOpenMyTimeForDay={({ dateStr, subjectUserId, subjectDisplayName }) => {
            setHoursMyTimeEditor({ dateStr, subjectUserId, subjectDisplayName })
          }}
          onClose={() => setPayStubAdditionalModalStub(null)}
          onSaved={async () => {
            await loadPayStubs()
          }}
          showToast={showToast}
        />
      ) : null}

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

      {payStubNoteDetail ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePayStubNoteDetail()
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL }}
        >
          <div
            role="dialog"
            aria-labelledby="pay-stub-note-detail-title"
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 520, width: '100%', maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pay-stub-note-detail-title" style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
              Payment details
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {payStubNoteDetail.person_name} · Pay period{' '}
              {new Date(payStubNoteDetail.period_start + 'T12:00:00').toLocaleDateString()} –{' '}
              {new Date(payStubNoteDetail.period_end + 'T12:00:00').toLocaleDateString()}
            </p>
            {(payStubPaymentsByStubId[payStubNoteDetail.id] ?? []).length > 0 ? (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Installments</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {(payStubPaymentsByStubId[payStubNoteDetail.id] ?? []).map((p) => (
                    <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 500 }}>${formatCurrency(p.amount)}</span>
                      {' · '}
                      {new Date(p.paid_at).toLocaleDateString()}
                      {p.memo?.trim() ? ` — ${p.memo.trim()}` : ''}
                      <button
                        type="button"
                        onClick={() => void deletePayStubPayment(p.id)}
                        disabled={deletingPayStubPaymentId === p.id}
                        style={{ marginLeft: '0.5rem', padding: '1px 6px', fontSize: '0.75rem', border: '1px solid #fecaca', background: 'white', color: '#dc2626', borderRadius: 4, cursor: deletingPayStubPaymentId === p.id ? 'not-allowed' : 'pointer' }}
                      >
                        {deletingPayStubPaymentId === p.id ? '…' : 'Delete'}
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                  Total paid: ${formatCurrency(sumPayStubPaymentAmounts(payStubPaymentsByStubId[payStubNoteDetail.id]))} · Balance: $
                  {formatCurrency(
                    remainingPayStubBalance(
                      stubNetPay(
                        payStubNoteDetail.gross_pay,
                        sumPayStubDeductionAmounts(payStubDeductionsByStubId[payStubNoteDetail.id] ?? []),
                        sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubNoteDetail.id] ?? []),
                      ),
                      sumPayStubPaymentAmounts(payStubPaymentsByStubId[payStubNoteDetail.id]),
                    ),
                  )}
                </div>
              </div>
            ) : payStubNoteDetail.paid_note?.trim() ? (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Legacy memo</div>
                {payStubNoteDetail.paid_at ? (
                  <div style={{ marginBottom: '0.35rem', color: '#6b7280' }}>
                    Marked paid {new Date(payStubNoteDetail.paid_at).toLocaleDateString()}
                  </div>
                ) : null}
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{payStubNoteDetail.paid_note.trim()}</p>
              </div>
            ) : payStubNoteDetail.paid_at ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Legacy: marked paid {new Date(payStubNoteDetail.paid_at).toLocaleDateString()} (no installment records).
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closePayStubNoteDetail}
                style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          <section id="people-hours-week" aria-labelledby="people-hours-week-heading" style={HOURS_TAB_SECTION_ANCHOR_STYLE}>
            <h3
              id="people-hours-week-heading"
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#111827',
                lineHeight: 1.25,
                textAlign: 'left',
              }}
            >
              Week range
            </h3>
            {narrowViewport ? (
            <div
              style={{
                marginBottom: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => shiftHoursWeek(-1)}
                  style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
                >
                  ‹
                </button>
                <span style={{ fontSize: '0.875rem', textAlign: 'center', minWidth: 0 }}>
                  {formatDateRangeLabel(hoursDateStart, hoursDateEnd)}
                </span>
                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => shiftHoursWeek(1)}
                  style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
                >
                  ›
                </button>
              </div>
              <details style={{ marginTop: '0.35rem', width: '100%', maxWidth: '100%' }}>
                <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: '#374151', textAlign: 'center' }}>
                  Custom dates
                </summary>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    marginTop: '0.5rem',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>Start</span>
                    <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>End</span>
                    <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </label>
                </div>
              </details>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => shiftHoursWeek(-1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ← last week
              </button>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>Start</span>
                <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>End</span>
                <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <button
                type="button"
                onClick={() => shiftHoursWeek(1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                next week →
              </button>
            </div>
            )}
          </section>
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
              <div
                style={{ marginBottom: '0.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.5rem' }}
                title="Highlights people whose crew row lists this job (assignments on that person’s row only, not crew-lead inheritance)."
              >
                <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, paddingTop: '0.35rem', flexShrink: 0 }}>Highlight by job</span>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 400 }}>
                  <input
                    type="search"
                    value={hoursGridJobHighlightSearch}
                    onChange={(e) => setHoursGridJobHighlightSearch(e.target.value)}
                    onFocus={() => {
                      if (hoursGridJobHighlightBlurTimeoutRef.current) clearTimeout(hoursGridJobHighlightBlurTimeoutRef.current)
                      setHoursGridJobHighlightListOpen(true)
                    }}
                    onBlur={() => {
                      hoursGridJobHighlightBlurTimeoutRef.current = setTimeout(() => setHoursGridJobHighlightListOpen(false), 175)
                    }}
                    placeholder="Search HCP, job name, address…"
                    aria-label="Search job to highlight on hours grid"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {hoursGridJobHighlightListOpen && hoursGridJobHighlightResults.length > 0 ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 25,
                        marginTop: 2,
                        maxHeight: 220,
                        overflowY: 'auto',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      {hoursGridJobHighlightResults.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedJobHighlight({ id: j.id, hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '' })
                            setHoursGridJobHighlightSearch('')
                            setHoursGridJobHighlightResults([])
                            setHoursGridJobHighlightListOpen(false)
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.5rem 0.65rem',
                            textAlign: 'left',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>
                            J{(j.hcp_number || '').trim() || '—'} · {j.job_name || '—'}
                          </div>
                          {j.job_address ? (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {selectedJobHighlight ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.55rem',
                      background: '#eff6ff',
                      border: '1px solid #93c5fd',
                      borderRadius: 6,
                      fontSize: '0.8125rem',
                      maxWidth: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      J{(selectedJobHighlight.hcp_number || '').trim() || '—'} · {selectedJobHighlight.job_name || '—'}
                    </span>
                    <button
                      type="button"
                      aria-label="Clear job highlight"
                      onClick={() => setSelectedJobHighlight(null)}
                      style={{
                        padding: '0 0.25rem',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontSize: '1.125rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
              </div>
              {selectedJobHighlight && jobHighlightPeople.size === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                  No one in this list has that job on crew assignments this week.
                </p>
              ) : null}
              {peopleHoursPendingSummary.totalSessions > 0 && (canAccessHours || canAccessPay) ? (
                <div
                  role="status"
                  style={{
                    marginBottom: '0.5rem',
                    padding: '0.45rem 0.6rem',
                    border: '1px solid #f59e0b',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: 6,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.35,
                  }}
                >
                  <span aria-hidden style={{ fontSize: '0.95rem', lineHeight: 1 }}>⚠</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <strong>Pending: {peopleHoursPendingSummary.peopleCount}</strong>{' '}
                    {peopleHoursPendingSummary.peopleCount === 1 ? 'person' : 'people'} ·{' '}
                    <strong>{peopleHoursPendingSummary.totalDiffHours.toFixed(2)} h</strong> not yet in payroll
                    {peopleHoursPendingSummary.workDates.length > 0 ? (
                      <>
                        {' '}across{' '}
                        {peopleHoursPendingSummary.workDates.length}{' '}
                        {peopleHoursPendingSummary.workDates.length === 1 ? 'day' : 'days'}
                      </>
                    ) : null}
                    .
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkApprovePendingOpen(true)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      border: '1px solid #b45309',
                      background: '#b45309',
                      color: 'white',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Review &amp; approve
                  </button>
                </div>
              ) : null}
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
                                    const shouldOfferManualSession =
                                      v > 0 &&
                                      (canAccessHours || canAccessPay) &&
                                      canEditHours(personName) &&
                                      !hoursDaysCorrect.has(d)
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
          <section id="people-hours-sessions" style={HOURS_TAB_SECTION_SHELL}>
            <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.sessions)}>
              <button
                type="button"
                aria-expanded={hoursTabSectionsOpen.sessions}
                onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, sessions: !p.sessions }))}
                style={HOURS_TAB_SECTION_TOGGLE_BTN}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.sessions ? '▼' : '▶'}</span>
                Clock sessions
              </button>
            </div>
            {hoursTabSectionsOpen.sessions ? (
            <>
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="search"
              value={hoursClockSessionsSearch}
              onChange={(e) => setHoursClockSessionsSearch(e.target.value)}
              placeholder="Search name, notes, job/bid, date…"
              aria-label="Search clock sessions"
              style={{
                flex: '1 1 220px',
                minWidth: 160,
                padding: '0.35rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
            {hoursClockSessionsSearching ? (
              <button
                type="button"
                onClick={() => setHoursClockSessionsSearch('')}
                style={{
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Clear
              </button>
            ) : null}
            {showSalariedWorkdaysHoursButton ? (
              <button
                type="button"
                onClick={() => setSalariedWorkdaysModalOpen(true)}
                style={{
                  marginLeft: 'auto',
                  padding: '0.35rem 0.65rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  flexShrink: 0,
                }}
              >
                Salaried workdays
              </button>
            ) : null}
          </div>
          {noClockSessionsMatchSearch ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No sessions match this search.</p>
          ) : null}
          <div style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
              {hoursClockSessionsSearching
                ? `Active clock sessions (${activeClockSessionsFiltered.length} of ${activeClockSessions.length} matching)`
                : `Active clock sessions (${activeClockSessions.length})`}
            </div>
            <ClockSessionsTable
              sessions={activeClockSessionsFiltered}
              showActionsColumn
              locationVariant="full"
              enableDurationColumnSort
              onDurationClick={openHoursMyTimeFromSession}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No active sessions'}
              renderNotesSecondary={(s) => {
                const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                return label ? (
                  <span title={label.replace(/\n/g, ' ')} style={{ whiteSpace: 'pre-line' }}>
                    {label}
                  </span>
                ) : null
              }}
              renderJob={() => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }} />
              )}
              renderActions={(s) => {
                const personName = s.users?.name?.trim() ?? 'Unknown'
                return (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditClockSession(s)
                        setError(null)
                      }}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Force clock out ${personName}?`)) return
                        const now = new Date().toISOString()
                        const { error } = await supabase.from('clock_sessions').update({ clocked_out_at: now }).eq('id', s.id)
                        if (error) setError(error.message)
                        else {
                          showToast?.('Session clocked out', 'success')
                          loadAllClockSessionsRef.current?.()
                        }
                      }}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                    >
                      Force clock out
                    </button>
                  </div>
                )
              }}
            />
          </div>
          <div style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
              {hoursClockSessionsSearching
                ? `Pending sessions (${pendingApprovalClockSessionsFiltered.length} of ${pendingApprovalClockSessions.length} matching)`
                : `Pending sessions (${pendingApprovalClockSessions.length})`}
            </div>
            <ClockSessionsTable
              sessions={pendingApprovalClockSessionsFiltered}
              showActionsColumn
              locationVariant="full"
              enableDurationColumnSort
              onDurationClick={openHoursMyTimeFromSession}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No sessions awaiting approval'}
              renderNotesSecondary={(s) => {
                const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                return label ? (
                  <span title={label.replace(/\n/g, ' ')} style={{ whiteSpace: 'pre-line' }}>
                    {label}
                  </span>
                ) : null
              }}
              renderJob={(s) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>
                    <AssignSessionJobPopover
                      session={s}
                      onSaved={() => {
                        showToast?.('Job assigned', 'success')
                        loadAllClockSessionsRef.current?.()
                      }}
                      onError={(msg) => setError(msg)}
                      dispatchScheduleAssigneeUserId={s.user_id}
                      dispatchScheduleWorkDateYmd={s.work_date}
                    />
                  </span>
                </div>
              )}
              renderActions={(s) => (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const { data, error } = await approveClockSessions([s.id])
                      if (error) { setError(error.message); return }
                      const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                      const row = result[0]
                      if (row?.error_message) { setError(row.error_message); return }
                      showToast?.(`Approved ${row?.approved_count ?? 0} session(s)`, 'success')
                      loadAllClockSessionsRef.current?.()
                      loadPeopleHoursRef.current?.()
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #22c55e', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Reject this clock session?')) return
                      const { error } = await supabase.from('clock_sessions').update({ rejected_at: new Date().toISOString(), rejected_by: authUser?.id ?? null }).eq('id', s.id)
                      if (error) setError(error.message)
                      else { showToast?.('Session rejected', 'success'); loadAllClockSessionsRef.current?.() }
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditClockSession(s)
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
              )}
            />
          </div>
          <ClockSessionsSection
            title="Approved Sessions"
            sessions={approvedClockSessionsFiltered}
            enableDurationColumnSort
            onDurationClick={openHoursMyTimeFromSession}
            headerCountLabel={
              hoursClockSessionsSearching
                ? `${approvedClockSessionsFiltered.length} of ${approvedClockSessions.length} matching`
                : undefined
            }
            headerCount={hoursClockSessionsSearching ? undefined : approvedClockSessions.length}
            emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No sessions'}
            collapsedByDefault
            showActionsColumn
            renderActions={(s) => (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Revoke this session? It will move back to Pending and remove its hours from Hours.')) return
                  const { data, error } = await supabase.rpc('revoke_clock_sessions', { p_session_ids: [s.id] })
                  if (error) { setError(error.message); return }
                  const result = (data ?? []) as Array<{ revoked_count: number; error_message: string | null }>
                  const row = result[0]
                  if (row?.error_message) { setError(row.error_message); return }
                  showToast?.(`Revoked ${row?.revoked_count ?? 0} session(s)`, 'success')
                  loadAllClockSessionsRef.current?.()
                  loadPeopleHoursRef.current?.()
                }}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #f59e0b', borderRadius: 4, background: '#fffbeb', color: '#d97706', cursor: 'pointer' }}
              >
                Revoke
              </button>
            )}
          />
          <div id="people-hours-rejected">
            <RejectedClockSessionsSection
              sessions={rejectedClockSessionsFiltered}
              headerCountLabel={
                hoursClockSessionsSearching
                  ? `${rejectedClockSessionsFiltered.length} of ${rejectedClockSessions.length} matching`
                  : undefined
              }
              headerCount={hoursClockSessionsSearching ? undefined : rejectedClockSessions.length}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : undefined}
              onDeleted={() => loadAllClockSessionsRef.current?.()}
              onError={(message) => setError(message)}
              canDeleteRejectedSessions={canAccessPay}
              open={rejectedSectionOpen}
              onToggle={() => setRejectedSectionOpen((o) => !o)}
              onEdit={(s) => {
                setEditClockSession(s)
              }}
            />
          </div>
            </>
            ) : null}
          </section>
          </>
          )}
          {(canAccessPay || canViewCostMatrixShared) && (
          <div style={HOURS_TAB_SECTIONS_STACK}>
            <>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <section id="people-hours-due-summaries" style={HOURS_TAB_SECTION_SHELL}>
              <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.dueSummaries)}>
                <button
                  type="button"
                  aria-expanded={hoursTabSectionsOpen.dueSummaries}
                  onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, dueSummaries: !p.dueSummaries }))}
                  style={HOURS_TAB_SECTION_TOGGLE_BTN}
                >
                  <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.dueSummaries ? '▼' : '▶'}</span>
                  Due by Trade / Team
                </button>
              </div>
              {hoursTabSectionsOpen.dueSummaries ? (
              <>
            {(() => {
              const matrixTotal = matrixDays.reduce(
                (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                0
              )
              const tagTotals = new Map<string, number>()
              const tagHours = new Map<string, number>()
              for (const personName of showPeopleForMatrix) {
                const periodCost = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
                const periodHrs = matrixDays.reduce((s, d) => s + getEffectiveHours(personName, d), 0)
                const tags = (costMatrixTags[personName] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
                for (const tag of tags) {
                  tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + periodCost)
                  tagHours.set(tag, (tagHours.get(tag) ?? 0) + periodHrs)
                }
              }
              const sortedTags = [...tagTotals.entries()].sort((a, b) => b[1] - a[1])
              if (sortedTags.length === 0) return null
              return (
                <section style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Trade</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                    {sortedTags.map(([tag, total]) => {
                      const pct = matrixTotal > 0 ? Math.round((total / matrixTotal) * 100) : 0
                      const hrs = tagHours.get(tag) ?? 0
                      const costPerHr = hrs > 0 ? `$${(total / hrs).toFixed(1)}/hr` : '—'
                      return (
                        <span
                          key={tag}
                          role="button"
                          tabIndex={0}
                          onClick={() => setTagLedgerModalTag(tag)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTagLedgerModalTag(tag) } }}
                          style={{ fontWeight: 500, cursor: 'pointer' }}
                          title="Click to view ledger"
                        >
                          {tag} ${Math.round(total).toLocaleString('en-US')} | {pct}% | {costPerHr}
                        </span>
                      )
                    })}
                  </div>
                </section>
              )
            })()}
            {teamsFiltered.length > 0 && (
              <section style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Team:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                  {teamsFiltered.map((team) => {
                    const costForRange = (start: string, end: string) =>
                      team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                    const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                    return (
                      <span
                        key={team.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTeamLedgerModalTeam(team)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamLedgerModalTeam(team) } }}
                        style={{ fontWeight: 500, cursor: 'pointer' }}
                        title="Click to view ledger"
                      >
                        {team.name}: ${Math.round(periodCost).toLocaleString('en-US')}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}
              </>
              ) : null}
            </section>
            {tagLedgerModalTag && (() => {
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const peopleWithTag = showPeopleForMatrix.filter((p) =>
                (costMatrixTags[p] ?? '').split(',').map((t) => t.trim()).filter(Boolean).includes(tagLedgerModalTag)
              )
              const daysInRange = getDaysInRange(hoursDateStart, hoursDateEnd)
              const memberCostByWeekday = peopleWithTag.map((personName) => {
                const byDay = dayNames.map((_, dayOfWeek) => {
                  const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                  return matchingDays.reduce((sum, d) => sum + getCostForPersonDateMatrix(personName, d), 0)
                })
                const total = byDay.reduce((s, v) => s + v, 0)
                return { personName, byDay, total }
              })
              const costByWeekday = dayNames.map((_, dayOfWeek) =>
                memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
              )
              const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
              return (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setTagLedgerModalTag(null)}
                >
                  <div
                    style={{
                      background: 'white',
                      borderRadius: 8,
                      padding: '1rem 1.25rem',
                      maxWidth: '90vw',
                      maxHeight: '85vh',
                      overflow: 'auto',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                        {tagLedgerModalTag} — Week of {hoursDateStart} to {hoursDateEnd}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTagLedgerModalTag(null)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        Close
                      </button>
                    </div>
                    <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                          {dayNames.map((name) => (
                            <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                          ))}
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberCostByWeekday.map(({ personName, byDay, total }) => (
                          <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                            {byDay.map((val, i) => (
                              <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                            ))}
                            <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                          <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                          {costByWeekday.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                          ))}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
            {teamLedgerModalTeam && (() => {
              const team = teamLedgerModalTeam
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
              const memberCostByWeekday = team.members.map((personName) => {
                const byDay = dayNames.map((_, dayOfWeek) => {
                  const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                  return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(personName, d), 0)
                })
                const total = byDay.reduce((s, v) => s + v, 0)
                return { personName, byDay, total }
              })
              const costByWeekday = dayNames.map((_, dayOfWeek) =>
                memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
              )
              const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
              return (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setTeamLedgerModalTeam(null)}
                >
                  <div
                    style={{
                      background: 'white',
                      borderRadius: 8,
                      padding: '1rem 1.25rem',
                      maxWidth: '90vw',
                      maxHeight: '85vh',
                      overflow: 'auto',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                        {team.name} — {teamPeriodStart} to {teamPeriodEnd}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTeamLedgerModalTeam(null)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        Close
                      </button>
                    </div>
                    <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                          {dayNames.map((name) => (
                            <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                          ))}
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberCostByWeekday.map(({ personName, byDay, total }) => (
                          <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                            {byDay.map((val, i) => (
                              <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                            ))}
                            <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                          <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                          {costByWeekday.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                          ))}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
            {personTimeDetailModalPerson && (
              <PersonTimeDetailModal
                personName={personTimeDetailModalPerson}
                startDate={hoursDateStart}
                endDate={hoursDateEnd}
                hoursRows={peopleHours.filter((h) => h.person_name === personTimeDetailModalPerson).map((h) => ({ work_date: h.work_date, hours: h.hours }))}
                onClose={() => setPersonTimeDetailModalPerson(null)}
              />
            )}
            <section id="cost-matrix" style={HOURS_TAB_SECTION_SHELL}>
              <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.costMatrix)}>
                <button
                  type="button"
                  aria-expanded={hoursTabSectionsOpen.costMatrix}
                  onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, costMatrix: !p.costMatrix }))}
                  style={HOURS_TAB_SECTION_TOGGLE_BTN}
                >
                  <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.costMatrix ? '▼' : '▶'}</span>
                  Cost matrix
                </button>
              </div>
              {hoursTabSectionsOpen.costMatrix ? (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showMaxHours}
                    onChange={(e) => setShowMaxHours(e.target.checked)}
                  />
                  show max hours
                </label>
                {canAccessPay && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={payEditArrangement}
                        onChange={(e) => setPayEditArrangement(e.target.checked)}
                      />
                      edit arrangement
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={payEditTags}
                        onChange={(e) => setPayEditTags(e.target.checked)}
                      />
                      edit tags
                    </label>
                  </>
                )}
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      {canAccessPay && (
                        <th style={{ padding: '0.5rem 0.35rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: 0, top: 0, zIndex: 6, background: '#f9fafb', minWidth: 36 }} title="Hours reviewed (use Review Hours to mark)">
                          ✓
                        </th>
                      )}
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: canAccessPay ? 36 : 0, top: 0, zIndex: 6, background: '#f9fafb' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          Person
                          <button
                            type="button"
                            onClick={() => setMatrixSortBy('cost')}
                            title="Sort by cost (most expensive first)"
                            style={{
                              padding: '0.15rem 0.35rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: matrixSortBy === 'cost' ? '#e5e7eb' : 'white',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: matrixSortBy === 'cost' ? 600 : 400,
                            }}
                          >
                            $
                          </button>
                          <button
                            type="button"
                            onClick={() => setMatrixSortBy('tag')}
                            title="Sort by first tag (A-Z)"
                            style={{
                              padding: '0.15rem 0.35rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: matrixSortBy === 'tag' ? '#e5e7eb' : 'white',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: matrixSortBy === 'tag' ? 600 : 400,
                            }}
                          >
                            tag
                          </button>
                          <button
                            type="button"
                            onClick={() => setMatrixSortBy('name')}
                            title="Sort by name (A-Z)"
                            style={{
                              padding: '0.15rem 0.35rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: matrixSortBy === 'name' ? '#e5e7eb' : 'white',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: matrixSortBy === 'name' ? 600 : 400,
                            }}
                          >
                            name
                          </button>
                        </span>
                      </th>
                      {matrixDays.map((d) => {
                        const dt = new Date(d + 'T12:00:00')
                        const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' })
                        const monthDay = dt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
                        return (
                          <th key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', minWidth: 70, position: 'sticky', top: 0, zIndex: 5, background: '#f9fafb' }}>
                            <span className="cost-matrix-date-header">
                              <span>{weekday}</span>
                              <span> {monthDay}</span>
                            </span>
                          </th>
                        )
                      })}
                    </tr>
                    {canAccessHours ? (
                      <tr>
                        {canAccessPay ? (
                          <th
                            scope="col"
                            style={{
                              padding: '0.25rem 0.35rem',
                              textAlign: 'center',
                              borderBottom: '1px solid #e5e7eb',
                              position: 'sticky',
                              left: 0,
                              top: '2.875rem',
                              zIndex: 6,
                              background: '#f9fafb',
                              minWidth: 36,
                            }}
                          />
                        ) : null}
                        <th
                          scope="col"
                          style={{
                            padding: '0.25rem 0.75rem',
                            textAlign: 'left',
                            borderBottom: '1px solid #e5e7eb',
                            position: 'sticky',
                            left: canAccessPay ? 36 : 0,
                            top: '2.875rem',
                            zIndex: 6,
                            background: '#f9fafb',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#6b7280',
                          }}
                        >
                          Unapproved
                        </th>
                        {matrixDays.map((d) => {
                          const n = pendingUnapprovedCountByWorkDate[d] ?? 0
                          const dt = new Date(d + 'T12:00:00')
                          const longDate = dt.toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                          return (
                            <th
                              key={`matrix-unapproved-${d}`}
                              scope="col"
                              style={{
                                padding: '0.25rem 0.35rem',
                                textAlign: 'right',
                                borderBottom: '1px solid #e5e7eb',
                                minWidth: 70,
                                fontSize: '0.75rem',
                                fontWeight: n > 0 ? 600 : 400,
                                color: n > 0 ? '#b45309' : '#9ca3af',
                                whiteSpace: 'nowrap',
                                position: 'sticky',
                                top: '2.875rem',
                                zIndex: 4,
                                background: '#f9fafb',
                              }}
                              aria-label={`Unapproved sessions on ${longDate}: ${n}`}
                            >
                              {n}
                            </th>
                          )
                        })}
                      </tr>
                    ) : null}
                  </thead>
                  <tbody>
                    {showPeopleForMatrix.map((personName, idx) => {
                      const cfg = payConfig[personName]
                      const wage = cfg?.hourly_wage ?? 0
                      const periodTotal = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
                      return (
                        <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          {canAccessPay && (
                            <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', position: 'sticky', left: 0, background: 'white', minWidth: 36 }}>
                              {hoursReviewedSet.has(personName) ? (
                                <span style={{ color: '#059669' }}>✓</span>
                              ) : (
                                <span style={{ color: '#d1d5db' }}>—</span>
                              )}
                            </td>
                          )}
                          <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: canAccessPay ? 36 : 0, background: 'white', minWidth: 200 }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.2rem', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                {payEditArrangement && canAccessPay ? (
                                  <span style={{ display: 'flex', flexDirection: 'column', gap: 0, marginRight: '0.25rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => moveMatrixRow(personName, 'up')}
                                      disabled={idx === 0}
                                      title="Move up"
                                      style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveMatrixRow(personName, 'down')}
                                      disabled={idx === showPeopleForMatrix.length - 1}
                                      title="Move down"
                                      style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForMatrix.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForMatrix.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                                    >
                                      ▼
                                    </button>
                                  </span>
                                ) : null}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setPersonTimeDetailModalPerson(personName)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPersonTimeDetailModalPerson(personName) } }}
                                  title="View hours detail"
                                  style={{ cursor: 'pointer' }}
                                >
                                  {wage > 0 ? `$${Math.round(periodTotal).toLocaleString('en-US')}` : '—'} | {personName}{cfg?.is_salary && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>(salary)</span>}
                                </span>
                              </span>
                              {payEditTags && canAccessPay ? (
                                <input
                                  type="text"
                                  value={costMatrixTags[personName] ?? ''}
                                  onChange={(e) => setCostMatrixTags((prev) => ({ ...prev, [personName]: e.target.value }))}
                                  onBlur={(e) => saveCostMatrixTags(personName, e.target.value)}
                                  placeholder="Tags (comma-separated)"
                                  style={{ padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', minWidth: 120, marginLeft: 'auto' }}
                                />
                              ) : (costMatrixTags[personName] ?? '').trim() ? (
                                <span style={{ display: 'flex', gap: '0.15rem', flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
                                  {(costMatrixTags[personName] ?? '')
                                    .split(',')
                                    .map((t) => t.trim())
                                    .filter(Boolean)
                                    .map((tag) => (
                                      <span
                                        key={tag}
                                        style={{
                                          padding: '0.1rem 0.35rem',
                                          background: costMatrixTagColors[tag] ?? '#e5e7eb',
                                          borderRadius: 4,
                                          fontSize: '0.7rem',
                                          color: textColorForBackground(costMatrixTagColors[tag] ?? '#e5e7eb'),
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          {matrixDays.map((d) => {
                            const cost = getCostForPersonDateMatrix(personName, d)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                                {wage > 0 ? `$${Math.round(cost).toLocaleString('en-US')}` : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                      {canAccessPay && (
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', position: 'sticky', left: 0, background: '#f9fafb', minWidth: 36 }}>
                          {hoursReviewedSet.size} of {showPeopleForMatrix.length}
                        </td>
                      )}
                      <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: canAccessPay ? 36 : 0, background: '#f9fafb' }}>
                        Internal Team: ${Math.round(
                          matrixDays.reduce(
                            (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                            0
                          )
                        ).toLocaleString('en-US')}
                      </td>
                      {matrixDays.map((d) => {
                        const dayTotal = showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0)
                        return (
                          <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                            ${Math.round(dayTotal).toLocaleString('en-US')}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              </>
              ) : null}
            </section>
            <section id="people-hours-teams" style={HOURS_TAB_SECTION_SHELL}>
              <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.teams)}>
                <button
                  type="button"
                  aria-expanded={hoursTabSectionsOpen.teams}
                  onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, teams: !p.teams }))}
                  style={HOURS_TAB_SECTION_TOGGLE_BTN}
                >
                  <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.teams ? '▼' : '▶'}</span>
                  Teams
                </button>
              </div>
              {hoursTabSectionsOpen.teams ? (
              <>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label>
                  <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                  <input type="date" value={teamPeriodStart} onChange={(e) => setTeamPeriodStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </label>
                <label>
                  <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                  <input type="date" value={teamPeriodEnd} onChange={(e) => setTeamPeriodEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </label>
                {canAccessPay && (
                <button type="button" onClick={addTeam} style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
                  Add team
                </button>
                )}
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                {canViewCostMatrixShared && !canAccessPay ? 'Teams and combined cost for a date range.' : 'Add people to teams to see combined cost for a date range (default: last 7 days).'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {teamsFiltered.map((team) => {
                  const teamsReadOnly = canViewCostMatrixShared && !canAccessPay
                  const costForRange = (start: string, end: string) =>
                    team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                  const today = new Date().toLocaleDateString('en-CA')
                  const yesterday = (() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 1)
                    return d.toLocaleDateString('en-CA')
                  })()
                  const last7Start = (() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 6)
                    return d.toLocaleDateString('en-CA')
                  })()
                  const last3Start = (() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 2)
                    return d.toLocaleDateString('en-CA')
                  })()
                  const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                  const last7Cost = costForRange(last7Start, today)
                  const last3Cost = costForRange(last3Start, today)
                  const yesterdayCost = costForRange(yesterday, yesterday)
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
                  const memberCostByWeekday = team.members.map((m) => {
                    const byDay = dayNames.map((_, dayOfWeek) => {
                      const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                      return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(m, d), 0)
                    })
                    const total = byDay.reduce((s, v) => s + v, 0)
                    return { member: m, byDay, total }
                  })
                  const costByWeekday = dayNames.map((_, dayOfWeek) =>
                    memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
                  )
                  const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
                  return (
                    <div key={team.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        {teamsReadOnly ? (
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{team.name}</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            <input
                              type="text"
                              value={team.name}
                              onChange={(e) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)))}
                              onBlur={(e) => updateTeamName(team.id, e.target.value.trim() || 'New Team')}
                              style={{ padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontWeight: 600, minWidth: 100, fontSize: '0.875rem' }}
                            />
                            <button
                              type="button"
                              aria-label={`Delete team ${team.name}`}
                              title="Delete team"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setTeamToDelete({ id: team.id, name: team.name })}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.15rem 0.35rem',
                                fontSize: '1rem',
                                lineHeight: 1,
                                color: '#6b7280',
                              }}
                            >
                              ×
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 600 }}>Period: ${Math.round(periodCost).toLocaleString('en-US')}</span>
                          <span style={{ color: '#6b7280' }}>7d: ${Math.round(last7Cost).toLocaleString('en-US')}</span>
                          <span style={{ color: '#6b7280' }}>3d: ${Math.round(last3Cost).toLocaleString('en-US')}</span>
                          <span style={{ color: '#6b7280' }}>Yesterday: ${Math.round(yesterdayCost).toLocaleString('en-US')}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {team.members.map((m) => (
                          <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.35rem', background: '#e5e7eb', borderRadius: 4, fontSize: '0.75rem' }}>
                            {m}
                            {!teamsReadOnly && (
                              <button type="button" onClick={() => removeTeamMember(team.id, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}>×</button>
                            )}
                          </span>
                        ))}
                        {!teamsReadOnly && (
                        <select
                          value=""
                          onChange={(e) => {
                            const v = e.target.value
                            if (v) { addTeamMember(team.id, v); e.target.value = '' }
                          }}
                          style={{ padding: '0.15rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem' }}
                        >
                          <option value="">+ Add person</option>
                          {showPeopleForMatrix.filter((p) => !team.members.includes(p)).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        )}
                      </div>
                      <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                            {dayNames.map((name) => (
                              <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                            ))}
                            <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberCostByWeekday.map(({ member, byDay, total }) => (
                            <tr key={member} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.2rem 0.5rem' }}>{member}</td>
                              {byDay.map((val, i) => (
                                <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                              ))}
                              <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                            <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                            {costByWeekday.map((val, i) => (
                              <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                            ))}
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showMaxHoursTeams}
                  onChange={(e) => setShowMaxHoursTeams(e.target.checked)}
                />
                show max hours
              </label>
              </>
              ) : null}
            </section>
            {teamToDelete ? (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 12,
                }}
                onClick={() => {
                  if (!teamDeletingId) setTeamToDelete(null)
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="people-delete-team-title"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: 8,
                    minWidth: 320,
                    maxWidth: 'min(92vw, 420px)',
                  }}
                >
                  <h3 id="people-delete-team-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
                    Delete team?
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.45 }}>
                    Delete <strong>{teamToDelete.name}</strong>? All people on this team will be removed from it. This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={!!teamDeletingId}
                      onClick={() => setTeamToDelete(null)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: 'white',
                        cursor: teamDeletingId ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!!teamDeletingId}
                      onClick={() => void deleteTeam(teamToDelete.id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        border: '1px solid #b91c1c',
                        borderRadius: 4,
                        background: '#b91c1c',
                        color: 'white',
                        cursor: teamDeletingId ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      }}
                    >
                      {teamDeletingId ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
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
            <section id="people-hours-sharing" style={HOURS_TAB_SECTION_SHELL}>
              <div style={hoursTabSectionHeaderGap(hoursTabSectionsOpen.sharing)}>
                <button
                  type="button"
                  aria-expanded={hoursTabSectionsOpen.sharing}
                  onClick={() => setHoursTabSectionsOpen((p) => ({ ...p, sharing: !p.sharing }))}
                  style={HOURS_TAB_SECTION_TOGGLE_BTN}
                >
                  <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{hoursTabSectionsOpen.sharing ? '▼' : '▶'}</span>
                  Sharing & tag colors
                </button>
              </div>
              {hoursTabSectionsOpen.sharing ? (
              <>
            {isDev && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setCostMatrixShareSectionOpen((prev) => !prev)}
                style={{
                  ...HOURS_TAB_SECTION_TOGGLE_BTN,
                  marginBottom: costMatrixShareSectionOpen ? '0.75rem' : 0,
                }}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{costMatrixShareSectionOpen ? '▼' : '▶'}</span>
                Share Cost Matrix and Teams
              </button>
              {costMatrixShareSectionOpen && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Select Masters or assistants to grant view-only access to Cost matrix and Teams.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {costMatrixShareCandidates.map((u) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={costMatrixSharedUserIds.has(u.id)}
                          onChange={(e) => toggleCostMatrixShare(u.id, e.target.checked)}
                          disabled={costMatrixShareSaving}
                        />
                        {u.name || u.email || 'Unknown'} ({u.role === 'master_technician' ? 'Master' : 'Assistant'})
                      </label>
                    ))}
                  </div>
                  {costMatrixShareError && <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>{costMatrixShareError}</p>}
                </div>
              )}
            </div>
            )}
            {canAccessPay && (
            <div>
              <button
                type="button"
                onClick={() => setCostMatrixTagColorsSectionOpen((prev) => !prev)}
                style={{
                  ...HOURS_TAB_SECTION_TOGGLE_BTN,
                  marginBottom: costMatrixTagColorsSectionOpen ? '0.75rem' : 0,
                }}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{costMatrixTagColorsSectionOpen ? '▼' : '▶'}</span>
                Tag colors
              </button>
              {costMatrixTagColorsSectionOpen && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Click a tag to change its color.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    {(() => {
                      const tagsInUse = new Set<string>()
                      for (const tags of Object.values(costMatrixTags)) {
                        for (const t of (tags ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
                          tagsInUse.add(t)
                        }
                      }
                      const tagsWithColors = new Set(Object.keys(costMatrixTagColors))
                      const allTags = [...new Set([...tagsInUse, ...tagsWithColors])].sort()
                      return (
                        <>
                          {allTags.map((tag) => {
                            const bg = costMatrixTagColors[tag] ?? '#e5e7eb'
                            return (
                              <label
                                key={tag}
                                style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                                title="Click to change color"
                              >
                                <input
                                  type="color"
                                  value={bg}
                                  onChange={(e) => saveTagColor(tag, e.target.value)}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    opacity: 0,
                                    cursor: 'pointer',
                                    width: '100%',
                                    height: '100%',
                                  }}
                                />
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.1rem 0.35rem',
                                    background: bg,
                                    borderRadius: 4,
                                    fontSize: '0.7rem',
                                    color: textColorForBackground(bg),
                                  }}
                                >
                                  {tag}
                                </span>
                              </label>
                            )
                          })}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.25rem' }}>
                            <input
                              type="text"
                              placeholder="Add tag"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const t = newTagName.trim()
                                  if (t) {
                                    saveTagColor(t, newTagColor)
                                    setNewTagName('')
                                    setNewTagColor('#e5e7eb')
                                  }
                                }
                              }}
                              style={{ width: 80, padding: '0.1rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.7rem' }}
                            />
                            <label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }} title="Color for new tag">
                              <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0,
                                  cursor: 'pointer',
                                  width: '100%',
                                  height: '100%',
                                }}
                              />
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.1rem 0.35rem',
                                  background: newTagColor,
                                  borderRadius: 4,
                                  fontSize: '0.7rem',
                                  color: textColorForBackground(newTagColor),
                                }}
                              >
                                +
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const t = newTagName.trim()
                                if (t) {
                                  saveTagColor(t, newTagColor)
                                  setNewTagName('')
                                  setNewTagColor('#e5e7eb')
                                }
                              }}
                              style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                            >
                              Add
                            </button>
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
            )}
              </>
              ) : null}
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

      {payStubCalendarPerson && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
          onClick={() => setPayStubCalendarPerson(null)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{payStubCalendarPerson} — Annual Pay to Date</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>
                  <span style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}>Year</span>
                  <select
                    value={payStubCalendarYear}
                    onChange={(e) => setPayStubCalendarYear(parseInt(e.target.value, 10))}
                    style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setPayStubCalendarPerson(null)} style={{ padding: '0.35rem 0.75rem' }}>
                  Close
                </button>
              </div>
            </div>
            {payStubCalendarLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : payStubCalendarData ? (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#22c55e', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Fully paid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#eab308', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Underpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f97316', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Overpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e5e7eb', marginRight: '0.25rem', verticalAlign: 'middle' }} /> No hours</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb', fontSize: '0.625rem' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ background: '#f9fafb', padding: '0.25rem', textAlign: 'center', fontWeight: 600 }}>
                      {d}
                    </div>
                  ))}
                  {(() => {
                    const jan1 = new Date(payStubCalendarYear, 0, 1)
                    const firstSunday = new Date(jan1)
                    firstSunday.setDate(jan1.getDate() - jan1.getDay())
                    const dec31 = new Date(payStubCalendarYear, 11, 31)
                    const lastSunday = new Date(dec31)
                    lastSunday.setDate(dec31.getDate() + (6 - dec31.getDay()))
                    const cells: Array<{ date: string; earned: number; paid: number } | null> = []
                    const d = new Date(firstSunday)
                    while (d <= lastSunday) {
                      const key = d.toLocaleDateString('en-CA')
                      const inYear = d.getFullYear() === payStubCalendarYear
                      if (inYear && payStubCalendarData) {
                        const earned = payStubCalendarData.earnedByDate[key] ?? 0
                        const paid = payStubCalendarData.paidByDate[key] ?? 0
                        cells.push({ date: key, earned, paid })
                      } else {
                        cells.push(null)
                      }
                      d.setDate(d.getDate() + 1)
                    }
                    return cells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={idx} style={{ background: '#f3f4f6', minHeight: 10 }} />
                      }
                      const { date, earned, paid } = cell
                      const tol = 0.01
                      let bg = '#e5e7eb'
                      let title = `${date}: no hours`
                      if (earned > 0 || paid > 0) {
                        if (paid > earned + tol) {
                          bg = '#f97316'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (overpaid)`
                        } else if (paid < earned - tol || (paid === 0 && earned > 0)) {
                          bg = '#eab308'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (underpaid)`
                        } else {
                          bg = '#22c55e'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid`
                        }
                      }
                      return (
                        <div
                          key={idx}
                          style={{ background: bg, minHeight: 10, cursor: 'default' }}
                          title={title}
                        />
                      )
                    })
                  })()}
                </div>
                {payStubCalendarData && (
                  <div style={{ marginTop: '1rem', fontSize: '0.875rem', display: 'flex', gap: '1.5rem' }}>
                    <span>Earned YTD: ${formatCurrency(Object.values(payStubCalendarData.earnedByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>Paid YTD: ${formatCurrency(Object.values(payStubCalendarData.paidByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>
                      Unpaid: $
                      {formatCurrency(
                        Object.entries(payStubCalendarData.earnedByDate).reduce(
                          (s, [k, earned]) => s + Math.max(0, earned - (payStubCalendarData.paidByDate[k] ?? 0)),
                          0
                        )
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  )
}
