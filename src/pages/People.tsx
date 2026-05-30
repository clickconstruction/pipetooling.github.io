import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  TeamSummaryInline,
  type TeamSummaryInlineHandle,
} from '../components/people/teamSummary/TeamSummaryInline'
import { enrichTeamSummaryRowsForInline } from '../components/people/teamSummary/formatters'
import type {
  OverheadRateDecomp,
  TeamSummaryBreakdown,
} from '../components/people/teamSummary/types'
import { WriteupsContractsSubTab } from '../components/writeups/WriteupsContractsSubTab'
import PeopleVehiclesTab from '../components/people/PeopleVehiclesTab'
import PeopleHousingTab from '../components/people/PeopleHousingTab'
import PeopleLicensesTab from '../components/people/PeopleLicensesTab'
import PeopleOffsetsTab from '../components/people/PeopleOffsetsTab'
import PeopleContractsTab from '../components/people/PeopleContractsTab'
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
import { buildCrewMapFromJobsAndBidRows, type MergedCrewMapRow } from '../utils/crewAssignments'
import { formatDateRangeLabel } from '../utils/dateRangeLabel'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, referenceDateForWorkDateYmd, ymdAddDays } from '../utils/dateUtils'

function formatOverheadTabWorkDateLabel(workDateYmd: string): string {
  const d = referenceDateForWorkDateYmd(workDateYmd)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  }).format(d)
}

import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { approveClockSessions } from '../lib/approveClockSessions'
import { clockSessionMatchesSearch } from '../lib/clockSessionSearch'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { resolvePersonIdFromRosterName } from '../lib/payPersonSubject'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
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
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { formatMercuryDebitCardIdCompact } from '../lib/mercuryRawDebitCard'
import {
  bucketOverheadPartsLinesByAccountingLabel,
  overheadPartsAccountingBucketFromDefaultKey,
  sumMaterialsTotalUsdExcludingInternalTransfer,
  type OverheadPartsAccountingBucketKey,
} from '../lib/overheadPartsAccountingBuckets'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import { useHoursGridFirstColWidthPx } from '../hooks/useHoursGridFirstColWidthPx'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useToastContext } from '../contexts/ToastContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerNumberLabel, resolveJobLedgerPrefix } from '../lib/ledgerDisplayPrefixes'
import { HoursUnassignedModal } from '../components/HoursUnassignedModal'
import { PeopleHoursDayAuditModal } from '../components/PeopleHoursDayAuditModal'
import { PeopleHoursDashboardClockStrip } from '../components/people/PeopleHoursDashboardClockStrip'
import { ClockSessionEditSplitModal } from '../components/ClockSessionEditSplitModal'
import { DashboardMyTimeDayEditorModal } from '../components/DashboardMyTimeDayEditorModal'
import { PersonTimeDetailModal } from '../components/PersonTimeDetailModal'
import { ReviewHoursModal } from '../components/ReviewHoursModal'
import { ChecklistTitleWithLinks } from '../components/ChecklistTitleWithLinks'
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
import type { PayConfigRow } from '../types/peoplePayConfig'
import {
  aggregateOtherJobsLaborByPerson,
  aggregateOverheadDetailByPerson,
  aggregateOverheadDetailByPersonTotalScope,
  approvedClosedSessionHours,
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  filterOverheadDetailLines,
  mergeOverheadDayTableRows,
  overheadBucketForSession,
  overheadFactorTotalOverOtherJobs,
  type OverheadClockSessionRow,
  type OverheadDetailScope,
} from '../lib/overheadDailyLabor'
import {
  fetchOtherJobsPartsByDay,
  fetchOverheadOfficePartsByDay,
  type OverheadPartsDetailLine,
} from '../lib/fetchOverheadOfficePartsByDay'
import {
  deleteOverheadOfficeJobLedgerIdSetting,
  fetchOverheadOfficeJobLedgerIdFromAppSettings,
  upsertOverheadOfficeJobLedgerId,
} from '../lib/overheadOfficeJobSettings'
import {
  readOverheadTableSimpleViewFromStorage,
  writeOverheadTableSimpleViewToStorage,
} from '../lib/overheadTableViewStorage'

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }
type PersonKind =
  | 'assistant'
  | 'master_technician'
  | 'sub'
  | 'helper'
  | 'estimator'
  | 'primary'
  | 'superintendent'

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

/** Debounced clock-session reload on People Hours/Pay Realtime (coalesce WAL bursts). */
const PEOPLE_HOURS_CLOCK_REALTIME_DEBOUNCE_MS = 450
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
  const [users, setUsers] = useState<UserRow[]>([])
  const usersRef = useRef<UserRow[]>([])
  usersRef.current = users
  const peopleHoursClockRealtimeInFilter = useMemo(() => {
    const ids = [...new Set(users.map((u) => u.id).filter(Boolean))].sort()
    if (ids.length === 0 || ids.length > PEOPLE_HOURS_CLOCK_REALTIME_MAX_USER_IDS) return null
    return `user_id=in.(${ids.join(',')})`
  }, [users])
  const [people, setPeople] = useState<Person[]>([])
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
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [kind, setKind] = useState<PersonKind>('assistant')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archivedPeople, setArchivedPeople] = useState<Array<Person & { archived_at: string }>>([])
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteConfirm, setInviteConfirm] = useState<Person | null>(null)
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)
  const [personProjects, setPersonProjects] = useState<Record<string, PersonActiveProject[]>>({})
  /** People Users tab: External Subcontractor rows — expanded IDs show Active projects links */
  const [externalSubProjectsExpanded, setExternalSubProjectsExpanded] = useState(() => new Set<string>())
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<PeopleTab>('users')

  // Pay/Hours tab state
  const [hoursTabLoading, setHoursTabLoading] = useState(false)
  /** True once the Hours tab load effect has entered its first loading cycle (past the 80ms delay). Used so deep-link scroll runs after content is stable, not during the pre-load gap that is followed by a loading spinner that unmounts the anchor. */
  const hoursTabFirstLoadCycleStartedRef = useRef(false)
  const hoursTableScrollRef = useRef<HTMLDivElement>(null)
  const hoursFocusClearTimeoutRef = useRef<number | null>(null)
  const [canAccessPay, setCanAccessPay] = useState(false)
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [canAccessLicenses, setCanAccessLicenses] = useState(false)
  const [canAccessContracts, setCanAccessContracts] = useState(false)
  const [canViewCostMatrixShared, setCanViewCostMatrixShared] = useState(false)
  const canOpenHoursTab = canAccessPay || canAccessHours || canViewCostMatrixShared
  const [isDev, setIsDev] = useState(false)
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
  const [canSeePushStatus, setCanSeePushStatus] = useState(false)
  const [pushEnabledUserIds, setPushEnabledUserIds] = useState<Set<string>>(new Set())
  const [locationEnabledUserIds, setLocationEnabledUserIds] = useState<Set<string>>(new Set())
  const [contractSigningStatusByPersonName, setContractSigningStatusByPersonName] = useState<
    Record<string, ContractSigningTrafficLight>
  >({})
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [payConfigSaving, setPayConfigSaving] = useState(false)
  const [payConfigDraft, setPayConfigDraft] = useState<Record<string, string>>({})
  const payConfigRef = useRef(payConfig)
  payConfigRef.current = payConfig
  const payConfigDraftRef = useRef(payConfigDraft)
  payConfigDraftRef.current = payConfigDraft
  const payConfigDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  /** Last successful DB `is_salary` per pay row; used to detect false→true after debounced save. */
  const lastPersistedPayConfigRef = useRef<Record<string, { is_salary: boolean }>>({})
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  const [payConfigModalOpen, setPayConfigModalOpen] = useState(false)
  /** Roster name → still has salary_work_schedule_templates row (for pay config modal orphan indicator). */
  const [salaryTemplateByPersonName, setSalaryTemplateByPersonName] = useState<Record<string, boolean>>({})
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
  type HoursRow = { person_name: string; person_id?: string | null; work_date: string; hours: number }
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [pendingClockSessions, setPendingClockSessions] = useState<ClockSessionRow[]>([])
  const activeClockSessions = useMemo(
    () => pendingClockSessions.filter((s) => s.clocked_out_at == null),
    [pendingClockSessions],
  )
  const pendingApprovalClockSessions = useMemo(
    () => pendingClockSessions.filter((s) => s.clocked_out_at != null),
    [pendingClockSessions],
  )
  const [approvedClockSessions, setApprovedClockSessions] = useState<ClockSessionRow[]>([])
  const [rejectedClockSessions, setRejectedClockSessions] = useState<ClockSessionRow[]>([])
  const [hoursClockSessionsSearch, setHoursClockSessionsSearch] = useState('')
  const activeClockSessionsFiltered = useMemo(
    () => activeClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [activeClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const pendingApprovalClockSessionsFiltered = useMemo(
    () =>
      pendingApprovalClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [pendingApprovalClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const approvedClockSessionsFiltered = useMemo(
    () => approvedClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [approvedClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const rejectedClockSessionsFiltered = useMemo(
    () => rejectedClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [rejectedClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const hoursClockSessionsSearching = hoursClockSessionsSearch.trim().length > 0
  const noClockSessionsMatchSearch =
    hoursClockSessionsSearching &&
    activeClockSessionsFiltered.length === 0 &&
    pendingApprovalClockSessionsFiltered.length === 0 &&
    approvedClockSessionsFiltered.length === 0 &&
    rejectedClockSessionsFiltered.length === 0
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
  const canAccessTeamsTab =
    authRole !== null && ['dev', 'master_technician', 'assistant'].includes(authRole)
  const canAccessOverheadTab =
    authRole !== null && ['dev', 'master_technician'].includes(authRole)
  const canDeletePeopleContracts =
    authRole !== null && ['dev', 'master_technician'].includes(authRole)

  /**
   * Mercury debit-card nicknames used by the Overhead tab's Materials
   * drilldowns to display which card a Mercury allocation was purchased
   * on (e.g. "Mercury · Lowes — Robert's card · $123.45"). Gated on the
   * tab being active so we don't fetch nickname maps for users sitting
   * on other tabs. The hook itself is also role-gated internally and
   * returns empty maps for roles outside dev/master/assistant.
   */
  const { nicknameByDebitCard: overheadMercuryNicknameByDebitCard } = useMercuryLedgerNicknames({
    enabled: activeTab === 'overhead' && canAccessOverheadTab,
  })

  const [overheadDateStart, setOverheadDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  const [overheadDateEnd, setOverheadDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
  const [overheadOfficeJobLedgerId, setOverheadOfficeJobLedgerId] = useState<string | null>(null)
  const [overheadOfficeJobLabel, setOverheadOfficeJobLabel] = useState<{
    hcp_number: string | null
    job_name: string | null
  } | null>(null)
  const [overheadSettingsLoading, setOverheadSettingsLoading] = useState(false)
  const [overheadSessions, setOverheadSessions] = useState<OverheadClockSessionRow[]>([])
  const [overheadSessionsLoading, setOverheadSessionsLoading] = useState(false)
  const [overheadTableSimpleView, setOverheadTableSimpleView] = useState(() =>
    readOverheadTableSimpleViewFromStorage(),
  )
  const [overheadJobPickerOpen, setOverheadJobPickerOpen] = useState(false)
  const [overheadOfficeJobModalOpen, setOverheadOfficeJobModalOpen] = useState(false)
  const [overheadJobSearch, setOverheadJobSearch] = useState('')
  const [overheadJobResults, setOverheadJobResults] = useState<
    Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
  >([])
  const [overheadJobSaving, setOverheadJobSaving] = useState(false)
  const [overheadOfficePartsUsdByDay, setOverheadOfficePartsUsdByDay] = useState<Map<string, number>>(() => new Map())
  const [overheadOfficePartsDetailByDay, setOverheadOfficePartsDetailByDay] = useState<
    Map<string, OverheadPartsDetailLine[]>
  >(() => new Map())
  const [overheadOfficePartsLoading, setOverheadOfficePartsLoading] = useState(false)
  const [overheadAvgDailyCost, setOverheadAvgDailyCost] = useState<{
    avg7: number | null
    avg30: number | null
    avg90: number | null
    per100_7: number | null
    per100_30: number | null
    per100_90: number | null
    loading: boolean
  }>({
    avg7: null,
    avg30: null,
    avg90: null,
    per100_7: null,
    per100_30: null,
    per100_90: null,
    loading: false,
  })
  const [overheadOtherJobsSessions, setOverheadOtherJobsSessions] = useState<OverheadClockSessionRow[]>([])
  const [overheadOtherJobsSessionsLoading, setOverheadOtherJobsSessionsLoading] = useState(false)
  const [overheadOtherJobsPartsUsdByDay, setOverheadOtherJobsPartsUsdByDay] = useState<Map<string, number>>(
    () => new Map(),
  )
  const [overheadOtherJobsPartsDetailByDay, setOverheadOtherJobsPartsDetailByDay] = useState<
    Map<string, OverheadPartsDetailLine[]>
  >(() => new Map())
  const [overheadOtherJobsPartsLoading, setOverheadOtherJobsPartsLoading] = useState(false)
  /**
   * Banking → Accounting drag-sort label bucket for each Mercury transaction
   * referenced by `overheadOtherJobsPartsDetailByDay` (i.e. every Mercury
   * line that surfaces in the Field Total ($) / Hours modal's Materials
   * (field / non-office jobs) dropdown for any day in the active window).
   *
   * Computed once per change to the per-day detail map, not per-modal-open,
   * so flipping between days inside the modal is instant. Tx ids that have
   * no assignment row are absent from the map; the renderer defaults those
   * to the `'other'` bucket via `bucketForOverheadPartsLine`.
   */
  const [overheadOtherJobsAccountingBucketByTxId, setOverheadOtherJobsAccountingBucketByTxId] = useState<
    Map<string, OverheadPartsAccountingBucketKey>
  >(() => new Map())
  const [overheadBreakdownModal, setOverheadBreakdownModal] = useState<null | { workDate: string; scope: OverheadDetailScope }>(
    null,
  )

  // Hours tab state (unassigned hours modal, crew jobs by date)
  type CrewJobAssignment = { job_id: string; pct: number }
  type CrewJobRow = { job_assignments: CrewJobAssignment[] }
  type CrewBidAssignment = { bid_id: string; pct: number }
  type CrewBidRow = { bid_assignments: CrewBidAssignment[] }
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, MergedCrewMapRow>>({})
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)
  const [hoursDayAuditModal, setHoursDayAuditModal] = useState<{ personName: string; workDate: string } | null>(null)

  // Offset form state — only the Record-payment "employee credit" entry point lives here.
  // The Offsets tab UI (list, search, apply-to-stub, add/edit) is in PeopleOffsetsTab.
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [offsetFormInitialCreateDraft, setOffsetFormInitialCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [, setOffsetFormError] = useState<string | null>(null)

  // Review tab state. v2.542 — `last_month` was a misnomer (it's really 30 days
  // rolling back from today, not the previous calendar month) so we renamed the
  // value to `last_30_days` and added a few common period scopes plus a custom
  // range picker. `ReviewPeriod` is local state only (not persisted), so the
  // value rename is safe.
  type ReviewPeriod =
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'last_two_weeks'
    | 'last_30_days'
    | 'last_90_days'
    | 'this_year'
    | 'custom'
  // -1 = no person expanded. The Team Summary table acts as the picker;
  // clicking a name in it toggles the per-person panel into view (v2.X).
  // Replaces the legacy "← Prev | Person ▾ | Next →" row.
  const [selectedReviewPersonIndex, setSelectedReviewPersonIndex] = useState<number>(-1)
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>('last_week')
  // Custom range — only consulted when reviewPeriod === 'custom'. Defaults seed
  // when the user first selects Custom from the dropdown (see UI below).
  const [reviewCustomRangeStart, setReviewCustomRangeStart] = useState<string>('')
  const [reviewCustomRangeEnd, setReviewCustomRangeEnd] = useState<string>('')
  const [reviewLoading, setReviewLoading] = useState(false)
  type ReviewLaborJob = {
    source: 'labor'
    id: string
    job_date: string | null
    address: string
    hoursInfo: string
    hours: number
    job_number: string | null
    job_id: string | null
    job_name: string
    service_type_id: string | null
    laborCost: number
    driveCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    totalLaborOnJob: number
    totalDriveCostOnJob: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
    userTotalDriveCostOnJob: number
  }
  type ReviewCrewJob = {
    source: 'crew'
    job_id: string
    work_date: string
    hcp_number: string
    job_name: string
    job_address: string
    service_type_id: string | null
    hours: number
    laborCost: number
    driveCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    totalLaborOnJob: number
    totalDriveCostOnJob: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
    userTotalDriveCostOnJob: number
  }
  const [reviewLaborJobs, setReviewLaborJobs] = useState<ReviewLaborJob[]>([])
  const [reviewCrewJobs, setReviewCrewJobs] = useState<ReviewCrewJob[]>([])
  const [, setReviewAllocatedRevenue] = useState(0)
  const [reviewAllocatedProfit, setReviewAllocatedProfit] = useState(0)
  const [reviewHours, setReviewHours] = useState<Array<{ work_date: string; hours: number }>>([])
  type ReviewReport = { id: string; template_name: string; job_display_name: string; created_at: string }
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([])
  type ReviewTask = { id: string; title: string; links?: string[] | null; scheduled_date: string; completed_at: string | null }
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [reviewTasksOutstanding, setReviewTasksOutstanding] = useState<ReviewTask[]>([])
  const [reviewJobsWorkedCollapsed, setReviewJobsWorkedCollapsed] = useState(false)
  const [reviewJobExpandedKey, setReviewJobExpandedKey] = useState<string | null>(null)
  type ReviewLaborContributor = {
    personName: string
    hours: number
    laborCost: number
    subLaborCost: number
    crewLaborCost: number
  }
  const [reviewLaborByJobAndPerson, setReviewLaborByJobAndPerson] = useState<Record<string, ReviewLaborContributor[]>>({})
  const [reviewOverheadRates, setReviewOverheadRates] = useState<{
    ratePerHour: number | null
    ratePerRevenueDecimal: number | null
    ratePerLaborDollar: number | null
    loading: boolean
    windowStart: string | null
    windowEnd: string | null
    officeLabor90d: number | null
    bidLabor90d: number | null
    officeParts90d: number | null
    invoices90d: number | null
    fieldHours90d: number | null
    fieldLaborUsd90d: number | null
  }>({
    ratePerHour: null,
    ratePerRevenueDecimal: null,
    ratePerLaborDollar: null,
    loading: false,
    windowStart: null,
    windowEnd: null,
    officeLabor90d: null,
    bidLabor90d: null,
    officeParts90d: null,
    invoices90d: null,
    fieldHours90d: null,
    fieldLaborUsd90d: null,
  })
  // Inline Team Summary (React component) — rows fetched by
  // `openTeamSummaryWindow('inline')` are stored here and the
  // `<TeamSummaryInline>` component renders directly from them (no
  // iframe, no HTML string). The popup path still builds an HTML doc
  // because a `window.open()` target needs a standalone document.
  const [teamSummaryRows, setTeamSummaryRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState<boolean>(false)
  const [teamSummaryError, setTeamSummaryError] = useState<string | null>(null)
  const teamSummaryReqIdRef = useRef(0)
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
  type ReviewLaborBreakdownContext = {
    mode: 'labor' | 'profit'
    jobId: string | null
    jobName: string
    jobAddress: string
    jobNumberLabel: string
    totalLaborOnJob: number
    revenueBeforeOverhead: number
    userPersonName: string
  }
  const [reviewLaborBreakdownContext, setReviewLaborBreakdownContext] = useState<ReviewLaborBreakdownContext | null>(null)
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)
  const [reviewOnlyPaidInFull, setReviewOnlyPaidInFull] = useState(false)
  const loadCrewJobsRef = useRef<() => void>()
  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => {
    if (
      activeTab === 'hours' &&
      (canAccessHours || canAccessPay || canViewCostMatrixShared)
    ) {
      loadPeopleHours(hoursDateStart, hoursDateEnd)
    }
  }

  async function loadPeople() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    setError(null)
    const [peopleRes, usersRes, meRes] = await Promise.all([
      supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').is('archived_at', null).order('kind').order('name'),
      supabase.from('users').select('id, email, name, role, notes, phone').is('archived_at', null).in('role', ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    if (peopleRes.error) setError(peopleRes.error.message)
    else setPeople((peopleRes.data as Person[]) ?? [])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role ?? null
    setAuthUserRole(myRole)
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, email, name, role, notes, phone').is('archived_at', null).eq('role', 'dev')
      if (devUsers && devUsers.length > 0) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    if (usersRes.error) setError(usersRes.error.message)
    setUsers(usersList)
    
    // Load creator names for shared people (created by others)
    const peopleData = (peopleRes.data as Person[]) ?? []
    const creatorIds = [...new Set(peopleData.filter((p) => p.master_user_id !== authUser.id).map((p) => p.master_user_id))]
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from('users').select('id, name, email').is('archived_at', null).in('id', creatorIds)
      const map: Record<string, string> = {}
      for (const c of (creators as Array<{ id: string; name: string | null; email: string | null }>) ?? []) {
        map[c.id] = c.name ?? c.email ?? 'Unknown'
      }
      setCreatorNames(map)
    } else {
      setCreatorNames({})
    }
    
    // Load active projects for all people
    await loadPersonProjects()
    
    await loadArchivedPeople(myRole === 'dev')
    setLoading(false)
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
    loadPeople()
  }, [authUser?.id])

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
    async function loadPayAccess() {
      if (!authUser?.id) return
      const [meRes, approvedRes, sharesRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
        supabase.from('cost_matrix_teams_shares').select('shared_with_user_id').eq('shared_with_user_id', authUser.id).maybeSingle(),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      const hasCostMatrixShare = !!sharesRes.data
      setCanViewCostMatrixShared(hasCostMatrixShare)
      if (role === 'dev') {
        setCanAccessPay(true)
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setIsDev(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'assistant') {
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'master_technician') {
        setCanSeePushStatus(true)
        setCanAccessContracts(true)
        if (approvedIds.has(authUser.id)) {
          setCanAccessPay(true)
          setCanAccessHours(true)
          setCanAccessLicenses(true)
        }
      }
    }
    loadPayAccess()
  }, [authUser?.id])

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

  function openAdd(k: PersonKind) {
    setEditing(null)
    setKind(k)
    setName('')
    setEmail('')
    setPhone('')
    setNotes('')
    setFormOpen(true)
    setError(null)
  }

  function openEdit(p: Person) {
    setEditing(p)
    setKind(p.kind as PersonKind)
    setName(p.name)
    setEmail(p.email ?? '')
    setPhone(p.phone ?? '')
    setNotes(p.notes ?? '')
    setFormOpen(true)
    setError(null)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function checkDuplicateName(nameToCheck: string, excludeId?: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    
    // Check in people table (excluding current person if editing, exclude archived)
    const peopleQuery = supabase
      .from('people')
      .select('id, name')
      .is('archived_at', null)
    if (excludeId) {
      peopleQuery.neq('id', excludeId)
    }
    const { data: peopleData } = await peopleQuery
    
    // Check in users table
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .is('archived_at', null)
    
    // Case-insensitive comparison
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => u.name?.toLowerCase() === trimmedName) ?? false
    
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    setSaving(true)
    setError(null)
    
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      setSaving(false)
      return
    }
    
    // Check for duplicate names (case-insensitive)
    const isDuplicate = await checkDuplicateName(trimmedName, editing?.id)
    if (isDuplicate) {
      setError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSaving(false)
      return
    }

    if (!editing && !canCreatePeopleInRoster) {
      setError('You do not have permission to add people to the roster.')
      setSaving(false)
      return
    }

    const payload = {
      kind,
      name: trimmedName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('people').update(payload).eq('id', editing.id)
      if (err) setError(err.message)
      else {
        const oldName = editing.name?.trim()
        if (oldName && oldName !== trimmedName) {
          await cascadePersonNameInPayTables(oldName, trimmedName)
        }
        setPeople((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)))
        closeForm()
      }
    } else {
      const { data, error: err } = await supabase.from('people').insert({ master_user_id: authUser.id, ...payload }).select('id, master_user_id, kind, name, email, phone, notes').single()
      if (err) setError(err.message)
      else if (data) {
        setPeople((prev) => [...prev, data as Person].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)))
        closeForm()
      }
    }
    setSaving(false)
  }

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

  async function loadArchivedPeople(showAll?: boolean) {
    if (!authUser?.id) return
    const { data } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes, archived_at')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    const list = (data ?? []) as Array<Person & { archived_at: string }>
    const visible = (showAll ?? isDev) ? list : list.filter((p) => p.master_user_id === authUser.id)
    setArchivedPeople(visible)
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

  const loadPayConfigSalaryTemplateIndicators = useCallback(async () => {
    const nameSet = new Set<string>()
    for (const sec of payConfigRosterSections) {
      for (const raw of sec.names) {
        const t = raw.trim()
        if (t) nameSet.add(t)
      }
    }
    const names = [...nameSet]
    const nameToUid = new Map<string, string>()
    for (const u of users) {
      const tn = u.name?.trim()
      if (tn && nameSet.has(tn)) nameToUid.set(tn, u.id)
    }
    const uids = [...new Set(nameToUid.values())]
    if (uids.length === 0) {
      setSalaryTemplateByPersonName({})
      return
    }
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase.from('salary_work_schedule_templates').select('user_id').in('user_id', uids),
        'pay config salary template indicators',
      )
      const list = (rows ?? []) as Array<{ user_id: string }>
      const templateUids = new Set(list.map((r) => r.user_id))
      const out: Record<string, boolean> = {}
      for (const n of names) {
        const uid = nameToUid.get(n)
        out[n] = uid != null && templateUids.has(uid)
      }
      setSalaryTemplateByPersonName(out)
    } catch {
      setSalaryTemplateByPersonName({})
    }
  }, [payConfigRosterSections, users])

  useEffect(() => {
    if (!payConfigModalOpen || !canAccessPay) return
    void loadPayConfigSalaryTemplateIndicators()
  }, [payConfigModalOpen, canAccessPay, loadPayConfigSalaryTemplateIndicators])

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

  async function loadPayConfig() {
    if (!canAccessPay && !canAccessHours && !canViewCostMatrixShared) return
    const { data, error } = await supabase
      .from('people_pay_config')
      .select('person_name, person_id, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
    if (error) {
      setError(error.message)
      return
    }
    // Temporary: log for assistants when RLS may be blocking
    if (!canAccessPay && !canViewCostMatrixShared && (data ?? []).length === 0) {
      console.warn('loadPayConfig: assistant got empty data', { error, rowCount: (data ?? []).length })
    }
    const map: Record<string, PayConfigRow> = {}
    const persistedSalary: Record<string, { is_salary: boolean }> = {}
    for (const r of (data ?? []) as PayConfigRow[]) {
      map[r.person_name] = r
      persistedSalary[r.person_name] = { is_salary: !!r.is_salary }
    }
    lastPersistedPayConfigRef.current = persistedSalary
    setPayConfig(map)
    setPayConfigDraft({})
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

  async function loadPeopleHours(start: string, end: string) {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data, error } = await supabase
      .from('people_hours')
      .select('person_name, person_id, work_date, hours')
      .gte('work_date', start)
      .lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    setPeopleHours((data ?? []) as HoursRow[])
  }

  async function loadPendingClockSessions(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .is('approved_at', null)
      .is('rejected_at', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setPendingClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

  const draftPayrollPendingFetchIdRef = useRef(0)
  const draftPayrollCrewMergeFetchIdRef = useRef(0)
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

  async function loadApprovedClockSessions(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .not('approved_at', 'is', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setApprovedClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

  async function loadRejectedClockSessions(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .not('rejected_at', 'is', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setRejectedClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

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

  useEffect(() => {
    return () => {
      for (const t of Object.values(payConfigDebounceRef.current)) clearTimeout(t)
      payConfigDebounceRef.current = {}
    }
  }, [])

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
  const handleInlineTogglePerson = useCallback(
    (personName: string) => {
      const trimmed = personName.trim()
      if (!trimmed) return
      const idx = showPeopleForReviewRef.current.indexOf(trimmed)
      if (idx < 0) return
      setSelectedReviewPersonIndex((cur) => (cur === idx ? -1 : idx))
    },
    [],
  )
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
    if (activeTab !== 'review' || !isDev || !authUser?.id) return
    let cancelled = false
    setReviewOverheadRates((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const start = ymdAddDays(today, -89)
        const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        let overheadQ = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
        if (officeJobLedgerId) {
          overheadQ = overheadQ.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
        } else {
          overheadQ = overheadQ.not('bid_id', 'is', null)
        }
        let fieldQ = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
          .not('job_ledger_id', 'is', null)
        if (officeJobLedgerId) fieldQ = fieldQ.neq('job_ledger_id', officeJobLedgerId)
        const startIsoLow = `${start}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 1)}T00:00:00-00:00`
        const [overheadSessionsRes, fieldSessionsRes, partsRes, invoiceRowsRes] = await Promise.all([
          withSupabaseRetry(async () => overheadQ, 'load review 90d overhead sessions') as Promise<
            OverheadClockSessionRow[] | null
          >,
          withSupabaseRetry(async () => fieldQ, 'load review 90d field sessions') as Promise<
            OverheadClockSessionRow[] | null
          >,
          officeJobLedgerId
            ? fetchOverheadOfficePartsByDay({
                officeJobLedgerId,
                startYmd: start,
                endYmd: today,
              }).then((r) => r.partsUsdByDay)
            : Promise.resolve(new Map<string, number>()),
          withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger_invoices')
                .select('amount, sent_to_customer_at')
                .gte('sent_to_customer_at', startIsoLow)
                .lt('sent_to_customer_at', endIsoHigh),
            'load review 90d invoices',
          ) as Promise<Array<{ amount: number | null; sent_to_customer_at: string | null }> | null>,
        ])
        if (cancelled) return
        const cfgRows = await withSupabaseRetry(
          async () =>
            supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary'),
          'load review 90d pay config',
        )
        if (cancelled) return
        const cfgList = (cfgRows ?? []) as Array<{
          person_name: string
          hourly_wage: number | null
          is_salary: boolean | null
        }>
        const wageMap = buildOverheadWageLookup(
          cfgList.map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
        )
        const overheadLabor = buildOverheadDailyLabor({
          sessions: (overheadSessionsRes ?? []) as OverheadClockSessionRow[],
          officeJobLedgerId,
          wageByNormalizedName: wageMap,
        })
        const merged = mergeOverheadDayTableRows(overheadLabor.byDay, partsRes, new Map(), new Map(), new Map())
        let overheadTotal = 0
        for (const row of merged) overheadTotal += row.totalUsd
        let officeLabor90d = 0
        let bidLabor90d = 0
        for (const row of overheadLabor.byDay) {
          officeLabor90d += row.officeLaborUsd
          bidLabor90d += row.bidLaborUsd
        }
        let officeParts90d = 0
        for (const v of partsRes.values()) officeParts90d += v
        const fieldSessions = (fieldSessionsRes ?? []) as OverheadClockSessionRow[]
        const wageByName = new Map<string, number>()
        for (const r of cfgList) {
          if (r.hourly_wage != null) wageByName.set(r.person_name.trim().toLowerCase(), Number(r.hourly_wage))
        }
        let fieldHours = 0
        let fieldLaborUsd = 0
        for (const s of fieldSessions) {
          if (s.rejected_at || s.revoked_at) continue
          if (s.approved_at == null) continue
          if (!s.clocked_in_at || !s.clocked_out_at) continue
          const t0 = new Date(s.clocked_in_at).getTime()
          const t1 = new Date(s.clocked_out_at).getTime()
          if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue
          const hrs = (t1 - t0) / 3_600_000
          fieldHours += hrs
          const userName = ((s as unknown as { users?: { name?: string | null } }).users?.name ?? '').trim().toLowerCase()
          const wage = userName ? wageByName.get(userName) ?? 0 : 0
          fieldLaborUsd += hrs * wage
        }
        const invoiceRows = (invoiceRowsRes ?? []) as Array<{
          amount: number | null
          sent_to_customer_at: string | null
        }>
        let revenueTotal = 0
        for (const r of invoiceRows) {
          if (!r.sent_to_customer_at) continue
          revenueTotal += Number(r.amount ?? 0)
        }
        setReviewOverheadRates({
          ratePerHour: fieldHours > 0 ? overheadTotal / fieldHours : null,
          ratePerRevenueDecimal: revenueTotal > 0 ? overheadTotal / revenueTotal : null,
          ratePerLaborDollar: fieldLaborUsd > 0 ? overheadTotal / fieldLaborUsd : null,
          loading: false,
          windowStart: start,
          windowEnd: today,
          officeLabor90d,
          bidLabor90d,
          officeParts90d,
          invoices90d: revenueTotal,
          fieldHours90d: fieldHours,
          fieldLaborUsd90d: fieldLaborUsd,
        })
      } catch {
        if (!cancelled) {
          setReviewOverheadRates({
            ratePerHour: null,
            ratePerRevenueDecimal: null,
            ratePerLaborDollar: null,
            loading: false,
            windowStart: null,
            windowEnd: null,
            officeLabor90d: null,
            bidLabor90d: null,
            officeParts90d: null,
            invoices90d: null,
            fieldHours90d: null,
            fieldLaborUsd90d: null,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, isDev, authUser?.id])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab) return
    let cancelled = false
    setOverheadSettingsLoading(true)
    void (async () => {
      try {
        const id = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        if (cancelled) return
        setOverheadOfficeJobLedgerId(id)
        if (id) {
          const jobRow = (await withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger').select('hcp_number, job_name').eq('id', id).maybeSingle(),
            'fetch overhead office job label',
          )) as { hcp_number: string | null; job_name: string | null } | null
          if (cancelled) return
          if (jobRow) {
            setOverheadOfficeJobLabel({
              hcp_number: jobRow.hcp_number ?? null,
              job_name: jobRow.job_name ?? null,
            })
          } else {
            setOverheadOfficeJobLabel(null)
          }
        } else {
          setOverheadOfficeJobLabel(null)
        }
      } catch {
        if (!cancelled) {
          setOverheadOfficeJobLedgerId(null)
          setOverheadOfficeJobLabel(null)
        }
      } finally {
        if (!cancelled) setOverheadSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, canAccessOverheadTab, authUser?.id])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab) return
    void loadPayConfig()
  }, [activeTab, canAccessOverheadTab])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadSessionsLoading(true)
    void (async () => {
      try {
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', overheadDateStart)
          .lte('work_date', overheadDateEnd)
        if (overheadOfficeJobLedgerId) {
          q = q.or(`job_ledger_id.eq.${overheadOfficeJobLedgerId},bid_id.not.is.null`)
        } else {
          q = q.not('bid_id', 'is', null)
        }
        const data = await withSupabaseRetry(async () => q, 'load overhead clock sessions')
        if (cancelled) return
        setOverheadSessions((data ?? []) as OverheadClockSessionRow[])
      } catch {
        if (!cancelled) setOverheadSessions([])
      } finally {
        if (!cancelled) setOverheadSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    canAccessOverheadTab,
    authUser?.id,
    overheadDateStart,
    overheadDateEnd,
    overheadOfficeJobLedgerId,
  ])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadOtherJobsSessionsLoading(true)
    void (async () => {
      try {
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', overheadDateStart)
          .lte('work_date', overheadDateEnd)
          .not('job_ledger_id', 'is', null)
        if (overheadOfficeJobLedgerId) {
          q = q.neq('job_ledger_id', overheadOfficeJobLedgerId)
        }
        const data = await withSupabaseRetry(async () => q, 'load overhead other jobs clock sessions')
        if (cancelled) return
        setOverheadOtherJobsSessions((data ?? []) as OverheadClockSessionRow[])
      } catch {
        if (!cancelled) setOverheadOtherJobsSessions([])
      } finally {
        if (!cancelled) setOverheadOtherJobsSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    canAccessOverheadTab,
    authUser?.id,
    overheadDateStart,
    overheadDateEnd,
    overheadOfficeJobLedgerId,
  ])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    if (!overheadOfficeJobLedgerId) {
      setOverheadOfficePartsUsdByDay(new Map())
      setOverheadOfficePartsDetailByDay(new Map())
      setOverheadOfficePartsLoading(false)
      return
    }
    let cancelled = false
    setOverheadOfficePartsLoading(true)
    void (async () => {
      try {
        const r = await fetchOverheadOfficePartsByDay({
          officeJobLedgerId: overheadOfficeJobLedgerId,
          startYmd: overheadDateStart,
          endYmd: overheadDateEnd,
        })
        if (cancelled) return
        setOverheadOfficePartsUsdByDay(r.partsUsdByDay)
        setOverheadOfficePartsDetailByDay(r.partsDetailByDay)
      } catch {
        if (!cancelled) {
          setOverheadOfficePartsUsdByDay(new Map())
          setOverheadOfficePartsDetailByDay(new Map())
        }
      } finally {
        if (!cancelled) setOverheadOfficePartsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    canAccessOverheadTab,
    authUser?.id,
    overheadOfficeJobLedgerId,
    overheadDateStart,
    overheadDateEnd,
  ])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadOtherJobsPartsLoading(true)
    void (async () => {
      try {
        const r = await fetchOtherJobsPartsByDay({
          officeJobLedgerId: overheadOfficeJobLedgerId,
          startYmd: overheadDateStart,
          endYmd: overheadDateEnd,
        })
        if (cancelled) return
        setOverheadOtherJobsPartsUsdByDay(r.partsUsdByDay)
        setOverheadOtherJobsPartsDetailByDay(r.partsDetailByDay)
      } catch {
        if (!cancelled) {
          setOverheadOtherJobsPartsUsdByDay(new Map())
          setOverheadOtherJobsPartsDetailByDay(new Map())
        }
      } finally {
        if (!cancelled) setOverheadOtherJobsPartsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    canAccessOverheadTab,
    authUser?.id,
    overheadOfficeJobLedgerId,
    overheadDateStart,
    overheadDateEnd,
  ])

  /**
   * Resolve Banking → Accounting drag-sort label buckets for every
   * Mercury transaction that surfaces as a field/non-office-job Materials
   * line in the active overhead window. Runs whenever the per-day detail
   * map is rebuilt (date range change, office job change, parts refresh).
   *
   * Two-step query: first read the assignment rows for the visible tx ids,
   * then bulk-resolve label `default_key` for the assigned label ids. We
   * skip the second fetch when there are no assignments (no in-clause on
   * an empty array, no wasted RPC).
   */
  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    const txIds: string[] = []
    for (const lines of overheadOtherJobsPartsDetailByDay.values()) {
      for (const ln of lines) {
        if (ln.source === 'mercury' && ln.mercuryTransactionId) {
          txIds.push(ln.mercuryTransactionId)
        }
      }
    }
    if (txIds.length === 0) {
      setOverheadOtherJobsAccountingBucketByTxId(new Map())
      return
    }
    const uniqueTxIds = Array.from(new Set(txIds))
    let cancelled = false
    void (async () => {
      try {
        const assignmentsRaw = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_transaction_drag_sort_assignments')
              .select('mercury_transaction_id, label_id')
              .in('mercury_transaction_id', uniqueTxIds),
          'load overhead other jobs accounting assignments',
        )
        if (cancelled) return
        const assignments = (assignmentsRaw ?? []) as Array<{
          mercury_transaction_id: string
          label_id: string
        }>
        if (assignments.length === 0) {
          setOverheadOtherJobsAccountingBucketByTxId(new Map())
          return
        }
        const labelIds = Array.from(new Set(assignments.map((a) => a.label_id)))
        const labelsRaw = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_drag_sort_labels')
              .select('id, default_key')
              .in('id', labelIds),
          'load overhead other jobs accounting labels',
        )
        if (cancelled) return
        const labels = (labelsRaw ?? []) as Array<{ id: string; default_key: string | null }>
        const defaultKeyByLabelId = new Map<string, string | null>()
        for (const l of labels) defaultKeyByLabelId.set(l.id, l.default_key ?? null)
        const next = new Map<string, OverheadPartsAccountingBucketKey>()
        for (const a of assignments) {
          const defaultKey = defaultKeyByLabelId.get(a.label_id) ?? null
          next.set(a.mercury_transaction_id, overheadPartsAccountingBucketFromDefaultKey(defaultKey))
        }
        setOverheadOtherJobsAccountingBucketByTxId(next)
      } catch {
        if (!cancelled) setOverheadOtherJobsAccountingBucketByTxId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, canAccessOverheadTab, authUser?.id, overheadOtherJobsPartsDetailByDay])

  useEffect(() => {
    if (activeTab !== 'overhead' || !canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadAvgDailyCost((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const start = ymdAddDays(today, -89)
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
        if (overheadOfficeJobLedgerId) {
          q = q.or(`job_ledger_id.eq.${overheadOfficeJobLedgerId},bid_id.not.is.null`)
        } else {
          q = q.not('bid_id', 'is', null)
        }
        const sessionsRes = (await withSupabaseRetry(async () => q, 'load overhead 90d sessions')) as
          | OverheadClockSessionRow[]
          | null
        const sessions = (sessionsRes ?? []) as OverheadClockSessionRow[]
        let partsByDay: Map<string, number> = new Map()
        if (overheadOfficeJobLedgerId) {
          const r = await fetchOverheadOfficePartsByDay({
            officeJobLedgerId: overheadOfficeJobLedgerId,
            startYmd: start,
            endYmd: today,
          })
          partsByDay = r.partsUsdByDay
        }
        if (cancelled) return
        const wageMap = buildOverheadWageLookup(
          Object.values(payConfig).map((r) => ({
            person_name: r.person_name,
            hourly_wage: r.hourly_wage ?? null,
          })),
        )
        const labor = buildOverheadDailyLabor({
          sessions,
          officeJobLedgerId: overheadOfficeJobLedgerId,
          wageByNormalizedName: wageMap,
        })
        const merged = mergeOverheadDayTableRows(labor.byDay, partsByDay, new Map(), new Map(), new Map())
        const totalsByDay = new Map<string, number>()
        for (const row of merged) totalsByDay.set(row.work_date, row.totalUsd)
        const startIsoLow = `${start}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 1)}T00:00:00-00:00`
        const invoiceRowsRes = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .select('amount, sent_to_customer_at')
              .gte('sent_to_customer_at', startIsoLow)
              .lt('sent_to_customer_at', endIsoHigh),
          'load overhead 90d revenue invoices',
        )
        const invoiceRows = (invoiceRowsRes ?? []) as Array<{
          amount: number | null
          sent_to_customer_at: string | null
        }>
        if (cancelled) return
        const revenueByDay = new Map<string, number>()
        for (const r of invoiceRows) {
          if (!r.sent_to_customer_at) continue
          const ymd = calendarYmdInAppTzFromIso(r.sent_to_customer_at)
          revenueByDay.set(ymd, (revenueByDay.get(ymd) ?? 0) + Number(r.amount ?? 0))
        }
        const sumWindow = (n: number) => {
          let cost = 0
          let revenue = 0
          for (let i = 0; i < n; i++) {
            const ymd = ymdAddDays(today, -i)
            cost += totalsByDay.get(ymd) ?? 0
            revenue += revenueByDay.get(ymd) ?? 0
          }
          return { avg: cost / n, per100: revenue > 0 ? (cost / revenue) * 100 : null }
        }
        const w7 = sumWindow(7)
        const w30 = sumWindow(30)
        const w90 = sumWindow(90)
        setOverheadAvgDailyCost({
          avg7: w7.avg,
          avg30: w30.avg,
          avg90: w90.avg,
          per100_7: w7.per100,
          per100_30: w30.per100,
          per100_90: w90.per100,
          loading: false,
        })
      } catch {
        if (!cancelled) {
          setOverheadAvgDailyCost({
            avg7: null,
            avg30: null,
            avg90: null,
            per100_7: null,
            per100_30: null,
            per100_90: null,
            loading: false,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, canAccessOverheadTab, authUser?.id, overheadOfficeJobLedgerId, payConfig])

  useEffect(() => {
    if (!overheadJobPickerOpen) {
      setOverheadJobSearch('')
      setOverheadJobResults([])
      return
    }
    const t = setTimeout(() => {
      const q = overheadJobSearch.trim()
      if (!q) {
        setOverheadJobResults([])
        return
      }
      void supabase.rpc('search_jobs_ledger', { search_text: q }).then(({ data }) => {
        setOverheadJobResults(
          (data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>,
        )
      })
    }, 300)
    return () => clearTimeout(t)
  }, [overheadJobSearch, overheadJobPickerOpen])

  function loadCrewJobsForHoursRange() {
    const days = getDaysInRange(hoursDateStart, hoursDateEnd)
    if (days.length === 0) return
    void Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        bid_assignments: CrewBidAssignment[]
      }>
      setCrewJobsByDatePerson(buildCrewMapFromJobsAndBidRows(jobsRows, bidsRows))
    })
  }

  /** Merges crew rows for Draft Payroll review; Hours tab loader still replaces its range only. */
  function mergeCrewJobsForDateRange(periodStart: string, periodEnd: string) {
    if (periodStart > periodEnd) return
    const days = getDaysInRange(periodStart, periodEnd)
    if (days.length === 0) return
    const fetchId = ++draftPayrollCrewMergeFetchIdRef.current
    void Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      if (fetchId !== draftPayrollCrewMergeFetchIdRef.current) return
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        bid_assignments: CrewBidAssignment[]
      }>
      const partial = buildCrewMapFromJobsAndBidRows(jobsRows, bidsRows)
      setCrewJobsByDatePerson((prev) => ({ ...prev, ...partial }))
    })
  }
  loadCrewJobsRef.current = loadCrewJobsForHoursRange

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
    loadPendingClockSessions(hoursDateStart, hoursDateEnd)
    loadApprovedClockSessions(hoursDateStart, hoursDateEnd)
    loadRejectedClockSessions(hoursDateStart, hoursDateEnd)
  }

  const peopleHoursClockRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const hasAccess = canAccessHours || canAccessPay || canViewCostMatrixShared
    const isRelevantTab = activeTab === 'hours' || activeTab === 'pay_stubs'
    if (!hasAccess || !isRelevantTab) return

    const runClockDerivedReloads = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
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

    const scheduleClockDerivedReloads = () => {
      if (!isDocVisible) return
      if (peopleHoursClockRealtimeTimerRef.current) clearTimeout(peopleHoursClockRealtimeTimerRef.current)
      peopleHoursClockRealtimeTimerRef.current = setTimeout(() => {
        peopleHoursClockRealtimeTimerRef.current = null
        runClockDerivedReloads()
      }, PEOPLE_HOURS_CLOCK_REALTIME_DEBOUNCE_MS)
    }

    const channel = supabase.channel('people-hours-changes')
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'people_hours' }, () => {
      loadPeopleHoursRef.current?.()
    })
    if (peopleHoursClockRealtimeInFilter) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_sessions',
          filter: peopleHoursClockRealtimeInFilter,
        },
        scheduleClockDerivedReloads,
      )
    } else {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'clock_sessions' }, scheduleClockDerivedReloads)
    }
    channel.subscribe()
    return () => {
      if (peopleHoursClockRealtimeTimerRef.current) {
        clearTimeout(peopleHoursClockRealtimeTimerRef.current)
        peopleHoursClockRealtimeTimerRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [
    activeTab,
    canAccessHours,
    canAccessPay,
    canViewCostMatrixShared,
    hoursDateStart,
    hoursDateEnd,
    isDocVisible,
    peopleHoursClockRealtimeInFilter,
  ])

  function upsertPayConfig(personName: string, row: Partial<PayConfigRow>) {
    if (!canAccessPay) return
    const roster = peopleRosterRef.current
    const resolvedPid = resolvePersonIdFromRosterName(roster, personName)
    const cur =
      payConfig[personName] ?? {
        person_name: personName,
        person_id: resolvedPid,
        hourly_wage: null,
        is_salary: false,
        show_in_hours: false,
        show_in_cost_matrix: false,
        record_hours_but_salary: false,
      }
    const full = {
      person_name: personName,
      person_id: row.person_id ?? resolvedPid ?? cur.person_id ?? null,
      hourly_wage: row.hourly_wage ?? cur.hourly_wage,
      is_salary: row.is_salary ?? cur.is_salary,
      show_in_hours: row.show_in_hours ?? cur.show_in_hours,
      show_in_cost_matrix: row.show_in_cost_matrix ?? cur.show_in_cost_matrix,
      record_hours_but_salary: row.record_hours_but_salary ?? cur.record_hours_but_salary,
    }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const toSave = payConfigRef.current[personName] ?? full
      const prevPersistedSalary = lastPersistedPayConfigRef.current[personName]?.is_salary === true
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) {
        setError(error.message)
      } else {
        const becameSalary = toSave.is_salary === true && !prevPersistedSalary
        const stoppedBeingSalary = toSave.is_salary === false && prevPersistedSalary
        lastPersistedPayConfigRef.current[personName] = { is_salary: !!toSave.is_salary }
        const uidMatch = usersRef.current.find((u) => u.name?.trim() === personName.trim())?.id
        if (becameSalary) {
          if (uidMatch) {
            const { error: syncErr } = await syncSalaryClockSessionsForUserDay(uidMatch, denverWorkDateToday())
            if (syncErr) showToast(syncErr, 'error')
          } else {
            showToast(
              'Salary saved. No matching login user for this name—salary time sync skipped.',
              'info',
            )
          }
        } else if (stoppedBeingSalary) {
          try {
            const payload = await withSupabaseRetry(
              async () =>
                supabase.rpc('pay_staff_clear_salary_schedule_by_person_name', {
                  p_person_name: personName.trim(),
                }),
              'pay_staff_clear_salary_schedule_by_person_name',
            )
            const result = payload as { ok?: boolean; message?: string }
            if (result?.ok === true) {
              showToast('Salaried work schedule removed.', 'success')
              void loadPayConfigSalaryTemplateIndicators()
            } else {
              showToast(
                typeof result?.message === 'string' && result.message.length > 0
                  ? result.message
                  : 'Could not remove salaried work schedule.',
                'error',
              )
            }
          } catch (e) {
            showToast(formatErrorMessage(e, 'Could not remove salaried work schedule'), 'error')
          }
        }
      }
      setPayConfigSaving(false)
    }, 2000)
  }

  function updatePayConfigHourlyWage(personName: string, rawValue: string) {
    if (!canAccessPay) return
    setPayConfigDraft((prev) => ({ ...prev, [personName]: rawValue }))
    const roster = peopleRosterRef.current
    const resolvedPid = resolvePersonIdFromRosterName(roster, personName)
    const cur =
      payConfig[personName] ?? {
        person_name: personName,
        person_id: resolvedPid,
        hourly_wage: null,
        is_salary: false,
        show_in_hours: false,
        show_in_cost_matrix: false,
        record_hours_but_salary: false,
      }
    const parsed = rawValue === '' ? null : parseFloat(rawValue) || null
    const full = { ...cur, hourly_wage: parsed }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const draftVal = payConfigDraftRef.current[personName]
      const finalWage = draftVal !== undefined ? (draftVal === '' ? null : parseFloat(draftVal) || null) : (payConfigRef.current[personName]?.hourly_wage ?? null)
      const toSave = { ...(payConfigRef.current[personName] ?? full), hourly_wage: finalWage }
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) setError(error.message)
      else {
        lastPersistedPayConfigRef.current[personName] = { is_salary: !!toSave.is_salary }
        setPayConfigDraft((prev) => {
          const next = { ...prev }
          delete next[personName]
          return next
        })
      }
      setPayConfigSaving(false)
    }, 2000)
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    if (!canAccessHours && !canAccessPay) return
    if (hoursDaysCorrect.has(workDate)) return
    const roster = peopleRosterRef.current
    const person_id = resolvePersonIdFromRosterName(roster, personName)
    // Optimistic update: show new value immediately
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, person_id: person_id ?? null, work_date: workDate, hours }]
    })
    const { error } = await supabase.from('people_hours').upsert(
      { person_name: personName, person_id, work_date: workDate, hours, entered_by: authUser?.id ?? null },
      { onConflict: 'person_name,work_date' }
    )
    if (error) setError(error.message)
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

  // Names that exist only as `people` rows (External Subs / Helpers / etc.) and
  // do not have a matching internal `users` account. Used to keep External-only
  // entries out of the Review tab person list, which is meant for employees.
  const externalOnlyPayConfigNamesLower = useMemo(() => {
    const out = new Set<string>()
    if (users.length === 0 && people.length === 0) return out
    const userNamesLower = new Set(
      users.map((u) => (u.name ?? '').trim().toLowerCase()).filter(Boolean),
    )
    for (const p of people) {
      const key = (p.name ?? '').trim().toLowerCase()
      if (key && !userNamesLower.has(key)) out.add(key)
    }
    return out
  }, [users, people])

  const showPeopleForReview = useMemo(
    () =>
      [...Object.keys(payConfig)]
        .filter((n) => !archivedUserNames.has(n.trim()))
        .filter((n) => !externalOnlyPayConfigNamesLower.has(n.trim().toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [payConfig, archivedUserNames, externalOnlyPayConfigNamesLower]
  )
  // Stale-closure-safe mirror for the inline Team Summary callbacks
  // (handleInlineTogglePerson is created with `useCallback([])`) so it
  // can read the latest roster without a re-create churn.
  const showPeopleForReviewRef = useRef<string[]>([])
  showPeopleForReviewRef.current = showPeopleForReview

  // Derived view-models passed to `<TeamSummaryInline>`. Kept as memos
  // so the table doesn't reflow on unrelated People state changes.
  const teamSummarySelectedPersonName = useMemo<string | null>(
    () =>
      selectedReviewPersonIndex >= 0
        ? showPeopleForReview[selectedReviewPersonIndex] ?? null
        : null,
    [selectedReviewPersonIndex, showPeopleForReview],
  )
  const teamSummaryOverheadDecomp = useMemo<OverheadRateDecomp>(
    () => ({
      ratePerHour: reviewOverheadRates.ratePerHour,
      ratePerRevenueDecimal: reviewOverheadRates.ratePerRevenueDecimal,
      ratePerLaborDollar: reviewOverheadRates.ratePerLaborDollar,
      windowStart: reviewOverheadRates.windowStart,
      windowEnd: reviewOverheadRates.windowEnd,
      officeLabor90d: reviewOverheadRates.officeLabor90d ?? 0,
      bidLabor90d: reviewOverheadRates.bidLabor90d ?? 0,
      officeParts90d: reviewOverheadRates.officeParts90d ?? 0,
      invoices90d: reviewOverheadRates.invoices90d ?? 0,
      fieldHours90d: reviewOverheadRates.fieldHours90d ?? 0,
      fieldLaborUsd90d: reviewOverheadRates.fieldLaborUsd90d ?? 0,
    }),
    [reviewOverheadRates],
  )
  // Build the breakdowns payload from the loaded rows. Equivalent to
  // the per-rebuild work `openTeamSummaryWindow('inline')` used to do
  // before encoding it into the iframe `srcDoc`.
  const teamSummaryBreakdowns = useMemo<TeamSummaryBreakdown[]>(() => {
    if (!teamSummaryRows) return []
    return enrichTeamSummaryRowsForInline(
      teamSummaryRows,
      reviewOverheadRates.ratePerHour,
      (name) => {
        const cfg = payConfig[name]
        if (!cfg) return 'unknown'
        return cfg.is_salary ? 'salary' : 'hourly'
      },
    )
  }, [teamSummaryRows, reviewOverheadRates.ratePerHour, payConfig])

  useEffect(() => {
    if (activeTab !== 'review' || !isDev) return
    // Any dep change invalidates the popup's cache (rows would be stale).
    // `loadTeamSummaryData().then(...)` below re-populates it on success.
    // While the load is in flight the popup path falls back to a fresh
    // fetch (pre-v2.542 behavior), avoiding stale-cache hits.
    teamSummaryDataCacheRef.current = null
    if (showPeopleForReview.length === 0) {
      teamSummaryReqIdRef.current += 1
      setTeamSummaryRows(null)
      setTeamSummaryError(null)
      setTeamSummaryLoading(false)
      teamSummaryRefreshPendingRef.current = false
      return
    }
    if (Object.keys(payConfig).length === 0) return
    // Custom range with a half-finished pair shouldn't trigger a load — it's
    // pretty common to type one date and not the other for a moment, and we
    // don't want to thrash the network or temporarily collapse to "today".
    if (
      reviewPeriod === 'custom' &&
      (!reviewCustomRangeStart || !reviewCustomRangeEnd)
    ) {
      return
    }
    // Drilldown protection: if a modal is open inside the iframe, defer the
    // rebuild until the user closes it. We mark pending and the message
    // handler will bump `teamSummaryDrainTick` to re-run this effect.
    if (teamSummaryModalOpenRef.current) {
      teamSummaryRefreshPendingRef.current = true
      return
    }
    const t = window.setTimeout(() => {
      openTeamSummaryWindow('inline')
    }, 200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    isDev,
    reviewPeriod,
    reviewCustomRangeStart,
    reviewCustomRangeEnd,
    reviewOnlyPaidInFull,
    payConfig,
    showPeopleForReview,
    reviewOverheadRates.ratePerHour,
    reviewOverheadRates.loading,
    teamSummaryDrainTick,
  ])

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

  function getReviewDateRange(): [string, string] {
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-CA')
    if (reviewPeriod === 'today') return [todayStr, todayStr]
    if (reviewPeriod === 'yesterday') {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const y = d.toLocaleDateString('en-CA')
      return [y, y]
    }
    if (reviewPeriod === 'custom') {
      // Empty inputs collapse to "today" so the table still has *something*
      // to render rather than throwing on an invalid range. The UI surfaces
      // a hint when both inputs are empty.
      const cs = reviewCustomRangeStart.trim()
      const ce = reviewCustomRangeEnd.trim()
      if (cs && ce) {
        // Swap if the user picked them in the wrong order.
        return cs <= ce ? [cs, ce] : [ce, cs]
      }
      if (cs && !ce) return [cs, cs]
      if (!cs && ce) return [ce, ce]
      return [todayStr, todayStr]
    }
    // Current week's Sunday (start of this week)
    const day = today.getDay()
    const thisWeekSunday = new Date(today)
    thisWeekSunday.setDate(today.getDate() - day)
    if (reviewPeriod === 'this_week') {
      // Sunday of this week through today (running week, mid-week monitoring).
      return [thisWeekSunday.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'last_week') {
      const lastWeekSunday = new Date(thisWeekSunday)
      lastWeekSunday.setDate(thisWeekSunday.getDate() - 7)
      const lastWeekSaturday = new Date(lastWeekSunday)
      lastWeekSaturday.setDate(lastWeekSunday.getDate() + 6)
      return [lastWeekSunday.toLocaleDateString('en-CA'), lastWeekSaturday.toLocaleDateString('en-CA')]
    }
    if (reviewPeriod === 'last_30_days') {
      // Rolling 30 days back from today (was previously labeled "Last month";
      // the label was a misnomer — see ReviewPeriod doc above).
      const start = new Date(today)
      start.setDate(today.getDate() - 30)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'last_90_days') {
      const start = new Date(today)
      start.setDate(today.getDate() - 90)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'this_year') {
      // Calendar year-to-date (Jan 1 → today).
      const start = new Date(today.getFullYear(), 0, 1)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    // last_two_weeks (default fallthrough)
    const twoWeeksAgoSunday = new Date(thisWeekSunday)
    twoWeeksAgoSunday.setDate(thisWeekSunday.getDate() - 14)
    const lastWeekSaturday = new Date(thisWeekSunday)
    lastWeekSaturday.setDate(thisWeekSunday.getDate() - 1)
    return [twoWeeksAgoSunday.toLocaleDateString('en-CA'), lastWeekSaturday.toLocaleDateString('en-CA')]
  }

  function stripAddressZipState(addr: string): string {
    return (addr ?? '').replace(/\s*,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/i, '').trim()
  }

  function formatDateWithDay(dateStr: string | null): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T12:00:00')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayNames[d.getDay()]
    const month = d.getMonth() + 1
    const dayNum = d.getDate()
    return `${day} ${month}/${dayNum}`
  }

  function formatHrsLabel(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) return ''
    const isWhole = Math.abs(hours - Math.round(hours)) < 0.005
    if (isWhole) {
      const n = Math.round(hours)
      return `${n}${n === 1 ? 'hr' : 'hrs'}`
    }
    const rounded = hours.toFixed(2)
    return `${rounded.startsWith('0.') ? rounded.slice(1) : rounded}hrs`
  }

  function getReviewPeriodPay(personName: string): number {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    return days.reduce((sum, d) => sum + getPayForPersonDate(personName, d), 0)
  }

  function getPayForPersonDate(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    const dayOfWeek = new Date(workDate + 'T12:00:00').getDay()
    const hrs = cfg?.is_salary
      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
      : (reviewHours.find((h) => h.work_date === workDate)?.hours ?? 0)
    return hrs * wage
  }

  async function loadReviewData(
    personName: string,
    forTeamSummary?: boolean,
    onlyPaidJobs?: boolean
  ): Promise<{ allocatedRevenue: number; allocatedProfit: number; hoursRows: Array<{ work_date: string; hours: number }>; totalHoursPaidJobs?: number } | void> {
    const [start, end] = getReviewDateRange()
    if (!forTeamSummary) {
      setReviewLoading(true)
      setReviewLaborJobs([])
      setReviewCrewJobs([])
      setReviewAllocatedRevenue(0)
      setReviewAllocatedProfit(0)
      setReviewHours([])
      setReviewReports([])
      setReviewTasks([])
      setReviewTasksOutstanding([])
      setReviewLaborByJobAndPerson({})
      setReviewLaborBreakdownContext(null)
    }

    const userId = users.find((u) => u.name === personName)?.id ?? null

    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const lookbackStart = twoYearsAgo.toLocaleDateString('en-CA')

    const [laborRes, allLaborResForCostAllTime, personLaborResAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', lookbackStart),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart),
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.rpc('list_reports_with_job_info'),
      userId && !forTeamSummary
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
            .eq('checklist_instance_assignees.user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', start + 'T00:00:00')
            .lte('completed_at', end + 'T23:59:59')
        : Promise.resolve({ data: [] }),
      userId && !forTeamSummary
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
            .eq('checklist_instance_assignees.user_id', userId)
            .is('completed_at', null)
            .order('scheduled_date', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart),
    ])

    const laborRows = (laborRes.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const allLaborRowsForCostAllTime = (allLaborResForCostAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }>
    const personLaborRowsAllTime = (personLaborResAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const hoursRows = (hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>
    const allReports = (reportsRes.data ?? []) as Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string }>
    const taskInstances = (tasksRes.data ?? []) as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string; links?: string[] | null } | null }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>
    const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const allHoursRowsAllTime = (allHoursResAllTime.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const hoursMap: Record<string, number> = {}
    for (const h of allHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }
    const hoursMapAllTime: Record<string, number> = {}
    for (const h of allHoursRowsAllTime) {
      hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIdsForCost = allLaborRowsForCostAllTime.map((r) => r.id)
    const laborItemsRes =
      allLaborJobIdsForCost.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIdsForCost)
        : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByJob = new Map<string, typeof laborItems>()
    for (const i of laborItems) {
      const list = itemsByJob.get(i.job_id) ?? []
      list.push(i)
      itemsByJob.set(i.job_id, list)
    }

    const laborCostByHcp = new Map<string, number>()
    const driveCostByHcp = new Map<string, number>()
    for (const r of allLaborRowsForCostAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
      if (driveCost > 0) driveCostByHcp.set(hcp, (driveCostByHcp.get(hcp) ?? 0) + driveCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
    for (const r of allCrewRowsForCostAllTime) {
      crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewJobIds = new Set<string>()
    const crewJobsWithLead: Array<{ work_date: string; job_id: string; pct: number }> = []
    for (const r of crewRows) {
      if (r.person_name !== personName) continue
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      for (const a of assignments) {
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const allJobIds = [...crewJobIds]
    const laborHcps = [...new Set(laborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const personLaborHcps = [...new Set(personLaborRowsAllTime.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const allLaborHcps = [...new Set([...laborHcps, ...personLaborHcps])]
    const usePaidOnly = onlyPaidJobs ?? reviewOnlyPaidInFull
    const [crewJobsRes, laborJobsRes] = await Promise.all([
      allJobIds.length > 0
        ? usePaidOnly
          ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
          : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
        : { data: [] },
      allLaborHcps.length > 0
        ? usePaidOnly
          ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: allLaborHcps })
          : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: allLaborHcps })
        : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const laborJobsLedger = (laborJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }

    const laborByJobAndPerson = new Map<string, Map<string, { hours: number; subLaborCost: number; crewLaborCost: number }>>()
    const upsertContrib = (jobId: string, personName: string, hours: number, subCost: number, crewCost: number) => {
      let perJob = laborByJobAndPerson.get(jobId)
      if (!perJob) {
        perJob = new Map()
        laborByJobAndPerson.set(jobId, perJob)
      }
      const existing = perJob.get(personName) ?? { hours: 0, subLaborCost: 0, crewLaborCost: 0 }
      existing.hours += hours
      existing.subLaborCost += subCost
      existing.crewLaborCost += crewCost
      perJob.set(personName, existing)
    }
    for (const r of allLaborRowsForCostAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const cost = hrs * rate + driveCost
      const who = (r.assigned_to_name ?? '').trim() || '(Unassigned)'
      upsertContrib(jobId, who, hrs, cost, 0)
    }
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        upsertContrib(a.job_id, r.person_name, pctHrs, 0, cost)
      }
    }

    const personLaborCostByJobId = new Map<string, number>()
    const personCrewLaborByJobId = new Map<string, number>()
    const personDriveCostByJobId = new Map<string, number>()
    for (const r of personLaborRowsAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      personLaborCostByJobId.set(jobId, (personLaborCostByJobId.get(jobId) ?? 0) + laborCost)
      if (driveCost > 0) personDriveCostByJobId.set(jobId, (personDriveCostByJobId.get(jobId) ?? 0) + driveCost)
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        personLaborCostByJobId.set(a.job_id, (personLaborCostByJobId.get(a.job_id) ?? 0) + cost)
        personCrewLaborByJobId.set(a.job_id, (personCrewLaborByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const personHoursOnJobAllTime = new Map<string, number>()
    for (const r of personLaborRowsAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      personHoursOnJobAllTime.set(jobId, (personHoursOnJobAllTime.get(jobId) ?? 0) + hrs)
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        personHoursOnJobAllTime.set(a.job_id, (personHoursOnJobAllTime.get(a.job_id) ?? 0) + pctHrs)
      }
    }

    const jobIds = Array.from(jobsById.keys())
    const [invoiceRes, materialsRes] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      jobIds.length > 0 ? supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }

    const laborRowsFiltered = usePaidOnly
      ? laborRows.filter((r) => {
          const hcp = (r.job_number ?? '').trim().toLowerCase()
          return hcp && jobIdByHcp.has(hcp)
        })
      : laborRows
    const laborJobs: ReviewLaborJob[] = laborRowsFiltered.map((r) => {
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const hoursInfo = items.length > 0 ? `${totalHrs.toFixed(2)} (${items.length} items)` : '—'
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      const job = jobId ? jobsById.get(jobId) : null
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      const partsCost = jobId ? (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) : 0
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (jobId ? (teamLaborCostByJobId.get(jobId) ?? 0) : 0)
      const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
      return {
        source: 'labor',
        id: r.id,
        job_date: r.job_date,
        address: r.address ?? '',
        hoursInfo,
        hours: totalHrs,
        job_number: r.job_number,
        job_id: jobId,
        job_name: job?.job_name ?? '—',
        service_type_id: job?.service_type_id ?? null,
        laborCost,
        driveCost,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: Math.max(0, (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) - laborCost),
        totalLaborOnJob: totalJobLabor,
        totalDriveCostOnJob: hcp ? (driveCostByHcp.get(hcp) ?? 0) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
        userTotalDriveCostOnJob: jobId ? (personDriveCostByJobId.get(jobId) ?? 0) : 0,
      }
    })

    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }> = {}
    for (const j of crewJobsLedger) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue, pct_complete: j.pct_complete, service_type_id: j.service_type_id ?? null }
    }
    const crewJobsWithLeadFiltered = usePaidOnly
      ? crewJobsWithLead.filter((c) => jobsById.has(c.job_id))
      : crewJobsWithLead
    const cfg = personName ? payConfig[personName] : undefined
    const crewJobs: ReviewCrewJob[] = crewJobsWithLeadFiltered.map((c) => {
      const j = jobsMap[c.job_id] ?? jobsById.get(c.job_id)
      const day = new Date(c.work_date + 'T12:00:00').getDay()
      const dayHours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${personName}:${c.work_date}`] ?? 0)
      const hours = dayHours * (c.pct / 100)
      const laborCost = hours * (cfg?.hourly_wage ?? 0)
      const partsCost = (partsCostByJobId.get(c.job_id) ?? 0) + (invoiceAmountByJob[c.job_id] ?? 0) + (billedMaterialsByJobId.get(c.job_id) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (teamLaborCostByJobId.get(c.job_id) ?? 0)
      const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
      return {
        source: 'crew',
        job_id: c.job_id,
        work_date: c.work_date,
        hcp_number: j?.hcp_number ?? '—',
        job_name: j?.job_name ?? '—',
        job_address: j?.job_address ?? '—',
        service_type_id: j?.service_type_id ?? null,
        hours,
        laborCost,
        driveCost: 0,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0,
        totalLaborOnJob: totalJobLabor,
        totalDriveCostOnJob: hcp ? (driveCostByHcp.get(hcp) ?? 0) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
        userTotalDriveCostOnJob: personDriveCostByJobId.get(c.job_id) ?? 0,
      }
    })

    const startDate = new Date(start + 'T00:00:00').getTime()
    const endDate = new Date(end + 'T23:59:59').getTime()
    const reports = allReports.filter((r) => r.created_by_name === personName && new Date(r.created_at).getTime() >= startDate && new Date(r.created_at).getTime() <= endDate)

    const tasks: ReviewTask[] = taskInstances.map((t) => ({
      id: t.id,
      title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
      links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
      scheduled_date: t.scheduled_date,
      completed_at: t.completed_at,
    }))

    const outstandingInstances = (outstandingTasksRes.data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      completed_at: string | null
      checklist_items: { title: string; links?: string[] | null } | null
    }>
    const outstandingTasks: ReviewTask[] = outstandingInstances
      .map((t) => ({
        id: t.id,
        title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
        links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
        scheduled_date: t.scheduled_date,
        completed_at: null as string | null,
      }))
      .sort((a, b) => {
        const as = (a.scheduled_date ?? '').trim()
        const bs = (b.scheduled_date ?? '').trim()
        if (!as && !bs) return 0
        if (!as) return 1
        if (!bs) return -1
        return as.localeCompare(bs)
      })

    const hoursOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }
    for (const j of crewJobs) {
      hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }

    const lookbackStart2Y = (() => {
      const d = new Date(start + 'T12:00:00')
      d.setFullYear(d.getFullYear() - 2)
      return d.toLocaleDateString('en-CA')
    })()
    const lookbackEnd = (() => {
      const d = new Date(end + 'T12:00:00')
      d.setFullYear(d.getFullYear() + 1)
      return d.toLocaleDateString('en-CA')
    })()

    const [allLaborRes, allCrewRes, allHoursRes2] = await Promise.all([
      forTeamSummary || !(laborHcps.length > 0 || crewJobIds.size > 0) ? Promise.resolve({ data: [] }) : supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart2Y).lte('job_date', lookbackEnd),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
    ])
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const hoursMapAll: Record<string, number> = {}
    for (const h of allHoursRows2) {
      hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIds = allLaborRows.map((r) => r.id)
    const allLaborItemsRes =
      allLaborJobIds.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIds)
        : { data: [] }
    const allLaborItems = (allLaborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByLaborJobId = new Map<string, typeof allLaborItems>()
    for (const i of allLaborItems) {
      const list = itemsByLaborJobId.get(i.job_id) ?? []
      list.push(i)
      itemsByLaborJobId.set(i.job_id, list)
    }

    const allHcpSet = new Set([
      ...laborHcps,
      ...Array.from(jobsById.values())
        .map((j) => (j.hcp_number ?? '').trim().toLowerCase())
        .filter(Boolean),
    ])
    const totalHoursOnJob = new Map<string, number>()
    const totalHoursOnJobInPeriod = new Map<string, number>()
    const laborHcpSet = new Set(laborHcps)
    for (const r of allLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp || !allHcpSet.has(hcp)) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByLaborJobId.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      totalHoursOnJob.set(jobId, (totalHoursOnJob.get(jobId) ?? 0) + hrs)
      if (r.job_date && r.job_date >= start && r.job_date <= end && laborHcpSet.has(hcp)) {
        totalHoursOnJobInPeriod.set(jobId, (totalHoursOnJobInPeriod.get(jobId) ?? 0) + hrs)
      }
    }
    const allCrewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of allCrewRows) {
      allCrewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const allJobIdsForCrew = [...new Set([...crewJobIds, ...Array.from(jobIdByHcp.values())])]
    const jobIdsSet = new Set(allJobIdsForCrew)
    for (const r of allCrewRows) {
      const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAll[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        if (!jobIdsSet.has(a.job_id)) continue
        const pctHrs = hours * (a.pct / 100)
        totalHoursOnJob.set(a.job_id, (totalHoursOnJob.get(a.job_id) ?? 0) + pctHrs)
        if (r.work_date >= start && r.work_date <= end) {
          totalHoursOnJobInPeriod.set(a.job_id, (totalHoursOnJobInPeriod.get(a.job_id) ?? 0) + pctHrs)
        }
      }
    }

    const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number; totalLaborOnJob: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = jobsById.get(jobId)
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const totalLaborOnJob = subLaborCost + teamLaborCost
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }
    for (const jobId of crewJobIds) {
      if (allocationJobsMap.has(jobId)) continue
      const j = jobsById.get(jobId)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const totalLaborOnJob = subLaborCost + (teamLaborCostByJobId.get(jobId) ?? 0)
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }

    const costOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }
    for (const j of crewJobs) {
      costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }

    let allocatedRevenue = 0
    let allocatedProfit = 0
    for (const [jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob }] of allocationJobsMap) {
      const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
      const ratio = totalLaborOnJob > 0 ? costInPeriod / totalLaborOnJob : (costInPeriod > 0 ? 1 : 0)
      allocatedRevenue += valueCreated * ratio
      allocatedProfit += revenueBeforeOverhead * ratio
    }

    if (forTeamSummary) {
      return {
        allocatedRevenue,
        allocatedProfit,
        hoursRows: hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })),
        ...(usePaidOnly && {
          totalHoursPaidJobs: laborJobs.reduce((s, j) => s + j.hours, 0) + crewJobs.reduce((s, j) => s + j.hours, 0),
        }),
      }
    }

    for (const j of laborJobs) {
      j.totalJobHours = j.job_id ? (totalHoursOnJob.get(j.job_id) ?? 0) : 0
      j.userTotalHoursOnJob = j.job_id ? (personHoursOnJobAllTime.get(j.job_id) ?? 0) : 0
      j.userTotalLaborOnJob = j.job_id ? (personLaborCostByJobId.get(j.job_id) ?? 0) : 0
      const denominator = j.totalLaborOnJob
      const costRatio = denominator > 0 ? j.laborCost / denominator : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = denominator > 0 ? j.userTotalLaborOnJob / denominator : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * costRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }
    for (const j of crewJobs) {
      j.totalJobHours = totalHoursOnJob.get(j.job_id) ?? 0
      j.userTotalHoursOnJob = personHoursOnJobAllTime.get(j.job_id) ?? 0
      j.userTotalLaborOnJob = personLaborCostByJobId.get(j.job_id) ?? 0
      const denominator = j.totalLaborOnJob
      const costRatio = denominator > 0 ? j.laborCost / denominator : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = denominator > 0 ? j.userTotalLaborOnJob / denominator : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * costRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }

    setReviewLaborJobs(laborJobs)
    setReviewCrewJobs(crewJobs)
    setReviewAllocatedRevenue(allocatedRevenue)
    setReviewAllocatedProfit(allocatedProfit)
    setReviewHours(hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })))
    setReviewReports(reports.map((r) => ({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at })))
    setReviewTasks(tasks)
    setReviewTasksOutstanding(outstandingTasks)
    const breakdownByJob: Record<string, ReviewLaborContributor[]> = {}
    for (const [jobId, perJob] of laborByJobAndPerson.entries()) {
      const rows: ReviewLaborContributor[] = []
      for (const [personName, agg] of perJob.entries()) {
        rows.push({
          personName,
          hours: agg.hours,
          laborCost: agg.subLaborCost + agg.crewLaborCost,
          subLaborCost: agg.subLaborCost,
          crewLaborCost: agg.crewLaborCost,
        })
      }
      rows.sort((a, b) => b.laborCost - a.laborCost || b.hours - a.hours || a.personName.localeCompare(b.personName))
      breakdownByJob[jobId] = rows
    }
    setReviewLaborByJobAndPerson(breakdownByJob)
    setReviewLoading(false)
  }

  useEffect(() => {
    if (activeTab !== 'review' || showPeopleForReview.length === 0) return
    // Default state for the new toggleable Team Summary: nothing selected.
    // The detail panel below the table only renders once the user clicks a
    // name in the iframe (handled in onMessage below).
    if (selectedReviewPersonIndex < 0) return
    // Clamp when the roster shrinks (member removed from pay config) so the
    // index can't dangle past the end. Selecting `-1` is the only way to
    // mean "no selection"; we never silently fall back to person 0 here.
    if (selectedReviewPersonIndex >= showPeopleForReview.length) {
      setSelectedReviewPersonIndex(-1)
      return
    }
    const personName = showPeopleForReview[selectedReviewPersonIndex]
    if (personName) void loadReviewData(personName, false, reviewOnlyPaidInFull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedReviewPersonIndex, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, showPeopleForReview, users])

  type HoursBreakdown = {
    source: 'salary' | 'hourly' | 'unknown'
    onlyPaidJobs: boolean
    dailyRows: Array<{
      date: string
      hours: number
      // jobName + address added so the iframe Hours modal can render crew
      // allocations as `(percent) Job # | Job Name - address` per day.
      // Empty strings render as no-op (jobName falls back to "\u2014",
      // address is omitted entirely when blank).
      crewAllocations: Array<{ hcp: string; jobName: string; address: string; pct: number; hours: number }>
    }>
    subLaborRows: Array<{ hcp: string; date: string; hours: number }>
    totals: {
      daily: number
      crew: number
      subLabor: number
      totalHours: number
    }
  }
  type GrossRevenueBreakdown = {
    jobs: Array<{
      jobId: string
      hcp: string
      jobName: string
      totalBill: number
      pctComplete: number
      pctCompleteSource: 'set' | 'assumed'
      valueCreated: number
      totalLaborOnJob: number
      costInPeriod: number
      ratio: number
      allocatedRevenue: number
    }>
    total: number
  }
  type NetRevenueBreakdown = {
    jobs: Array<{
      jobId: string
      hcp: string
      jobName: string
      valueCreated: number
      partsCost: number
      totalLaborOnJob: number
      revenueBeforeOverhead: number
      costInPeriod: number
      ratio: number
      allocatedNet: number
    }>
    total: number
  }
  type ProfitAfterOverheadBreakdown = {
    jobs: Array<{
      jobId: string
      hcp: string
      jobName: string
      allocatedNet: number
      hoursInPeriod: number
    }>
    totalNet: number
    totalHours: number
    fieldHours: number
    overheadHours: number
    unaccountedHours: number
  }
  /**
   * One pre-formatted session line for the Overhead-hours-breakdown modal.
   * Times are pre-formatted in the company TZ and bid metadata is already
   * resolved against `bidsById`, so the iframe just renders strings.
   */
  type OverheadSessionLine = {
    workDate: string
    bucket: 'office' | 'bid'
    /** e.g. "8:00 AM" in the company TZ. */
    startTime: string
    /** e.g. "5:00 PM" in the company TZ. */
    endTime: string
    /** Approved closed session hours, same value used for the bucket totals. */
    hours: number
    /** Bid display number with "B" prefix (e.g. "B201"). Empty for office. */
    bidHcp: string
    /** Bid project name. Empty for office. */
    bidName: string
    /** Bid address. Empty for office or when address blank. */
    bidAddress: string
  }
  type TeamSummaryRow = { personName: string; profit: number; gross: number; revPerHour: number; profitPerHour: number; totalHours: number; overheadHours: number; officeHours: number; bidHours: number; fieldHours: number; hourlyWage: number; overheadLaborCost: number; hoursBreakdown: HoursBreakdown; grossBreakdown: GrossRevenueBreakdown; netBreakdown: NetRevenueBreakdown; profitBreakdown: ProfitAfterOverheadBreakdown; overheadSessions: OverheadSessionLine[] }

  /**
   * Tier 3 — shared dataset fetched once for the whole team.
   * Replaces N × `loadReviewData()` round-trips with one set of queries that
   * covers every person in `showPeopleForReview`. Per-person numbers are then
   * derived from this union purely in JS by `derivePersonTeamSummary()`.
   */
  type TeamLedgerRow = { id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }
  type TeamLaborItem = { count: number; hrs_per_unit: number; is_fixed: boolean }
  type TeamPeriodLaborRow = { id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }
  type TeamReviewUnion = {
    periodLaborRows: TeamPeriodLaborRow[]
    periodCrewRows: Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    /**
     * Period bid crew rows, used **only** by the Hours-breakdown modal so it
     * can show days where someone clocked into a bid as `(pct) B{n} | Project`
     * instead of "No crew assignment". Revenue / profit math intentionally
     * stays job-only — bid hours are already counted in the overhead pool.
     */
    periodCrewBidRows: Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>
    periodHoursRows: Array<{ person_name: string; work_date: string; hours: number }>
    mileageCost: number
    timePerMile: number
    jobsById: Map<string, TeamLedgerRow>
    /** Bid id -> display fields, used by the Hours-breakdown modal only. */
    bidsById: Map<string, { bid_number: string; project_name: string; address: string }>
    jobIdByHcp: Map<string, string>
    laborItemsByJobId: Map<string, TeamLaborItem[]>
    laborCostByHcp: Map<string, number>
    teamLaborCostByJobId: Map<string, number>
    partsCostByJobId: Map<string, number>
    invoiceAmountByJob: Record<string, number>
    billedMaterialsByJobId: Map<string, number>
    hoursMap: Record<string, number>
    crewByDatePerson: Record<string, CrewJobRow>
    overheadHoursByPerson: Record<string, { office: number; bid: number }>
    /** `${personName}:${work_date}` -> approved office+bid clock hours that day. */
    overheadHoursByPersonByDate: Record<string, number>
    /**
     * Per-person, period-only approved office + bid clock sessions, used by
     * the Overhead-hours-breakdown modal to render Office / Bids sections
     * hierarchically (Day -> indented session lines). Bid `bid_id` is
     * resolved against `bidsById` at render time inside
     * `derivePersonTeamSummary`.
     */
    overheadSessionsByPerson: Record<string, Array<{
      sessionId: string
      workDate: string
      bucket: 'office' | 'bid'
      clockedInIso: string
      clockedOutIso: string
      hours: number
      bidId: string | null
    }>>
    officeJobLedgerId: string | null
  }

  async function loadTeamReviewUnion(
    start: string,
    end: string,
    onlyPaidJobs: boolean,
    payConfigSnapshot: Record<string, PayConfigRow>,
  ): Promise<TeamReviewUnion> {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const lookbackStart = twoYearsAgo.toLocaleDateString('en-CA')

    const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

    const overheadSessionsAllTimeFetchPromise = (async () => {
      let q = supabase
        .from('clock_sessions')
        .select(
          'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
        )
        .gte('work_date', lookbackStart)
      if (officeJobLedgerId) {
        q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
      } else {
        q = q.not('bid_id', 'is', null)
      }
      const res = await q
      return (res.data ?? []) as unknown as OverheadClockSessionRow[]
    })()

    const [
      periodLaborRes,
      allTimeLaborRes,
      periodCrewRes,
      allTimeCrewRes,
      periodCrewBidsRes,
      periodHoursRes,
      allTimeHoursRes,
      settingsRes,
      tallyRes,
      overheadSessionsAllTime,
    ] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart),
      // Period-only bid crew rows -- modal display only, no all-time fetch needed.
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      overheadSessionsAllTimeFetchPromise,
    ])

    // Derive the period buckets (for per-person totals shown in the Team
    // Summary) and the period per-day map (for `derivePersonTeamSummary`'s
    // overhead callouts). The lifetime crew labor cost denominator no longer
    // needs an all-time per-day overhead map under Option E — pct is share of
    // the total day so the multiplicand is `dayHoursRaw`, not `dayHoursRaw -
    // overheadOnDay`. One fetch, period-only views.
    const overheadHoursByPerson: Record<string, { office: number; bid: number }> = {}
    const overheadHoursByPersonByDate: Record<string, number> = {}
    const overheadSessionsByPerson: TeamReviewUnion['overheadSessionsByPerson'] = {}
    for (const s of overheadSessionsAllTime) {
      if (s.rejected_at || s.revoked_at) continue
      if (s.approved_at == null) continue
      const bucket = overheadBucketForSession(officeJobLedgerId, s.job_ledger_id, s.bid_id)
      if (bucket == null) continue
      const hrs = approvedClosedSessionHours(s)
      if (hrs == null || hrs <= 0) continue
      const name = (s.users?.name ?? '').trim()
      if (!name) continue
      const dateKey = `${name}:${s.work_date}`
      if (s.work_date >= start && s.work_date <= end) {
        const cur = overheadHoursByPerson[name] ?? { office: 0, bid: 0 }
        if (bucket === 'office') cur.office += hrs
        else cur.bid += hrs
        overheadHoursByPerson[name] = cur
        overheadHoursByPersonByDate[dateKey] = (overheadHoursByPersonByDate[dateKey] ?? 0) + hrs
        // Skip open sessions for the modal (no clock_out_iso to render); they
        // already contributed null hours and were filtered above.
        if (s.clocked_out_at) {
          const list = overheadSessionsByPerson[name] ?? []
          list.push({
            sessionId: s.id,
            workDate: s.work_date,
            bucket,
            clockedInIso: s.clocked_in_at,
            clockedOutIso: s.clocked_out_at,
            hours: hrs,
            bidId: s.bid_id ?? null,
          })
          overheadSessionsByPerson[name] = list
        }
      }
    }

    const periodLaborRows = (periodLaborRes.data ?? []) as TeamPeriodLaborRow[]
    const allTimeLaborRows = (allTimeLaborRes.data ?? []) as TeamPeriodLaborRow[]
    const periodCrewRows = (periodCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allTimeCrewRows = (allTimeCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const periodCrewBidRowsRaw = (periodCrewBidsRes.data ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] | null }>
    const periodCrewBidRows = periodCrewBidRowsRaw.map((r) => ({
      work_date: r.work_date,
      person_name: r.person_name,
      bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
    }))
    const periodHoursRows = (periodHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const allTimeHoursRows = (allTimeHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const hoursMap: Record<string, number> = {}
    for (const h of periodHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }
    const hoursMapAllTime: Record<string, number> = {}
    for (const h of allTimeHoursRows) {
      hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
    }

    // Items for all-time labor jobs (for laborCostByHcp lifetime calc).
    const allTimeLaborJobIds = allTimeLaborRows.map((r) => r.id)
    const laborItemsRes = allTimeLaborJobIds.length > 0
      ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allTimeLaborJobIds)
      : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const laborItemsByJobId = new Map<string, TeamLaborItem[]>()
    for (const i of laborItems) {
      const list = laborItemsByJobId.get(i.job_id) ?? []
      list.push({ count: i.count, hrs_per_unit: i.hrs_per_unit, is_fixed: i.is_fixed })
      laborItemsByJobId.set(i.job_id, list)
    }

    // Lifetime sub-labor cost per HCP (all assignees).
    const laborCostByHcp = new Map<string, number>()
    for (const r of allTimeLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = laborItemsByJobId.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of periodCrewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
    for (const r of allTimeCrewRows) {
      crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }

    // Lifetime crew labor cost per job (all crew members).
    // Convention 1 — crew pct is share of the total day (matches the
    // `sync_crew_jobs_from_clock` trigger denominator and `teamLabor.ts` /
    // `payReportAssignmentsBreakdown.ts`). Multiply by `dayHoursRaw` so this
    // lifetime denominator stays on the same convention as the period
    // numerator in `derivePersonTeamSummary` and as the cost figures shown
    // on pay stubs / Person Review.
    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allTimeCrewRows) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfigSnapshot[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const dayHoursRaw = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = dayHoursRaw * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    // Union of HCPs / jobIds across the whole team for the period.
    const unionLaborHcps = [...new Set(periodLaborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const unionCrewJobIds = new Set<string>()
    for (const r of periodCrewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      for (const a of assignments) {
        unionCrewJobIds.add(a.job_id)
      }
    }

    const allJobIds = [...unionCrewJobIds]
    // Collect bid IDs across the period crew bid rows so we can resolve display
    // metadata (bid_number, project_name) for the Hours-breakdown modal.
    const unionCrewBidIds = new Set<string>()
    for (const r of periodCrewBidRows) {
      for (const a of r.bid_assignments) {
        if (a.bid_id) unionCrewBidIds.add(a.bid_id)
      }
    }
    const allBidIds = [...unionCrewBidIds]
    const [crewJobsRes, laborJobsRes, crewBidsRes] = await Promise.all([
      allJobIds.length > 0
        ? onlyPaidJobs
          ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
          : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
        : { data: [] },
      unionLaborHcps.length > 0
        ? onlyPaidJobs
          ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: unionLaborHcps })
          : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: unionLaborHcps })
        : { data: [] },
      allBidIds.length > 0
        ? supabase.rpc('get_bids_by_ids', { p_bid_ids: allBidIds })
        : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as TeamLedgerRow[]
    const laborJobsLedger = (laborJobsRes.data ?? []) as TeamLedgerRow[]
    const jobsById = new Map<string, TeamLedgerRow>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    const bidRows = (crewBidsRes.data ?? []) as Array<{ id: string; bid_number: string | null; project_name: string | null; address: string | null }>
    const bidsById = new Map<string, { bid_number: string; project_name: string; address: string }>()
    for (const b of bidRows) {
      bidsById.set(b.id, {
        bid_number: (b.bid_number ?? '').trim(),
        project_name: (b.project_name ?? '').trim(),
        address: (b.address ?? '').trim(),
      })
    }

    const jobIds = Array.from(jobsById.keys())
    const [invoiceRes, materialsRes] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      jobIds.length > 0 ? supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }

    return {
      periodLaborRows,
      periodCrewRows,
      periodCrewBidRows,
      periodHoursRows,
      mileageCost,
      timePerMile,
      jobsById,
      bidsById,
      jobIdByHcp,
      laborItemsByJobId,
      laborCostByHcp,
      teamLaborCostByJobId,
      partsCostByJobId,
      invoiceAmountByJob,
      billedMaterialsByJobId,
      hoursMap,
      crewByDatePerson,
      overheadHoursByPerson,
      overheadHoursByPersonByDate,
      overheadSessionsByPerson,
      officeJobLedgerId,
    }
  }

  /**
   * Pure per-person derivation. Mirrors the allocation math at the bottom of
   * `loadReviewData` (allocationJobsMap × costOnJobInPeriod, cost-based ratio).
   */
  function derivePersonTeamSummary(
    union: TeamReviewUnion,
    personName: string,
    payConfigSnapshot: Record<string, PayConfigRow>,
    onlyPaidJobs: boolean,
    days: string[],
  ): TeamSummaryRow {
    const cfg = payConfigSnapshot[personName]
    const officeJobIdForFilter = union.officeJobLedgerId

    const personPeriodLaborRows = union.periodLaborRows
      .filter((r) => r.assigned_to_name === personName)
      .filter((r) => {
        // Exclude sub-labor rows pointing at the configured office job — it's
        // overhead, not a field-revenue job. Without this filter the office
        // job appears in "Where the field hrs went" and gets a (typically
        // negative) revenue allocation.
        if (!officeJobIdForFilter) return true
        const hcp = (r.job_number ?? '').trim().toLowerCase()
        if (!hcp) return true
        return union.jobIdByHcp.get(hcp) !== officeJobIdForFilter
      })
    const laborRowsFiltered = onlyPaidJobs
      ? personPeriodLaborRows.filter((r) => {
          const hcp = (r.job_number ?? '').trim().toLowerCase()
          return hcp && union.jobIdByHcp.has(hcp)
        })
      : personPeriodLaborRows

    const laborJobs = laborRowsFiltered.map((r) => {
      const items = union.laborItemsByJobId.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * union.mileageCost + miles * union.timePerMile * rate : miles > 0 ? miles * union.mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? union.jobIdByHcp.get(hcp) ?? null : null
      return { jobId, hours: totalHrs, laborCost }
    })

    const crewJobIds = new Set<string>()
    const crewJobsWithLead: Array<{ work_date: string; job_id: string; pct: number }> = []
    for (const r of union.periodCrewRows) {
      if (r.person_name !== personName) continue
      const row = union.crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      for (const a of assignments) {
        // Skip the configured office job — its time is overhead and is
        // already accounted for via clock sessions, not crew revenue.
        if (officeJobIdForFilter && a.job_id === officeJobIdForFilter) continue
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
      }
    }
    const crewJobsWithLeadFiltered = onlyPaidJobs
      ? crewJobsWithLead.filter((c) => union.jobsById.has(c.job_id))
      : crewJobsWithLead

    const crewJobs = crewJobsWithLeadFiltered.map((c) => {
      const day = new Date(c.work_date + 'T12:00:00').getDay()
      const dayHoursRaw = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (union.hoursMap[`${personName}:${c.work_date}`] ?? 0)
      // Convention 1 — pct is share of the total day; multiply by dayHoursRaw
      // so the period numerator stays on the same convention as the lifetime
      // denominator in `loadTeamReviewUnion.teamLaborCostByJobId`.
      const hours = dayHoursRaw * (c.pct / 100)
      const laborCost = hours * (cfg?.hourly_wage ?? 0)
      return { jobId: c.job_id, hours, laborCost }
    })

    const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number; totalLaborOnJob: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRowsFiltered) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? union.jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = union.jobsById.get(jobId)
      const subLaborCost = hcp ? (union.laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = union.teamLaborCostByJobId.get(jobId) ?? 0
      const totalLaborOnJob = subLaborCost + teamLaborCost
      const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }
    for (const jobId of crewJobIds) {
      if (allocationJobsMap.has(jobId)) continue
      const j = union.jobsById.get(jobId)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const subLaborCost = hcp ? (union.laborCostByHcp.get(hcp) ?? 0) : 0
      const totalLaborOnJob = subLaborCost + (union.teamLaborCostByJobId.get(jobId) ?? 0)
      const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }

    const costOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.jobId) costOnJobInPeriod.set(j.jobId, (costOnJobInPeriod.get(j.jobId) ?? 0) + j.laborCost)
    }
    for (const j of crewJobs) {
      costOnJobInPeriod.set(j.jobId, (costOnJobInPeriod.get(j.jobId) ?? 0) + j.laborCost)
    }

    let allocatedRevenue = 0
    let allocatedProfit = 0
    const grossBreakdownJobs: GrossRevenueBreakdown['jobs'] = []
    const netBreakdownJobs: NetRevenueBreakdown['jobs'] = []
    for (const [jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob }] of allocationJobsMap) {
      const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
      const ratio = totalLaborOnJob > 0 ? costInPeriod / totalLaborOnJob : (costInPeriod > 0 ? 1 : 0)
      const jobAllocated = valueCreated * ratio
      const jobAllocatedNet = revenueBeforeOverhead * ratio
      allocatedRevenue += jobAllocated
      allocatedProfit += jobAllocatedNet

      const job = union.jobsById.get(jobId)
      const hcp = (job?.hcp_number ?? '').trim().toUpperCase() || 'Unknown'
      const jobName = job?.job_name ?? ''
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctRaw = job?.pct_complete
      const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
      grossBreakdownJobs.push({
        jobId,
        hcp,
        jobName,
        totalBill,
        pctComplete: pctRaw ?? 100,
        pctCompleteSource: pctRaw == null ? 'assumed' : 'set',
        valueCreated,
        totalLaborOnJob,
        costInPeriod,
        ratio,
        allocatedRevenue: jobAllocated,
      })
      netBreakdownJobs.push({
        jobId,
        hcp,
        jobName,
        valueCreated,
        partsCost,
        totalLaborOnJob,
        revenueBeforeOverhead,
        costInPeriod,
        ratio,
        allocatedNet: jobAllocatedNet,
      })
    }
    grossBreakdownJobs.sort((a, b) => b.allocatedRevenue - a.allocatedRevenue)
    netBreakdownJobs.sort((a, b) => b.allocatedNet - a.allocatedNet)
    const grossBreakdown: GrossRevenueBreakdown = { jobs: grossBreakdownJobs, total: allocatedRevenue }
    const netBreakdown: NetRevenueBreakdown = { jobs: netBreakdownJobs, total: allocatedProfit }

    const hoursOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.jobId) hoursOnJobInPeriod.set(j.jobId, (hoursOnJobInPeriod.get(j.jobId) ?? 0) + j.hours)
    }
    for (const j of crewJobs) {
      hoursOnJobInPeriod.set(j.jobId, (hoursOnJobInPeriod.get(j.jobId) ?? 0) + j.hours)
    }

    const personHoursRows = union.periodHoursRows.filter((r) => r.person_name === personName)
    const getHoursForDay = (d: string) => {
      if (!cfg) return 0
      const dayOfWeek = new Date(d + 'T12:00:00').getDay()
      return cfg.is_salary
        ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
        : (personHoursRows.find((h) => h.work_date === d)?.hours ?? 0)
    }
    const totalHoursPaidJobs = laborJobs.reduce((s, j) => s + j.hours, 0) + crewJobs.reduce((s, j) => s + j.hours, 0)
    const totalHours = onlyPaidJobs
      ? totalHoursPaidJobs
      : days.reduce((s, d) => s + getHoursForDay(d), 0)

    const overheadBuckets = union.overheadHoursByPerson[personName] ?? { office: 0, bid: 0 }
    const officeHours = overheadBuckets.office
    const bidHours = overheadBuckets.bid
    const overheadHours = officeHours + bidHours
    const fieldHours = onlyPaidJobs
      ? totalHours
      : Math.max(0, totalHours - overheadHours)
    const profitBreakdownJobs: ProfitAfterOverheadBreakdown['jobs'] = netBreakdownJobs.map((j) => ({
      jobId: j.jobId,
      hcp: j.hcp,
      jobName: j.jobName,
      allocatedNet: j.allocatedNet,
      hoursInPeriod: hoursOnJobInPeriod.get(j.jobId) ?? 0,
    }))
    const allocatedHoursTotal = profitBreakdownJobs.reduce((s, j) => s + j.hoursInPeriod, 0)
    const profitBreakdown: ProfitAfterOverheadBreakdown = {
      jobs: profitBreakdownJobs,
      totalNet: allocatedProfit,
      totalHours,
      fieldHours,
      overheadHours,
      unaccountedHours: Math.max(0, fieldHours - allocatedHoursTotal),
    }

    // Modal-display only -- includes the configured Office job AND bid
    // assignments so people who clocked into Office or a bid are visible in
    // the Hours-breakdown drilldown (otherwise the day shows "No crew
    // assignment"). Revenue / profit math uses `crewJobsWithLeadFiltered`,
    // which still excludes Office and bids on purpose.
    const crewByDateForPerson = new Map<string, Array<{ hcp: string; jobName: string; address: string; pct: number; hours: number }>>()
    const dayHoursForPerson = (workDate: string) => {
      const dayOfWeek = new Date(workDate + 'T12:00:00').getDay()
      return cfg?.is_salary
        ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
        : (union.hoursMap[`${personName}:${workDate}`] ?? 0)
    }
    for (const r of union.periodCrewRows) {
      if (r.person_name !== personName) continue
      const dayHoursRaw = dayHoursForPerson(r.work_date)
      for (const a of r.job_assignments) {
        const j = union.jobsById.get(a.job_id)
        const hcp = (j?.hcp_number ?? '').trim().toUpperCase() || 'Unknown'
        const jobName = (j?.job_name ?? '').trim()
        const address = (j?.job_address ?? '').trim()
        // Convention 1 -- pct is share of the total day; hours = day * pct/100.
        const hours = dayHoursRaw * (a.pct / 100)
        const list = crewByDateForPerson.get(r.work_date) ?? []
        list.push({ hcp, jobName, address, pct: a.pct, hours })
        crewByDateForPerson.set(r.work_date, list)
      }
    }
    for (const r of union.periodCrewBidRows) {
      if (r.person_name !== personName) continue
      const dayHoursRaw = dayHoursForPerson(r.work_date)
      for (const a of r.bid_assignments) {
        const meta = union.bidsById.get(a.bid_id)
        // Bid number prefixed with "B" so the modal's allocation column reads
        // "(pct) B249 | Project Name" and clearly distinguishes from a job.
        // Falls back to "B?" when bid metadata is missing (rare; the row was
        // synced but `get_bids_by_ids` filtered the bid out).
        const rawBidNumber = (meta?.bid_number ?? '').trim()
        const hcp = rawBidNumber
          ? (rawBidNumber.toUpperCase().startsWith('B') ? rawBidNumber.toUpperCase() : 'B' + rawBidNumber)
          : 'B?'
        const jobName = (meta?.project_name ?? '').trim()
        const address = (meta?.address ?? '').trim()
        const hours = dayHoursRaw * (a.pct / 100)
        const list = crewByDateForPerson.get(r.work_date) ?? []
        list.push({ hcp, jobName, address, pct: a.pct, hours })
        crewByDateForPerson.set(r.work_date, list)
      }
    }
    const dailyRowsBreakdown: HoursBreakdown['dailyRows'] = []
    for (const d of days) {
      const h = getHoursForDay(d)
      const allocs = crewByDateForPerson.get(d) ?? []
      if (h > 0 || allocs.length > 0) {
        dailyRowsBreakdown.push({ date: d, hours: h, crewAllocations: allocs })
      }
    }
    const subLaborRowsBreakdown: HoursBreakdown['subLaborRows'] = []
    for (const r of laborRowsFiltered) {
      const items = union.laborItemsByJobId.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const hcp = (r.job_number ?? '').trim().toUpperCase() || 'Unknown'
      if (totalHrs > 0) {
        subLaborRowsBreakdown.push({ hcp, date: r.job_date ?? '', hours: totalHrs })
      }
    }
    const dailyTotal = dailyRowsBreakdown.reduce((s, r) => s + r.hours, 0)
    const crewTotal = crewJobs.reduce((s, j) => s + j.hours, 0)
    const subLaborTotal = subLaborRowsBreakdown.reduce((s, r) => s + r.hours, 0)
    const hoursBreakdown: HoursBreakdown = {
      source: !cfg ? 'unknown' : (cfg.is_salary ? 'salary' : 'hourly'),
      onlyPaidJobs,
      dailyRows: dailyRowsBreakdown,
      subLaborRows: subLaborRowsBreakdown,
      totals: { daily: dailyTotal, crew: crewTotal, subLabor: subLaborTotal, totalHours },
    }

    const hourlyWage = cfg?.hourly_wage ?? 0
    // Overhead labor only — Office + Bid hours × wage. Field labor is
    // already subtracted at the per-job level inside Net Revenue
    // (`job_net = revenue - parts - total_labor`), so re-listing it here
    // would visually double-count. Stored negative so the column reads
    // as a cost (red `negStyle`, `-$X` via `fmtMoney`) and flows naturally
    // into the footer total + per-bucket drilldown rows.
    const overheadLaborCost = -(overheadHours * hourlyWage)

    // Build the per-session display list for the Overhead-hours-breakdown
    // modal. Times are formatted in the company TZ; bid metadata is
    // resolved against `union.bidsById` so the iframe only renders strings.
    const overheadTimeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const overheadRawSessions = union.overheadSessionsByPerson[personName] ?? []
    const overheadSessions: OverheadSessionLine[] = overheadRawSessions
      .map((s) => {
        const inDate = new Date(s.clockedInIso)
        const outDate = new Date(s.clockedOutIso)
        const startTime = Number.isNaN(inDate.getTime())
          ? ''
          : overheadTimeFormatter.format(inDate)
        const endTime = Number.isNaN(outDate.getTime())
          ? ''
          : overheadTimeFormatter.format(outDate)
        let bidHcp = ''
        let bidName = ''
        let bidAddress = ''
        if (s.bucket === 'bid' && s.bidId) {
          const meta = union.bidsById.get(s.bidId)
          const rawBidNumber = (meta?.bid_number ?? '').trim()
          bidHcp = rawBidNumber
            ? rawBidNumber.toUpperCase().startsWith('B')
              ? rawBidNumber.toUpperCase()
              : 'B' + rawBidNumber
            : 'B?'
          bidName = (meta?.project_name ?? '').trim()
          bidAddress = (meta?.address ?? '').trim()
        }
        return {
          workDate: s.workDate,
          bucket: s.bucket,
          startTime,
          endTime,
          hours: s.hours,
          bidHcp,
          bidName,
          bidAddress,
        }
      })
      .sort((a, b) => {
        const byDate = a.workDate.localeCompare(b.workDate)
        if (byDate !== 0) return byDate
        return a.startTime.localeCompare(b.startTime)
      })
    return {
      personName,
      profit: allocatedProfit,
      gross: allocatedRevenue,
      revPerHour: totalHours > 0 ? allocatedRevenue / totalHours : 0,
      profitPerHour: totalHours > 0 ? allocatedProfit / totalHours : 0,
      totalHours,
      overheadHours,
      officeHours,
      bidHours,
      fieldHours,
      hourlyWage,
      overheadLaborCost,
      hoursBreakdown,
      grossBreakdown,
      netBreakdown,
      profitBreakdown,
      overheadSessions,
    }
  }

  async function loadTeamSummaryData(): Promise<TeamSummaryRow[]> {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const union = await loadTeamReviewUnion(start, end, reviewOnlyPaidInFull, payConfig)
    return showPeopleForReview.map((personName) =>
      derivePersonTeamSummary(union, personName, payConfig, reviewOnlyPaidInFull, days)
    )
  }

  // Snapshot of the inputs that determine `loadTeamSummaryData`'s output,
  // joined into a single string so the popup path can compare cheaply. We
  // sort the roster + payConfig keys so member order can't drift the key.
  function buildTeamSummaryCacheKey(): string {
    const [start, end] = getReviewDateRange()
    const roster = [...showPeopleForReview].sort().join(',')
    // payConfig sig: name → salary flag + wage. Catches wage-only edits that
    // wouldn't otherwise change `showPeopleForReview` membership.
    const pc = Object.keys(payConfig)
      .sort()
      .map((n) => {
        const cfg = payConfig[n]
        if (!cfg) return `${n}:?`
        return `${n}:${cfg.is_salary ? 's' : 'h'}${cfg.hourly_wage ?? ''}`
      })
      .join('|')
    return [start, end, reviewOnlyPaidInFull ? '1' : '0', roster, pc].join('::')
  }

  function getReviewPeriodLabel(): string {
    const [start, end] = getReviewDateRange()
    const labels: Record<ReviewPeriod, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      this_week: 'This week (running)',
      last_week: 'Last week',
      last_two_weeks: 'Last two weeks',
      last_30_days: 'Last 30 days',
      last_90_days: 'Last 90 days',
      this_year: 'This year',
      custom: 'Custom range',
    }
    return `${labels[reviewPeriod]} (${start} – ${end})`
  }

  function openTeamSummaryWindow(target: 'popup' | 'inline' = 'popup') {
    const isEmbedded = target === 'inline'
    if (showPeopleForReview.length === 0) {
      if (isEmbedded) {
        teamSummaryReqIdRef.current += 1
        setTeamSummaryRows(null)
        setTeamSummaryError(null)
        setTeamSummaryLoading(false)
      } else {
        showToast('No people in pay config. Add people in People pay config (Hours tab) first.', 'warning')
      }
      return
    }
    let win: Window | null = null
    let reqId = 0
    // v2.542 cache hit (popup only): if the inline iframe already rendered
    // for the exact same inputs, reuse those rows instead of issuing a fresh
    // `loadTeamSummaryData()`. Embedded refreshes always re-fetch since the
    // inline path *is* the cache source.
    const currentCacheKey = buildTeamSummaryCacheKey()
    const cached = teamSummaryDataCacheRef.current
    const canReuseCache = !isEmbedded && cached != null && cached.cacheKey === currentCacheKey
    if (isEmbedded) {
      reqId = ++teamSummaryReqIdRef.current
      setTeamSummaryLoading(true)
      setTeamSummaryError(null)
    } else {
      win = window.open('', '_blank')
      if (!win) {
        showToast('Popup blocked. Allow popups to open Team Summary.', 'warning')
        return
      }
      const loadingHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title></head><body style="font-family:sans-serif;margin:1in;"><p>Loading Team Summary…</p></body></html>'
      win.document.write(loadingHtml)
      win.document.close()
      win.focus()
      // Skip the "Loading…" toast when we have a cache hit — the popup will
      // resolve synchronously on the next tick and the toast just looks stale.
      if (!canReuseCache) {
        showToast('Loading Team Summary…', 'info')
      }
    }
    const overheadRate = reviewOverheadRates.ratePerHour
    const overheadRateLoading = reviewOverheadRates.loading
    const overheadDecomp = {
      ratePerHour: reviewOverheadRates.ratePerHour,
      ratePerRevenueDecimal: reviewOverheadRates.ratePerRevenueDecimal,
      ratePerLaborDollar: reviewOverheadRates.ratePerLaborDollar,
      windowStart: reviewOverheadRates.windowStart,
      windowEnd: reviewOverheadRates.windowEnd,
      officeLabor90d: reviewOverheadRates.officeLabor90d,
      bidLabor90d: reviewOverheadRates.bidLabor90d,
      officeParts90d: reviewOverheadRates.officeParts90d,
      invoices90d: reviewOverheadRates.invoices90d,
      fieldHours90d: reviewOverheadRates.fieldHours90d,
      fieldLaborUsd90d: reviewOverheadRates.fieldLaborUsd90d,
    }
    const dataPromise = canReuseCache && cached
      ? Promise.resolve(cached.rows)
      : loadTeamSummaryData()
    dataPromise
      .then((rows) => {
        if (isEmbedded && reqId !== teamSummaryReqIdRef.current) return
        // Populate the cache only on the inline path — that's the surface
        // a popup-click would later read from. Stamp it with the cache key
        // we computed *before* the load so a dep-driven cache invalidation
        // mid-load still results in `cached.cacheKey !== buildTeamSummaryCacheKey()`
        // on the next popup click.
        if (isEmbedded) {
          teamSummaryDataCacheRef.current = { rows, cacheKey: currentCacheKey }
          // The inline path renders via `<TeamSummaryInline>` reading from
          // `teamSummaryRows` — no HTML string to build, no iframe to seed.
          // The React component does its own sort/filter/click-cell work.
          setTeamSummaryRows(rows)
          setTeamSummaryLoading(false)
          // Re-open the Hours drilldown if the user just saved a day from
          // it (set by the `hoursMyTimeEditor.onSaved` flow). Defer one
          // microtask so the rows commit + the component re-renders
          // before we ask it to mount the drilldown.
          const pn = reviewHoursReopenAfterLoadRef.current
          if (pn) {
            reviewHoursReopenAfterLoadRef.current = null
            window.setTimeout(() => {
              try {
                teamSummaryInlineRef.current?.openDrilldown(pn, 'hours')
              } catch {
                /* component unmounted before re-open landed — ignore */
              }
            }, 50)
          }
          return
        }
        try {
          // Number/HTML formatting now lives inside the iframe IIFE; the
          // parent only escapes the period label below. See iframe `renderTable()`.
          const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          type DisplayRow = TeamSummaryRow & {
            profitAfterOverhead: number | null
            profitPerHourAfterOverhead: number | null
          }
          const enriched: DisplayRow[] = rows.map((r) => {
            // Charge overhead on ALL hours (field + office + bid) so the
            // popup's Team Summary column matches the inline path
            // (formatters.ts) and the Profit (after overhead) breakdown
            // modal's bottom-line total. See enrichTeamSummaryRowsForInline.
            const profitAfterOverhead = overheadRate != null ? r.profit - r.totalHours * overheadRate : null
            const profitPerHourAfterOverhead =
              profitAfterOverhead != null && r.totalHours > 0 ? profitAfterOverhead / r.totalHours : null
            return { ...r, profitAfterOverhead, profitPerHourAfterOverhead }
          })
          const sortedRows = [...enriched].sort((a, b) => b.profit - a.profit || a.personName.localeCompare(b.personName))

          // Cell builders, footer totals, and the row/footer HTML are now
          // built inside the iframe IIFE so client-side search + sort can
          // re-render without a parent round-trip. See `renderTable()` in
          // the iframe script below.

          const overheadMetaText = overheadRateLoading
            ? 'Overhead Method A: loading…'
            : overheadRate == null
              ? 'Overhead Method A: unavailable'
              : `Overhead Method A: $${overheadRate.toFixed(2)} per field hour (rolling 90-day rate)`
          const overheadMetaClickable = !overheadRateLoading && overheadRate != null
          const overheadMetaHtml = overheadMetaClickable
            ? `<button type="button" id="overhead-meta-btn" class="meta-sub-btn" title="Click for rate decomposition">${escapeHtml(overheadMetaText)} <span aria-hidden="true">&#9432;</span></button>`
            : escapeHtml(overheadMetaText)

          // Single payload that drives both the table render (sortable + filterable)
          // and the per-cell drilldown modals. `idx` is stable across sort/filter so
          // `breakdowns[idx]` lookups in the modal click router stay valid.
          const breakdownsPayload = sortedRows.map((r, i) => {
            const cfg = payConfig[r.personName]
            const payConfigSource = !cfg ? 'unknown' : (cfg.is_salary ? 'salary' : 'hourly')
            return {
              idx: i,
              name: r.personName,
              hb: r.hoursBreakdown,
              gb: r.grossBreakdown,
              nb: r.netBreakdown,
              pb: r.profitBreakdown,
              totalHours: r.totalHours,
              overheadHours: r.overheadHours,
              officeHours: r.officeHours,
              bidHours: r.bidHours,
              fieldHours: r.fieldHours,
              hourlyWage: r.hourlyWage,
              overheadLaborCost: r.overheadLaborCost,
              overheadSessions: r.overheadSessions,
              gross: r.gross,
              net: r.profit,
              profitAfterOverhead: r.profitAfterOverhead,
              revPerHour: r.revPerHour,
              netPerHour: r.profitPerHour,
              profitPerHourAfterOverhead: r.profitPerHourAfterOverhead,
              payConfigSource,
            }
          })
          const breakdownsJson = JSON.stringify(breakdownsPayload).replace(/</g, '\\u003c')
          const overheadRateJson = overheadRate == null ? 'null' : String(overheadRate)
          const overheadDecompJson = JSON.stringify(overheadDecomp).replace(/</g, '\\u003c')
          // Embedded only: the currently-expanded person name (or null) so the
          // iframe paints the highlighted row on first render without a
          // postMessage round-trip. The popup window has no per-person
          // detail panel so we always send null there.
          const initialSelectedPersonName =
            isEmbedded && selectedReviewPersonIndex >= 0
              ? showPeopleForReview[selectedReviewPersonIndex] ?? null
              : null
          const selectedPersonNameJson = JSON.stringify(initialSelectedPersonName).replace(/</g, '\\u003c')

          const embeddedResizeScript = isEmbedded
            ? `<script>(function(){
              if (window.parent === window) return;
              var lastH = 0;
              function postH(h){ var r = Math.ceil(h); if (r === lastH) return; lastH = r; try { parent.postMessage({ type: 'team-summary-resize', height: r }, '*'); } catch(e) {} }
              function reportHeight(){
                var modal = document.getElementById('modal');
                var open = modal && modal.classList.contains('open');
                var bodyH = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
                if (open) { postH(Math.max(bodyH, modal.offsetHeight + 100)); } else { postH(bodyH); }
              }
              reportHeight();
              if (typeof ResizeObserver === 'function') { try { new ResizeObserver(reportHeight).observe(document.body); } catch(e) {} }
              window.addEventListener('load', reportHeight);
              setTimeout(reportHeight, 100); setTimeout(reportHeight, 500);
              var m = document.getElementById('modal');
              if (m && typeof MutationObserver === 'function') { try { new MutationObserver(reportHeight).observe(m, { attributes: true, attributeFilter: ['class'] }); } catch(e) {} }
            })();</script>`
            : ''
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title><style>
      html, body { background: transparent; }
      body { font-family: sans-serif; margin: ${isEmbedded ? '0' : '1in'}; }
      h1 { margin-bottom: 0.25rem;${isEmbedded ? ' display: none;' : ''} }
      .meta { color: #6b7280; margin-bottom: 0.25rem;${isEmbedded ? ' font-size: 0.85rem;' : ''} }
      .meta-sub { color: #6b7280; margin-bottom: 0.75rem;${isEmbedded ? ' font-size: 0.85rem;' : ' font-size: 0.9rem;'} }
      .meta-sub-btn { background: none; border: 0; padding: 0; color: #2563eb; cursor: pointer; font: inherit; text-decoration: underline dotted; text-underline-offset: 2px; }
      .meta-sub-btn:hover { color: #1d4ed8; }
      .tools { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
      .tools input[type="search"] { padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font: inherit; min-width: 220px; }
      .tools input[type="search"]:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
      .tools .reset-sort-btn { padding: 0.3rem 0.6rem; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
      .tools .reset-sort-btn:hover { background: #f9fafb; }
      .tools .reset-sort-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .tools .filter-status { color: #6b7280; font-size: 0.85rem; }
      table { width: auto; border-collapse: collapse; table-layout: auto; }
      th, td { border: 1px solid #e5e7eb; white-space: nowrap; }
      th { padding: 0.5rem 0.75rem; text-align: left; background: #f9fafb; font-weight: 600; vertical-align: bottom; position: relative; }
      th.num { text-align: center; }
      th[data-sort] { cursor: pointer; user-select: none; }
      th[data-sort]:hover { background: #f3f4f6; }
      th[data-sort]:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      th .sort-indicator { display: inline-block; width: 0.7em; margin-left: 0.25em; color: #9ca3af; font-size: 0.75em; vertical-align: middle; }
      th[aria-sort="ascending"] .sort-indicator,
      th[aria-sort="descending"] .sort-indicator { color: #1f2937; }
      tfoot td { border-top: 2px solid #d1d5db; }
      tbody.empty-state td { padding: 1rem 0.75rem; text-align: center; color: #6b7280; font-style: italic; background: #fafafa; }
      .click-cell:hover { background: #eff6ff; }
      .click-cell:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      /* Toggleable name cell — picks the person to expand below the table
         (the iframe posts team-summary-select-person and the parent React
         app mounts the per-person panel). Whole row tints when selected so
         the eye sees the active person instantly even on wide tables. */
      .person-name-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: none;
        border: 0;
        padding: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
        text-align: left;
      }
      .person-name-btn .chevron { color: #6b7280; font-size: 0.8em; width: 0.7em; display: inline-block; }
      .person-name-btn:hover .person-name-text { color: #2563eb; }
      .person-name-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; border-radius: 2px; }
      tbody tr.selected-person td { background: #dbeafe; }
      tbody tr.selected-person .person-name-btn .person-name-text { font-weight: 700; color: #1e3a8a; }
      tbody tr.selected-person .person-name-btn .chevron { color: #1e3a8a; }
      .footer-caption { color: #6b7280; font-size: 0.8rem; margin-top: 0.5rem; }
      .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 9; }
      .modal-backdrop.open { display: block; }
      .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 1rem 1.5rem 1.5rem; max-width: 90vw; max-height: 85vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.25); display: none; z-index: 10; min-width: 400px; }
      .modal.open { display: block; }
      .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; }
      .modal-header h2 { margin: 0; font-size: 1.1rem; }
      .modal-header-actions { display: flex; align-items: center; gap: 0.5rem; }
      .modal-print { background: #fff; border: 1px solid #d1d5db; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; color: #374151; line-height: 1.2; }
      .modal-print:hover { background: #f9fafb; }
      .modal-print:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal-close { background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 4px; }
      .modal-close:hover { background: #f3f4f6; color: #111827; }
      .modal-close:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal h3 { margin-top: 1.25rem; margin-bottom: 0.5rem; font-size: 0.95rem; color: #374151; }
      .modal table { width: 100%; }
      .modal th, .modal td { padding: 0.35rem 0.6rem; white-space: normal; }
      .modal td.num, .modal th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .modal .caption { color: #6b7280; font-size: 0.85rem; margin-top: 1rem; }
      /* Hours breakdown — hierarchical Day -> (pct) Job # | Job Name layout (v2.543). */
      .modal .hours-day-list { display: block; }
      .modal .hours-day-section { padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; }
      .modal .hours-day-section:last-child { border-bottom: none; }
      .modal .hours-day-header { color: #1f2937; font-weight: 600; font-size: 0.92rem; }
      /* Match the date's typography exactly so "6.8 hrs" reads the same as
         "Mon 2026-05-04"; only nudge for spacing. */
      .modal .hours-day-header .day-hours { margin-left: 0.5rem; }
      /* Clickable day-header variant: the whole row is a <button> that bridges
         out to the parent app to open DashboardMyTimeDayEditorModal for that
         (person, work_date). Only the date text gets the underline so the
         affordance is obvious without making the whole row visually noisy. */
      .modal button.hours-day-header.day-link {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: 0;
        padding: 0.15rem 0.35rem;
        margin: -0.15rem -0.35rem;
        font: inherit;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
      }
      .modal button.hours-day-header.day-link .day-link-date {
        color: #2563eb;
        text-decoration: underline dotted;
        text-underline-offset: 3px;
      }
      .modal button.hours-day-header.day-link:hover { background: #eff6ff; }
      .modal button.hours-day-header.day-link:hover .day-link-date { color: #1d4ed8; }
      .modal button.hours-day-header.day-link:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
      }
      .modal .hours-day-allocs { margin-left: 1.5rem; margin-top: 0.25rem; color: #374151; font-size: 0.9rem; line-height: 1.5; }
      .modal .hours-day-alloc { padding: 0.02rem 0; }
      .modal .hours-day-alloc .alloc-pct { display: inline-block; min-width: 3.4rem; color: #6b7280; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobnum { color: #1f2937; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobname { color: #4b5563; }
      .modal .hours-day-alloc .alloc-address { color: #6b7280; }
      .modal .hours-day-alloc .alloc-counted { color: #6b7280; margin-left: 0.5rem; font-variant-numeric: tabular-nums; }
      .modal .hours-day-noalloc { color: #9ca3af; font-style: italic; font-size: 0.85rem; padding: 0.05rem 0; }
      .modal .hours-day-total { margin-top: 0.85rem; padding-top: 0.5rem; border-top: 2px solid #d1d5db; font-weight: 600; font-size: 0.95rem; color: #1f2937; }
      @media print {
        body { margin: 0.5in; }
        .tools { display: none !important; }
        th[data-sort] { cursor: default; }
        th .sort-indicator { display: none; }
        .click-cell { color: inherit !important; text-decoration: none !important; cursor: default !important; }
        /* Default print: hide all modal chrome (whole-table print). */
        body:not(.printing-modal) .modal-backdrop,
        body:not(.printing-modal) .modal { display: none !important; }
        /* Modal-only print mode: hide everything except the modal body. */
        body.printing-modal h1,
        body.printing-modal .meta,
        body.printing-modal .meta-sub,
        body.printing-modal .tools,
        body.printing-modal > table,
        body.printing-modal .footer-caption,
        body.printing-modal .modal-backdrop,
        body.printing-modal .modal-print,
        body.printing-modal .modal-close { display: none !important; }
        body.printing-modal .modal {
          position: static !important;
          transform: none !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          max-width: 100% !important;
          max-height: none !important;
          min-width: 0 !important;
          display: block !important;
          overflow: visible !important;
        }
      }
    </style></head><body>
      <h1>Team Summary</h1>
      <div class="meta">${escapeHtml(getReviewPeriodLabel())} &middot; ${sortedRows.length} ${sortedRows.length === 1 ? 'person' : 'people'}</div>
      <div class="meta-sub">${overheadMetaHtml}</div>
      <div class="tools" id="tools">
        <input type="search" id="search-input" placeholder="Search by name…" aria-label="Filter people by name">
        <span class="filter-status" id="filter-status" aria-live="polite"></span>
        <button type="button" id="reset-sort" class="reset-sort-btn" title="Sort by Profit (after overhead), descending">Reset sort</button>
      </div>
      <table>
        <thead><tr>
          <th data-sort="name" tabindex="0" role="columnheader" aria-sort="none">Name<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="totalHours" tabindex="0" role="columnheader" aria-sort="none">Hours<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadHours" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadLaborCost" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>labor<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="fieldHours" tabindex="0" role="columnheader" aria-sort="none">Field<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="gross" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="net" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitAfterOverhead" tabindex="0" role="columnheader" aria-sort="descending">Profit<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="revPerHour" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="netPerHour" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitPerHourAfterOverhead" tabindex="0" role="columnheader" aria-sort="none">Profit/hr<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
        </tr></thead>
        <tbody id="tbody"></tbody>
        <tfoot id="tfoot"></tfoot>
      </table>
      <p class="footer-caption" id="footer-caption"></p>
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title"></h2>
          <div class="modal-header-actions">
            <button class="modal-print" id="modal-print" type="button" aria-label="Print this breakdown" title="Print only this breakdown">Print</button>
            <button class="modal-close" id="modal-close" type="button" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="modal-body"></div>
      </div>
      <script>(function(){
        var breakdowns = ${breakdownsJson};
        var overheadRate = ${overheadRateJson};
        var overheadDecomp = ${overheadDecompJson};
        // Currently-expanded person (or null). Set by the parent at render
        // time (initial paint) and mutated locally on toggle clicks; the
        // parent re-affirms it on each iframe srcDoc refresh by re-encoding
        // it into this JSON literal, so an auto-refresh never loses the
        // highlight or accidentally surfaces a stale selection.
        var selectedPersonName = ${selectedPersonNameJson};
        function escH(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function fmtH(n){ return (Math.round(n*10)/10).toFixed(1); }
        function fmtPct(n){ return Math.round(n) + '%'; }
        function fmtPct1(n){ return (Math.round(n*10)/10).toFixed(1) + '%'; }
        function fmtMoney(n){ return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

        // ---- Cell HTML builders (iframe-side; mirror the pre-v2.541 TS versions) ----
        var CELL_STYLE_BASE = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;font-variant-numeric:tabular-nums;';
        var CELL_STYLE_DASH = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;';
        var CELL_STYLE_NAME = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;';
        function negS(n){ return n < 0 ? 'color:#b91c1c;' : ''; }
        function dashTd(){ return '<td style="' + CELL_STYLE_DASH + '">\u2014</td>'; }
        function plainMoneyTd(n){ return '<td style="' + CELL_STYLE_BASE + negS(n) + '">' + fmtMoney(n) + '</td>'; }
        function plainHoursTd(n){ return '<td style="' + CELL_STYLE_BASE + '">' + fmtH(n) + '</td>'; }
        function moneyOrDashTd(n){ return n == null ? dashTd() : plainMoneyTd(n); }
        // The name cell renders either as plain text (popup mode -- no
        // per-person detail panel exists outside the iframe) or as a toggle
        // button (embedded mode) that asks the parent React app to expand
        // the per-person panel below the Team Summary. We can't compute
        // nameClickable up here because bridgeTarget() hasn't been
        // defined yet during hoisting; we check at render time instead.
        function nameTd(s){
          if (!nameToggleableForRender()) {
            return '<td style="' + CELL_STYLE_NAME + '">' + escH(s) + '</td>';
          }
          var isSel = (selectedPersonName != null && s === selectedPersonName);
          // \u25BE = ▾ (expanded), \u25B8 = ▸ (collapsed). Mirrors the chevron
          // convention used in other collapse/expand toggles in the app.
          var chev = isSel ? '\u25BE' : '\u25B8';
          var title = isSel ? 'Hide breakdown' : 'Show breakdown';
          return '<td style="' + CELL_STYLE_NAME + '">'
            + '<button type="button" class="person-name-btn"'
            + ' data-action="toggle-person" data-person="' + escH(s) + '"'
            + ' aria-pressed="' + (isSel ? 'true' : 'false') + '"'
            + ' title="' + escH(title) + '">'
            + '<span class="chevron" aria-hidden="true">' + chev + '</span>'
            + '<span class="person-name-text">' + escH(s) + '</span>'
            + '</button></td>';
        }
        // Lazily checks the bridge so we don't depend on definition order
        // inside the IIFE. Embedded iframe -> true; popup window -> false
        // (no detail panel lives outside the popup, so a toggle would be a
        // dead button).
        function nameToggleableForRender(){
          // bridgeTarget() is defined later in this IIFE; function
          // declarations are hoisted so this works even when invoked from
          // buildRowHtml() called during initial renderTable().
          var bt = bridgeTarget();
          return !!(bt && bt.kind === 'parent');
        }
        // Clickable + keyboard-focusable cell. type drives modal routing; ariaLabel
        // is the screen-reader description (e.g. "Hours breakdown for Robert: 38.5").
        function clickCellTd(opts){
          var color = opts.colored === false ? '' : 'color:#2563eb;';
          var dec = 'text-decoration:underline dotted;text-underline-offset:2px;';
          return '<td class="click-cell" data-idx="' + opts.idx + '" data-type="' + opts.type
            + '" tabindex="0" role="button" aria-label="' + escH(opts.ariaLabel)
            + '" title="' + escH(opts.title || 'Click for breakdown')
            + '" style="' + CELL_STYLE_BASE + 'cursor:pointer;' + color + dec + (opts.extraStyle || '') + '">'
            + opts.content + '</td>';
        }
        function hoursClickableTd(n, idx, name, isSalary){
          // For salaried people we render "(s)" instead of the assumed
          // 8 hrs/weekday total — see TeamSummaryInline.Row for the
          // matching inline-component logic. The numeric value still
          // flows through r.totalHours, so the footer keeps summing.
          var content = isSalary ? '(s)' : fmtH(n);
          var aria = isSalary
            ? 'Hours breakdown for ' + name + ': salary (' + fmtH(n) + ' hours assumed)'
            : 'Hours breakdown for ' + name + ': ' + fmtH(n) + ' hours';
          var title = isSalary
            ? 'Salaried \u2014 ' + fmtH(n) + ' hrs assumed (8 hrs/weekday). Click for breakdown.'
            : 'Click for breakdown';
          return clickCellTd({ idx: idx, type: 'hours', content: content,
            ariaLabel: aria, title: title });
        }
        function overheadHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_hours', content: fmtH(n),
            ariaLabel: 'Overhead hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for office vs bid breakdown' });
        }
        function overheadLaborClickableTd(n, idx, name){
          if (!(n < 0)) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_labor', content: fmtMoney(n),
            ariaLabel: 'Overhead labor breakdown for ' + name + ': ' + fmtMoney(n),
            title: 'Click for overhead-labor breakdown',
            colored: false, extraStyle: negS(n) });
        }
        function fieldHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'field_hours', content: fmtH(n),
            ariaLabel: 'Field hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for field-hours breakdown' });
        }
        function grossClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'gross', content: fmtMoney(n),
            ariaLabel: 'Gross revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function netClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net', content: fmtMoney(n),
            ariaLabel: 'Net revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function profitClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit', content: fmtMoney(n),
            ariaLabel: 'Profit after overhead breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function grossPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'rev_per_hr', content: fmtMoney(n),
            ariaLabel: 'Gross revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function netPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net_per_hr', content: fmtMoney(n),
            ariaLabel: 'Net revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function profitPerHrClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit_per_hr', content: fmtMoney(n),
            ariaLabel: 'Profit per hour after overhead breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function buildRowHtml(r){
          var i = r.idx;
          var hasHours = r.totalHours > 0;
          // Light-blue row tint marks the currently-expanded person so the
          // eye finds them even on wide tables. Matches .person-name-btn
          // bold/blue text via the tr.selected-person selector.
          var rowAttrs = (selectedPersonName != null && r.name === selectedPersonName)
            ? ' class="selected-person"'
            : '';
          return '<tr' + rowAttrs + '>'
            + nameTd(r.name)
            + hoursClickableTd(r.totalHours, i, r.name, r.payConfigSource === 'salary')
            + overheadHoursClickableTd(r.overheadHours, i, r.name)
            + overheadLaborClickableTd(r.overheadLaborCost, i, r.name)
            + fieldHoursClickableTd(r.fieldHours, i, r.name)
            + grossClickableTd(r.gross, i, r.name)
            + netClickableTd(r.net, i, r.name)
            + profitClickableTd(r.profitAfterOverhead, i, r.name)
            + (hasHours ? grossPerHrClickableTd(r.revPerHour, i, r.name) : dashTd())
            + (hasHours ? netPerHrClickableTd(r.netPerHour, i, r.name) : dashTd())
            + (hasHours ? profitPerHrClickableTd(r.profitPerHourAfterOverhead, i, r.name) : dashTd())
            + '</tr>';
        }
        function buildFooterHtml(visibleRows){
          var totals = { hours: 0, overheadHours: 0, fieldHours: 0, overheadLaborCost: 0, gross: 0, net: 0, profit: null };
          for (var i = 0; i < visibleRows.length; i++) {
            var r = visibleRows[i];
            totals.hours += r.totalHours;
            totals.overheadHours += r.overheadHours;
            totals.fieldHours += r.fieldHours;
            totals.overheadLaborCost += r.overheadLaborCost;
            totals.gross += r.gross;
            totals.net += r.net;
            if (r.profitAfterOverhead != null) totals.profit = (totals.profit || 0) + r.profitAfterOverhead;
          }
          var n = visibleRows.length;
          var totalN = breakdowns.length;
          var label = (n === totalN)
            ? n + ' ' + (n === 1 ? 'person' : 'people')
            : 'Filtered total \u00b7 ' + n + ' of ' + totalN + ' ' + (totalN === 1 ? 'person' : 'people');
          var teamGrossPerHr = totals.hours > 0 ? totals.gross / totals.hours : 0;
          var teamNetPerHr = totals.hours > 0 ? totals.net / totals.hours : 0;
          var teamProfitPerHr = (totals.profit != null && totals.hours > 0) ? totals.profit / totals.hours : null;
          var html = '<tr style="font-weight:600;background:#f9fafb;">';
          html += '<td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">' + escH(label) + '</td>';
          html += plainHoursTd(totals.hours);
          html += plainHoursTd(totals.overheadHours);
          html += plainMoneyTd(totals.overheadLaborCost);
          html += plainHoursTd(totals.fieldHours);
          html += plainMoneyTd(totals.gross);
          html += plainMoneyTd(totals.net);
          html += moneyOrDashTd(totals.profit);
          html += (totals.hours > 0 ? plainMoneyTd(teamGrossPerHr) : dashTd());
          html += (totals.hours > 0 ? plainMoneyTd(teamNetPerHr) : dashTd());
          html += (totals.hours > 0 ? moneyOrDashTd(teamProfitPerHr) : dashTd());
          html += '</tr>';
          return html;
        }

        // ---- Sort + filter state ----
        // Default sort matches the pre-v2.541 server order: profit (after overhead) desc.
        // null sort values (e.g. r.profitAfterOverhead === null when overheadRate hasn't
        // loaded) sort to the bottom regardless of direction so they don't claim ranks.
        var sortKey = 'profitAfterOverhead';
        var sortDir = 'desc';
        var searchQuery = '';
        function compareRows(a, b){
          var av = a[sortKey];
          var bv = b[sortKey];
          var aN = (av == null);
          var bN = (bv == null);
          if (aN && bN) return a.name.localeCompare(b.name);
          if (aN) return 1;
          if (bN) return -1;
          var d;
          if (sortKey === 'name') {
            d = String(av).localeCompare(String(bv));
          } else {
            d = (av < bv ? -1 : av > bv ? 1 : 0);
          }
          if (d === 0) return a.name.localeCompare(b.name);
          return sortDir === 'asc' ? d : -d;
        }
        function getVisibleRows(){
          var q = searchQuery.trim().toLowerCase();
          var arr = q
            ? breakdowns.filter(function(r){ return r.name.toLowerCase().indexOf(q) >= 0; })
            : breakdowns.slice();
          arr.sort(compareRows);
          return arr;
        }
        function updateSortIndicators(){
          var ths = document.querySelectorAll('th[data-sort]');
          for (var i = 0; i < ths.length; i++) {
            var th = ths[i];
            var key = th.getAttribute('data-sort');
            var span = th.querySelector('.sort-indicator');
            if (key === sortKey) {
              th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
              if (span) span.textContent = sortDir === 'asc' ? '\u25B2' : '\u25BC';
            } else {
              th.setAttribute('aria-sort', 'none');
              if (span) span.textContent = '';
            }
          }
          var resetBtn = document.getElementById('reset-sort');
          if (resetBtn) {
            var atDefault = (sortKey === 'profitAfterOverhead' && sortDir === 'desc');
            resetBtn.disabled = atDefault;
          }
        }
        function updateFilterStatus(visible){
          var status = document.getElementById('filter-status');
          if (!status) return;
          var totalN = breakdowns.length;
          if (!searchQuery.trim()) {
            status.textContent = '';
            return;
          }
          status.textContent = 'Showing ' + visible.length + ' of ' + totalN + (totalN === 1 ? ' person' : ' people');
        }
        function updateFooterCaption(visible){
          var cap = document.getElementById('footer-caption');
          if (!cap) return;
          var notes = [];
          if (searchQuery.trim() && visible.length < breakdowns.length) {
            notes.push('Footer totals reflect only the people shown above.');
          }
          notes.push('Workers archived or external-only contribute to job revenue but are not in this table; their share of those jobs is not summed here.');
          cap.textContent = notes.join(' ');
        }
        function attachClickCellHandlers(){
          var cells = document.querySelectorAll('.click-cell');
          for (var i = 0; i < cells.length; i++) {
            (function(cell){
              cell.addEventListener('click', function(){
                var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                var type = cell.getAttribute('data-type') || '';
                if (idx >= 0) openModal(idx, type);
              });
              cell.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                  e.preventDefault();
                  var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                  var type = cell.getAttribute('data-type') || '';
                  if (idx >= 0) openModal(idx, type);
                }
              });
            })(cells[i]);
          }
        }
        function renderTable(){
          var visible = getVisibleRows();
          var tbody = document.getElementById('tbody');
          var tfoot = document.getElementById('tfoot');
          if (!tbody || !tfoot) return;
          if (visible.length === 0) {
            tbody.className = 'empty-state';
            tbody.innerHTML = '<tr><td colspan="11">No matches' + (searchQuery.trim() ? ' for \u201C' + escH(searchQuery.trim()) + '\u201D' : '') + '.</td></tr>';
          } else {
            tbody.className = '';
            var rowHtml = '';
            for (var i = 0; i < visible.length; i++) rowHtml += buildRowHtml(visible[i]);
            tbody.innerHTML = rowHtml;
          }
          tfoot.innerHTML = buildFooterHtml(visible);
          updateSortIndicators();
          updateFilterStatus(visible);
          updateFooterCaption(visible);
          attachClickCellHandlers();
        }
        // v2.543 — Hours breakdown renders each day as its own block with the
        // crew allocations indented underneath in the format
        //   (percent) Job # | Job Name
        // (vs the older single-row table where allocations were a comma-joined
        // string in a third column). Hierarchy reads better when there are 3+
        // jobs in a day and matches the way operators describe the day verbally.
        function dowShort(dateStr){
          // Local-noon parse to dodge UTC drift, e.g. 2026-05-12T12:00:00.
          if (!dateStr) return '';
          var dt = new Date(dateStr + 'T12:00:00');
          if (isNaN(dt.getTime())) return '';
          return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
        }
        function dayHeaderLabel(dateStr){
          var dow = dowShort(dateStr);
          return (dow ? dow + ' ' : '') + escH(dateStr);
        }
        function buildAllocLineHtml(a, opts){
          var jobName = a.jobName ? escH(a.jobName) : '<span style="color:#9ca3af;">\u2014</span>';
          var html = '<div class="hours-day-alloc">'
            + '<span class="alloc-pct">(' + fmtPct1(a.pct) + ')</span> '
            + '<span class="alloc-jobnum">' + escH(a.hcp) + '</span> | '
            + '<span class="alloc-jobname">' + jobName + '</span>';
          // Render the address only when present so blank addresses on
          // Office / future jobs don't trail with a dangling "- ".
          if (a.address) {
            html += ' <span class="alloc-address">- ' + escH(a.address) + '</span>';
          }
          if (opts && opts.showCounted) {
            html += '<span class="alloc-counted">\u00b7 ' + fmtH(a.hours) + ' hrs counted</span>';
          }
          html += '</div>';
          return html;
        }
        function buildDaySectionHtml(d, opts){
          var html = '<div class="hours-day-section">';
          var headerInner = '<span class="day-link-date">' + dayHeaderLabel(d.date) + '</span>'
            + '<span class="day-hours">\u00b7 ' + fmtH(d.hours) + ' hrs</span>';
          if (opts && opts.showCounted) {
            var counted = d.crewAllocations.reduce(function(s,a){ return s + a.hours; }, 0);
            headerInner += '<span class="day-hours">\u00b7 ' + fmtH(counted) + ' hrs counted</span>';
          }
          // Render the header as a <button> when the parent app is reachable
          // (embedded mode, or popup that still has window.opener). Clicking
          // the button posts a message asking the parent to open
          // DashboardMyTimeDayEditorModal for (personName, d.date).
          var clickable = opts && opts.clickableDay && opts.personName;
          if (clickable) {
            html += '<button type="button" class="hours-day-header day-link"'
              + ' data-action="open-day-editor"'
              + ' data-person="' + escH(opts.personName) + '"'
              + ' data-date="' + escH(d.date) + '"'
              + ' title="Open My Time for this day"'
              + ' aria-label="Open My Time for ' + escH(opts.personName) + ' on ' + escH(d.date) + '">'
              + headerInner
              + '</button>';
          } else {
            html += '<div class="hours-day-header">' + headerInner + '</div>';
          }
          html += '<div class="hours-day-allocs">';
          if (d.crewAllocations.length === 0) {
            html += '<div class="hours-day-noalloc">No crew assignment</div>';
          } else {
            // Sort allocations within the day by descending pct so the
            // biggest job rises to the top of each day's list.
            var allocs = d.crewAllocations.slice().sort(function(a,b){ return b.pct - a.pct; });
            for (var ai = 0; ai < allocs.length; ai++) {
              html += buildAllocLineHtml(allocs[ai], opts);
            }
          }
          html += '</div>';
          html += '</div>';
          return html;
        }
        function buildHoursBody(hb, modalOpts){
          // modalOpts: { personName, clickableDay } — flows from openModal()
          // into buildDaySectionHtml so day headers can render as clickable
          // buttons that bridge to DashboardMyTimeDayEditorModal in the parent.
          var personName = (modalOpts && modalOpts.personName) || '';
          var clickableDay = !!(modalOpts && modalOpts.clickableDay && personName);
          var sectionOpts = function(showCounted){
            return { showCounted: showCounted, clickableDay: clickableDay, personName: personName };
          };
          var srcLabel = hb.source === 'salary' ? 'Salaried (8 hrs/weekday)' : hb.source === 'hourly' ? 'Hourly (from people_hours / clock sessions)' : 'Unknown (no pay config row)';
          var modeLabel = hb.onlyPaidJobs ? 'Only paid jobs (sub labor + crew assignments)' : 'All days in period (clocked / salary)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          // Sort dailyRows by date asc so the day-by-day story reads naturally.
          var sortedDailyRows = hb.dailyRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
          if (hb.onlyPaidJobs) {
            var hasCrew = sortedDailyRows.some(function(d){ return d.crewAllocations.length > 0; });
            if (hasCrew) {
              html += '<h3>Crew jobs (per day)</h3>';
              html += '<div class="hours-day-list">';
              for (var i = 0; i < sortedDailyRows.length; i++) {
                var d = sortedDailyRows[i];
                if (d.crewAllocations.length === 0) continue;
                html += buildDaySectionHtml(d, sectionOpts(true));
              }
              html += '</div>';
              html += '<div class="hours-day-total">Crew subtotal: ' + fmtH(hb.totals.crew) + ' hrs</div>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3>Sub labor jobs</h3>';
              html += '<table><thead><tr><th>Date</th><th>HCP</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k=0; k<sub.length; k++) {
                var s = sub[k];
                html += '<tr><td>' + escH(s.date) + '</td><td>' + escH(s.hcp) + '</td><td class="num">' + fmtH(s.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            html += '<p class="caption">Total = crew (' + fmtH(hb.totals.crew) + ') + sub labor (' + fmtH(hb.totals.subLabor) + ') = ' + fmtH(hb.totals.totalHours) + ' hrs. Each crew line shows <em>(pct) Job # | Job Name</em>; pct is the share of the day attributed to that job.</p>';
          } else {
            if (sortedDailyRows.length > 0) {
              html += '<div class="hours-day-list">';
              for (var i2 = 0; i2 < sortedDailyRows.length; i2++) {
                html += buildDaySectionHtml(sortedDailyRows[i2], sectionOpts(false));
              }
              html += '</div>';
            } else {
              html += '<p class="caption">No daily hours recorded in this period.</p>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3 style="margin-top:1.5rem;">Sub labor jobs (informational \u2014 not counted in this mode)</h3>';
              html += '<table><thead><tr><th>Date</th><th>HCP</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub2 = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k2=0; k2<sub2.length; k2++) {
                var s2 = sub2[k2];
                html += '<tr><td>' + escH(s2.date) + '</td><td>' + escH(s2.hcp) + '</td><td class="num">' + fmtH(s2.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            // Always-on discoverability hint for the Review-level toggle, even
            // when this period has no sub-labor rows -- they may exist in
            // other periods and the toggle still affects how Hours is counted.
            html += '<p class="caption">Sub labor hours are not added in this mode \u2014 toggle "Only paid jobs" in Review to count them.</p>';
          }
          return html;
        }
        function buildGrossBody(gb) {
          var html = '';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          // Center every column header and cell so the table reads as a
          // centered grid (numbers still tabular-aligned via font-variant).
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num" style="text-align:center;">HCP</th>';
          html += '<th style="text-align:center;">Job</th>';
          html += '<th class="num" style="text-align:center;">Total Bill</th>';
          html += '<th class="num" style="text-align:center;">% Complete</th>';
          html += '<th class="num" style="text-align:center;">Value Created</th>';
          html += '<th class="num" style="text-align:center;">Your cost<br>(period)</th>';
          html += '<th class="num" style="text-align:center;">Total labor<br>(lifetime)</th>';
          html += '<th class="num" style="text-align:center;">Share</th>';
          html += '<th class="num" style="text-align:center;">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < gb.jobs.length; i++) {
            var j = gb.jobs[i];
            var pctSuffix = j.pctCompleteSource === 'assumed' ? ' (assumed)' : '';
            html += '<tr>';
            html += '<td class="num" style="text-align:center;">' + escH(j.hcp) + '</td>';
            html += '<td style="text-align:center;">' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalBill) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct(j.pctComplete) + escH(pctSuffix) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalLaborOnJob) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.allocatedRevenue) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num" style="text-align:center;font-weight:600;">' + fmtMoney(gb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Value Created &times; (Your cost &divide; Total labor). Sorted by allocated revenue.</p>';
          html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildNetBody(nb) {
          var html = '';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Value<br>Created</th>';
          html += '<th class="num">&minus; Parts</th>';
          html += '<th class="num">&minus; Total<br>labor</th>';
          html += '<th class="num">= Net Rev<br>(job)</th>';
          html += '<th class="num">Your cost<br>(period)</th>';
          html += '<th class="num">Share</th>';
          html += '<th class="num">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < nb.jobs.length; i++) {
            var j = nb.jobs[i];
            html += '<tr>';
            html += '<td class="num">' + escH(j.hcp) + '</td>';
            html += '<td>' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num">' + fmtMoney(j.partsCost) + '</td>';
            html += '<td class="num">' + fmtMoney(j.totalLaborOnJob) + '</td>';
            html += '<td class="num"' + (j.revenueBeforeOverhead < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.revenueBeforeOverhead) + '</td>';
            html += '<td class="num">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num"' + (j.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.allocatedNet) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num"' + (nb.total < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(nb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Net Rev (job) &times; (Your cost &divide; Total labor). Net Rev (job) = Value Created &minus; Parts &minus; Total labor. Sorted by allocated net.</p>';
          html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildProfitBody(pb) {
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (overheadRate == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div style="font-size:1.05rem;"><strong>Net Revenue: ' + fmtMoney(pb.totalNet) + '</strong></div>';
            return html;
          }
          var fieldHrs = (pb.fieldHours != null ? pb.fieldHours : pb.totalHours);
          var overheadHrs = (pb.overheadHours != null ? pb.overheadHours : 0);
          // Overhead is charged on every hour worked in the period (field
          // + office + bid). See enrichTeamSummaryRowsForInline and
          // drilldowns.tsx ProfitBody — same math so the popup column,
          // inline column, and breakdown total all reconcile.
          var fieldOverhead = fieldHrs * overheadRate;
          var overheadHoursOverhead = overheadHrs * overheadRate;
          var totalOverhead = fieldOverhead + overheadHoursOverhead;
          var totalProfit = pb.totalNet - totalOverhead;
          html += '<div style="margin-bottom:0.25rem;"><strong>Overhead rate (Method A):</strong> $' + overheadRate.toFixed(2) + ' per hour</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(pb.totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(pb.totalHours) + ' (field ' + fmtH(fieldHrs) + (overheadHrs > 0.005 ? ' + overhead ' + fmtH(overheadHrs) : '') + ')</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead deduction:</strong> ' + fmtH(pb.totalHours) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(totalOverhead) + '</div>';
          if (overheadHrs > 0.005) {
            html += '<div style="margin-bottom:0.25rem;padding-left:1.5rem;color:#6b7280;">(' + fmtMoney(fieldOverhead) + ' field + ' + fmtMoney(overheadHoursOverhead) + ' overhead hours)</div>';
          }
          html += '<div style="font-size:1.05rem;"><strong>Profit (after overhead): <span' + (totalProfit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(totalProfit) + '</span></strong></div>';
          html += '</div>';
          var rows = (pb.jobs || []).map(function(j){
            var oh = j.hoursInPeriod * overheadRate;
            var profit = j.allocatedNet - oh;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: j.hoursInPeriod, overhead: oh, profit: profit };
          });
          rows.sort(function(a, b){ return b.profit - a.profit; });
          if (rows.length === 0 && overheadHrs < 0.005 && pb.unaccountedHours < 0.01) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Net Rev<br>(allocated)</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">&minus; Overhead<br>(hrs &times; rate)</th>';
          html += '<th class="num">= Profit<br>(after overhead)</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num">' + fmtMoney(r.overhead) + '</td>';
            html += '<td class="num"' + (r.profit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.profit) + '</td>';
            html += '</tr>';
          }
          if (overheadHrs > 0.005) {
            html += '<tr style="background:#f9fafb;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Overhead hours</em></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(overheadHrs) + '</td>';
            html += '<td class="num">' + fmtMoney(overheadHoursOverhead) + '</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoney(-overheadHoursOverhead) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            var unOh = pb.unaccountedHours * overheadRate;
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that were not tied to a job, but still incur overhead.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num">' + fmtMoney(unOh) + '</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoney(-unOh) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total<br>(all hours)</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(pb.totalNet) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(pb.totalHours) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(totalOverhead) + '</td>';
          html += '<td class="num"' + (totalProfit < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(totalProfit) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Per-job overhead = your hours on that job &times; rate. Profit (job) = Allocated Net Rev &minus; Overhead. Job rows sorted by profit. Overhead hours (' + fmtH(overheadHrs) + ') are charged the same rate as field hours but contribute no revenue, so they appear as a single deduction-only row.</p>';
          html += '<p class="caption">Profit (after overhead) = Net Revenue &minus; (<strong>all hours</strong> &times; rate). The rate is the rolling 90-day overhead spend per field hour; we apply it to every hour the person worked (field + office + bid) so the deduction reflects this person\\'s full share of the overhead burden.</p>';
          return html;
        }
        function fmtMoneyPerHr(n) { return fmtMoney(n) + '/hr'; }
        function buildGrossPerHourBody(entry) {
          var gb = entry.gb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalGross = gb.total;
          var rate = totalHours > 0 ? totalGross / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.25rem;"><strong>Gross Revenue:</strong> ' + fmtMoney(totalGross) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Gross Revenue/hr: ' + fmtMoneyPerHr(rate) + '</strong></div>';
          html += '</div>';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = gb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedRevenue / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedRevenue: j.allocatedRevenue, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -1 : b.perHr) - (a.perHr == null ? -1 : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Gross Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(r.allocatedRevenue) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num">' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(totalGross) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Gross Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Gross &divide; Your hours on that job. Sorted by per-job rate.</p>';
          html += '<p class="caption">Gross Revenue/hr is your <strong>total Gross Revenue</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job paid per hour you spent on it.</p>';
          return html;
        }
        function buildNetPerHourBody(entry) {
          var nb = entry.nb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalNet = nb.total;
          var rate = totalHours > 0 ? totalNet / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Net Revenue/hr is your <strong>total Net Revenue (before overhead)</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job kept (after parts and labor) per hour you spent on it.</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Net Revenue/hr: <span' + (rate < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(rate) + '</span></strong></div>';
          html += '</div>';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = nb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedNet / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -Infinity : b.perHr) - (a.perHr == null ? -Infinity : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Net Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num"' + (r.perHr != null && r.perHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no net revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num"' + (totalNet < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(totalNet) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num"' + (rate < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Net Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Net &divide; Your hours on that job. Sorted by per-job rate.</p>';
          return html;
        }
        function buildProfitPerHourBody(entry) {
          var nb = entry.nb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var fieldHrs = (pb.fieldHours != null ? pb.fieldHours : totalHours);
          var overheadHrs = (pb.overheadHours != null ? pb.overheadHours : 0);
          var totalNet = nb.total;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (overheadRate == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
            html += '<div><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
            return html;
          }
          // Charge overhead on all hours (field + office + bid) so the
          // popup Profit/hr drilldown stays in sync with ProfitBody and
          // ProfitPerHourBody in drilldowns.tsx + the parent column math.
          var fieldOverhead = fieldHrs * overheadRate;
          var overheadHoursOverhead = overheadHrs * overheadRate;
          var totalOverhead = fieldOverhead + overheadHoursOverhead;
          var totalProfit = totalNet - totalOverhead;
          var rate = totalHours > 0 ? totalProfit / totalHours : 0;
          html += '<div style="margin-bottom:0.25rem;"><strong>Overhead rate (Method A):</strong> $' + overheadRate.toFixed(2) + ' per hour</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + ' (field ' + fmtH(fieldHrs) + (overheadHrs > 0.005 ? ' + overhead ' + fmtH(overheadHrs) : '') + ')</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead deduction:</strong> ' + fmtH(totalHours) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(totalOverhead) + '</div>';
          if (overheadHrs > 0.005) {
            html += '<div style="margin-bottom:0.25rem;padding-left:1.5rem;color:#6b7280;">(' + fmtMoney(fieldOverhead) + ' field + ' + fmtMoney(overheadHoursOverhead) + ' overhead hours)</div>';
          }
          html += '<div style="margin-bottom:0.25rem;"><strong>Profit (after overhead):</strong> <span' + (totalProfit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(totalProfit) + '</span></div>';
          html += '<div style="font-size:1.05rem;"><strong>Profit/hr (after overhead): <span' + (rate < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(rate) + '</span></strong></div>';
          html += '</div>';
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = (nb.jobs || []).map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var netPerHr = h > 0 ? j.allocatedNet / h : null;
            var profitPerHr = netPerHr == null ? null : netPerHr - overheadRate;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: h, netPerHr: netPerHr, profitPerHr: profitPerHr };
          });
          rows.sort(function(a, b){ return (b.profitPerHr == null ? -Infinity : b.profitPerHr) - (a.profitPerHr == null ? -Infinity : a.profitPerHr); });
          if (rows.length === 0 && overheadHrs < 0.005 && pb.unaccountedHours < 0.01) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Net Rev/hr<br>(this job)</th>';
          html += '<th class="num">&minus; Overhead<br>rate</th>';
          html += '<th class="num">= Profit/hr<br>(this job)</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.netPerHr != null && r.netPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.netPerHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.netPerHr)) + '</td>';
            html += '<td class="num">' + (r.hoursInPeriod > 0 ? '$' + overheadRate.toFixed(2) + '/hr' : '<span style="color:#9ca3af;">—</span>') + '</td>';
            html += '<td class="num"' + (r.profitPerHr != null && r.profitPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.profitPerHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.profitPerHr)) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '</tr>';
          }
          if (overheadHrs > 0.005) {
            html += '<tr style="background:#f9fafb;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Overhead hours</em><div style="color:#6b7280;font-size:0.8rem;">Office + bid time. No revenue, but still charged the overhead rate now that overhead hours are included in the deduction.</div></td>';
            html += '<td class="num">' + fmtMoneyPerHr(0) + '</td>';
            html += '<td class="num">$' + overheadRate.toFixed(2) + '/hr</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoneyPerHr(-overheadRate) + '</td>';
            html += '<td class="num">' + fmtH(overheadHrs) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they earn no net revenue but still incur overhead.</div></td>';
            html += '<td class="num">' + fmtMoneyPerHr(0) + '</td>';
            html += '<td class="num">$' + overheadRate.toFixed(2) + '/hr</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoneyPerHr(-overheadRate) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="4" style="text-align:right;font-weight:600;">Headline rate</td>';
          html += '<td class="num"' + (rate < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoneyPerHr(rate) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Per-job: Profit/hr = (Allocated Net &divide; Your hours) &minus; Overhead rate. Headline rate = (Net Revenue &minus; Total overhead) &divide; Total hours, where <strong>total overhead = All hours &times; rate</strong> (every hour the person worked &mdash; field + office + bid &mdash; is charged the rate). Sorted by per-job profit/hr.</p>';
          html += '<p class="caption">Profit/hr (after overhead) divides your <strong>Profit (after overhead)</strong> by your <strong>total hours</strong>. The overhead deduction is <strong>all hours &times; rate</strong> &mdash; office and bid hours are charged the same per-hour overhead as field hours even though they earn no revenue, which is why those rows show a flat &minus;$ rate per hour.</p>';
          return html;
        }
        function buildOverheadSessionsSection(label, sessions, bucketTotalHrs) {
          // sessions: array of pre-formatted OverheadSessionLine entries with
          // a single bucket (office or bid). Renders a hierarchical layout
          // matching the Hours breakdown modal: per-day header + indented
          // per-session lines. (pct) on each session is its share of that
          // day's bucket total. bucketTotalHrs is rendered next to the
          // section label so e.g. "Office \u00b7 17.7 hrs".
          var html = '';
          if (!sessions || sessions.length === 0) return '';
          var headerHtml = escH(label);
          if (typeof bucketTotalHrs === 'number') {
            // Match the section label typography exactly (no muted color /
            // weight / size); just nudge with margin-left for spacing.
            headerHtml += '<span style="margin-left:0.5rem;">\u00b7 ' + fmtH(bucketTotalHrs) + ' hrs</span>';
          }
          html += '<h3 style="text-align:center;">' + headerHtml + '</h3>';
          html += '<div class="hours-day-list">';
          // Group by workDate, preserving the parent-side sort order.
          var byDate = {};
          var datesInOrder = [];
          for (var i = 0; i < sessions.length; i++) {
            var s = sessions[i];
            if (!byDate[s.workDate]) {
              byDate[s.workDate] = [];
              datesInOrder.push(s.workDate);
            }
            byDate[s.workDate].push(s);
          }
          for (var di = 0; di < datesInOrder.length; di++) {
            var dateKey = datesInOrder[di];
            var daySessions = byDate[dateKey];
            var dayTotal = 0;
            for (var si = 0; si < daySessions.length; si++) dayTotal += (daySessions[si].hours || 0);
            html += '<div class="hours-day-section">';
            html += '<div class="hours-day-header">' + dayHeaderLabel(dateKey)
              + '<span class="day-hours">\u00b7 ' + fmtH(dayTotal) + ' hrs</span>'
              + '</div>';
            html += '<div class="hours-day-allocs">';
            for (var sj = 0; sj < daySessions.length; sj++) {
              var ss = daySessions[sj];
              var pct = dayTotal > 0 ? (ss.hours / dayTotal) * 100 : 0;
              html += '<div class="hours-day-alloc">';
              html += '<span class="alloc-pct">(' + fmtPct1(pct) + ')</span> ';
              if (ss.bucket === 'bid') {
                // Match the Hours breakdown convention: B# | Project Name - address.
                var bidName = ss.bidName ? escH(ss.bidName) : '<span style="color:#9ca3af;">\u2014</span>';
                html += '<span class="alloc-jobnum">' + escH(ss.bidHcp || 'B?') + '</span> | ';
                html += '<span class="alloc-jobname">' + bidName + '</span>';
                if (ss.bidAddress) {
                  html += ' <span class="alloc-address">- ' + escH(ss.bidAddress) + '</span>';
                }
              } else {
                // Office sessions: time range + hours act as the "session details".
                if (ss.startTime && ss.endTime) {
                  html += '<span class="alloc-jobname">' + escH(ss.startTime + ' \u2192 ' + ss.endTime) + '</span>';
                } else {
                  html += '<span class="alloc-jobname">Office session</span>';
                }
              }
              html += '<span class="alloc-counted">\u00b7 ' + fmtH(ss.hours) + ' hrs</span>';
              html += '</div>';
            }
            html += '</div>';
            html += '</div>';
          }
          return html;
        }
        function buildOverheadHoursBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var totalOverhead = officeHrs + bidHrs;
          var totalWork = (entry.hb && entry.hb.totals && entry.hb.totals.totalHours) || 0;
          var fieldHrs = entry.fieldHours || 0;
          var sessions = entry.overheadSessions || [];
          var officeSessions = [];
          var bidSessions = [];
          for (var oi = 0; oi < sessions.length; oi++) {
            if (sessions[oi].bucket === 'office') officeSessions.push(sessions[oi]);
            else if (sessions[oi].bucket === 'bid') bidSessions.push(sessions[oi]);
          }
          var html = '';
          if (officeSessions.length === 0 && bidSessions.length === 0) {
            html += '<p class="caption">No approved office or bid sessions in this period.</p>';
          } else {
            html += buildOverheadSessionsSection('Office', officeSessions, officeHrs);
            html += buildOverheadSessionsSection('Bids', bidSessions, bidHrs);
          }
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num" style="text-align:left;">Share of total work</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Overhead (office + bid)</td><td class="num">' + fmtH(totalOverhead) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((totalOverhead / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Field (residual)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((fieldHrs / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total work</td><td class="num" style="font-weight:600;">' + fmtH(totalWork) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Field hrs = Total work hrs &minus; Overhead hrs. For salaried people, total work is their weekday salary days (8 hrs/weekday); for hourly, it is people_hours / clock sessions. <strong>Every hour worked is charged the per-hour overhead in the &ldquo;Profit (after overhead)&rdquo; column</strong> &mdash; field, office, and bid hours all incur the same rate.</p>';
          html += '<p class="caption">Overhead hours are approved clock sessions on the configured Office job or on any bid &mdash; the same buckets that feed the rolling 90-day overhead rate.</p>';
          return html;
        }
        function buildOverheadLaborBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var fieldHrs = entry.fieldHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var wage = entry.hourlyWage || 0;
          var overheadLaborCost = entry.overheadLaborCost || 0;
          var src = entry.payConfigSource || 'unknown';
          var srcLabel = src === 'salary' ? 'Salaried (weekday hrs \u00d7 hourly_wage from people_pay_config)' : src === 'hourly' ? 'Hourly (people_hours / clock sessions \u00d7 hourly_wage)' : 'Unknown (no people_pay_config row \u2014 wage treated as $0)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Hourly wage:</strong> ' + (wage > 0 ? '$' + wage.toFixed(2) + '/hr' : '<span style="color:#9ca3af;">not configured</span>') + '</div>';
          html += '<div style="margin-top:0.5rem;font-size:1.05rem;text-align:center;"><strong>Overhead labor: ' + fmtMoney(overheadLaborCost) + '</strong> (' + fmtH(overheadHrs) + ' overhead hrs \u00d7 $' + (wage || 0).toFixed(2) + '/hr)</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th class="num" style="text-align:left;">Share</th></tr></thead>';
          html += '<tbody>';
          var officeCost = -(officeHrs * wage);
          var bidCost = -(bidHrs * wage);
          var hasCost = overheadLaborCost < 0;
          html += '<tr><td>Office (configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td><td class="num">' + fmtMoney(officeCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((officeCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Bid (any bid_id)</td><td class="num">' + fmtH(bidHrs) + '</td><td class="num">' + fmtMoney(bidCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((bidCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead labor</td><td class="num" style="font-weight:600;">' + fmtH(overheadHrs) + '</td><td class="num" style="font-weight:600;">' + fmtMoney(overheadLaborCost) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>For context: this person\\'s field labor</h3>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th>Where it shows up</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Field (everything not Office or Bid)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="color:#9ca3af;">' + fmtMoney(-(fieldHrs * wage)) + '</td><td style="color:#6b7280;">Already in <strong>Net Revenue</strong>.</td></tr>';
          html += '</tbody>';
          html += '</table>';
          if (wage <= 0) {
            html += '<p class="caption" style="color:#b45309;">No <code>hourly_wage</code> is set for this person in <code>people_pay_config</code>, so the cost columns above show as $0. Set their wage on the People \u2192 Hours \u2192 Pay config row to make this column meaningful.</p>';
          }
          html += '<p class="caption">Overhead labor is what the company paid this person for hours that are <strong>not</strong> billed to a field job \u2014 the configured Office job and any time clocked into a bid. Field labor is excluded here on purpose: it is already subtracted at the per-job level inside Net Revenue (<code>job net = revenue \u2212 parts \u2212 total labor</code>), so showing it again would visually double-count.</p>';
          html += '<p class="caption">Office and bid hours fund the rolling 90-day overhead pool (office labor + bid labor + office parts), which is then deducted from every person as <code>total hours \u00d7 rate</code> in the &ldquo;Profit (after overhead)&rdquo; column \u2014 every hour worked (field + office + bid) is charged the per-hour overhead. This Overhead labor column simply makes the office + bid wage contribution visible in each person\\'s own row \u2014 it does <strong>not</strong> change Gross, Net, or Profit numbers.</p>';
          return html;
        }
        function buildFieldHoursBody(entry) {
          var hb = entry.hb || { totals: { totalHours: 0 }, source: 'unknown' };
          var pb = entry.pb || { jobs: [], unaccountedHours: 0 };
          var totalWork = (hb.totals && hb.totals.totalHours) || 0;
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var fieldHrs = entry.fieldHours || 0;
          var allocatedFieldHrs = 0;
          var jobs = (pb.jobs || []).slice();
          for (var i = 0; i < jobs.length; i++) allocatedFieldHrs += (jobs[i].hoursInPeriod || 0);
          var unaccountedFieldHrs = pb.unaccountedHours || 0;
          var srcLabel = hb.source === 'salary'
            ? 'Salaried (8 hrs/weekday)'
            : hb.source === 'hourly'
              ? 'Hourly (from people_hours / clock sessions)'
              : 'Unknown (no pay config row)';
          var modeLabel = (hb.onlyPaidJobs)
            ? 'Only paid jobs (sub labor + crew assignments on jobs marked paid in full)'
            : 'All days in period (clocked / salary, minus office + bid)';
          var ohRateNote = (typeof overheadRate === 'number' && overheadRate != null)
            ? '$' + overheadRate.toFixed(2) + ' per hour &times; ' + fmtH(fieldHrs + officeHrs + bidHrs) + ' all hours = ' + fmtMoney((fieldHrs + officeHrs + bidHrs) * overheadRate) + ' overhead charged in &ldquo;Profit (after overhead)&rdquo; (field component: ' + fmtH(fieldHrs) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(fieldHrs * overheadRate) + ')'
            : 'Overhead rate unavailable &mdash; reload Review.';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>How field hrs is computed</th><th class="num">Hours</th></tr></thead><tbody>';
          if (hb.onlyPaidJobs) {
            html += '<tr><td>Sub labor + crew hours on paid-in-full jobs</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td><em>Office + bid hours are not in this mode by construction</em></td><td class="num"><span style="color:#9ca3af;">&mdash;</span></td></tr>';
          } else {
            html += '<tr><td>Total work hrs (' + escH(hb.source === 'salary' ? 'salary days' : 'people_hours / clock sessions') + ')</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td>&minus; Office hrs (clock on configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td></tr>';
            html += '<tr><td>&minus; Bid hrs (clock on any bid)</td><td class="num">' + fmtH(bidHrs) + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">= Field hrs</td><td class="num" style="font-weight:600;">' + fmtH(fieldHrs) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<h3 style="text-align:center;">Where the field hrs went</h3>';
          if (jobs.length === 0 && unaccountedFieldHrs < 0.01) {
            html += '<p class="caption">No field hours were recorded against any job in this period.</p>';
          } else {
            html += '<table>';
            html += '<thead><tr><th class="num">HCP</th><th>Job</th><th class="num">Your field hrs<br>(period)</th><th class="num" style="text-align:left;">Share of<br>field hrs</th></tr></thead><tbody>';
            var jobsForDisplay = jobs.slice().sort(function(a, b){ return (b.hoursInPeriod || 0) - (a.hoursInPeriod || 0); });
            for (var k = 0; k < jobsForDisplay.length; k++) {
              var j = jobsForDisplay[k];
              if ((j.hoursInPeriod || 0) <= 0.005) continue;
              var share = fieldHrs > 0 ? (j.hoursInPeriod / fieldHrs) * 100 : 0;
              html += '<tr>';
              html += '<td class="num">' + escH(j.hcp) + '</td>';
              html += '<td>' + escH(j.jobName || '\u2014') + '</td>';
              html += '<td class="num">' + fmtH(j.hoursInPeriod) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            if (unaccountedFieldHrs > 0.005) {
              var unShare = fieldHrs > 0 ? (unaccountedFieldHrs / fieldHrs) * 100 : 0;
              html += '<tr style="background:#fff7ed;">';
              html += '<td class="num">&mdash;</td>';
              html += '<td><em>Unallocated field hrs</em><div style="color:#6b7280;font-size:0.8rem;">Field-type hours not tied to a specific job allocation (e.g. salary day with no crew assignment).</div></td>';
              html += '<td class="num">' + fmtH(unaccountedFieldHrs) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(unShare) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            html += '</tbody>';
            html += '<tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Total field hrs</td><td class="num" style="font-weight:600;">' + fmtH(allocatedFieldHrs + unaccountedFieldHrs) + '</td><td></td></tr></tfoot>';
            html += '</table>';
          }
          html += '<p class="caption">Each crew assignment\\'s hours = day total \u00d7 pct. The day total is <code>peopleHours</code> (or 8 hrs on a salary weekday). Office time has its own crew row and is filtered from this field-revenue rollup; its share of the day appears as overhead. ' + ohRateNote + '</p>';
          return html;
        }
        function buildOverheadRateBody() {
          var d = overheadDecomp || {};
          var officeLabor = d.officeLabor90d || 0;
          var bidLabor = d.bidLabor90d || 0;
          var officeParts = d.officeParts90d || 0;
          var fieldHours = d.fieldHours90d || 0;
          var fieldLaborUsd = d.fieldLaborUsd90d || 0;
          var invoices = d.invoices90d || 0;
          var totalOverhead = officeLabor + bidLabor + officeParts;
          var ratePerHour = d.ratePerHour;
          var ratePerLaborDollar = d.ratePerLaborDollar;
          var ratePerRevenueDecimal = d.ratePerRevenueDecimal;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Rolling 90-day overhead rate. Method A is <strong>$ per field hour</strong>: it spreads the overhead pool (office labor, bid labor, office parts) over the hours that actually produce billable field work. The Team Summary applies this rate against <code>all hours &times; rate</code> when deducting overhead from each person in the &ldquo;Profit (after overhead)&rdquo; column &mdash; office and bid hours fund the pool but are still charged the per-hour overhead so every hour the person worked reflects its full share of the overhead burden.</div>';
          if (d.windowStart && d.windowEnd) {
            html += '<div style="margin-bottom:0.25rem;"><strong>Window:</strong> ' + escH(d.windowStart) + ' &rarr; ' + escH(d.windowEnd) + '</div>';
          }
          html += '<div style="font-size:1.05rem;"><strong>Rate:</strong> ' + (ratePerHour == null ? '<span style="color:#9ca3af;">unavailable</span>' : '$' + Number(ratePerHour).toFixed(2) + ' per field hour') + '</div>';
          html += '</div>';
          html += '<h3>Numerator &mdash; overhead $ pool (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Component</th><th class="num">$ (90d)</th><th class="num">Share</th></tr></thead><tbody>';
          var components = [
            { label: 'Office labor (approved clock to office job)', value: officeLabor },
            { label: 'Bid labor (approved clock to any bid)', value: bidLabor },
            { label: 'Office parts (Tally on office job)', value: officeParts }
          ];
          for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var share = totalOverhead > 0 ? (c.value / totalOverhead) * 100 : 0;
            html += '<tr><td>' + escH(c.label) + '</td><td class="num">' + fmtMoney(c.value) + '</td><td class="num">' + (totalOverhead > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead</td><td class="num" style="font-weight:600;">' + fmtMoney(totalOverhead) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>Denominator &mdash; field labor (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Measure</th><th class="num">Value</th></tr></thead><tbody>';
          html += '<tr><td>Field hours (approved clock on non-office, non-bid jobs)</td><td class="num">' + fmtH(fieldHours) + ' hrs</td></tr>';
          html += '<tr><td>Field labor $ (same sessions &times; wage)</td><td class="num">' + fmtMoney(fieldLaborUsd) + '</td></tr>';
          html += '</tbody></table>';
          html += '<h3>Resulting rates</h3>';
          html += '<table>';
          html += '<thead><tr><th>Rate</th><th class="num">Value</th><th>How it is used</th></tr></thead><tbody>';
          html += '<tr><td>Method A &mdash; per field hour</td><td class="num">' + (ratePerHour == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerHour).toFixed(2) + '/hr') + '</td><td>Used to deduct overhead in the Team Summary: Profit after overhead = Net &minus; <strong>all hours</strong> &times; rate. Every hour the person worked (field + office + bid) is charged the per-hour overhead.</td></tr>';
          html += '<tr><td>Method B &mdash; per field labor $</td><td class="num">' + (ratePerLaborDollar == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerLaborDollar).toFixed(2) + ' / $1 labor') + '</td><td>Reference only: ratio of overhead pool to field labor dollars.</td></tr>';
          html += '<tr><td>Method C &mdash; per revenue $ (invoices sent)</td><td class="num">' + (ratePerRevenueDecimal == null ? '<span style="color:#9ca3af;">&mdash;</span>' : (Number(ratePerRevenueDecimal) * 100).toFixed(1) + '% of revenue') + '</td><td>Reference only: invoices sent in window = ' + fmtMoney(invoices) + '.</td></tr>';
          html += '</tbody></table>';
          html += '<p class="caption">Method A is the headline rate. Sessions used: approved, not revoked, not rejected, with a clock-out. Wages come from <code>people_pay_config.hourly_wage</code>. Office job is the one configured in People &rarr; Overhead settings.</p>';
          return html;
        }
        // Track which cell opened the modal so we can return focus to it on close
        // (keyboard a11y: never trap focus, never lose the trigger after closing).
        var lastFocusedTrigger = null;
        // Embedded-parent only: used by team-summary-modal-open/close so the
        // popup window doesn't accidentally toggle the embedded iframe's
        // refresh guard via its own opener. Day-editor dispatch goes through
        // postBridge() below, which DOES post to opener in popup mode.
        function postParent(type){
          if (window.parent === window) return;
          try { parent.postMessage({ type: type }, '*'); } catch(e) {}
        }
        // Popup-only build: no live bridge back to the React app exists
        // any more (the inline path renders via <TeamSummaryInline> and
        // talks to the parent directly without postMessage). Returning
        // null here makes nameToggleableForRender()/hasBridge below
        // resolve to false, so the popup renders name cells + Hours-day
        // headers as static text — appropriate for a "Open in new window"
        // surface whose job is print/share, not further interaction.
        function bridgeTarget(){
          return null;
        }
        function postBridge(type, payload){
          var bt = bridgeTarget();
          if (!bt) return null;
          var msg = { type: type };
          if (payload) {
            for (var k in payload) {
              if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k];
            }
          }
          try { bt.win.postMessage(msg, '*'); } catch(e) {}
          return bt;
        }
        // Day-header click bridge (Hours breakdown -> DashboardMyTimeDayEditorModal).
        // Delegated from document so it survives openModal() innerHTML resets;
        // no per-render re-attachment needed.
        function isDayLinkEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'open-day-editor');
        }
        // Name-cell toggle bridge (Team Summary row -> per-person detail panel
        // in the parent React app). Optimistically mutates selectedPersonName
        // and re-renders the table so the highlight feels instant; the parent
        // listener updates selectedReviewPersonIndex on its end.
        function isPersonToggleEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'toggle-person');
        }
        function dispatchDayEditorFromEl(el){
          var person = el.getAttribute('data-person') || '';
          var dateStr = el.getAttribute('data-date') || '';
          if (!person || !dateStr) return;
          var bt = postBridge('team-summary-open-day-editor', { personName: person, workDate: dateStr });
          if (!bt) return;
          // Popup: bring the original tab forward so the user sees the modal
          // mount on the People page they opened the summary from.
          if (bt.kind === 'opener') {
            try { bt.win.focus(); } catch(e) {}
          }
        }
        function dispatchPersonToggleFromEl(el){
          var person = el.getAttribute('data-person') || '';
          if (!person) return;
          // Toggle off when clicking the already-expanded row; matches the
          // parent's reducer so we and the parent never diverge.
          selectedPersonName = (selectedPersonName === person) ? null : person;
          renderTable();
          postBridge('team-summary-select-person', { personName: person });
        }
        document.addEventListener('click', function(e){
          var t = e.target;
          // Walk up a few levels in case the click landed on an inner <span>.
          for (var i = 0; i < 4 && t; i++) {
            if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
            if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
            t = t.parentNode;
          }
        });
        document.addEventListener('keydown', function(e){
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          var t = document.activeElement;
          if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
          if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
        });
        // Parent -> iframe: re-open the Hours drilldown for a specific person
        // after the editor saves and the Team Summary re-renders with fresh
        // numbers. The parent stashes personName in a ref and posts this
        // message from the iframe's onLoad once the new srcDoc has painted.
        window.addEventListener('message', function(e){
          var d = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type !== 'team-summary-open-hours-drilldown') return;
          var pn = typeof d.personName === 'string' ? d.personName : '';
          if (!pn) return;
          var idx = -1;
          for (var i = 0; i < breakdowns.length; i++) {
            if (breakdowns[i].name === pn) { idx = i; break; }
          }
          if (idx >= 0) openModal(idx, 'hours');
        });
        // True when this window can reach the parent app to mount the editor
        // (embedded iframe -> parent, popup -> opener). Day headers in the
        // Hours breakdown render as <button> when true, plain <div> otherwise
        // (so a popup whose opener was already closed stays inert).
        var hasBridge = !!bridgeTarget();
        function openModal(idx, type) {
          var entry = breakdowns[idx];
          if (!entry && type !== 'overhead_rate') return;
          var title = '';
          var body = '';
          if (type === 'hours') {
            // v2.547 -- running total moved into the title (e.g. "Hours
            // breakdown -- Abraham . 50.8 hrs"); the redundant Total: N hrs
            // line is dropped from buildHoursBody so the value appears once.
            title = 'Hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.hb.totals.totalHours) + ' hrs';
            body = buildHoursBody(entry.hb, { personName: entry.name, clickableDay: hasBridge });
          } else if (type === 'overhead_hours') {
            // v2.547 -- running total moved into the title (matches Hours
            // breakdown), and the per-bucket totals move into the Office /
            // Bids section headers (see buildOverheadHoursBody).
            var ohTotalHrs = (entry.officeHours || 0) + (entry.bidHours || 0);
            title = 'Overhead hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(ohTotalHrs) + ' hrs';
            body = buildOverheadHoursBody(entry);
          } else if (type === 'field_hours') {
            // v2.547 -- field-hrs running total moved into the title to match
            // the Hours / Overhead-hours modals.
            title = 'Field hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.fieldHours || 0) + ' hrs';
            body = buildFieldHoursBody(entry);
          } else if (type === 'overhead_labor') {
            // Append the hourly_wage to the title so reviewers see the
            // rate driving the cost column without opening the modal.
            // Matches TeamSummaryInline.drilldownTitleFor.
            var olWage = entry.hourlyWage || 0;
            var olWageSuffix = olWage > 0
              ? ' \\u00b7 $' + olWage.toFixed(2) + '/hr'
              : ' \\u00b7 no wage configured';
            title = 'Overhead labor breakdown \\u2014 ' + entry.name + olWageSuffix;
            body = buildOverheadLaborBody(entry);
          } else if (type === 'gross') {
            // v2.547 -- running total moved into the title to match Hours /
            // Overhead-hours / Field-hours modals; redundant Total line removed
            // from buildGrossBody.
            title = 'Gross Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.gb && entry.gb.total) || 0);
            body = buildGrossBody(entry.gb);
          } else if (type === 'net') {
            title = 'Net Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.nb && entry.nb.total) || 0);
            body = buildNetBody(entry.nb);
          } else if (type === 'profit') {
            title = 'Profit (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitBody(entry.pb);
          } else if (type === 'rev_per_hr') {
            title = 'Gross Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildGrossPerHourBody(entry);
          } else if (type === 'net_per_hr') {
            title = 'Net Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildNetPerHourBody(entry);
          } else if (type === 'profit_per_hr') {
            title = 'Profit/hr (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitPerHourBody(entry);
          } else if (type === 'overhead_rate') {
            title = 'Overhead rate decomposition (rolling 90 days)';
            body = buildOverheadRateBody();
          } else {
            return;
          }
          document.getElementById('modal-title').textContent = title;
          document.getElementById('modal-body').innerHTML = body;
          document.getElementById('modal-backdrop').classList.add('open');
          document.getElementById('modal').classList.add('open');
          lastFocusedTrigger = (document.activeElement && typeof document.activeElement.focus === 'function') ? document.activeElement : null;
          var closeBtn = document.getElementById('modal-close');
          if (closeBtn) try { closeBtn.focus(); } catch(e) {}
          postParent('team-summary-modal-open');
        }
        function closeModal() {
          var wasOpen = document.getElementById('modal').classList.contains('open');
          document.getElementById('modal-backdrop').classList.remove('open');
          document.getElementById('modal').classList.remove('open');
          // Defensive cleanup: if user closes the modal while it was in
          // print mode (e.g. they cancelled the print dialog and the
          // browser didn't fire afterprint), strip the body class so the
          // screen view doesn't look broken.
          document.body.classList.remove('printing-modal');
          if (wasOpen) {
            if (lastFocusedTrigger) {
              try { lastFocusedTrigger.focus(); } catch(e) {}
            }
            lastFocusedTrigger = null;
            postParent('team-summary-modal-close');
          }
        }
        // ---- Header sort / search wiring ----
        var ths = document.querySelectorAll('th[data-sort]');
        for (var t = 0; t < ths.length; t++) {
          (function(th){
            function toggleSort(){
              var key = th.getAttribute('data-sort');
              if (!key) return;
              if (key === sortKey) {
                sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
              } else {
                sortKey = key;
                // Sensible default direction by column type: text asc, numbers desc.
                sortDir = (key === 'name') ? 'asc' : 'desc';
              }
              renderTable();
            }
            th.addEventListener('click', toggleSort);
            th.addEventListener('keydown', function(e){
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                toggleSort();
              }
            });
          })(ths[t]);
        }
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.addEventListener('input', function(e){
            searchQuery = e.target.value || '';
            renderTable();
          });
        }
        var resetSortBtn = document.getElementById('reset-sort');
        if (resetSortBtn) {
          resetSortBtn.addEventListener('click', function(){
            sortKey = 'profitAfterOverhead';
            sortDir = 'desc';
            renderTable();
          });
        }
        var overheadMetaBtn = document.getElementById('overhead-meta-btn');
        if (overheadMetaBtn) {
          overheadMetaBtn.addEventListener('click', function(){ openModal(-1, 'overhead_rate'); });
        }
        document.getElementById('modal-backdrop').addEventListener('click', closeModal);
        document.getElementById('modal-close').addEventListener('click', closeModal);
        // Modal-only print: add a body class so @media print rules in <style>
        // hide everything except .modal, then call window.print(). The
        // afterprint event removes the class so the screen view comes back
        // identical to before (works in Chrome / Firefox / Safari; older
        // browsers without afterprint just keep the class until the next
        // closeModal, which clears it via the cleanup below).
        var modalPrintBtn = document.getElementById('modal-print');
        function clearPrintingModalClass(){
          document.body.classList.remove('printing-modal');
        }
        if (modalPrintBtn) {
          modalPrintBtn.addEventListener('click', function(){
            document.body.classList.add('printing-modal');
            function onAfterPrint(){
              clearPrintingModalClass();
              window.removeEventListener('afterprint', onAfterPrint);
            }
            window.addEventListener('afterprint', onAfterPrint);
            try { window.print(); } catch (e) { clearPrintingModalClass(); }
          });
        }
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { clearPrintingModalClass(); closeModal(); } });
        // Initial paint.
        renderTable();
      })();</script>
      ${embeddedResizeScript}
    </body></html>`
          // Popup-only render — the inline path was already handled
          // above (see `if (isEmbedded) { … setTeamSummaryRows(rows); return }`).
          if (win) {
            win.document.open()
            win.document.write(html)
            win.document.close()
            win.focus()
          }
        } catch (writeErr) {
          console.error('Team Summary write error:', writeErr)
          showToast('Failed to display Team Summary. The window may have been closed.', 'error')
        }
      })
      .catch((err) => {
        if (isEmbedded && reqId !== teamSummaryReqIdRef.current) return
        console.error('Team Summary load error:', err)
        const errMsg = err instanceof Error ? err.message : 'Failed to load Team Summary'
        if (isEmbedded) {
          setTeamSummaryError(errMsg)
          setTeamSummaryLoading(false)
        } else if (win) {
          showToast(errMsg, 'error')
          try {
            win.document.open()
            win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary - Error</title></head><body style="font-family:sans-serif;margin:1in;"><h1>Error</h1><p>${String(errMsg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></body></html>`)
            win.document.close()
          } catch {
            win.close()
          }
        }
      })
  }

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

  const overheadLabor = useMemo(() => {
    const wageMap = buildOverheadWageLookup(
      Object.values(payConfig).map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
    )
    return buildOverheadDailyLabor({
      sessions: overheadSessions,
      officeJobLedgerId: overheadOfficeJobLedgerId,
      wageByNormalizedName: wageMap,
    })
  }, [payConfig, overheadSessions, overheadOfficeJobLedgerId])

  const overheadOtherJobsLabor = useMemo(() => {
    const wageMap = buildOverheadWageLookup(
      Object.values(payConfig).map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
    )
    return buildOtherJobsLaborByDay({
      sessions: overheadOtherJobsSessions,
      officeJobLedgerId: overheadOfficeJobLedgerId,
      wageByNormalizedName: wageMap,
    })
  }, [payConfig, overheadOtherJobsSessions, overheadOfficeJobLedgerId])

  const overheadMergedByDay = useMemo(
    () =>
      mergeOverheadDayTableRows(
        overheadLabor.byDay,
        overheadOfficePartsUsdByDay,
        overheadOtherJobsLabor.laborUsdByDay,
        overheadOtherJobsLabor.laborHoursByDay,
        overheadOtherJobsPartsUsdByDay,
      ),
    [
      overheadLabor.byDay,
      overheadOfficePartsUsdByDay,
      overheadOtherJobsLabor.laborUsdByDay,
      overheadOtherJobsLabor.laborHoursByDay,
      overheadOtherJobsPartsUsdByDay,
    ],
  )

  /**
   * Period totals across every visible row of the Overhead tab table.
   * Renders as a single bold `<tfoot>` row so the user can see the
   * range-wide sums without exporting / eyeballing daily columns. The
   * footer Overhead % is a period-aggregated ratio (sum office total
   * $ ÷ sum field total $) — not an average of daily percentages —
   * which is the weighted-correct way to express "what share of field
   * revenue went to overhead across the whole window."
   */
  const overheadTableTotals = useMemo(() => {
    let bidLaborUsd = 0
    let officeLaborUsd = 0
    let officePartsUsd = 0
    let totalUsd = 0
    let totalLaborHours = 0
    let otherJobsUsd = 0
    let otherJobsLaborHours = 0
    for (const row of overheadMergedByDay) {
      bidLaborUsd += row.bidLaborUsd
      officeLaborUsd += row.officeLaborUsd
      officePartsUsd += row.officePartsUsd
      totalUsd += row.totalUsd
      totalLaborHours += row.totalLaborHours
      otherJobsUsd += row.otherJobsUsd
      otherJobsLaborHours += row.otherJobsLaborHours
    }
    return {
      bidLaborUsd,
      officeLaborUsd,
      officePartsUsd,
      totalUsd,
      totalLaborHours,
      otherJobsUsd,
      otherJobsLaborHours,
    }
  }, [overheadMergedByDay])

  const overheadTableColCount = overheadTableSimpleView ? 4 : 7

  const overheadBreakdownModalModel = useMemo(() => {
    if (!overheadBreakdownModal) return null
    const { workDate, scope } = overheadBreakdownModal
    const dayLines = overheadLabor.detailByDay.get(workDate) ?? []
    const totalPartsUsd = overheadOfficePartsUsdByDay.get(workDate) ?? 0
    const sortedPartLines = [...(overheadOfficePartsDetailByDay.get(workDate) ?? [])].sort((a, b) =>
      `${a.source} ${a.sortKey}`.localeCompare(`${b.source} ${b.sortKey}`),
    )

    if (scope === 'officeParts') {
      return {
        workDate,
        scope,
        title: 'Office parts ($)',
        totalPartsUsd,
        sortedPartLines,
      } as const
    }

    if (scope === 'otherJobs') {
      const laborLines = overheadOtherJobsLabor.detailByDay.get(workDate) ?? []
      const totalLaborUsdOj = laborLines.reduce((s, l) => s + l.laborUsd, 0)
      const totalHoursOj = laborLines.reduce((s, l) => s + l.hours, 0)
      const sortedSessionsOj = [...laborLines].sort((a, b) =>
        `${a.userName} ${a.sessionId}`.localeCompare(`${b.userName} ${b.sessionId}`),
      )
      const sortedPartLinesOj = [...(overheadOtherJobsPartsDetailByDay.get(workDate) ?? [])].sort((a, b) =>
        `${a.source} ${a.sortKey}`.localeCompare(`${b.source} ${b.sortKey}`),
      )
      // Internal Transfers are not an expense. Recompute the Materials total
      // from bucketed sections so the modal header (and Combined) match the
      // breakdown shown below — even if legacy data has Internal-Transfer-
      // labeled splits feeding the upstream RPC total.
      const partsSectionsOj = bucketOverheadPartsLinesByAccountingLabel(
        sortedPartLinesOj,
        overheadOtherJobsAccountingBucketByTxId,
      )
      const totalPartsUsdOj = sumMaterialsTotalUsdExcludingInternalTransfer(partsSectionsOj)
      const internalTransferUsdOj =
        partsSectionsOj.find((s) => s.key === 'internal_transfer')?.totalUsd ?? 0
      const grandTotalUsdOj = totalLaborUsdOj + totalPartsUsdOj
      return {
        workDate,
        scope,
        title: 'Field Total ($) / Hours',
        totalHours: totalHoursOj,
        totalLaborUsd: totalLaborUsdOj,
        totalPartsUsd: totalPartsUsdOj,
        internalTransferUsd: internalTransferUsdOj,
        grandTotalUsd: grandTotalUsdOj,
        personRows: aggregateOtherJobsLaborByPerson(laborLines),
        sortedSessions: sortedSessionsOj,
        sortedPartLines: sortedPartLinesOj,
        partsSections: partsSectionsOj,
      } as const
    }

    const filtered = filterOverheadDetailLines(dayLines, scope)
    const totalHours = filtered.reduce((s, l) => s + l.hours, 0)
    const totalLaborUsd = filtered.reduce((s, l) => s + l.laborUsd, 0)
    const sortedSessions = [...filtered].sort((a, b) =>
      `${a.userName} ${a.sessionId}`.localeCompare(`${b.userName} ${b.sessionId}`),
    )

    if (scope === 'total') {
      const grandTotalUsd = totalLaborUsd + totalPartsUsd
      return {
        workDate,
        scope,
        title: 'Office total ($) / Hours',
        totalHours,
        totalLaborUsd,
        totalPartsUsd,
        grandTotalUsd,
        personTotal: aggregateOverheadDetailByPersonTotalScope(dayLines),
        sortedSessions,
        sortedPartLines,
      } as const
    }
    return {
      workDate,
      scope,
      title: scope === 'office' ? 'Office labor ($)' : 'Bid labor ($)',
      totalHours,
      totalLaborUsd,
      personRows: aggregateOverheadDetailByPerson(filtered),
      sortedSessions,
    } as const
  }, [
    overheadBreakdownModal,
    overheadLabor,
    overheadOfficePartsUsdByDay,
    overheadOfficePartsDetailByDay,
    overheadOtherJobsLabor,
    overheadOtherJobsPartsUsdByDay,
    overheadOtherJobsPartsDetailByDay,
    overheadOtherJobsAccountingBucketByTxId,
  ])

  const overheadValueCellButtonStyle: CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#2563eb',
    textDecoration: 'underline',
    padding: 0,
    font: 'inherit',
    textAlign: 'center',
  }

  function shiftOverheadWeek(deltaWeeks: number) {
    const s = new Date(overheadDateStart + 'T12:00:00')
    const e = new Date(overheadDateEnd + 'T12:00:00')
    s.setDate(s.getDate() + deltaWeeks * 7)
    e.setDate(e.getDate() + deltaWeeks * 7)
    setOverheadDateStart(s.toLocaleDateString('en-CA'))
    setOverheadDateEnd(e.toLocaleDateString('en-CA'))
  }

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

      {activeTab === 'overhead' && canAccessOverheadTab ? (
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.75rem 1.25rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                background: '#fafafa',
                fontSize: '0.875rem',
                flex: '1 1 auto',
              }}
              title="Trailing-window average overhead cost per calendar day. Recent days (last few) may underreport because clock sessions need approval before they count."
              aria-label="Average daily cost of overhead"
            >
              <strong style={{ color: '#111827' }}>Average daily cost of overhead</strong>
              {(() => {
                const fmt = (v: number | null) => {
                  if (overheadAvgDailyCost.loading) return '…'
                  if (v == null) return '—'
                  return `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                }
                return (
                  <>
                    <span><span style={{ color: '#6b7280' }}>7-day:</span> {fmt(overheadAvgDailyCost.avg7)}</span>
                    <span><span style={{ color: '#6b7280' }}>30-day:</span> {fmt(overheadAvgDailyCost.avg30)}</span>
                    <span><span style={{ color: '#6b7280' }}>90-day:</span> {fmt(overheadAvgDailyCost.avg90)}</span>
                  </>
                )
              })()}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.75rem 1.25rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                background: '#fafafa',
                fontSize: '0.875rem',
                flex: '1 1 auto',
              }}
              title="For each window: total Office Total ($) divided by total revenue billed (jobs_ledger_invoices.amount with sent_to_customer_at in window), expressed as dollars of overhead per $100 of revenue. Returns — when revenue is $0 in the window."
              aria-label="Average overhead per $100 in revenue"
            >
              <strong style={{ color: '#111827' }}>Average overhead per $100 in revenue</strong>
              {(() => {
                const fmt = (v: number | null) => {
                  if (overheadAvgDailyCost.loading) return '…'
                  if (v == null) return '—'
                  return `$${v.toFixed(2)}`
                }
                return (
                  <>
                    <span><span style={{ color: '#6b7280' }}>7-day:</span> {fmt(overheadAvgDailyCost.per100_7)}</span>
                    <span><span style={{ color: '#6b7280' }}>30-day:</span> {fmt(overheadAvgDailyCost.per100_30)}</span>
                    <span><span style={{ color: '#6b7280' }}>90-day:</span> {fmt(overheadAvgDailyCost.per100_90)}</span>
                  </>
                )
              })()}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', flex: '1 1 auto' }}>
            <button
              type="button"
              onClick={() => shiftOverheadWeek(-1)}
              style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
            >
              Previous week
            </button>
            <button
              type="button"
              onClick={() => shiftOverheadWeek(1)}
              style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
            >
              Next week
            </button>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280', alignSelf: 'center' }}>View:</span>
            <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
              <button
                type="button"
                aria-pressed={!overheadTableSimpleView}
                aria-label="Advanced table view: show Bid, Office labor, and Office parts columns"
                onClick={() => {
                  setOverheadTableSimpleView(false)
                  writeOverheadTableSimpleViewToStorage(false)
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none',
                  background: !overheadTableSimpleView ? '#2563eb' : 'white',
                  color: !overheadTableSimpleView ? 'white' : '#111827',
                  cursor: 'pointer',
                  fontWeight: !overheadTableSimpleView ? 600 : 400,
                }}
              >
                Advanced
              </button>
              <button
                type="button"
                aria-pressed={overheadTableSimpleView}
                aria-label="Simple table view: hide labor and parts detail columns; totals unchanged"
                onClick={() => {
                  setOverheadTableSimpleView(true)
                  writeOverheadTableSimpleViewToStorage(true)
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0 4px 4px 0',
                  background: overheadTableSimpleView ? '#2563eb' : 'white',
                  color: overheadTableSimpleView ? 'white' : '#111827',
                  cursor: 'pointer',
                  fontWeight: overheadTableSimpleView ? 600 : 400,
                }}
              >
                Simple
              </button>
            </div>
            <label style={{ fontSize: '0.875rem' }}>
              <span style={{ marginRight: '0.35rem' }}>Start</span>
              <input
                type="date"
                value={overheadDateStart}
                onChange={(e) => setOverheadDateStart(e.target.value)}
                style={{ padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            <label style={{ fontSize: '0.875rem' }}>
              <span style={{ marginRight: '0.35rem' }}>End</span>
              <input
                type="date"
                value={overheadDateEnd}
                onChange={(e) => setOverheadDateEnd(e.target.value)}
                style={{ padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            </div>
            <button
              type="button"
              onClick={() => setOverheadOfficeJobModalOpen(true)}
              style={{
                marginLeft: 'auto',
                padding: '0.45rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fafafa',
                cursor: 'pointer',
                textAlign: 'left',
                maxWidth: 'min(100%, 280px)',
              }}
            >
              <span style={{ display: 'block' }}>Overhead office job</span>
              {overheadSettingsLoading ? (
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#6b7280', marginTop: '0.15rem' }}>
                  Loading…
                </span>
              ) : overheadOfficeJobLedgerId && overheadOfficeJobLabel ? (
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#4b5563', marginTop: '0.15rem' }}>
                  {String(overheadOfficeJobLabel.hcp_number ?? '—')} — {overheadOfficeJobLabel.job_name ?? 'Job'}
                </span>
              ) : overheadOfficeJobLedgerId ? (
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#b91c1c', marginTop: '0.15rem' }}>
                  Saved job not found
                </span>
              ) : (
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#6b7280', marginTop: '0.15rem' }}>
                  Not configured
                </span>
              )}
            </button>
          </div>

          {overheadSessionsLoading ||
          overheadOfficePartsLoading ||
          overheadOtherJobsSessionsLoading ||
          overheadOtherJobsPartsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading overhead (sessions, office materials, field totals)…</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                    {!overheadTableSimpleView ? (
                      <>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Bid labor ($)</th>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Office labor ($)</th>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Office parts ($)</th>
                      </>
                    ) : null}
                    {overheadTableSimpleView ? (
                      <>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: '1px solid #d1d5db',
                          }}
                          title="Office Total ($) as a percentage of Field Total ($); — when field total is $0"
                        >
                          Overhead %
                        </th>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: '1px solid #d1d5db',
                          }}
                        >
                          Office Total ($) / Hours
                        </th>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: '1px solid #d1d5db',
                          }}
                        >
                          Field Total ($) / Hours
                        </th>
                      </>
                    ) : (
                      <>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          Office Total ($) / Hours
                        </th>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: '1px solid #d1d5db',
                          }}
                          title="Office Total ($) as a percentage of Field Total ($); — when field total is $0"
                        >
                          Overhead %
                        </th>
                        <th
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: '1px solid #d1d5db',
                          }}
                        >
                          Field Total ($) / Hours
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {overheadMergedByDay.length === 0 ? (
                    <tr>
                      <td colSpan={overheadTableColCount} style={{ padding: '0.75rem', color: '#6b7280' }}>
                        No rows in this range (no qualifying overhead or field-total activity for these dates).
                      </td>
                    </tr>
                  ) : (
                    overheadMergedByDay.map((row) => {
                      const overheadFactor = overheadFactorTotalOverOtherJobs(row.totalUsd, row.otherJobsUsd)
                      return (
                        <tr key={row.work_date}>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                              {formatOverheadTabWorkDateLabel(row.work_date)}
                            </td>
                            {!overheadTableSimpleView ? (
                              <>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                                  <button
                                    type="button"
                                    aria-label={`Bid labor breakdown for ${row.work_date}`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'bid' })}
                                    style={overheadValueCellButtonStyle}
                                  >
                                    {formatCurrency(row.bidLaborUsd)}
                                  </button>
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                                  <button
                                    type="button"
                                    aria-label={`Office labor breakdown for ${row.work_date}`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'office' })}
                                    style={overheadValueCellButtonStyle}
                                  >
                                    {formatCurrency(row.officeLaborUsd)}
                                  </button>
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                                  <button
                                    type="button"
                                    aria-label={`Office parts breakdown for ${row.work_date}`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'officeParts' })}
                                    style={overheadValueCellButtonStyle}
                                  >
                                    {formatCurrency(row.officePartsUsd)}
                                  </button>
                                </td>
                              </>
                            ) : null}
                            {overheadTableSimpleView ? (
                              <>
                                <td
                                  style={{
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #f3f4f6',
                                    borderLeft: '1px solid #d1d5db',
                                  }}
                                  aria-label={
                                    overheadFactor == null
                                      ? `Overhead % for ${row.work_date}: not available (field total dollars is zero)`
                                      : `Overhead % for ${row.work_date}: ${Math.round(overheadFactor * 100)} percent, office total divided by field total dollars`
                                  }
                                >
                                  {overheadFactor == null ? '—' : `${Math.round(overheadFactor * 100)}%`}
                                </td>
                                <td
                                  style={{
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #f3f4f6',
                                    borderLeft: '1px solid #d1d5db',
                                  }}
                                >
                                  <button
                                    type="button"
                                    aria-label={`Office total for ${row.work_date}: ${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'total' })}
                                    style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                                  >
                                    {formatCurrency(row.totalUsd)}
                                    <span style={{ fontWeight: 400 }}> · {row.totalLaborHours.toFixed(2)}h</span>
                                  </button>
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', borderLeft: '1px solid #d1d5db' }}>
                                  <button
                                    type="button"
                                    aria-label={`Field total for ${row.work_date}: ${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'otherJobs' })}
                                    style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                                  >
                                    {formatCurrency(row.otherJobsUsd)}
                                    <span style={{ fontWeight: 400 }}> · {row.otherJobsLaborHours.toFixed(2)}h</span>
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td
                                  style={{
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #f3f4f6',
                                  }}
                                >
                                  <button
                                    type="button"
                                    aria-label={`Office total for ${row.work_date}: ${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'total' })}
                                    style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                                  >
                                    {formatCurrency(row.totalUsd)}
                                    <span style={{ fontWeight: 400 }}> · {row.totalLaborHours.toFixed(2)}h</span>
                                  </button>
                                </td>
                                <td
                                  style={{
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #f3f4f6',
                                    borderLeft: '1px solid #d1d5db',
                                  }}
                                  aria-label={
                                    overheadFactor == null
                                      ? `Overhead % for ${row.work_date}: not available (field total dollars is zero)`
                                      : `Overhead % for ${row.work_date}: ${Math.round(overheadFactor * 100)} percent, office total divided by field total dollars`
                                  }
                                >
                                  {overheadFactor == null ? '—' : `${Math.round(overheadFactor * 100)}%`}
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', borderLeft: '1px solid #d1d5db' }}>
                                  <button
                                    type="button"
                                    aria-label={`Field total for ${row.work_date}: ${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
                                    onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'otherJobs' })}
                                    style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                                  >
                                    {formatCurrency(row.otherJobsUsd)}
                                    <span style={{ fontWeight: 400 }}> · {row.otherJobsLaborHours.toFixed(2)}h</span>
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                      )
                    })
                  )}
                </tbody>
                {overheadMergedByDay.length > 0 ? (
                  (() => {
                    // Period-aggregated Overhead % — sum of office totals
                    // divided by sum of field totals across the visible
                    // range. Re-uses the same helper that powers the per-
                    // day cell so null-handling (field total = $0) stays
                    // identical at the footer.
                    const totalOverheadFactor = overheadFactorTotalOverOtherJobs(
                      overheadTableTotals.totalUsd,
                      overheadTableTotals.otherJobsUsd,
                    )
                    const footerCellBase = {
                      padding: '0.5rem',
                      borderTop: '2px solid #d1d5db',
                      background: '#f9fafb',
                      fontWeight: 600,
                    } as const
                    return (
                      <tfoot>
                        <tr>
                          <td style={footerCellBase}>Total</td>
                          {!overheadTableSimpleView ? (
                            <>
                              <td style={footerCellBase}>
                                {formatCurrency(overheadTableTotals.bidLaborUsd)}
                              </td>
                              <td style={footerCellBase}>
                                {formatCurrency(overheadTableTotals.officeLaborUsd)}
                              </td>
                              <td style={footerCellBase}>
                                {formatCurrency(overheadTableTotals.officePartsUsd)}
                              </td>
                            </>
                          ) : null}
                          {overheadTableSimpleView ? (
                            <>
                              <td
                                style={{ ...footerCellBase, borderLeft: '1px solid #d1d5db' }}
                                aria-label={
                                  totalOverheadFactor == null
                                    ? 'Period total Overhead %: not available (field total dollars is zero)'
                                    : `Period total Overhead %: ${Math.round(
                                        totalOverheadFactor * 100,
                                      )} percent, total office total divided by total field total dollars`
                                }
                              >
                                {totalOverheadFactor == null
                                  ? '—'
                                  : `${Math.round(totalOverheadFactor * 100)}%`}
                              </td>
                              <td style={{ ...footerCellBase, borderLeft: '1px solid #d1d5db' }}>
                                {formatCurrency(overheadTableTotals.totalUsd)}
                                <span style={{ fontWeight: 400 }}>
                                  {' '}
                                  · {overheadTableTotals.totalLaborHours.toFixed(2)}h
                                </span>
                              </td>
                              <td style={{ ...footerCellBase, borderLeft: '1px solid #d1d5db' }}>
                                {formatCurrency(overheadTableTotals.otherJobsUsd)}
                                <span style={{ fontWeight: 400 }}>
                                  {' '}
                                  · {overheadTableTotals.otherJobsLaborHours.toFixed(2)}h
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={footerCellBase}>
                                {formatCurrency(overheadTableTotals.totalUsd)}
                                <span style={{ fontWeight: 400 }}>
                                  {' '}
                                  · {overheadTableTotals.totalLaborHours.toFixed(2)}h
                                </span>
                              </td>
                              <td
                                style={{ ...footerCellBase, borderLeft: '1px solid #d1d5db' }}
                                aria-label={
                                  totalOverheadFactor == null
                                    ? 'Period total Overhead %: not available (field total dollars is zero)'
                                    : `Period total Overhead %: ${Math.round(
                                        totalOverheadFactor * 100,
                                      )} percent, total office total divided by total field total dollars`
                                }
                              >
                                {totalOverheadFactor == null
                                  ? '—'
                                  : `${Math.round(totalOverheadFactor * 100)}%`}
                              </td>
                              <td style={{ ...footerCellBase, borderLeft: '1px solid #d1d5db' }}>
                                {formatCurrency(overheadTableTotals.otherJobsUsd)}
                                <span style={{ fontWeight: 400 }}>
                                  {' '}
                                  · {overheadTableTotals.otherJobsLaborHours.toFixed(2)}h
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      </tfoot>
                    )
                  })()
                ) : null}
              </table>
            </div>
          )}

          {overheadBreakdownModalModel ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="overhead-breakdown-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOverheadBreakdownModal(null)
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  maxWidth: 560,
                  width: '100%',
                  maxHeight: '85vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 id="overhead-breakdown-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                    {overheadBreakdownModalModel.title} — {overheadBreakdownModalModel.workDate}
                  </h2>
                  {overheadBreakdownModalModel.scope === 'officeParts' ? (
                    <>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#4b5563' }}>
                        Mercury allocations by <strong>posted date</strong> (company time zone), supply invoice shares by{' '}
                        <strong>invoice date</strong>, tally parts by <strong>entry date</strong>. Separate from labor; no dedupe across
                        sources.
                      </p>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                        Total: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                      </p>
                    </>
                  ) : overheadBreakdownModalModel.scope === 'total' ? (
                    <>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                        Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                        {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                        Office materials: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                      </p>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                        Total: {formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                      </p>
                    </>
                  ) : overheadBreakdownModalModel.scope === 'otherJobs' ? (
                    <>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                        Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                        {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                        Materials: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                      </p>
                      {overheadBreakdownModalModel.internalTransferUsd > 0 ? (
                        <p
                          style={{
                            margin: '0.15rem 0 0 0',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontStyle: 'italic',
                          }}
                          title="Movement between your own accounts; excluded from Materials."
                        >
                          Internal Transfers (excluded):{' '}
                          {formatCurrency(overheadBreakdownModalModel.internalTransferUsd)}
                        </p>
                      ) : null}
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                        Combined: {formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#4b5563' }}>
                        Approved, closed sessions in this category. Labor $ = hours × hourly wage from pay config.
                      </p>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                        Totals: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                        {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                      </p>
                    </>
                  )}
                </div>
                <div style={{ padding: '0.75rem 1rem', overflowY: 'auto', flex: 1 }}>
                  {overheadBreakdownModalModel.scope === 'officeParts' ? (
                    overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                      <p style={{ margin: 0, color: '#6b7280' }}>No materials lines for this date.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            <th style={{ textAlign: 'left', padding: '0.45rem' }}>Source</th>
                            <th style={{ textAlign: 'left', padding: '0.45rem' }}>Description</th>
                            <th style={{ textAlign: 'right', padding: '0.45rem' }}>Amount ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overheadBreakdownModalModel.sortedPartLines.map((ln) => (
                            <tr key={ln.sortKey} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.45rem' }}>
                                {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'}
                              </td>
                              <td style={{ padding: '0.45rem' }}>{ln.label}</td>
                              <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(ln.amountUsd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : overheadBreakdownModalModel.scope === 'total' ? (
                    <>
                      {overheadBreakdownModalModel.personTotal.length === 0 ? (
                        <p style={{ margin: '0 0 0.75rem 0', color: '#6b7280' }}>No labor sessions for this date.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Office ($)</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Bid ($)</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor total ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overheadBreakdownModalModel.personTotal.map((r) => (
                              <tr key={r.userName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.45rem' }}>
                                  {r.userName}
                                  {r.missingWage ? (
                                    <span style={{ color: '#b45309', fontSize: '0.75rem' }}>
                                      {' '}
                                      (no hourly wage for some sessions)
                                    </span>
                                  ) : null}
                                </td>
                                <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                                <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.officeLaborUsd)}</td>
                                <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.bidLaborUsd)}</td>
                                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>
                                  {formatCurrency(r.totalLaborUsd)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail (labor)</summary>
                        {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                          <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                        ) : (
                          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                            {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                              <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                                {ln.userName} — {ln.bucket === 'office' ? 'Office' : 'Bid'} — {ln.hours.toFixed(2)}h —{' '}
                                ${formatCurrency(ln.laborUsd)}
                                {ln.missingWage ? <span style={{ color: '#b45309' }}> (no hourly wage)</span> : null}
                                {ln.notes ? (
                                  <span style={{ color: '#6b7280' }}> | {ln.notes}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>

                      <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Materials (office job)</summary>
                        {overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                          <p style={{ margin: '0.5rem 0 0 0' }}>No materials lines for this date.</p>
                        ) : (
                          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                            {overheadBreakdownModalModel.sortedPartLines.map((ln) => {
                              // Mercury lines carry an optional debit-card UUID from the
                              // transaction's raw JSON. Resolve via nickname map; fall back
                              // to a compact hex preview ("abc...xyz") so the user can still
                              // tell *which* card was used even when no nickname is saved.
                              // Non-Mercury (supply / tally) lines and Mercury lines with no
                              // card (ACH / wire / check) render exactly as before.
                              const cardLabel =
                                ln.source === 'mercury' && ln.mercuryDebitCardId
                                  ? overheadMercuryNicknameByDebitCard[
                                      ln.mercuryDebitCardId.toLowerCase()
                                    ]?.trim() ||
                                    `card ${formatMercuryDebitCardIdCompact(ln.mercuryDebitCardId)}`
                                  : ''
                              return (
                                <li key={ln.sortKey} style={{ marginBottom: '0.25rem' }}>
                                  {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'} — {ln.label}
                                  {cardLabel ? (
                                    <span style={{ color: '#6b7280' }}> · on {cardLabel}</span>
                                  ) : null}
                                  {' — '}
                                  ${formatCurrency(ln.amountUsd)}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </details>

                      <div
                        style={{
                          marginTop: '1.25rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #e5e7eb',
                          fontSize: '0.8125rem',
                          color: '#6b7280',
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          <strong>Labor:</strong> approved, closed sessions — hours × pay config wage.
                        </p>
                        <p style={{ margin: '0.25rem 0 0 0' }}>
                          <strong>Materials:</strong> office job parts (same rules as <strong>Office parts ($)</strong> column).
                        </p>
                      </div>
                    </>
                  ) : overheadBreakdownModalModel.scope === 'otherJobs' ? (
                    <>
                      {overheadBreakdownModalModel.personRows.length === 0 ? (
                        <p style={{ margin: '0 0 0.75rem 0', color: '#6b7280' }}>No labor sessions for this date.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                              <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overheadBreakdownModalModel.personRows.map((r) => (
                              <tr key={r.userName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.45rem' }}>
                                  {r.userName}
                                  {r.missingWage ? (
                                    <span style={{ color: '#b45309', fontSize: '0.75rem' }}>
                                      {' '}
                                      (no hourly wage for some sessions)
                                    </span>
                                  ) : null}
                                </td>
                                <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>
                                  {formatCurrency(r.laborUsd)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail (labor)</summary>
                        {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                          <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                        ) : (
                          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                            {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                              <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                                {ln.userName} — {ln.hours.toFixed(2)}h — ${formatCurrency(ln.laborUsd)}
                                {ln.missingWage ? <span style={{ color: '#b45309' }}> (no hourly wage)</span> : null}
                                {ln.notes ? (
                                  <span style={{ color: '#6b7280' }}> | {ln.notes}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>

                      <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                          {overheadOfficeJobLedgerId ? 'Materials (field / non-office jobs)' : 'Materials (all jobs)'}
                        </summary>
                        {overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                          <p style={{ margin: '0.5rem 0 0 0' }}>No materials lines for this date.</p>
                        ) : (
                          <>
                            {overheadBreakdownModalModel.partsSections.map((section) => {
                              const isInternalTransfer = section.key === 'internal_transfer'
                              if (isInternalTransfer && section.lines.length === 0) return null
                              return (
                                <div
                                  key={section.key}
                                  style={{
                                    marginTop: '0.5rem',
                                    ...(isInternalTransfer
                                      ? {
                                          paddingLeft: '0.5rem',
                                          borderLeft: '3px solid #94a3b8',
                                          background: '#f8fafc',
                                        }
                                      : null),
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: '#374151',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'baseline',
                                      gap: '0.5rem',
                                    }}
                                  >
                                    <span>
                                      {section.label} ({section.lines.length})
                                      {isInternalTransfer ? (
                                        <span
                                          style={{
                                            marginLeft: '0.4rem',
                                            fontWeight: 500,
                                            color: '#64748b',
                                            fontStyle: 'italic',
                                            fontSize: '0.7rem',
                                          }}
                                        >
                                          (not counted in Materials)
                                        </span>
                                      ) : null}
                                    </span>
                                    <span style={{ fontWeight: 500, color: '#6b7280' }}>
                                      ${formatCurrency(section.totalUsd)}
                                    </span>
                                  </div>
                                  {section.lines.length === 0 ? (
                                    <p style={{ margin: '0.15rem 0 0 1.1rem', color: '#9ca3af' }}>None</p>
                                  ) : (
                                    <ul style={{ margin: '0.15rem 0 0 0', paddingLeft: '1.1rem' }}>
                                      {section.lines.map((ln) => (
                                        <li key={ln.sortKey} style={{ marginBottom: '0.25rem' }}>
                                          {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'} — {ln.label} —{' '}
                                          ${formatCurrency(ln.amountUsd)}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )
                            })}
                          </>
                        )}
                      </details>

                      <div
                        style={{
                          marginTop: '1.25rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #e5e7eb',
                          fontSize: '0.8125rem',
                          color: '#6b7280',
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          Not included in overhead <strong>Office Total ($)</strong>.
                        </p>
                        <p style={{ margin: '0.25rem 0 0 0' }}>
                          <strong>Labor:</strong> approved, closed clock time on{' '}
                          <strong>jobs ledger</strong> work other than the office overhead job when one is configured (bid-only
                          time remains in <strong>Bid labor ($)</strong> only).
                        </p>
                        <p style={{ margin: '0.25rem 0 0 0' }}>
                          <strong>Materials:</strong> Mercury, supply, and tally on those jobs — same dating rules as the office parts
                          column.
                        </p>
                      </div>
                    </>
                  ) : overheadBreakdownModalModel.personRows.length === 0 ? (
                    <p style={{ margin: 0, color: '#6b7280' }}>No sessions in this category for this date.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overheadBreakdownModalModel.personRows.map((r) => (
                          <tr key={r.userName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.45rem' }}>
                              {r.userName}
                              {r.missingWage ? (
                                <span style={{ color: '#b45309', fontSize: '0.75rem' }}> (no hourly wage)</span>
                              ) : null}
                            </td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.laborUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {overheadBreakdownModalModel.scope !== 'officeParts' &&
                  overheadBreakdownModalModel.scope !== 'total' &&
                  overheadBreakdownModalModel.scope !== 'otherJobs' ? (
                    <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail</summary>
                      {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                        <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                      ) : (
                        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                          {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                            <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                              {ln.userName} — {ln.bucket === 'office' ? 'Office' : 'Bid'} — {ln.hours.toFixed(2)}h —{' '}
                              ${formatCurrency(ln.laborUsd)}
                              {ln.missingWage ? <span style={{ color: '#b45309' }}> (no hourly wage)</span> : null}
                              {ln.notes ? (
                                <span style={{ color: '#6b7280' }}> | {ln.notes}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  ) : null}
                </div>
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setOverheadBreakdownModal(null)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {overheadOfficeJobModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="overhead-office-job-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOverheadOfficeJobModalOpen(false)
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  maxWidth: 560,
                  width: '100%',
                  maxHeight: '85vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 id="overhead-office-job-modal-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                    Overhead office job
                  </h2>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                    Which job counts as office overhead for clock time and materials in this table.
                  </p>
                </div>
                <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.45 }}>
                    Daily labor overhead from <strong>approved, closed</strong> clock sessions: time on the office job below,
                    and time on <strong>bids</strong>. If both job and bid are set on a session, the <strong>office job</strong>{' '}
                    wins. Amounts use session hours × <strong>hourly wage</strong> from People pay config (same name as clock
                    user). <strong>Office parts ($)</strong> sums materials on the office job (Mercury allocations by posted
                    date, supply invoice shares by invoice date, tally parts by entry date); these are separate from labor—no
                    automatic dedupe across sources.                     <strong>Office Total ($) / Hours</strong> shows overhead <strong>dollars</strong>{' '}
                    (labor plus office parts) and <strong>office + bid labor hours</strong> that day (materials add no hours).{' '}
                    <strong>Field Total ($) / Hours</strong> is separate: same column shows <strong>dollars</strong>{' '}
                    (jobs-ledger labor plus materials on those jobs) and <strong>jobs-ledger labor hours</strong> only (not
                    bid-only time; materials add no hours). Rules: Mercury / supply / tally as above. It is{' '}
                    <strong>not</strong> included in overhead <strong>Total ($)</strong>. <strong>Overhead %</strong> is{' '}
                    <strong>Office Total ($) ÷ Field Total ($) × 100</strong> that day (office total as a percent of field-total
                    dollars)—not margin; <strong>—</strong> when field total is $0.
                  </p>
                  {overheadSettingsLoading ? (
                    <p style={{ margin: 0, color: '#6b7280' }}>Loading setting…</p>
                  ) : overheadOfficeJobLedgerId ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                      {overheadOfficeJobLabel ? (
                        <Link
                          to={`/jobs?edit=${encodeURIComponent(overheadOfficeJobLedgerId)}`}
                          style={{ fontWeight: 600, color: '#2563eb' }}
                        >
                          {String(overheadOfficeJobLabel.hcp_number ?? '—')} — {overheadOfficeJobLabel.job_name ?? 'Job'}
                        </Link>
                      ) : (
                        <span style={{ color: '#b91c1c' }}>Saved job id not found — pick another.</span>
                      )}
                      {isDev ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setOverheadJobPickerOpen(true)}
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.8125rem',
                              borderRadius: 4,
                              border: '1px solid #d1d5db',
                              background: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            disabled={overheadJobSaving}
                            onClick={() => {
                              void (async () => {
                                setOverheadJobSaving(true)
                                try {
                                  await deleteOverheadOfficeJobLedgerIdSetting()
                                  setOverheadOfficeJobLedgerId(null)
                                  setOverheadOfficeJobLabel(null)
                                  showToast('Office job cleared', 'success')
                                } catch (e) {
                                  showToast(formatErrorMessage(e, 'Could not clear'), 'error')
                                } finally {
                                  setOverheadJobSaving(false)
                                }
                              })()
                            }}
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.8125rem',
                              borderRadius: 4,
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              cursor: 'pointer',
                              color: '#b91c1c',
                            }}
                          >
                            Clear
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                      <span style={{ color: '#6b7280' }}>No office job configured — bid overhead still shows.</span>{' '}
                      {isDev ? (
                        <button
                          type="button"
                          onClick={() => setOverheadJobPickerOpen(true)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.8125rem',
                            borderRadius: 4,
                            border: '1px solid #d1d5db',
                            background: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          Choose office job
                        </button>
                      ) : (
                        <span style={{ color: '#6b7280' }}> Ask a dev to configure the office job.</span>
                      )}
                    </p>
                  )}
                </div>
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setOverheadOfficeJobModalOpen(false)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {overheadJobPickerOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="overhead-job-picker-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 2010,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOverheadJobPickerOpen(false)
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  maxWidth: 480,
                  width: '100%',
                  maxHeight: '85vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 id="overhead-job-picker-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                    Choose office job
                  </h2>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                    Search and select one job to attribute office overhead clock time.
                  </p>
                </div>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <input
                    type="search"
                    value={overheadJobSearch}
                    onChange={(e) => setOverheadJobSearch(e.target.value)}
                    placeholder="Search jobs…"
                    aria-label="Search jobs"
                    autoFocus
                    style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
                  {overheadJobResults.length === 0 ? (
                    <p style={{ margin: '0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                      {overheadJobSearch.trim() ? 'No matches.' : 'Type to search.'}
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {overheadJobResults.map((j) => (
                        <li key={j.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <button
                            type="button"
                            disabled={overheadJobSaving}
                            onClick={() => {
                              void (async () => {
                                setOverheadJobSaving(true)
                                try {
                                  await upsertOverheadOfficeJobLedgerId(j.id)
                                  setOverheadOfficeJobLedgerId(j.id)
                                  setOverheadOfficeJobLabel({
                                    hcp_number: j.hcp_number ?? null,
                                    job_name: j.job_name ?? null,
                                  })
                                  setOverheadJobPickerOpen(false)
                                  showToast('Office job saved', 'success')
                                } catch (e) {
                                  showToast(formatErrorMessage(e, 'Could not save'), 'error')
                                } finally {
                                  setOverheadJobSaving(false)
                                }
                              })()
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.65rem 1rem',
                              border: 'none',
                              background: 'none',
                              cursor: overheadJobSaving ? 'wait' : 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{j.hcp_number ?? '—'}</span>
                            <span style={{ color: '#6b7280' }}> — {j.job_name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setOverheadJobPickerOpen(false)}
                    style={{ padding: '0.4rem 0.85rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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

      {activeTab === 'review' && isDev && (() => {
        // Lifted-out Team Summary meta — same data + click handler as
        // the inline render path, but rendered next to the controls
        // column (right column of the top two-column layout) instead
        // of stacked above the table. TeamSummaryInline.showInlineMeta
        // is set to false below so the meta isn't rendered twice.
        const reviewTeamSummaryRowCount = teamSummaryBreakdowns.length
        const reviewTeamSummaryNoun = reviewTeamSummaryRowCount === 1 ? 'person' : 'people'
        const reviewOverheadRate = reviewOverheadRates.ratePerHour
        const reviewOverheadLoading = reviewOverheadRates.loading
        const reviewOverheadMetaText = reviewOverheadLoading
          ? 'Overhead Method A: loading…'
          : reviewOverheadRate == null
            ? 'Overhead Method A: unavailable'
            : `Overhead Method A: $${reviewOverheadRate.toFixed(2)} per field hour (rolling 90-day rate)`
        const reviewOverheadMetaClickable = !reviewOverheadLoading && reviewOverheadRate != null
        return (
        <div>
          {/* Top section: Team Summary header info on the left (takes
              the flex space), period controls pushed to the right
              edge of the page. Wraps cleanly on narrow viewports.
              Bottom margin kept tight so the toolbar (Search /
              Reset / Print / Open in new window) sits visually
              close to the Overhead Method A meta line. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2rem',
              alignItems: 'flex-start',
              marginBottom: '0.5rem',
            }}
          >
            {showPeopleForReview.length > 0 && (
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.05rem', color: '#374151' }}>Team Summary</h2>
                {/* Reuse the same .team-summary-meta / .team-summary-meta-sub
                    CSS classes the inline render path uses — the stylesheet
                    is injected by TeamSummaryInline (mounted below) so the
                    rules apply once the table mounts. The info-button click
                    bridges back to the table via openOverheadRateDrilldown
                    on the imperative handle. */}
                <div className="team-summary-meta">
                  {getReviewPeriodLabel()} &middot; {reviewTeamSummaryRowCount} {reviewTeamSummaryNoun}
                </div>
                <div className="team-summary-meta-sub">
                  {reviewOverheadMetaClickable ? (
                    <button
                      type="button"
                      className="team-summary-meta-sub-btn"
                      title="Click for rate decomposition"
                      onClick={(e) =>
                        teamSummaryInlineRef.current?.openOverheadRateDrilldown(e.currentTarget)
                      }
                    >
                      {reviewOverheadMetaText} <span aria-hidden="true">&#9432;</span>
                    </button>
                  ) : (
                    reviewOverheadMetaText
                  )}
                </div>
              </div>
            )}

            {/* Period + filter controls pushed to the right edge.
                `marginLeft: auto` keeps them flush right even when
                the Team Summary header column is missing (empty
                roster) and the row would otherwise collapse. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select
                  value={reviewPeriod}
                  onChange={(e) => {
                    const next = e.target.value as ReviewPeriod
                    // Seed custom range with the current effective range when the
                    // user first switches to Custom — gives them somewhere sensible
                    // to start tweaking instead of empty inputs.
                    if (next === 'custom' && !reviewCustomRangeStart && !reviewCustomRangeEnd) {
                      const [seedStart, seedEnd] = getReviewDateRange()
                      setReviewCustomRangeStart(seedStart)
                      setReviewCustomRangeEnd(seedEnd)
                    }
                    setReviewPeriod(next)
                  }}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This week (running)</option>
                  <option value="last_week">Last week</option>
                  <option value="last_two_weeks">Last two weeks</option>
                  <option value="last_30_days">Last 30 days</option>
                  <option value="last_90_days">Last 90 days</option>
                  <option value="this_year">This year</option>
                  <option value="custom">Custom range…</option>
                </select>
                {reviewPeriod === 'custom' && (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    role="group"
                    aria-label="Custom date range"
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                      From
                      <input
                        type="date"
                        value={reviewCustomRangeStart}
                        onChange={(e) => setReviewCustomRangeStart(e.target.value)}
                        aria-label="Custom range start date"
                        max={reviewCustomRangeEnd || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                      To
                      <input
                        type="date"
                        value={reviewCustomRangeEnd}
                        onChange={(e) => setReviewCustomRangeEnd(e.target.value)}
                        aria-label="Custom range end date"
                        min={reviewCustomRangeStart || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    {(!reviewCustomRangeStart || !reviewCustomRangeEnd) && (
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                        Pick both dates to set the range.
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Filter checkbox sits on its own row below the period
                  dropdown so it has visual breathing room and reads
                  as a modifier on the selected period rather than an
                  inline option next to it. */}
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={reviewOnlyPaidInFull}
                    onChange={(e) => setReviewOnlyPaidInFull(e.target.checked)}
                  />
                  Only Count Jobs Marked Paid in Full
                </label>
              </div>
            </div>
          </div>

          {showPeopleForReview.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {teamSummaryError ? (
                <p style={{ color: '#b91c1c', padding: '0.75rem 1rem', margin: 0, border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2' }}>
                  {teamSummaryError}
                </p>
              ) : teamSummaryRows ? (
                <TeamSummaryInline
                  handleRef={teamSummaryInlineRef}
                  breakdowns={teamSummaryBreakdowns}
                  overheadRate={reviewOverheadRates.ratePerHour}
                  overheadRateLoading={reviewOverheadRates.loading}
                  overheadDecomp={teamSummaryOverheadDecomp}
                  periodLabel={getReviewPeriodLabel()}
                  selectedPersonName={teamSummarySelectedPersonName}
                  onTogglePerson={handleInlineTogglePerson}
                  onOpenDayEditor={handleInlineOpenDayEditor}
                  onDrilldownOpenChange={handleInlineDrilldownOpenChange}
                  refreshing={teamSummaryLoading}
                  showInlineMeta={false}
                  onOpenInNewWindow={() => openTeamSummaryWindow('popup')}
                />
              ) : (
                <div style={{ padding: '0.5rem 0', color: '#6b7280', fontSize: '0.85rem' }}>
                  {teamSummaryLoading ? 'Loading Team Summary…' : 'Team Summary will appear here.'}
                </div>
              )}
            </div>
          )}

          {showPeopleForReview.length === 0 ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>No people in pay config. Add people in People pay config (Hours tab) first.</p>
          ) : selectedReviewPersonIndex < 0 ? (
            // No one expanded yet — the Team Summary above acts as the
            // picker. Click a name to expand that person's panel here.
            null
          ) : reviewLoading ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {(() => {
                const personName = showPeopleForReview[selectedReviewPersonIndex]
                const cfg = personName ? payConfig[personName] : undefined
                const [start, end] = getReviewDateRange()
                const days = getDaysInRange(start, end)
                const getHoursForDay = (d: string) => {
                  if (!cfg) return 0
                  const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                  return cfg.is_salary
                    ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                    : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                }
                const totalHours = reviewOnlyPaidInFull
                  ? [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                  : days.reduce((s, d) => s + getHoursForDay(d), 0)
                const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                const totalProfit = reviewAllocatedProfit
                const revPerHour = totalHours > 0 ? totalRevenue / totalHours : 0
                const profitPerHour = totalHours > 0 ? totalProfit / totalHours : 0
                return (
                  <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '1rem', display: 'inline-grid', gridTemplateColumns: 'max-content max-content', rowGap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Gross Revenue this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Value Created) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Value Created' = job total bill × % progress — the gross revenue the job has earned to date. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Gross Revenue/hr' line."
                        aria-label="Gross Revenue earned this period, allocated by labor cost share"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{`$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Net Revenue (before overhead) this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Net Revenue before overhead) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Net Revenue (before overhead)' = Value Created − parts − subs − total field labor on the job, before deducting org-wide overhead. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Net Revenue on Job' line. To see overhead applied, expand any row and look at the Profit section (methods A/B/C)."
                        aria-label="Net Revenue (before overhead) this period, allocated by labor cost share"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{`$${Math.round(totalProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Profit (after overhead, Method A) this period:</span>
                      <span
                        title={(() => {
                          const r = reviewOverheadRates.ratePerHour
                          if (r == null) return "Profit (after overhead, Method A — per labor hour) = Net Revenue (before overhead) this period − (this user's hours in the period × overhead rate $/hr). 90-day overhead rate is loading or unavailable. Method A assumes overhead scales with TIME in the field; see the per-job Profit section for methods B (per $ revenue) and C (per direct labor $)."
                          return `Profit (after overhead, Method A — per labor hour) = Net Revenue (before overhead) this period − (this user's hours in the period × overhead rate $/hr). 90-day overhead rate: $${r.toFixed(2)}/hr. Method A assumes overhead scales with TIME in the field; see the per-job Profit section for methods B (per $ revenue) and C (per direct labor $).`
                        })()}
                        aria-label="Profit this period after deducting Method A overhead"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (reviewOverheadRates.loading) return '…'
                        const r = reviewOverheadRates.ratePerHour
                        if (r == null) return '—'
                        const profit = totalProfit - (totalHours * r)
                        return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                      })()}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Gross Revenue/hr:</span>
                      <span
                        title="Gross Revenue this period ÷ this user's hours in the period. Period equivalent of the per-job 'Gross Revenue/hr' line: each job's Value Created is allocated to the user by labor cost share, summed across the period, then averaged per hour worked."
                        aria-label="Gross Revenue per hour, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{totalHours > 0 ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Net Revenue/hr (before overhead):</span>
                      <span
                        title="Net Revenue (before overhead) this period ÷ this user's hours in the period. Period equivalent of the per-job 'Net Revenue/hr' line: each job's Net Revenue (before overhead) is allocated to the user by labor cost share, summed across the period, then averaged per hour worked. Does not deduct org-wide overhead."
                        aria-label="Net Revenue per hour before overhead, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{totalHours > 0 ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Profit/hr (after overhead, Method A):</span>
                      <span
                        title={(() => {
                          const r = reviewOverheadRates.ratePerHour
                          if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr (before overhead) − overhead rate $/hr. 90-day overhead rate is loading or unavailable. Method A assumes overhead scales with TIME in the field."
                          return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr (before overhead) − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr. Method A assumes overhead scales with TIME in the field; see the per-job Profit section for methods B (per $ revenue) and C (per direct labor $).`
                        })()}
                        aria-label="Profit per hour after Method A overhead, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (reviewOverheadRates.loading) return '…'
                        const r = reviewOverheadRates.ratePerHour
                        if (r == null || totalHours <= 0) return '—'
                        const v = profitPerHour - r
                        return <span style={{ color: v < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                      })()}</strong>
                    </div>
                  </div>
                )
              })()}
              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewJobsWorkedCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewJobsWorkedCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewJobsWorkedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Jobs Worked ({reviewLaborJobs.length + reviewCrewJobs.length})
                </h3>
                {reviewLaborJobs.length === 0 && reviewCrewJobs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No jobs in this period.</p>
                ) : (
                  <>
                    {reviewJobsWorkedCollapsed ? (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Labor / total job labor:</span>
                          <span style={{ fontWeight: 600 }}>{(() => {
                            const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                            const totalLaborByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) {
                                totalLaborByJob.set(j.job_id, j.totalLaborOnJob)
                              }
                            }
                            const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            return [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                          })()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Profit / Net Revenue (before overhead):</span>
                          {(() => {
                            const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                            const revenueBeforeOverheadByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) revenueBeforeOverheadByJob.set(j.job_id, j.revenueBeforeOverhead)
                            }
                            const totalRevBeforeOverhead = [...revenueBeforeOverheadByJob.values()].reduce((s, v) => s + v, 0)
                            const revenueStr = totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const revBeforeStr = totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [revenueStr, revBeforeStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600, color: totalRevenue < 0 ? '#b91c1c' : undefined }}>{text}</span>
                          })()}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Revenue / Value Created:</span>
                          {(() => {
                            const totalThisValue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                            const totalValueByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) totalValueByJob.set(j.job_id, j.valueCreated)
                            }
                            const totalValue = [...totalValueByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisValue > 0 ? `$${Math.round(totalThisValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalValue > 0 ? `$${Math.round(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600 }}>{text}</span>
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>HCP #</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>Date</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>Job Name</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>Job Address</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="dollars this person earned on this day for this job"
                                  aria-label="dollars this person earned on this day for this job"
                                >
                                  This Labor
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime labor cost on the whole job by everyone, including this person"
                                  aria-label="lifetime labor cost on the whole job by everyone, including this person"
                                >
                                  total job labor
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                  aria-label="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                >
                                  This Profit
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                  aria-label="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                >
                                  Net Revenue (before overhead)
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                  aria-label="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                >
                                  This Revenue
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="the whole job's value created: total bill × % complete (treated as 100% when the ledger has no value set)"
                                  aria-label="the whole job's value created: total bill times percent complete"
                                >
                                  Value Created
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="Revenue/hr is your share of the job's earned revenue divided by your hours on this row. Profit/hr is your share of the job's profit divided by your hours on this row. Both shares are allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job."
                                  aria-label="Revenue per hour and profit per hour"
                                >
                                  Revenue/hr
                                </div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>
                                  Profit/hr
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewLaborJobs.map((j) => {
                              const key = `labor-${j.id}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div>$<strong>{Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{(j.job_number ?? '').trim() ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.job_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.job_id && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (!j.job_id || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = j.job_number
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'labor',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.job_id && j.totalLaborOnJob > 0 ? 'See everyone who contributed labor to this job' : undefined}
                                    >
                                      <div style={{ fontWeight: 600 }}>{(() => {
                                        if (j.laborCost <= 0) return '—'
                                        const dollars = `$${Math.round(j.laborCost).toLocaleString('en-US')}`
                                        const hrs = formatHrsLabel(j.hours)
                                        return hrs ? `${dollars} / ${hrs}` : dollars
                                      })()}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.totalLaborOnJob === 0) return '—'
                                        const pct = Math.round((j.laborCost / j.totalLaborOnJob) * 100)
                                        return `${pct}% of $${Math.round(j.totalLaborOnJob).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.job_id && j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (!j.job_id || j.revenueBeforeOverhead === 0 || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = j.job_number
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'profit',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.job_id && j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? "See everyone's profit share on this job" : undefined}
                                    >
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${Math.round(j.revenueBeforeOverhead).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? '#b91c1c' : undefined }}>{v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title={(() => {
                                              const r = reviewOverheadRates.ratePerHour
                                              if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate ($/hr). Loading or no overhead data yet."
                                              return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr.`
                                            })()}
                                          >{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Profit/hr`}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null) return '—'
                                            const netRevPerHr = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                            if (netRevPerHr == null) return '—'
                                            const profitPerHr = netRevPerHr - r
                                            return <span style={{ color: profitPerHr < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitPerHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: '#6b7280' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method A) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            return `$${formatCurrency(j.totalJobHours * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalJobHours * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method B) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            return `$${formatCurrency(j.valueCreated * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.valueCreated * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method C) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            return `$${formatCurrency(j.totalLaborOnJob * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalLaborOnJob * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                            {reviewCrewJobs.map((j) => {
                              const key = `crew-${j.job_id}-${j.work_date}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div>$<strong>{Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{(j.hcp_number ?? '').trim() && j.hcp_number !== '—' ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.work_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.job_address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = (j.hcp_number ?? '').trim() && j.hcp_number !== '—'
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'labor',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.job_address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.totalLaborOnJob > 0 ? 'See everyone who contributed labor to this job' : undefined}
                                    >
                                      <div style={{ fontWeight: 600 }}>{(() => {
                                        if (j.laborCost <= 0) return '—'
                                        const dollars = `$${Math.round(j.laborCost).toLocaleString('en-US')}`
                                        const hrs = formatHrsLabel(j.hours)
                                        return hrs ? `${dollars} / ${hrs}` : dollars
                                      })()}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.totalLaborOnJob === 0) return '—'
                                        const pct = Math.round((j.laborCost / j.totalLaborOnJob) * 100)
                                        return `${pct}% of $${Math.round(j.totalLaborOnJob).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (j.revenueBeforeOverhead === 0 || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = (j.hcp_number ?? '').trim() && j.hcp_number !== '—'
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'profit',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.job_address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? "See everyone's profit share on this job" : undefined}
                                    >
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${Math.round(j.revenueBeforeOverhead).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? '#b91c1c' : undefined }}>{v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title={(() => {
                                              const r = reviewOverheadRates.ratePerHour
                                              if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate ($/hr). Loading or no overhead data yet."
                                              return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr.`
                                            })()}
                                          >{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Profit/hr`}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null) return '—'
                                            const netRevPerHr = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                            if (netRevPerHr == null) return '—'
                                            const profitPerHr = netRevPerHr - r
                                            return <span style={{ color: profitPerHr < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitPerHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: '#6b7280' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method A) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            return `$${formatCurrency(j.totalJobHours * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalJobHours * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method B) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            return `$${formatCurrency(j.valueCreated * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.valueCreated * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method C) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            return `$${formatCurrency(j.totalLaborOnJob * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalLaborOnJob * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                          <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                            <tr>
                              <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                                  return totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalLaborByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalLaborByJob.set(j.job_id, j.totalLaborOnJob)
                                  }
                                  const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  return (
                                    <div style={{ fontWeight: 600, color: totalRevenue >= 0 ? undefined : '#b91c1c' }}>{totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</div>
                                  )
                                })()}
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const revBeforeByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) revBeforeByJob.set(j.job_id, j.revenueBeforeOverhead)
                                  }
                                  const totalRevBeforeOverhead = [...revBeforeByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisBill = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  return totalThisBill > 0 ? `$${Math.round(totalThisBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalValueByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalValueByJob.set(j.job_id, j.valueCreated)
                                  }
                                  const totalValue = [...totalValueByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalValue > 0 ? `$${Math.round(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRev = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  const totalProfit = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  const totalHrs = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                                  if (totalHrs <= 0) return '—'
                                  const revHr = totalRev / totalHrs
                                  const profitHr = totalProfit / totalHrs
                                  return (
                                    <>
                                      <div>$<strong>{Math.round(revHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                      <div style={{ color: profitHr < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
                                    </>
                                  )
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewHoursPayCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewHoursPayCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewHoursPayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Hours and Pay
                </h3>
                {(() => {
                  const personName = showPeopleForReview[selectedReviewPersonIndex]
                  const cfg = personName ? payConfig[personName] : undefined
                  const wage = cfg?.hourly_wage ?? 0
                  const [start, end] = getReviewDateRange()
                  const days = getDaysInRange(start, end)
                  const getHoursForDay = (d: string) => {
                    if (!cfg) return 0
                    const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                    return cfg.is_salary
                      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                      : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                  }
                  const totalHours = reviewOnlyPaidInFull
                    ? [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                    : days.reduce((s, d) => s + getHoursForDay(d), 0)
                  const totalPay = personName ? getReviewPeriodPay(personName) : 0
                  if (reviewHoursPayCollapsed) {
                    return (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Hours:</span>
                          <span style={{ fontWeight: 600 }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Pay:</span>
                          <span style={{ fontWeight: 600 }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((d) => {
                            const hrs = getHoursForDay(d)
                            const pay = personName && wage > 0 ? getPayForPersonDate(personName, d) : 0
                            return (
                              <tr key={d} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{d}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{hrs > 0 ? decimalToHms(hrs).replace(/:00$/, '') || '-' : '-'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{wage > 0 ? `$${Math.round(pay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Reports Filed ({reviewReports.length})</h3>
                {reviewReports.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No reports in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Template</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewReports.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{displayReportTemplateName(r.template_name, authRole)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.job_display_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <Link to={`/jobs?report=${r.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Tasks Completed ({reviewTasks.length})</h3>
                {reviewTasks.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No tasks in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Scheduled</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasks.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}><ChecklistTitleWithLinks title={t.title} links={t.links} /></td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.scheduled_date}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>
                  Tasks outstanding ({reviewTasksOutstanding.length})
                </h3>
                {reviewTasksOutstanding.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No open tasks assigned.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasksOutstanding.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <ChecklistTitleWithLinks title={t.title} links={t.links} />
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {(t.scheduled_date ?? '').trim() ? t.scheduled_date : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
          {reviewLaborBreakdownContext && (() => {
            const ctx = reviewLaborBreakdownContext
            const rows = ctx.jobId ? (reviewLaborByJobAndPerson[ctx.jobId] ?? []) : []
            const sumOfRows = rows.reduce((s, r) => s + r.laborCost, 0)
            const sumHours = rows.reduce((s, r) => s + r.hours, 0)
            const denom = ctx.totalLaborOnJob > 0 ? ctx.totalLaborOnJob : sumOfRows
            const headerLabel = [ctx.jobNumberLabel, ctx.jobName].filter(Boolean).join(' · ') || (ctx.mode === 'profit' ? 'Profit breakdown' : 'Labor breakdown')
            const isProfit = ctx.mode === 'profit'
            const profitNegative = ctx.revenueBeforeOverhead < 0
            return (
              <div
                onClick={() => setReviewLaborBreakdownContext(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: '92vw', maxHeight: '85vh', overflow: 'auto' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{isProfit ? 'Profit shares by person' : 'Labor contributors'}</h3>
                      <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}>{headerLabel}</div>
                      {ctx.jobAddress ? (
                        <div style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '0.1rem' }}>{stripAddressZipState(ctx.jobAddress) || ctx.jobAddress}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewLaborBreakdownContext(null)}
                      style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {isProfit ? (
                      <>
                        Total profit on this job (revenue before overhead): <strong style={{ color: profitNegative ? '#b91c1c' : '#111827' }}>${Math.round(ctx.revenueBeforeOverhead).toLocaleString('en-US')}</strong>
                        <div style={{ fontSize: '0.95em', color: '#9ca3af', marginTop: '0.15rem' }}>
                          Allocated by each person's share of total labor (${Math.round(denom).toLocaleString('en-US')}{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}).
                        </div>
                      </>
                    ) : (
                      <>Total labor on this job (everyone, all time): <strong style={{ color: '#111827' }}>${Math.round(denom).toLocaleString('en-US')}</strong>{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}</>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No labor recorded for this job.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Share</th>
                            {isProfit && (
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Profit slice</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const isYou = ctx.userPersonName && r.personName === ctx.userPersonName
                            const ratio = denom > 0 ? r.laborCost / denom : 0
                            const pct = Math.round(ratio * 100)
                            const profitSlice = ratio * ctx.revenueBeforeOverhead
                            const sourceLabel = (() => {
                              const parts: string[] = []
                              if (r.subLaborCost > 0) parts.push('sub')
                              if (r.crewLaborCost > 0) parts.push('crew')
                              return parts.join(' + ')
                            })()
                            return (
                              <tr
                                key={r.personName}
                                style={{ borderBottom: '1px solid #e5e7eb', background: isYou ? '#fef3c7' : undefined }}
                              >
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <div style={{ fontWeight: isYou ? 600 : 400 }}>
                                    {r.personName}
                                    {isYou ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75em', color: '#92400e', fontWeight: 600 }}>(you)</span> : null}
                                  </div>
                                  {sourceLabel ? <div style={{ fontSize: '0.75em', color: '#9ca3af' }}>{sourceLabel}</div> : null}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.hours > 0 ? r.hours.toFixed(2) : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.laborCost > 0 ? `$${formatCurrency(r.laborCost)}` : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#6b7280' }}>{denom > 0 && r.laborCost > 0 ? `${pct}%` : '—'}</td>
                                {isProfit && (
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: isYou ? 600 : 400, color: profitSlice >= 0 ? undefined : '#b91c1c' }}>
                                    {Math.abs(profitSlice) >= 0.5 ? `$${formatCurrency(profitSlice)}` : '—'}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>Total</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>{sumHours > 0 ? sumHours.toFixed(2) : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>{sumOfRows > 0 ? `$${formatCurrency(sumOfRows)}` : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#6b7280' }}>
                              {denom > 0 ? `${Math.round((sumOfRows / denom) * 100)}%` : '—'}
                            </td>
                            {isProfit && (
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600, color: ctx.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>
                                {Math.abs(ctx.revenueBeforeOverhead) >= 0.5 ? `$${formatCurrency(denom > 0 ? (sumOfRows / denom) * ctx.revenueBeforeOverhead : 0)}` : '—'}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {Math.abs(sumOfRows - ctx.totalLaborOnJob) > 1 && ctx.totalLaborOnJob > 0 && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75em', color: '#9ca3af' }}>
                      Per-person rows total ${formatCurrency(sumOfRows)}; the job header showed ${formatCurrency(ctx.totalLaborOnJob)}. The two should match — a small gap usually means a sub-labor card without an assignee or a crew row outside the 2-year lookback window.
                    </p>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )
      })()}

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
