import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables, } from '../lib/cascadePersonName'
import { useAuth } from '../hooks/useAuth'
import {
  impersonationExitDisplayLabel,
  impersonationExitTitle,
  impersonationSignedInAsDescription,
} from '../lib/impersonationUiLabels'
import { getMergedFilteredPins, type PinnedItem } from '../lib/pinnedTabs'
import { resolveSettingsDeepLink } from '../lib/settingsDeepLink'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useToastContext } from '../contexts/ToastContext'
import ReportViewModal from '../components/ReportViewModal'
import ReportEditModal, { type ReportForEdit } from '../components/ReportEditModal'
import MyReportsModal from '../components/MyReportsModal'
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
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import SettingsTemplatesTab from '../components/settings/SettingsTemplatesTab'
import SettingsPeopleTab from '../components/settings/SettingsPeopleTab'
import SettingsSharingAdoptionSection from '../components/settings/SettingsSharingAdoptionSection'
import SettingsDashboardTab from '../components/settings/SettingsDashboardTab'
import SettingsCatalogsTab from '../components/settings/SettingsCatalogsTab'
import SettingsCatalogsProspectsTab from '../components/settings/SettingsCatalogsProspectsTab'
import SettingsAccountTab from '../components/settings/SettingsAccountTab'
import SettingsAccountSchedulingTab from '../components/settings/SettingsAccountSchedulingTab'
import SettingsAccountBackupTrailing from '../components/settings/SettingsAccountBackupTrailing'
import { useSettingsBackupExports } from '../hooks/useSettingsBackupExports'
import { useSettingsCatalogs } from '../hooks/useSettingsCatalogs'
import { useSettingsJobsAdmin } from '../hooks/useSettingsJobsAdmin'
import { useSettingsProspectsCatalog } from '../hooks/useSettingsProspectsCatalog'
import { useSettingsPeopleDirectory } from '../hooks/useSettingsPeopleDirectory'
import { useSettingsFinancialPins } from '../hooks/useSettingsFinancialPins'
import { useSettingsMyReports } from '../hooks/useSettingsMyReports'
import { useSettingsTeamLeaderAssignments } from '../hooks/useSettingsTeamLeaderAssignments'
import type { UserRow } from '../types/settingsRows'
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
  const allSalariedDevNarrowViewport = useNarrowViewport640()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('')
  const [myEstimatorProspectsAccess, setMyEstimatorProspectsAccess] = useState(false)
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testNotificationSending, setTestNotificationSending] = useState(false)
  const [testNotificationError, setTestNotificationError] = useState<string | null>(null)
  const [testNotificationSuccess, setTestNotificationSuccess] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [locationLoading, setLocationLoading] = useState(false)
  const [pinsClearSuccess, setPinsClearSuccess] = useState(false)
  const [myPins, setMyPins] = useState<PinnedItem[]>([])
  const [pinsLoading, setPinsLoading] = useState(true)
  const [pinRemovingId, setPinRemovingId] = useState<string | null>(null)
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const [passwordChangeSubmitting, setPasswordChangeSubmitting] = useState(false)
  const [myProfileName, setMyProfileName] = useState('')
  const [myProfileEmail, setMyProfileEmail] = useState('')
  const [myProfilePhone, setMyProfilePhone] = useState('')
  const [myProfileOriginalName, setMyProfileOriginalName] = useState('')
  const [myProfileSaving, setMyProfileSaving] = useState(false)
  const [myProfileError, setMyProfileError] = useState<string | null>(null)
  /** Personal Salaried workday: shown only when people_pay_config matches profile name and is_salary */
  const [selfIsSalariedInPayConfig, setSelfIsSalariedInPayConfig] = useState(false)
  const [selfPaySalaryLoaded, setSelfPaySalaryLoaded] = useState(false)
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
  const [dataBackupSectionOpen, setDataBackupSectionOpen] = useState(false)


  // Catalogs & trades engines (five type-CRUD engines + orphan prices) — extracted
  // to useSettingsCatalogs (v2.855). Instantiated here (not in the tab) because
  // serviceTypes is cross-tab substrate (estimator sync + visibleServiceTypesForMaterials
  // + loadData's loadServiceTypes call).
  const {
    serviceTypes,
    loadServiceTypes,
    serviceTypeFormOpen,
    editingServiceType,
    serviceTypeName,
    setServiceTypeName,
    serviceTypeDescription,
    setServiceTypeDescription,
    serviceTypeColor,
    setServiceTypeColor,
    serviceTypeLedgerJobPrefix,
    setServiceTypeLedgerJobPrefix,
    serviceTypeLedgerBidPrefix,
    setServiceTypeLedgerBidPrefix,
    serviceTypeSaving,
    serviceTypeError,
    openEditServiceType,
    closeEditServiceType,
    saveServiceType,
    deleteServiceType,
    moveServiceType,
    fixtureTypes,
    selectedServiceTypeForFixtures,
    setSelectedServiceTypeForFixtures,
    fixtureTypeFormOpen,
    editingFixtureType,
    fixtureTypeName,
    setFixtureTypeName,
    fixtureTypeSaving,
    fixtureTypeError,
    fixtureTypePriceBookCounts,
    fixtureTypeLaborBookCounts,
    fixtureTypeTakeoffBookCounts,
    removingUnusedFixtureTypes,
    openEditFixtureType,
    closeEditFixtureType,
    saveFixtureType,
    removeUnusedFixtureTypes,
    deleteFixtureType,
    countsFixtureGroups,
    countsFixtureGroupItems,
    selectedServiceTypeForCountsFixtures,
    setSelectedServiceTypeForCountsFixtures,
    countsFixtureGroupFormOpen,
    editingCountsFixtureGroup,
    countsFixtureGroupLabel,
    setCountsFixtureGroupLabel,
    countsFixtureGroupSaving,
    countsFixtureGroupError,
    countsFixtureItemFormOpen,
    editingCountsFixtureGroupForItem,
    editingCountsFixtureItem,
    countsFixtureItemName,
    setCountsFixtureItemName,
    countsFixtureItemSaving,
    countsFixtureItemError,
    openEditCountsFixtureGroup,
    closeEditCountsFixtureGroup,
    saveCountsFixtureGroup,
    deleteCountsFixtureGroup,
    moveCountsFixtureGroup,
    openEditCountsFixtureItem,
    closeEditCountsFixtureItem,
    saveCountsFixtureItem,
    deleteCountsFixtureItem,
    moveCountsFixtureItem,
    partTypes,
    selectedServiceTypeForParts,
    setSelectedServiceTypeForParts,
    partTypeFormOpen,
    editingPartType,
    partTypeName,
    setPartTypeName,
    partTypeSaving,
    partTypeError,
    partTypePartCounts,
    removingUnusedPartTypes,
    openEditPartType,
    closeEditPartType,
    savePartType,
    deletePartType,
    removeAllUnusedPartTypes,
    movePartType,
    assemblyTypes,
    selectedServiceTypeForAssemblies,
    setSelectedServiceTypeForAssemblies,
    assemblyTypeFormOpen,
    editingAssemblyType,
    assemblyTypeName,
    setAssemblyTypeName,
    assemblyTypeSaving,
    assemblyTypeError,
    assemblyTypeAssemblyCounts,
    removingUnusedAssemblyTypes,
    openEditAssemblyType,
    closeEditAssemblyType,
    saveAssemblyType,
    deleteAssemblyType,
    removeAllUnusedAssemblyTypes,
    moveAssemblyType,
    managePartsSectionOpen,
    setManagePartsSectionOpen,
    viewingOrphanPrices,
    setViewingOrphanPrices,
    orphanPrices,
    setOrphanPrices,
    loadingOrphanPrices,
    orphanError,
    setOrphanError,
    loadOrphanMaterialPrices,
    deleteOrphanPrice,
    deleteAllOrphanPrices,
  } = useSettingsCatalogs({ setError })

  // Jobs & dispatch admin engine — extracted to useSettingsJobsAdmin (v2.856)
  const {
    jobOwnerOverridesSectionOpen,
    setJobOwnerOverridesSectionOpen,
    jobOwnerOverrideByUserId,
    setJobOwnerOverrideByUserId,
    jobOwnerOverridesSaving,
    jobCountByUserId,
    reassignTargetByUserId,
    setReassignTargetByUserId,
    reassignConfirmOpen,
    setReassignConfirmOpen,
    reassignSourceUserId,
    setReassignSourceUserId,
    reassignTargetUserId,
    setReassignTargetUserId,
    reassignSubmitting,
    defaultLaborRateSectionOpen,
    setDefaultLaborRateSectionOpen,
    defaultLaborRate,
    setDefaultLaborRate,
    defaultLaborRateSaving,
    saveJobOwnerOverrides,
    confirmReassignJobs,
    saveDefaultLaborRate,
  } = useSettingsJobsAdmin({ enabled: myRole === 'dev', users, setError })

  // Prospects/estimate copy engine — extracted to useSettingsProspectsCatalog (v2.856).
  // Parent-instantiated because SettingsCatalogsProspectsTab is conditional-mount
  // (unsaved edits must survive tab switches — map quirk #1).
  const {
    prospectCopyNoResponse,
    setProspectCopyNoResponse,
    prospectCopyPhoneFollowup,
    setProspectCopyPhoneFollowup,
    prospectCopyJustCheckingIn,
    setProspectCopyJustCheckingIn,
    prospectCopyNoResponseSubject,
    setProspectCopyNoResponseSubject,
    prospectCopyPhoneFollowupSubject,
    setProspectCopyPhoneFollowupSubject,
    prospectCopyJustCheckingInSubject,
    setProspectCopyJustCheckingInSubject,
    prospectCopySaving,
    prospectCopySectionOpen,
    setProspectCopySectionOpen,
    estimateCxSectionOpen,
    setEstimateCxSectionOpen,
    estimateCxSaving,
    estimateCxByKey,
    setEstimateCxByKey,
    estimatePublicTermsSaving,
    estimatePublicTermsBody,
    setEstimatePublicTermsBody,
    estimatePublicTermsSectionOpen,
    setEstimatePublicTermsSectionOpen,
    estimateLineItemCatalogSectionOpen,
    setEstimateLineItemCatalogSectionOpen,
    estimateLineItemCatalogSaving,
    estimateLineItemCatalogRows,
    setEstimateLineItemCatalogRows,
    saveProspectCopyDefaults,
    saveEstimateCustomerCopyDefaults,
    saveEstimatePublicTerms,
    saveEstimateLineItemCatalog,
  } = useSettingsProspectsCatalog({ enabled: myRole === 'dev', setError })

  // People & accounts directory engine — extracted to useSettingsPeopleDirectory (v2.857)
  const {
    myPeople,
    nonUserPeople,
    allPeopleCount,
    dispatchMemberIds,
    dispatchGroupError,
    dispatchGroupSavingUserId,
    estimatorMemberIds,
    estimatorGroupError,
    estimatorGroupSavingUserId,
    payApprovedMasterIds,
    payApprovedMasters,
    payApprovedSaving,
    payApprovedError,
    payApprovedMastersSectionOpen,
    setPayApprovedMastersSectionOpen,
    taskDispatchSectionOpen,
    setTaskDispatchSectionOpen,
    estimatorInboxSectionOpen,
    setEstimatorInboxSectionOpen,
    additionalPeopleSectionOpen,
    setAdditionalPeopleSectionOpen,
    roleVisibilityExpanded,
    setRoleVisibilityExpanded,
    editingNonUserPerson,
    setEditingNonUserPerson,
    editPersonName,
    setEditPersonName,
    editPersonEmail,
    setEditPersonEmail,
    editPersonPhone,
    setEditPersonPhone,
    editPersonNotes,
    setEditPersonNotes,
    editPersonSaving,
    editPersonError,
    setEditPersonError,
    deletingPersonId,
    mergeDuplicatesModalOpen,
    setMergeDuplicatesModalOpen,
    mergeDuplicatesLoading,
    mergeDuplicates,
    mergingPersonName,
    toggleDispatchGroupMember,
    toggleEstimatorGroupMember,
    saveNonUserPersonEdit,
    deleteNonUserPerson,
    togglePayApproved,
    openFindDuplicatesModal,
    handleMergeDuplicate,
  } = useSettingsPeopleDirectory({
    enabled: myRole === 'dev',
    authUserId: authUser?.id ?? null,
    users,
    setError,
    onDataChanged: () => loadData(),
  })

  // Dashboard & alerts residue — three seam hooks (v2.858)
  const {
    financialPinsSectionOpen,
    setFinancialPinsSectionOpen,
    pinBilledMasterIds,
    setPinBilledMasterIds,
    pinBilledSaving,
    setPinBilledSaving,
    pinBilledUnpinSaving,
    setPinBilledUnpinSaving,
    pinBilledMessage,
    setPinBilledMessage,
    billedCount,
    billedTotal,
    pinAPMasterIds,
    setPinAPMasterIds,
    pinAPSaving,
    setPinAPSaving,
    pinAPUnpinSaving,
    setPinAPUnpinSaving,
    pinAPMessage,
    setPinAPMessage,
    apTotal,
    pinExternalTeamMasterIds,
    setPinExternalTeamMasterIds,
    pinExternalTeamSaving,
    setPinExternalTeamSaving,
    pinExternalTeamUnpinSaving,
    setPinExternalTeamUnpinSaving,
    pinExternalTeamMessage,
    setPinExternalTeamMessage,
    externalTeamTotal,
    pinCostMatrixMasterIds,
    setPinCostMatrixMasterIds,
    pinCostMatrixSaving,
    setPinCostMatrixSaving,
    pinCostMatrixUnpinSaving,
    setPinCostMatrixUnpinSaving,
    pinCostMatrixMessage,
    setPinCostMatrixMessage,
    costMatrixTotal,
    loadBilledTotalAndPinnedUsers,
    loadSupplyHousesAPTotalAndPinnedUsers,
    loadExternalTeamTotalAndPinnedUsers,
    loadCostMatrixPinnedUsers,
  } = useSettingsFinancialPins(myRole === 'dev')

  const showMyReports =
    myRole === 'dev' ||
    myRole === 'master_technician' ||
    isAssistantLike(myRole) ||
    myRole === 'primary' ||
    isSubcontractorLikeRole(myRole)

  const {
    myReports,
    myReportsLoading,
    myReportsExpanded,
    setMyReportsExpanded,
    myReportsReportEditWindowDays,
    loadMyReportsRef,
  } = useSettingsMyReports(showMyReports, authUser?.id ?? null)

  const {
    teamLeaderAssignments,
    setTeamLeaderAssignments,
    teamLeaderVisibilitySavingId,
    setTeamLeaderVisibilitySavingId,
    teamAssignLeaderId,
    setTeamAssignLeaderId,
    teamAssignMemberId,
    setTeamAssignMemberId,
    teamAssignSaving,
    setTeamAssignSaving,
    teamLeaderSortColumn,
    setTeamLeaderSortColumn,
    teamLeaderSortDir,
    setTeamLeaderSortDir,
    teamLeaderAssignmentsSearchQuery,
    setTeamLeaderAssignmentsSearchQuery,
    filteredTeamLeaderAssignments,
    teamHoursMemberPickerUsers,
    teamHoursMemberPickerDisabled,
    teamHoursMemberPlaceholder,
  } = useSettingsTeamLeaderAssignments({
    enabled: myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole),
    goalPickerUsers,
    setError,
  })

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
  const [myReportsModalOpen, setMyReportsModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string>; reported_at_lat?: number | null; reported_at_lng?: number | null } | null>(null)
  const [viewReportModalOpen, setViewReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
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

    // Sharing & Adoption data is owned by SettingsSharingAdoptionSection (useMasterAdoptions)

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
    }

    // People directory / groups / pay-approved data is owned by useSettingsPeopleDirectory

    // Load email templates and service types if dev; service types also for estimators (Material Part/Assembly Types)
    if (role === 'dev' || role === 'estimator') {
      await loadServiceTypes()
    }
    setLoading(false)
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

  useEffect(() => {
    if (notificationHistoryOpen) {
      const el = document.getElementById('notification-history-content')
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [notificationHistoryOpen])

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
                'person_name, hourly_wage, is_salary, record_hours_but_salary',
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

  const settingsJumpGroups = useMemo(() => getSettingsJumpGroups(myRole), [myRole])

  // Deep links into Settings: /settings?tab=<group-id> and /settings#<section-anchor>
  // (dashboard banners + Calendar). Applied once per unique URL value, re-attempted
  // when the role-filtered groups arrive so a valid target isn't lost to load order.
  const location = useLocation()
  const appliedDeepLinkRef = useRef<string | null>(null)
  useEffect(() => {
    const key = `${location.search}|${location.hash}`
    if (appliedDeepLinkRef.current === key) return
    const { tabId, anchorId } = resolveSettingsDeepLink(location.search, location.hash)
    if (!tabId && !anchorId) {
      appliedDeepLinkRef.current = key
      return
    }
    if (tabId) {
      if (!settingsJumpGroups.some((g) => g.id === tabId)) return // groups not loaded yet (or not visible to this role) — retry on next groups change
      setActiveSettingsTab(tabId)
    }
    appliedDeepLinkRef.current = key
    if (anchorId) {
      // The owning tab mounts conditionally and its sections hydrate from async
      // data, so the anchor can appear well after this effect runs. Poll for it
      // (bounded, ~5s) and scroll once it exists, then stop.
      const deadline = Date.now() + 5000
      const tick = () => {
        const el = document.getElementById(anchorId)
        if (el) {
          el.scrollIntoView({ block: 'start', behavior: 'auto' })
          return
        }
        if (Date.now() < deadline) window.setTimeout(tick, 120)
      }
      window.setTimeout(tick, 120)
    }
  }, [location.search, location.hash, settingsJumpGroups])

  useEffect(() => {
    const first = settingsJumpGroups[0]
    if (!first) return
    // Functional update: when this fires in the same commit as the deep-link
    // effect above, `prev` is the just-queued deep-link tab (not this render's
    // stale closure value), so a valid deep link is never clobbered.
    setActiveSettingsTab((prev) => (settingsJumpGroups.some((g) => g.id === prev) ? prev : first.id))
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
          mergeDuplicatesModalOpen={mergeDuplicatesModalOpen}
          setMergeDuplicatesModalOpen={setMergeDuplicatesModalOpen}
          mergeDuplicatesLoading={mergeDuplicatesLoading}
          mergeDuplicates={mergeDuplicates}
          mergingPersonName={mergingPersonName}
          handleMergeDuplicate={handleMergeDuplicate}
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
        <SettingsSharingAdoptionSection isDev={myRole === 'dev'} authUserId={authUser?.id ?? null} />
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
          viewingOrphanPrices={viewingOrphanPrices}
          orphanPrices={orphanPrices}
          setOrphanPrices={setOrphanPrices}
          loadingOrphanPrices={loadingOrphanPrices}
          orphanError={orphanError}
          setOrphanError={setOrphanError}
          deleteOrphanPrice={deleteOrphanPrice}
          deleteAllOrphanPrices={deleteAllOrphanPrices}
          visibleServiceTypesForMaterials={visibleServiceTypesForMaterials}
        />
      )}
      </SettingsGroup>

      <SettingsGroup id="settings-templates" hidden={activeSettingsTab !== 'settings-templates'} title="Templates & testing">
      {myRole === 'dev' && (
        <SettingsTemplatesTab
          authUser={authUser}
          users={users}
          setError={setError}
        />
      )}
      </SettingsGroup>

      {!isSubcontractorLikeRole(myRole) && (
        <SettingsAdvancedTab
          active={activeSettingsTab === 'settings-advanced-tools'}
          onRoleMaybeChanged={() => { void loadData() }}
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
