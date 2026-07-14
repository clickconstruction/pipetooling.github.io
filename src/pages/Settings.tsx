import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables, } from '../lib/cascadePersonName'
import { findPersonUserDuplicates, findNameSimilarDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import type { PayConfigRowForMerge } from '../lib/mergePersonUserDuplicates'
import { useAuth } from '../hooks/useAuth'
import {
  impersonationExitDisplayLabel,
  impersonationExitTitle,
  impersonationSignedInAsDescription,
} from '../lib/impersonationUiLabels'
import { getMergedFilteredPins, getUsersWithPin, type PinnedItem } from '../lib/pinnedTabs'
import { useCostMatrixTotal } from '../hooks/useCostMatrixTotal'
import { fetchSubLaborDueTotal } from '../hooks/useSubLaborDueTotal'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useToastContext } from '../contexts/ToastContext'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import ReportViewModal from '../components/ReportViewModal'
import ReportEditModal, { type ReportForEdit } from '../components/ReportEditModal'
import MyReportsModal, { type ReportForMyReports } from '../components/MyReportsModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import type { PayConfigRow } from '../types/peoplePayConfig'
import { buildSalariedWorkdayPickerRows } from '../lib/buildSalariedWorkdayPickerRows'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import SettingsRecentPushNotifications from '../components/settings/SettingsRecentPushNotifications'
import SettingsHowItWorksTab from '../components/settings/SettingsHowItWorksTab'
import SettingsAdvancedTab from '../components/settings/SettingsAdvancedTab'
import SettingsDataTab from '../components/settings/SettingsDataTab'
import SettingsJobsTab from '../components/settings/SettingsJobsTab'
import TeamFeedbackMasterAggregates from '../components/team-feedback/TeamFeedbackMasterAggregates'
import { pageTabStyle } from '../lib/pageTabStyle'
import type { Database } from '../types/database'
import {
  APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE,
  APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD,
} from '../lib/appSettingsKeys'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  substituteNotificationVariables,
  WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID,
  type EmailTemplate,
  type NotificationTemplate,
  type WorkflowFnEmailTemplateType,
} from '../lib/settingsTemplates'
import SettingsTemplatesTab from '../components/settings/SettingsTemplatesTab'
import SettingsPeopleTab from '../components/settings/SettingsPeopleTab'
import SettingsDashboardTab from '../components/settings/SettingsDashboardTab'
import SettingsCatalogsTab from '../components/settings/SettingsCatalogsTab'
import SettingsCatalogsProspectsTab from '../components/settings/SettingsCatalogsProspectsTab'
import SettingsAccountTab from '../components/settings/SettingsAccountTab'
import SettingsAccountSchedulingTab from '../components/settings/SettingsAccountSchedulingTab'
import SettingsAccountBackupTrailing from '../components/settings/SettingsAccountBackupTrailing'
import { useSettingsBackupExports } from '../hooks/useSettingsBackupExports'
import type {
  AssemblyType,
  CountsFixtureGroup,
  CountsFixtureGroupItem,
  FixtureType,
  PartType,
  PersonRow,
  ServiceType,
  UserRow,
} from '../types/settingsRows'
import { displayLabelForGoalPickerUser } from '../lib/goalPickerUserLabel'
import {
  builtinEstimateExperience,
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_EXPERIENCE_FIELD_MAX_LEN,
} from '../lib/estimateCustomerExperience'
import { ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY } from '../lib/estimatePublicTerms'
import type { EstimateCatalogLineItem } from '../lib/estimateLineItemCatalog'
import { catalogDbRowsToLineItems, fetchEstimateCatalogLive, replaceEstimateCatalogFromPayload } from '../lib/estimateCatalogApi'
import { isAssistantLike, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'

type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'
type NotificationHistoryRow = Database['public']['Tables']['notification_history']['Row']
type JobCountByMasterRow =
  Database['public']['Functions']['list_job_counts_by_master_for_dev_settings']['Returns'][number]

function SettingsGroup({
  id,
  title,
  description,
  titleTrailing,
  hidden,
  children,
}: {
  id: string
  title: string
  description?: string
  titleTrailing?: React.ReactNode
  hidden?: boolean
  children: React.ReactNode
}) {
  const headingId = `${id}-heading`
  const titleRowMarginBottom = description ? '0.5rem' : '0.75rem'
  const heading = (
    <h2
      id={headingId}
      style={{
        fontSize: '1.125rem',
        marginTop: 0,
        marginBottom: titleTrailing ? 0 : titleRowMarginBottom,
        fontWeight: 600,
        color: 'var(--text-strong)',
      }}
    >
      {title}
    </h2>
  )
  return (
    <section id={id} aria-labelledby={headingId} style={{ marginBottom: '2rem', scrollMarginTop: '0.75rem', display: hidden ? 'none' : undefined }}>
      {titleTrailing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: titleRowMarginBottom,
          }}
        >
          {heading}
          {titleTrailing}
        </div>
      ) : (
        heading
      )}
      {description ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>{description}</p>
      ) : null}
      {children}
    </section>
  )
}

function SettingsTabBar({
  groups,
  activeId,
  onSelect,
}: {
  groups: { id: string; label: string }[]
  activeId: string
  onSelect: (id: string) => void
}) {
  if (groups.length === 0) return null
  return (
    <nav
      aria-label="Settings sections"
      role="tablist"
      style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}
    >
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={activeId === g.id}
          onClick={() => onSelect(g.id)}
          style={pageTabStyle(activeId === g.id)}
        >
          {g.label}
        </button>
      ))}
    </nav>
  )
}

function getSettingsJumpGroups(myRole: UserRole | null): { id: string; label: string }[] {
  if (myRole == null) return []
  const r = myRole
  const groups: { id: string; label: string }[] = []
  groups.push({ id: 'settings-recent-push', label: 'Recent push' })
  groups.push({ id: 'settings-account', label: 'Your account' })
  groups.push({ id: 'settings-dashboard', label: 'Dashboard & alerts' })
  if (r === 'dev' || r === 'master_technician') {
    groups.push({ id: 'settings-people', label: 'People & accounts' })
  }
  if (r === 'dev') {
    groups.push({ id: 'settings-data', label: 'Data & migration' })
    groups.push({ id: 'settings-jobs', label: 'Jobs & dispatch' })
  }
  if (r === 'dev' || r === 'estimator') groups.push({ id: 'settings-catalogs', label: 'Catalogs & trades' })
  if (r === 'dev') groups.push({ id: 'settings-templates', label: 'Templates & testing' })
  if (!isSubcontractorLikeRole(r)) groups.push({ id: 'settings-advanced-tools', label: 'Advanced' })
  groups.push({ id: 'settings-how-it-works', label: 'How it works' })
  return groups
}


/** Whole elapsed days since ISO timestamp; null if invalid. */

export default function Settings() {
  const { user: authUser, profileName } = useAuth()
  const settingsImpersonationBannerLine = useMemo(
    () => impersonationSignedInAsDescription(profileName, authUser?.email ?? null),
    [profileName, authUser?.email],
  )
  const settingsImpersonationExitLabel = useMemo(
    () => impersonationExitDisplayLabel(profileName, authUser?.email ?? null),
    [profileName, authUser?.email],
  )
  const settingsImpersonationExitTitle = useMemo(
    () => impersonationExitTitle(profileName, authUser?.email ?? null),
    [profileName, authUser?.email],
  )
  const pushNotifications = usePushNotifications(authUser?.id)
  const { showToast } = useToastContext()
  const { reload: reloadLedgerPrefixMap } = useLedgerDisplayPrefixes()
  const allSalariedDevNarrowViewport = useNarrowViewport640()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('')
  const [myEstimatorProspectsAccess, setMyEstimatorProspectsAccess] = useState(false)
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [myPeople, setMyPeople] = useState<PersonRow[]>([])
  const [nonUserPeople, setNonUserPeople] = useState<PersonRow[]>([])
  const [allPeopleCount, setAllPeopleCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testNotificationSending, setTestNotificationSending] = useState(false)
  const [testNotificationError, setTestNotificationError] = useState<string | null>(null)
  const [testNotificationSuccess, setTestNotificationSuccess] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [locationLoading, setLocationLoading] = useState(false)
  const [pinsClearSuccess, setPinsClearSuccess] = useState(false)
  const [myPins, setMyPins] = useState<PinnedItem[]>([])
  const [pinsLoading, setPinsLoading] = useState(true)
  const [pinRemovingId, setPinRemovingId] = useState<string | null>(null)
  // Billed pin to dashboard (dev-only)
  const [pinBilledMasterIds, setPinBilledMasterIds] = useState<Set<string>>(new Set())
  const [pinBilledSaving, setPinBilledSaving] = useState(false)
  const [pinBilledUnpinSaving, setPinBilledUnpinSaving] = useState(false)
  const [pinBilledMessage, setPinBilledMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [billedCount, setBilledCount] = useState<number | null>(null)
  const [billedTotal, setBilledTotal] = useState<number | null>(null)
  // Supply Houses AP pin to dashboard (dev-only)
  const [pinAPMasterIds, setPinAPMasterIds] = useState<Set<string>>(new Set())
  const [pinAPSaving, setPinAPSaving] = useState(false)
  const [pinAPUnpinSaving, setPinAPUnpinSaving] = useState(false)
  const [pinAPMessage, setPinAPMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [apTotal, setApTotal] = useState<number | null>(null)
  // External Team pin to dashboard (dev-only)
  const [pinExternalTeamMasterIds, setPinExternalTeamMasterIds] = useState<Set<string>>(new Set())
  const [pinExternalTeamSaving, setPinExternalTeamSaving] = useState(false)
  const [pinExternalTeamUnpinSaving, setPinExternalTeamUnpinSaving] = useState(false)
  const [pinExternalTeamMessage, setPinExternalTeamMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [externalTeamTotal, setExternalTeamTotal] = useState<number | null>(null)
  // Cost matrix pin to dashboard (dev-only)
  const [pinCostMatrixMasterIds, setPinCostMatrixMasterIds] = useState<Set<string>>(new Set())
  const [pinCostMatrixSaving, setPinCostMatrixSaving] = useState(false)
  const [pinCostMatrixUnpinSaving, setPinCostMatrixUnpinSaving] = useState(false)
  const [pinCostMatrixMessage, setPinCostMatrixMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const [passwordChangeSubmitting, setPasswordChangeSubmitting] = useState(false)
  const [assistants, setAssistants] = useState<UserRow[]>([])
  const [adoptedAssistantIds, setAdoptedAssistantIds] = useState<Set<string>>(new Set())
  const [adoptionSaving, setAdoptionSaving] = useState(false)
  const [adoptionError, setAdoptionError] = useState<string | null>(null)
  const [primaries, setPrimaries] = useState<UserRow[]>([])
  const [adoptedPrimaryIds, setAdoptedPrimaryIds] = useState<Set<string>>(new Set())
  const [primaryAdoptionSaving, setPrimaryAdoptionSaving] = useState(false)
  const [primaryAdoptionError, setPrimaryAdoptionError] = useState<string | null>(null)
  const [superintendents, setSuperintendents] = useState<UserRow[]>([])
  const [adoptedSuperintendentIds, setAdoptedSuperintendentIds] = useState<Set<string>>(new Set())
  const [superintendentAdoptionSaving, setSuperintendentAdoptionSaving] = useState(false)
  const [superintendentAdoptionError, setSuperintendentAdoptionError] = useState<string | null>(null)
  // Dev-only: which master's adoptions we're managing (null = current user)
  const [selectedMasterIdForAdoptions, setSelectedMasterIdForAdoptions] = useState<string | null>(null)
  const [masters, setMasters] = useState<UserRow[]>([])
  const [sharedMasterIds, setSharedMasterIds] = useState<Set<string>>(new Set())
  const [sharingSaving, setSharingSaving] = useState(false)
  const [sharingError, setSharingError] = useState<string | null>(null)
  const [payApprovedMasterIds, setPayApprovedMasterIds] = useState<Set<string>>(new Set())
  const [payApprovedMasters, setPayApprovedMasters] = useState<UserRow[]>([])
  const [payApprovedSaving, setPayApprovedSaving] = useState(false)
  const [payApprovedError, setPayApprovedError] = useState<string | null>(null)
  const [defaultLaborRate, setDefaultLaborRate] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const [myProfileName, setMyProfileName] = useState('')
  const [myProfileEmail, setMyProfileEmail] = useState('')
  const [myProfilePhone, setMyProfilePhone] = useState('')
  const [myProfileOriginalName, setMyProfileOriginalName] = useState('')
  const [myProfileSaving, setMyProfileSaving] = useState(false)
  const [myProfileError, setMyProfileError] = useState<string | null>(null)
  /** Personal Salaried workday: shown only when people_pay_config matches profile name and is_salary */
  const [selfIsSalariedInPayConfig, setSelfIsSalariedInPayConfig] = useState(false)
  const [selfPaySalaryLoaded, setSelfPaySalaryLoaded] = useState(false)
  const [prospectCopyNoResponse, setProspectCopyNoResponse] = useState('')
  const [prospectCopyPhoneFollowup, setProspectCopyPhoneFollowup] = useState('')
  const [prospectCopyJustCheckingIn, setProspectCopyJustCheckingIn] = useState('')
  const [prospectCopyNoResponseSubject, setProspectCopyNoResponseSubject] = useState('')
  const [prospectCopyPhoneFollowupSubject, setProspectCopyPhoneFollowupSubject] = useState('')
  const [prospectCopyJustCheckingInSubject, setProspectCopyJustCheckingInSubject] = useState('')
  const [prospectCopySaving, setProspectCopySaving] = useState(false)
  const [prospectCopySectionOpen, setProspectCopySectionOpen] = useState(false)
  const [estimateCxSectionOpen, setEstimateCxSectionOpen] = useState(false)
  const [estimateCxSaving, setEstimateCxSaving] = useState(false)
  const [estimatePublicTermsSaving, setEstimatePublicTermsSaving] = useState(false)
  const [estimatePublicTermsBody, setEstimatePublicTermsBody] = useState('')
  const [estimatePublicTermsSectionOpen, setEstimatePublicTermsSectionOpen] = useState(false)
  const [estimateLineItemCatalogSectionOpen, setEstimateLineItemCatalogSectionOpen] = useState(false)
  const [estimateLineItemCatalogSaving, setEstimateLineItemCatalogSaving] = useState(false)
  const [estimateLineItemCatalogRows, setEstimateLineItemCatalogRows] = useState<EstimateCatalogLineItem[]>([])
  const [estimateCxByKey, setEstimateCxByKey] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const k of ESTIMATE_EXPERIENCE_APP_KEY_LIST) o[k] = ''
    return o
  })
  const [dashboardButtons, setDashboardButtons] = useState<Record<string, boolean>>({
    job: true,
    job_labor: true,
    bid: true,
    project: true,
    part: true,
    assembly: true,
    prospect: true,
    inspections: true,
    builder_review: true,
  })
  const [dashboardButtonsSaving, setDashboardButtonsSaving] = useState(false)
  const [dashboardQuickButtonsPlacement, setDashboardQuickButtonsPlacement] = useState<'top' | 'with_pins'>('with_pins')
  const [dashboardQuickButtonsPlacementSaving, setDashboardQuickButtonsPlacementSaving] = useState(false)
  const [goalPickerUsers, setGoalPickerUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [dailyGoalsTargetUserId, setDailyGoalsTargetUserId] = useState('')
  const [dailyGoalsRows, setDailyGoalsRows] = useState<Array<{ id: string; body: string; sort_order: number }>>([])
  const [dailyGoalsLoading, setDailyGoalsLoading] = useState(false)
  const [teamLeaderAssignments, setTeamLeaderAssignments] = useState<
    Array<{
      id: string
      leader_user_id: string
      member_user_id: string
      dashboard_hours_visibility: 'full' | 'strip_only'
    }>
  >([])
  const [teamLeaderVisibilitySavingId, setTeamLeaderVisibilitySavingId] = useState<string | null>(null)
  const [teamAssignLeaderId, setTeamAssignLeaderId] = useState('')
  const [teamAssignMemberId, setTeamAssignMemberId] = useState('')
  const [teamAssignSaving, setTeamAssignSaving] = useState(false)
  const [teamLeaderSortColumn, setTeamLeaderSortColumn] = useState<'leader' | 'member'>('leader')
  const [teamLeaderSortDir, setTeamLeaderSortDir] = useState<'asc' | 'desc'>('asc')
  const [teamLeaderAssignmentsSearchQuery, setTeamLeaderAssignmentsSearchQuery] = useState('')
  const [taskDispatchSectionOpen, setTaskDispatchSectionOpen] = useState(false)
  const [estimatorInboxSectionOpen, setEstimatorInboxSectionOpen] = useState(false)
  const [dashboardButtonsSectionOpen, setDashboardButtonsSectionOpen] = useState(false)
  const [salaryWorkdaySectionOpen, setSalaryWorkdaySectionOpen] = useState(true)
  const [allSalariedDevSectionOpen, setAllSalariedDevSectionOpen] = useState(false)
  const [devPayConfigForSalaried, setDevPayConfigForSalaried] = useState<Record<string, PayConfigRow> | null>(null)
  const [devPayConfigLoading, setDevPayConfigLoading] = useState(false)
  const [devSalariedSelectedUserId, setDevSalariedSelectedUserId] = useState<string | null>(null)
  const [timeOffSectionOpen, setTimeOffSectionOpen] = useState(true)
  const [dailyGoalsSectionOpen, setDailyGoalsSectionOpen] = useState(false)
  const [teamLeadAssignmentsSectionOpen, setTeamLeadAssignmentsSectionOpen] = useState(false)
  const [reportNotificationsSectionOpen, setReportNotificationsSectionOpen] = useState(false)
  const [defaultLaborRateSectionOpen, setDefaultLaborRateSectionOpen] = useState(false)
  const [dataBackupSectionOpen, setDataBackupSectionOpen] = useState(false)
  const [dispatchMemberIds, setDispatchMemberIds] = useState<Set<string>>(new Set())
  const [dispatchGroupError, setDispatchGroupError] = useState<string | null>(null)
  const [dispatchGroupSavingUserId, setDispatchGroupSavingUserId] = useState<string | null>(null)
  const [estimatorMemberIds, setEstimatorMemberIds] = useState<Set<string>>(new Set())
  const [estimatorGroupError, setEstimatorGroupError] = useState<string | null>(null)
  const [estimatorGroupSavingUserId, setEstimatorGroupSavingUserId] = useState<string | null>(null)

  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [serviceTypeFormOpen, setServiceTypeFormOpen] = useState(false)
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null)
  const [serviceTypeName, setServiceTypeName] = useState('')
  const [serviceTypeDescription, setServiceTypeDescription] = useState('')
  const [serviceTypeColor, setServiceTypeColor] = useState('')
  const [serviceTypeLedgerJobPrefix, setServiceTypeLedgerJobPrefix] = useState('')
  const [serviceTypeLedgerBidPrefix, setServiceTypeLedgerBidPrefix] = useState('')
  const [serviceTypeSaving, setServiceTypeSaving] = useState(false)
  const [serviceTypeError, setServiceTypeError] = useState<string | null>(null)

  // Fixture Types state
  const [fixtureTypes, setFixtureTypes] = useState<FixtureType[]>([])
  const [selectedServiceTypeForFixtures, setSelectedServiceTypeForFixtures] = useState<string>('')
  const [fixtureTypeFormOpen, setFixtureTypeFormOpen] = useState(false)
  const [editingFixtureType, setEditingFixtureType] = useState<FixtureType | null>(null)
  const [fixtureTypeName, setFixtureTypeName] = useState('')
  const [fixtureTypeSaving, setFixtureTypeSaving] = useState(false)
  const [fixtureTypeError, setFixtureTypeError] = useState<string | null>(null)
  const [fixtureTypePriceBookCounts, setFixtureTypePriceBookCounts] = useState<Record<string, number>>({})
  const [fixtureTypeLaborBookCounts, setFixtureTypeLaborBookCounts] = useState<Record<string, number>>({})
  const [fixtureTypeTakeoffBookCounts, setFixtureTypeTakeoffBookCounts] = useState<Record<string, number>>({})
  const [removingUnusedFixtureTypes, setRemovingUnusedFixtureTypes] = useState(false)

  // Counts Fixtures state (quick-select groups for Bids Counts)
  const [countsFixtureGroups, setCountsFixtureGroups] = useState<CountsFixtureGroup[]>([])
  const [countsFixtureGroupItems, setCountsFixtureGroupItems] = useState<CountsFixtureGroupItem[]>([])
  const [selectedServiceTypeForCountsFixtures, setSelectedServiceTypeForCountsFixtures] = useState<string>('')
  const [countsFixtureGroupFormOpen, setCountsFixtureGroupFormOpen] = useState(false)
  const [editingCountsFixtureGroup, setEditingCountsFixtureGroup] = useState<CountsFixtureGroup | null>(null)
  const [countsFixtureGroupLabel, setCountsFixtureGroupLabel] = useState('')
  const [countsFixtureGroupSaving, setCountsFixtureGroupSaving] = useState(false)
  const [countsFixtureGroupError, setCountsFixtureGroupError] = useState<string | null>(null)
  const [countsFixtureItemFormOpen, setCountsFixtureItemFormOpen] = useState(false)
  const [editingCountsFixtureGroupForItem, setEditingCountsFixtureGroupForItem] = useState<CountsFixtureGroup | null>(null)
  const [editingCountsFixtureItem, setEditingCountsFixtureItem] = useState<CountsFixtureGroupItem | null>(null)
  const [countsFixtureItemName, setCountsFixtureItemName] = useState('')
  const [countsFixtureItemSaving, setCountsFixtureItemSaving] = useState(false)
  const [countsFixtureItemError, setCountsFixtureItemError] = useState<string | null>(null)

  // Part Types state (for Materials)
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [selectedServiceTypeForParts, setSelectedServiceTypeForParts] = useState<string>('')
  const [partTypeFormOpen, setPartTypeFormOpen] = useState(false)
  const [editingPartType, setEditingPartType] = useState<PartType | null>(null)
  const [partTypeName, setPartTypeName] = useState('')
  const [partTypeSaving, setPartTypeSaving] = useState(false)
  const [partTypeError, setPartTypeError] = useState<string | null>(null)
  const [partTypePartCounts, setPartTypePartCounts] = useState<Record<string, number>>({})
  const [removingUnusedPartTypes, setRemovingUnusedPartTypes] = useState(false)

  // Assembly Types state (for Materials)
  const [assemblyTypes, setAssemblyTypes] = useState<AssemblyType[]>([])
  const [selectedServiceTypeForAssemblies, setSelectedServiceTypeForAssemblies] = useState<string>('')
  const [assemblyTypeFormOpen, setAssemblyTypeFormOpen] = useState(false)
  const [editingAssemblyType, setEditingAssemblyType] = useState<AssemblyType | null>(null)
  const [assemblyTypeName, setAssemblyTypeName] = useState('')
  const [assemblyTypeSaving, setAssemblyTypeSaving] = useState(false)
  const [assemblyTypeError, setAssemblyTypeError] = useState<string | null>(null)
  const [assemblyTypeAssemblyCounts, setAssemblyTypeAssemblyCounts] = useState<Record<string, number>>({})
  const [removingUnusedAssemblyTypes, setRemovingUnusedAssemblyTypes] = useState(false)

  type OrphanedPriceRow = {
    id: string
    partId: string | null
    partName: string
    supplyHouseId: string | null
    supplyHouseName: string
    price: number
    effectiveDate: string | null
    reason: 'missing_part' | 'missing_supply_house' | 'both'
  }

  const [viewingOrphanPrices, setViewingOrphanPrices] = useState(false)
  const [roleVisibilityExpanded, setRoleVisibilityExpanded] = useState(false)
  const [payApprovedMastersSectionOpen, setPayApprovedMastersSectionOpen] = useState(false)
  const [orphanPrices, setOrphanPrices] = useState<OrphanedPriceRow[]>([])
  const [loadingOrphanPrices, setLoadingOrphanPrices] = useState(false)
  const [orphanError, setOrphanError] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Manually clear Supabase auth keys so full page load sees no session
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb-'))
      keys.forEach((k) => localStorage.removeItem(k))
    }
    window.location.href = '/sign-in'
  }

  async function handleTestNotification() {
    if (!authUser?.id) return
    setTestNotificationError(null)
    setTestNotificationSuccess(null)
    setTestNotificationSending(true)
    try {
      const {
        data: { session: refreshedSession },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshedSession?.access_token) {
        setTestNotificationError('Session expired. Please sign out and sign back in.')
        return
      }
      const { data, error } = await supabase.functions.invoke('send-checklist-notification', {
        headers: {
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
        body: {
          recipient_user_id: authUser.id,
          push_title: 'Test notification',
          push_body: 'If you see this, push notifications are working!',
          push_url: '/settings',
          tag: 'test-notification',
        },
      })
      if (error) throw error
      const res = data as { error?: string; push_sent?: number } | null
      if (res?.error) throw new Error(res.error)
      const sent = res?.push_sent ?? 0
      setTestNotificationSuccess(
        sent > 0
          ? `Notification sent to ${sent} device(s).`
          : 'Notification sent. (On iOS with the app open, the system notification may not appear—try backgrounding the app.)'
      )
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Failed to send test notification'
      if (err instanceof FunctionsHttpError && err.context?.json) {
        try {
          const body = (await err.context.json()) as { error?: string } | null
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
      }
      setTestNotificationError(msg)
    } finally {
      setTestNotificationSending(false)
    }
  }

  function handleEnableLocation() {
    if (!('geolocation' in navigator)) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationPermission('granted')
        setLocationLoading(false)
      },
      (err) => {
        setLocationPermission(err.code === 1 ? 'denied' : 'unknown')
        setLocationLoading(false)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
    )
  }

  const [jobOwnerOverridesSectionOpen, setJobOwnerOverridesSectionOpen] = useState(false)
  const [jobOwnerOverrideByUserId, setJobOwnerOverrideByUserId] = useState<Record<string, string>>({})
  const [jobOwnerOverridesSaving, setJobOwnerOverridesSaving] = useState(false)
  const [jobCountByUserId, setJobCountByUserId] = useState<Record<string, number>>({})
  const [reassignTargetByUserId, setReassignTargetByUserId] = useState<Record<string, string>>({})
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false)
  const [reassignSourceUserId, setReassignSourceUserId] = useState<string | null>(null)
  const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null)
  const [reassignSubmitting, setReassignSubmitting] = useState(false)
  const [roleSharingSectionOpen, setRoleSharingSectionOpen] = useState(false)
  const [managePartsSectionOpen, setManagePartsSectionOpen] = useState(false)
  const [additionalPeopleSectionOpen, setAdditionalPeopleSectionOpen] = useState(false)
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false)
  const [emailTemplatesSectionOpen, setEmailTemplatesSectionOpen] = useState(false)
  const [reportSettingsSectionOpen, setReportSettingsSectionOpen] = useState(false)
  const [financialPinsSectionOpen, setFinancialPinsSectionOpen] = useState(false)
  const [notificationHistoryOpen, setNotificationHistoryOpen] = useState(false)
  const [mutedTasksOpen, setMutedTasksOpen] = useState(false)
  const [mutedTasks, setMutedTasks] = useState<Array<{ checklist_item_id: string; task_title: string; muted_until: string }>>([])
  const [mutedTasksLoading, setMutedTasksLoading] = useState(false)
  const [ignoredTaskTypesOpen, setIgnoredTaskTypesOpen] = useState(false)
  const [ignoredTaskTypes, setIgnoredTaskTypes] = useState<
    Array<{ checklist_item_id: string; task_title: string; ignored_at: string }>
  >([])
  const [ignoredTaskTypesLoading, setIgnoredTaskTypesLoading] = useState(false)
  const [ignoredTaskTypesUnignoringId, setIgnoredTaskTypesUnignoringId] = useState<string | null>(null)
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryRow[]>([])
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(false)
  const [notificationHistoryError, setNotificationHistoryError] = useState<string | null>(null)
  const [hasNotificationHistory, setHasNotificationHistory] = useState<boolean | null>(null)
  const [reportEditWindowDays, setReportEditWindowDays] = useState<string>('2')
  const [reportSubVisibilityMonths, setReportSubVisibilityMonths] = useState<string>('3')
  const [reportEnabledUserIds, setReportEnabledUserIds] = useState<Set<string>>(new Set())
  const [reportSettingsSaving, setReportSettingsSaving] = useState(false)
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([])
  const [notificationTemplatesSectionOpen, setNotificationTemplatesSectionOpen] = useState(false)
  const [workflowFnEmailSectionOpen, setWorkflowFnEmailSectionOpen] = useState(false)
  const [templatesJobPartsTallySectionOpen, setTemplatesJobPartsTallySectionOpen] = useState(false)
  const [templatesDeleteAllEstimatesSectionOpen, setTemplatesDeleteAllEstimatesSectionOpen] = useState(false)
  const [editingNotificationTemplate, setEditingNotificationTemplate] = useState<NotificationTemplate | null>(null)
  const [notificationTemplateTitle, setNotificationTemplateTitle] = useState('')
  const [notificationTemplateBody, setNotificationTemplateBody] = useState('')
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false)
  const [notificationTemplateError, setNotificationTemplateError] = useState<string | null>(null)
  const [templateTestTargetUserId, setTemplateTestTargetUserId] = useState('')
  const [notificationTestSending, setNotificationTestSending] = useState<string | null>(null)
  const [notificationTestError, setNotificationTestError] = useState<string | null>(null)
  const [notificationTestSuccess, setNotificationTestSuccess] = useState<string | null>(null)
  const [workflowFnTestTemplateType, setWorkflowFnTestTemplateType] =
    useState<WorkflowFnEmailTemplateType>('stage_assigned_started')
  const [workflowFnTestSending, setWorkflowFnTestSending] = useState(false)
  const [workflowFnTestError, setWorkflowFnTestError] = useState<string | null>(null)
  const [workflowFnTestSuccess, setWorkflowFnTestSuccess] = useState<string | null>(null)
  const [jobTallyMinPostedYmdInput, setJobTallyMinPostedYmdInput] = useState('')
  const [jobTallyMinPostedYmdSaving, setJobTallyMinPostedYmdSaving] = useState(false)
  const [jobTallyMinPostedYmdError, setJobTallyMinPostedYmdError] = useState<string | null>(null)
  const [fieldDispatchPhoneInput, setFieldDispatchPhoneInput] = useState('')
  const [fieldDispatchPhoneSaving, setFieldDispatchPhoneSaving] = useState(false)
  const [devResetEstimatesModalOpen, setDevResetEstimatesModalOpen] = useState(false)
  const [devResetEstimatesConfirmInput, setDevResetEstimatesConfirmInput] = useState('')
  const [devResetEstimatesLoading, setDevResetEstimatesLoading] = useState(false)
  const [editingNonUserPerson, setEditingNonUserPerson] = useState<PersonRow | null>(null)
  const [editPersonName, setEditPersonName] = useState('')
  const [editPersonEmail, setEditPersonEmail] = useState('')
  const [editPersonPhone, setEditPersonPhone] = useState('')
  const [editPersonNotes, setEditPersonNotes] = useState('')
  const [editPersonSaving, setEditPersonSaving] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null)
  const [mergeDuplicatesModalOpen, setMergeDuplicatesModalOpen] = useState(false)
  const [mergeDuplicatesLoading, setMergeDuplicatesLoading] = useState(false)
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  const {
    exportProjectsLoading,
    exportMaterialsLoading,
    exportBidsLoading,
    exportPeopleLoading,
    exportJobsLoading,
    exportChecklistLoading,
    exportReportsLoading,
    exportProspectsLoading,
    exportSettingsLoading,
    exportAllLoading,
    exportError,
    lastFullBackupAtIso,
    exportBackupBusy,
    exportProjectsBackup,
    exportMaterialsBackup,
    exportBidsBackup,
    exportPeopleBackup,
    exportJobsBackup,
    exportChecklistBackup,
    exportReportsBackup,
    exportProspectsBackup,
    exportSettingsBackup,
    exportAllBackup,
  } = useSettingsBackupExports(authUser?.id)
  const [reportTemplates, setReportTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [reportNotificationTemplateIds, setReportNotificationTemplateIds] = useState<Set<string>>(new Set())
  const [reportNotificationSaving, setReportNotificationSaving] = useState(false)
  const [myReports, setMyReports] = useState<ReportForMyReports[]>([])
  const [myReportsLoading, setMyReportsLoading] = useState(false)
  const [myReportsExpanded, setMyReportsExpanded] = useState(false)
  const [myReportsModalOpen, setMyReportsModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string>; reported_at_lat?: number | null; reported_at_lng?: number | null } | null>(null)
  const [viewReportModalOpen, setViewReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [myReportsReportEditWindowDays, setMyReportsReportEditWindowDays] = useState<number>(2)
  const loadMyReportsRef = useRef<(() => void) | null>(null)
  const [impersonating, setImpersonating] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('impersonation_original')
  )


  async function handleBackToMyAccount() {
    const raw = localStorage.getItem('impersonation_original')
    localStorage.removeItem('impersonation_original')
    setImpersonating(false)
    if (!raw) return
    try {
      const { access_token, refresh_token } = JSON.parse(raw) as { access_token?: string; refresh_token?: string }
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    } catch {
      window.location.href = '/sign-in'
      return
    }
    window.location.href = '/dashboard'
  }


  async function loadOrphanMaterialPrices() {
    setOrphanError(null)
    setLoadingOrphanPrices(true)
    try {
      const { data, error } = await supabase
        .from('material_part_prices')
        .select('*, material_parts(*), supply_houses(*)')
      if (error) {
        setOrphanError(error.message)
        setOrphanPrices([])
        return
      }
      const rows = (data as any[]) ?? []
      const classified = rows
        .map((row) => {
          const part = (row.material_parts ?? null) as { id: string; name: string | null } | null
          const sh = (row.supply_houses ?? null) as { id: string; name: string | null } | null
          const missingPart = !part
          const missingSupplyHouse = !sh
          if (!missingPart && !missingSupplyHouse) return null
          const reason: OrphanedPriceRow['reason'] =
            missingPart && missingSupplyHouse
              ? 'both'
              : missingPart
              ? 'missing_part'
              : 'missing_supply_house'
          return {
            id: row.id as string,
            partId: (row.part_id as string | null) ?? null,
            partName: part?.name ?? `Unknown part (${row.part_id ?? 'no id'})`,
            supplyHouseId: (row.supply_house_id as string | null) ?? null,
            supplyHouseName: sh?.name ?? `Unknown supply house (${row.supply_house_id ?? 'no id'})`,
            price: Number(row.price ?? 0),
            effectiveDate: (row.effective_date as string | null) ?? null,
            reason,
          } as OrphanedPriceRow
        })
        .filter((r): r is OrphanedPriceRow => r !== null)

      setOrphanPrices(classified)
    } catch (e) {
      setOrphanError(e instanceof Error ? e.message : 'Failed to load orphaned prices')
      setOrphanPrices([])
    } finally {
      setLoadingOrphanPrices(false)
    }
  }

  async function deleteOrphanPrice(id: string) {
    if (!id) return
    const { error } = await supabase.from('material_part_prices').delete().eq('id', id)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices((prev) => prev.filter((p) => p.id !== id))
  }

  async function deleteAllOrphanPrices() {
    if (orphanPrices.length === 0) return
    if (!confirm('Delete ALL orphaned material prices listed here? This cannot be undone.')) return
    const ids = orphanPrices.map((p) => p.id)
    const { error } = await supabase.from('material_part_prices').delete().in('id', ids)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices([])
  }


  async function loadBilledTotalAndPinnedUsers() {
    if (myRole !== 'dev') return
    const [jobsRes, invoicesRes, pinnedRes] = await Promise.all([
      supabase.from('jobs_ledger').select('revenue, payments_made').eq('status', 'billed'),
      supabase.from('jobs_ledger_invoices').select('amount').eq('status', 'billed'),
      getUsersWithPin('/jobs', 'billed'),
    ])
    const jobs = (jobsRes.data ?? []) as Array<{ revenue: number | null; payments_made: number | null }>
    const invoices = (invoicesRes.data ?? []) as Array<{ amount: number }>
    const jobsTotal = jobs.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
    const invoicesTotal = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
    setBilledCount(jobs.length + invoices.length)
    setBilledTotal(jobsTotal + invoicesTotal)
    setPinBilledMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadSupplyHousesAPTotalAndPinnedUsers() {
    if (myRole !== 'dev') return
    const [invoicesRes, pinnedRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('amount, is_paid').eq('is_paid', false),
      getUsersWithPin('/materials', 'supply-houses'),
    ])
    const total = (invoicesRes.data ?? []).reduce((sum, r) => sum + Number((r as { amount: number }).amount ?? 0), 0)
    setApTotal(total)
    setPinAPMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadExternalTeamTotalAndPinnedUsers() {
    if (myRole !== 'dev') return
    const [subLaborTotal, pinnedRes] = await Promise.all([
      fetchSubLaborDueTotal(),
      getUsersWithPin('/jobs', 'sub_sheet_ledger'),
    ])
    setExternalTeamTotal(subLaborTotal)
    setPinExternalTeamMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadCostMatrixPinnedUsers() {
    if (myRole !== 'dev') return
    const rows = await getUsersWithPin('/people', 'hours')
    setPinCostMatrixMasterIds(new Set(rows.map((r) => r.user_id)))
  }

  async function refreshSelfPaySalaryForPayName(payNameRaw: string) {
    const payName = payNameRaw.trim()
    if (!payName) {
      setSelfIsSalariedInPayConfig(false)
      setSelfPaySalaryLoaded(true)
      return
    }
    try {
      const payRow = await withSupabaseRetry(
        async () =>
          supabase.from('people_pay_config').select('is_salary').eq('person_name', payName).maybeSingle(),
        'settings self pay salary flag',
      )
      setSelfIsSalariedInPayConfig(!!(payRow as { is_salary?: boolean } | null)?.is_salary)
    } catch {
      setSelfIsSalariedInPayConfig(false)
    } finally {
      setSelfPaySalaryLoaded(true)
    }
  }

  async function loadData() {
    if (!authUser?.id) {
      setSelfPaySalaryLoaded(false)
      setSelfIsSalariedInPayConfig(false)
      setLoading(false)
      return
    }
    setSelfPaySalaryLoaded(false)
    setSelfIsSalariedInPayConfig(false)
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids, estimator_prospects_access, name, email, phone')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setSelfIsSalariedInPayConfig(false)
      setSelfPaySalaryLoaded(true)
      setLoading(false)
      return
    }
    const meRow = me as {
      role: UserRole
      estimator_service_type_ids?: string[] | null
      estimator_prospects_access?: boolean | null
      name?: string
      email?: string
      phone?: string | null
    } | null
    const role = meRow?.role ?? null
    const loadedName = meRow?.name ?? ''
    setMyProfileName(loadedName)
    setMyProfileOriginalName(loadedName)
    setMyProfileEmail(meRow?.email ?? '')
    setMyProfilePhone(meRow?.phone ?? '')
    const estIds = meRow?.estimator_service_type_ids
    setMyRole(role)
    setMyEstimatorProspectsAccess(role === 'estimator' && !!meRow?.estimator_prospects_access)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }

    await refreshSelfPaySalaryForPayName(loadedName)

    // Load assistants, primaries, superintendents, and adoptions for masters and devs
    if (role === 'master_technician' || role === 'dev') {
      await Promise.all([
        loadAssistantsAndAdoptions(authUser.id),
        loadPrimariesAndAdoptions(authUser.id),
        loadSuperintendentsAndAdoptions(authUser.id),
        loadMastersAndShares(authUser.id),
      ])
    }
    
    // Load dashboard button visibility for dev, master, assistant
    if (role === 'dev' || role === 'master_technician' || isAssistantLike(role)) {
      const [{ data: btnRows }, { data: dashPref }] = await Promise.all([
        supabase.from('user_dashboard_buttons').select('button_key, visible').eq('user_id', authUser.id),
        supabase.from('user_dashboard_preferences').select('quick_buttons_placement').eq('user_id', authUser.id).maybeSingle(),
      ])
      const defaults: Record<string, boolean> = { job: true, job_labor: true, bid: true, project: true, part: true, assembly: true, prospect: true, inspections: true, builder_review: role === 'master_technician' }
      const map = { ...defaults }
      for (const r of (btnRows ?? []) as Array<{ button_key: string; visible: boolean }>) {
        if (r.button_key in map) map[r.button_key] = r.visible
      }
      setDashboardButtons(map)
      const placement = (dashPref as { quick_buttons_placement?: string } | null)?.quick_buttons_placement
      // Default is with_pins (matches Dashboard); an explicit 'top' row is honored.
      setDashboardQuickButtonsPlacement(placement === 'top' ? 'top' : 'with_pins')

      // Load report templates and report notification preferences
      const [templatesRes, prefsRes] = await Promise.all([
        supabase.from('report_templates').select('id, name').order('sequence_order'),
        supabase.from('user_report_notification_preferences').select('template_id').eq('user_id', authUser.id),
      ])
      setReportTemplates((templatesRes.data ?? []) as Array<{ id: string; name: string }>)
      setReportNotificationTemplateIds(new Set((prefsRes.data ?? []).map((p: { template_id: string }) => p.template_id)))

      const { data: goalUsers } = await supabase
        .from('users')
        .select('id, name, email')
        .is('archived_at', null)
        .order('name')
      setGoalPickerUsers((goalUsers ?? []) as Array<{ id: string; name: string | null; email: string | null }>)

      const { data: tlaRows, error: tlaErr } = await supabase
        .from('team_leader_assignments')
        .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
        .order('created_at', { ascending: false })
      if (tlaErr) setError(tlaErr.message)
      else
        setTeamLeaderAssignments(
          ((tlaRows ?? []) as Array<{
            id: string
            leader_user_id: string
            member_user_id: string
            dashboard_hours_visibility: string | null
          }>).map((r) => ({
            id: r.id,
            leader_user_id: r.leader_user_id,
            member_user_id: r.member_user_id,
            dashboard_hours_visibility:
              r.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
          })),
        )
    }
    
    // Load dev-only data (users, people, etc.)
    if (role === 'dev') {
    const { data: list, error: eList } = await supabase
      .from('users')
      .select('id, email, name, role, last_sign_in_at, estimator_prospects_access, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids')
      .is('archived_at', null)
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
    
    // Load all people entries (RLS may restrict, but we'll filter client-side)
    // Note: RLS policy may need to allow owners to see all people entries
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
      .is('archived_at', null)
      .order('name')

    if (ePeople) {
      console.error('Error loading people:', ePeople)
      setError(ePeople.message)
      setAllPeopleCount(0)
    } else if (allPeople) {
      setAllPeopleCount(allPeople.length)
      
      // Get all user emails to check if people are users
      const userEmails = new Set((list as UserRow[] | null)?.map(u => u.email?.toLowerCase()).filter(Boolean) ?? [])
      
      // Separate people created by me vs others
      const peopleFromMe = allPeople.filter(p => p.master_user_id === authUser.id)
      const peopleFromOthers = allPeople.filter(p => p.master_user_id !== authUser.id)
      
      // Process people created by me
      const myPeopleWithInfo: PersonRow[] = peopleFromMe.map(p => ({
        ...p,
        creator_name: null, // Created by me, so no need to show creator
        creator_email: null,
        is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
      }))
      setMyPeople(myPeopleWithInfo)
      
      // Process people created by others
      if (peopleFromOthers.length > 0) {
        // Get creator information for each person
        const creatorIds = [...new Set(peopleFromOthers.map(p => p.master_user_id))]
        const { data: creators, error: eCreators } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', creatorIds)
        
        if (eCreators) {
          console.error('Error loading creators:', eCreators)
          setError(eCreators.message)
        } else {
          const creatorMap = new Map(
            (creators as Array<{ id: string; name: string; email: string }> | null)?.map(c => [c.id, c]) ?? []
          )
          
          const peopleWithCreators: PersonRow[] = peopleFromOthers.map(p => ({
            ...p,
            creator_name: creatorMap.get(p.master_user_id)?.name ?? null,
            creator_email: creatorMap.get(p.master_user_id)?.email ?? null,
            is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
          }))
          
          setNonUserPeople(peopleWithCreators)
        }
      } else {
        setNonUserPeople([])
      }
    } else {
      // No people entries at all
      setMyPeople([])
      setNonUserPeople([])
    }
    }
    
    // Load email templates and service types if dev; service types also for estimators (Material Part/Assembly Types)
    if (role === 'dev' || role === 'estimator') {
      await loadServiceTypes()
    }
    if (role === 'dev') {
      await Promise.all([loadNotificationTemplates(), loadEmailTemplates(), loadPayApprovedMasters()])

      const prospectCopySettingKeys = [
        'prospect_copy_no_response_email',
        'prospect_copy_phone_followup_email',
        'prospect_copy_just_checking_in_email',
        'prospect_copy_no_response_email_subject',
        'prospect_copy_phone_followup_email_subject',
        'prospect_copy_just_checking_in_email_subject',
      ] as const
      const estimateCxSettingKeys = [...ESTIMATE_EXPERIENCE_APP_KEY_LIST, ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY]
      const settingsBatchKeys = [
        'default_labor_rate',
        ...prospectCopySettingKeys,
        ...estimateCxSettingKeys,
        'report_edit_window_days',
        'report_sub_visibility_months',
      ]

      const { data: settingsBatchRows } = await supabase
        .from('app_settings')
        .select('key, value_text, value_num')
        .in('key', settingsBatchKeys)

      const settingsByKey = new Map(
        (settingsBatchRows ?? []).map((r) => [r.key, r] as [string, { value_text: string | null; value_num: number | null }]),
      )
      const laborRow = settingsByKey.get('default_labor_rate')
      const laborVal = laborRow?.value_num
      setDefaultLaborRate(laborVal != null ? String(laborVal) : '')

      const prospectCopyByKey = new Map(
        prospectCopySettingKeys.map((k) => [k, settingsByKey.get(k)?.value_text ?? ''] as const),
      )
      setProspectCopyNoResponse(prospectCopyByKey.get('prospect_copy_no_response_email') ?? '')
      setProspectCopyPhoneFollowup(prospectCopyByKey.get('prospect_copy_phone_followup_email') ?? '')
      setProspectCopyJustCheckingIn(prospectCopyByKey.get('prospect_copy_just_checking_in_email') ?? '')
      setProspectCopyNoResponseSubject(prospectCopyByKey.get('prospect_copy_no_response_email_subject') ?? '')
      setProspectCopyPhoneFollowupSubject(prospectCopyByKey.get('prospect_copy_phone_followup_email_subject') ?? '')
      setProspectCopyJustCheckingInSubject(prospectCopyByKey.get('prospect_copy_just_checking_in_email_subject') ?? '')

      const estimateCxRows = estimateCxSettingKeys
        .map((k) => {
          const row = settingsByKey.get(k)
          return row ? { key: k, value_text: row.value_text } : null
        })
        .filter((r): r is { key: string; value_text: string | null } => r != null)

      setEstimateCxByKey((prev) => {
        const next = { ...prev }
        for (const k of ESTIMATE_EXPERIENCE_APP_KEY_LIST) next[k] = next[k] ?? ''
        for (const r of estimateCxRows) {
          if (ESTIMATE_EXPERIENCE_APP_KEY_LIST.includes(r.key as (typeof ESTIMATE_EXPERIENCE_APP_KEY_LIST)[number]))
            next[r.key] = r.value_text ?? ''
        }
        const footerAppKey = 'estimate_accept_page_footer'
        if (!(next[footerAppKey]?.trim())) next[footerAppKey] = builtinEstimateExperience().accept_page_footer
        return next
      })
      const publicTermsRow = estimateCxRows.find((r) => r.key === ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY)
      setEstimatePublicTermsBody(publicTermsRow?.value_text ?? '')

      setReportEditWindowDays(String(settingsByKey.get('report_edit_window_days')?.value_num ?? 2))
      setReportSubVisibilityMonths(String(settingsByKey.get('report_sub_visibility_months')?.value_num ?? 3))

      const [
        ,
        jobOwnerResult,
        jobCountsResult,
        enabledRes,
        dgmRes,
        egmRes,
      ] = await Promise.all([
        (async () => {
          try {
            const ecRows = await fetchEstimateCatalogLive(supabase)
            setEstimateLineItemCatalogRows(catalogDbRowsToLineItems(ecRows))
          } catch {
            setEstimateLineItemCatalogRows([])
          }
        })(),
        supabase.from('app_settings').select('key, value_text').like('key', 'job_owner_override_%'),
        (async (): Promise<JobCountByMasterRow[]> => {
          try {
            const rows = await withSupabaseRetry(
              () => supabase.rpc('list_job_counts_by_master_for_dev_settings'),
              'list_job_counts_by_master_for_dev_settings',
            )
            return rows ?? []
          } catch {
            return []
          }
        })(),
        supabase.from('report_enabled_users').select('user_id'),
        supabase.from('dispatch_group_members').select('user_id'),
        supabase.from('estimator_group_members').select('user_id'),
      ])

      const overrides: Record<string, string> = {}
      for (const row of jobOwnerResult.data ?? []) {
        const userId = row.key.replace(/^job_owner_override_/, '')
        if (userId && row.value_text) overrides[userId] = row.value_text
      }
      setJobOwnerOverrideByUserId(overrides)

      const jcRows = jobCountsResult
      const counts: Record<string, number> = {}
      for (const row of jcRows) {
        if (row.master_user_id) counts[row.master_user_id] = Number(row.job_count)
      }
      setJobCountByUserId(counts)

      setReportEnabledUserIds(new Set((enabledRes.data ?? []).map((r: { user_id: string }) => r.user_id)))
      if (dgmRes.error) setError(dgmRes.error.message)
      else setDispatchMemberIds(new Set((dgmRes.data ?? []).map((r: { user_id: string }) => r.user_id)))
      if (egmRes.error) setError(egmRes.error.message)
      else setEstimatorMemberIds(new Set((egmRes.data ?? []).map((r: { user_id: string }) => r.user_id)))
    }
    
    setLoading(false)
  }

  async function toggleDispatchGroupMember(userId: string, currentlyMember: boolean) {
    if (myRole !== 'dev') return
    setDispatchGroupSavingUserId(userId)
    setDispatchGroupError(null)
    try {
      if (currentlyMember) {
        const { error } = await supabase.from('dispatch_group_members').delete().eq('user_id', userId)
        if (error) setDispatchGroupError(error.message)
        else
          setDispatchMemberIds((prev) => {
            const n = new Set(prev)
            n.delete(userId)
            return n
          })
      } else {
        const { error } = await supabase.from('dispatch_group_members').insert({ user_id: userId })
        if (error) setDispatchGroupError(error.message)
        else setDispatchMemberIds((prev) => new Set(prev).add(userId))
      }
    } finally {
      setDispatchGroupSavingUserId(null)
    }
  }

  async function toggleEstimatorGroupMember(userId: string, currentlyMember: boolean) {
    if (myRole !== 'dev') return
    setEstimatorGroupSavingUserId(userId)
    setEstimatorGroupError(null)
    try {
      if (currentlyMember) {
        const { error } = await supabase.from('estimator_group_members').delete().eq('user_id', userId)
        if (error) setEstimatorGroupError(error.message)
        else
          setEstimatorMemberIds((prev) => {
            const n = new Set(prev)
            n.delete(userId)
            return n
          })
      } else {
        const { error } = await supabase.from('estimator_group_members').insert({ user_id: userId })
        if (error) setEstimatorGroupError(error.message)
        else setEstimatorMemberIds((prev) => new Set(prev).add(userId))
      }
    } finally {
      setEstimatorGroupSavingUserId(null)
    }
  }

  async function saveJobOwnerOverrides(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setJobOwnerOverridesSaving(true)
    try {
      const creators = users.filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))
      for (const u of creators) {
        const key = `job_owner_override_${u.id}`
        const selected = jobOwnerOverrideByUserId[u.id]
        if (!selected || selected === '') {
          await supabase.from('app_settings').delete().eq('key', key)
        } else {
          await supabase.from('app_settings').upsert({ key, value_text: selected }, { onConflict: 'key' })
        }
      }
      showToast('Job creation overrides saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setJobOwnerOverridesSaving(false)
    }
  }

  async function confirmReassignJobs() {
    if (!reassignSourceUserId || !reassignTargetUserId) return
    setReassignSubmitting(true)
    try {
      const { error } = await supabase
        .from('jobs_ledger')
        .update({ master_user_id: reassignTargetUserId })
        .eq('master_user_id', reassignSourceUserId)
      setReassignConfirmOpen(false)
      setReassignSourceUserId(null)
      setReassignTargetUserId(null)
      if (error) setError(error.message)
      else {
        showToast('Jobs reassigned.', 'success')
        setJobCountByUserId((prev) => ({
          ...prev,
          [reassignSourceUserId]: 0,
          [reassignTargetUserId]: (prev[reassignTargetUserId] ?? 0) + (prev[reassignSourceUserId] ?? 0),
        }))
      }
    } finally {
      setReassignSubmitting(false)
    }
  }

  async function saveDefaultLaborRate(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setDefaultLaborRateSaving(true)
    const val = defaultLaborRate.trim() === '' ? null : parseFloat(defaultLaborRate) || null
    const { error } = await supabase.from('app_settings').upsert({ key: 'default_labor_rate', value_num: val }, { onConflict: 'key' })
    setDefaultLaborRateSaving(false)
    if (error) setError(error.message)
  }

  async function saveProspectCopyDefaults(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setProspectCopySaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      [
        { key: 'prospect_copy_no_response_email', value_text: prospectCopyNoResponse },
        { key: 'prospect_copy_phone_followup_email', value_text: prospectCopyPhoneFollowup },
        { key: 'prospect_copy_just_checking_in_email', value_text: prospectCopyJustCheckingIn },
        { key: 'prospect_copy_no_response_email_subject', value_text: prospectCopyNoResponseSubject },
        { key: 'prospect_copy_phone_followup_email_subject', value_text: prospectCopyPhoneFollowupSubject },
        { key: 'prospect_copy_just_checking_in_email_subject', value_text: prospectCopyJustCheckingInSubject },
      ],
      { onConflict: 'key' }
    )
    setProspectCopySaving(false)
    if (error) setError(error.message)
    else showToast('Prospect copy defaults saved.', 'success')
  }

  async function saveEstimateCustomerCopyDefaults(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setEstimateCxSaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      ESTIMATE_EXPERIENCE_APP_KEY_LIST.map((key) => ({
        key,
        value_text: (estimateCxByKey[key] ?? '').slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
      })),
      { onConflict: 'key' },
    )
    setEstimateCxSaving(false)
    if (error) setError(error.message)
    else showToast('Estimate customer copy defaults saved.', 'success')
  }

  async function saveEstimatePublicTerms(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setEstimatePublicTermsSaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      {
        key: ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY,
        value_text: estimatePublicTermsBody.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
      },
      { onConflict: 'key' },
    )
    setEstimatePublicTermsSaving(false)
    if (error) setError(error.message)
    else showToast('Public terms page saved.', 'success')
  }

  async function saveEstimateLineItemCatalog(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setEstimateLineItemCatalogSaving(true)
    try {
      await replaceEstimateCatalogFromPayload(supabase, estimateLineItemCatalogRows)
      const ecRows = await fetchEstimateCatalogLive(supabase)
      setEstimateLineItemCatalogRows(catalogDbRowsToLineItems(ecRows))
      showToast('Estimate line item catalog saved.', 'success')
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not save catalog'))
    } finally {
      setEstimateLineItemCatalogSaving(false)
    }
  }

  async function saveMyProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    const trimmedEmail = myProfileEmail.trim()
    const trimmedName = myProfileName.trim()
    const trimmedPhone = myProfilePhone.trim() || null
    setMyProfileError(null)
    if (!trimmedEmail) {
      setMyProfileError('Email is required.')
      return
    }
    const canEditName = !isSubcontractorLikeRole(myRole)
    if (canEditName && trimmedName) {
      const isDuplicate = await checkDuplicateName(trimmedName, authUser.id)
      if (isDuplicate) {
        setMyProfileError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        return
      }
    }
    setMyProfileSaving(true)
    const updates: { name?: string; email: string; phone: string | null } = { email: trimmedEmail, phone: trimmedPhone }
    if (canEditName) updates.name = trimmedName
    const { error: err } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)
    if (err) {
      setMyProfileError(err.message)
      setMyProfileSaving(false)
      return
    }
    if (myProfileOriginalName.trim() && myProfileOriginalName.trim() !== trimmedName) {
      await cascadePersonNameInPayTables(myProfileOriginalName.trim(), trimmedName)
    }
    setMyProfileOriginalName(trimmedName)
    await refreshSelfPaySalaryForPayName(trimmedName)
    setMyProfileSaving(false)
    showToast('Profile saved.', 'success')
  }

  async function saveReportSettings(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setReportSettingsSaving(true)
    const editDays = Math.max(0, Math.floor(parseFloat(reportEditWindowDays) || 0))
    const visMonths = Math.max(0, Math.floor(parseFloat(reportSubVisibilityMonths) || 0))
    const { error: appErr } = await supabase.from('app_settings').upsert(
      [
        { key: 'report_edit_window_days', value_num: editDays },
        { key: 'report_sub_visibility_months', value_num: visMonths },
      ],
      { onConflict: 'key' }
    )
    if (appErr) {
      setError(appErr.message)
      setReportSettingsSaving(false)
      return
    }
    const currentIds = reportEnabledUserIds
    const { data: existing } = await supabase.from('report_enabled_users').select('user_id')
    const existingIds = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id))
    for (const uid of currentIds) {
      if (!existingIds.has(uid)) {
        await supabase.from('report_enabled_users').insert({ user_id: uid })
      }
    }
    for (const uid of existingIds) {
      if (!currentIds.has(uid)) {
        await supabase.from('report_enabled_users').delete().eq('user_id', uid)
      }
    }
    setReportSettingsSaving(false)
    showToast('Report settings saved.', 'success')
  }

  async function saveReportNotificationPreferences(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id || (myRole !== 'dev' && myRole !== 'master_technician' && !isAssistantLike(myRole))) return
    setReportNotificationSaving(true)
    const currentIds = reportNotificationTemplateIds
    const { data: existing } = await supabase
      .from('user_report_notification_preferences')
      .select('template_id')
      .eq('user_id', authUser.id)
    const existingIds = new Set((existing ?? []).map((p: { template_id: string }) => p.template_id))
    for (const tid of currentIds) {
      if (!existingIds.has(tid)) {
        await supabase.from('user_report_notification_preferences').insert({ user_id: authUser.id, template_id: tid })
      }
    }
    for (const tid of existingIds) {
      if (!currentIds.has(tid)) {
        await supabase.from('user_report_notification_preferences').delete().eq('user_id', authUser.id).eq('template_id', tid)
      }
    }
    setReportNotificationSaving(false)
    showToast('Report notification preferences saved.', 'success')
  }

  function toggleReportNotificationTemplate(templateId: string) {
    setReportNotificationTemplateIds((prev) => {
      const next = new Set(prev)
      if (next.has(templateId)) next.delete(templateId)
      else next.add(templateId)
      return next
    })
  }

  function toggleReportEnabledUser(userId: string) {
    setReportEnabledUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function loadPeopleForDev() {
    if (!authUser?.id || myRole !== 'dev') return
    const { data: list } = await supabase.from('users').select('id, email, name').order('name')
    const userEmails = new Set((list as UserRow[] | null)?.map(u => u.email?.toLowerCase()).filter(Boolean) ?? [])
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
      .is('archived_at', null)
      .order('name')
    if (ePeople) {
      setAllPeopleCount(0)
      return
    }
    if (!allPeople) {
      setMyPeople([])
      setNonUserPeople([])
      setAllPeopleCount(0)
      return
    }
    setAllPeopleCount(allPeople.length)
    type PeopleRow = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
    const peopleFromMe = (allPeople as PeopleRow[]).filter(p => p.master_user_id === authUser.id)
    const peopleFromOthers = (allPeople as PeopleRow[]).filter(p => p.master_user_id !== authUser.id)
    setMyPeople(peopleFromMe.map(p => ({
      ...p,
      creator_name: null,
      creator_email: null,
      is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
    })))
    if (peopleFromOthers.length === 0) {
      setNonUserPeople([])
      return
    }
    const creatorIds = [...new Set(peopleFromOthers.map(p => p.master_user_id))]
    const { data: creators } = await supabase.from('users').select('id, name, email').in('id', creatorIds)
    const creatorMap = new Map((creators as Array<{ id: string; name: string; email: string }> | null)?.map(c => [c.id, c]) ?? [])
    setNonUserPeople(peopleFromOthers.map(p => ({
      ...p,
      creator_name: creatorMap.get(p.master_user_id)?.name ?? null,
      creator_email: creatorMap.get(p.master_user_id)?.email ?? null,
      is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
    })))
  }

  async function saveNonUserPersonEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingNonUserPerson) return
    const trimmedName = editPersonName.trim()
    if (!trimmedName) {
      setEditPersonError('Name is required')
      return
    }
    setEditPersonSaving(true)
    setEditPersonError(null)
    const { error: err } = await supabase.from('people').update({
      name: trimmedName,
      email: editPersonEmail.trim() || null,
      phone: editPersonPhone.trim() || null,
      notes: editPersonNotes.trim() || null,
    }).eq('id', editingNonUserPerson.id)
    setEditPersonSaving(false)
    if (err) setEditPersonError(err.message)
    else {
      const oldName = editingNonUserPerson.name?.trim()
      if (oldName && oldName !== trimmedName) {
        await cascadePersonNameInPayTables(oldName, trimmedName)
      }
      setEditingNonUserPerson(null)
      await loadPeopleForDev()
    }
  }

  async function deleteNonUserPerson(p: PersonRow) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    setDeletingPersonId(p.id)
    setError(null)
    const { error: err } = await supabase.from('people').delete().eq('id', p.id)
    setDeletingPersonId(null)
    if (err) setError(err.message)
    else await loadPeopleForDev()
  }

  async function loadAssistantsAndAdoptions(masterId: string) {
    // Load all assistants
    const { data: assistantsData, error: assistantsErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .in('role', ['assistant', 'controller' as 'assistant'])
      .order('name')
    
    if (assistantsErr) {
      console.error('Error loading assistants:', assistantsErr)
      setAdoptionError(assistantsErr.message)
    } else {
      setAssistants((assistantsData as UserRow[]) ?? [])
    }
    
    // Load current adoptions for this master
    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_assistants')
      .select('assistant_id')
      .eq('master_id', masterId)
    
    if (adoptionsErr) {
      console.error('Error loading adoptions:', adoptionsErr)
      setAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.assistant_id))
      setAdoptedAssistantIds(adoptedSet)
    }
  }

  async function loadPrimariesAndAdoptions(masterId: string) {
    const { data: primariesData, error: primariesErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'primary')
      .order('name')

    if (primariesErr) {
      console.error('Error loading primaries:', primariesErr)
      setPrimaryAdoptionError(primariesErr.message)
    } else {
      setPrimaries((primariesData as UserRow[]) ?? [])
    }

    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_primaries')
      .select('primary_id')
      .eq('master_id', masterId)

    if (adoptionsErr) {
      console.error('Error loading primary adoptions:', adoptionsErr)
      setPrimaryAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.primary_id))
      setAdoptedPrimaryIds(adoptedSet)
    }
  }

  async function loadSuperintendentsAndAdoptions(masterId: string) {
    const { data: superintendentsData, error: superintendentsErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'superintendent')
      .order('name')

    if (superintendentsErr) {
      console.error('Error loading superintendents:', superintendentsErr)
      setSuperintendentAdoptionError(superintendentsErr.message)
    } else {
      setSuperintendents((superintendentsData as UserRow[]) ?? [])
    }

    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_superintendents')
      .select('superintendent_id')
      .eq('master_id', masterId)

    if (adoptionsErr) {
      console.error('Error loading superintendent adoptions:', adoptionsErr)
      setSuperintendentAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.superintendent_id))
      setAdoptedSuperintendentIds(adoptedSet)
    }
  }

  // When dev has selected another master, we manage that master's adoptions; otherwise current user's
  const adoptionMasterId = (myRole === 'dev' && selectedMasterIdForAdoptions) ? selectedMasterIdForAdoptions : authUser?.id ?? null

  async function toggleAdoption(assistantId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUser?.id
    if (!masterId) return
    
    setAdoptionSaving(true)
    setAdoptionError(null)
    
    if (isAdopted) {
      // Unadopt: Delete the relationship
      const { error } = await supabase
        .from('master_assistants')
        .delete()
        .eq('master_id', masterId)
        .eq('assistant_id', assistantId)
      
      if (error) {
        setAdoptionError(error.message)
      } else {
        setAdoptedAssistantIds(prev => {
          const next = new Set(prev)
          next.delete(assistantId)
          return next
        })
      }
    } else {
      // Adopt: Insert the relationship
      const { error } = await supabase
        .from('master_assistants')
        .insert({
          master_id: masterId,
          assistant_id: assistantId,
        })
      
      if (error) {
        setAdoptionError(error.message)
      } else {
        setAdoptedAssistantIds(prev => new Set(prev).add(assistantId))
      }
    }
    
    setAdoptionSaving(false)
  }

  async function togglePrimaryAdoption(primaryId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUser?.id
    if (!masterId) return

    setPrimaryAdoptionSaving(true)
    setPrimaryAdoptionError(null)

    if (isAdopted) {
      const { error } = await supabase
        .from('master_primaries')
        .delete()
        .eq('master_id', masterId)
        .eq('primary_id', primaryId)

      if (error) {
        setPrimaryAdoptionError(error.message)
      } else {
        setAdoptedPrimaryIds(prev => {
          const next = new Set(prev)
          next.delete(primaryId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('master_primaries')
        .insert({
          master_id: masterId,
          primary_id: primaryId,
        })

      if (error) {
        setPrimaryAdoptionError(error.message)
      } else {
        setAdoptedPrimaryIds(prev => new Set(prev).add(primaryId))
      }
    }

    setPrimaryAdoptionSaving(false)
  }

  async function toggleSuperintendentAdoption(superintendentId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUser?.id
    if (!masterId) return

    setSuperintendentAdoptionSaving(true)
    setSuperintendentAdoptionError(null)

    if (isAdopted) {
      const { error } = await supabase
        .from('master_superintendents')
        .delete()
        .eq('master_id', masterId)
        .eq('superintendent_id', superintendentId)

      if (error) {
        setSuperintendentAdoptionError(error.message)
      } else {
        setAdoptedSuperintendentIds(prev => {
          const next = new Set(prev)
          next.delete(superintendentId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('master_superintendents')
        .insert({
          master_id: masterId,
          superintendent_id: superintendentId,
        })

      if (error) {
        setSuperintendentAdoptionError(error.message)
      } else {
        setAdoptedSuperintendentIds(prev => new Set(prev).add(superintendentId))
      }
    }

    setSuperintendentAdoptionSaving(false)
  }

  async function handleAdoptionMasterChange(masterId: string | null) {
    setSelectedMasterIdForAdoptions(masterId)
    if (authUser?.id) {
      const targetMasterId = masterId ?? authUser.id
      await loadAssistantsAndAdoptions(targetMasterId)
      await loadPrimariesAndAdoptions(targetMasterId)
      await loadSuperintendentsAndAdoptions(targetMasterId)
    }
  }

  async function loadMastersAndShares(sharingMasterId: string) {
    // Load all masters (excluding self)
    const { data: mastersData, error: mastersErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'master_technician')
      .neq('id', sharingMasterId)
      .order('name')
    
    if (mastersErr) {
      console.error('Error loading masters:', mastersErr)
      setSharingError(mastersErr.message)
    } else {
      setMasters((mastersData as UserRow[]) ?? [])
    }
    
    // Load current shares for this master
    const { data: shares, error: sharesErr } = await supabase
      .from('master_shares')
      .select('viewing_master_id')
      .eq('sharing_master_id', sharingMasterId)
    
    if (sharesErr) {
      console.error('Error loading shares:', sharesErr)
      setSharingError(sharesErr.message)
    } else {
      const sharedSet = new Set<string>()
      shares?.forEach(s => sharedSet.add(s.viewing_master_id))
      setSharedMasterIds(sharedSet)
    }
  }

  async function toggleSharing(viewingMasterId: string, isShared: boolean) {
    if (!authUser?.id) return
    
    setSharingSaving(true)
    setSharingError(null)
    
    if (isShared) {
      // Unshare: Delete the relationship
      const { error } = await supabase
        .from('master_shares')
        .delete()
        .eq('sharing_master_id', authUser.id)
        .eq('viewing_master_id', viewingMasterId)
      
      if (error) {
        setSharingError(error.message)
      } else {
        setSharedMasterIds(prev => {
          const next = new Set(prev)
          next.delete(viewingMasterId)
          return next
        })
      }
    } else {
      // Share: Insert the relationship
      const { error } = await supabase
        .from('master_shares')
        .insert({
          sharing_master_id: authUser.id,
          viewing_master_id: viewingMasterId,
        })
      
      if (error) {
        setSharingError(error.message)
      } else {
        setSharedMasterIds(prev => new Set(prev).add(viewingMasterId))
      }
    }
    
    setSharingSaving(false)
  }

  async function loadPayApprovedMasters() {
    const { data: approvedData, error: approvedErr } = await supabase
      .from('pay_approved_masters')
      .select('master_id')
    if (approvedErr) {
      setPayApprovedError(approvedErr.message)
      return
    }
    setPayApprovedMasterIds(new Set((approvedData ?? []).map((r: { master_id: string }) => r.master_id)))
    const { data: mastersData, error: mastersErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .in('role', ['master_technician', 'dev'])
      .order('name')
    if (mastersErr) {
      setPayApprovedError(mastersErr.message)
    } else {
      setPayApprovedMasters((mastersData as UserRow[]) ?? [])
    }
  }

  async function togglePayApproved(masterId: string, isApproved: boolean) {
    if (myRole !== 'dev') return
    setPayApprovedSaving(true)
    setPayApprovedError(null)
    if (isApproved) {
      const { error } = await supabase.from('pay_approved_masters').delete().eq('master_id', masterId)
      if (error) setPayApprovedError(error.message)
      else setPayApprovedMasterIds((prev) => { const n = new Set(prev); n.delete(masterId); return n })
    } else {
      const { error } = await supabase.from('pay_approved_masters').insert({ master_id: masterId })
      if (error) setPayApprovedError(error.message)
      else setPayApprovedMasterIds((prev) => new Set(prev).add(masterId))
    }
    setPayApprovedSaving(false)
  }

  async function loadNotificationTemplates() {
    const { data, error: e } = await supabase
      .from('notification_templates')
      .select('id, template_type, push_title, push_body, updated_at')
      .order('template_type')
    if (e) {
      console.error('Error loading notification templates:', e)
    } else {
      setNotificationTemplates((data as NotificationTemplate[]) ?? [])
    }
  }

  async function loadEmailTemplates() {
    const { data, error: eTemplates } = await supabase
      .from('email_templates')
      .select('id, template_type, subject, body, updated_at')
      .order('template_type')
    
    if (eTemplates) {
      console.error('Error loading email templates:', eTemplates)
      // Don't set error here - templates might not exist yet
    } else {
      setEmailTemplates((data as EmailTemplate[]) ?? [])
    }
  }

  function openEditNotificationTemplate(template: NotificationTemplate | null) {
    if (template) {
      setEditingNotificationTemplate(template)
      setNotificationTemplateTitle(template.push_title)
      setNotificationTemplateBody(template.push_body)
    } else {
      setEditingNotificationTemplate(null)
    }
    setNotificationTemplateError(null)
  }

  function closeEditNotificationTemplate() {
    setEditingNotificationTemplate(null)
    setNotificationTemplateTitle('')
    setNotificationTemplateBody('')
    setNotificationTemplateError(null)
  }

  async function saveNotificationTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingNotificationTemplate) return
    if (!notificationTemplateTitle.trim() || !notificationTemplateBody.trim()) {
      setNotificationTemplateError('Title and body are required')
      return
    }
    setNotificationTemplateSaving(true)
    setNotificationTemplateError(null)
    const { error: err } = await supabase
      .from('notification_templates')
      .update({
        push_title: notificationTemplateTitle.trim(),
        push_body: notificationTemplateBody.trim(),
      })
      .eq('id', editingNotificationTemplate.id)
    setNotificationTemplateSaving(false)
    if (err) setNotificationTemplateError(err.message)
    else {
      await loadNotificationTemplates()
      closeEditNotificationTemplate()
    }
  }

  async function sendTestNotificationTemplate(template: NotificationTemplate) {
    if (!templateTestTargetUserId) {
      setNotificationTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setNotificationTestError('Target user not found')
      return
    }
    setNotificationTestSending(template.template_type)
    setNotificationTestError(null)
    setNotificationTestSuccess(null)
    try {
      const {
        data: { session: refreshedSession },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshedSession?.access_token) {
        setNotificationTestError('Session expired. Please sign out and sign back in.')
        return
      }
      const { title, body } = substituteNotificationVariables(template, targetUser)
      const pushUrl =
        template.template_type === 'checklist_completed'
          ? '/checklist'
          : template.template_type === 'test_notification'
            ? '/settings'
            : '/workflow'
      const { data, error } = await supabase.functions.invoke('send-checklist-notification', {
        headers: {
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
        body: {
          recipient_user_id: templateTestTargetUserId,
          push_title: title,
          push_body: body,
          push_url: pushUrl,
          tag: template.template_type,
        },
      })
      if (error) throw error
      const res = data as { error?: string; push_sent?: number } | null
      if (res?.error) throw new Error(res.error)
      const sent = res?.push_sent ?? 0
      setNotificationTestSuccess(
        sent > 0
          ? `Sent to ${sent} device(s).`
          : 'Sent. (Target may have no push subscriptions, or on iOS with app open the system notification may not appear.)'
      )
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Failed to send test notification'
      if (err instanceof FunctionsHttpError && err.context?.json) {
        try {
          const body = (await err.context.json()) as { error?: string } | null
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
      }
      setNotificationTestError(msg)
    } finally {
      setNotificationTestSending(null)
    }
  }

  function openEditTemplate(template: EmailTemplate | undefined, templateType: EmailTemplate['template_type']) {
    if (template) {
      setEditingTemplate(template)
      setTemplateSubject(template.subject)
      setTemplateBody(template.body)
    } else {
      // Create new template with defaults
      const defaults: Record<EmailTemplate['template_type'], { subject: string; body: string }> = {
        invitation: {
          subject: 'Invitation to join PipeTooling',
          body: 'Hi {{name}},\n\nYou\'ve been invited to join PipeTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn\'t expect this invitation, you can safely ignore this email.',
        },
        sign_in: {
          subject: 'Sign in to PipeTooling',
          body: 'Hi {{name}},\n\nClick the link below to sign in to your PipeTooling account:\n\n{{link}}\n\nIf you didn\'t request this sign-in link, you can safely ignore this email.',
        },
        login_as: {
          subject: 'Sign in to PipeTooling',
          body: 'Hi {{name}},\n\nA dev has requested to sign in as you. Click the link below:\n\n{{link}}\n\nIf you didn\'t expect this, please contact your administrator.',
        },
        stage_assigned_started: {
          subject: 'Workflow stage started: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_assigned_complete: {
          subject: 'Workflow stage completed: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_assigned_reopened: {
          subject: 'Workflow stage re-opened: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_started: {
          subject: 'Workflow stage started: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_complete: {
          subject: 'Workflow stage completed: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_reopened: {
          subject: 'Workflow stage re-opened: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_next_complete_or_approved: {
          subject: 'Next workflow stage ready: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe previous workflow stage for project "{{project_name}}" has been completed or approved. Your stage "{{stage_name}}" is now ready to begin.\n\nProject: {{project_name}}\nYour stage: {{stage_name}}\nPrevious stage: {{previous_stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_prior_rejected: {
          subject: 'Prior work incomplete: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" that you completed has been marked as incomplete.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nReason: {{rejection_reason}}\n\nView the workflow: {{workflow_link}}',
        },
      }
      const defaultTemplate = defaults[templateType]
      setEditingTemplate({
        id: '', // Will be created
        template_type: templateType,
        subject: defaultTemplate.subject,
        body: defaultTemplate.body,
        updated_at: null,
      })
      setTemplateSubject(defaultTemplate.subject)
      setTemplateBody(defaultTemplate.body)
    }
    setTemplateError(null)
  }

  function replaceTemplateVariables(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let subject = template.subject
    let body = template.body
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      subject = subject.replace(regex, value)
      body = body.replace(regex, value)
    })
    
    return { subject, body }
  }

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!testingTemplate) return

    if (!templateTestTargetUserId) {
      setTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setTestError('Target user not found')
      return
    }
    const to = targetUser.email.trim()
    if (!to) {
      setTestError('Selected user has no email')
      return
    }

    setTestSending(true)
    setTestError(null)

    const {
      data: { session: refreshedSession },
      error: refreshErr,
    } = await supabase.auth.refreshSession()
    if (refreshErr || !refreshedSession?.access_token) {
      setTestError('Session expired. Please sign out and sign back in.')
      setTestSending(false)
      return
    }

    const testVariables: Record<string, string> = {
      name: (targetUser.name || '').trim() || to,
      email: targetUser.email,
      role: targetUser.role,
      link: 'https://example.com/test-link',
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'John Doe',
      workflow_link: 'https://example.com/workflow',
      previous_stage_name: 'Previous Stage',
      rejection_reason: 'Test rejection reason',
    }

    const { subject, body } = replaceTemplateVariables(testingTemplate, testVariables)

    const { data, error: eFn } = await supabase.functions.invoke('test-email', {
      headers: {
        Authorization: `Bearer ${refreshedSession.access_token}`,
      },
      body: {
        to,
        subject,
        body,
        template_type: testingTemplate.template_type,
      },
    })

    setTestSending(false)
    
    if (eFn) {
      let msg = eFn.message
      let statusCode = ''
      if (eFn instanceof FunctionsHttpError) {
        statusCode = ` (Status: ${eFn.context?.status || 'unknown'})`
        if (eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string; message?: string } | null
            if (b?.error) msg = b.error
            else if (b?.message) msg = b.message
          } catch { /* ignore */ }
        }
        // Try to get response text as well
        if (eFn.context?.response) {
          try {
            const text = await eFn.context.response.text()
            if (text) msg += ` - ${text}`
          } catch { /* ignore */ }
        }
      }
      setTestError(`Error: ${msg}${statusCode}`)
      return
    }
    
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setTestError(err)
    } else {
      const recipientLabel = (targetUser.name || '').trim()
        ? `${targetUser.name} <${to}>`
        : to
      alert(`Test email sent to ${recipientLabel}!\n\nSubject: ${subject}\n\nBody:\n${body}`)
      setTestingTemplate(null)
    }
  }

  async function sendWorkflowNotificationEmailTest() {
    if (!templateTestTargetUserId) {
      setWorkflowFnTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setWorkflowFnTestError('Target user not found')
      return
    }
    const to = targetUser.email.trim()
    if (!to) {
      setWorkflowFnTestError('Selected user has no email')
      return
    }
    const hasTemplate = emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType)
    if (!hasTemplate) {
      setWorkflowFnTestError('Create this email template in the list below before testing the Edge Function')
      return
    }

    setWorkflowFnTestSending(true)
    setWorkflowFnTestError(null)
    setWorkflowFnTestSuccess(null)

    const {
      data: { session: refreshedSession },
      error: refreshErr,
    } = await supabase.auth.refreshSession()
    if (refreshErr || !refreshedSession?.access_token) {
      setWorkflowFnTestError('Session expired. Please sign out and sign back in.')
      setWorkflowFnTestSending(false)
      return
    }

    const recipientName = (targetUser.name || '').trim() || to
    const workflowLink = `${window.location.origin}/settings`
    const variables: Record<string, string> = {
      name: recipientName,
      email: targetUser.email,
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'Jane Doe',
      workflow_link: workflowLink,
    }
    if (workflowFnTestTemplateType === 'stage_next_complete_or_approved') {
      variables.previous_stage_name = 'Previous Stage (test)'
    }
    if (workflowFnTestTemplateType === 'stage_prior_rejected') {
      variables.previous_stage_name = 'Previous Stage (test)'
      variables.rejection_reason = 'Test rejection'
    }

    const { data, error: eFn } = await supabase.functions.invoke('send-workflow-notification', {
      headers: {
        Authorization: `Bearer ${refreshedSession.access_token}`,
      },
      body: {
        template_type: workflowFnTestTemplateType,
        step_id: WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID,
        recipient_email: to,
        recipient_name: recipientName,
        variables,
      },
    })

    setWorkflowFnTestSending(false)

    if (eFn) {
      let msg = eFn.message
      let statusCode = ''
      if (eFn instanceof FunctionsHttpError) {
        statusCode = ` (Status: ${eFn.context?.status || 'unknown'})`
        if (eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string; message?: string } | null
            if (b?.error) msg = b.error
            else if (b?.message) msg = b.message
          } catch {
            /* ignore */
          }
        }
        if (eFn.context?.response) {
          try {
            const text = await eFn.context.response.text()
            if (text) msg += ` - ${text}`
          } catch {
            /* ignore */
          }
        }
      }
      setWorkflowFnTestError(`Error: ${msg}${statusCode}`)
      return
    }

    const res = data as { error?: string; email_id?: string; push_sent?: number } | null
    if (res?.error) {
      setWorkflowFnTestError(res.error)
      return
    }
    const pushPart =
      typeof res?.push_sent === 'number' && res.push_sent > 0 ? ` Push sent: ${res.push_sent}.` : ''
    setWorkflowFnTestSuccess(
      `Sent via send-workflow-notification to ${to}. Resend id: ${res?.email_id ?? '—'}.${pushPart}`
    )
  }

  function openTestEmail(template: EmailTemplate | { template_type: EmailTemplate['template_type']; subject: string; body: string }) {
    setTestingTemplate(template as EmailTemplate)
    setTestError(null)
  }

  function testCurrentTemplate() {
    if (!editingTemplate || !templateSubject.trim() || !templateBody.trim()) {
      setTemplateError('Please fill in both subject and body before testing')
      return
    }
    if (!templateTestTargetUserId) {
      setTemplateError('Select a test target under Templates & testing before testing')
      return
    }
    // Create a temporary template object from current form values
    const tempTemplate: EmailTemplate = {
      id: editingTemplate.id || '',
      template_type: editingTemplate.template_type,
      subject: templateSubject.trim(),
      body: templateBody.trim(),
      updated_at: null,
    }
    openTestEmail(tempTemplate)
  }

  function closeTestEmail() {
    setTestingTemplate(null)
    setTestError(null)
  }

  function closeEditTemplate() {
    setEditingTemplate(null)
    setTemplateSubject('')
    setTemplateBody('')
    setTemplateError(null)
  }

  async function saveEmailTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTemplate) return
    
    setTemplateSaving(true)
    setTemplateError(null)
    
    if (editingTemplate.id) {
      // Update existing template
      const { error: e } = await supabase
        .from('email_templates')
        .update({
          subject: templateSubject.trim(),
          body: templateBody.trim(),
        })
        .eq('id', editingTemplate.id)
      
      setTemplateSaving(false)
      
      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    } else {
      // Create new template
      const { error: e } = await supabase
        .from('email_templates')
        .insert({
          template_type: editingTemplate.template_type,
          subject: templateSubject.trim(),
          body: templateBody.trim(),
          updated_at: new Date().toISOString(),
        })
      
      setTemplateSaving(false)
      
      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    }
  }

  // Service Types functions
  async function loadServiceTypes() {
    const { data, error: eServiceTypes } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (eServiceTypes) {
      console.error('Error loading service types:', eServiceTypes)
    } else {
      setServiceTypes((data as unknown as ServiceType[]) ?? [])
    }
  }

  function openEditServiceType(serviceType: ServiceType | null) {
    setEditingServiceType(serviceType)
    setServiceTypeName(serviceType?.name || '')
    setServiceTypeDescription(serviceType?.description || '')
    setServiceTypeColor(serviceType?.color || '')
    setServiceTypeLedgerJobPrefix((serviceType?.ledger_job_prefix ?? '').trim())
    setServiceTypeLedgerBidPrefix((serviceType?.ledger_bid_prefix ?? '').trim())
    setServiceTypeError(null)
    setServiceTypeFormOpen(true)
  }

  function closeEditServiceType() {
    setEditingServiceType(null)
    setServiceTypeName('')
    setServiceTypeDescription('')
    setServiceTypeColor('')
    setServiceTypeLedgerJobPrefix('')
    setServiceTypeLedgerBidPrefix('')
    setServiceTypeError(null)
    setServiceTypeFormOpen(false)
  }

  async function saveServiceType(e: React.FormEvent) {
    e.preventDefault()
    
    setServiceTypeSaving(true)
    setServiceTypeError(null)
    
    if (!serviceTypeName.trim()) {
      setServiceTypeError('Name is required')
      setServiceTypeSaving(false)
      return
    }

    const jobPx = serviceTypeLedgerJobPrefix.trim()
    const bidPx = serviceTypeLedgerBidPrefix.trim()
    const MAX_PREFIX = 4
    if (jobPx.length > MAX_PREFIX || bidPx.length > MAX_PREFIX) {
      setServiceTypeError(`Ledger prefixes must be at most ${MAX_PREFIX} characters`)
      setServiceTypeSaving(false)
      return
    }
    const normPx = (s: string) => s.trim().toLowerCase()
    const others = serviceTypes.filter((st) => !editingServiceType || st.id !== editingServiceType.id)
    if (jobPx && others.some((st) => normPx(st.ledger_job_prefix ?? '') === normPx(jobPx))) {
      setServiceTypeError('Another service type already uses this job ledger prefix')
      setServiceTypeSaving(false)
      return
    }
    if (bidPx && others.some((st) => normPx(st.ledger_bid_prefix ?? '') === normPx(bidPx))) {
      setServiceTypeError('Another service type already uses this bid ledger prefix')
      setServiceTypeSaving(false)
      return
    }
    if (editingServiceType) {
      // Update existing service type
      const { error: e } = await supabase
        .from('service_types' as any)
        .update({
          name: serviceTypeName.trim(),
          description: serviceTypeDescription.trim() || null,
          color: serviceTypeColor.trim() || null,
          ledger_job_prefix: jobPx || null,
          ledger_bid_prefix: bidPx || null,
        } as any)
        .eq('id', editingServiceType.id)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
        void reloadLedgerPrefixMap()
        closeEditServiceType()
      }
    } else {
      // Create new service type
      const maxSeq = serviceTypes.reduce((max, st) => Math.max(max, st.sequence_order), 0)
      const { error: e } = await supabase
        .from('service_types' as any)
        .insert({
          name: serviceTypeName.trim(),
          description: serviceTypeDescription.trim() || null,
          color: serviceTypeColor.trim() || null,
          ledger_job_prefix: jobPx || null,
          ledger_bid_prefix: bidPx || null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
        void reloadLedgerPrefixMap()
        closeEditServiceType()
      }
    }
  }

  async function deleteServiceType(serviceType: ServiceType) {
    if (!confirm(`Are you sure you want to delete "${serviceType.name}"? This will fail if any items are assigned to this service type.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('service_types' as any)
      .delete()
      .eq('id', serviceType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete service type "${serviceType.name}" because it has associated items. Please reassign or delete those items first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadServiceTypes()
    }
  }

  async function moveServiceType(serviceType: ServiceType, direction: 'up' | 'down') {
    const currentIndex = serviceTypes.findIndex(st => st.id === serviceType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= serviceTypes.length) return
    
    const targetServiceType = serviceTypes[targetIndex]
    if (!targetServiceType) return
    
    // Swap sequence orders
    await supabase
      .from('service_types' as any)
      .update({ sequence_order: targetServiceType.sequence_order } as any)
      .eq('id', serviceType.id)
    
    await supabase
      .from('service_types' as any)
      .update({ sequence_order: serviceType.sequence_order } as any)
      .eq('id', targetServiceType.id)
    
    await loadServiceTypes()
  }

  // Fixture Types functions
  async function loadFixtureTypes() {
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypes([])
      return
    }
    
    const { data, error: eFixtureTypes } = await supabase
      .from('fixture_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForFixtures)
      .order('name', { ascending: true })
    
    if (eFixtureTypes) {
      console.error('Error loading fixture types:', eFixtureTypes)
    } else {
      setFixtureTypes((data as unknown as FixtureType[]) ?? [])
    }
  }

  async function loadFixtureTypeCounts() {
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypePriceBookCounts({})
      setFixtureTypeLaborBookCounts({})
      setFixtureTypeTakeoffBookCounts({})
      return
    }
    
    const fixtureTypeIds = fixtureTypes.map(ft => ft.id)
    
    if (fixtureTypeIds.length === 0) {
      setFixtureTypePriceBookCounts({})
      setFixtureTypeLaborBookCounts({})
      setFixtureTypeTakeoffBookCounts({})
      return
    }
    
    // Query price book, labor book, and takeoff book in parallel
    const [priceBookResult, laborBookResult, takeoffVersionsResult] = await Promise.all([
      supabase
        .from('price_book_entries')
        .select('fixture_type_id')
        .in('fixture_type_id', fixtureTypeIds),
      supabase
        .from('labor_book_entries')
        .select('fixture_type_id')
        .in('fixture_type_id', fixtureTypeIds),
      supabase
        .from('takeoff_book_versions')
        .select('id')
        .eq('service_type_id', selectedServiceTypeForFixtures)
    ])
    
    // Count price book entries
    const priceBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => priceBookCounts[id] = 0)
    priceBookResult.data?.forEach(row => {
      if (row.fixture_type_id) {
        priceBookCounts[row.fixture_type_id] = (priceBookCounts[row.fixture_type_id] || 0) + 1
      }
    })
    setFixtureTypePriceBookCounts(priceBookCounts)
    
    // Count labor book entries
    const laborBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => laborBookCounts[id] = 0)
    laborBookResult.data?.forEach(row => {
      if (row.fixture_type_id) {
        laborBookCounts[row.fixture_type_id] = (laborBookCounts[row.fixture_type_id] || 0) + 1
      }
    })
    setFixtureTypeLaborBookCounts(laborBookCounts)
    
    // Count takeoff book entries (matched by fixture_name or alias_names)
    const takeoffBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => takeoffBookCounts[id] = 0)
    const versionIds = (takeoffVersionsResult.data ?? []).map(v => v.id)
    if (versionIds.length > 0) {
      const takeoffEntriesResult = await supabase
        .from('takeoff_book_entries')
        .select('fixture_name, alias_names')
        .in('version_id', versionIds)
      takeoffEntriesResult.data?.forEach(row => {
        const fixtureName = (row.fixture_name ?? '').toLowerCase()
        const aliasNames = (row.alias_names ?? []).map((a: string) => a.toLowerCase())
        const matchingFixtureType = fixtureTypes.find(ft => {
          const ftName = ft.name.toLowerCase()
          return fixtureName === ftName || aliasNames.includes(ftName)
        })
        if (matchingFixtureType) {
          takeoffBookCounts[matchingFixtureType.id] = (takeoffBookCounts[matchingFixtureType.id] || 0) + 1
        }
      })
      if (takeoffEntriesResult.error) console.error('Error loading takeoff book counts:', takeoffEntriesResult.error)
    }
    setFixtureTypeTakeoffBookCounts(takeoffBookCounts)
    
    // Log any errors
    if (priceBookResult.error) console.error('Error loading price book counts:', priceBookResult.error)
    if (laborBookResult.error) console.error('Error loading labor book counts:', laborBookResult.error)
    if (takeoffVersionsResult.error) console.error('Error loading takeoff book versions:', takeoffVersionsResult.error)
  }

  function openEditFixtureType(fixtureType: FixtureType | null) {
    setEditingFixtureType(fixtureType)
    setFixtureTypeName(fixtureType?.name || '')
    setFixtureTypeError(null)
    setFixtureTypeFormOpen(true)
  }

  function closeEditFixtureType() {
    setEditingFixtureType(null)
    setFixtureTypeName('')
    setFixtureTypeError(null)
    setFixtureTypeFormOpen(false)
  }

  async function saveFixtureType(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypeError('Please select a service type first')
      return
    }
    
    setFixtureTypeSaving(true)
    setFixtureTypeError(null)
    
    if (!fixtureTypeName.trim()) {
      setFixtureTypeError('Name is required')
      setFixtureTypeSaving(false)
      return
    }
    
    if (editingFixtureType) {
      // Update existing fixture type
      const { error: e } = await supabase
        .from('fixture_types' as any)
        .update({
          name: fixtureTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingFixtureType.id)
      
      setFixtureTypeSaving(false)
      
      if (e) {
        setFixtureTypeError(e.message)
      } else {
        await loadFixtureTypes()
        closeEditFixtureType()
      }
    } else {
      // Create new fixture type
      const maxSeq = fixtureTypes.reduce((max, ft) => Math.max(max, ft.sequence_order), 0)
      const { error: e } = await supabase
        .from('fixture_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForFixtures,
          name: fixtureTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setFixtureTypeSaving(false)
      
      if (e) {
        setFixtureTypeError(e.message)
      } else {
        await loadFixtureTypes()
        closeEditFixtureType()
      }
    }
  }

  async function removeUnusedFixtureTypes() {
    const unused = fixtureTypes.filter(ft => {
      const takeoff = fixtureTypeTakeoffBookCounts[ft.id] ?? 0
      const labor = fixtureTypeLaborBookCounts[ft.id] ?? 0
      const price = fixtureTypePriceBookCounts[ft.id] ?? 0
      return takeoff === 0 && labor === 0 && price === 0
    })
    if (unused.length === 0) {
      setError('No unused book names found. All have at least one takeoff, labor, or price entry.')
      return
    }
    if (!confirm(`Remove ${unused.length} book name${unused.length === 1 ? '' : 's'} with 0 takeoff, 0 labor, 0 price?\n\n${unused.map(ft => ft.name).join(', ')}`)) return
    setRemovingUnusedFixtureTypes(true)
    setError(null)
    for (const ft of unused) {
      const { error: e } = await supabase.from('fixture_types' as any).delete().eq('id', ft.id)
      if (e) {
        setError(`Failed to delete "${ft.name}": ${e.message}`)
        break
      }
    }
    setRemovingUnusedFixtureTypes(false)
    await loadFixtureTypes()
    // Counts will reload via useEffect when fixtureTypes updates
  }

  async function deleteFixtureType(fixtureType: FixtureType) {
    if (!confirm(`Are you sure you want to delete "${fixtureType.name}"? This will fail if any items are assigned to this book name.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('fixture_types' as any)
      .delete()
      .eq('id', fixtureType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete book name "${fixtureType.name}" because it has associated items. Please reassign or delete those items first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadFixtureTypes()
    }
  }

  // Counts Fixtures functions
  async function loadCountsFixtureGroups() {
    if (!selectedServiceTypeForCountsFixtures) {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
      return
    }
    const { data: groupsData, error: eGroups } = await supabase
      .from('counts_fixture_groups')
      .select('id, service_type_id, label, sequence_order')
      .eq('service_type_id', selectedServiceTypeForCountsFixtures)
      .order('sequence_order', { ascending: true })
    if (eGroups) {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
      return
    }
    const groups = (groupsData as CountsFixtureGroup[]) ?? []
    setCountsFixtureGroups(groups)
    if (groups.length === 0) {
      setCountsFixtureGroupItems([])
      return
    }
    const groupIds = groups.map((g) => g.id)
    const { data: itemsData, error: eItems } = await supabase
      .from('counts_fixture_group_items')
      .select('id, group_id, name, sequence_order')
      .in('group_id', groupIds)
      .order('sequence_order', { ascending: true })
    if (eItems) {
      setCountsFixtureGroupItems([])
      return
    }
    setCountsFixtureGroupItems((itemsData as CountsFixtureGroupItem[]) ?? [])
  }

  useEffect(() => {
    if (selectedServiceTypeForCountsFixtures) {
      void loadCountsFixtureGroups()
    } else {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
    }
  }, [selectedServiceTypeForCountsFixtures])

  function openEditCountsFixtureGroup(group: CountsFixtureGroup | null) {
    setEditingCountsFixtureGroup(group)
    setCountsFixtureGroupLabel(group?.label ?? '')
    setCountsFixtureGroupError(null)
    setCountsFixtureGroupFormOpen(true)
  }

  function closeEditCountsFixtureGroup() {
    setEditingCountsFixtureGroup(null)
    setCountsFixtureGroupLabel('')
    setCountsFixtureGroupError(null)
    setCountsFixtureGroupFormOpen(false)
  }

  async function saveCountsFixtureGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedServiceTypeForCountsFixtures) return
    setCountsFixtureGroupSaving(true)
    setCountsFixtureGroupError(null)
    if (!countsFixtureGroupLabel.trim()) {
      setCountsFixtureGroupError('Label is required')
      setCountsFixtureGroupSaving(false)
      return
    }
    if (editingCountsFixtureGroup) {
      const { error: err } = await supabase
        .from('counts_fixture_groups')
        .update({ label: countsFixtureGroupLabel.trim() })
        .eq('id', editingCountsFixtureGroup.id)
      setCountsFixtureGroupSaving(false)
      if (err) setCountsFixtureGroupError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureGroup() }
    } else {
      const maxSeq = countsFixtureGroups.reduce((max, g) => Math.max(max, g.sequence_order), 0)
      const { error: err } = await supabase
        .from('counts_fixture_groups')
        .insert({ service_type_id: selectedServiceTypeForCountsFixtures, label: countsFixtureGroupLabel.trim(), sequence_order: maxSeq + 1 })
      setCountsFixtureGroupSaving(false)
      if (err) setCountsFixtureGroupError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureGroup() }
    }
  }

  async function deleteCountsFixtureGroup(group: CountsFixtureGroup) {
    if (!confirm(`Delete group "${group.label}" and all its fixtures?`)) return
    const { error: err } = await supabase.from('counts_fixture_groups').delete().eq('id', group.id)
    if (err) setError(err.message)
    else await loadCountsFixtureGroups()
  }

  async function moveCountsFixtureGroup(group: CountsFixtureGroup, direction: 'up' | 'down') {
    const idx = countsFixtureGroups.findIndex((g) => g.id === group.id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= countsFixtureGroups.length) return
    const target = countsFixtureGroups[targetIdx]
    if (!target) return
    await supabase.from('counts_fixture_groups').update({ sequence_order: target.sequence_order }).eq('id', group.id)
    await supabase.from('counts_fixture_groups').update({ sequence_order: group.sequence_order }).eq('id', target.id)
    await loadCountsFixtureGroups()
  }

  function openEditCountsFixtureItem(grp: CountsFixtureGroup, item: CountsFixtureGroupItem | null) {
    setEditingCountsFixtureGroupForItem(grp)
    setEditingCountsFixtureItem(item)
    setCountsFixtureItemName(item?.name ?? '')
    setCountsFixtureItemError(null)
    setCountsFixtureItemFormOpen(true)
  }

  function closeEditCountsFixtureItem() {
    setEditingCountsFixtureGroupForItem(null)
    setEditingCountsFixtureItem(null)
    setCountsFixtureItemName('')
    setCountsFixtureItemError(null)
    setCountsFixtureItemFormOpen(false)
  }

  async function saveCountsFixtureItem(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCountsFixtureGroupForItem) return
    setCountsFixtureItemSaving(true)
    setCountsFixtureItemError(null)
    if (!countsFixtureItemName.trim()) {
      setCountsFixtureItemError('Name is required')
      setCountsFixtureItemSaving(false)
      return
    }
    if (editingCountsFixtureItem) {
      const { error: err } = await supabase
        .from('counts_fixture_group_items')
        .update({ name: countsFixtureItemName.trim() })
        .eq('id', editingCountsFixtureItem.id)
      setCountsFixtureItemSaving(false)
      if (err) setCountsFixtureItemError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureItem() }
    } else {
      const groupItems = countsFixtureGroupItems.filter((i) => i.group_id === editingCountsFixtureGroupForItem.id)
      const maxSeq = groupItems.reduce((max, i) => Math.max(max, i.sequence_order), 0)
      const { error: err } = await supabase
        .from('counts_fixture_group_items')
        .insert({ group_id: editingCountsFixtureGroupForItem.id, name: countsFixtureItemName.trim(), sequence_order: maxSeq + 1 })
      setCountsFixtureItemSaving(false)
      if (err) setCountsFixtureItemError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureItem() }
    }
  }

  async function deleteCountsFixtureItem(item: CountsFixtureGroupItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    const { error: err } = await supabase.from('counts_fixture_group_items').delete().eq('id', item.id)
    if (err) setError(err.message)
    else await loadCountsFixtureGroups()
  }

  async function moveCountsFixtureItem(item: CountsFixtureGroupItem, direction: 'up' | 'down') {
    const groupItems = countsFixtureGroupItems.filter((i) => i.group_id === item.group_id).sort((a, b) => a.sequence_order - b.sequence_order)
    const idx = groupItems.findIndex((i) => i.id === item.id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= groupItems.length) return
    const target = groupItems[targetIdx]
    if (!target) return
    await supabase.from('counts_fixture_group_items').update({ sequence_order: target.sequence_order }).eq('id', item.id)
    await supabase.from('counts_fixture_group_items').update({ sequence_order: item.sequence_order }).eq('id', target.id)
    await loadCountsFixtureGroups()
  }

  // Part Types functions (for Materials)
  async function loadPartTypes() {
    if (!selectedServiceTypeForParts) {
      setPartTypes([])
      return
    }
    
    const { data, error: ePartTypes } = await supabase
      .from('part_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForParts)
      .order('sequence_order', { ascending: true })
    
    if (ePartTypes) {
      console.error('Error loading part types:', ePartTypes)
    } else {
      setPartTypes((data as unknown as PartType[]) ?? [])
    }
  }

  async function loadPartTypePartCounts() {
    if (!selectedServiceTypeForParts) {
      setPartTypePartCounts({})
      return
    }
    
    // Get all part types for this service type
    const partTypeIds = partTypes.map(pt => pt.id)
    
    if (partTypeIds.length === 0) {
      setPartTypePartCounts({})
      return
    }
    
    // Query material_parts grouped by part_type_id
    const { data, error } = await supabase
      .from('material_parts')
      .select('part_type_id')
      .in('part_type_id', partTypeIds)
    
    if (error) {
      console.error('Error loading part counts:', error)
      return
    }
    
    // Count parts per part type
    const counts: Record<string, number> = {}
    partTypeIds.forEach(id => counts[id] = 0)
    
    data?.forEach(row => {
      if (row.part_type_id) {
        counts[row.part_type_id] = (counts[row.part_type_id] || 0) + 1
      }
    })
    
    setPartTypePartCounts(counts)
  }

  function openEditPartType(partType: PartType | null) {
    setEditingPartType(partType)
    setPartTypeName(partType?.name || '')
    setPartTypeError(null)
    setPartTypeFormOpen(true)
  }

  function closeEditPartType() {
    setEditingPartType(null)
    setPartTypeName('')
    setPartTypeError(null)
    setPartTypeFormOpen(false)
  }

  async function savePartType(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForParts) {
      setPartTypeError('Please select a service type first')
      return
    }
    
    setPartTypeSaving(true)
    setPartTypeError(null)
    
    if (!partTypeName.trim()) {
      setPartTypeError('Name is required')
      setPartTypeSaving(false)
      return
    }
    
    if (editingPartType) {
      // Update existing part type
      const { error: e } = await supabase
        .from('part_types' as any)
        .update({
          name: partTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingPartType.id)
      
      setPartTypeSaving(false)
      
      if (e) {
        setPartTypeError(e.message)
      } else {
        await loadPartTypes()
        closeEditPartType()
      }
    } else {
      // Create new part type
      const maxSeq = partTypes.reduce((max, pt) => Math.max(max, pt.sequence_order), 0)
      const { error: e } = await supabase
        .from('part_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForParts,
          name: partTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setPartTypeSaving(false)
      
      if (e) {
        setPartTypeError(e.message)
      } else {
        await loadPartTypes()
        closeEditPartType()
      }
    }
  }

  async function deletePartType(partType: PartType) {
    if (!confirm(`Are you sure you want to delete "${partType.name}"? This will fail if any parts are assigned to this material part type.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('part_types' as any)
      .delete()
      .eq('id', partType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete material part type "${partType.name}" because it has associated parts. Please reassign or delete those parts first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadPartTypes()
    }
  }

  async function removeAllUnusedPartTypes() {
    // Filter part types with 0 parts
    const unusedPartTypes = partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0)
    
    if (unusedPartTypes.length === 0) {
      setError('No unused material part types to remove')
      return
    }
    
    // Confirm with user
    const partTypeNames = unusedPartTypes.map(pt => pt.name).join(', ')
    const confirmed = confirm(
      `This will delete ${unusedPartTypes.length} unused material part type(s):\n\n${partTypeNames}\n\nAre you sure?`
    )
    
    if (!confirmed) return
    
    setRemovingUnusedPartTypes(true)
    setError(null)
    
    // Delete each unused part type
    const deletePromises = unusedPartTypes.map(pt =>
      supabase
        .from('part_types' as any)
        .delete()
        .eq('id', pt.id)
    )
    
    const results = await Promise.all(deletePromises)
    const errors = results.filter(r => r.error)
    
    setRemovingUnusedPartTypes(false)
    
    if (errors.length > 0) {
      setError(`Failed to delete ${errors.length} material part type(s). They may have parts assigned.`)
    } else {
      // Success - reload the list
      await loadPartTypes()
    }
  }

  async function movePartType(partType: PartType, direction: 'up' | 'down') {
    const currentIndex = partTypes.findIndex(pt => pt.id === partType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= partTypes.length) return
    
    const targetPartType = partTypes[targetIndex]
    if (!targetPartType) return
    
    // Swap sequence orders
    await supabase
      .from('part_types' as any)
      .update({ sequence_order: targetPartType.sequence_order } as any)
      .eq('id', partType.id)
    
    await supabase
      .from('part_types' as any)
      .update({ sequence_order: partType.sequence_order } as any)
      .eq('id', targetPartType.id)
    
    await loadPartTypes()
  }

  // Assembly Types functions (for Materials)
  async function loadAssemblyTypes() {
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypes([])
      return
    }
    
    const { data, error: eAssemblyTypes } = await supabase
      .from('assembly_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForAssemblies)
      .order('sequence_order', { ascending: true })
    
    if (eAssemblyTypes) {
      console.error('Error loading assembly types:', eAssemblyTypes)
    } else {
      setAssemblyTypes((data as unknown as AssemblyType[]) ?? [])
    }
  }

  async function loadAssemblyTypeAssemblyCounts() {
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypeAssemblyCounts({})
      return
    }
    
    // Get all assembly types for this service type
    const assemblyTypeIds = assemblyTypes.map(at => at.id)
    
    if (assemblyTypeIds.length === 0) {
      setAssemblyTypeAssemblyCounts({})
      return
    }
    
    // Query material_templates grouped by assembly_type_id
    const { data, error } = await supabase
      .from('material_templates')
      .select('assembly_type_id')
      .in('assembly_type_id', assemblyTypeIds)
    
    if (error) {
      console.error('Error loading assembly counts:', error)
      return
    }
    
    // Count assemblies per assembly type
    const counts: Record<string, number> = {}
    assemblyTypeIds.forEach(id => counts[id] = 0)
    
    data?.forEach(row => {
      if (row.assembly_type_id) {
        counts[row.assembly_type_id] = (counts[row.assembly_type_id] || 0) + 1
      }
    })
    
    setAssemblyTypeAssemblyCounts(counts)
  }

  function openEditAssemblyType(assemblyType: AssemblyType | null) {
    setEditingAssemblyType(assemblyType)
    setAssemblyTypeName(assemblyType?.name || '')
    setAssemblyTypeError(null)
    setAssemblyTypeFormOpen(true)
  }

  function closeEditAssemblyType() {
    setEditingAssemblyType(null)
    setAssemblyTypeName('')
    setAssemblyTypeError(null)
    setAssemblyTypeFormOpen(false)
  }

  async function saveAssemblyType(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypeError('Please select a service type first')
      return
    }
    
    setAssemblyTypeSaving(true)
    setAssemblyTypeError(null)
    
    if (!assemblyTypeName.trim()) {
      setAssemblyTypeError('Name is required')
      setAssemblyTypeSaving(false)
      return
    }
    
    if (editingAssemblyType) {
      // Update existing assembly type
      const { error: e } = await supabase
        .from('assembly_types' as any)
        .update({
          name: assemblyTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingAssemblyType.id)
      
      setAssemblyTypeSaving(false)
      
      if (e) {
        setAssemblyTypeError(e.message)
      } else {
        await loadAssemblyTypes()
        closeEditAssemblyType()
      }
    } else {
      // Create new assembly type
      const maxSeq = assemblyTypes.reduce((max, at) => Math.max(max, at.sequence_order), 0)
      const { error: e } = await supabase
        .from('assembly_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForAssemblies,
          name: assemblyTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setAssemblyTypeSaving(false)
      
      if (e) {
        setAssemblyTypeError(e.message)
      } else {
        await loadAssemblyTypes()
        closeEditAssemblyType()
      }
    }
  }

  async function deleteAssemblyType(assemblyType: AssemblyType) {
    if (!confirm(`Are you sure you want to delete "${assemblyType.name}"? This will remove the type from any assemblies using it.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('assembly_types' as any)
      .delete()
      .eq('id', assemblyType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete assembly type "${assemblyType.name}" due to database constraints.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadAssemblyTypes()
    }
  }

  async function removeAllUnusedAssemblyTypes() {
    // Filter assembly types with 0 assemblies
    const unusedAssemblyTypes = assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0)
    
    if (unusedAssemblyTypes.length === 0) {
      setError('No unused assembly types to remove')
      return
    }
    
    // Confirm with user
    const assemblyTypeNames = unusedAssemblyTypes.map(at => at.name).join(', ')
    const confirmed = confirm(
      `This will delete ${unusedAssemblyTypes.length} unused assembly type(s):\n\n${assemblyTypeNames}\n\nAre you sure?`
    )
    
    if (!confirmed) return
    
    setRemovingUnusedAssemblyTypes(true)
    setError(null)
    
    // Delete each unused assembly type
    const deletePromises = unusedAssemblyTypes.map(at =>
      supabase
        .from('assembly_types' as any)
        .delete()
        .eq('id', at.id)
    )
    
    const results = await Promise.all(deletePromises)
    const errors = results.filter(r => r.error)
    
    setRemovingUnusedAssemblyTypes(false)
    
    if (errors.length > 0) {
      setError(`Failed to delete ${errors.length} assembly type(s). They may have assemblies assigned.`)
    } else {
      await loadAssemblyTypes()
    }
  }

  async function moveAssemblyType(assemblyType: AssemblyType, direction: 'up' | 'down') {
    const currentIndex = assemblyTypes.findIndex(at => at.id === assemblyType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= assemblyTypes.length) return
    
    const targetAssemblyType = assemblyTypes[targetIndex]
    if (!targetAssemblyType) return
    
    // Swap sequence orders
    await supabase
      .from('assembly_types' as any)
      .update({ sequence_order: targetAssemblyType.sequence_order } as any)
      .eq('id', assemblyType.id)
    
    await supabase
      .from('assembly_types' as any)
      .update({ sequence_order: assemblyType.sequence_order } as any)
      .eq('id', targetAssemblyType.id)
    
    await loadAssemblyTypes()
  }

  useEffect(() => {
    loadData()
  }, [authUser?.id])

  useEffect(() => {
    if (!dailyGoalsTargetUserId) {
      setDailyGoalsRows([])
      return
    }
    let cancelled = false
    setDailyGoalsLoading(true)
    void supabase
      .from('user_dashboard_goals')
      .select('id, body, sort_order')
      .eq('user_id', dailyGoalsTargetUserId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setDailyGoalsLoading(false)
        if (error) {
          setError(error.message)
          setDailyGoalsRows([])
          return
        }
        setDailyGoalsRows((data ?? []) as Array<{ id: string; body: string; sort_order: number }>)
      })
    return () => {
      cancelled = true
    }
  }, [dailyGoalsTargetUserId])

  useEffect(() => {
    if (!('permissions' in navigator)) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        setLocationPermission(status.state as 'granted' | 'denied' | 'prompt')
        status.onchange = () => setLocationPermission(status.state as 'granted' | 'denied' | 'prompt')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    supabase
      .from('notification_history')
      .select('id')
      .eq('recipient_user_id', authUser.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        setHasNotificationHistory(error ? false : !!data)
      })
  }, [authUser?.id])

  useEffect(() => {
    if (!notificationHistoryOpen || !authUser?.id) return
    setNotificationHistoryError(null)
    setNotificationHistoryLoading(true)
    supabase
      .from('notification_history')
      .select('*')
      .eq('recipient_user_id', authUser.id)
      .order('sent_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        setNotificationHistoryLoading(false)
        if (error) {
          setNotificationHistoryError(error.message)
          return
        }
        setNotificationHistory((data ?? []) as NotificationHistoryRow[])
      })
  }, [notificationHistoryOpen, authUser?.id])

  async function loadMutedTasks() {
    if (!authUser?.id) return
    const { data: prefs, error } = await supabase
      .from('user_checklist_item_mute_preferences')
      .select('checklist_item_id, muted_until')
      .eq('user_id', authUser.id)
      .gt('muted_until', new Date().toISOString())
    if (error) return
    const itemIds = (prefs ?? []).map((p) => p.checklist_item_id)
    if (itemIds.length === 0) {
      setMutedTasks([])
      return
    }
    const { data: items } = await supabase
      .from('checklist_items')
      .select('id, title')
      .in('id', itemIds)
    const titleMap = new Map((items ?? []).map((i) => [i.id, i.title ?? 'Untitled']))
    const list = (prefs ?? []).map((p) => ({
      checklist_item_id: p.checklist_item_id,
      task_title: titleMap.get(p.checklist_item_id) ?? 'Untitled',
      muted_until: p.muted_until,
    }))
    setMutedTasks(list)
  }

  useEffect(() => {
    if (!mutedTasksOpen || !authUser?.id) return
    setMutedTasksLoading(true)
    loadMutedTasks().finally(() => setMutedTasksLoading(false))
  }, [mutedTasksOpen, authUser?.id])

  async function loadIgnoredTaskTypes() {
    if (!authUser?.id) return
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('dev_ignored_checklist_items')
            .select('checklist_item_id, ignored_at')
            .eq('dev_user_id', authUser.id),
        'load dev ignored checklist items',
      )
      const prefs = (rows ?? []) as Array<{ checklist_item_id: string; ignored_at: string }>
      const itemIds = prefs.map((p) => p.checklist_item_id)
      if (itemIds.length === 0) {
        setIgnoredTaskTypes([])
        return
      }
      const items = await withSupabaseRetry(
        async () => supabase.from('checklist_items').select('id, title').in('id', itemIds),
        'load checklist items for ignored types',
      )
      const itemRows = (items ?? []) as Array<{ id: string; title: string | null }>
      const titleMap = new Map(itemRows.map((i) => [i.id, i.title ?? 'Untitled']))
      const list = prefs.map((p) => ({
        checklist_item_id: p.checklist_item_id,
        task_title: titleMap.get(p.checklist_item_id) ?? 'Untitled',
        ignored_at: p.ignored_at,
      }))
      list.sort((a, b) => new Date(b.ignored_at).getTime() - new Date(a.ignored_at).getTime())
      setIgnoredTaskTypes(list)
    } catch (e) {
      setError(formatErrorMessage(e))
      setIgnoredTaskTypes([])
    }
  }

  useEffect(() => {
    if (!ignoredTaskTypesOpen || !authUser?.id || myRole !== 'dev') return
    setIgnoredTaskTypesLoading(true)
    loadIgnoredTaskTypes().finally(() => setIgnoredTaskTypesLoading(false))
  }, [ignoredTaskTypesOpen, authUser?.id, myRole])

  const showMyReports =
    myRole === 'dev' ||
    myRole === 'master_technician' ||
    isAssistantLike(myRole) ||
    myRole === 'primary' ||
    isSubcontractorLikeRole(myRole)

  useEffect(() => {
    if (!authUser?.id || !showMyReports) return
    setMyReportsLoading(true)
    const load = async () => {
      try {
        const [{ data: reportSettings }, { data }] = await Promise.all([
          supabase.from('app_settings').select('key, value_num').eq('key', 'report_edit_window_days').maybeSingle(),
          supabase.rpc('list_my_reports'),
        ])
        const editDays = (reportSettings as { value_num?: number } | null)?.value_num ?? 2
        setMyReportsReportEditWindowDays(typeof editDays === 'number' ? editDays : 2)
        const arr = Array.isArray(data) ? data : []
        const list = arr.map(
          (r: {
            id: string
            template_id: string
            template_name: string
            job_display_name: string
            job_ledger_id?: string | null
            project_id?: string | null
            bid_id?: string | null
            created_at: string
            created_by_name: string
            field_values?: unknown
            reported_at_lat?: number | null
            reported_at_lng?: number | null
          }) => ({
            id: r.id,
            template_id: r.template_id,
            template_name: r.template_name,
            job_display_name: r.job_display_name,
            job_ledger_id: r.job_ledger_id ?? null,
            project_id: r.project_id ?? null,
            bid_id: r.bid_id ?? null,
            created_at: r.created_at,
            created_by_name: r.created_by_name,
            field_values: r.field_values as Record<string, string> | undefined,
            reported_at_lat: r.reported_at_lat ?? null,
            reported_at_lng: r.reported_at_lng ?? null,
          }),
        )
        setMyReports(list)
      } finally {
        setMyReportsLoading(false)
      }
    }
    loadMyReportsRef.current = load
    load()
  }, [authUser?.id, showMyReports])

  useEffect(() => {
    if (!showMyReports) return
    const channel = supabase
      .channel('settings-my-reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        loadMyReportsRef.current?.()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [showMyReports])

  useEffect(() => {
    if (notificationHistoryOpen) {
      const el = document.getElementById('notification-history-content')
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [notificationHistoryOpen])

  useEffect(() => {
    if (myRole === 'dev') {
      loadBilledTotalAndPinnedUsers()
      loadSupplyHousesAPTotalAndPinnedUsers()
      loadExternalTeamTotalAndPinnedUsers()
      loadCostMatrixPinnedUsers()
    }
  }, [myRole])

  const loadMyPins = useCallback(async () => {
    if (!authUser?.id) {
      setMyPins([])
      setPinsLoading(false)
      return
    }
    setPinsLoading(true)
    const pins = await getMergedFilteredPins(authUser.id, myRole, myEstimatorProspectsAccess)
    setMyPins(pins)
    setPinsLoading(false)
  }, [authUser?.id, myRole, myEstimatorProspectsAccess])

  useEffect(() => {
    loadMyPins()
  }, [loadMyPins])

  useEffect(() => {
    const onPinsChanged = () => {
      loadMyPins()
    }
    window.addEventListener('pipetooling-pins-changed', onPinsChanged)
    return () => window.removeEventListener('pipetooling-pins-changed', onPinsChanged)
  }, [loadMyPins])

  const { total: costMatrixTotal } = useCostMatrixTotal(myRole === 'dev')

  // Default template test target (notifications + email): current user if in list, else first user
  useEffect(() => {
    if (myRole !== 'dev' || users.length === 0) return
    setTemplateTestTargetUserId((prev) => {
      if (prev) return prev
      const meInList = authUser?.id && users.some((u) => u.id === authUser.id)
      return meInList ? authUser!.id : users[0]!.id
    })
  }, [myRole, users, authUser?.id])

  useEffect(() => {
    if (myRole !== 'dev') return
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD)
              .maybeSingle(),
          'load job tally min posted app setting',
        )
        if (cancelled) return
        const vt = (data as { value_text: string | null } | null)?.value_text
        setJobTallyMinPostedYmdInput(vt?.trim() ?? '')
      } catch {
        if (!cancelled) setJobTallyMinPostedYmdInput('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [myRole])

  useEffect(() => {
    if (myRole !== 'dev') return
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE)
              .maybeSingle(),
          'load field dispatch phone app setting',
        )
        if (cancelled) return
        const vt = (data as { value_text: string | null } | null)?.value_text
        setFieldDispatchPhoneInput(vt?.trim() ?? '')
      } catch {
        if (!cancelled) setFieldDispatchPhoneInput('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [myRole])

  useEffect(() => {
    if (selectedServiceTypeForFixtures) {
      loadFixtureTypes()
    }
  }, [selectedServiceTypeForFixtures])

  useEffect(() => {
    if (selectedServiceTypeForParts) {
      loadPartTypes()
    }
  }, [selectedServiceTypeForParts])

  useEffect(() => {
    if (partTypes.length > 0) {
      loadPartTypePartCounts()
    }
  }, [partTypes])

  useEffect(() => {
    if (selectedServiceTypeForAssemblies) {
      loadAssemblyTypes()
    }
  }, [selectedServiceTypeForAssemblies])

  // For estimators: sync selected service types to visible list when it changes
  useEffect(() => {
    if (myRole !== 'estimator' || !estimatorServiceTypeIds?.length || serviceTypes.length === 0) return
    const visibleIds = serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id)).map((st) => st.id)
    if (visibleIds.length === 0) return
    setSelectedServiceTypeForParts((prev) => (prev && visibleIds.includes(prev) ? prev : visibleIds[0]!))
    setSelectedServiceTypeForAssemblies((prev) => (prev && visibleIds.includes(prev) ? prev : visibleIds[0]!))
  }, [myRole, estimatorServiceTypeIds, serviceTypes])

  const devSalariedPickerRows = useMemo(() => {
    if (devPayConfigForSalaried == null) return []
    return buildSalariedWorkdayPickerRows(devPayConfigForSalaried, users)
  }, [devPayConfigForSalaried, users])

  const devSalariedSelectedPayName = useMemo(
    () =>
      devSalariedPickerRows.find((r) => r.userId === devSalariedSelectedUserId)?.personName ?? '',
    [devSalariedPickerRows, devSalariedSelectedUserId],
  )

  useEffect(() => {
    if (!allSalariedDevSectionOpen) {
      setDevPayConfigForSalaried(null)
      setDevSalariedSelectedUserId(null)
      return
    }
    if (myRole !== 'dev') return
    let cancelled = false
    setDevPayConfigLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select(
                'person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary',
              ),
          'settings dev all salaried pay config',
        )
        if (cancelled) return
        const record: Record<string, PayConfigRow> = {}
        for (const r of (Array.isArray(data) ? data : []) as PayConfigRow[]) {
          record[r.person_name] = r
        }
        setDevPayConfigForSalaried(record)
      } catch (e) {
        if (!cancelled) {
          showToast(formatErrorMessage(e), 'error')
          setDevPayConfigForSalaried({})
        }
      } finally {
        if (!cancelled) setDevPayConfigLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allSalariedDevSectionOpen, myRole, showToast])

  useEffect(() => {
    if (devPayConfigForSalaried == null) return
    setDevSalariedSelectedUserId((prev) => {
      if (prev && devSalariedPickerRows.some((r) => r.userId === prev)) return prev
      return devSalariedPickerRows.find((r) => r.userId != null)?.userId ?? null
    })
  }, [devPayConfigForSalaried, devSalariedPickerRows])

  useEffect(() => {
    if (assemblyTypes.length > 0) {
      loadAssemblyTypeAssemblyCounts()
    }
  }, [assemblyTypes])

  useEffect(() => {
    if (fixtureTypes.length > 0) {
      loadFixtureTypeCounts()
    }
  }, [fixtureTypes])

  useEffect(() => {
    if (selectedServiceTypeForParts) {
      loadPartTypes()
    }
  }, [selectedServiceTypeForParts])

  useEffect(() => {
    if (partTypes.length > 0) {
      loadPartTypePartCounts()
    }
  }, [partTypes])

  async function handleClaimCode(e: React.FormEvent) {
    e.preventDefault()
    setCodeError(null)
    setCodeSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('claim-dev', {
      body: { code: code.trim() },
    })
    setCodeSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setCodeError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setCodeError(err)
      return
    }
    if ((data as { success?: boolean } | null)?.success) {
      setCode('')
      setCodeError(null)
      await loadData()
    } else {
      setCodeError('Invalid code')
    }
  }

  function openPasswordChange() {
    setPasswordChangeOpen(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)
  }

  function closePasswordChange() {
    setPasswordChangeOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordChangeError('Password must be at least 6 characters')
      return
    }

    setPasswordChangeSubmitting(true)

    // First verify current password by attempting to sign in
    if (authUser?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordChangeSubmitting(false)
        setPasswordChangeError('Current password is incorrect')
        return
      }
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setPasswordChangeSubmitting(false)

    if (updateError) {
      setPasswordChangeError(updateError.message)
      return
    }

    setPasswordChangeSuccess(true)
    // Clear form after a delay
    setTimeout(() => {
      closePasswordChange()
    }, 2000)
  }

  async function openFindDuplicatesModal() {
    setMergeDuplicatesModalOpen(true)
    setMergeDuplicatesLoading(true)
    try {
      const { data } = await supabase
        .from('people_pay_config')
        .select('person_name, person_id, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
      const payConfig: Record<string, PayConfigRowForMerge> = {}
      for (const r of (data ?? []) as PayConfigRowForMerge[]) {
        payConfig[r.person_name] = r
      }
      const people = [...myPeople, ...nonUserPeople]
      const emailDups = findPersonUserDuplicates(people, users, payConfig)
      const nameSimilarDups = findNameSimilarDuplicates(payConfig)
      const seen = new Set<string>()
      const dups = [...emailDups]
      for (const d of emailDups) seen.add(`${d.personName}|${d.userDisplayName}`)
      for (const d of nameSimilarDups) {
        const key = `${d.personName}|${d.userDisplayName}`
        if (!seen.has(key)) {
          seen.add(key)
          dups.push(d)
        }
      }
      setMergeDuplicates(dups)
    } finally {
      setMergeDuplicatesLoading(false)
    }
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
      const { data } = await supabase
        .from('people_pay_config')
        .select('person_name, person_id, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
      const payConfig: Record<string, PayConfigRowForMerge> = {}
      for (const r of (data ?? []) as PayConfigRowForMerge[]) {
        payConfig[r.person_name] = r
      }
      const mergePeople = [...myPeople, ...nonUserPeople].map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        archived_at: 'archived_at' in p ? (p as { archived_at?: string | null }).archived_at : null,
      }))
      await mergePersonIntoUser(dup.personName, dup.userDisplayName, payConfig, userId, mergePeople)
      await loadData()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  async function checkDuplicateName(nameToCheck: string, excludeUserId?: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    
    // Check in people table (exclude archived)
    const { data: peopleData } = await supabase
      .from('people')
      .select('id, name')
      .is('archived_at', null)
    
    // Check in users table (exclude current user when editing)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
    
    // Case-insensitive comparison; exclude user being edited from duplicate check
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => (u.id !== excludeUserId) && u.name?.toLowerCase() === trimmedName) ?? false
    
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  const sortedTeamLeaderAssignments = useMemo(() => {
    const rows = [...teamLeaderAssignments]
    rows.sort((a, b) => {
      const aKey =
        teamLeaderSortColumn === 'leader'
          ? displayLabelForGoalPickerUser(a.leader_user_id, goalPickerUsers)
          : displayLabelForGoalPickerUser(a.member_user_id, goalPickerUsers)
      const bKey =
        teamLeaderSortColumn === 'leader'
          ? displayLabelForGoalPickerUser(b.leader_user_id, goalPickerUsers)
          : displayLabelForGoalPickerUser(b.member_user_id, goalPickerUsers)
      const base = aKey.localeCompare(bKey, undefined, { sensitivity: 'base' })
      return teamLeaderSortDir === 'asc' ? base : -base
    })
    return rows
  }, [teamLeaderAssignments, goalPickerUsers, teamLeaderSortColumn, teamLeaderSortDir])

  const filteredTeamLeaderAssignments = useMemo(() => {
    const q = teamLeaderAssignmentsSearchQuery.trim().toLowerCase()
    if (!q) return sortedTeamLeaderAssignments
    return sortedTeamLeaderAssignments.filter((row) => {
      const leaderLabel = displayLabelForGoalPickerUser(row.leader_user_id, goalPickerUsers).toLowerCase()
      const memberLabel = displayLabelForGoalPickerUser(row.member_user_id, goalPickerUsers).toLowerCase()
      return leaderLabel.includes(q) || memberLabel.includes(q)
    })
  }, [sortedTeamLeaderAssignments, goalPickerUsers, teamLeaderAssignmentsSearchQuery])

  const teamHoursMemberPickerUsers = useMemo(() => {
    if (!teamAssignLeaderId) return []
    const assignedIds = new Set(
      teamLeaderAssignments
        .filter((r) => r.leader_user_id === teamAssignLeaderId)
        .map((r) => r.member_user_id),
    )
    return goalPickerUsers.filter((u) => u.id !== teamAssignLeaderId && !assignedIds.has(u.id))
  }, [teamAssignLeaderId, teamLeaderAssignments, goalPickerUsers])

  useEffect(() => {
    if (!teamAssignMemberId || !teamAssignLeaderId) return
    if (!teamHoursMemberPickerUsers.some((u) => u.id === teamAssignMemberId)) {
      setTeamAssignMemberId('')
    }
  }, [teamAssignLeaderId, teamAssignMemberId, teamHoursMemberPickerUsers])

  const teamHoursNoMembersAvailable = Boolean(teamAssignLeaderId && teamHoursMemberPickerUsers.length === 0)
  const teamHoursMemberPickerDisabled =
    !teamAssignLeaderId || teamAssignSaving || teamHoursNoMembersAvailable
  const teamHoursMemberPlaceholder = !teamAssignLeaderId
    ? 'Choose a leader first…'
    : teamHoursNoMembersAvailable
      ? 'No users left to assign'
      : 'Select user…'

  const settingsJumpGroups = useMemo(() => getSettingsJumpGroups(myRole), [myRole])
  useEffect(() => {
    const first = settingsJumpGroups[0]
    if (!first) return
    if (!settingsJumpGroups.some((g) => g.id === activeSettingsTab)) {
      setActiveSettingsTab(first.id)
    }
  }, [settingsJumpGroups, activeSettingsTab])


  if (loading) return <p>Loading…</p>
  if (error && !myRole) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>

  // For estimators with restrictions, only show approved service types in Material Part/Assembly Types
  const visibleServiceTypesForMaterials = myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : serviceTypes
  const canDeleteMaterialTypes = myRole === 'dev'


  return (
    <div>
      {impersonating && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-amber-100)',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: 'var(--text-amber-800)', fontWeight: 500 }}>
            Signed in as {settingsImpersonationBannerLine}
          </span>
          <button
            type="button"
            onClick={handleBackToMyAccount}
            title={settingsImpersonationExitTitle}
            aria-label="Back to your original signed-in account"
            style={{
              padding: '0.35rem 0.75rem',
              background: 'var(--bg-amber-100)',
              color: 'var(--text-amber-800)',
              border: '1px solid #f59e0b',
              borderRadius: 4,
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: '14rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {settingsImpersonationExitLabel === 'Back' ? 'Back to my Account' : settingsImpersonationExitLabel}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Your role: <strong>{myRole == null ? '—' : myRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSignOut} style={{ padding: '0.5rem 1rem' }}>
            Sign out
          </button>
          <button type="button" onClick={openPasswordChange} style={{ padding: '0.5rem 1rem' }}>
            Change password
          </button>
        </div>
      </div>

      <SettingsTabBar groups={settingsJumpGroups} activeId={activeSettingsTab} onSelect={setActiveSettingsTab} />

      <div style={{ display: activeSettingsTab === 'settings-recent-push' ? undefined : 'none' }}>
        <SettingsRecentPushNotifications userId={authUser?.id} />
      </div>

      <SettingsGroup
        id="settings-account"
        hidden={activeSettingsTab !== 'settings-account'}
        title="Your account"
        titleTrailing={
          <SettingsAccountBackupTrailing
            myRole={myRole}
            lastFullBackupAtIso={lastFullBackupAtIso}
            exportAllBackup={exportAllBackup}
            exportBackupBusy={exportBackupBusy}
          />
        }
      >
        <SettingsAccountTab
          closePasswordChange={closePasswordChange}
          confirmPassword={confirmPassword}
          currentPassword={currentPassword}
          handleEnableLocation={handleEnableLocation}
          handlePasswordChange={handlePasswordChange}
          handleTestNotification={handleTestNotification}
          locationLoading={locationLoading}
          locationPermission={locationPermission}
          myProfileEmail={myProfileEmail}
          myProfileError={myProfileError}
          myProfileName={myProfileName}
          myProfilePhone={myProfilePhone}
          myProfileSaving={myProfileSaving}
          myRole={myRole}
          newPassword={newPassword}
          passwordChangeError={passwordChangeError}
          passwordChangeOpen={passwordChangeOpen}
          passwordChangeSubmitting={passwordChangeSubmitting}
          passwordChangeSuccess={passwordChangeSuccess}
          pushNotifications={pushNotifications}
          saveMyProfile={saveMyProfile}
          setConfirmPassword={setConfirmPassword}
          setCurrentPassword={setCurrentPassword}
          setMyProfileEmail={setMyProfileEmail}
          setMyProfileName={setMyProfileName}
          setMyProfilePhone={setMyProfilePhone}
          setNewPassword={setNewPassword}
          setPasswordChangeError={setPasswordChangeError}
          testNotificationError={testNotificationError}
          testNotificationSending={testNotificationSending}
          testNotificationSuccess={testNotificationSuccess}
        />
      </SettingsGroup>

      {activeSettingsTab === 'settings-account' && authUser?.id && (
        <SettingsAccountSchedulingTab
          allSalariedDevNarrowViewport={allSalariedDevNarrowViewport}
          allSalariedDevSectionOpen={allSalariedDevSectionOpen}
          authUser={authUser}
          devPayConfigForSalaried={devPayConfigForSalaried}
          devPayConfigLoading={devPayConfigLoading}
          devSalariedPickerRows={devSalariedPickerRows}
          devSalariedSelectedPayName={devSalariedSelectedPayName}
          devSalariedSelectedUserId={devSalariedSelectedUserId}
          myProfileName={myProfileName}
          myRole={myRole}
          salaryWorkdaySectionOpen={salaryWorkdaySectionOpen}
          selfIsSalariedInPayConfig={selfIsSalariedInPayConfig}
          selfPaySalaryLoaded={selfPaySalaryLoaded}
          setAllSalariedDevSectionOpen={setAllSalariedDevSectionOpen}
          setDevSalariedSelectedUserId={setDevSalariedSelectedUserId}
          setSalaryWorkdaySectionOpen={setSalaryWorkdaySectionOpen}
          setTimeOffSectionOpen={setTimeOffSectionOpen}
          timeOffSectionOpen={timeOffSectionOpen}
        />
      )}

      <SettingsGroup id="settings-dashboard" hidden={activeSettingsTab !== 'settings-dashboard'} title="Dashboard & alerts">
        <SettingsDashboardTab
          apTotal={apTotal}
          authUser={authUser}
          billedCount={billedCount}
          billedTotal={billedTotal}
          costMatrixTotal={costMatrixTotal}
          dailyGoalsLoading={dailyGoalsLoading}
          dailyGoalsRows={dailyGoalsRows}
          dailyGoalsSectionOpen={dailyGoalsSectionOpen}
          dailyGoalsTargetUserId={dailyGoalsTargetUserId}
          dashboardButtons={dashboardButtons}
          dashboardButtonsSaving={dashboardButtonsSaving}
          dashboardButtonsSectionOpen={dashboardButtonsSectionOpen}
          dashboardQuickButtonsPlacement={dashboardQuickButtonsPlacement}
          dashboardQuickButtonsPlacementSaving={dashboardQuickButtonsPlacementSaving}
          externalTeamTotal={externalTeamTotal}
          filteredTeamLeaderAssignments={filteredTeamLeaderAssignments}
          financialPinsSectionOpen={financialPinsSectionOpen}
          goalPickerUsers={goalPickerUsers}
          hasNotificationHistory={hasNotificationHistory}
          ignoredTaskTypes={ignoredTaskTypes}
          ignoredTaskTypesLoading={ignoredTaskTypesLoading}
          ignoredTaskTypesOpen={ignoredTaskTypesOpen}
          ignoredTaskTypesUnignoringId={ignoredTaskTypesUnignoringId}
          loadBilledTotalAndPinnedUsers={loadBilledTotalAndPinnedUsers}
          loadCostMatrixPinnedUsers={loadCostMatrixPinnedUsers}
          loadExternalTeamTotalAndPinnedUsers={loadExternalTeamTotalAndPinnedUsers}
          loadIgnoredTaskTypes={loadIgnoredTaskTypes}
          loadMutedTasks={loadMutedTasks}
          loadSupplyHousesAPTotalAndPinnedUsers={loadSupplyHousesAPTotalAndPinnedUsers}
          mutedTasks={mutedTasks}
          mutedTasksLoading={mutedTasksLoading}
          mutedTasksOpen={mutedTasksOpen}
          myPins={myPins}
          myReports={myReports}
          myReportsExpanded={myReportsExpanded}
          myReportsLoading={myReportsLoading}
          myReportsReportEditWindowDays={myReportsReportEditWindowDays}
          myRole={myRole}
          notificationHistory={notificationHistory}
          notificationHistoryError={notificationHistoryError}
          notificationHistoryLoading={notificationHistoryLoading}
          notificationHistoryOpen={notificationHistoryOpen}
          pinAPMasterIds={pinAPMasterIds}
          pinAPMessage={pinAPMessage}
          pinAPSaving={pinAPSaving}
          pinAPUnpinSaving={pinAPUnpinSaving}
          pinBilledMasterIds={pinBilledMasterIds}
          pinBilledMessage={pinBilledMessage}
          pinBilledSaving={pinBilledSaving}
          pinBilledUnpinSaving={pinBilledUnpinSaving}
          pinCostMatrixMasterIds={pinCostMatrixMasterIds}
          pinCostMatrixMessage={pinCostMatrixMessage}
          pinCostMatrixSaving={pinCostMatrixSaving}
          pinCostMatrixUnpinSaving={pinCostMatrixUnpinSaving}
          pinExternalTeamMasterIds={pinExternalTeamMasterIds}
          pinExternalTeamMessage={pinExternalTeamMessage}
          pinExternalTeamSaving={pinExternalTeamSaving}
          pinExternalTeamUnpinSaving={pinExternalTeamUnpinSaving}
          pinRemovingId={pinRemovingId}
          pinsClearSuccess={pinsClearSuccess}
          pinsLoading={pinsLoading}
          reportNotificationSaving={reportNotificationSaving}
          reportNotificationTemplateIds={reportNotificationTemplateIds}
          reportNotificationsSectionOpen={reportNotificationsSectionOpen}
          reportTemplates={reportTemplates}
          saveReportNotificationPreferences={saveReportNotificationPreferences}
          setDailyGoalsRows={setDailyGoalsRows}
          setDailyGoalsSectionOpen={setDailyGoalsSectionOpen}
          setDailyGoalsTargetUserId={setDailyGoalsTargetUserId}
          setDashboardButtons={setDashboardButtons}
          setDashboardButtonsSaving={setDashboardButtonsSaving}
          setDashboardButtonsSectionOpen={setDashboardButtonsSectionOpen}
          setDashboardQuickButtonsPlacement={setDashboardQuickButtonsPlacement}
          setDashboardQuickButtonsPlacementSaving={setDashboardQuickButtonsPlacementSaving}
          setEditReportModalOpen={setEditReportModalOpen}
          setError={setError}
          setFinancialPinsSectionOpen={setFinancialPinsSectionOpen}
          setIgnoredTaskTypesOpen={setIgnoredTaskTypesOpen}
          setIgnoredTaskTypesUnignoringId={setIgnoredTaskTypesUnignoringId}
          setMuteModalItemId={setMuteModalItemId}
          setMuteModalTitle={setMuteModalTitle}
          setMutedTasksOpen={setMutedTasksOpen}
          setMyReportsExpanded={setMyReportsExpanded}
          setMyReportsModalOpen={setMyReportsModalOpen}
          setNotificationHistoryOpen={setNotificationHistoryOpen}
          setPinAPMasterIds={setPinAPMasterIds}
          setPinAPMessage={setPinAPMessage}
          setPinAPSaving={setPinAPSaving}
          setPinAPUnpinSaving={setPinAPUnpinSaving}
          setPinBilledMasterIds={setPinBilledMasterIds}
          setPinBilledMessage={setPinBilledMessage}
          setPinBilledSaving={setPinBilledSaving}
          setPinBilledUnpinSaving={setPinBilledUnpinSaving}
          setPinCostMatrixMasterIds={setPinCostMatrixMasterIds}
          setPinCostMatrixMessage={setPinCostMatrixMessage}
          setPinCostMatrixSaving={setPinCostMatrixSaving}
          setPinCostMatrixUnpinSaving={setPinCostMatrixUnpinSaving}
          setPinExternalTeamMasterIds={setPinExternalTeamMasterIds}
          setPinExternalTeamMessage={setPinExternalTeamMessage}
          setPinExternalTeamSaving={setPinExternalTeamSaving}
          setPinExternalTeamUnpinSaving={setPinExternalTeamUnpinSaving}
          setPinRemovingId={setPinRemovingId}
          setPinsClearSuccess={setPinsClearSuccess}
          setReportForEdit={setReportForEdit}
          setReportNotificationsSectionOpen={setReportNotificationsSectionOpen}
          setSelectedReport={setSelectedReport}
          setTeamAssignLeaderId={setTeamAssignLeaderId}
          setTeamAssignMemberId={setTeamAssignMemberId}
          setTeamAssignSaving={setTeamAssignSaving}
          setTeamLeadAssignmentsSectionOpen={setTeamLeadAssignmentsSectionOpen}
          setTeamLeaderAssignments={setTeamLeaderAssignments}
          setTeamLeaderAssignmentsSearchQuery={setTeamLeaderAssignmentsSearchQuery}
          setTeamLeaderSortColumn={setTeamLeaderSortColumn}
          setTeamLeaderSortDir={setTeamLeaderSortDir}
          setTeamLeaderVisibilitySavingId={setTeamLeaderVisibilitySavingId}
          setViewReportModalOpen={setViewReportModalOpen}
          showMyReports={showMyReports}
          teamAssignLeaderId={teamAssignLeaderId}
          teamAssignMemberId={teamAssignMemberId}
          teamAssignSaving={teamAssignSaving}
          teamHoursMemberPickerDisabled={teamHoursMemberPickerDisabled}
          teamHoursMemberPickerUsers={teamHoursMemberPickerUsers}
          teamHoursMemberPlaceholder={teamHoursMemberPlaceholder}
          teamLeadAssignmentsSectionOpen={teamLeadAssignmentsSectionOpen}
          teamLeaderAssignments={teamLeaderAssignments}
          teamLeaderAssignmentsSearchQuery={teamLeaderAssignmentsSearchQuery}
          teamLeaderSortColumn={teamLeaderSortColumn}
          teamLeaderSortDir={teamLeaderSortDir}
          teamLeaderVisibilitySavingId={teamLeaderVisibilitySavingId}
          toggleReportNotificationTemplate={toggleReportNotificationTemplate}
          users={users}
        />
      </SettingsGroup>

      <SettingsGroup id="settings-people" hidden={activeSettingsTab !== 'settings-people'} title="People & accounts">
      {myRole === 'dev' && (
        <SettingsPeopleTab
          additionalPeopleSectionOpen={additionalPeopleSectionOpen}
          allPeopleCount={allPeopleCount}
          deleteNonUserPerson={deleteNonUserPerson}
          deletingPersonId={deletingPersonId}
          dispatchGroupError={dispatchGroupError}
          dispatchGroupSavingUserId={dispatchGroupSavingUserId}
          dispatchMemberIds={dispatchMemberIds}
          editPersonEmail={editPersonEmail}
          editPersonError={editPersonError}
          editPersonName={editPersonName}
          editPersonNotes={editPersonNotes}
          editPersonPhone={editPersonPhone}
          editPersonSaving={editPersonSaving}
          editingNonUserPerson={editingNonUserPerson}
          error={error}
          estimatorGroupError={estimatorGroupError}
          estimatorGroupSavingUserId={estimatorGroupSavingUserId}
          estimatorInboxSectionOpen={estimatorInboxSectionOpen}
          estimatorMemberIds={estimatorMemberIds}
          myPeople={myPeople}
          nonUserPeople={nonUserPeople}
          openFindDuplicatesModal={openFindDuplicatesModal}
          payApprovedError={payApprovedError}
          payApprovedMasterIds={payApprovedMasterIds}
          payApprovedMasters={payApprovedMasters}
          payApprovedMastersSectionOpen={payApprovedMastersSectionOpen}
          payApprovedSaving={payApprovedSaving}
          roleVisibilityExpanded={roleVisibilityExpanded}
          saveNonUserPersonEdit={saveNonUserPersonEdit}
          setAdditionalPeopleSectionOpen={setAdditionalPeopleSectionOpen}
          setEditPersonEmail={setEditPersonEmail}
          setEditPersonError={setEditPersonError}
          setEditPersonName={setEditPersonName}
          setEditPersonNotes={setEditPersonNotes}
          setEditPersonPhone={setEditPersonPhone}
          setEditingNonUserPerson={setEditingNonUserPerson}
          setEstimatorInboxSectionOpen={setEstimatorInboxSectionOpen}
          setPayApprovedMastersSectionOpen={setPayApprovedMastersSectionOpen}
          setRoleVisibilityExpanded={setRoleVisibilityExpanded}
          setTaskDispatchSectionOpen={setTaskDispatchSectionOpen}
          taskDispatchSectionOpen={taskDispatchSectionOpen}
          toggleDispatchGroupMember={toggleDispatchGroupMember}
          toggleEstimatorGroupMember={toggleEstimatorGroupMember}
          togglePayApproved={togglePayApproved}
          users={users}
        
          onActiveAccountsDataChanged={() => { void loadData() }}
        />
      )}

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setRoleSharingSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{roleSharingSectionOpen ? '▼' : '▶'}</span>
            Sharing and Adoption
          </button>
          {roleSharingSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Adopt Assistants</h2>
          {myRole === 'dev' && (
            <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
              <label htmlFor="adoption-master-select" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt assistants for the selected master. Changes apply to that master's access.`
              : 'Adopt assistants to give them access to your customers and projects. Assistants can create projects and assign them to you. Assistants cannot see financial totals.'}
          </p>
          {adoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{adoptionError}</p>}
          {assistants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No assistants found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {assistants.map((assistant) => {
                const isAdopted = adoptedAssistantIds.has(assistant.id)
                return (
                  <label
                    key={assistant.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: adoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAdopted}
                      onChange={() => toggleAdoption(assistant.id, isAdopted)}
                      disabled={adoptionSaving}
                      style={{ cursor: adoptionSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{assistant.name || assistant.email}</span>
                      {assistant.email && assistant.name && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({assistant.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                        Adopted
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Primaries</h2>
          {myRole === 'dev' && (
            <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
              <label htmlFor="adoption-master-select-primaries" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select-primaries"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt primaries for the selected master. Changes apply to that master's access.`
              : 'Adopt primaries to associate them with your organization. Primaries can add materials to jobs in the Jobs Billing tab.'}
          </p>
          {primaryAdoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{primaryAdoptionError}</p>}
          {primaries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No primaries found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {primaries.map((primary) => {
                const isAdopted = adoptedPrimaryIds.has(primary.id)
                return (
                  <label
                    key={primary.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: primaryAdoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAdopted}
                      onChange={() => togglePrimaryAdoption(primary.id, isAdopted)}
                      disabled={primaryAdoptionSaving}
                      style={{ cursor: primaryAdoptionSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{primary.name || primary.email}</span>
                      {primary.email && primary.name && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({primary.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                        Adopted
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Superintendents</h2>
          {myRole === 'dev' && (
            <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
              <label htmlFor="adoption-master-select-superintendents" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select-superintendents"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt superintendents for the selected master. Changes apply to that master's access.`
              : 'Adopt superintendents to grant them access to your projects, workflows, jobs, and bids. Superintendents run jobs and manage subcontractors.'}
          </p>
          {superintendentAdoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{superintendentAdoptionError}</p>}
          {superintendents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No superintendents found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {superintendents.map((sup) => {
                const isAdopted = adoptedSuperintendentIds.has(sup.id)
                return (
                  <label
                    key={sup.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: superintendentAdoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAdopted}
                      onChange={() => toggleSuperintendentAdoption(sup.id, isAdopted)}
                      disabled={superintendentAdoptionSaving}
                      style={{ cursor: superintendentAdoptionSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{sup.name || sup.email}</span>
                      {sup.email && sup.name && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({sup.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                        Adopted
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Share with other Master</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            Share your customers and projects with another master. They will see your jobs with assistant-level access (cannot see financial totals).
          </p>
          {sharingError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{sharingError}</p>}
          {masters.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No other masters found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {masters.map((master) => {
                const isShared = sharedMasterIds.has(master.id)
                return (
                  <label
                    key={master.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: sharingSaving ? 'not-allowed' : 'pointer',
                      background: isShared ? 'var(--bg-green-tint)' : 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={() => toggleSharing(master.id, isShared)}
                      disabled={sharingSaving}
                      style={{ cursor: sharingSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{master.name || master.email}</span>
                      {master.email && master.name && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({master.email})
                        </span>
                      )}
                    </span>
                    {isShared && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                        Shared
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {myRole === 'master_technician' && authUser?.id && payApprovedMasterIds.has(authUser.id) && (
        <TeamFeedbackMasterAggregates />
      )}

      </SettingsGroup>

      <SettingsGroup id="settings-data" hidden={activeSettingsTab !== 'settings-data'} title="Data & migration">
      {myRole === 'dev' && (
        <SettingsDataTab
          dataBackupSectionOpen={dataBackupSectionOpen}
          setDataBackupSectionOpen={setDataBackupSectionOpen}
          exportError={exportError}
          exportBackupBusy={exportBackupBusy}
          exportProjectsBackup={exportProjectsBackup}
          exportProjectsLoading={exportProjectsLoading}
          exportMaterialsBackup={exportMaterialsBackup}
          exportMaterialsLoading={exportMaterialsLoading}
          exportBidsBackup={exportBidsBackup}
          exportBidsLoading={exportBidsLoading}
          exportPeopleBackup={exportPeopleBackup}
          exportPeopleLoading={exportPeopleLoading}
          exportJobsBackup={exportJobsBackup}
          exportJobsLoading={exportJobsLoading}
          exportChecklistBackup={exportChecklistBackup}
          exportChecklistLoading={exportChecklistLoading}
          exportReportsBackup={exportReportsBackup}
          exportReportsLoading={exportReportsLoading}
          exportProspectsBackup={exportProspectsBackup}
          exportProspectsLoading={exportProspectsLoading}
          exportSettingsBackup={exportSettingsBackup}
          exportSettingsLoading={exportSettingsLoading}
          exportAllBackup={exportAllBackup}
          exportAllLoading={exportAllLoading}
        />
      )}
      </SettingsGroup>

      <SettingsGroup id="settings-jobs" hidden={activeSettingsTab !== 'settings-jobs'} title="Jobs & dispatch">
      {myRole === 'dev' && (
        <SettingsJobsTab
          jobOwnerOverridesSectionOpen={jobOwnerOverridesSectionOpen}
          setJobOwnerOverridesSectionOpen={setJobOwnerOverridesSectionOpen}
          saveJobOwnerOverrides={saveJobOwnerOverrides}
          users={users}
          jobOwnerOverrideByUserId={jobOwnerOverrideByUserId}
          setJobOwnerOverrideByUserId={setJobOwnerOverrideByUserId}
          jobOwnerOverridesSaving={jobOwnerOverridesSaving}
          jobCountByUserId={jobCountByUserId}
          reassignTargetByUserId={reassignTargetByUserId}
          setReassignTargetByUserId={setReassignTargetByUserId}
          reassignSubmitting={reassignSubmitting}
          setReassignSourceUserId={setReassignSourceUserId}
          setReassignTargetUserId={setReassignTargetUserId}
          setReassignConfirmOpen={setReassignConfirmOpen}
          reassignConfirmOpen={reassignConfirmOpen}
          reassignSourceUserId={reassignSourceUserId}
          reassignTargetUserId={reassignTargetUserId}
          confirmReassignJobs={confirmReassignJobs}
          defaultLaborRateSectionOpen={defaultLaborRateSectionOpen}
          setDefaultLaborRateSectionOpen={setDefaultLaborRateSectionOpen}
          saveDefaultLaborRate={saveDefaultLaborRate}
          defaultLaborRate={defaultLaborRate}
          setDefaultLaborRate={setDefaultLaborRate}
          defaultLaborRateSaving={defaultLaborRateSaving}
        />
      )}
      </SettingsGroup>

      {activeSettingsTab === 'settings-catalogs' && myRole === 'dev' && (
        <SettingsCatalogsProspectsTab
          estimateCxByKey={estimateCxByKey}
          estimateCxSaving={estimateCxSaving}
          estimateCxSectionOpen={estimateCxSectionOpen}
          estimateLineItemCatalogRows={estimateLineItemCatalogRows}
          estimateLineItemCatalogSaving={estimateLineItemCatalogSaving}
          estimateLineItemCatalogSectionOpen={estimateLineItemCatalogSectionOpen}
          estimatePublicTermsBody={estimatePublicTermsBody}
          estimatePublicTermsSaving={estimatePublicTermsSaving}
          estimatePublicTermsSectionOpen={estimatePublicTermsSectionOpen}
          prospectCopyJustCheckingIn={prospectCopyJustCheckingIn}
          prospectCopyJustCheckingInSubject={prospectCopyJustCheckingInSubject}
          prospectCopyNoResponse={prospectCopyNoResponse}
          prospectCopyNoResponseSubject={prospectCopyNoResponseSubject}
          prospectCopyPhoneFollowup={prospectCopyPhoneFollowup}
          prospectCopyPhoneFollowupSubject={prospectCopyPhoneFollowupSubject}
          prospectCopySaving={prospectCopySaving}
          prospectCopySectionOpen={prospectCopySectionOpen}
          saveEstimateCustomerCopyDefaults={saveEstimateCustomerCopyDefaults}
          saveEstimateLineItemCatalog={saveEstimateLineItemCatalog}
          saveEstimatePublicTerms={saveEstimatePublicTerms}
          saveProspectCopyDefaults={saveProspectCopyDefaults}
          setEstimateCxByKey={setEstimateCxByKey}
          setEstimateCxSectionOpen={setEstimateCxSectionOpen}
          setEstimateLineItemCatalogRows={setEstimateLineItemCatalogRows}
          setEstimateLineItemCatalogSectionOpen={setEstimateLineItemCatalogSectionOpen}
          setEstimatePublicTermsBody={setEstimatePublicTermsBody}
          setEstimatePublicTermsSectionOpen={setEstimatePublicTermsSectionOpen}
          setProspectCopyJustCheckingIn={setProspectCopyJustCheckingIn}
          setProspectCopyJustCheckingInSubject={setProspectCopyJustCheckingInSubject}
          setProspectCopyNoResponse={setProspectCopyNoResponse}
          setProspectCopyNoResponseSubject={setProspectCopyNoResponseSubject}
          setProspectCopyPhoneFollowup={setProspectCopyPhoneFollowup}
          setProspectCopyPhoneFollowupSubject={setProspectCopyPhoneFollowupSubject}
          setProspectCopySectionOpen={setProspectCopySectionOpen}
        />
      )}

      {mergeDuplicatesModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Find duplicates</h2>
              <button
                type="button"
                onClick={() => setMergeDuplicatesModalOpen(false)}
                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {mergeDuplicatesLoading ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Checking…</p>
            ) : mergeDuplicates.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No duplicates found.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {mergeDuplicates.map((dup) => (
                  <li key={dup.personName} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{dup.personName} → {dup.userDisplayName}</span>
                    <button
                      type="button"
                      onClick={() => handleMergeDuplicate(dup)}
                      disabled={mergingPersonName === dup.personName}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: mergingPersonName === dup.personName ? 'not-allowed' : 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4 }}
                    >
                      {mergingPersonName === dup.personName ? 'Merging…' : 'Merge'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {viewingOrphanPrices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: '900px', width: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Orphaned material prices</h2>
                        <button
                          type="button"
                          onClick={() => {
                  setViewingOrphanPrices(false)
                  setOrphanError(null)
                  setOrphanPrices([])
                }}
                style={{ padding: '0.25rem 0.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
                        </button>
            </div>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              These are material prices whose part or supply house no longer exists. They do not appear in the Materials Parts Book.
            </p>
            {loadingOrphanPrices && <p>Loading orphaned prices…</p>}
            {orphanError && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{orphanError}</p>}
            {!loadingOrphanPrices && orphanPrices.length === 0 && !orphanError && (
              <p style={{ marginBottom: '0.75rem', color: '#16a34a' }}>No orphaned prices found.</p>
            )}
            {!loadingOrphanPrices && orphanPrices.length > 0 && (
              <>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  Found {orphanPrices.length} orphaned price{orphanPrices.length === 1 ? '' : 's'}.
                </p>
                <div style={{ marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                    onClick={deleteAllOrphanPrices}
                    style={{ padding: '0.35rem 0.75rem', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                    Delete all shown
                        </button>
                      </div>
                <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply house</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Price</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Effective date</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Reason</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanPrices.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.partName}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.supplyHouseName}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${row.price.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.effectiveDate || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {row.reason === 'both'
                              ? 'Missing part & supply house'
                              : row.reason === 'missing_part'
                              ? 'Missing part'
                              : 'Missing supply house'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => deleteOrphanPrice(row.id)}
                              style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-red-100)', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              </>
            )}
          </div>
        </div>
      )}






      <SettingsGroup id="settings-catalogs" hidden={activeSettingsTab !== 'settings-catalogs'} title="Catalogs & trades">
      {(myRole === 'dev' || myRole === 'estimator') && (
        <SettingsCatalogsTab
          assemblyTypeAssemblyCounts={assemblyTypeAssemblyCounts}
          assemblyTypeError={assemblyTypeError}
          assemblyTypeFormOpen={assemblyTypeFormOpen}
          assemblyTypeName={assemblyTypeName}
          assemblyTypeSaving={assemblyTypeSaving}
          assemblyTypes={assemblyTypes}
          canDeleteMaterialTypes={canDeleteMaterialTypes}
          closeEditAssemblyType={closeEditAssemblyType}
          closeEditCountsFixtureGroup={closeEditCountsFixtureGroup}
          closeEditCountsFixtureItem={closeEditCountsFixtureItem}
          closeEditFixtureType={closeEditFixtureType}
          closeEditPartType={closeEditPartType}
          closeEditServiceType={closeEditServiceType}
          countsFixtureGroupError={countsFixtureGroupError}
          countsFixtureGroupFormOpen={countsFixtureGroupFormOpen}
          countsFixtureGroupItems={countsFixtureGroupItems}
          countsFixtureGroupLabel={countsFixtureGroupLabel}
          countsFixtureGroupSaving={countsFixtureGroupSaving}
          countsFixtureGroups={countsFixtureGroups}
          countsFixtureItemError={countsFixtureItemError}
          countsFixtureItemFormOpen={countsFixtureItemFormOpen}
          countsFixtureItemName={countsFixtureItemName}
          countsFixtureItemSaving={countsFixtureItemSaving}
          deleteAssemblyType={deleteAssemblyType}
          deleteCountsFixtureGroup={deleteCountsFixtureGroup}
          deleteCountsFixtureItem={deleteCountsFixtureItem}
          deleteFixtureType={deleteFixtureType}
          deletePartType={deletePartType}
          deleteServiceType={deleteServiceType}
          editingAssemblyType={editingAssemblyType}
          editingCountsFixtureGroup={editingCountsFixtureGroup}
          editingCountsFixtureGroupForItem={editingCountsFixtureGroupForItem}
          editingCountsFixtureItem={editingCountsFixtureItem}
          editingFixtureType={editingFixtureType}
          editingPartType={editingPartType}
          editingServiceType={editingServiceType}
          fixtureTypeError={fixtureTypeError}
          fixtureTypeFormOpen={fixtureTypeFormOpen}
          fixtureTypeLaborBookCounts={fixtureTypeLaborBookCounts}
          fixtureTypeName={fixtureTypeName}
          fixtureTypePriceBookCounts={fixtureTypePriceBookCounts}
          fixtureTypeSaving={fixtureTypeSaving}
          fixtureTypeTakeoffBookCounts={fixtureTypeTakeoffBookCounts}
          fixtureTypes={fixtureTypes}
          loadOrphanMaterialPrices={loadOrphanMaterialPrices}
          managePartsSectionOpen={managePartsSectionOpen}
          moveAssemblyType={moveAssemblyType}
          moveCountsFixtureGroup={moveCountsFixtureGroup}
          moveCountsFixtureItem={moveCountsFixtureItem}
          movePartType={movePartType}
          moveServiceType={moveServiceType}
          myRole={myRole}
          openEditAssemblyType={openEditAssemblyType}
          openEditCountsFixtureGroup={openEditCountsFixtureGroup}
          openEditCountsFixtureItem={openEditCountsFixtureItem}
          openEditFixtureType={openEditFixtureType}
          openEditPartType={openEditPartType}
          openEditServiceType={openEditServiceType}
          partTypeError={partTypeError}
          partTypeFormOpen={partTypeFormOpen}
          partTypeName={partTypeName}
          partTypePartCounts={partTypePartCounts}
          partTypeSaving={partTypeSaving}
          partTypes={partTypes}
          removeAllUnusedAssemblyTypes={removeAllUnusedAssemblyTypes}
          removeAllUnusedPartTypes={removeAllUnusedPartTypes}
          removeUnusedFixtureTypes={removeUnusedFixtureTypes}
          removingUnusedAssemblyTypes={removingUnusedAssemblyTypes}
          removingUnusedFixtureTypes={removingUnusedFixtureTypes}
          removingUnusedPartTypes={removingUnusedPartTypes}
          saveAssemblyType={saveAssemblyType}
          saveCountsFixtureGroup={saveCountsFixtureGroup}
          saveCountsFixtureItem={saveCountsFixtureItem}
          saveFixtureType={saveFixtureType}
          savePartType={savePartType}
          saveServiceType={saveServiceType}
          selectedServiceTypeForAssemblies={selectedServiceTypeForAssemblies}
          selectedServiceTypeForCountsFixtures={selectedServiceTypeForCountsFixtures}
          selectedServiceTypeForFixtures={selectedServiceTypeForFixtures}
          selectedServiceTypeForParts={selectedServiceTypeForParts}
          serviceTypeColor={serviceTypeColor}
          serviceTypeDescription={serviceTypeDescription}
          serviceTypeError={serviceTypeError}
          serviceTypeFormOpen={serviceTypeFormOpen}
          serviceTypeLedgerBidPrefix={serviceTypeLedgerBidPrefix}
          serviceTypeLedgerJobPrefix={serviceTypeLedgerJobPrefix}
          serviceTypeName={serviceTypeName}
          serviceTypeSaving={serviceTypeSaving}
          serviceTypes={serviceTypes}
          setAssemblyTypeName={setAssemblyTypeName}
          setCountsFixtureGroupLabel={setCountsFixtureGroupLabel}
          setCountsFixtureItemName={setCountsFixtureItemName}
          setFixtureTypeName={setFixtureTypeName}
          setManagePartsSectionOpen={setManagePartsSectionOpen}
          setPartTypeName={setPartTypeName}
          setSelectedServiceTypeForAssemblies={setSelectedServiceTypeForAssemblies}
          setSelectedServiceTypeForCountsFixtures={setSelectedServiceTypeForCountsFixtures}
          setSelectedServiceTypeForFixtures={setSelectedServiceTypeForFixtures}
          setSelectedServiceTypeForParts={setSelectedServiceTypeForParts}
          setServiceTypeColor={setServiceTypeColor}
          setServiceTypeDescription={setServiceTypeDescription}
          setServiceTypeLedgerBidPrefix={setServiceTypeLedgerBidPrefix}
          setServiceTypeLedgerJobPrefix={setServiceTypeLedgerJobPrefix}
          setServiceTypeName={setServiceTypeName}
          setViewingOrphanPrices={setViewingOrphanPrices}
          visibleServiceTypesForMaterials={visibleServiceTypesForMaterials}
        />
      )}
      </SettingsGroup>

      <SettingsGroup id="settings-templates" hidden={activeSettingsTab !== 'settings-templates'} title="Templates & testing">
      {myRole === 'dev' && (
        <SettingsTemplatesTab
          authUser={authUser}
          users={users}
          fieldDispatchPhoneInput={fieldDispatchPhoneInput}
          setFieldDispatchPhoneInput={setFieldDispatchPhoneInput}
          fieldDispatchPhoneSaving={fieldDispatchPhoneSaving}
          setFieldDispatchPhoneSaving={setFieldDispatchPhoneSaving}
          jobTallyMinPostedYmdInput={jobTallyMinPostedYmdInput}
          setJobTallyMinPostedYmdInput={setJobTallyMinPostedYmdInput}
          jobTallyMinPostedYmdSaving={jobTallyMinPostedYmdSaving}
          setJobTallyMinPostedYmdSaving={setJobTallyMinPostedYmdSaving}
          jobTallyMinPostedYmdError={jobTallyMinPostedYmdError}
          setJobTallyMinPostedYmdError={setJobTallyMinPostedYmdError}
          templatesJobPartsTallySectionOpen={templatesJobPartsTallySectionOpen}
          setTemplatesJobPartsTallySectionOpen={setTemplatesJobPartsTallySectionOpen}
          templatesDeleteAllEstimatesSectionOpen={templatesDeleteAllEstimatesSectionOpen}
          setTemplatesDeleteAllEstimatesSectionOpen={setTemplatesDeleteAllEstimatesSectionOpen}
          devResetEstimatesModalOpen={devResetEstimatesModalOpen}
          setDevResetEstimatesModalOpen={setDevResetEstimatesModalOpen}
          devResetEstimatesConfirmInput={devResetEstimatesConfirmInput}
          setDevResetEstimatesConfirmInput={setDevResetEstimatesConfirmInput}
          devResetEstimatesLoading={devResetEstimatesLoading}
          setDevResetEstimatesLoading={setDevResetEstimatesLoading}
          templateTestTargetUserId={templateTestTargetUserId}
          setTemplateTestTargetUserId={setTemplateTestTargetUserId}
          notificationTestError={notificationTestError}
          setNotificationTestError={setNotificationTestError}
          notificationTestSuccess={notificationTestSuccess}
          setNotificationTestSuccess={setNotificationTestSuccess}
          notificationTestSending={notificationTestSending}
          testError={testError}
          setTestError={setTestError}
          workflowFnEmailSectionOpen={workflowFnEmailSectionOpen}
          setWorkflowFnEmailSectionOpen={setWorkflowFnEmailSectionOpen}
          workflowFnTestError={workflowFnTestError}
          setWorkflowFnTestError={setWorkflowFnTestError}
          workflowFnTestSuccess={workflowFnTestSuccess}
          setWorkflowFnTestSuccess={setWorkflowFnTestSuccess}
          workflowFnTestTemplateType={workflowFnTestTemplateType}
          setWorkflowFnTestTemplateType={setWorkflowFnTestTemplateType}
          workflowFnTestSending={workflowFnTestSending}
          emailTemplates={emailTemplates}
          emailTemplatesSectionOpen={emailTemplatesSectionOpen}
          setEmailTemplatesSectionOpen={setEmailTemplatesSectionOpen}
          editingTemplate={editingTemplate}
          templateSubject={templateSubject}
          setTemplateSubject={setTemplateSubject}
          templateBody={templateBody}
          setTemplateBody={setTemplateBody}
          templateSaving={templateSaving}
          templateError={templateError}
          setTemplateError={setTemplateError}
          testingTemplate={testingTemplate}
          testSending={testSending}
          notificationTemplates={notificationTemplates}
          notificationTemplatesSectionOpen={notificationTemplatesSectionOpen}
          setNotificationTemplatesSectionOpen={setNotificationTemplatesSectionOpen}
          editingNotificationTemplate={editingNotificationTemplate}
          notificationTemplateTitle={notificationTemplateTitle}
          setNotificationTemplateTitle={setNotificationTemplateTitle}
          notificationTemplateBody={notificationTemplateBody}
          setNotificationTemplateBody={setNotificationTemplateBody}
          notificationTemplateSaving={notificationTemplateSaving}
          notificationTemplateError={notificationTemplateError}
          setNotificationTemplateError={setNotificationTemplateError}
          reportEditWindowDays={reportEditWindowDays}
          setReportEditWindowDays={setReportEditWindowDays}
          reportSubVisibilityMonths={reportSubVisibilityMonths}
          setReportSubVisibilityMonths={setReportSubVisibilityMonths}
          reportEnabledUserIds={reportEnabledUserIds}
          reportSettingsSaving={reportSettingsSaving}
          reportSettingsSectionOpen={reportSettingsSectionOpen}
          setReportSettingsSectionOpen={setReportSettingsSectionOpen}
          closeEditNotificationTemplate={closeEditNotificationTemplate}
          closeEditTemplate={closeEditTemplate}
          closeTestEmail={closeTestEmail}
          openEditTemplate={openEditTemplate}
          openEditNotificationTemplate={openEditNotificationTemplate}
          openTestEmail={openTestEmail}
          saveEmailTemplate={saveEmailTemplate}
          saveNotificationTemplate={saveNotificationTemplate}
          saveReportSettings={saveReportSettings}
          sendTestEmail={sendTestEmail}
          sendTestNotificationTemplate={sendTestNotificationTemplate}
          sendWorkflowNotificationEmailTest={sendWorkflowNotificationEmailTest}
          testCurrentTemplate={testCurrentTemplate}
          toggleReportEnabledUser={toggleReportEnabledUser}
        />
      )}
      </SettingsGroup>

      {!isSubcontractorLikeRole(myRole) && (
        <SettingsAdvancedTab
          active={activeSettingsTab === 'settings-advanced-tools'}
          advancedSectionOpen={advancedSectionOpen}
          setAdvancedSectionOpen={setAdvancedSectionOpen}
          code={code}
          setCode={setCode}
          codeError={codeError}
          setCodeError={setCodeError}
          codeSubmitting={codeSubmitting}
          handleClaimCode={handleClaimCode}
        />
      )}

      {showMyReports && (
        <>
          <ReportViewModal
            open={viewReportModalOpen}
            report={selectedReport}
            onClose={() => { setViewReportModalOpen(false); setSelectedReport(null) }}
            viewerRole={myRole}
          />
          <ReportEditModal
            open={editReportModalOpen}
            report={reportForEdit}
            onClose={() => { setEditReportModalOpen(false); setReportForEdit(null) }}
            onSaved={() => {
              setEditReportModalOpen(false)
              setReportForEdit(null)
              loadMyReportsRef.current?.()
            }}
            viewerRole={myRole}
          />
          <MyReportsModal
            open={myReportsModalOpen}
            onClose={() => setMyReportsModalOpen(false)}
            reports={myReports}
            reportEditWindowDays={myReportsReportEditWindowDays}
            onViewReport={(r) => {
              setSelectedReport({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, created_by_name: r.created_by_name, field_values: r.field_values, reported_at_lat: r.reported_at_lat ?? null, reported_at_lng: r.reported_at_lng ?? null })
              setViewReportModalOpen(true)
            }}
            onEditReport={(r) => {
              setReportForEdit({ id: r.id, template_id: r.template_id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, field_values: r.field_values })
              setEditReportModalOpen(true)
            }}
          />
        </>
      )}
      <ChecklistItemMuteModal
        open={!!muteModalItemId}
        checklistItemId={muteModalItemId}
        taskTitle={muteModalTitle}
        authUserId={authUser?.id ?? null}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => loadMutedTasks()}
      />

      <SettingsHowItWorksTab active={activeSettingsTab === 'settings-how-it-works'} />
    </div>
  )
}
