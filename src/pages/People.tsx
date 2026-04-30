import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { SearchableSelect, type SearchableSelectSelectableOption } from '../components/SearchableSelect'
import { WriteupsContractsSubTab } from '../components/writeups/WriteupsContractsSubTab'
import type { WriteupListRow } from '../components/writeups/WriteupEditorModal'
import type { NcnsListRow } from '../components/writeups/writeupsTimelineTypes'
import type { WriteupTemplateRow } from '../components/writeups/WriteupTemplateManagerModal'
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
import { checkGoogleDriveAttachmentUrl } from '../lib/checkGoogleDriveAttachmentUrl'
import { hasContractSigningContent } from '../lib/contractSigningContent'
import {
  type ContractBodyFormat,
  isMarkdownBodyFormat,
  isPlainBodyFormat,
  normalizeContractBodyForSave,
  parseContractBodyFormat,
} from '../lib/contractBodyFormat'
import { buildContractSendEmailPreview } from '../lib/contractSendEmailPreview'
import { normalizeCustomerAttachmentUrl } from '../lib/estimateCustomerAttachment'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { buildCrewMapFromJobsAndBidRows, type MergedCrewMapRow } from '../utils/crewAssignments'
import { formatDateRangeLabel } from '../utils/dateRangeLabel'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

function formatContractBookLastEditedCalendarDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { approveClockSessions } from '../lib/approveClockSessions'
import { clockSessionMatchesSearch } from '../lib/clockSessionSearch'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import {
  isPayStubFullyPaid,
  PAY_STUB_PAY_FULLY_TOLERANCE,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../lib/payStubPayments'
import { ContractBookModal, type ContractBookTemplateDocument } from '../components/contracts/ContractBookModal'
import { PersonContractSignedRecordModal } from '../components/contracts/PersonContractSignedRecordModal'
import { ContractBookIcon } from '../components/icons/ContractBookIcon'
import { PayStubAdditionalModal } from '../components/pay/PayStubAdditionalModal'
import { PayStubLessModal } from '../components/pay/PayStubLessModal'
import { type PersonOffsetInitialDraft, PersonOffsetFormModal } from '../components/pay/PersonOffsetFormModal'
import { CustomPayReportsModal } from '../components/pay/CustomPayReportsModal'
import { DraftPayrollModal } from '../components/pay/DraftPayrollModal'
import {
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
  stubNetPay,
  sumPayStubAdditionalAmounts,
  sumPayStubDeductionAmounts,
} from '../lib/payStubDeductions'
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
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import { useHoursGridFirstColWidthPx } from '../hooks/useHoursGridFirstColWidthPx'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useToastContext } from '../contexts/ToastContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { HoursUnassignedModal } from '../components/HoursUnassignedModal'
import { PeopleHoursDayAuditModal } from '../components/PeopleHoursDayAuditModal'
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
import type { DayEditorSession } from '../lib/myTimeDayTimeline'
import { PayStubDeleteIcon } from '../components/pay/PayStubDeleteIcon'
import { PayStubPaidNoteIcon } from '../components/pay/PayStubPaidNoteIcon'
import type { ClockSessionRow } from '../types/clockSessions'
import type { PayConfigRow } from '../types/peoplePayConfig'

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

/** person_contract_documents.status values allowed for staff delete in People → Contracts */
function isDeletablePersonContractStatus(status: string): boolean {
  return status === 'unsent' || status === 'sent' || status === 'signed'
}

/** True when the row has URL, signing content, note, or signature date — do not delete as an empty placeholder (Manage templates + unassign). */
function personContractDocumentHasStaffData(
  pcd: {
    url: string | null
    signed_at: string | null
    note: string | null
    signing_body_html: string | null
    canonical_document_url: string | null
  } | null | undefined,
): boolean {
  if (!pcd) return false
  return !!(
    pcd.url?.trim() ||
    pcd.signed_at ||
    pcd.note?.trim() ||
    pcd.signing_body_html?.trim() ||
    pcd.canonical_document_url?.trim()
  )
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
  | 'users'
  | 'teams'
  | 'pay_stubs'
  | 'pay'
  | 'hours'
  | 'vehicles'
  | 'housing'
  | 'offsets'
  | 'licenses'
  | 'contracts'
  | 'writeups'
  | 'review'
  | 'feedback'
  | 'activity'

type Vehicle = { id: string; year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number; created_at: string | null; updated_at: string | null }
type VehicleOdometerEntry = { id: string; vehicle_id: string; odometer_value: number; read_date: string; created_at: string | null }
type VehicleReplacementValueEntry = { id: string; vehicle_id: string; replacement_value: number; read_date: string; created_at: string | null }
type VehiclePossession = { id: string; vehicle_id: string; user_id: string; start_date: string; end_date: string | null; created_at: string | null }

type HousingUnit = {
  id: string
  address: string
  rent_per_week: number
  utilities_per_week: number
  insurance_per_week: number
  created_at: string | null
  updated_at: string | null
}
type HousingPossession = { id: string; housing_id: string; user_id: string; start_date: string; end_date: string | null; created_at: string | null }

type PersonOffset = { id: string; person_name: string; type: string; amount: number; description: string | null; occurred_date: string; pay_stub_id: string | null; created_at: string | null }

type PersonLicenseCostLine = { id: string; person_license_id: string; amount: number; note: string | null; date: string; created_at: string | null }
type PersonLicense = {
  id: string
  person_name: string
  license_type: string
  note: string | null
  date_of_expiry: string
  created_at: string | null
  expiry_dispatch_notified_at?: string | null
  person_license_cost_lines?: PersonLicenseCostLine[]
}

function costLinesTotal(lines: PersonLicenseCostLine[] | undefined): number {
  return (lines ?? []).reduce((s, l) => s + l.amount, 0)
}

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

export default function People() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const narrowViewport = useNarrowViewport640()
  const { widthPx: hoursGridFirstColWidthPx, measurer: hoursGridFirstColMeasurer } = useHoursGridFirstColWidthPx()
  const hoursGridFirstColW = hoursGridFirstColWidthPx ?? 200
  const [users, setUsers] = useState<UserRow[]>([])
  const usersRef = useRef<UserRow[]>([])
  usersRef.current = users
  const [people, setPeople] = useState<Person[]>([])
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
  const [payTabLoading, setPayTabLoading] = useState(false)
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
  const [activityViewerGrantSet, setActivityViewerGrantSet] = useState<Set<string>>(() => new Set())
  const [activityGrantListLoading, setActivityGrantListLoading] = useState(false)
  const [activityGrantBusyId, setActivityGrantBusyId] = useState<string | null>(null)
  const [activityGrantsSectionOpen, setActivityGrantsSectionOpen] = useState(true)
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
    if (activeTab !== 'pay') {
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
  type HoursRow = { person_name: string; work_date: string; hours: number }
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
  const [matrixStartDate, setMatrixStartDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  const [matrixEndDate, setMatrixEndDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
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
  const [payStubGeneratorPerson, setPayStubGeneratorPerson] = useState('')
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
  const [draftPayrollPendingApprovalCount, setDraftPayrollPendingApprovalCount] = useState<number | null>(null)
  const [draftPayrollPendingApprovalLoading, setDraftPayrollPendingApprovalLoading] = useState(false)
  const [draftPayrollPendingApprovalError, setDraftPayrollPendingApprovalError] = useState<string | null>(null)
  const [customPayReportsModalOpen, setCustomPayReportsModalOpen] = useState(false)
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
  const [editingUserNote, setEditingUserNote] = useState<{ id: string; name: string; notes: string; phone: string } | null>(null)
  const [userNoteSaving, setUserNoteSaving] = useState(false)
  const [authUserRole, setAuthUserRole] = useState<string | null>(null)
  const canAccessTeamsTab =
    authRole !== null && ['dev', 'master_technician', 'assistant'].includes(authRole)

  // Hours tab state (unassigned hours modal, crew jobs by date)
  type CrewJobAssignment = { job_id: string; pct: number }
  type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }
  type CrewBidAssignment = { bid_id: string; pct: number }
  type CrewBidRow = { crew_lead_person_name: string | null; bid_assignments: CrewBidAssignment[] }
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, MergedCrewMapRow>>({})
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)
  const [hoursDayAuditModal, setHoursDayAuditModal] = useState<{ personName: string; workDate: string } | null>(null)

  // Vehicles tab state
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [odometerEntries, setOdometerEntries] = useState<VehicleOdometerEntry[]>([])
  const [replacementValueEntries, setReplacementValueEntries] = useState<VehicleReplacementValueEntry[]>([])
  const [possessions, setPossessions] = useState<VehiclePossession[]>([])
  const [vehicleAssignees, setVehicleAssignees] = useState<Record<string, string>>({})
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleVin, setVehicleVin] = useState('')
  const [vehicleInsCost, setVehicleInsCost] = useState('')
  const [vehicleRegCost, setVehicleRegCost] = useState('')
  const [odometerFormOpen, setOdometerFormOpen] = useState(false)
  const [odometerDate, setOdometerDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [odometerValue, setOdometerValue] = useState('')
  const [replacementValueFormOpen, setReplacementValueFormOpen] = useState(false)
  const [replacementValueDate, setReplacementValueDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [replacementValueValue, setReplacementValueValue] = useState('')
  const [possessionFormOpen, setPossessionFormOpen] = useState(false)
  // Offsets tab state
  const [offsets, setOffsets] = useState<PersonOffset[]>([])
  const [offsetsLoading, setOffsetsLoading] = useState(false)
  const [offsetsError, setOffsetsError] = useState<string | null>(null)
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [offsetFormInitialCreateDraft, setOffsetFormInitialCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [editingOffset, setEditingOffset] = useState<PersonOffset | null>(null)
  const [offsetApplyModalOpen, setOffsetApplyModalOpen] = useState(false)
  const [offsetToApply, setOffsetToApply] = useState<PersonOffset | null>(null)
  const [offsetApplyPayStubId, setOffsetApplyPayStubId] = useState('')
  const [offsetsTabSearch, setOffsetsTabSearch] = useState('')
  const [possessionUserId, setPossessionUserId] = useState('')
  const [possessionStartDate, setPossessionStartDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [possessionEndDate, setPossessionEndDate] = useState('')

  // Housing tab state
  const [housingUnits, setHousingUnits] = useState<HousingUnit[]>([])
  const [housingLoading, setHousingLoading] = useState(false)
  const [housingError, setHousingError] = useState<string | null>(null)
  const [housingFormOpen, setHousingFormOpen] = useState(false)
  const [editingHousingUnit, setEditingHousingUnit] = useState<HousingUnit | null>(null)
  const [selectedHousingId, setSelectedHousingId] = useState<string | null>(null)
  const [housingPossessions, setHousingPossessions] = useState<HousingPossession[]>([])
  const [housingAssignees, setHousingAssignees] = useState<Record<string, string>>({})
  const [housingAddress, setHousingAddress] = useState('')
  const [housingRentWeek, setHousingRentWeek] = useState('')
  const [housingUtilitiesWeek, setHousingUtilitiesWeek] = useState('')
  const [housingInsuranceWeek, setHousingInsuranceWeek] = useState('')
  const [housingPossessionFormOpen, setHousingPossessionFormOpen] = useState(false)
  const [housingPossessionUserId, setHousingPossessionUserId] = useState('')
  const [housingPossessionStartDate, setHousingPossessionStartDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [housingPossessionEndDate, setHousingPossessionEndDate] = useState('')

  // Licenses tab state
  const [licenses, setLicenses] = useState<PersonLicense[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licensesError, setLicensesError] = useState<string | null>(null)
  const [licensesExpiringSoon, setLicensesExpiringSoon] = useState<PersonLicense[]>([])
  const [selectedLicensePersonName, setSelectedLicensePersonName] = useState<string | null>(null)
  const [licenseFormOpen, setLicenseFormOpen] = useState(false)
  const [editingLicense, setEditingLicense] = useState<PersonLicense | null>(null)
  const [licensePersonName, setLicensePersonName] = useState('')
  const [licenseType, setLicenseType] = useState('')
  const [licenseNote, setLicenseNote] = useState('')
  const [licenseDateOfExpiry, setLicenseDateOfExpiry] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [costLineFormOpen, setCostLineFormOpen] = useState(false)
  const [editingCostLine, setEditingCostLine] = useState<PersonLicenseCostLine | null>(null)
  const [costLineLicenseId, setCostLineLicenseId] = useState<string | null>(null)
  const [costLineAmount, setCostLineAmount] = useState('')
  const [costLineNote, setCostLineNote] = useState('')
  const [costLineDate, setCostLineDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [expandedCostLinesLicenseId, setExpandedCostLinesLicenseId] = useState<string | null>(null)

  // Contracts tab state
  type ContractTemplate = { id: string; name: string; sequence_order: number; created_at: string | null }
  type ContractTemplateDocument = {
    id: string
    template_id: string
    document_name: string
    sequence_order: number
    book_body_html: string | null
    book_body_format: string
    tags: string[]
    canonical_document_url?: string | null
    updated_at: string
  }
  type PersonContractAssignment = { id: string; person_name: string; template_id: string }
  type PersonContractDocument = {
    id: string
    person_name: string
    document_name: string
    url: string | null
    signing_body_html: string | null
    signing_body_format: string
    canonical_document_url: string | null
    status: string
    signed_at: string | null
    sent_at: string | null
    note: string | null
    dashboard_prompt_after_clock_in?: boolean | null
    applied_contract_template_document_id: string | null
    contract_lineage_id: string
    lineage_version: number
    supersedes_person_contract_document_id: string | null
  }

  /** One table row: a specific version row, or placeholder when template lists doc but no person row yet. */
  type PersonContractTableRow = {
    document_name: string
    lineageId: string | null
    templateNames: string[]
    bookLastEditedAt: string | null
    version: PersonContractDocument | null
  }
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([])
  const [contractTemplateDocuments, setContractTemplateDocuments] = useState<ContractTemplateDocument[]>([])
  const [personContractAssignments, setPersonContractAssignments] = useState<PersonContractAssignment[]>([])
  const [personContractDocuments, setPersonContractDocuments] = useState<PersonContractDocument[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractsError, setContractsError] = useState<string | null>(null)
  const [contractsSearchQuery, setContractsSearchQuery] = useState('')
  const [selectedContractsPersonName, setSelectedContractsPersonName] = useState<string | null>(null)
  const [contractsTemplateModalOpen, setContractsTemplateModalOpen] = useState(false)
  const [contractsAssignModalOpen, setContractsAssignModalOpen] = useState(false)
  const [contractBookModalOpen, setContractBookModalOpen] = useState(false)
  const [editingContractDocument, setEditingContractDocument] = useState<PersonContractDocument | null>(null)
  const [contractDocumentFormPersonName, setContractDocumentFormPersonName] = useState('')
  const [contractDocumentFormDocumentName, setContractDocumentFormDocumentName] = useState('')
  const [contractDocumentFormUrl, setContractDocumentFormUrl] = useState('')
  const [contractDocumentFormStatus, setContractDocumentFormStatus] = useState<'unsent' | 'sent' | 'signed'>('unsent')
  const [contractDocumentFormSignedAt, setContractDocumentFormSignedAt] = useState('')
  const [contractDocumentFormNote, setContractDocumentFormNote] = useState('')
  const [contractDocumentFormSigningBodyHtml, setContractDocumentFormSigningBodyHtml] = useState('')
  const [contractDocumentFormSigningBodyFormat, setContractDocumentFormSigningBodyFormat] =
    useState<ContractBodyFormat>('html')
  const [contractDocumentFormCanonicalUrl, setContractDocumentFormCanonicalUrl] = useState('')
  /** Empty string = automatic (max updated_at among assigned templates). */
  const [contractDocumentFormAppliedTemplateDocId, setContractDocumentFormAppliedTemplateDocId] = useState('')
  const [contractDocumentFormSaving, setContractDocumentFormSaving] = useState(false)
  const [contractDocumentDeleteConfirmOpen, setContractDocumentDeleteConfirmOpen] = useState(false)
  const [contractDocumentDeleteTarget, setContractDocumentDeleteTarget] = useState<PersonContractDocument | null>(
    null,
  )
  const [contractsDocumentActionsMenuOpenId, setContractsDocumentActionsMenuOpenId] = useState<string | null>(null)
  const [contractDocumentDeleting, setContractDocumentDeleting] = useState(false)
  const [contractDocumentModalOpen, setContractDocumentModalOpen] = useState(false)
  /** Edit document modal: collapsible sections (default minimized). */
  const [contractEditModalContractTextExpanded, setContractEditModalContractTextExpanded] = useState(false)
  const [contractEditModalCanonicalExpanded, setContractEditModalCanonicalExpanded] = useState(false)
  const [contractSendModalOpen, setContractSendModalOpen] = useState(false)
  const [contractSendDocId, setContractSendDocId] = useState<string | null>(null)
  const [contractSendEmail, setContractSendEmail] = useState('')
  const [contractSendSubject, setContractSendSubject] = useState('')
  const [contractSendIntro, setContractSendIntro] = useState('')
  const [contractSendSaving, setContractSendSaving] = useState(false)
  const [canonicalUrlCheckStatus, setCanonicalUrlCheckStatus] = useState<
    'idle' | 'loading' | 'success' | 'warn' | 'error'
  >('idle')
  const [canonicalUrlCheckMessage, setCanonicalUrlCheckMessage] = useState('')
  const [contractDocumentAddTab, setContractDocumentAddTab] = useState<'upload_signed' | 'request_signature'>(
    'request_signature',
  )
  const [contractDocumentFormDashboardPrompt, setContractDocumentFormDashboardPrompt] = useState(false)
  const [contractDashboardPromptSavingId, setContractDashboardPromptSavingId] = useState<string | null>(null)
  const [contractSignedRecordModalDocId, setContractSignedRecordModalDocId] = useState<string | null>(null)
  const contractAddDocTabBaseId = useId()
  const assignTemplateSearchInputId = useId()
  const assignTemplateRadioGroupLabelId = useId()
  const contractsTabSearchInputId = useId()
  const templateBookPickerLabelId = useId()
  const [editingContractTemplate, setEditingContractTemplate] = useState<ContractTemplate | null>(null)
  const [templateFormName, setTemplateFormName] = useState('')
  const [templateFormDocumentNames, setTemplateFormDocumentNames] = useState<string[]>([])
  /** Picker-added names only: `document_name` → source `contract_template_documents.id` for insert copy. */
  const [templateFormDocumentSourceByName, setTemplateFormDocumentSourceByName] = useState<Record<string, string>>({})
  const [templateBookPickerValue, setTemplateBookPickerValue] = useState('')
  const [templateFormSaving, setTemplateFormSaving] = useState(false)
  const [templateFormMode, setTemplateFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [writeupTemplatesRows, setWriteupTemplatesRows] = useState<WriteupTemplateRow[]>([])
  const [writeupsRows, setWriteupsRows] = useState<WriteupListRow[]>([])
  const [ncnsRows, setNcnsRows] = useState<NcnsListRow[]>([])
  const [writeupsLoading, setWriteupsLoading] = useState(false)
  const [writeupsError, setWriteupsError] = useState<string | null>(null)

  const templateBookPickerOptions = useMemo((): SearchableSelectSelectableOption[] => {
    const existing = new Set(templateFormDocumentNames.map((n) => n.trim().toLowerCase()))
    return contractTemplateDocuments
      .filter((d) => !existing.has(d.document_name.trim().toLowerCase()))
      .map((d) => {
        const tname = contractTemplates.find((t) => t.id === d.template_id)?.name ?? '—'
        return {
          value: d.id,
          label: `${tname} — ${d.document_name}`,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [contractTemplateDocuments, contractTemplates, templateFormDocumentNames])

  const canonicalUrlIsCheckable = useMemo(
    () => Boolean(normalizeCustomerAttachmentUrl(contractDocumentFormCanonicalUrl)),
    [contractDocumentFormCanonicalUrl],
  )

  const checkCanonicalDocumentUrl = useCallback(async () => {
    const u = normalizeCustomerAttachmentUrl(contractDocumentFormCanonicalUrl)
    if (!u) {
      showToast('Enter a valid https URL first.', 'error')
      return
    }
    setCanonicalUrlCheckStatus('loading')
    setCanonicalUrlCheckMessage('')
    const result = await checkGoogleDriveAttachmentUrl(contractDocumentFormCanonicalUrl)
    if (result.status === 'error' && result.message === 'Not signed in.') {
      showToast('Not signed in', 'error')
    }
    setCanonicalUrlCheckStatus(
      result.status === 'success' ? 'success' : result.status === 'warn' ? 'warn' : 'error',
    )
    setCanonicalUrlCheckMessage(result.message)
  }, [contractDocumentFormCanonicalUrl, showToast])

  useEffect(() => {
    if (!contractDocumentModalOpen) return
    setCanonicalUrlCheckStatus('idle')
    setCanonicalUrlCheckMessage('')
  }, [contractDocumentFormCanonicalUrl, contractDocumentModalOpen])

  useEffect(() => {
    if (!contractDocumentModalOpen || !editingContractDocument) return
    setContractEditModalContractTextExpanded(false)
    setContractEditModalCanonicalExpanded(false)
  }, [contractDocumentModalOpen, editingContractDocument?.id])

  useEffect(() => {
    if (contractsDocumentActionsMenuOpenId === null) return
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.closest(`[data-contract-doc-menu-wrap="${contractsDocumentActionsMenuOpenId}"]`)) return
      setContractsDocumentActionsMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [contractsDocumentActionsMenuOpenId])

  const contractBodyFormatBtn = (active: boolean) =>
    ({
      padding: '0.25rem 0.55rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      border: '1px solid #d1d5db',
      borderRadius: 6,
      background: active ? '#eff6ff' : '#fff',
      color: active ? '#1d4ed8' : '#374151',
      cursor: 'pointer',
    }) as const

  const contractDocModalContractTextField = useMemo(
    () => (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.25rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label style={{ fontSize: '0.8125rem', display: 'block' }}>Contract text</label>
            <div
              role="group"
              aria-label="Contract text format"
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Format:</span>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'html')}
                onClick={() => setContractDocumentFormSigningBodyFormat('html')}
              >
                HTML
              </button>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'plain')}
                onClick={() => setContractDocumentFormSigningBodyFormat('plain')}
              >
                Plain text
              </button>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'markdown')}
                onClick={() => setContractDocumentFormSigningBodyFormat('markdown')}
              >
                Markdown
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContractBookModalOpen(true)}
            title="Open Contract Book"
            aria-label="Open Contract Book"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem 0.45rem',
              border: 'none',
              borderRadius: 6,
              background: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <ContractBookIcon />
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
          <strong>HTML:</strong> rich text (sanitized). <strong>Plain:</strong> exact text including angle brackets.{' '}
          <strong>Markdown:</strong> rendered on the signing page (then sanitized).
        </p>
        <textarea
          value={contractDocumentFormSigningBodyHtml}
          onChange={(e) => setContractDocumentFormSigningBodyHtml(e.target.value)}
          placeholder="Optional. Shown on the public signing page."
          rows={6}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
    ),
    [contractDocumentFormSigningBodyHtml, contractDocumentFormSigningBodyFormat, contractBodyFormatBtn],
  )

  const contractDocModalCanonicalUrlField = useMemo(
    () => (
      <div>
        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
          Canonical document URL (Doc / PDF)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={contractDocumentFormCanonicalUrl}
            onChange={(e) => setContractDocumentFormCanonicalUrl(e.target.value)}
            placeholder="https://…"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => void checkCanonicalDocumentUrl()}
            disabled={canonicalUrlCheckStatus === 'loading' || !canonicalUrlIsCheckable}
            style={{
              flexShrink: 0,
              padding: '0.4rem 0.65rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#3b82f6' : '#f9fafb',
              color: canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#fff' : '#9ca3af',
              cursor:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? 'pointer' : 'not-allowed',
              opacity: canonicalUrlIsCheckable ? 1 : 0.65,
            }}
          >
            {canonicalUrlCheckStatus === 'loading' ? 'Checking…' : 'Check link'}
          </button>
        </div>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.35rem' }}>
          Drive or Docs URLs only. Does not block saving — hints only.
        </span>
        {canonicalUrlCheckStatus === 'success' && canonicalUrlCheckMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#15803d', lineHeight: 1.45 }}
          >
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
        {canonicalUrlCheckStatus === 'warn' && canonicalUrlCheckMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b45309', lineHeight: 1.45 }}
          >
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
        {canonicalUrlCheckStatus === 'error' && canonicalUrlCheckMessage ? (
          <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.45 }}>
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
      </div>
    ),
    [
      contractDocumentFormCanonicalUrl,
      canonicalUrlCheckStatus,
      canonicalUrlCheckMessage,
      canonicalUrlIsCheckable,
      checkCanonicalDocumentUrl,
    ],
  )

  const handleContractAddTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const goRequest = e.key === 'ArrowRight' && contractDocumentAddTab === 'upload_signed'
      const goUpload = e.key === 'ArrowLeft' && contractDocumentAddTab === 'request_signature'
      if (goRequest) {
        setContractDocumentAddTab('request_signature')
        setContractDocumentFormStatus('unsent')
        requestAnimationFrame(() => {
          document.getElementById(`${contractAddDocTabBaseId}-tab-request`)?.focus()
        })
      } else if (goUpload) {
        setContractDocumentAddTab('upload_signed')
        setContractDocumentFormStatus('signed')
        requestAnimationFrame(() => {
          document.getElementById(`${contractAddDocTabBaseId}-tab-upload`)?.focus()
        })
      }
    },
    [contractAddDocTabBaseId, contractDocumentAddTab, setContractDocumentFormStatus],
  )

  // Review tab state
  type ReviewPeriod = 'today' | 'yesterday' | 'last_week' | 'last_two_weeks' | 'last_month'
  const [selectedReviewPersonIndex, setSelectedReviewPersonIndex] = useState(0)
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>('last_week')
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
    laborCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    otherTeammatesLabor: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
  }
  type ReviewCrewJob = {
    source: 'crew'
    job_id: string
    work_date: string
    hcp_number: string
    job_name: string
    job_address: string
    viaLead: string | null
    crewMemberNames?: string[]
    hours: number
    laborCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    otherTeammatesLabor: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
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
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)
  const [reviewOnlyPaidInFull, setReviewOnlyPaidInFull] = useState(false)
  const loadCrewJobsRef = useRef<() => void>()
  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => {
    if (activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared))
      loadPeopleHours(matrixStartDate, matrixEndDate)
    else if (activeTab === 'hours' && canAccessHours)
      loadPeopleHours(hoursDateStart, hoursDateEnd)
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
    } else if (
      tab === 'users' ||
      tab === 'teams' ||
      tab === 'pay_stubs' ||
      tab === 'pay' ||
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
  }, [searchParams, activityAccessResolved, canSeeActivityTab, canAccessContracts, canAccessTeamsTab, setSearchParams])

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
    if (window.location.hash === '#cost-matrix' && activeTab === 'pay') {
      const el = document.getElementById('cost-matrix')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeTab, searchParams])

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

  useEffect(() => {
    if (!isDev || activeTab !== 'activity') return
    let cancelled = false
    setActivityGrantListLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.from('user_app_activity_viewers').select('viewer_user_id'),
          'list activity viewers'
        )
        if (cancelled) return
        setActivityViewerGrantSet(new Set((data ?? []).map((r: { viewer_user_id: string }) => r.viewer_user_id)))
      } finally {
        if (!cancelled) setActivityGrantListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev, activeTab])

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
        await mergePersonIntoUser(invitedDup.personName, invitedDup.userDisplayName, payConfig, userId)
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
      await mergePersonIntoUser(dup.personName, dup.userDisplayName, payConfig, userId)
      await loadPayConfig()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
      if (activeTab === 'hours') {
        loadPeopleHours(hoursDateStart, hoursDateEnd)
      }
      if (activeTab === 'pay') {
        loadPeopleHours(matrixStartDate, matrixEndDate)
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
    const { data, error } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
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
      .eq('start_date', matrixStartDate)
    const set = new Set((data ?? []).map((r: { person_name: string }) => r.person_name))
    setHoursReviewedSet(set)
  }

  async function loadPeopleHours(start: string, end: string) {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data, error } = await supabase
      .from('people_hours')
      .select('person_name, work_date, hours')
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

  function computePayReportAssignmentsBreakdown(
    personName: string,
    dayRows: Array<{ work_date: string; hours: number }>,
    crewByDatePerson: Record<string, CrewJobRow>,
    crewBidsByDatePerson: Record<string, CrewBidRow>,
    jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }>,
    bidsMap: Record<string, { bid_number: string; project_name: string; address: string }>
  ): Array<{ date: string; hours: number; jobsText: string }> {
    function getEffectiveJobAssignments(pn: string, workDate: string): CrewJobAssignment[] {
      const key = `${workDate}:${pn}`
      const row = crewByDatePerson[key]
      if (!row) return []
      if (row.crew_lead_person_name) {
        const leadKey = `${workDate}:${row.crew_lead_person_name}`
        const leadRow = crewByDatePerson[leadKey]
        return leadRow?.job_assignments ?? []
      }
      return row.job_assignments
    }
    function getEffectiveBidAssignments(pn: string, workDate: string): CrewBidAssignment[] {
      const key = `${workDate}:${pn}`
      const row = crewBidsByDatePerson[key]
      if (!row) return []
      if (row.crew_lead_person_name) {
        const leadKey = `${workDate}:${row.crew_lead_person_name}`
        const leadRow = crewBidsByDatePerson[leadKey]
        return leadRow?.bid_assignments ?? []
      }
      return row.bid_assignments
    }
    function jobLabel(jobId: string): string {
      const d = jobsMap[jobId]
      if (!d) return jobId.slice(0, 8)
      const jobNum = (d.hcp_number ?? '').trim()
      const jobName = (d.job_name ?? '').trim()
      if (jobNum && jobName) return `Job ${jobNum} (${jobName})`
      return jobNum || jobName || (d.job_address ?? '').trim() || jobId.slice(0, 8)
    }
    function bidLabel(bidId: string): string {
      const d = bidsMap[bidId]
      if (!d) return bidId.slice(0, 8)
      const bidNum = (d.bid_number ?? '').trim()
      const projectName = (d.project_name ?? '').trim()
      if (bidNum && projectName) return `Bid ${bidNum} (${projectName})`
      return bidNum || projectName || (d.address ?? '').trim() || bidId.slice(0, 8)
    }
    return dayRows.map((r) => {
      const jobAssignments = getEffectiveJobAssignments(personName, r.work_date)
      const bidAssignments = getEffectiveBidAssignments(personName, r.work_date)
      const jobParts = jobAssignments.map((a) => {
        const hrs = r.hours * (a.pct / 100)
        return `${jobLabel(a.job_id)} ${hrs.toFixed(2)} hrs`
      })
      const bidParts = bidAssignments.map((a) => {
        const hrs = r.hours * (a.pct / 100)
        return `${bidLabel(a.bid_id)} ${hrs.toFixed(2)} hrs`
      })
      const parts = [...jobParts, ...bidParts]
      if (parts.length === 0) return { date: r.work_date, hours: r.hours, jobsText: '—' }
      return { date: r.work_date, hours: r.hours, jobsText: parts.join(', ') }
    })
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
    personOverride?: string,
    options?: { openPreview?: boolean },
  ): Promise<boolean> {
    const openPreview = options?.openPreview !== false
    const personName = (personOverride ?? payStubGeneratorPerson)?.trim()
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
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
      }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${personName}`]
      const jobAssignments = row ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments) : []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${personName}`]
      const bidAssignments = bidRow ? (bidRow.crew_lead_person_name ? (crewBidsByDatePerson[`${r.work_date}:${bidRow.crew_lead_person_name}`]?.bid_assignments ?? []) : bidRow.bid_assignments) : []
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
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [] }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const jobAssignments = row ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments) : []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${stub.person_name}`]
      const bidAssignments = bidRow ? (bidRow.crew_lead_person_name ? (crewBidsByDatePerson[`${r.work_date}:${bidRow.crew_lead_person_name}`]?.bid_assignments ?? []) : bidRow.bid_assignments) : []
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
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
    ])
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewBidsRows = (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; bid_assignments: CrewBidAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
    for (const r of crewBidsRows) {
      crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [] }
    }
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const jobAssignments = row ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments) : []
      for (const a of jobAssignments) jobIds.add(a.job_id)
      const bidRow = crewBidsByDatePerson[`${r.work_date}:${stub.person_name}`]
      const bidAssignments = bidRow ? (bidRow.crew_lead_person_name ? (crewBidsByDatePerson[`${r.work_date}:${bidRow.crew_lead_person_name}`]?.bid_assignments ?? []) : bidRow.bid_assignments) : []
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
    if (activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared)) {
      const t = setTimeout(() => {
        setPayTabLoading(true)
        Promise.all([
          loadPayConfig(),
          loadPeopleHours(matrixStartDate, matrixEndDate),
          loadTeams(),
          loadHoursDisplayOrder(),
          loadCostMatrixTags(),
          loadCostMatrixTagColors(),
          loadArchivedUserNames(),
          loadHoursReviewed(),
        ]).finally(() => setPayTabLoading(false))
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay, canViewCostMatrixShared, matrixStartDate, matrixEndDate])

  useEffect(() => {
    if (activeTab === 'pay' && Object.keys(payConfig).length > 0) {
      const dups = findPersonUserDuplicates(people, users, payConfig)
      setMergeDuplicates(dups)
    } else {
      setMergeDuplicates([])
    }
  }, [activeTab, payConfig, people, users])

  useEffect(() => {
    if (activeTab === 'pay' && isDev) {
      const t = setTimeout(() => loadCostMatrixShares(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, isDev])

  useEffect(() => {
    return () => {
      for (const t of Object.values(payConfigDebounceRef.current)) clearTimeout(t)
      payConfigDebounceRef.current = {}
    }
  }, [])

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
    if (activeTab !== 'hours' || !canAccessHours) {
      hoursTabFirstLoadCycleStartedRef.current = false
      return
    }
    const t = setTimeout(() => {
      hoursTabFirstLoadCycleStartedRef.current = true
      setHoursTabLoading(true)
      Promise.all([
        loadPayConfig(),
        loadPeopleHours(hoursDateStart, hoursDateEnd),
        loadHoursDaysCorrect(hoursDateStart, hoursDateEnd),
        loadHoursDisplayOrder(),
        loadPendingClockSessions(hoursDateStart, hoursDateEnd),
        loadApprovedClockSessions(hoursDateStart, hoursDateEnd),
        loadRejectedClockSessions(hoursDateStart, hoursDateEnd),
      ]).finally(() => setHoursTabLoading(false))
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab, canAccessHours, hoursDateStart, hoursDateEnd])

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

  async function loadVehicles() {
    setVehiclesLoading(true)
    setVehiclesError(null)
    const today = new Date().toLocaleDateString('en-CA')
    const { data: vehiclesData, error: vehiclesErr } = await supabase.from('vehicles').select('*').order('year', { ascending: false })
    setVehiclesLoading(false)
    if (vehiclesErr) {
      setVehiclesError(vehiclesErr.message)
      return
    }
    setVehicles((vehiclesData ?? []) as Vehicle[])
    const ids = (vehiclesData ?? []).map((v: { id: string }) => v.id)
    if (ids.length === 0) {
      setVehicleAssignees({})
      return
    }
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, user_id')
      .in('vehicle_id', ids)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const possByVehicle: Record<string, string[]> = {}
    for (const p of (possData ?? []) as { vehicle_id: string; user_id: string }[]) {
      const arr = possByVehicle[p.vehicle_id] ??= []
      arr.push(p.user_id)
    }
    const userIds = [...new Set((possData ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: usersData } = userIds.length > 0
      ? await supabase.from('users').select('id, name').is('archived_at', null).in('id', userIds)
      : { data: [] }
    const userNames: Record<string, string> = {}
    for (const u of (usersData ?? []) as { id: string; name: string }[]) {
      userNames[u.id] = u.name ?? ''
    }
    const assignees: Record<string, string> = {}
    for (const [vid, uids] of Object.entries(possByVehicle)) {
      assignees[vid] = uids.map((uid) => userNames[uid] || uid.slice(0, 8)).join(', ')
    }
    setVehicleAssignees(assignees)
  }

  async function loadOdometerEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_odometer_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setOdometerEntries((data ?? []) as VehicleOdometerEntry[])
  }

  async function loadReplacementValueEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_replacement_value_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setReplacementValueEntries((data ?? []) as VehicleReplacementValueEntry[])
  }

  async function loadPossessions(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_possessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('start_date', { ascending: false })
    if (error) return
    setPossessions((data ?? []) as VehiclePossession[])
  }

  function openVehicleForm(v?: Vehicle) {
    setEditingVehicle(v ?? null)
    setVehicleYear(v?.year?.toString() ?? '')
    setVehicleMake(v?.make ?? '')
    setVehicleModel(v?.model ?? '')
    setVehicleVin(v?.vin ?? '')
    setVehicleInsCost(v?.weekly_insurance_cost?.toString() ?? '')
    setVehicleRegCost(v?.weekly_registration_cost?.toString() ?? '')
    setVehicleFormOpen(true)
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false)
    setEditingVehicle(null)
    setVehicleYear('')
    setVehicleMake('')
    setVehicleModel('')
    setVehicleVin('')
    setVehicleInsCost('')
    setVehicleRegCost('')
  }

  async function upsertVehicle() {
    const year = parseInt(vehicleYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      setVehiclesError('Year must be 1900–2100')
      return
    }
    const ins = parseFloat(vehicleInsCost) || 0
    const reg = parseFloat(vehicleRegCost) || 0
    if (editingVehicle) {
      const { error: err } = await supabase.from('vehicles').update({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg, updated_at: new Date().toISOString() }).eq('id', editingVehicle.id)
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    } else {
      const { error: err } = await supabase.from('vehicles').insert({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg })
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    }
  }

  async function deleteVehicle(v: Vehicle) {
    if (!window.confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) return
    const { error: err } = await supabase.from('vehicles').delete().eq('id', v.id)
    if (err) setVehiclesError(err.message)
    else {
      setSelectedVehicleId((prev) => (prev === v.id ? null : prev))
      loadVehicles()
    }
  }

  async function insertOdometerEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(odometerValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Odometer value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_odometer_entries').insert({ vehicle_id: selectedVehicleId, odometer_value: val, read_date: odometerDate })
    if (err) setVehiclesError(err.message)
    else {
      setOdometerFormOpen(false)
      setOdometerDate(new Date().toLocaleDateString('en-CA'))
      setOdometerValue('')
      loadOdometerEntries(selectedVehicleId)
    }
  }

  async function deleteOdometerEntry(entry: VehicleOdometerEntry) {
    const { error: err } = await supabase.from('vehicle_odometer_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadOdometerEntries(selectedVehicleId)
  }

  async function insertReplacementValueEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(replacementValueValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Replacement value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').insert({ vehicle_id: selectedVehicleId, replacement_value: val, read_date: replacementValueDate })
    if (err) setVehiclesError(err.message)
    else {
      setReplacementValueFormOpen(false)
      setReplacementValueDate(new Date().toLocaleDateString('en-CA'))
      setReplacementValueValue('')
      loadReplacementValueEntries(selectedVehicleId)
    }
  }

  async function deleteReplacementValueEntry(entry: VehicleReplacementValueEntry) {
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadReplacementValueEntries(selectedVehicleId)
  }

  async function upsertPossession() {
    if (!selectedVehicleId || !possessionUserId) {
      setVehiclesError('Select a user')
      return
    }
    const { error: err } = await supabase.from('vehicle_possessions').insert({ vehicle_id: selectedVehicleId, user_id: possessionUserId, start_date: possessionStartDate, end_date: possessionEndDate.trim() || null })
    if (err) setVehiclesError(err.message)
    else {
      setPossessionFormOpen(false)
      setPossessionUserId('')
      setPossessionStartDate(new Date().toLocaleDateString('en-CA'))
      setPossessionEndDate('')
      loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  async function deletePossession(p: VehiclePossession) {
    const { error: err } = await supabase.from('vehicle_possessions').delete().eq('id', p.id)
    if (err) setVehiclesError(err.message)
    else {
      if (selectedVehicleId) loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  async function loadHousingUnits() {
    setHousingLoading(true)
    setHousingError(null)
    const today = new Date().toLocaleDateString('en-CA')
    const { data: unitsData, error: unitsErr } = await supabase.from('housing_units').select('*').order('address', { ascending: true })
    setHousingLoading(false)
    if (unitsErr) {
      setHousingError(unitsErr.message)
      return
    }
    setHousingUnits((unitsData ?? []) as HousingUnit[])
    const ids = (unitsData ?? []).map((u: { id: string }) => u.id)
    if (ids.length === 0) {
      setHousingAssignees({})
      return
    }
    const { data: possData } = await supabase
      .from('housing_possessions')
      .select('housing_id, user_id')
      .in('housing_id', ids)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const possByHousing: Record<string, string[]> = {}
    for (const p of (possData ?? []) as { housing_id: string; user_id: string }[]) {
      const arr = (possByHousing[p.housing_id] ??= [])
      arr.push(p.user_id)
    }
    const userIds = [...new Set((possData ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: usersData } =
      userIds.length > 0
        ? await supabase.from('users').select('id, name').is('archived_at', null).in('id', userIds)
        : { data: [] }
    const userNames: Record<string, string> = {}
    for (const u of (usersData ?? []) as { id: string; name: string }[]) {
      userNames[u.id] = u.name ?? ''
    }
    const assignees: Record<string, string> = {}
    for (const [hid, uids] of Object.entries(possByHousing)) {
      assignees[hid] = uids.map((uid) => userNames[uid] || uid.slice(0, 8)).join(', ')
    }
    setHousingAssignees(assignees)
  }

  async function loadHousingPossessions(housingId: string) {
    const { data, error } = await supabase
      .from('housing_possessions')
      .select('*')
      .eq('housing_id', housingId)
      .order('start_date', { ascending: false })
    if (error) return
    setHousingPossessions((data ?? []) as HousingPossession[])
  }

  function openHousingForm(u?: HousingUnit) {
    setEditingHousingUnit(u ?? null)
    setHousingAddress(u?.address ?? '')
    setHousingRentWeek(u?.rent_per_week != null ? String(u.rent_per_week) : '')
    setHousingUtilitiesWeek(u?.utilities_per_week != null ? String(u.utilities_per_week) : '')
    setHousingInsuranceWeek(u?.insurance_per_week != null ? String(u.insurance_per_week) : '')
    setHousingFormOpen(true)
  }

  function closeHousingForm() {
    setHousingFormOpen(false)
    setEditingHousingUnit(null)
    setHousingAddress('')
    setHousingRentWeek('')
    setHousingUtilitiesWeek('')
    setHousingInsuranceWeek('')
  }

  async function upsertHousingUnit() {
    const rent = parseFloat(housingRentWeek) || 0
    const util = parseFloat(housingUtilitiesWeek) || 0
    const ins = parseFloat(housingInsuranceWeek) || 0
    if (rent < 0 || util < 0 || ins < 0) {
      setHousingError('Weekly amounts must be zero or positive')
      return
    }
    const addr = housingAddress.trim()
    if (!addr) {
      setHousingError('Address is required')
      return
    }
    if (editingHousingUnit) {
      const { error: err } = await supabase
        .from('housing_units')
        .update({
          address: addr,
          rent_per_week: rent,
          utilities_per_week: util,
          insurance_per_week: ins,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingHousingUnit.id)
      if (err) setHousingError(err.message)
      else {
        closeHousingForm()
        void loadHousingUnits()
      }
    } else {
      const { error: err } = await supabase.from('housing_units').insert({
        address: addr,
        rent_per_week: rent,
        utilities_per_week: util,
        insurance_per_week: ins,
      })
      if (err) setHousingError(err.message)
      else {
        closeHousingForm()
        void loadHousingUnits()
      }
    }
  }

  async function deleteHousingUnit(u: HousingUnit) {
    if (!window.confirm(`Delete housing at "${u.address}"? Assignments will be removed.`)) return
    const { error: err } = await supabase.from('housing_units').delete().eq('id', u.id)
    if (err) setHousingError(err.message)
    else {
      setSelectedHousingId((prev) => (prev === u.id ? null : prev))
      loadHousingUnits()
    }
  }

  async function upsertHousingPossession() {
    if (!selectedHousingId || !housingPossessionUserId) {
      setHousingError('Select a user')
      return
    }
    const { error: err } = await supabase.from('housing_possessions').insert({
      housing_id: selectedHousingId,
      user_id: housingPossessionUserId,
      start_date: housingPossessionStartDate,
      end_date: housingPossessionEndDate.trim() || null,
    })
    if (err) setHousingError(err.message)
    else {
      setHousingPossessionFormOpen(false)
      setHousingPossessionUserId('')
      setHousingPossessionStartDate(new Date().toLocaleDateString('en-CA'))
      setHousingPossessionEndDate('')
      loadHousingPossessions(selectedHousingId)
      loadHousingUnits()
    }
  }

  async function deleteHousingPossession(p: HousingPossession) {
    const { error: err } = await supabase.from('housing_possessions').delete().eq('id', p.id)
    if (err) setHousingError(err.message)
    else {
      if (selectedHousingId) loadHousingPossessions(selectedHousingId)
      loadHousingUnits()
    }
  }

  async function loadOffsets() {
    setOffsetsLoading(true)
    setOffsetsError(null)
    const { data, error } = await supabase.from('person_offsets').select('*').order('occurred_date', { ascending: false })
    setOffsetsLoading(false)
    if (error) setOffsetsError(error.message)
    else setOffsets((data ?? []) as PersonOffset[])
  }

  function openOffsetForm(o?: PersonOffset) {
    setOffsetFormInitialCreateDraft(null)
    setEditingOffset(o ?? null)
    setOffsetFormOpen(true)
  }

  function openOffsetFormWithDraft(draft: PersonOffsetInitialDraft) {
    setEditingOffset(null)
    setOffsetFormInitialCreateDraft(draft)
    setOffsetFormOpen(true)
  }

  function closeOffsetForm() {
    recordPaymentRefreshAfterEmployeeCreditRef.current = false
    setOffsetFormOpen(false)
    setEditingOffset(null)
    setOffsetFormInitialCreateDraft(null)
    setOffsetsError(null)
  }

  async function deleteOffset(o: PersonOffset) {
    const delTypeLabel =
      o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
    if (!window.confirm(`Delete ${delTypeLabel} $${formatCurrency(o.amount)} for ${o.person_name}?`)) return
    const { error: err } = await supabase.from('person_offsets').delete().eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  async function applyOffsetToPayStub() {
    if (!offsetToApply || !offsetApplyPayStubId) return
    if (offsetToApply.type === 'employee_credit') {
      setOffsetsError('Employee credit cannot be applied to a stub this way yet.')
      return
    }
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: offsetApplyPayStubId }).eq('id', offsetToApply.id)
    if (err) setOffsetsError(err.message)
    else {
      setOffsetApplyModalOpen(false)
      setOffsetToApply(null)
      setOffsetApplyPayStubId('')
      loadOffsets()
    }
  }

  async function unapplyOffset(o: PersonOffset) {
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: null }).eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  async function loadLicenses() {
    setLicensesLoading(true)
    setLicensesError(null)
    const { data, error } = await supabase.from('person_licenses').select('*, person_license_cost_lines(id, amount, note, date)').order('date_of_expiry', { ascending: true })
    setLicensesLoading(false)
    if (error) setLicensesError(error.message)
    else {
      const list = (data ?? []) as PersonLicense[]
      setLicenses(list)
      const today = new Date().toLocaleDateString('en-CA')
      const in30 = new Date()
      in30.setDate(in30.getDate() + 30)
      const todayPlus30 = in30.toLocaleDateString('en-CA')
      setLicensesExpiringSoon(list.filter((l) => l.date_of_expiry >= today && l.date_of_expiry <= todayPlus30))
    }
  }

  async function loadContracts() {
    setContractsLoading(true)
    setContractsError(null)
    const [templatesRes, templateDocsRes, assignmentsRes, documentsRes] = await Promise.all([
      supabase.from('contract_templates').select('id, name, sequence_order, created_at').order('sequence_order'),
      supabase
        .from('contract_template_documents')
        .select(
          'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url, updated_at',
        )
        .order('template_id')
        .order('sequence_order'),
      supabase.from('person_contract_assignments').select('id, person_name, template_id'),
      supabase
        .from('person_contract_documents')
        .select(
          'id, person_name, document_name, url, signing_body_html, signing_body_format, canonical_document_url, status, signed_at, sent_at, note, dashboard_prompt_after_clock_in, applied_contract_template_document_id, contract_lineage_id, lineage_version, supersedes_person_contract_document_id',
        ),
    ])
    setContractsLoading(false)
    if (templatesRes.error) setContractsError(templatesRes.error.message)
    else if (templateDocsRes.error) setContractsError(templateDocsRes.error.message)
    else if (assignmentsRes.error) setContractsError(assignmentsRes.error.message)
    else if (documentsRes.error) setContractsError(documentsRes.error.message)
    else {
      setContractTemplates((templatesRes.data ?? []) as ContractTemplate[])
      setContractTemplateDocuments((templateDocsRes.data ?? []) as ContractTemplateDocument[])
      setPersonContractAssignments((assignmentsRes.data ?? []) as PersonContractAssignment[])
      setPersonContractDocuments((documentsRes.data ?? []) as PersonContractDocument[])
    }
  }

  const loadWriteupsData = useCallback(async () => {
    setWriteupsLoading(true)
    setWriteupsError(null)
    try {
      const tplRows = await withSupabaseRetry(
        async () =>
          await supabase
            .from('writeup_templates')
            .select('id, name, description, is_active, schema, created_at')
            .order('name'),
        'fetch writeup templates'
      )
      const list = (tplRows ?? []) as WriteupTemplateRow[]
      setWriteupTemplatesRows(list)
      const tplMap = new Map(list.map((t) => [t.id, t.name]))
      const [wRows, incidentRows] = await Promise.all([
        withSupabaseRetry(
          async () =>
            await supabase
              .from('writeups')
              .select(
                'id, template_id, subject_user_id, filled_by_user_id, status, disclosure, answers, submitted_at, created_at'
              )
              .order('created_at', { ascending: false }),
          'fetch writeups'
        ),
        withSupabaseRetry(
          async () =>
            await supabase
              .from('attendance_incidents')
              .select('id, subject_user_id, work_date, created_by_user_id, created_at, metadata, details')
              .eq('incident_type', 'no_call_no_show')
              .order('created_at', { ascending: false }),
          'fetch attendance incidents ncns'
        ),
      ])
      setWriteupsRows(
        (wRows ?? []).map((r) => ({
          id: r.id,
          template_id: r.template_id,
          template_name: tplMap.get(r.template_id) ?? '—',
          subject_user_id: r.subject_user_id,
          subject_name: users.find((u) => u.id === r.subject_user_id)?.name ?? 'Unknown',
          filled_by_user_id: r.filled_by_user_id,
          author_name: users.find((u) => u.id === r.filled_by_user_id)?.name ?? 'Unknown',
          status: r.status as 'draft' | 'submitted',
          disclosure: r.disclosure ?? null,
          submitted_at: r.submitted_at ?? null,
          created_at: r.created_at,
          answers: r.answers,
        }))
      )
      setNcnsRows(
        (incidentRows ?? []).map((r) => {
          let hadApproved = false
          let source: string | null = null
          const meta = r.metadata
          if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
            const o = meta as Record<string, unknown>
            if (o.had_approved_sessions === true) hadApproved = true
            if (typeof o.source === 'string') source = o.source
          }
          return {
            id: r.id,
            subject_user_id: r.subject_user_id,
            subject_name: users.find((u) => u.id === r.subject_user_id)?.name ?? 'Unknown',
            created_by_user_id: r.created_by_user_id,
            author_name: users.find((u) => u.id === r.created_by_user_id)?.name ?? 'Unknown',
            work_date: r.work_date,
            created_at: r.created_at,
            had_approved_sessions: hadApproved,
            source,
            details: r.details ?? null,
          }
        })
      )
    } catch (e) {
      setWriteupsError(e instanceof Error ? e.message : 'Failed to load writeups')
      setNcnsRows([])
    } finally {
      setWriteupsLoading(false)
    }
  }, [users])

  function getAggregateStatusForTemplate(personName: string, templateId: string): 'red' | 'yellow' | 'green' | null {
    const templateDocNames = new Set(
      contractTemplateDocuments.filter((d) => d.template_id === templateId).map((d) => d.document_name),
    )
    const rows = getDocumentsForPerson(personName).filter((r) => templateDocNames.has(r.document_name))
    return getAggregateStatus(rows)
  }

  /** Contract Book rows that match document name and one of the person’s assigned templates (for Applied version picker). */
  function listAppliedContractBookVersionOptions(
    personName: string,
    documentNameTrimmed: string,
  ): { value: string; label: string }[] {
    const dn = documentNameTrimmed.trim()
    if (!personName.trim() || !dn) return []
    const assignedIds = new Set(
      personContractAssignments.filter((a) => a.person_name === personName).map((a) => a.template_id),
    )
    const templateNameById = new Map(contractTemplates.map((t) => [t.id, t.name]))
    const rows: { value: string; label: string }[] = []
    for (const td of contractTemplateDocuments) {
      if (td.document_name !== dn) continue
      if (!assignedIds.has(td.template_id)) continue
      const tname = templateNameById.get(td.template_id) ?? td.template_id
      const u = td.updated_at
      const datePart = u ? formatContractBookLastEditedCalendarDate(u) : '—'
      rows.push({ value: td.id, label: `${tname} · ${datePart}` })
    }
    rows.sort((a, b) => a.label.localeCompare(b.label))
    return rows
  }

  function resolveAppliedContractTemplateDocIdForSave(
    personName: string,
    documentName: string,
    chosenRaw: string,
  ): string | null {
    const chosen = chosenRaw.trim()
    if (!chosen) return null
    const allowed = new Set(listAppliedContractBookVersionOptions(personName, documentName).map((o) => o.value))
    return allowed.has(chosen) ? chosen : null
  }

  function getDocumentsForPerson(personName: string): PersonContractTableRow[] {
    const assignedTemplateIds = personContractAssignments.filter((a) => a.person_name === personName).map((a) => a.template_id)
    const docNamesFromTemplates = new Set<string>()
    const docToTemplateNames = new Map<string, string[]>()
    const docNameToBookUpdated = new Map<string, string>()
    for (const tid of assignedTemplateIds) {
      const template = contractTemplates.find((t) => t.id === tid)
      const templateName = template?.name ?? ''
      for (const td of contractTemplateDocuments.filter((d) => d.template_id === tid)) {
        docNamesFromTemplates.add(td.document_name)
        const arr = docToTemplateNames.get(td.document_name) ?? []
        if (!arr.includes(templateName)) arr.push(templateName)
        docToTemplateNames.set(td.document_name, arr)
        const u = td.updated_at
        if (u) {
          const prev = docNameToBookUpdated.get(td.document_name)
          if (!prev || u > prev) docNameToBookUpdated.set(td.document_name, u)
        }
      }
    }

    const rowsP = personContractDocuments.filter((d) => d.person_name === personName)
    const byLineage = new Map<string, PersonContractDocument[]>()
    for (const r of rowsP) {
      const arr = byLineage.get(r.contract_lineage_id) ?? []
      arr.push(r)
      byLineage.set(r.contract_lineage_id, arr)
    }

    const bookForVersion = (document_name: string, doc: PersonContractDocument | null): string | null => {
      if (!doc) return docNameToBookUpdated.get(document_name) ?? null
      const pinId = doc.applied_contract_template_document_id ?? null
      let bookLastEditedAt: string | null = null
      if (pinId) {
        const pinned = contractTemplateDocuments.find((d) => d.id === pinId)
        const pinOk =
          pinned &&
          pinned.document_name === document_name &&
          assignedTemplateIds.includes(pinned.template_id)
        if (pinOk && pinned.updated_at) {
          bookLastEditedAt = pinned.updated_at
        }
      }
      if (bookLastEditedAt == null) {
        bookLastEditedAt = docNameToBookUpdated.get(document_name) ?? null
      }
      return bookLastEditedAt
    }

    const tableRows: PersonContractTableRow[] = []
    for (const [, vers] of byLineage) {
      const sorted = [...vers].sort((a, b) => b.lineage_version - a.lineage_version)
      const document_name = sorted[0]!.document_name
      const templateNames = docToTemplateNames.get(document_name) ?? []
      for (const v of sorted) {
        tableRows.push({
          document_name,
          lineageId: v.contract_lineage_id,
          templateNames,
          bookLastEditedAt: bookForVersion(document_name, v),
          version: v,
        })
      }
    }

    const namesWithRows = new Set(rowsP.map((r) => r.document_name))
    for (const document_name of docNamesFromTemplates) {
      if (namesWithRows.has(document_name)) continue
      tableRows.push({
        document_name,
        lineageId: null,
        templateNames: docToTemplateNames.get(document_name) ?? [],
        bookLastEditedAt: docNameToBookUpdated.get(document_name) ?? null,
        version: null,
      })
    }

    tableRows.sort((a, b) => {
      const c = a.document_name.localeCompare(b.document_name)
      if (c !== 0) return c
      const va = a.version?.lineage_version ?? 0
      const vb = b.version?.lineage_version ?? 0
      return vb - va
    })
    return tableRows
  }

  function getAggregateStatus(docs: PersonContractTableRow[]): 'red' | 'yellow' | 'green' | null {
    if (docs.length === 0) return null
    const statuses = docs.map((d) => d.version?.status ?? 'unsent')
    if (statuses.some((s) => s === 'unsent')) return 'red'
    if (statuses.some((s) => s === 'sent')) return 'yellow'
    return 'green'
  }

  const contractsPersonNamesSorted = useMemo(() => {
    return [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])]
      .filter((n): n is string => Boolean(n?.trim()))
      .sort((a, b) => a.localeCompare(b))
  }, [people, users])

  const contractsSearchNormalized = useMemo(() => contractsSearchQuery.trim().toLowerCase(), [contractsSearchQuery])

  const contractsPersonNamesFiltered = useMemo(() => {
    if (!contractsSearchNormalized) return contractsPersonNamesSorted
    return contractsPersonNamesSorted.filter((personName) => {
      if (personName.toLowerCase().includes(contractsSearchNormalized)) return true
      return getDocumentsForPerson(personName).some(({ document_name }) =>
        document_name.toLowerCase().includes(contractsSearchNormalized),
      )
    })
  }, [
    contractsPersonNamesSorted,
    contractsSearchNormalized,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])

  const contractDocumentSearchLines = useMemo(() => {
    if (!contractsSearchNormalized) return []
    const lines: { personName: string; document_name: string; status: string }[] = []
    for (const personName of contractsPersonNamesSorted) {
      for (const row of getDocumentsForPerson(personName)) {
        if (row.document_name.toLowerCase().includes(contractsSearchNormalized)) {
          lines.push({
            personName,
            document_name: row.document_name,
            status: row.version?.status ?? 'unsent',
          })
        }
      }
    }
    lines.sort(
      (a, b) => a.personName.localeCompare(b.personName) || a.document_name.localeCompare(b.document_name),
    )
    return lines
  }, [
    contractsSearchNormalized,
    contractsPersonNamesSorted,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])

  const contractSendEmailPreview = useMemo(() => {
    if (!contractSendDocId) return null
    const doc = personContractDocuments.find((d) => d.id === contractSendDocId)
    if (!doc) return { kind: 'missing' as const }
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin.replace(/\/$/, '')
        : 'https://pipetooling.github.io'
    const linkPlaceholder = `${origin}/contract/accept?t=…`
    return {
      kind: 'ok' as const,
      ...buildContractSendEmailPreview({
        documentName: doc.document_name,
        personName: doc.person_name,
        emailSubject: contractSendSubject,
        emailIntroPlain: contractSendIntro,
        linkPlaceholder,
      }),
    }
  }, [contractSendDocId, personContractDocuments, contractSendSubject, contractSendIntro])

  function getContractDocumentUpsertPayload():
    | { error: string }
    | {
        payload: {
          person_name: string
          document_name: string
          url: string | null
          signing_body_html: string | null
          signing_body_format: ContractBodyFormat
          canonical_document_url: string | null
          status: 'unsent' | 'sent' | 'signed'
          signed_at: string | null
          note: string | null
          dashboard_prompt_after_clock_in: boolean
          applied_contract_template_document_id: string | null
        }
      } {
    const personName = contractDocumentFormPersonName.trim()
    const documentName = contractDocumentFormDocumentName.trim()
    if (!personName || !documentName) {
      return { error: 'Person and document name are required.' }
    }
    const isAddRequestSignatureTab =
      !editingContractDocument && contractDocumentAddTab === 'request_signature'
    const isAddUploadSignedTab =
      !editingContractDocument && contractDocumentAddTab === 'upload_signed'
    const statusForSave: 'unsent' | 'sent' | 'signed' = isAddRequestSignatureTab
      ? 'unsent'
      : isAddUploadSignedTab
        ? 'signed'
        : contractDocumentFormStatus
    const dashboardForSave =
      isAddUploadSignedTab
        ? false
        : contractDocumentFormStatus === 'signed'
          ? false
          : contractDocumentFormDashboardPrompt
    const signingBodyFormatForSave: ContractBodyFormat = isAddUploadSignedTab ? 'html' : contractDocumentFormSigningBodyFormat
    const signingBodyStored = isAddUploadSignedTab
      ? null
      : normalizeContractBodyForSave(contractDocumentFormSigningBodyHtml, contractDocumentFormSigningBodyFormat)
    const appliedId =
      isAddUploadSignedTab
        ? null
        : resolveAppliedContractTemplateDocIdForSave(
            personName,
            documentName,
            contractDocumentFormAppliedTemplateDocId,
          )
    return {
      payload: {
        person_name: personName,
        document_name: documentName,
        url: isAddRequestSignatureTab ? null : contractDocumentFormUrl.trim() || null,
        signing_body_html: signingBodyStored,
        signing_body_format: signingBodyFormatForSave,
        canonical_document_url: isAddUploadSignedTab ? null : contractDocumentFormCanonicalUrl.trim() || null,
        status: statusForSave,
        signed_at: isAddRequestSignatureTab ? null : contractDocumentFormSignedAt.trim() || null,
        note: isAddRequestSignatureTab ? null : contractDocumentFormNote.trim() || null,
        dashboard_prompt_after_clock_in: dashboardForSave,
        applied_contract_template_document_id: appliedId,
      },
    }
  }

  const handlePickContractFromBook = useCallback(
    (entry: ContractBookTemplateDocument) => {
      setContractDocumentFormSigningBodyHtml(entry.book_body_html ?? '')
      setContractDocumentFormSigningBodyFormat(parseContractBodyFormat(entry.book_body_format))
      setContractDocumentFormDocumentName((prev) => (prev.trim() ? prev : entry.document_name))
      setContractDocumentFormCanonicalUrl((prev) =>
        prev.trim() ? prev : entry.canonical_document_url?.trim() ?? '',
      )
      setContractDocumentFormAppliedTemplateDocId(entry.id)
      setContractBookModalOpen(false)
      showToast('Contract details loaded from library.', 'success')
    },
    [showToast],
  )

  const contractBookPickFromDocumentModal =
    contractDocumentModalOpen &&
    (Boolean(editingContractDocument) || contractDocumentAddTab === 'request_signature')

  async function saveContractDocument() {
    const built = getContractDocumentUpsertPayload()
    if ('error' in built) {
      setContractsError(built.error)
      return
    }
    setContractDocumentFormSaving(true)
    setContractsError(null)
    try {
      const p = built.payload
      if (editingContractDocument) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .update({
                url: p.url,
                signing_body_html: p.signing_body_html,
                signing_body_format: p.signing_body_format,
                canonical_document_url: p.canonical_document_url,
                status: p.status,
                signed_at: p.signed_at,
                note: p.note,
                dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
                applied_contract_template_document_id: p.applied_contract_template_document_id,
              })
              .eq('id', editingContractDocument.id)
              .select('id')
              .single(),
          'save contract document',
        )
      } else {
        const lid = globalThis.crypto.randomUUID()
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .insert({
                person_name: p.person_name,
                document_name: p.document_name,
                contract_lineage_id: lid,
                lineage_version: 1,
                supersedes_person_contract_document_id: null,
                url: p.url,
                signing_body_html: p.signing_body_html,
                signing_body_format: p.signing_body_format,
                canonical_document_url: p.canonical_document_url,
                status: p.status,
                signed_at: p.signed_at,
                note: p.note,
                dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
                applied_contract_template_document_id: p.applied_contract_template_document_id,
              })
              .select('id')
              .single(),
          'save contract document',
        )
      }
      setContractDocumentModalOpen(false)
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save document')
    } finally {
      setContractDocumentFormSaving(false)
    }
  }

  async function toggleContractDashboardPrompt(docId: string, next: boolean) {
    setContractDashboardPromptSavingId(docId)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('person_contract_documents').update({ dashboard_prompt_after_clock_in: next }).eq('id', docId),
        'toggle contract dashboard prompt',
      )
      await loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setContractDashboardPromptSavingId(null)
    }
  }

  function openContractDocumentEditModal(
    personNameForEdit: string,
    documentNameForEdit: string,
    docRow: PersonContractDocument,
  ) {
    setEditingContractDocument(docRow)
    setContractDocumentFormPersonName(personNameForEdit)
    setContractDocumentFormDocumentName(documentNameForEdit)
    setContractDocumentFormUrl(docRow.url ?? '')
    setContractDocumentFormSigningBodyHtml(docRow.signing_body_html ?? '')
    setContractDocumentFormSigningBodyFormat(parseContractBodyFormat(docRow.signing_body_format))
    setContractDocumentFormCanonicalUrl(docRow.canonical_document_url ?? '')
    setContractDocumentFormStatus((docRow.status as 'unsent' | 'sent' | 'signed') ?? 'unsent')
    setContractDocumentFormSignedAt(docRow.signed_at ?? '')
    setContractDocumentFormNote(docRow.note ?? '')
    setContractDocumentFormDashboardPrompt(!!docRow.dashboard_prompt_after_clock_in)
    setContractDocumentFormAppliedTemplateDocId(
      (() => {
        const pin = docRow.applied_contract_template_document_id ?? ''
        const opts = listAppliedContractBookVersionOptions(personNameForEdit, documentNameForEdit)
        return pin && opts.some((o) => o.value === pin) ? pin : ''
      })(),
    )
    setCanonicalUrlCheckStatus('idle')
    setCanonicalUrlCheckMessage('')
    setContractDocumentModalOpen(true)
  }

  async function deleteContractDocument() {
    if (!contractDocumentDeleteTarget || !isDeletablePersonContractStatus(contractDocumentDeleteTarget.status)) return
    const deletedId = contractDocumentDeleteTarget.id
    setContractDocumentDeleting(true)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('person_contract_documents').delete().eq('id', deletedId),
        'delete contract document',
      )
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      if (editingContractDocument?.id === deletedId) {
        setContractDocumentModalOpen(false)
        setEditingContractDocument(null)
      }
      showToast('Document deleted.', 'success')
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to delete document')
    } finally {
      setContractDocumentDeleting(false)
    }
  }

  async function saveContractDocumentAndOpenSend() {
    if (editingContractDocument || contractDocumentAddTab !== 'request_signature') return
    const built = getContractDocumentUpsertPayload()
    if ('error' in built) {
      setContractsError(built.error)
      return
    }
    if (
      !hasContractSigningContent({
        signing_body_html: built.payload.signing_body_html,
        canonical_document_url: built.payload.canonical_document_url,
        url: built.payload.url,
      })
    ) {
      setContractsError(
        'Add contract text, a canonical document URL, or a reference link before sending for signature.',
      )
      return
    }
    setContractDocumentFormSaving(true)
    setContractsError(null)
    try {
      const p = built.payload
      const lid = globalThis.crypto.randomUUID()
      const row = await withSupabaseRetry<{ id: string }>(
        async () =>
          supabase
            .from('person_contract_documents')
            .insert({
              person_name: p.person_name,
              document_name: p.document_name,
              contract_lineage_id: lid,
              lineage_version: 1,
              supersedes_person_contract_document_id: null,
              url: p.url,
              signing_body_html: p.signing_body_html,
              signing_body_format: p.signing_body_format,
              canonical_document_url: p.canonical_document_url,
              status: p.status,
              signed_at: p.signed_at,
              note: p.note,
              dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
              applied_contract_template_document_id: p.applied_contract_template_document_id,
            })
            .select('id')
            .single(),
        'save contract document',
      )
      if (!row.id) {
        setContractsError('Could not save document.')
        return
      }
      setContractDocumentModalOpen(false)
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      setContractSendDocId(row.id)
      setContractSendEmail('')
      setContractSendSubject('')
      setContractSendIntro('')
      setContractsError(null)
      setContractSendModalOpen(true)
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save document')
    } finally {
      setContractDocumentFormSaving(false)
    }
  }

  async function sendContractForSignature() {
    if (!contractSendDocId || !contractSendEmail.trim()) {
      setContractsError('Enter a valid signer email.')
      return
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(contractSendEmail.trim())) {
      setContractsError('Enter a valid email address.')
      return
    }
    setContractSendSaving(true)
    setContractsError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setContractsError('Not signed in.')
        return
      }
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-for-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
            apikey: anon,
          },
          body: JSON.stringify({
            person_contract_document_id: contractSendDocId,
            signer_email: contractSendEmail.trim(),
            public_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            ...(contractSendSubject.trim()
              ? { email_subject: contractSendSubject.trim() }
              : {}),
            ...(contractSendIntro.trim()
              ? { email_intro_plain: contractSendIntro.trim() }
              : {}),
          }),
        },
      )
      const json = (await res.json()) as {
        ok?: boolean
        accept_url?: string
        emailed?: boolean
        email_error?: string
        warning?: string
        error?: string
      }
      if (!res.ok || !json.ok) {
        setContractsError(json.error || 'Send failed')
        return
      }
      showToast(
        json.emailed
          ? 'Signing link emailed.'
          : json.warning || json.email_error
            ? `Link ready${json.accept_url ? ` — ${json.accept_url}` : ''}`
            : 'Signing link created.',
        json.emailed ? 'success' : 'info',
      )
      setContractSendModalOpen(false)
      setContractSendDocId(null)
      setContractSendEmail('')
      setContractSendSubject('')
      setContractSendIntro('')
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setContractSendSaving(false)
    }
  }

  function openTemplateForm(template?: ContractTemplate) {
    setEditingContractTemplate(template ?? null)
    setTemplateFormName(template?.name ?? '')
    setTemplateFormDocumentNames(
      template ? contractTemplateDocuments.filter((d) => d.template_id === template.id).map((d) => d.document_name).sort() : []
    )
    setTemplateFormDocumentSourceByName({})
    setTemplateBookPickerValue('')
    setTemplateFormMode(template ? 'edit' : 'create')
  }

  function closeTemplateForm() {
    setEditingContractTemplate(null)
    setTemplateFormName('')
    setTemplateFormDocumentNames([])
    setTemplateFormDocumentSourceByName({})
    setTemplateBookPickerValue('')
    setTemplateFormMode('none')
  }

  /** New template documents must come from Contract Book (picker maps name → source row id). */
  function templateFormBookSourceValidationError(docNamesRequiringSource: string[]): string | null {
    for (const docName of docNamesRequiringSource) {
      const sourceId = templateFormDocumentSourceByName[docName]
      if (!sourceId) {
        return 'Each document must be added from Contract Book using the dropdown (pick an existing library entry).'
      }
      const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)
      if (!sourceRow) {
        return 'A selected Contract Book entry is no longer available. Refresh the page and add documents from the library again.'
      }
    }
    return null
  }

  async function saveTemplate() {
    const name = templateFormName.trim()
    if (!name) {
      setContractsError('Template name is required.')
      return
    }
    setTemplateFormSaving(true)
    setContractsError(null)
    try {
      if (editingContractTemplate) {
        const templateId = editingContractTemplate.id
        const existing = contractTemplateDocuments.filter((d) => d.template_id === templateId).map((d) => d.document_name)
        const toAdd = templateFormDocumentNames.filter((n) => !existing.includes(n))
        const bookErrEdit = templateFormBookSourceValidationError(toAdd)
        if (bookErrEdit) {
          setContractsError(bookErrEdit)
          return
        }
        await withSupabaseRetry(
          async () => supabase.from('contract_templates').update({ name }).eq('id', templateId),
          'update contract template'
        )
        const toRemove = existing.filter((n) => !templateFormDocumentNames.includes(n))
        const assignees = personContractAssignments.filter((a) => a.template_id === templateId)
        for (const docName of toRemove) {
          for (const a of assignees) {
            const pcds = personContractDocuments.filter((d) => d.person_name === a.person_name && d.document_name === docName)
            for (const pcd of pcds) {
              if (!personContractDocumentHasStaffData(pcd)) {
                await withSupabaseRetry(
                  async () => supabase.from('person_contract_documents').delete().eq('id', pcd.id),
                  'remove empty person contract document'
                )
              }
            }
          }
          const doc = contractTemplateDocuments.find((d) => d.template_id === templateId && d.document_name === docName)
          if (doc) {
            await withSupabaseRetry(
              async () => supabase.from('contract_template_documents').delete().eq('id', doc.id),
              'remove template document'
            )
          }
        }
        for (let i = 0; i < toAdd.length; i++) {
          const docName = toAdd[i]!
          const sourceId = templateFormDocumentSourceByName[docName]!
          const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
          const insertRow: {
            template_id: string
            document_name: string
            sequence_order: number
            book_body_html?: string | null
            book_body_format?: string
            tags?: string[]
            canonical_document_url?: string | null
          } = {
            template_id: templateId,
            document_name: docName,
            sequence_order: i,
            book_body_html: sourceRow.book_body_html,
            book_body_format: sourceRow.book_body_format,
            tags: sourceRow.tags ?? [],
            canonical_document_url: sourceRow.canonical_document_url?.trim() ? sourceRow.canonical_document_url : null,
          }
          await withSupabaseRetry(
            async () => supabase.from('contract_template_documents').insert(insertRow),
            'add template document'
          )
        }
        for (const docName of toAdd) {
          const sourceId = templateFormDocumentSourceByName[docName]!
          const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
          for (const a of assignees) {
            await withSupabaseRetry(
              async () =>
                supabase.from('person_contract_documents').insert({
                  person_name: a.person_name,
                  document_name: docName,
                  contract_lineage_id: globalThis.crypto.randomUUID(),
                  lineage_version: 1,
                  supersedes_person_contract_document_id: null,
                  status: 'unsent',
                  signing_body_format: 'html',
                  canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
                }),
              'backfill person contract documents'
            )
          }
        }
      } else {
        const bookErrNew = templateFormBookSourceValidationError(templateFormDocumentNames)
        if (bookErrNew) {
          setContractsError(bookErrNew)
          return
        }
        const inserted = await withSupabaseRetry(
          async () => supabase.from('contract_templates').insert({ name, sequence_order: contractTemplates.length }).select('id').single(),
          'create contract template'
        )
        const templateId = (inserted as { id: string } | null)?.id
        if (templateId) {
          const tid = templateId
          for (let i = 0; i < templateFormDocumentNames.length; i++) {
            const docName = templateFormDocumentNames[i]!
            const sourceId = templateFormDocumentSourceByName[docName]!
            const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
            const insertRow: {
              template_id: string
              document_name: string
              sequence_order: number
              book_body_html?: string | null
              book_body_format?: string
              tags?: string[]
              canonical_document_url?: string | null
            } = {
              template_id: tid,
              document_name: docName,
              sequence_order: i,
              book_body_html: sourceRow.book_body_html,
              book_body_format: sourceRow.book_body_format,
              tags: sourceRow.tags ?? [],
              canonical_document_url: sourceRow.canonical_document_url?.trim() ? sourceRow.canonical_document_url : null,
            }
            await withSupabaseRetry(
              async () => supabase.from('contract_template_documents').insert(insertRow),
              'add template document'
            )
          }
        }
      }
      closeTemplateForm()
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save template')
    } finally {
      setTemplateFormSaving(false)
    }
  }

  async function deleteContractTemplate(template: ContractTemplate) {
    if (!confirm(`Delete template "${template.name}"? This will remove the template and its document list.`)) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('contract_templates').delete().eq('id', template.id),
        'delete contract template'
      )
      loadContracts()
      if (editingContractTemplate?.id === template.id) closeTemplateForm()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to delete template')
    }
  }

  const [assignTemplateSelectedId, setAssignTemplateSelectedId] = useState<string | null>(null)
  const [assignTemplateSearchQuery, setAssignTemplateSearchQuery] = useState('')
  const [assignTemplateSaving, setAssignTemplateSaving] = useState(false)
  const [assignTemplateUnassigningTemplateId, setAssignTemplateUnassigningTemplateId] = useState<string | null>(null)

  const filteredAssignContractTemplates = useMemo(() => {
    const q = assignTemplateSearchQuery.trim().toLowerCase()
    if (!q) return contractTemplates
    return contractTemplates.filter((t) => t.name.toLowerCase().includes(q))
  }, [contractTemplates, assignTemplateSearchQuery])

  useEffect(() => {
    if (assignTemplateSelectedId == null) return
    if (!filteredAssignContractTemplates.some((t) => t.id === assignTemplateSelectedId)) {
      setAssignTemplateSelectedId(null)
    }
  }, [filteredAssignContractTemplates, assignTemplateSelectedId])

  async function assignTemplateToPerson() {
    const personName = selectedContractsPersonName
    const templateId = assignTemplateSelectedId
    if (!personName || !templateId) {
      setContractsError('Please select a template.')
      return
    }
    const alreadyAssigned = personContractAssignments.some((a) => a.person_name === personName && a.template_id === templateId)
    if (alreadyAssigned) {
      setContractsError('This template is already assigned to this person.')
      return
    }
    setAssignTemplateSaving(true)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('person_contract_assignments').insert({ person_name: personName, template_id: templateId }),
        'assign template to person'
      )
      const templateDocs = contractTemplateDocuments.filter((d) => d.template_id === templateId)
      for (const td of templateDocs) {
        const candidates = personContractDocuments.filter(
          (d) => d.person_name === personName && d.document_name === td.document_name,
        )
        const existing =
          candidates.length === 0
            ? undefined
            : [...candidates].sort((a, b) => b.lineage_version - a.lineage_version)[0]
        const fillSigningFromBook = !existing?.signing_body_html?.trim()
        if (existing) {
          const updatePayload = fillSigningFromBook
            ? {
                canonical_document_url: td.canonical_document_url?.trim() || null,
                signing_body_html: td.book_body_html ?? null,
                signing_body_format: td.book_body_format,
                applied_contract_template_document_id: td.id,
              }
            : {
                canonical_document_url: td.canonical_document_url?.trim() || null,
                applied_contract_template_document_id: td.id,
              }
          await withSupabaseRetry(
            async () =>
              supabase.from('person_contract_documents').update(updatePayload).eq('id', existing.id),
            'create person contract documents',
          )
        } else {
          const lid = globalThis.crypto.randomUUID()
          await withSupabaseRetry(
            async () =>
              supabase.from('person_contract_documents').insert({
                person_name: personName,
                document_name: td.document_name,
                contract_lineage_id: lid,
                lineage_version: 1,
                supersedes_person_contract_document_id: null,
                status: 'unsent',
                canonical_document_url: td.canonical_document_url?.trim() || null,
                signing_body_html: fillSigningFromBook ? td.book_body_html ?? null : null,
                signing_body_format: fillSigningFromBook ? td.book_body_format : 'html',
                applied_contract_template_document_id: td.id,
              }),
            'create person contract documents',
          )
        }
      }
      setContractsAssignModalOpen(false)
      setAssignTemplateSelectedId(null)
      setAssignTemplateSearchQuery('')
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to assign template')
    } finally {
      setAssignTemplateSaving(false)
    }
  }

  async function unassignTemplateFromPerson(templateId: string) {
    const personName = selectedContractsPersonName
    if (!personName) return
    const assignment = personContractAssignments.find((a) => a.person_name === personName && a.template_id === templateId)
    if (!assignment) {
      setContractsError('That template is not assigned to this person.')
      return
    }
    setAssignTemplateUnassigningTemplateId(templateId)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('person_contract_assignments').delete().eq('id', assignment.id),
        'unassign contract template',
      )
      const pinnedIdsFromThisTemplate = contractTemplateDocuments
        .filter((d) => d.template_id === templateId)
        .map((d) => d.id)
      if (pinnedIdsFromThisTemplate.length > 0) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .update({ applied_contract_template_document_id: null })
              .eq('person_name', personName)
              .in('applied_contract_template_document_id', pinnedIdsFromThisTemplate),
          'clear applied contract template pin on unassign',
        )
      }
      const templateDocNames = contractTemplateDocuments.filter((d) => d.template_id === templateId)
      for (const td of templateDocNames) {
        const pcds = personContractDocuments.filter(
          (d) => d.person_name === personName && d.document_name === td.document_name,
        )
        for (const pcd of pcds) {
          if (!personContractDocumentHasStaffData(pcd)) {
            await withSupabaseRetry(
              () => supabase.from('person_contract_documents').delete().eq('id', pcd.id),
              'remove empty person contract document after unassign',
            )
          }
        }
      }
      showToast('Template unassigned.', 'success')
      await loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to unassign template')
    } finally {
      setAssignTemplateUnassigningTemplateId(null)
    }
  }

  function openLicenseForm(personName?: string, license?: PersonLicense) {
    setEditingLicense(license ?? null)
    setLicensePersonName(personName ?? license?.person_name ?? '')
    setLicenseType(license?.license_type ?? '')
    setLicenseNote(license?.note ?? '')
    setLicenseDateOfExpiry(license?.date_of_expiry ?? new Date().toLocaleDateString('en-CA'))
    setLicenseFormOpen(true)
  }

  function closeLicenseForm() {
    setLicenseFormOpen(false)
    setEditingLicense(null)
    setLicensePersonName('')
    setLicenseType('')
    setLicenseNote('')
    setLicenseDateOfExpiry(new Date().toLocaleDateString('en-CA'))
  }

  function openCostLineForm(licenseId: string, line?: PersonLicenseCostLine) {
    setCostLineLicenseId(licenseId)
    setEditingCostLine(line ?? null)
    setCostLineAmount(line ? String(line.amount) : '')
    setCostLineNote(line?.note ?? '')
    setCostLineDate(line?.date ?? new Date().toLocaleDateString('en-CA'))
    setCostLineFormOpen(true)
  }

  function closeCostLineForm() {
    setCostLineFormOpen(false)
    setEditingCostLine(null)
    setCostLineLicenseId(null)
    setCostLineAmount('')
    setCostLineNote('')
    setCostLineDate(new Date().toLocaleDateString('en-CA'))
  }

  async function addCostLine(licenseId: string, amount: number, note: string, date: string) {
    const { error: err } = await supabase.from('person_license_cost_lines').insert({ person_license_id: licenseId, amount, note: note.trim() || null, date })
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      closeCostLineForm()
      loadLicenses()
    }
  }

  async function updateCostLine(line: PersonLicenseCostLine, amount: number, note: string, date: string) {
    const { error: err } = await supabase.from('person_license_cost_lines').update({ amount, note: note.trim() || null, date }).eq('id', line.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      closeCostLineForm()
      loadLicenses()
    }
  }

  async function deleteCostLine(line: PersonLicenseCostLine) {
    if (!window.confirm(`Delete cost line $${line.amount}?`)) return
    const { error: err } = await supabase.from('person_license_cost_lines').delete().eq('id', line.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      loadLicenses()
    }
  }

  async function maybeNotifyDispatchLicenseExpiry(licenseId: string) {
    const pLink = `${window.location.origin}/people?tab=licenses`
    try {
      const dispatchId = await withSupabaseRetry(
        async () =>
          supabase.rpc('notify_dispatch_license_expiry_if_needed', {
            p_license_id: licenseId,
            p_link: pLink,
          }),
        'notify_dispatch_license_expiry_if_needed',
      )
      if (dispatchId == null || typeof dispatchId !== 'string') return
      const { error: fnErr } = await supabase.functions.invoke('notify-dispatch-request', {
        body: { dispatch_request_id: dispatchId },
      })
      if (fnErr) {
        showToast(`License saved; Dispatch notification may have failed: ${fnErr.message}`, 'warning')
      }
    } catch (e) {
      console.warn('maybeNotifyDispatchLicenseExpiry', e)
    }
  }

  async function upsertLicense() {
    if (!licensePersonName.trim()) {
      setLicensesError('Select a person')
      return
    }
    if (!licenseType.trim()) {
      setLicensesError('License type is required')
      return
    }
    if (!licenseDateOfExpiry) {
      setLicensesError('Date of expiry is required')
      return
    }
    if (editingLicense) {
      const { error: err } = await supabase
        .from('person_licenses')
        .update({ person_name: licensePersonName.trim(), license_type: licenseType.trim(), note: licenseNote.trim() || null, date_of_expiry: licenseDateOfExpiry })
        .eq('id', editingLicense.id)
      if (err) setLicensesError(err.message)
      else {
        setLicensesError(null)
        closeLicenseForm()
        loadLicenses()
        void maybeNotifyDispatchLicenseExpiry(editingLicense.id)
      }
    } else {
      const { data: inserted, error: err } = await supabase
        .from('person_licenses')
        .insert({ person_name: licensePersonName.trim(), license_type: licenseType.trim(), note: licenseNote.trim() || null, date_of_expiry: licenseDateOfExpiry })
        .select('id')
        .single()
      if (err) setLicensesError(err.message)
      else {
        setLicensesError(null)
        closeLicenseForm()
        loadLicenses()
        if (inserted?.id) void maybeNotifyDispatchLicenseExpiry(inserted.id)
      }
    }
  }

  async function deleteLicense(l: PersonLicense) {
    if (!window.confirm(`Delete ${l.license_type} for ${l.person_name}?`)) return
    const { error: err } = await supabase.from('person_licenses').delete().eq('id', l.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      loadLicenses()
    }
  }

  useEffect(() => {
    if (activeTab === 'vehicles' && canAccessPay) {
      const t = setTimeout(() => loadVehicles(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'housing' && canAccessPay) {
      const t = setTimeout(() => void loadHousingUnits(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'offsets' && canAccessPay) {
      const t = setTimeout(() => {
        loadOffsets()
        loadPayStubs()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'licenses' && canAccessLicenses) {
      const t = setTimeout(() => {
        loadLicenses()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessLicenses])

  useEffect(() => {
    if (activeTab === 'contracts' && canAccessContracts) {
      const t = setTimeout(() => {
        loadContracts()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, canAccessContracts])

  useEffect(() => {
    if (activeTab !== 'contracts') {
      setContractSignedRecordModalDocId(null)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'writeups' || !canAccessContracts) return
    const t = window.setTimeout(() => {
      void loadWriteupsData()
    }, 80)
    return () => window.clearTimeout(t)
  }, [activeTab, canAccessContracts, loadWriteupsData])

  useEffect(() => {
    if (activeTab === 'review' && isDev) {
      const t = setTimeout(() => loadPayConfig(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, isDev])

  useEffect(() => {
    if (selectedVehicleId) {
      loadOdometerEntries(selectedVehicleId)
      loadReplacementValueEntries(selectedVehicleId)
      loadPossessions(selectedVehicleId)
    } else {
      setOdometerEntries([])
      setReplacementValueEntries([])
      setPossessions([])
    }
  }, [selectedVehicleId])

  useEffect(() => {
    if (selectedHousingId) {
      void loadHousingPossessions(selectedHousingId)
    } else {
      setHousingPossessions([])
    }
  }, [selectedHousingId])

  function loadCrewJobsForHoursRange() {
    const days = getDaysInRange(hoursDateStart, hoursDateEnd)
    if (days.length === 0) return
    void Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
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
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      if (fetchId !== draftPayrollCrewMergeFetchIdRef.current) return
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
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

  useEffect(() => {
    const hasAccess = canAccessHours || canAccessPay || canViewCostMatrixShared
    const isRelevantTab = activeTab === 'pay' || activeTab === 'hours' || activeTab === 'pay_stubs'
    if (!hasAccess || !isRelevantTab) return
    const channel = supabase
      .channel('people-hours-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people_hours' }, () => {
        loadPeopleHoursRef.current?.()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_sessions' }, () => {
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
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab, canAccessHours, canAccessPay, canViewCostMatrixShared, hoursDateStart, hoursDateEnd])

  function upsertPayConfig(personName: string, row: Partial<PayConfigRow>) {
    if (!canAccessPay) return
    const cur = payConfig[personName] ?? { person_name: personName, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false, record_hours_but_salary: false }
    const full = { person_name: personName, hourly_wage: row.hourly_wage ?? cur.hourly_wage, is_salary: row.is_salary ?? cur.is_salary, show_in_hours: row.show_in_hours ?? cur.show_in_hours, show_in_cost_matrix: row.show_in_cost_matrix ?? cur.show_in_cost_matrix, record_hours_but_salary: row.record_hours_but_salary ?? cur.record_hours_but_salary }
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
    const cur = payConfig[personName] ?? { person_name: personName, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false, record_hours_but_salary: false }
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
    // Optimistic update: show new value immediately
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, work_date: workDate, hours }]
    })
    const { error } = await supabase.from('people_hours').upsert(
      { person_name: personName, work_date: workDate, hours, entered_by: authUser?.id ?? null },
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

  /** Pending (unapproved) closed clock sessions on the Hours grid: avoids showing 0 after creating a session from manual entry until approval merges into people_hours. */
  function sumClosedPendingClockHoursForPersonDate(personName: string, workDate: string): number {
    const uid = users.find((u) => (u.name ?? '').trim() === personName.trim())?.id
    if (!uid) return 0
    let sum = 0
    for (const s of pendingClockSessions) {
      if (s.user_id !== uid || s.work_date !== workDate || s.clocked_out_at == null) continue
      const a = new Date(s.clocked_in_at).getTime()
      const b = new Date(s.clocked_out_at).getTime()
      sum += Math.max(0, (b - a) / 3_600_000)
    }
    return sum
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
          const days = getDaysInRange(matrixStartDate, matrixEndDate)
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

  const showPeopleForReview = useMemo(
    () =>
      [...Object.keys(payConfig)]
        .filter((n) => !archivedUserNames.has(n.trim()))
        .sort((a, b) => a.localeCompare(b)),
    [payConfig, archivedUserNames]
  )

  const ledgerFilteredPayStubs = useMemo(() => {
    const q = ledgerPersonSearch.trim().toLowerCase()
    if (!q) return payStubs
    return payStubs.filter((s) => s.person_name.toLowerCase().includes(q))
  }, [payStubs, ledgerPersonSearch])

  const offsetsTabSearching = offsetsTabSearch.trim().length > 0
  const filteredOffsets = useMemo(() => {
    const q = offsetsTabSearch.trim().toLowerCase()
    if (!q) return offsets
    function offsetTypeLabel(o: PersonOffset): string {
      return o.type === 'backcharge'
        ? 'Backcharge'
        : o.type === 'damage'
          ? 'Damage'
          : o.type === 'employee_credit'
            ? 'Employee credit'
            : o.type
    }
    return offsets.filter((o) => {
      const stub = o.pay_stub_id ? payStubs.find((s) => s.id === o.pay_stub_id) : null
      const statusParts =
        o.pay_stub_id
          ? stub
            ? ['applied', `${stub.period_start} – ${stub.period_end}`, `applied (${stub.period_start} – ${stub.period_end})`]
            : ['applied']
          : ['pending']
      const blob = [
        o.person_name,
        o.type,
        offsetTypeLabel(o),
        o.description ?? '',
        o.occurred_date,
        String(o.amount),
        formatCurrency(o.amount),
        ...statusParts,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [offsets, offsetsTabSearch, payStubs])

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

  /** Generate Pay Reports preview: dates where another stub (same person, overlapping period) already has installments. */
  const payPreviewOtherStubHintByDate = useMemo(() => {
    const map = new Map<string, { hintText: string; stubIds: string[] }>()
    const personName = payStubGeneratorPerson.trim()
    if (!personName || payStubPeriodStart > payStubPeriodEnd) return map
    const days = getDaysInRange(payStubPeriodStart, payStubPeriodEnd)
    const sameAsGenerator = (s: PayStubRow) =>
      s.period_start === payStubPeriodStart && s.period_end === payStubPeriodEnd
    for (const date of days) {
      const candidates = payStubs.filter((s) => {
        if (s.person_name.trim() !== personName) return false
        if (sameAsGenerator(s)) return false
        if (s.period_start > date || s.period_end < date) return false
        const paid = sumPayStubPaymentAmounts(payStubPaymentsByStubId[s.id] ?? [])
        return paid > 0
      })
      if (candidates.length === 0) continue
      candidates.sort((a, b) => {
        const ca = a.created_at ?? ''
        const cb = b.created_at ?? ''
        return cb.localeCompare(ca)
      })
      const primary = candidates[0]
      if (!primary) continue
      const periodLabel = ledgerPayPeriodShortLabel(primary.period_start, primary.period_end)
      const more = candidates.length - 1
      const stubIds = candidates.map((c) => c.id)
      const hintText =
        more > 0
          ? `Installments on report ${periodLabel} (+${more} more)`
          : `Installments on report ${periodLabel}`
      map.set(date, { hintText, stubIds })
    }
    return map
  }, [payStubGeneratorPerson, payStubPeriodStart, payStubPeriodEnd, payStubs, payStubPaymentsByStubId])

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
    // Current week's Sunday (start of this week)
    const day = today.getDay()
    const thisWeekSunday = new Date(today)
    thisWeekSunday.setDate(today.getDate() - day)
    if (reviewPeriod === 'last_week') {
      const lastWeekSunday = new Date(thisWeekSunday)
      lastWeekSunday.setDate(thisWeekSunday.getDate() - 7)
      const lastWeekSaturday = new Date(lastWeekSunday)
      lastWeekSaturday.setDate(lastWeekSunday.getDate() + 6)
      return [lastWeekSunday.toLocaleDateString('en-CA'), lastWeekSaturday.toLocaleDateString('en-CA')]
    }
    if (reviewPeriod === 'last_month') {
      const start = new Date(today)
      start.setDate(today.getDate() - 30)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    // last_two_weeks
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
    }

    const userId = users.find((u) => u.name === personName)?.id ?? null

    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const lookbackStart = twoYearsAgo.toLocaleDateString('en-CA')

    const [laborRes, allLaborResForCostAllTime, personLaborResAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').gte('job_date', lookbackStart),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', lookbackStart),
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', lookbackStart),
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      supabase.rpc('list_reports_with_job_info'),
      userId
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
    const allLaborRowsForCostAllTime = (allLaborResForCostAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const personLaborRowsAllTime = (personLaborResAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
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
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
    for (const r of allCrewRowsForCostAllTime) {
      crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewMembersByDateAndLead = new Map<string, string[]>()
    for (const r of crewRows) {
      if (!r.crew_lead_person_name) continue
      const key = `${r.work_date}:${r.crew_lead_person_name}`
      const list = crewMembersByDateAndLead.get(key) ?? []
      if (!list.includes(r.person_name)) list.push(r.person_name)
      crewMembersByDateAndLead.set(key, list)
    }
    const crewJobIds = new Set<string>()
    const crewJobsWithLead: Array<{ work_date: string; job_id: string; viaLead: string | null; pct: number }> = []
    for (const r of crewRows) {
      if (r.person_name !== personName) continue
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      for (const a of assignments) {
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, viaLead: row?.crew_lead_person_name ?? null, pct: a.pct })
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePersonAllTime[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
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

    const personLaborCostByJobId = new Map<string, number>()
    const personCrewLaborByJobId = new Map<string, number>()
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
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePersonAllTime[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
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
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePersonAllTime[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
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
        laborCost,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: Math.max(0, (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) - laborCost),
        otherTeammatesLabor: jobId ? Math.max(0, (teamLaborCostByJobId.get(jobId) ?? 0) - (personCrewLaborByJobId.get(jobId) ?? 0)) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
      }
    })

    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null }> = {}
    for (const j of crewJobsLedger) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue, pct_complete: j.pct_complete }
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
        viaLead: c.viaLead,
        crewMemberNames: c.viaLead === null ? (crewMembersByDateAndLead.get(`${c.work_date}:${personName}`) ?? []) : undefined,
        hours,
        laborCost,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0,
        otherTeammatesLabor: Math.max(0, (teamLaborCostByJobId.get(c.job_id) ?? 0) - laborCost),
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
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
      (laborHcps.length > 0 || crewJobIds.size > 0) ? supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart2Y).lte('job_date', lookbackEnd) : { data: [] },
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
    ])
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
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
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const allJobIdsForCrew = [...new Set([...crewJobIds, ...Array.from(jobIdByHcp.values())])]
    const jobIdsSet = new Set(allJobIdsForCrew)
    for (const r of allCrewRows) {
      const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (allCrewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
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

    const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = jobsById.get(jobId)
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const laborCost = subLaborCost + teamLaborCost
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - laborCost
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead })
    }
    for (const jobId of crewJobIds) {
      if (allocationJobsMap.has(jobId)) continue
      const j = jobsById.get(jobId)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const laborCost = subLaborCost + (teamLaborCostByJobId.get(jobId) ?? 0)
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - laborCost
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead })
    }

    const costOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }
    for (const j of crewJobs) {
      costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }

    const personLaborFromLaborJobsByJobId = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) personLaborFromLaborJobsByJobId.set(j.job_id, (personLaborFromLaborJobsByJobId.get(j.job_id) ?? 0) + j.laborCost)
    }
    const allocationLaborByJobId = new Map<string, number>()
    for (const [jobId, teamCost] of teamLaborCostByJobId) {
      allocationLaborByJobId.set(jobId, (personLaborFromLaborJobsByJobId.get(jobId) ?? 0) + teamCost)
    }
    for (const jobId of personLaborFromLaborJobsByJobId.keys()) {
      if (!allocationLaborByJobId.has(jobId)) allocationLaborByJobId.set(jobId, personLaborFromLaborJobsByJobId.get(jobId) ?? 0)
    }

    let allocatedRevenue = 0
    let allocatedProfit = 0
    for (const [jobId, { valueCreated, revenueBeforeOverhead }] of allocationJobsMap) {
      const allocationLabor = allocationLaborByJobId.get(jobId) ?? 0
      const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
      const ratio = allocationLabor > 0 ? costInPeriod / allocationLabor : (costInPeriod > 0 ? 1 : 0)
      allocatedRevenue += valueCreated * ratio
      allocatedProfit += revenueBeforeOverhead * ratio
    }

    for (const j of laborJobs) {
      j.totalJobHours = j.job_id ? (totalHoursOnJob.get(j.job_id) ?? 0) : 0
      j.userTotalHoursOnJob = j.job_id ? (personHoursOnJobAllTime.get(j.job_id) ?? 0) : 0
      const totalHrsAllTime = j.job_id ? (totalHoursOnJob.get(j.job_id) ?? 0) : 0
      j.userTotalContributionToBill = totalHrsAllTime > 0 ? j.valueCreated * (j.userTotalHoursOnJob / totalHrsAllTime) : (j.userTotalHoursOnJob > 0 ? j.valueCreated : 0)
      j.userTotalLaborOnJob = j.job_id ? (personLaborCostByJobId.get(j.job_id) ?? 0) : 0
      const hoursRatio = totalHrsAllTime > 0 ? j.hours / totalHrsAllTime : (j.hours > 0 ? 1 : 0)
      const allocationLabor = j.job_id ? (allocationLaborByJobId.get(j.job_id) ?? 0) : 0
      const costRatio = allocationLabor > 0 ? j.laborCost / allocationLabor : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = allocationLabor > 0 ? j.userTotalLaborOnJob / allocationLabor : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * hoursRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }
    for (const j of crewJobs) {
      j.totalJobHours = totalHoursOnJob.get(j.job_id) ?? 0
      j.userTotalHoursOnJob = personHoursOnJobAllTime.get(j.job_id) ?? 0
      const totalHrsAllTime = totalHoursOnJob.get(j.job_id) ?? 0
      j.userTotalContributionToBill = totalHrsAllTime > 0 ? j.valueCreated * (j.userTotalHoursOnJob / totalHrsAllTime) : (j.userTotalHoursOnJob > 0 ? j.valueCreated : 0)
      j.userTotalLaborOnJob = personLaborCostByJobId.get(j.job_id) ?? 0
      const hoursRatio = totalHrsAllTime > 0 ? j.hours / totalHrsAllTime : (j.hours > 0 ? 1 : 0)
      const allocationLabor = allocationLaborByJobId.get(j.job_id) ?? 0
      const costRatio = allocationLabor > 0 ? j.laborCost / allocationLabor : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = allocationLabor > 0 ? j.userTotalLaborOnJob / allocationLabor : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * hoursRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
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
    setReviewLaborJobs(laborJobs)
    setReviewCrewJobs(crewJobs)
    setReviewAllocatedRevenue(allocatedRevenue)
    setReviewAllocatedProfit(allocatedProfit)
    setReviewHours(hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })))
    setReviewReports(reports.map((r) => ({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at })))
    setReviewTasks(tasks)
    setReviewTasksOutstanding(outstandingTasks)
    setReviewLoading(false)
  }

  useEffect(() => {
    if (activeTab !== 'review' || showPeopleForReview.length === 0) return
    const idx = Math.max(0, Math.min(selectedReviewPersonIndex, showPeopleForReview.length - 1))
    if (idx !== selectedReviewPersonIndex) setSelectedReviewPersonIndex(idx)
    const personName = showPeopleForReview[idx]
    if (personName) void loadReviewData(personName, false, reviewOnlyPaidInFull)
  }, [activeTab, selectedReviewPersonIndex, reviewPeriod, reviewOnlyPaidInFull, showPeopleForReview, users])

  type TeamSummaryRow = { personName: string; profit: number; revPerHour: number; profitPerHour: number; totalHours: number }

  async function loadTeamSummaryData(): Promise<TeamSummaryRow[]> {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const rows: TeamSummaryRow[] = []
    for (const personName of showPeopleForReview) {
      const result = await loadReviewData(personName, true, reviewOnlyPaidInFull)
      if (!result) continue
      const cfg = payConfig[personName]
      const getHoursForDay = (d: string) => {
        if (!cfg) return 0
        const dayOfWeek = new Date(d + 'T12:00:00').getDay()
        return cfg.is_salary
          ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
          : (result.hoursRows.find((h) => h.work_date === d)?.hours ?? 0)
      }
      const totalHours =
        reviewOnlyPaidInFull && result.totalHoursPaidJobs !== undefined
          ? result.totalHoursPaidJobs
          : days.reduce((s, d) => s + getHoursForDay(d), 0)
      const revPerHour = totalHours > 0 ? result.allocatedRevenue / totalHours : 0
      const profitPerHour = totalHours > 0 ? result.allocatedProfit / totalHours : 0
      rows.push({
        personName,
        profit: result.allocatedProfit,
        revPerHour,
        profitPerHour,
        totalHours,
      })
    }
    return rows
  }

  function getReviewPeriodLabel(): string {
    const [start, end] = getReviewDateRange()
    const labels: Record<ReviewPeriod, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      last_week: 'Last week',
      last_two_weeks: 'Last two weeks',
      last_month: 'Last month',
    }
    return `${labels[reviewPeriod]} (${start} – ${end})`
  }

  function openTeamSummaryWindow() {
    if (showPeopleForReview.length === 0) {
      showToast('No people in pay config. Add people in Pay tab first.', 'warning')
      return
    }
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Popup blocked. Allow popups to open Team Summary.', 'warning')
      return
    }
    const loadingHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title></head><body style="font-family:sans-serif;margin:1in;"><p>Loading Team Summary…</p></body></html>'
    win.document.write(loadingHtml)
    win.document.close()
    win.focus()
    showToast('Loading Team Summary…', 'info')
    loadTeamSummaryData()
      .then((rows) => {
        try {
          const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          const tableRows = rows.map(
            (r) =>
              `<tr>
  <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb;">${escapeHtml(r.personName)}</td>
  <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Math.round(r.profit).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
  <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">${r.totalHours > 0 ? `$${Math.round(r.revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
  <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right;">${r.totalHours > 0 ? `$${Math.round(r.profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
</tr>`
          )
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title><style>
      body { font-family: sans-serif; margin: 1in; }
      h1 { margin-bottom: 0.5rem; }
      .meta { color: #6b7280; margin-bottom: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; }
      th { padding: 0.5rem 0.75rem; text-align: left; background: #f9fafb; font-weight: 600; }
      th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>Team Summary</h1>
      <div class="meta">${escapeHtml(getReviewPeriodLabel())}</div>
      <table>
        <thead><tr><th>Name</th><th>Period Profit</th><th>Rev/MH</th><th>Profit/MH</th></tr></thead>
        <tbody>${tableRows.join('\n')}</tbody>
      </table>
    </body></html>`
          win.document.open()
          win.document.write(html)
          win.document.close()
          win.focus()
        } catch (writeErr) {
          console.error('Team Summary write error:', writeErr)
          showToast('Failed to display Team Summary. The window may have been closed.', 'error')
        }
      })
      .catch((err) => {
        console.error('Team Summary load error:', err)
        const errMsg = err instanceof Error ? err.message : 'Failed to load Team Summary'
        showToast(errMsg, 'error')
        try {
          win.document.open()
          win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary - Error</title></head><body style="font-family:sans-serif;margin:1in;"><h1>Error</h1><p>${String(errMsg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></body></html>`)
          win.document.close()
        } catch {
          win.close()
        }
      })
  }

  function shiftMatrixWeek(delta: number) {
    const dStart = new Date(matrixStartDate + 'T12:00:00')
    const dEnd = new Date(matrixEndDate + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setMatrixStartDate(dStart.toLocaleDateString('en-CA'))
    setMatrixEndDate(dEnd.toLocaleDateString('en-CA'))
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

  const matrixDays = getDaysInRange(matrixStartDate, matrixEndDate)
  const hoursDays = getDaysInRange(hoursDateStart, hoursDateEnd)

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
    return !!(row.crew_lead_person_name || (row.unifiedAssignments?.length ?? 0) > 0)
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
        {(canAccessPay || canAccessHours) && (
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
            Pay History
          </button>
        )}
        {(canAccessPay || canViewCostMatrixShared) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('pay')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'pay')
                return next
              })
            }}
            style={tabStyle(activeTab === 'pay')}
          >
            Pay
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
          {USERS_TAB_SECTIONS.map((sec) => {
            if (sec.type === 'dev') {
              if (!isDev) return null
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
                if (usersTabSearchQ && devUsersFiltered.length === 0) {
                  return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No matches.</p>
                }
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
                              if (usersTabSearchQ && withAccountF.length === 0 && externalF.length === 0) {
                                return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No matches.</p>
                              }
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
                              if (usersTabSearchQ && withAccountF.length === 0 && externalF.length === 0) {
                                return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No matches.</p>
                              }
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
                            if (usersTabSearchQ && kindItemsF.length === 0) {
                              return <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No matches.</p>
                            }
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

      {activeTab === 'pay_stubs' && canAccessPay && (
        <div>
          {payStubsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
              <section style={{ marginBottom: '2rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    width: '100%',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCustomPayReportsModalOpen(true)}
                    disabled={showPeopleForHours.length === 0}
                    title={showPeopleForHours.length === 0 ? 'Go to Pay tab and check Show in Hours for people to track' : undefined}
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
                    Generate Custom Pay Report
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
                    title={showPeopleForHours.length === 0 ? 'Go to Pay tab and check Show in Hours for people to track' : undefined}
                    style={{
                      marginLeft: 'auto',
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
              </section>
              <section>
                <div style={{ marginBottom: '0.75rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Ledger</h2>
                  {payStubs.length > 0 && ledgerFilteredPayStubs.length > 0 ? (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }} aria-live="polite">
                      {ledgerOpenBalanceSummary.openCount > 0
                        ? `${ledgerOpenBalanceSummary.openCount} open · $${formatCurrency(ledgerOpenBalanceSummary.totalRemaining)} remaining`
                        : 'All paid'}
                    </p>
                  ) : null}
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
                    No pay reports yet. Use Generate Custom Pay Report or Draft Payroll.
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL }}>
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

      {customPayReportsModalOpen && activeTab === 'pay_stubs' && canAccessPay && (
        <CustomPayReportsModal
          open
          onClose={() => setCustomPayReportsModalOpen(false)}
          zIndex={Z_PEOPLE_PAY_MODAL}
          peopleNames={showPeopleForHours}
          person={payStubGeneratorPerson}
          onChangePerson={setPayStubGeneratorPerson}
          periodStart={payStubPeriodStart}
          onChangePeriodStart={setPayStubPeriodStart}
          periodEnd={payStubPeriodEnd}
          onChangePeriodEnd={setPayStubPeriodEnd}
          onGenerate={() => generatePayStub()}
          getCostForPersonDate={getCostForPersonDate}
          hoursDaysCorrect={hoursDaysCorrect}
          payPreviewOtherStubHintByDate={payPreviewOtherStubHintByDate}
          payStubs={payStubs}
          onViewStub={(stub) => void viewPayStub(stub as PayStubRow)}
          showToast={showToast}
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
          markingPayStubId={markingPayStubId}
          generatingPayStubPerson={generatingPayStubPerson}
          showToast={showToast}
          onNavigateToHoursForReviewDate={navigateToHoursForReviewDate}
        />
      )}

            {activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {payTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {canAccessPay && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '1rem',
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
            </>
          )}
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
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
          {tagLedgerModalTag && (() => {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const peopleWithTag = showPeopleForMatrix.filter((p) =>
              (costMatrixTags[p] ?? '').split(',').map((t) => t.trim()).filter(Boolean).includes(tagLedgerModalTag)
            )
            const daysInRange = getDaysInRange(matrixStartDate, matrixEndDate)
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
                      {tagLedgerModalTag} — Week of {matrixStartDate} to {matrixEndDate}
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
              startDate={matrixStartDate}
              endDate={matrixEndDate}
              hoursRows={peopleHours.filter((h) => h.person_name === personTimeDetailModalPerson).map((h) => ({ work_date: h.work_date, hours: h.hours }))}
              onClose={() => setPersonTimeDetailModalPerson(null)}
            />
          )}
          {reviewHoursModalOpen && (
            <ReviewHoursModal
              people={showPeopleForMatrix}
              initialPersonIndex={0}
              initialStartDate={matrixStartDate}
              initialEndDate={matrixEndDate}
              hoursRowsForPerson={(p) =>
                peopleHours.filter((h) => h.person_name === p).map((h) => ({ work_date: h.work_date, hours: h.hours }))
              }
              canAddToJob={canAccessPay}
              canMarkReviewed={canAccessPay}
              onReviewedChange={() => void loadHoursReviewed()}
              onClose={() => setReviewHoursModalOpen(false)}
            />
          )}
          <section id="cost-matrix">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Cost matrix</h2>
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
            {narrowViewport ? (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    aria-label="Previous week"
                    onClick={() => shiftMatrixWeek(-1)}
                    style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
                  >
                    ‹
                  </button>
                  <span style={{ fontSize: '0.875rem', textAlign: 'center', flex: 1, minWidth: 0 }}>
                    {formatDateRangeLabel(matrixStartDate, matrixEndDate)}
                  </span>
                  <button
                    type="button"
                    aria-label="Next week"
                    onClick={() => shiftMatrixWeek(1)}
                    style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
                  >
                    ›
                  </button>
                </div>
                <details style={{ marginTop: '0.35rem' }}>
                  <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: '#374151' }}>Custom dates</summary>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                    <label>
                      <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                      <input type="date" value={matrixStartDate} onChange={(e) => setMatrixStartDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                    <label>
                      <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                      <input type="date" value={matrixEndDate} onChange={(e) => setMatrixEndDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </label>
                  </div>
                </details>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label>
                  <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                  <input type="date" value={matrixStartDate} onChange={(e) => setMatrixStartDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </label>
                <label>
                  <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                  <input type="date" value={matrixEndDate} onChange={(e) => setMatrixEndDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </label>
                <button
                  type="button"
                  onClick={() => shiftMatrixWeek(-1)}
                  style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  ← last week
                </button>
                <button
                  type="button"
                  onClick={() => shiftMatrixWeek(1)}
                  style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  next week →
                </button>
              </div>
            )}
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    {canAccessPay && (
                      <th style={{ padding: '0.5rem 0.35rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb', minWidth: 36 }} title="Hours reviewed (use Review Hours to mark)">
                        ✓
                      </th>
                    )}
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: canAccessPay ? 36 : 0, background: '#f9fafb' }}>
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
                        <th key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', minWidth: 70 }}>
                          <span className="cost-matrix-date-header">
                            <span>{weekday}</span>
                            <span> {monthDay}</span>
                          </span>
                        </th>
                      )
                    })}
                  </tr>
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
          </section>
          <section>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>Teams</h2>
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
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)))}
                          onBlur={(e) => updateTeamName(team.id, e.target.value.trim() || 'New Team')}
                          style={{ padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontWeight: 600, minWidth: 100, fontSize: '0.875rem' }}
                        />
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
          </section>
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
          {isDev && (
          <section>
            <button
              type="button"
              onClick={() => setCostMatrixShareSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: costMatrixShareSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{costMatrixShareSectionOpen ? '▼' : '▶'}</span>
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
          </section>
          )}
          {canAccessPay && (
          <section>
            <button
              type="button"
              onClick={() => setCostMatrixTagColorsSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: costMatrixTagColorsSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{costMatrixTagColorsSectionOpen ? '▼' : '▶'}</span>
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
          </section>
          )}
          </>
          )}
        </div>
      )}

      {activeTab === 'hours' && canAccessHours && (
        <>
        <div>
          {hoursTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {narrowViewport ? (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => shiftHoursWeek(-1)}
                  style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
                >
                  ‹
                </button>
                <span style={{ fontSize: '0.875rem', textAlign: 'center', flex: 1, minWidth: 0 }}>
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
              <details style={{ marginTop: '0.35rem' }}>
                <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: '#374151' }}>Custom dates</summary>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                  <label>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                    <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </label>
                  <label>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                    <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </label>
                </div>
              </details>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <button
                type="button"
                onClick={() => shiftHoursWeek(-1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ← last week
              </button>
              <button
                type="button"
                onClick={() => shiftHoursWeek(1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                next week →
              </button>
            </div>
          )}
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
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No people with Show in Hours selected. Go to Pay tab and check Show in Hours for people to track.</p>
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
                    {hoursDays.map((d) => (
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
                        {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </th>
                    ))}
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
                          return (
                            <td
                              key={d}
                              title={missingJob ? missingJobTitle : undefined}
                              style={{
                                padding: '0.35rem 0.5rem',
                                textAlign: canEdit ? 'right' : 'center',
                                ...(showMyTimeCorner ? { position: 'relative' } : {}),
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
                            </td>
                          )
                        })}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {decimalToHms(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)) || '-'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)).toFixed(2)}
                        </td>
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
          )}
        </div>
        <SalariedWorkdaysBulkModal
          open={salariedWorkdaysModalOpen}
          onClose={() => setSalariedWorkdaysModalOpen(false)}
          payConfig={payConfig}
          users={users}
        />
        </>
      )}

      {activeTab === 'vehicles' && canAccessPay && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Vehicles</h2>
            <button
              type="button"
              onClick={() => openVehicleForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Vehicle
            </button>
          </div>
          {vehiclesError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{vehiclesError}</p>}
          {vehiclesLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Year</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Make</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Model</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>VIN</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Ins/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Reg/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned to</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <Fragment key={v.id}>
                      <tr
                        key={v.id}
                        style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: selectedVehicleId === v.id ? '#f0f9ff' : undefined }}
                        onClick={() => setSelectedVehicleId((prev) => (prev === v.id ? null : v.id))}
                      >
                        <td style={{ padding: '0.75rem' }}>{v.year ?? '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{v.make || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{v.model || '—'}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{v.vin ? (v.vin.length <= 8 ? v.vin : `${v.vin.slice(0, 4)}...${v.vin.slice(-4)}`) : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_insurance_cost)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_registration_cost)}</td>
                        <td style={{ padding: '0.75rem' }}>{vehicleAssignees[v.id] || '—'}</td>
                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => openVehicleForm(v)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>Edit</button>
                          <button type="button" onClick={() => deleteVehicle(v)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}>Delete</button>
                        </td>
                      </tr>
                      {selectedVehicleId === v.id && (
                        <tr key={`${v.id}-detail`}>
                          <td colSpan={8} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Odometer entries</h4>
                                <button type="button" onClick={() => { setOdometerFormOpen(true); setOdometerValue(''); setOdometerDate(new Date().toLocaleDateString('en-CA')) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add odometer entry</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                  <tbody>
                                    {odometerEntries.map((e) => (
                                      <tr key={e.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{e.odometer_value.toLocaleString()}</td>
                                        <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteOdometerEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Replacement value</h4>
                                <button type="button" onClick={() => { setReplacementValueFormOpen(true); setReplacementValueValue(''); setReplacementValueDate(new Date().toLocaleDateString('en-CA')) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add replacement value</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                  <tbody>
                                    {replacementValueEntries.map((e) => (
                                      <tr key={e.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(e.replacement_value)}</td>
                                        <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteReplacementValueEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Possessions</h4>
                                <button type="button" onClick={() => { setPossessionFormOpen(true); setPossessionUserId(''); setPossessionStartDate(new Date().toLocaleDateString('en-CA')); setPossessionEndDate('') }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Assign to user</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Start</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>End</th><th></th></tr></thead>
                                  <tbody>
                                    {possessions.map((p) => {
                                      const u = users.find((x) => x.id === p.user_id)
                                      return (
                                        <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                          <td style={{ padding: '0.5rem' }}>{u?.name ?? p.user_id.slice(0, 8)}</td>
                                          <td style={{ padding: '0.5rem' }}>{p.start_date}</td>
                                          <td style={{ padding: '0.5rem' }}>{p.end_date ?? '—'}</td>
                                          <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deletePossession(p)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                {vehicles.length > 0 && (
                  <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                    <tr>
                      <td colSpan={4} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }}>Total</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_insurance_cost ?? 0), 0))}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_registration_cost ?? 0), 0))}</td>
                      <td colSpan={2} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {vehicles.length === 0 && <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No vehicles yet. Add one to get started.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'housing' && canAccessPay && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Housing</h2>
            <button
              type="button"
              onClick={() => openHousingForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add housing
            </button>
          </div>
          {housingError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{housingError}</p>}
          {housingLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rent/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Utilities/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Insurance/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned to</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {housingUnits.map((hu) => (
                    <Fragment key={hu.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedHousingId === hu.id ? '#f0fdf4' : undefined,
                        }}
                        onClick={() => setSelectedHousingId((prev) => (prev === hu.id ? null : hu.id))}
                      >
                        <td style={{ padding: '0.75rem' }}>{hu.address || '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.rent_per_week)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.utilities_per_week)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.insurance_per_week)}</td>
                        <td style={{ padding: '0.75rem' }}>{housingAssignees[hu.id] || '—'}</td>
                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => openHousingForm(hu)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void deleteHousingUnit(hu)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                      {selectedHousingId === hu.id && (
                        <tr key={`${hu.id}-detail`}>
                          <td colSpan={6} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Assignments</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setHousingPossessionFormOpen(true)
                                  setHousingPossessionUserId('')
                                  setHousingPossessionStartDate(new Date().toLocaleDateString('en-CA'))
                                  setHousingPossessionEndDate('')
                                }}
                                style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                              >
                                + Assign to user
                              </button>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Start</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>End</th>
                                    <th />
                                  </tr>
                                </thead>
                                <tbody>
                                  {housingPossessions.map((p) => {
                                    const u = users.find((x) => x.id === p.user_id)
                                    return (
                                      <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem' }}>{u?.name ?? p.user_id.slice(0, 8)}</td>
                                        <td style={{ padding: '0.5rem' }}>{p.start_date}</td>
                                        <td style={{ padding: '0.5rem' }}>{p.end_date ?? '—'}</td>
                                        <td style={{ padding: '0.5rem' }}>
                                          <button
                                            type="button"
                                            onClick={() => void deleteHousingPossession(p)}
                                            style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}
                                          >
                                            ×
                                          </button>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                {housingUnits.length > 0 && (
                  <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                    <tr>
                      <td style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }}>Total</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                        ${formatCurrency(housingUnits.reduce((s, u) => s + (u.rent_per_week ?? 0), 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                        ${formatCurrency(housingUnits.reduce((s, u) => s + (u.utilities_per_week ?? 0), 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                        ${formatCurrency(housingUnits.reduce((s, u) => s + (u.insurance_per_week ?? 0), 0))}
                      </td>
                      <td colSpan={2} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {housingUnits.length === 0 && (
                <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No housing yet. Add a unit to assign people and show costs on pay reports.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'offsets' && canAccessPay && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Offsets</h2>
            <button
              type="button"
              onClick={() => openOffsetForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Offset
            </button>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="search"
              value={offsetsTabSearch}
              onChange={(e) => setOffsetsTabSearch(e.target.value)}
              placeholder="Search person, type, description, date, status…"
              aria-label="Search offsets"
              style={{
                flex: '1 1 220px',
                minWidth: 160,
                padding: '0.35rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
            {offsetsTabSearching ? (
              <button
                type="button"
                onClick={() => setOffsetsTabSearch('')}
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
          </div>
          {offsetsError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{offsetsError}</p>}
          {offsetsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              {offsetsTabSearching && offsets.length > 0 && filteredOffsets.length === 0 ? (
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No offsets match this search.</p>
              ) : null}
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffsets.map((o) => {
                    const stub = o.pay_stub_id ? payStubs.find((s) => s.id === o.pay_stub_id) : null
                    const offsetTypeLabel =
                      o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{o.person_name}</td>
                        <td style={{ padding: '0.75rem' }}>{offsetTypeLabel}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(o.amount)}</td>
                        <td style={{ padding: '0.75rem' }}>{o.description || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{o.occurred_date}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {o.pay_stub_id ? (
                            stub ? `Applied (${stub.period_start} – ${stub.period_end})` : 'Applied'
                          ) : (
                            'Pending'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {o.pay_stub_id ? (
                              <button
                                type="button"
                                onClick={() => unapplyOffset(o)}
                                title="Unapply"
                                aria-label="Unapply from pay stub"
                                style={{ padding: '0.35rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                </svg>
                              </button>
                            ) : o.type === 'employee_credit' ? (
                              <button
                                type="button"
                                disabled
                                title="Applying employee credit to Net Pay is not wired yet (future: Additional line on a pay stub)."
                                aria-label="Apply to pay stub unavailable for employee credit"
                                style={{
                                  padding: '0.35rem',
                                  cursor: 'not-allowed',
                                  background: '#f3f4f6',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#9ca3af',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setOffsetToApply(o); setOffsetApplyPayStubId(''); setOffsetApplyModalOpen(true) }}
                                title="Apply to pay stub"
                                aria-label="Apply to pay stub"
                                style={{ padding: '0.35rem', cursor: 'pointer', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openOffsetForm(o)}
                              title="Edit"
                              aria-label="Edit"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOffset(o)}
                              title="Delete"
                              aria-label="Delete"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {offsets.length === 0 && (
                <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>
                  No offsets yet. Add backcharges, damages, or employee credits (e.g. from Record payment) to get started.
                </p>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'licenses' && canAccessLicenses && (
        <div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Licenses</h2>
          {licensesError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{licensesError}</p>}
          {licensesLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              <section style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Licenses expiring in the next 30 days</h3>
                {licensesExpiringSoon.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No licenses expiring in the next 30 days.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>License and #</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date of Expiry</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Cost to Company</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Days left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {licensesExpiringSoon.map((l) => {
                          const today = new Date()
                          const expiry = new Date(l.date_of_expiry + 'T12:00:00')
                          const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                          return (
                            <tr key={l.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.5rem' }}>{l.person_name}</td>
                              <td style={{ padding: '0.5rem' }}>{l.license_type}</td>
                              <td style={{ padding: '0.5rem' }}>{l.date_of_expiry}</td>
                              <td style={{ padding: '0.5rem' }}>{costLinesTotal(l.person_license_cost_lines) > 0 ? `$${costLinesTotal(l.person_license_cost_lines).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{daysLeft}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', width: 1 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const personNames = [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])].filter((n): n is string => Boolean(n)).sort((a, b) => a.localeCompare(b))
                      if (personNames.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} style={{ padding: '1rem', color: '#6b7280' }}>No people in roster. Add people in Users tab first.</td>
                          </tr>
                        )
                      }
                      return personNames.map((personName) => {
                        const personLicenses = licenses.filter((l) => l.person_name === personName)
                        const isExpanded = selectedLicensePersonName === personName
                        return (
                          <Fragment key={personName}>
                            <tr
                              style={{
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                background: isExpanded ? '#f0f9ff' : undefined,
                              }}
                              onClick={() => setSelectedLicensePersonName((prev) => (prev === personName ? null : personName))}
                            >
                              <td style={{ padding: '0.75rem' }}>
                                {personName}
                                {personLicenses.length > 0 && (
                                  <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>
                                    {personLicenses.map((l) => l.license_type).join(', ')}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', width: 1 }}>
                                {isExpanded && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openLicenseForm(personName)
                                    }}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  >
                                    + Add license
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={2} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                      {personLicenses.length === 0 ? (
                                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No licenses.</p>
                                      ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                          <thead>
                                            <tr>
                                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>License and #</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date of Expiry</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cost to Company</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {personLicenses.map((l) => {
                                              const costLines = l.person_license_cost_lines ?? []
                                              return (
                                                <Fragment key={l.id}>
                                                  <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '0.5rem' }}>{l.license_type}</td>
                                                    <td style={{ padding: '0.5rem' }}>{l.note || '—'}</td>
                                                    <td style={{ padding: '0.5rem' }}>{l.date_of_expiry}</td>
                                                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                          {(costLines.length > 0 || costLinesTotal(costLines) > 0) ? (
                                                            <div
                                                              role="button"
                                                              tabIndex={0}
                                                              aria-expanded={expandedCostLinesLicenseId === l.id}
                                                              onClick={(e) => { e.stopPropagation(); setExpandedCostLinesLicenseId((prev) => (prev === l.id ? null : l.id)) }}
                                                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setExpandedCostLinesLicenseId((prev) => (prev === l.id ? null : l.id)) } }}
                                                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                            >
                                                              <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{expandedCostLinesLicenseId === l.id ? '▾' : '▸'}</span>
                                                              {costLinesTotal(costLines) > 0 ? `$${costLinesTotal(costLines).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                                              {costLines.length > 1 && (
                                                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>({costLines.length} lines)</span>
                                                              )}
                                                            </div>
                                                          ) : null}
                                                          <button type="button" onClick={(e) => { e.stopPropagation(); openCostLineForm(l.id) }} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Add Cost</button>
                                                        </div>
                                                        {expandedCostLinesLicenseId === l.id && costLines.length > 0 && (
                                                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: 4, borderLeft: '3px solid #e5e7eb' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                              <tbody>
                                                                {costLines.map((cl) => (
                                                                  <tr key={cl.id}>
                                                                    <td style={{ padding: '0.2rem 0.35rem 0 0' }}>${Number(cl.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                    <td style={{ padding: '0.2rem 0.35rem 0 0' }}>{cl.note || '—'}</td>
                                                                    <td style={{ padding: '0.2rem 0.35rem 0 0' }}>{cl.date}</td>
                                                                    <td style={{ padding: '0.2rem 0' }}>
                                                                      <button type="button" onClick={(e) => { e.stopPropagation(); openCostLineForm(l.id, cl) }} style={{ marginRight: '0.2rem', padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}>Edit</button>
                                                                      <button type="button" onClick={(e) => { e.stopPropagation(); deleteCostLine(cl) }} style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', color: '#b91c1c' }}>Delete</button>
                                                                    </td>
                                                                  </tr>
                                                                ))}
                                                              </tbody>
                                                            </table>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          openLicenseForm(undefined, l)
                                                        }}
                                                        style={{ marginRight: '0.35rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          deleteLicense(l)
                                                        }}
                                                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: '#b91c1c' }}
                                                      >
                                                        Delete
                                                      </button>
                                                    </td>
                                                  </tr>
                                                </Fragment>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'contracts' && canAccessContracts && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Contracts</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setContractBookModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  background: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <ContractBookIcon />
                Contract Book
              </button>
              <button
                type="button"
                onClick={() => setContractsTemplateModalOpen(true)}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Manage templates
              </button>
            </div>
          </div>
          {contractsError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{contractsError}</p>}
          {contractsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor={contractsTabSearchInputId} style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem', color: '#374151' }}>
                  Search people and contracts
                </label>
                <input
                  id={contractsTabSearchInputId}
                  type="search"
                  value={contractsSearchQuery}
                  onChange={(e) => setContractsSearchQuery(e.target.value)}
                  placeholder="Search by person or contract name…"
                  autoComplete="off"
                  aria-label="Search people and contracts"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.65rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              {contractsSearchNormalized && contractDocumentSearchLines.length > 0 ? (
                <div
                  role="region"
                  aria-label="Matching contract documents"
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    background: '#fafafa',
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontSize: '0.8125rem',
                  }}
                >
                  {contractDocumentSearchLines.map((line) => (
                    <div
                      key={`${line.personName}-${line.document_name}`}
                      style={{ padding: '0.2rem 0', color: '#374151' }}
                    >
                      {line.personName} — {line.document_name} — {line.status}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 48 }}>Status</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', width: 1 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (contractsPersonNamesSorted.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No people in roster. Add people in Users tab first.</td>
                          </tr>
                        )
                      }
                      if (contractsPersonNamesFiltered.length === 0 && contractsSearchNormalized) {
                        return (
                          <tr>
                            <td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No matches.</td>
                          </tr>
                        )
                      }
                      return contractsPersonNamesFiltered.map((personName) => {
                        const docs = getDocumentsForPerson(personName)
                        const status = getAggregateStatus(docs)
                        const isExpanded = selectedContractsPersonName === personName
                        const statusColor = status === 'green' ? '#22c55e' : status === 'yellow' ? '#eab308' : status === 'red' ? '#dc2626' : '#9ca3af'
                        return (
                          <Fragment key={personName}>
                            <tr
                              style={{
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                background: isExpanded ? '#f0f9ff' : undefined,
                              }}
                              onClick={() => setSelectedContractsPersonName((prev) => (prev === personName ? null : personName))}
                            >
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <span>{personName}</span>
                                  {personContractAssignments
                                    .filter((a) => a.person_name === personName)
                                    .map((a) => {
                                      const t = contractTemplates.find((x) => x.id === a.template_id)
                                      const tStatus = getAggregateStatusForTemplate(personName, a.template_id)
                                      const tColor = tStatus === 'green' ? '#22c55e' : tStatus === 'yellow' ? '#eab308' : tStatus === 'red' ? '#dc2626' : '#9ca3af'
                                      return (
                                        <span
                                          key={a.id}
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: 4,
                                            backgroundColor: tColor,
                                            color: '#fff',
                                            fontWeight: 500,
                                          }}
                                          title={tStatus === 'green' ? 'All signed' : tStatus === 'yellow' ? 'Sent for signature' : tStatus === 'red' ? 'Unsent' : 'No documents'}
                                        >
                                          {t?.name ?? '—'}
                                        </span>
                                      )
                                    })}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                {status !== null && (
                                  <span
                                    title={status === 'green' ? 'All signed' : status === 'yellow' ? 'Sent for signature' : 'Unsent'}
                                    style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }}
                                    aria-hidden
                                  />
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', width: 1 }}>
                                <span style={{ fontSize: '0.75rem' }}>{isExpanded ? '▾' : '▸'}</span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={3} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setContractsAssignModalOpen(true)
                                          setContractsError(null)
                                          setAssignTemplateSelectedId(null)
                                          setAssignTemplateSearchQuery('')
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Assign template
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingContractDocument(null)
                                          setContractsError(null)
                                          setContractDocumentFormPersonName(personName)
                                          setContractDocumentFormDocumentName('')
                                          setContractDocumentFormUrl('')
                                          setContractDocumentFormSigningBodyHtml('')
                                          setContractDocumentFormSigningBodyFormat('html')
                                          setContractDocumentFormCanonicalUrl('')
                                          setContractDocumentFormStatus('unsent')
                                          setContractDocumentFormSignedAt('')
                                          setContractDocumentFormNote('')
                                          setContractDocumentFormDashboardPrompt(false)
                                          setContractDocumentFormAppliedTemplateDocId('')
                                          setCanonicalUrlCheckStatus('idle')
                                          setCanonicalUrlCheckMessage('')
                                          setContractDocumentAddTab('request_signature')
                                          setContractDocumentModalOpen(true)
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                                      >
                                        + Add document
                                      </button>
                                    </div>
                                    {docs.length === 0 ? (
                                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No documents. Assign a template or add a document.</p>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Document</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Ver.</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Applied version</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Ref link</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Signed</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {docs.map(({ document_name, version, templateNames, bookLastEditedAt, lineageId }) => {
                                            const doc = version
                                            return (
                                            <tr
                                              key={`${document_name}-${lineageId ?? 'none'}-${doc?.id ?? 'pending'}`}
                                              style={{ borderBottom: '1px solid #e5e7eb' }}
                                            >
                                              <td style={{ padding: '0.5rem' }}>
                                                {templateNames.length > 0 && (
                                                  <span style={{ marginRight: '0.35rem', display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                                    {templateNames.map((n) => (
                                                      <span
                                                        key={n}
                                                        style={{
                                                          fontSize: '0.7rem',
                                                          padding: '0.1rem 0.3rem',
                                                          borderRadius: 4,
                                                          backgroundColor: '#e5e7eb',
                                                          color: '#374151',
                                                        }}
                                                      >
                                                        {n}
                                                      </span>
                                                    ))}
                                                  </span>
                                                )}
                                                <span>{document_name}</span>
                                                {doc?.signing_body_html?.trim() ? (
                                                  <span
                                                    style={{
                                                      marginLeft: '0.25rem',
                                                      fontSize: '0.65rem',
                                                      padding: '0.1rem 0.3rem',
                                                      borderRadius: 4,
                                                      backgroundColor: '#dbeafe',
                                                      color: '#1e40af',
                                                    }}
                                                  >
                                                    {isMarkdownBodyFormat(doc.signing_body_format)
                                                      ? 'Markdown'
                                                      : isPlainBodyFormat(doc.signing_body_format)
                                                        ? 'Plain'
                                                        : 'HTML'}
                                                  </span>
                                                ) : null}
                                                {doc?.canonical_document_url?.trim() ? (
                                                  <span
                                                    style={{
                                                      marginLeft: '0.25rem',
                                                      fontSize: '0.65rem',
                                                      padding: '0.1rem 0.3rem',
                                                      borderRadius: 4,
                                                      backgroundColor: '#fef3c7',
                                                      color: '#92400e',
                                                    }}
                                                  >
                                                    Link
                                                  </span>
                                                ) : null}
                                              </td>
                                              <td style={{ padding: '0.5rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                {doc ? doc.lineage_version : '—'}
                                              </td>
                                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: '#4b5563' }}>
                                                {bookLastEditedAt ? formatContractBookLastEditedCalendarDate(bookLastEditedAt) : '—'}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.status ?? 'unsent'}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                {doc?.url ? (
                                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                                    Link
                                                  </a>
                                                ) : (
                                                  '—'
                                                )}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.signed_at ?? '—'}</td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.note ?? '—'}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                  }}
                                                >
                                                  {doc?.status === 'signed' ? (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setContractSignedRecordModalDocId(doc.id)
                                                      }}
                                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                    >
                                                      View signed
                                                    </button>
                                                  ) : null}
                                                  {doc && hasContractSigningContent(doc) && doc.status !== 'signed' ? (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setContractSendDocId(doc.id)
                                                        setContractSendEmail('')
                                                        setContractSendSubject('')
                                                        setContractSendIntro('')
                                                        setContractsError(null)
                                                        setContractSendModalOpen(true)
                                                      }}
                                                      style={{
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.75rem',
                                                        background: '#0ea5e9',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                      }}
                                                    >
                                                      {doc.status === 'sent' ? 'Resend' : 'Send'}
                                                    </button>
                                                  ) : null}
                                                  {doc && doc.status !== 'signed' ? (
                                                    <label
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        fontSize: '0.7rem',
                                                        cursor: contractDashboardPromptSavingId === doc.id ? 'wait' : 'pointer',
                                                        userSelect: 'none',
                                                      }}
                                                      title="After each clock-in, show on this person’s Dashboard until signed"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!doc.dashboard_prompt_after_clock_in}
                                                        disabled={contractDashboardPromptSavingId === doc.id}
                                                        onChange={(e) => {
                                                          e.stopPropagation()
                                                          void toggleContractDashboardPrompt(doc.id, e.target.checked)
                                                        }}
                                                      />
                                                      Dashboard
                                                    </label>
                                                  ) : null}
                                                  {doc ? (
                                                    <div
                                                      data-contract-doc-menu-wrap={doc.id}
                                                      style={{
                                                        position: 'relative',
                                                        display: 'inline-flex',
                                                        verticalAlign: 'middle',
                                                      }}
                                                    >
                                                      <button
                                                        type="button"
                                                        aria-label={`More actions for ${document_name}`}
                                                        aria-haspopup="menu"
                                                        aria-expanded={contractsDocumentActionsMenuOpenId === doc.id}
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          setContractsDocumentActionsMenuOpenId((id) =>
                                                            id === doc.id ? null : doc.id,
                                                          )
                                                        }}
                                                        style={{
                                                          padding: '0.15rem 0.35rem',
                                                          fontSize: '1rem',
                                                          lineHeight: 1,
                                                          border: '1px solid #d1d5db',
                                                          borderRadius: 4,
                                                          background: '#fff',
                                                          cursor: 'pointer',
                                                        }}
                                                      >
                                                        ⋯
                                                      </button>
                                                      {contractsDocumentActionsMenuOpenId === doc.id ? (
                                                        <div
                                                          role="menu"
                                                          style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            right: 0,
                                                            marginTop: 2,
                                                            zIndex: 20,
                                                            minWidth: 140,
                                                            background: '#fff',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: 6,
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                                            padding: '0.25rem 0',
                                                          }}
                                                        >
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              setContractsDocumentActionsMenuOpenId(null)
                                                              openContractDocumentEditModal(personName, document_name, doc)
                                                            }}
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              width: '100%',
                                                              padding: '0.35rem 0.65rem',
                                                              fontSize: '0.8125rem',
                                                              border: 'none',
                                                              background: 'transparent',
                                                              cursor: 'pointer',
                                                              color: '#111827',
                                                              textAlign: 'left',
                                                            }}
                                                          >
                                                            Edit
                                                          </button>
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              setContractsDocumentActionsMenuOpenId(null)
                                                              setContractDocumentDeleteTarget(doc)
                                                              setContractDocumentDeleteConfirmOpen(true)
                                                            }}
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: '0.35rem',
                                                              width: '100%',
                                                              padding: '0.35rem 0.65rem',
                                                              fontSize: '0.8125rem',
                                                              border: 'none',
                                                              background: 'transparent',
                                                              cursor: 'pointer',
                                                              color: '#b91c1c',
                                                              textAlign: 'left',
                                                            }}
                                                          >
                                                            <svg
                                                              xmlns="http://www.w3.org/2000/svg"
                                                              width={14}
                                                              height={14}
                                                              viewBox="0 0 24 24"
                                                              fill="none"
                                                              stroke="currentColor"
                                                              strokeWidth={2}
                                                              aria-hidden
                                                            >
                                                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                                                            </svg>
                                                            Delete
                                                          </button>
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </td>
                                            </tr>
                                          )
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'writeups' && canAccessContracts && authUser?.id ? (
        <WriteupsContractsSubTab
          writeups={writeupsRows}
          ncnsRows={ncnsRows}
          templates={writeupTemplatesRows}
          userOptions={writeupUserSelectOptions}
          loading={writeupsLoading}
          error={writeupsError}
          authUserId={authUser.id}
          isDev={isDev}
          onRefresh={loadWriteupsData}
        />
      ) : null}

      {contractsTemplateModalOpen && activeTab === 'contracts' && canAccessContracts && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Manage templates</h3>
              <button
                type="button"
                onClick={() => setContractsTemplateModalOpen(false)}
                style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {contractsError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{contractsError}</p>}
            {templateFormMode !== 'none' ? (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{editingContractTemplate ? 'Edit template' : 'New template'}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Template name</label>
                    <input
                      type="text"
                      value={templateFormName}
                      onChange={(e) => setTemplateFormName(e.target.value)}
                      placeholder="e.g. Farm Work"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Documents</label>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>
                      Only library entries from <strong>Contract Book</strong> can be attached. Create or edit them there, then pick each one below.
                    </p>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label htmlFor={templateBookPickerLabelId} style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Add from Contract Book
                      </label>
                      {contractTemplateDocuments.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                          No library entries yet. Open <strong>Contract Book</strong> on the Contracts tab and add at least one contract under a template, then return here.
                        </p>
                      ) : (
                        <>
                          <SearchableSelect
                            id={templateBookPickerLabelId}
                            value={templateBookPickerValue}
                            onChange={(id) => {
                              if (!id) {
                                setTemplateBookPickerValue('')
                                return
                              }
                              const row = contractTemplateDocuments.find((d) => d.id === id)
                              if (!row) {
                                setTemplateBookPickerValue('')
                                return
                              }
                              const pickedName = row.document_name
                              setTemplateFormDocumentNames((prev) => {
                                if (prev.some((x) => x.trim().toLowerCase() === pickedName.trim().toLowerCase())) {
                                  return prev
                                }
                                return [...prev, pickedName].sort()
                              })
                              setTemplateFormDocumentSourceByName((prev) => ({ ...prev, [pickedName]: id }))
                              setTemplateBookPickerValue('')
                            }}
                            options={templateBookPickerOptions}
                            emptyOption={{ value: '', label: 'Select…' }}
                            placeholder={templateBookPickerOptions.length === 0 ? 'No more to add' : 'Search…'}
                            disabled={templateBookPickerOptions.length === 0}
                            listAriaLabel="Add document from contract book library"
                            portalZIndex={1200}
                          />
                          {templateBookPickerOptions.length === 0 ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                              Every library document name is already attached to this template.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                      {templateFormDocumentNames.map((docName) => (
                        <li key={docName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          {docName}
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateFormDocumentNames((prev) => prev.filter((d) => d !== docName))
                              setTemplateFormDocumentSourceByName((prev) => {
                                const next = { ...prev }
                                delete next[docName]
                                return next
                              })
                            }}
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', color: '#b91c1c', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={saveTemplate}
                      disabled={templateFormSaving}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: templateFormSaving ? 'not-allowed' : 'pointer' }}
                    >
                      {templateFormSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={closeTemplateForm}
                      style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>Templates</h4>
                <button
                  type="button"
                  onClick={() => openTemplateForm()}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                >
                  + New template
                </button>
              </div>
              {contractTemplates.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No templates yet. Create one to assign to people.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'none' }}>
                  {contractTemplates.map((t) => {
                    const docs = contractTemplateDocuments.filter((d) => d.template_id === t.id).map((d) => d.document_name).sort()
                    return (
                      <li key={t.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{t.name}</strong>
                          {docs.length > 0 ? (
                            <ul
                              style={{
                                margin: '0.25rem 0 0',
                                paddingLeft: '1.25rem',
                                listStyle: 'disc',
                                listStylePosition: 'outside',
                                color: '#6b7280',
                                fontSize: '0.8125rem',
                              }}
                            >
                              {docs.map((docName) => (
                                <li key={docName} style={{ marginBottom: '0.15rem' }}>
                                  {docName}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => openTemplateForm(t)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteContractTemplate(t)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {contractsAssignModalOpen && activeTab === 'contracts' && canAccessContracts && selectedContractsPersonName && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', width: '100%' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>Assign template to {selectedContractsPersonName}</h3>
            {contractsError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{contractsError}</p>}
            {(() => {
              const assignedRows = personContractAssignments
                .filter((a) => a.person_name === selectedContractsPersonName)
                .map((a) => ({
                  assignment: a,
                  template: contractTemplates.find((x) => x.id === a.template_id),
                }))
                .sort((r, s) => (r.template?.name ?? '').localeCompare(s.template?.name ?? ''))
              if (assignedRows.length === 0) return null
              return (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.35rem' }}>Assigned templates</p>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem', lineHeight: 1.45 }}>
                    Signed or in-progress documents stay on file; only empty placeholders are removed.
                  </p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {assignedRows.map(({ assignment: a, template: t }) => {
                      const docCount = contractTemplateDocuments.filter((d) => d.template_id === a.template_id).length
                      const docLabel = docCount > 0 ? ` (${docCount} docs)` : ''
                      const busyUnassign = assignTemplateUnassigningTemplateId === a.template_id
                      return (
                        <li
                          key={a.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.45rem 0.65rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                          }}
                        >
                          <span>
                            <span style={{ fontWeight: 600 }}>{t?.name ?? '—'}</span>
                            {docLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => void unassignTemplateFromPerson(a.template_id)}
                            disabled={
                              assignTemplateSaving ||
                              assignTemplateUnassigningTemplateId !== null
                            }
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              background: '#fef2f2',
                              color: '#b91c1c',
                              cursor:
                                assignTemplateSaving || assignTemplateUnassigningTemplateId !== null
                                  ? 'not-allowed'
                                  : 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            {busyUnassign ? 'Unassigning…' : 'Unassign'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}
            {contractTemplates.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>No templates. Create one in Manage templates first.</p>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor={assignTemplateSearchInputId} style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                  Search templates
                </label>
                <input
                  id={assignTemplateSearchInputId}
                  type="search"
                  value={assignTemplateSearchQuery}
                  onChange={(e) => setAssignTemplateSearchQuery(e.target.value)}
                  placeholder="Type to filter…"
                  autoComplete="off"
                  aria-label="Search templates"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    marginBottom: '0.65rem',
                    boxSizing: 'border-box',
                  }}
                />
                <p id={assignTemplateRadioGroupLabelId} style={{ fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
                  Select template
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={assignTemplateRadioGroupLabelId}
                  style={{
                    maxHeight: 280,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.35rem',
                  }}
                >
                  {filteredAssignContractTemplates.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0.35rem' }}>No templates match your search.</p>
                  ) : (
                    filteredAssignContractTemplates.map((t) => {
                      const alreadyAssigned = personContractAssignments.some(
                        (a) => a.person_name === selectedContractsPersonName && a.template_id === t.id
                      )
                      const docCount = contractTemplateDocuments.filter((d) => d.template_id === t.id).length
                      const docLabel = docCount > 0 ? ` (${docCount} docs)` : ''
                      const selected = assignTemplateSelectedId === t.id
                      return (
                        <div
                          key={t.id}
                          role="radio"
                          aria-checked={selected}
                          aria-disabled={alreadyAssigned}
                          tabIndex={alreadyAssigned ? -1 : 0}
                          onClick={() => {
                            if (assignTemplateUnassigningTemplateId !== null) return
                            if (!alreadyAssigned) setAssignTemplateSelectedId(t.id)
                          }}
                          onKeyDown={(e) => {
                            if (assignTemplateUnassigningTemplateId !== null) return
                            if (alreadyAssigned) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setAssignTemplateSelectedId(t.id)
                            }
                          }}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: 4,
                            cursor:
                              alreadyAssigned || assignTemplateUnassigningTemplateId !== null
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: alreadyAssigned || assignTemplateUnassigningTemplateId !== null ? 0.55 : 1,
                            background: selected ? '#eff6ff' : alreadyAssigned ? '#f9fafb' : 'transparent',
                            border: selected ? '1px solid #93c5fd' : '1px solid transparent',
                            marginBottom: 2,
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          {docLabel}
                          {alreadyAssigned ? (
                            <span style={{ color: '#6b7280', fontWeight: 400 }}> — already assigned (use Unassign above)</span>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={assignTemplateToPerson}
                disabled={
                  assignTemplateSaving ||
                  assignTemplateUnassigningTemplateId !== null ||
                  !assignTemplateSelectedId ||
                  contractTemplates.length === 0
                }
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    assignTemplateSaving || assignTemplateUnassigningTemplateId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {assignTemplateSaving ? 'Assigning…' : 'Assign'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractsAssignModalOpen(false)
                  setAssignTemplateSelectedId(null)
                  setAssignTemplateSearchQuery('')
                  setContractsError(null)
                }}
                disabled={assignTemplateSaving || assignTemplateUnassigningTemplateId !== null}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor:
                    assignTemplateSaving || assignTemplateUnassigningTemplateId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {contractDocumentModalOpen && activeTab === 'contracts' && canAccessContracts && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>{editingContractDocument ? 'Edit document' : 'Add document'}</h3>
            {contractsError ? (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{contractsError}</p>
            ) : null}
            {!editingContractDocument ? (
              <div
                role="tablist"
                aria-label="Add document workflow"
                onKeyDown={handleContractAddTabKeyDown}
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
              >
                <button
                  type="button"
                  role="tab"
                  id={`${contractAddDocTabBaseId}-tab-upload`}
                  aria-selected={contractDocumentAddTab === 'upload_signed'}
                  aria-controls={`${contractAddDocTabBaseId}-panel-upload`}
                  tabIndex={contractDocumentAddTab === 'upload_signed' ? 0 : -1}
                  onClick={() => {
                    setContractDocumentAddTab('upload_signed')
                    setContractDocumentFormStatus('signed')
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'upload_signed' ? '#eff6ff' : '#fff',
                    color: contractDocumentAddTab === 'upload_signed' ? '#1d4ed8' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Upload Signed
                </button>
                <button
                  type="button"
                  role="tab"
                  id={`${contractAddDocTabBaseId}-tab-request`}
                  aria-selected={contractDocumentAddTab === 'request_signature'}
                  aria-controls={`${contractAddDocTabBaseId}-panel-request`}
                  tabIndex={contractDocumentAddTab === 'request_signature' ? 0 : -1}
                  onClick={() => {
                    setContractDocumentAddTab('request_signature')
                    setContractDocumentFormStatus('unsent')
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'request_signature' ? '#eff6ff' : '#fff',
                    color: contractDocumentAddTab === 'request_signature' ? '#1d4ed8' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Request Signature
                </button>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Person
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                    {' '}
                    *
                  </span>
                </label>
                <input
                  type="text"
                  value={contractDocumentFormPersonName}
                  onChange={(e) => setContractDocumentFormPersonName(e.target.value)}
                  readOnly
                  disabled
                  aria-required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Document name
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                    {' '}
                    *
                  </span>
                </label>
                <input
                  type="text"
                  value={contractDocumentFormDocumentName}
                  onChange={(e) => setContractDocumentFormDocumentName(e.target.value)}
                  placeholder="e.g. Farm Work Agreement"
                  readOnly={!!editingContractDocument}
                  disabled={!!editingContractDocument}
                  required={!editingContractDocument}
                  aria-required={!editingContractDocument}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editingContractDocument ? '#f9fafb' : undefined }}
                />
              </div>
              {(editingContractDocument ||
                (!editingContractDocument && contractDocumentAddTab === 'request_signature')) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    Applied version (Contract Book)
                  </label>
                  <select
                    value={contractDocumentFormAppliedTemplateDocId}
                    onChange={(e) => setContractDocumentFormAppliedTemplateDocId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    <option value="">Automatic (latest edit among assigned templates)</option>
                    {listAppliedContractBookVersionOptions(
                      contractDocumentFormPersonName,
                      contractDocumentFormDocumentName,
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
                    Pins which Contract Book row sets the &quot;Applied version&quot; date for this person. Leave automatic
                    when any assigned template&apos;s copy is fine.
                  </p>
                </div>
              )}
              {editingContractDocument ? (
                <>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={contractEditModalContractTextExpanded}
                      onClick={() => setContractEditModalContractTextExpanded((v) => !v)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        background: '#f9fafb',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      <span>Contract text</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }} aria-hidden>
                        {contractEditModalContractTextExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {contractEditModalContractTextExpanded ? contractDocModalContractTextField : null}
                  </div>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={contractEditModalCanonicalExpanded}
                      onClick={() => setContractEditModalCanonicalExpanded((v) => !v)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        background: '#f9fafb',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      <span>Canonical document URL (Doc / PDF)</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }} aria-hidden>
                        {contractEditModalCanonicalExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {contractEditModalCanonicalExpanded ? contractDocModalCanonicalUrlField : null}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      Signed / reference link
                    </label>
                    <input
                      type="url"
                      value={contractDocumentFormUrl}
                      onChange={(e) => setContractDocumentFormUrl(e.target.value)}
                      placeholder="Optional link to a signed copy or other reference"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, lineHeight: 1.45 }}>
                    To use <strong>Send for signature</strong>, fill at least one of: contract text, canonical URL, or signed/reference link (not required to save).
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Status</label>
                    <select
                      value={contractDocumentFormStatus}
                      onChange={(e) => setContractDocumentFormStatus(e.target.value as 'unsent' | 'sent' | 'signed')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="unsent">Unsent</option>
                      <option value="sent">Sent</option>
                      <option value="signed">Signed</option>
                    </select>
                  </div>
                  {contractDocumentFormStatus !== 'signed' ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.8125rem',
                        marginTop: '0.25rem',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractDocumentFormDashboardPrompt}
                        onChange={(e) => setContractDocumentFormDashboardPrompt(e.target.checked)}
                        style={{ marginTop: '0.15rem' }}
                      />
                      <span>Remind on Dashboard after clock-in (until signed)</span>
                    </label>
                  ) : null}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                    <input
                      type="date"
                      value={contractDocumentFormSignedAt}
                      onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                    <textarea
                      value={contractDocumentFormNote}
                      onChange={(e) => setContractDocumentFormNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
                    />
                  </div>
                </>
              ) : contractDocumentAddTab === 'upload_signed' ? (
                  <div
                    role="tabpanel"
                    id={`${contractAddDocTabBaseId}-panel-upload`}
                    aria-labelledby={`${contractAddDocTabBaseId}-tab-upload`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.45 }}>
                        Use this when you already have a signed copy (link to PDF or Drive). Add signed date and note as needed.
                      </p>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          Signed / reference link
                        </label>
                        <input
                          type="url"
                          value={contractDocumentFormUrl}
                          onChange={(e) => setContractDocumentFormUrl(e.target.value)}
                          placeholder="Optional link to a signed copy or other reference"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                        <input
                          type="date"
                          value={contractDocumentFormSignedAt}
                          onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                        <textarea
                          value={contractDocumentFormNote}
                          onChange={(e) => setContractDocumentFormNote(e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>
              ) : (
                  <div
                    role="tabpanel"
                    id={`${contractAddDocTabBaseId}-panel-request`}
                    aria-labelledby={`${contractAddDocTabBaseId}-tab-request`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.45 }}>
                        Prepare what appears on the public signing page. Use <strong>Send</strong> below to save and open the email step, or <strong>Save</strong> and use <strong>Send</strong> on the document row later.
                      </p>
                      {contractDocModalContractTextField}
                      {contractDocModalCanonicalUrlField}
                      {!editingContractDocument ? (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={contractDocumentFormDashboardPrompt}
                            onChange={(e) => setContractDocumentFormDashboardPrompt(e.target.checked)}
                            style={{ marginTop: '0.15rem' }}
                          />
                          <span>Remind on Dashboard after clock-in (until signed)</span>
                        </label>
                      ) : null}
                    </div>
                  </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentModalOpen(false)
                    setContractDocumentDeleteConfirmOpen(false)
                    setContractDocumentDeleteTarget(null)
                  }}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                {editingContractDocument &&
                isDeletablePersonContractStatus(String(editingContractDocument.status)) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingContractDocument) return
                      setContractDocumentDeleteTarget(editingContractDocument)
                      setContractDocumentDeleteConfirmOpen(true)
                    }}
                    disabled={contractDocumentFormSaving || contractDocumentDeleting}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      background: '#fef2f2',
                      color: '#b91c1c',
                      cursor:
                        contractDocumentFormSaving || contractDocumentDeleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={saveContractDocument}
                  disabled={contractDocumentFormSaving}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer' }}
                >
                  {contractDocumentFormSaving ? 'Saving…' : 'Save'}
                </button>
                {!editingContractDocument && contractDocumentAddTab === 'request_signature' ? (
                  <button
                    type="button"
                    onClick={() => void saveContractDocumentAndOpenSend()}
                    disabled={contractDocumentFormSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#0ea5e9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {contractDocumentFormSaving ? 'Saving…' : 'Send'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {contractDocumentDeleteConfirmOpen &&
        activeTab === 'contracts' &&
        canAccessContracts &&
        contractDocumentDeleteTarget &&
        isDeletablePersonContractStatus(contractDocumentDeleteTarget.status) && (
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
              if (!contractDocumentDeleting) {
                setContractDocumentDeleteConfirmOpen(false)
                setContractDocumentDeleteTarget(null)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contract-delete-confirm-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: 8,
                minWidth: 320,
                maxWidth: 'min(92vw, 420px)',
              }}
            >
              <h3 id="contract-delete-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
                Delete document?
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.45 }}>
                This removes <strong>{contractDocumentDeleteTarget.document_name}</strong> for{' '}
                <strong>{contractDocumentDeleteTarget.person_name}</strong>. This cannot be undone.
              </p>
              {(contractDocumentDeleteTarget.status === 'sent' ||
                contractDocumentDeleteTarget.status === 'signed') && (
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.45 }}>
                  <strong>Note:</strong> This removes the contract record from PipeTooling, including any stored
                  signature. Email or files saved outside this app are not affected.
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentDeleteConfirmOpen(false)
                    setContractDocumentDeleteTarget(null)
                  }}
                  disabled={contractDocumentDeleting}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: contractDocumentDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteContractDocument()}
                  disabled={contractDocumentDeleting}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: '#b91c1c',
                    color: '#fff',
                    cursor: contractDocumentDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {contractDocumentDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      {canAccessContracts && activeTab === 'contracts' ? (
        <PersonContractSignedRecordModal
          open={contractSignedRecordModalDocId !== null}
          documentId={contractSignedRecordModalDocId}
          onClose={() => setContractSignedRecordModalDocId(null)}
        />
      ) : null}

      {contractBookModalOpen && activeTab === 'contracts' && canAccessContracts && (
        <ContractBookModal
          open={contractBookModalOpen}
          onClose={() => setContractBookModalOpen(false)}
          templates={contractTemplates}
          templateDocuments={contractTemplateDocuments}
          onSaved={() => void loadContracts()}
          onPickEntry={contractBookPickFromDocumentModal ? handlePickContractFromBook : undefined}
        />
      )}

      {contractSendModalOpen && activeTab === 'contracts' && canAccessContracts && contractSendDocId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>Send for signature</h3>
            {contractsError ? <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{contractsError}</p> : null}
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Signer email</span>
              <input
                type="email"
                value={contractSendEmail}
                onChange={(e) => setContractSendEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Email subject (optional)</span>
              <input
                type="text"
                value={contractSendSubject}
                onChange={(e) => setContractSendSubject(e.target.value)}
                placeholder="Default: Sign contract: …"
                maxLength={200}
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Opening message (optional, plain text)</span>
              <textarea
                value={contractSendIntro}
                onChange={(e) => setContractSendIntro(e.target.value)}
                placeholder="Default: Please review and sign your contract. Leave blank to use the default opening line."
                rows={4}
                maxLength={4000}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                }}
              />
            </label>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
              The email always includes the document name and a link to the signing page after your message.
            </p>
            {contractSendEmailPreview ? (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>Email preview</div>
                {contractSendEmailPreview.kind === 'missing' ? (
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>Unable to load preview.</p>
                ) : (
                  <>
                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600 }}>Subject: </span>
                      {contractSendEmailPreview.subject}
                    </div>
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '0.75rem',
                        maxHeight: 220,
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        background: '#fafafa',
                        color: '#111827',
                      }}
                      dangerouslySetInnerHTML={{ __html: contractSendEmailPreview.htmlBody }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.35rem 0 0' }}>
                      The signing link is generated when you send.
                    </p>
                  </>
                )}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                marginTop: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setContractSendModalOpen(false)
                  setContractSendDocId(null)
                  setContractSendEmail('')
                  setContractSendSubject('')
                  setContractSendIntro('')
                  setContractsError(null)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendContractForSignature()}
                disabled={contractSendSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: contractSendSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {contractSendSaving ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'review' && isDev && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedReviewPersonIndex((i) => Math.max(0, i - 1))}
              disabled={showPeopleForReview.length === 0 || selectedReviewPersonIndex <= 0}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: selectedReviewPersonIndex <= 0 ? 'not-allowed' : 'pointer', opacity: selectedReviewPersonIndex <= 0 ? 0.6 : 1 }}
            >
              ← Prev
            </button>
            <span style={{ fontWeight: 500 }}>
              Person: <strong>{showPeopleForReview[selectedReviewPersonIndex] ?? '—'}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedReviewPersonIndex((i) => Math.min(showPeopleForReview.length - 1, i + 1))}
              disabled={showPeopleForReview.length === 0 || selectedReviewPersonIndex >= showPeopleForReview.length - 1}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: selectedReviewPersonIndex >= showPeopleForReview.length - 1 ? 'not-allowed' : 'pointer', opacity: selectedReviewPersonIndex >= showPeopleForReview.length - 1 ? 0.6 : 1 }}
            >
              Next →
            </button>
            <select
              value={reviewPeriod}
              onChange={(e) => setReviewPeriod(e.target.value as ReviewPeriod)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_week">Last week</option>
              <option value="last_two_weeks">Last two weeks</option>
              <option value="last_month">Last month</option>
            </select>
            <button
              type="button"
              onClick={openTeamSummaryWindow}
              disabled={showPeopleForReview.length === 0}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                fontWeight: 500,
                cursor: showPeopleForReview.length === 0 ? 'not-allowed' : 'pointer',
                opacity: showPeopleForReview.length === 0 ? 0.6 : 1,
              }}
            >
              Team Summary
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={reviewOnlyPaidInFull}
                onChange={(e) => setReviewOnlyPaidInFull(e.target.checked)}
              />
              Only Count Jobs Marked Paid in Full
            </label>
          </div>

          {showPeopleForReview.length === 0 ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>No people in pay config. Add people in Pay tab first.</p>
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
                  <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Profit for this period:</span>
                      <strong>{`$${Math.round(totalProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Revenue per Man Hour Delivered:</span>
                      <strong>{totalHours > 0 ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                      <span
                        title="Revenue allocated by (hours in period ÷ total job hours) × job bill, summed ÷ Total Hours"
                        aria-label="Proportional allocation: revenue attributed to period work ÷ total hours"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Profit per Man Hour Delivered:</span>
                      <strong>{totalHours > 0 ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                      <span
                        title="Profit allocated by (hours in period ÷ total job hours) × job profit, summed ÷ Total Hours"
                        aria-label="Proportional allocation: profit attributed to period work ÷ total hours"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
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
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Labor / Labor:</span>
                          <span style={{ fontWeight: 600 }}>{(() => {
                            const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                            const totalLaborByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) {
                                totalLaborByJob.set(j.job_id, j.otherTeammatesLabor)
                              }
                            }
                            const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            return [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                          })()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Revenue / Total:</span>
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
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Value / Total:</span>
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
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Source</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job Name / Job Address</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP# / Date</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Labor / Labor</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Revenue / Total</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Value / Total</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>User on Job Rev/hr / User on Job Profit/hr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewLaborJobs.map((j) => {
                              const key = `labor-${j.id}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{expanded ? '▾' : '▸'}</span>
                                        <span style={{ fontWeight: 600 }}>Sub Labor</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.address) || '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_number ?? '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.job_date)}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.otherTeammatesLabor > 0 ? `$${formatCurrency(j.otherTeammatesLabor)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</div>
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
                                      <td colSpan={7} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>Total Bill</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Job Progress</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (null)'}</span>
                                          <span style={{ color: '#6b7280' }}>Progress Revenue</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Bill</span>
                                          <span style={{ color: '#b91c1c' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution this Day</span>
                                          <span style={{ textDecoration: 'underline', color: '#b91c1c' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>Total Labor on Job</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.otherTeammatesLabor
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor:</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.otherTeammatesLabor - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Total labor on Job</span>
                                          <span>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Labor this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Users Labor Rate</span>
                                          <span>{j.hours > 0 ? `$${formatCurrency(j.laborCost / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            return teammatesHours > 0 ? `$${formatCurrency((j.otherTeammatesLabor - j.userTotalLaborOnJob) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(j.otherTeammatesLabor / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280' }}>Total Revenue Before Overhead</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Revenue</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Revenue this Day</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>User on Job Rev/hr</span>
                                          <span>{revPerHour != null ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>User on Job Profit/hr</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ color: profitPerHour != null && profitPerHour < 0 ? '#b91c1c' : undefined }}>{profitPerHour != null ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            <span
                                              title="User on Job Rev/hr < User on Job Profit/hr when the user's cost per hour is higher than the blended crew average. They work fewer hours but have a larger share of labor cost, so: Their bill share (by hours) is relatively small. Their profit share (by cost) is relatively large. User on Job Rev/hr and User on Job Profit/hr use different allocation rules (hours vs. cost). User on Job Rev/hr can be lower than User on Job Profit/hr when the user's cost per hour is high enough that their profit share (by cost) per hour exceeds their bill share (by hours) per hour."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
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
                                ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{j.viaLead ? `Crew: ${j.viaLead}` : 'Crew Lead'}</div>
                                          {!j.viaLead && (j.crewMemberNames ?? []).length > 0 && (
                                            <div style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {j.crewMemberNames!.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.job_address) || '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.hcp_number}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.work_date)}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.otherTeammatesLabor > 0 ? `$${formatCurrency(j.otherTeammatesLabor)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</div>
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
                                      <td colSpan={7} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>Total Bill</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Job Progress</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (null)'}</span>
                                          <span style={{ color: '#6b7280' }}>Progress Revenue</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Bill</span>
                                          <span style={{ color: '#b91c1c' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution this Day</span>
                                          <span style={{ textDecoration: 'underline', color: '#b91c1c' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>Total Labor on Job</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.otherTeammatesLabor
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor:</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.otherTeammatesLabor - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Total labor on Job</span>
                                          <span>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Labor this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Users Labor Rate</span>
                                          <span>{j.hours > 0 ? `$${formatCurrency(j.laborCost / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            return teammatesHours > 0 ? `$${formatCurrency((j.otherTeammatesLabor - j.userTotalLaborOnJob) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(j.otherTeammatesLabor / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280' }}>Total Revenue Before Overhead</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Revenue</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Revenue this Day</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>User on Job Rev/hr</span>
                                          <span>{revPerHour != null ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>User on Job Profit/hr</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ color: profitPerHour != null && profitPerHour < 0 ? '#b91c1c' : undefined }}>{profitPerHour != null ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            <span
                                              title="User on Job Rev/hr < User on Job Profit/hr when the user's cost per hour is higher than the blended crew average. They work fewer hours but have a larger share of labor cost, so: Their bill share (by hours) is relatively small. Their profit share (by cost) is relatively large. User on Job Rev/hr and User on Job Profit/hr use different allocation rules (hours vs. cost). User on Job Rev/hr can be lower than User on Job Profit/hr when the user's cost per hour is high enough that their profit share (by cost) per hour exceeds their bill share (by hours) per hour."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
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
                              <td colSpan={3} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                                  return totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalLaborByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalLaborByJob.set(j.job_id, j.otherTeammatesLabor)
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
                                  return `$${Math.round(revHr).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
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
        </div>
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
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>App activity</h2>
                {isDev && (
                  <button
                    type="button"
                    aria-expanded={activityGrantsSectionOpen}
                    aria-controls="people-activity-grants-panel"
                    onClick={() => setActivityGrantsSectionOpen((o) => !o)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span aria-hidden>{activityGrantsSectionOpen ? '\u25BC' : '\u25B6'}</span>
                    {activityGrantsSectionOpen ? 'Hide access' : 'Manage access'}
                  </button>
                )}
              </div>
              {isDev && activityGrantsSectionOpen && (
                <div
                  id="people-activity-grants-panel"
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#f9fafb',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Who can see this tab</h3>
                  <p style={{ margin: '0 0 0.75rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    Grant Assistants, Master Technicians, or Primaries org-wide activity (same table as below). Others keep only their own usage.
                  </p>
                  {activityGrantListLoading ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading grants…</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                            <th style={{ padding: '0.5rem 0.75rem' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {users
                            .filter((u) => ['assistant', 'master_technician', 'primary'].includes(u.role))
                            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                            .map((u) => {
                              const granted = activityViewerGrantSet.has(u.id)
                              const busy = activityGrantBusyId === u.id
                              return (
                                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{u.name || '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{u.email || '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {u.phone ? (
                                      <a href={`tel:${u.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                        {u.phone}
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{u.role.replace(/_/g, ' ')}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {granted ? (
                                      <button
                                        type="button"
                                        disabled={busy || !authUser?.id}
                                        onClick={async () => {
                                          setActivityGrantBusyId(u.id)
                                          try {
                                            await withSupabaseRetry(
                                              async () =>
                                                await supabase.from('user_app_activity_viewers').delete().eq('viewer_user_id', u.id),
                                              'revoke activity viewer'
                                            )
                                            setActivityViewerGrantSet((prev) => {
                                              const next = new Set(prev)
                                              next.delete(u.id)
                                              return next
                                            })
                                          } catch (e) {
                                            showToast(String(e instanceof Error ? e.message : e), 'error')
                                          } finally {
                                            setActivityGrantBusyId(null)
                                          }
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.8125rem',
                                          border: '1px solid #d1d5db',
                                          borderRadius: 6,
                                          background: '#fff',
                                          cursor: busy ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {busy ? '…' : 'Revoke'}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={busy || !authUser?.id}
                                        onClick={async () => {
                                          if (!authUser?.id) return
                                          setActivityGrantBusyId(u.id)
                                          try {
                                            await withSupabaseRetry(
                                              async () =>
                                                await supabase.from('user_app_activity_viewers').insert({
                                                  viewer_user_id: u.id,
                                                  granted_by: authUser.id,
                                                }),
                                              'grant activity viewer'
                                            )
                                            setActivityViewerGrantSet((prev) => new Set(prev).add(u.id))
                                          } catch (e) {
                                            showToast(String(e instanceof Error ? e.message : e), 'error')
                                          } finally {
                                            setActivityGrantBusyId(null)
                                          }
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.8125rem',
                                          border: '1px solid #3b82f6',
                                          borderRadius: 6,
                                          background: '#3b82f6',
                                          color: '#fff',
                                          cursor: busy ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {busy ? '…' : 'Grant'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                      {users.filter((u) => ['assistant', 'master_technician', 'primary'].includes(u.role)).length === 0 && (
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No eligible users loaded.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <PeopleAppActivityPanel enabled={activityAccessResolved && canSeeActivityTab} />
            </>
          ) : null}
        </div>
      )}

      {licenseFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingLicense ? 'Edit license' : 'Add license'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Person *</label>
              <select value={licensePersonName} onChange={(e) => setLicensePersonName(e.target.value)} disabled={!!editingLicense} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {[...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])].filter(Boolean).sort((a, b) => (a ?? '').localeCompare(b ?? '')).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>License and # *</label>
              <input type="text" value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="e.g. Master Plumber" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date of Expiry *</label>
              <input type="date" value={licenseDateOfExpiry} onChange={(e) => setLicenseDateOfExpiry(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertLicense} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeLicenseForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {costLineFormOpen && costLineLicenseId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingCostLine ? 'Edit cost line' : 'Add cost line'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Amount ($) *</label>
              <input type="number" min={0} step={0.01} value={costLineAmount} onChange={(e) => setCostLineAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={costLineNote} onChange={(e) => setCostLineNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date *</label>
              <input type="date" value={costLineDate} onChange={(e) => setCostLineDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const amt = parseFloat(costLineAmount)
                  if (isNaN(amt) || amt < 0) {
                    setLicensesError('Enter a valid amount')
                    return
                  }
                  if (!costLineDate) {
                    setLicensesError('Date is required')
                    return
                  }
                  if (editingCostLine) {
                    updateCostLine(editingCostLine, amt, costLineNote, costLineDate)
                  } else {
                    addCostLine(costLineLicenseId, amt, costLineNote, costLineDate)
                  }
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                Save
              </button>
              <button type="button" onClick={closeCostLineForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <PersonOffsetFormModal
        open={offsetFormOpen}
        onClose={closeOffsetForm}
        editingOffset={editingOffset}
        initialCreateDraft={offsetFormInitialCreateDraft}
        zIndex={Z_PEOPLE_OFFSET_FORM}
        personNameOptions={offsetPersonNameOptions}
        onSaved={async () => {
          void loadOffsets()
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
        onError={setOffsetsError}
      />

      {offsetApplyModalOpen && offsetToApply && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Apply offset to pay stub</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Apply {offsetToApply.type} ${formatCurrency(offsetToApply.amount)} for {offsetToApply.person_name} to a pay stub:</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Pay stub</label>
              <select value={offsetApplyPayStubId} onChange={(e) => setOffsetApplyPayStubId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {payStubs.filter((s) => s.person_name === offsetToApply.person_name).sort((a, b) => b.period_start.localeCompare(a.period_start)).map((s) => (
                  <option key={s.id} value={s.id}>{s.period_start} – {s.period_end} (${formatCurrency(s.gross_pay)})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={applyOffsetToPayStub} disabled={!offsetApplyPayStubId} style={{ padding: '0.5rem 1rem' }}>Apply</button>
              <button type="button" onClick={() => { setOffsetApplyModalOpen(false); setOffsetToApply(null); setOffsetApplyPayStubId('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {vehicleFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Year *</label>
              <input type="number" min={1900} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Make *</label>
              <input type="text" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Model *</label>
              <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>VIN</label>
              <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly insurance cost</label>
              <input type="number" min={0} step={0.01} value={vehicleInsCost} onChange={(e) => setVehicleInsCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly registration cost</label>
              <input type="number" min={0} step={0.01} value={vehicleRegCost} onChange={(e) => setVehicleRegCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertVehicle} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeVehicleForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {odometerFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add odometer entry</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={odometerDate} onChange={(e) => setOdometerDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value</label>
              <input type="number" min={0} step={1} value={odometerValue} onChange={(e) => setOdometerValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertOdometerEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setOdometerFormOpen(false); setOdometerValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {replacementValueFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add replacement value</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={replacementValueDate} onChange={(e) => setReplacementValueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value ($)</label>
              <input type="number" min={0} step={0.01} value={replacementValueValue} onChange={(e) => setReplacementValueValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertReplacementValueEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setReplacementValueFormOpen(false); setReplacementValueValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {possessionFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Assign to user</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>User *</label>
              <select value={possessionUserId} onChange={(e) => setPossessionUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {users.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
              <input type="date" value={possessionStartDate} onChange={(e) => setPossessionStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date (optional)</label>
              <input type="date" value={possessionEndDate} onChange={(e) => setPossessionEndDate(e.target.value)} placeholder="Leave blank if still in possession" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertPossession} style={{ padding: '0.5rem 1rem' }}>Assign</button>
              <button type="button" onClick={() => setPossessionFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {housingFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{editingHousingUnit ? 'Edit housing' : 'Add housing'}</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Address *</label>
              <input type="text" value={housingAddress} onChange={(e) => setHousingAddress(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Rent/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingRentWeek} onChange={(e) => setHousingRentWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Utilities/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingUtilitiesWeek} onChange={(e) => setHousingUtilitiesWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Insurance/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingInsuranceWeek} onChange={(e) => setHousingInsuranceWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void upsertHousingUnit()} style={{ padding: '0.5rem 1rem' }}>
                {editingHousingUnit ? 'Save' : 'Add'}
              </button>
              <button type="button" onClick={() => closeHousingForm()} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {housingPossessionFormOpen && selectedHousingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Assign housing to user</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>User *</label>
              <select value={housingPossessionUserId} onChange={(e) => setHousingPossessionUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {users.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email ?? u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
              <input type="date" value={housingPossessionStartDate} onChange={(e) => setHousingPossessionStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date (optional)</label>
              <input type="date" value={housingPossessionEndDate} onChange={(e) => setHousingPossessionEndDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void upsertHousingPossession()} style={{ padding: '0.5rem 1rem' }}>
                Assign
              </button>
              <button type="button" onClick={() => setHousingPossessionFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
          showPeople={showPeopleForHours}
          crewJobsByDatePerson={crewJobsByDatePerson}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onCrewSaved={() => loadCrewJobsRef.current?.()}
          showToast={showToast}
        />
      )}

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
          onClose={() => setHoursMyTimeEditor(null)}
          onSaved={() => {
            setHoursMyTimeEditor(null)
            loadAllClockSessionsRef.current?.()
            loadPeopleHoursRef.current?.()
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
