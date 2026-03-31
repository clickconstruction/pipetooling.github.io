import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables, getPersonNamesForUser } from '../lib/cascadePersonName'
import { findPersonUserDuplicates, findNameSimilarDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import type { PayConfigRowForMerge } from '../lib/mergePersonUserDuplicates'
import { useAuth } from '../hooks/useAuth'
import { addPinForUser, clearPinned, clearPinnedInSupabase, deletePinForPathAndTab, getMergedFilteredPins, getUsersWithPin, removePin, type PinnedItem } from '../lib/pinnedTabs'
import { useCostMatrixTotal } from '../hooks/useCostMatrixTotal'
import { fetchSubLaborDueTotal } from '../hooks/useSubLaborDueTotal'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useToastContext } from '../contexts/ToastContext'
import ReportViewModal from '../components/ReportViewModal'
import ReportEditModal, { type ReportForEdit } from '../components/ReportEditModal'
import MyReportsModal, { type ReportForMyReports } from '../components/MyReportsModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import PasswordInput from '../components/PasswordInput'
import { SalaryWorkScheduleSettings } from '../components/SalaryWorkScheduleSettings'
import TeamFeedbackDevSettingsBlock from '../components/team-feedback/TeamFeedbackDevSettingsBlock'
import TeamFeedbackMasterAggregates from '../components/team-feedback/TeamFeedbackMasterAggregates'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { formatNotificationDatetime } from '../utils/formatNotificationDatetime'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary' | 'superintendent'
type NotificationHistoryRow = Database['public']['Tables']['notification_history']['Row']

type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole
  last_sign_in_at: string | null
  estimator_prospects_access?: boolean
  estimator_service_type_ids?: string[] | null
  primary_service_type_ids?: string[] | null
  superintendent_service_type_ids?: string[] | null
  subcontractor_service_type_ids?: string[] | null
  archived_at?: string | null
}

type PersonRow = {
  id: string
  master_user_id: string
  kind: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  creator_name: string | null
  creator_email: string | null
  is_user: boolean
}

type EmailTemplate = {
  id: string
  template_type: 'invitation' | 'sign_in' | 'login_as' | 
    'stage_assigned_started' | 'stage_assigned_complete' | 'stage_assigned_reopened' |
    'stage_me_started' | 'stage_me_complete' | 'stage_me_reopened' |
    'stage_next_complete_or_approved' | 'stage_prior_rejected'
  subject: string
  body: string
  updated_at: string | null
}

type NotificationTemplateType = 'checklist_completed' | 'test_notification' |
  'stage_assigned_started' | 'stage_assigned_complete' | 'stage_assigned_reopened' |
  'stage_me_started' | 'stage_me_complete' | 'stage_me_reopened' |
  'stage_next_complete_or_approved' | 'stage_prior_rejected'

type NotificationTemplate = {
  id: string
  template_type: NotificationTemplateType
  push_title: string
  push_body: string
  updated_at: string | null
}

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface FixtureType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface AssemblyType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

const ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator', 'primary', 'superintendent']

type GoalPickerUserRow = { id: string; name: string | null; email: string | null }

/** Display label for Team Hours Sharing table (matches prior inline leader/member lookup). */
function displayLabelForGoalPickerUser(userId: string, users: GoalPickerUserRow[]): string {
  const u = users.find((x) => x.id === userId)
  return u?.name?.trim() || u?.email || userId
}

const PAGE_ACCESS: Array<{ page: string; dev: string; master: string; assistant: string; sub: string; estimator: string; primary: string; superintendent: string }> = [
  { page: 'Dashboard', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'yes', estimator: 'yes', primary: 'yes', superintendent: 'yes' },
  { page: 'Customers', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', estimator: 'no', primary: 'no', superintendent: 'no' },
  { page: 'Projects', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', estimator: 'no', primary: 'no', superintendent: 'yes' },
  { page: 'Workflow', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', estimator: 'no', primary: 'no', superintendent: 'yes limited' },
  { page: 'People', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', estimator: 'no', primary: 'no', superintendent: 'no' },
  { page: 'Jobs', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', estimator: 'no', primary: 'yes Reports only', superintendent: 'yes Stages Reports Billing Sub Ledger' },
  { page: 'Calendar', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', estimator: 'no', primary: 'yes', superintendent: 'yes' },
  { page: 'Bids', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', estimator: 'yes', primary: 'yes Bid Board, RFI, Change Order, Lien Release', superintendent: 'yes draft only' },
  { page: 'Materials', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', estimator: 'yes', primary: 'yes', superintendent: 'yes' },
  { page: 'Templates', dev: 'yes', master: 'no', assistant: 'no', sub: 'no', estimator: 'no', primary: 'no', superintendent: 'no' },
  { page: 'Settings', dev: 'yes', master: 'yes limited', assistant: 'no', sub: 'no', estimator: 'yes limited', primary: 'yes limited', superintendent: 'yes limited' },
]

const VARIABLE_HINT = '{{name}}, {{email}}, {{role}}, {{link}}'
const NOTIFICATION_VARIABLE_HINT = '{{assignee_name}}, {{item_title}}, {{name}}, {{stage_name}}, {{project_name}}, {{assigned_to_name}}, {{next_stage_name}}, {{rejection_reason}}'

/** Placeholder step id for send-workflow-notification test (no recipient_user_id → no notification_history insert). */
const WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID = '00000000-0000-4000-8000-000000000001'

type WorkflowFnEmailTemplateType = Exclude<
  EmailTemplate['template_type'],
  'invitation' | 'sign_in' | 'login_as'
>

const WORKFLOW_FN_EMAIL_TEST_OPTIONS: Array<{ type: WorkflowFnEmailTemplateType; label: string }> = [
  { type: 'stage_assigned_started', label: 'Stage Started (Assigned)' },
  { type: 'stage_assigned_complete', label: 'Stage Complete (Assigned)' },
  { type: 'stage_assigned_reopened', label: 'Stage Re-opened (Assigned)' },
  { type: 'stage_me_started', label: 'Stage Started (ME)' },
  { type: 'stage_me_complete', label: 'Stage Complete (ME)' },
  { type: 'stage_me_reopened', label: 'Stage Re-opened (ME)' },
  { type: 'stage_next_complete_or_approved', label: 'Next Stage Ready' },
  { type: 'stage_prior_rejected', label: 'Prior work incomplete' },
]

function substituteNotificationVariables(
  template: NotificationTemplate,
  targetUser: UserRow
): { title: string; body: string } {
  const displayName = targetUser.name?.trim() || targetUser.email || 'Test User'
  const replacements: Record<string, string> = {
    '{{assignee_name}}': displayName,
    '{{name}}': displayName,
    '{{assigned_to_name}}': displayName,
    '{{item_title}}': 'Sample checklist item',
    '{{stage_name}}': 'Sample stage',
    '{{project_name}}': 'Sample project',
    '{{next_stage_name}}': 'Next stage',
    '{{rejection_reason}}': 'Sample rejection reason',
  }
  const replaceAll = (s: string) => {
    let out = s
    for (const [key, val] of Object.entries(replacements)) {
      out = out.split(key).join(val)
    }
    return out
  }
  return {
    title: replaceAll(template.push_title),
    body: replaceAll(template.push_body),
  }
}

function timeSinceAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  return `${mo} mo ago`
}

function SettingsGroup({
  id,
  title,
  description,
  titleTrailing,
  children,
}: {
  id: string
  title: string
  description?: string
  titleTrailing?: React.ReactNode
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
        color: '#111827',
      }}
    >
      {title}
    </h2>
  )
  return (
    <section id={id} aria-labelledby={headingId} style={{ marginBottom: '2rem', scrollMarginTop: '0.75rem' }}>
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
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>{description}</p>
      ) : null}
      {children}
    </section>
  )
}

function SettingsJumpNav({ groups }: { groups: { id: string; label: string }[] }) {
  if (groups.length === 0) return null
  return (
    <nav aria-label="Settings sections" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>Jump to</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center' }}>
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(g.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}
          >
            {g.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function getSettingsJumpGroups(myRole: UserRole | null): { id: string; label: string }[] {
  if (myRole == null) return []
  const r = myRole
  const groups: { id: string; label: string }[] = []
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
  if (r !== 'subcontractor') groups.push({ id: 'settings-advanced-tools', label: 'Advanced' })
  return groups
}

const LAST_FULL_BACKUP_AT_KEY_PREFIX = 'pipetooling_last_full_backup_at'

function getLastFullBackupStorageKey(userId: string | undefined): string {
  return userId ? `${LAST_FULL_BACKUP_AT_KEY_PREFIX}_${userId}` : LAST_FULL_BACKUP_AT_KEY_PREFIX
}

/** Whole elapsed days since ISO timestamp; null if invalid. */
function wholeDaysSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const days = Math.floor((Date.now() - t) / 86400000)
  return Math.max(0, days)
}

export default function Settings() {
  const { user: authUser } = useAuth()
  const pushNotifications = usePushNotifications(authUser?.id)
  const { showToast } = useToastContext()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
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
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('master_technician')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualAddEmail, setManualAddEmail] = useState('')
  const [manualAddName, setManualAddName] = useState('')
  const [manualAddRole, setManualAddRole] = useState<UserRole>('master_technician')
  const [manualAddPassword, setManualAddPassword] = useState('')
  const [manualAddServiceTypeIds, setManualAddServiceTypeIds] = useState<string[]>([])
  const [manualAddError, setManualAddError] = useState<string | null>(null)
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteName, setDeleteName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteReassignOpen, setDeleteReassignOpen] = useState(false)
  const [deleteReassignUserId, setDeleteReassignUserId] = useState('')
  const [deleteReassignNewMasterId, setDeleteReassignNewMasterId] = useState('')
  const [deleteReassignSubmitting, setDeleteReassignSubmitting] = useState(false)
  const [deleteReassignError, setDeleteReassignError] = useState<string | null>(null)
  const [deleteReassignCustomerCount, setDeleteReassignCustomerCount] = useState<number>(0)
  const [archivedUsers, setArchivedUsers] = useState<UserRow[]>([])
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false)
  const [restoreSubmitting, setRestoreSubmitting] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoringUserId, setRestoringUserId] = useState<string | null>(null)
  const [sendingSignInEmailId, setSendingSignInEmailId] = useState<string | null>(null)
  const [setPasswordUser, setSetPasswordUser] = useState<UserRow | null>(null)
  const [setPasswordValue, setSetPasswordValue] = useState('')
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('')
  const [setPasswordSubmitting, setSetPasswordSubmitting] = useState(false)
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null)
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editEstimatorServiceTypeIds, setEditEstimatorServiceTypeIds] = useState<string[]>([])
  const [editEstimatorProspectsAccess, setEditEstimatorProspectsAccess] = useState(false)
  const [editPrimaryServiceTypeIds, setEditPrimaryServiceTypeIds] = useState<string[]>([])
  const [editSuperintendentServiceTypeIds, setEditSuperintendentServiceTypeIds] = useState<string[]>([])
  const [editSubcontractorServiceTypeIds, setEditSubcontractorServiceTypeIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [defaultLaborRate, setDefaultLaborRate] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const [myProfileName, setMyProfileName] = useState('')
  const [myProfileEmail, setMyProfileEmail] = useState('')
  const [myProfilePhone, setMyProfilePhone] = useState('')
  const [myProfileOriginalName, setMyProfileOriginalName] = useState('')
  const [myProfileSaving, setMyProfileSaving] = useState(false)
  const [myProfileError, setMyProfileError] = useState<string | null>(null)
  const [prospectCopyNoResponse, setProspectCopyNoResponse] = useState('')
  const [prospectCopyPhoneFollowup, setProspectCopyPhoneFollowup] = useState('')
  const [prospectCopyJustCheckingIn, setProspectCopyJustCheckingIn] = useState('')
  const [prospectCopyNoResponseSubject, setProspectCopyNoResponseSubject] = useState('')
  const [prospectCopyPhoneFollowupSubject, setProspectCopyPhoneFollowupSubject] = useState('')
  const [prospectCopyJustCheckingInSubject, setProspectCopyJustCheckingInSubject] = useState('')
  const [prospectCopySaving, setProspectCopySaving] = useState(false)
  const [prospectCopySectionOpen, setProspectCopySectionOpen] = useState(false)
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
  const [dashboardQuickButtonsPlacement, setDashboardQuickButtonsPlacement] = useState<'top' | 'with_pins'>('top')
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
  const [dashboardButtonsSectionOpen, setDashboardButtonsSectionOpen] = useState(false)
  const [salaryWorkdaySectionOpen, setSalaryWorkdaySectionOpen] = useState(true)
  const [dailyGoalsSectionOpen, setDailyGoalsSectionOpen] = useState(false)
  const [teamLeadAssignmentsSectionOpen, setTeamLeadAssignmentsSectionOpen] = useState(false)
  const [reportNotificationsSectionOpen, setReportNotificationsSectionOpen] = useState(false)
  const [defaultLaborRateSectionOpen, setDefaultLaborRateSectionOpen] = useState(false)
  const [dataBackupSectionOpen, setDataBackupSectionOpen] = useState(false)
  const [dispatchMemberIds, setDispatchMemberIds] = useState<Set<string>>(new Set())
  const [dispatchGroupError, setDispatchGroupError] = useState<string | null>(null)
  const [dispatchGroupSavingUserId, setDispatchGroupSavingUserId] = useState<string | null>(null)

  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [serviceTypeFormOpen, setServiceTypeFormOpen] = useState(false)
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null)
  const [serviceTypeName, setServiceTypeName] = useState('')
  const [serviceTypeDescription, setServiceTypeDescription] = useState('')
  const [serviceTypeColor, setServiceTypeColor] = useState('')
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
  type CountsFixtureGroup = { id: string; service_type_id: string; label: string; sequence_order: number }
  type CountsFixtureGroupItem = { id: string; group_id: string; name: string; sequence_order: number }
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

  const [convertMasterId, setConvertMasterId] = useState<string>('')
  const [convertNewMasterId, setConvertNewMasterId] = useState<string>('')
  const [convertNewRole, setConvertNewRole] = useState<'assistant' | 'subcontractor'>('assistant')
  const [convertAutoAdopt, setConvertAutoAdopt] = useState<boolean>(true)
  const [convertSubmitting, setConvertSubmitting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertMasterSectionOpen, setConvertMasterSectionOpen] = useState(false)
  const [jobOwnerOverridesSectionOpen, setJobOwnerOverridesSectionOpen] = useState(false)
  const [jobOwnerOverrideByUserId, setJobOwnerOverrideByUserId] = useState<Record<string, string>>({})
  const [jobOwnerOverridesSaving, setJobOwnerOverridesSaving] = useState(false)
  const [jobCountByUserId, setJobCountByUserId] = useState<Record<string, number>>({})
  const [reassignTargetByUserId, setReassignTargetByUserId] = useState<Record<string, string>>({})
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false)
  const [reassignSourceUserId, setReassignSourceUserId] = useState<string | null>(null)
  const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null)
  const [reassignSubmitting, setReassignSubmitting] = useState(false)
  const [activeAccountsSectionOpen, setActiveAccountsSectionOpen] = useState(false)
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
  const [editingNonUserPerson, setEditingNonUserPerson] = useState<PersonRow | null>(null)
  const [editPersonName, setEditPersonName] = useState('')
  const [editPersonEmail, setEditPersonEmail] = useState('')
  const [editPersonPhone, setEditPersonPhone] = useState('')
  const [editPersonNotes, setEditPersonNotes] = useState('')
  const [editPersonSaving, setEditPersonSaving] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null)
  const [convertSummary, setConvertSummary] = useState<string | null>(null)
  const [mergeDuplicatesModalOpen, setMergeDuplicatesModalOpen] = useState(false)
  const [mergeDuplicatesLoading, setMergeDuplicatesLoading] = useState(false)
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  const [exportProjectsLoading, setExportProjectsLoading] = useState(false)
  const [exportMaterialsLoading, setExportMaterialsLoading] = useState(false)
  const [exportBidsLoading, setExportBidsLoading] = useState(false)
  const [exportPeopleLoading, setExportPeopleLoading] = useState(false)
  const [exportJobsLoading, setExportJobsLoading] = useState(false)
  const [exportChecklistLoading, setExportChecklistLoading] = useState(false)
  const [exportReportsLoading, setExportReportsLoading] = useState(false)
  const [exportProspectsLoading, setExportProspectsLoading] = useState(false)
  const [exportSettingsLoading, setExportSettingsLoading] = useState(false)
  const [exportAllLoading, setExportAllLoading] = useState(false)
  const [lastFullBackupAtIso, setLastFullBackupAtIso] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
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

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

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

  async function exportProjectsBackup() {
    setExportError(null)
    setExportProjectsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8,
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('project_workflows').select('*'),
        supabase.from('project_workflow_steps').select('*'),
        supabase.from('project_workflow_step_actions').select('*'),
        supabase.from('step_subscriptions').select('*'),
        supabase.from('workflow_step_line_items').select('*'),
        supabase.from('workflow_projections').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          customers: r1.data ?? [],
          projects: r2.data ?? [],
          project_workflows: r3.data ?? [],
          project_workflow_steps: r4.data ?? [],
          project_workflow_step_actions: r5.data ?? [],
          step_subscriptions: r6.data ?? [],
          workflow_step_line_items: r7.data ?? [],
          workflow_projections: r8.data ?? [],
        },
      }
      downloadJson(`projects-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportProjectsLoading(false)
    }
  }

  async function exportMaterialsBackup() {
    setExportError(null)
    setExportMaterialsLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from('supply_houses').select('*'),
        supabase.from('material_parts').select('*'),
        supabase.from('material_part_prices').select('*'),
        supabase.from('material_templates').select('*'),
        supabase.from('material_template_items').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          supply_houses: r1.data ?? [],
          material_parts: r2.data ?? [],
          material_part_prices: r3.data ?? [],
          material_templates: r4.data ?? [],
          material_template_items: r5.data ?? [],
        },
      }
      downloadJson(`materials-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportMaterialsLoading(false)
    }
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

  async function exportBidsBackup() {
    setExportError(null)
    setExportBidsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16,
      ] = await Promise.all([
        supabase.from('bids').select('*'),
        supabase.from('bids_gc_builders').select('*'),
        supabase.from('bids_count_rows').select('*'),
        supabase.from('bids_submission_entries').select('*'),
        supabase.from('cost_estimates').select('*'),
        supabase.from('cost_estimate_labor_rows').select('*'),
        supabase.from('fixture_labor_defaults').select('*'),
        supabase.from('bid_pricing_assignments').select('*'),
        supabase.from('price_book_versions').select('*'),
        supabase.from('price_book_entries').select('*'),
        supabase.from('labor_book_versions').select('*'),
        supabase.from('labor_book_entries').select('*'),
        supabase.from('takeoff_book_versions').select('*'),
        supabase.from('takeoff_book_entries').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('purchase_order_items').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          bids: r1.data ?? [],
          bids_gc_builders: r2.data ?? [],
          bids_count_rows: r3.data ?? [],
          bids_submission_entries: r4.data ?? [],
          cost_estimates: r5.data ?? [],
          cost_estimate_labor_rows: r6.data ?? [],
          fixture_labor_defaults: r7.data ?? [],
          bid_pricing_assignments: r8.data ?? [],
          price_book_versions: r9.data ?? [],
          price_book_entries: r10.data ?? [],
          labor_book_versions: r11.data ?? [],
          labor_book_entries: r12.data ?? [],
          takeoff_book_versions: r13.data ?? [],
          takeoff_book_entries: r14.data ?? [],
          purchase_orders: r15.data ?? [],
          purchase_order_items: r16.data ?? [],
        },
      }
      downloadJson(`bids-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportBidsLoading(false)
    }
  }

  async function exportPeopleBackup() {
    setExportError(null)
    setExportPeopleLoading(true)
    try {
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('people').select('*'),
        supabase.from('master_assistants').select('*'),
        supabase.from('master_shares').select('*'),
        supabase.from('master_primaries').select('*'),
        supabase.from('master_superintendents').select('*'),
        supabase.from('pay_approved_masters').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          users: r1.data ?? [],
          people: r2.data ?? [],
          master_assistants: r3.data ?? [],
          master_shares: r4.data ?? [],
          master_primaries: r5.data ?? [],
          master_superintendents: r6.data ?? [],
          pay_approved_masters: r7.data ?? [],
        },
      }
      downloadJson(`people-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportPeopleLoading(false)
    }
  }

  async function exportJobsBackup() {
    setExportError(null)
    setExportJobsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15,
      ] = await Promise.all([
        supabase.from('jobs_ledger').select('*'),
        supabase.from('jobs_ledger_fixtures').select('*'),
        supabase.from('jobs_ledger_materials').select('*'),
        supabase.from('jobs_ledger_team_members').select('*'),
        supabase.from('people_labor_jobs').select('*'),
        supabase.from('people_labor_job_items').select('*'),
        supabase.from('people_crew_jobs').select('*'),
        supabase.from('people_teams').select('*'),
        supabase.from('people_team_members').select('*'),
        supabase.from('people_hours').select('*'),
        supabase.from('people_hours_display_order').select('*'),
        supabase.from('people_pay_config').select('*'),
        supabase.from('jobs_receivables').select('*'),
        supabase.from('jobs_tally_parts').select('*'),
        supabase.from('supply_house_invoices').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          jobs_ledger: r1.data ?? [],
          jobs_ledger_fixtures: r2.data ?? [],
          jobs_ledger_materials: r3.data ?? [],
          jobs_ledger_team_members: r4.data ?? [],
          people_labor_jobs: r5.data ?? [],
          people_labor_job_items: r6.data ?? [],
          people_crew_jobs: r7.data ?? [],
          people_teams: r8.data ?? [],
          people_team_members: r9.data ?? [],
          people_hours: r10.data ?? [],
          people_hours_display_order: r11.data ?? [],
          people_pay_config: r12.data ?? [],
          jobs_receivables: r13.data ?? [],
          jobs_tally_parts: r14.data ?? [],
          supply_house_invoices: r15.data ?? [],
        },
      }
      downloadJson(`jobs-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportJobsLoading(false)
    }
  }

  async function exportChecklistBackup() {
    setExportError(null)
    setExportChecklistLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('checklist_items').select('*'),
        supabase.from('checklist_instances').select('*'),
      ])
      const err = r1.error || r2.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          checklist_items: r1.data ?? [],
          checklist_instances: r2.data ?? [],
        },
      }
      downloadJson(`checklist-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportChecklistLoading(false)
    }
  }

  async function exportReportsBackup() {
    setExportError(null)
    setExportReportsLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from('reports').select('*'),
        supabase.from('report_templates').select('*'),
        supabase.from('report_template_fields').select('*'),
        supabase.from('report_enabled_users').select('*'),
        supabase.from('user_report_notification_preferences').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          reports: r1.data ?? [],
          report_templates: r2.data ?? [],
          report_template_fields: r3.data ?? [],
          report_enabled_users: r4.data ?? [],
          user_report_notification_preferences: r5.data ?? [],
        },
      }
      downloadJson(`reports-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportReportsLoading(false)
    }
  }

  async function exportProspectsBackup() {
    setExportError(null)
    setExportProspectsLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.from('prospects').select('*'),
        supabase.from('prospect_callbacks').select('*'),
        supabase.from('prospect_comments').select('*'),
      ])
      const err = r1.error || r2.error || r3.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          prospects: r1.data ?? [],
          prospect_callbacks: r2.data ?? [],
          prospect_comments: r3.data ?? [],
        },
      }
      downloadJson(`prospects-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportProspectsLoading(false)
    }
  }

  async function exportSettingsBackup() {
    setExportError(null)
    setExportSettingsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12,
      ] = await Promise.all([
        supabase.from('app_settings').select('*'),
        supabase.from('workflow_templates').select('*'),
        supabase.from('workflow_template_steps').select('*'),
        supabase.from('workflow_step_dependencies').select('*'),
        supabase.from('service_types').select('*'),
        supabase.from('fixture_types').select('*'),
        supabase.from('part_types').select('*'),
        supabase.from('assembly_types').select('*'),
        supabase.from('counts_fixture_groups').select('*'),
        supabase.from('counts_fixture_group_items').select('*'),
        supabase.from('notification_templates').select('*'),
        supabase.from('email_templates').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          app_settings: r1.data ?? [],
          workflow_templates: r2.data ?? [],
          workflow_template_steps: r3.data ?? [],
          workflow_step_dependencies: r4.data ?? [],
          service_types: r5.data ?? [],
          fixture_types: r6.data ?? [],
          part_types: r7.data ?? [],
          assembly_types: r8.data ?? [],
          counts_fixture_groups: r9.data ?? [],
          counts_fixture_group_items: r10.data ?? [],
          notification_templates: r11.data ?? [],
          email_templates: r12.data ?? [],
        },
      }
      downloadJson(`settings-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportSettingsLoading(false)
    }
  }

  async function exportAllBackup() {
    setExportError(null)
    setExportAllLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8,
        r9, r10, r11, r12, r13, r14, r15, r16,
        r17, r18, r19, r20, r21, r22, r23, r24, r25, r26,
        r27, r28, r29, r30, r31, r32, r33, r34,
        r35, r36, r37, r38, r39, r40, r41, r42, r43, r44,
        r45, r46, r47, r48, r49, r50, r51, r52, r53,
        r54, r55, r56, r57, r58, r59, r60, r61, r62, r63,
        r64, r65, r66, r67, r68, r69, r70, r71, r72,
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('project_workflows').select('*'),
        supabase.from('project_workflow_steps').select('*'),
        supabase.from('project_workflow_step_actions').select('*'),
        supabase.from('step_subscriptions').select('*'),
        supabase.from('workflow_step_line_items').select('*'),
        supabase.from('workflow_projections').select('*'),
        supabase.from('supply_houses').select('*'),
        supabase.from('material_parts').select('*'),
        supabase.from('material_part_prices').select('*'),
        supabase.from('material_templates').select('*'),
        supabase.from('material_template_items').select('*'),
        supabase.from('bids').select('*'),
        supabase.from('bids_gc_builders').select('*'),
        supabase.from('bids_count_rows').select('*'),
        supabase.from('bids_submission_entries').select('*'),
        supabase.from('cost_estimates').select('*'),
        supabase.from('cost_estimate_labor_rows').select('*'),
        supabase.from('fixture_labor_defaults').select('*'),
        supabase.from('bid_pricing_assignments').select('*'),
        supabase.from('price_book_versions').select('*'),
        supabase.from('price_book_entries').select('*'),
        supabase.from('labor_book_versions').select('*'),
        supabase.from('labor_book_entries').select('*'),
        supabase.from('takeoff_book_versions').select('*'),
        supabase.from('takeoff_book_entries').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('purchase_order_items').select('*'),
        supabase.from('users').select('*'),
        supabase.from('people').select('*'),
        supabase.from('master_assistants').select('*'),
        supabase.from('master_shares').select('*'),
        supabase.from('master_primaries').select('*'),
        supabase.from('pay_approved_masters').select('*'),
        supabase.from('jobs_ledger').select('*'),
        supabase.from('jobs_ledger_fixtures').select('*'),
        supabase.from('jobs_ledger_materials').select('*'),
        supabase.from('jobs_ledger_team_members').select('*'),
        supabase.from('people_labor_jobs').select('*'),
        supabase.from('people_labor_job_items').select('*'),
        supabase.from('people_crew_jobs').select('*'),
        supabase.from('people_teams').select('*'),
        supabase.from('people_team_members').select('*'),
        supabase.from('people_hours').select('*'),
        supabase.from('people_hours_display_order').select('*'),
        supabase.from('people_pay_config').select('*'),
        supabase.from('jobs_receivables').select('*'),
        supabase.from('jobs_tally_parts').select('*'),
        supabase.from('supply_house_invoices').select('*'),
        supabase.from('checklist_items').select('*'),
        supabase.from('checklist_instances').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('report_templates').select('*'),
        supabase.from('report_template_fields').select('*'),
        supabase.from('report_enabled_users').select('*'),
        supabase.from('user_report_notification_preferences').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('prospect_callbacks').select('*'),
        supabase.from('prospect_comments').select('*'),
        supabase.from('app_settings').select('*'),
        supabase.from('workflow_templates').select('*'),
        supabase.from('workflow_template_steps').select('*'),
        supabase.from('workflow_step_dependencies').select('*'),
        supabase.from('service_types').select('*'),
        supabase.from('fixture_types').select('*'),
        supabase.from('part_types').select('*'),
        supabase.from('assembly_types').select('*'),
        supabase.from('counts_fixture_groups').select('*'),
        supabase.from('counts_fixture_group_items').select('*'),
        supabase.from('notification_templates').select('*'),
        supabase.from('email_templates').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error || r17.error || r18.error || r19.error || r20.error || r21.error || r22.error || r23.error || r24.error || r25.error || r26.error || r27.error || r28.error || r29.error || r30.error || r31.error || r32.error || r33.error || r34.error || r35.error || r36.error || r37.error || r38.error || r39.error || r40.error || r41.error || r42.error || r43.error || r44.error || r45.error || r46.error || r47.error || r48.error || r49.error || r50.error || r51.error || r52.error || r53.error || r54.error || r55.error || r56.error || r57.error || r58.error || r59.error || r60.error || r61.error || r62.error || r63.error || r64.error || r65.error || r66.error || r67.error || r68.error || r69.error || r70.error || r71.error || r72.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          customers: r1.data ?? [],
          projects: r2.data ?? [],
          project_workflows: r3.data ?? [],
          project_workflow_steps: r4.data ?? [],
          project_workflow_step_actions: r5.data ?? [],
          step_subscriptions: r6.data ?? [],
          workflow_step_line_items: r7.data ?? [],
          workflow_projections: r8.data ?? [],
          supply_houses: r9.data ?? [],
          material_parts: r10.data ?? [],
          material_part_prices: r11.data ?? [],
          material_templates: r12.data ?? [],
          material_template_items: r13.data ?? [],
          bids: r14.data ?? [],
          bids_gc_builders: r15.data ?? [],
          bids_count_rows: r16.data ?? [],
          bids_submission_entries: r17.data ?? [],
          cost_estimates: r18.data ?? [],
          cost_estimate_labor_rows: r19.data ?? [],
          fixture_labor_defaults: r20.data ?? [],
          bid_pricing_assignments: r21.data ?? [],
          price_book_versions: r22.data ?? [],
          price_book_entries: r23.data ?? [],
          labor_book_versions: r24.data ?? [],
          labor_book_entries: r25.data ?? [],
          takeoff_book_versions: r26.data ?? [],
          takeoff_book_entries: r27.data ?? [],
          purchase_orders: r28.data ?? [],
          purchase_order_items: r29.data ?? [],
          users: r30.data ?? [],
          people: r31.data ?? [],
          master_assistants: r32.data ?? [],
          master_shares: r33.data ?? [],
          master_primaries: r34.data ?? [],
          pay_approved_masters: r35.data ?? [],
          jobs_ledger: r36.data ?? [],
          jobs_ledger_fixtures: r37.data ?? [],
          jobs_ledger_materials: r38.data ?? [],
          jobs_ledger_team_members: r39.data ?? [],
          people_labor_jobs: r40.data ?? [],
          people_labor_job_items: r41.data ?? [],
          people_crew_jobs: r42.data ?? [],
          people_teams: r43.data ?? [],
          people_team_members: r44.data ?? [],
          people_hours: r45.data ?? [],
          people_hours_display_order: r46.data ?? [],
          people_pay_config: r47.data ?? [],
          jobs_receivables: r48.data ?? [],
          jobs_tally_parts: r49.data ?? [],
          supply_house_invoices: r50.data ?? [],
          checklist_items: r51.data ?? [],
          checklist_instances: r52.data ?? [],
          reports: r53.data ?? [],
          report_templates: r54.data ?? [],
          report_template_fields: r55.data ?? [],
          report_enabled_users: r56.data ?? [],
          user_report_notification_preferences: r57.data ?? [],
          prospects: r58.data ?? [],
          prospect_callbacks: r59.data ?? [],
          prospect_comments: r60.data ?? [],
          app_settings: r61.data ?? [],
          workflow_templates: r62.data ?? [],
          workflow_template_steps: r63.data ?? [],
          workflow_step_dependencies: r64.data ?? [],
          service_types: r65.data ?? [],
          fixture_types: r66.data ?? [],
          part_types: r67.data ?? [],
          assembly_types: r68.data ?? [],
          counts_fixture_groups: r69.data ?? [],
          counts_fixture_group_items: r70.data ?? [],
          notification_templates: r71.data ?? [],
          email_templates: r72.data ?? [],
        },
      }
      downloadJson(`full-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
      const backupKey = getLastFullBackupStorageKey(authUser?.id)
      const nowIso = new Date().toISOString()
      try {
        localStorage.setItem(backupKey, nowIso)
      } catch {
        /* quota or private mode */
      }
      setLastFullBackupAtIso(nowIso)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportAllLoading(false)
    }
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
    const rows = await getUsersWithPin('/people', 'pay')
    setPinCostMatrixMasterIds(new Set(rows.map((r) => r.user_id)))
  }

  async function loadData() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids, estimator_prospects_access, name, email, phone')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
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
    
    // Load assistants, primaries, superintendents, and adoptions for masters and devs
    if (role === 'master_technician' || role === 'dev') {
      await loadAssistantsAndAdoptions(authUser.id)
      await loadPrimariesAndAdoptions(authUser.id)
      await loadSuperintendentsAndAdoptions(authUser.id)
      await loadMastersAndShares(authUser.id)
    }
    
    // Load dashboard button visibility for dev, master, assistant
    if (role === 'dev' || role === 'master_technician' || role === 'assistant') {
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
      setDashboardQuickButtonsPlacement(placement === 'with_pins' ? 'with_pins' : 'top')

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
      .select('id, email, name, role, last_sign_in_at, estimator_prospects_access, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids')
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
      await loadNotificationTemplates()
      await loadEmailTemplates()
      await loadPayApprovedMasters()
      const { data: appSettings } = await supabase.from('app_settings').select('key, value_num').eq('key', 'default_labor_rate').maybeSingle()
      const val = (appSettings as { value_num: number | null } | null)?.value_num
      setDefaultLaborRate(val != null ? String(val) : '')
      const { data: prospectCopyRows } = await supabase.from('app_settings').select('key, value_text').in('key', [
        'prospect_copy_no_response_email', 'prospect_copy_phone_followup_email', 'prospect_copy_just_checking_in_email',
        'prospect_copy_no_response_email_subject', 'prospect_copy_phone_followup_email_subject', 'prospect_copy_just_checking_in_email_subject',
      ])
      const prospectCopyByKey = new Map((prospectCopyRows ?? []).map((r: { key: string; value_text: string | null }) => [r.key, r.value_text ?? '']))
      setProspectCopyNoResponse(prospectCopyByKey.get('prospect_copy_no_response_email') ?? '')
      setProspectCopyPhoneFollowup(prospectCopyByKey.get('prospect_copy_phone_followup_email') ?? '')
      setProspectCopyJustCheckingIn(prospectCopyByKey.get('prospect_copy_just_checking_in_email') ?? '')
      setProspectCopyNoResponseSubject(prospectCopyByKey.get('prospect_copy_no_response_email_subject') ?? '')
      setProspectCopyPhoneFollowupSubject(prospectCopyByKey.get('prospect_copy_phone_followup_email_subject') ?? '')
      setProspectCopyJustCheckingInSubject(prospectCopyByKey.get('prospect_copy_just_checking_in_email_subject') ?? '')
      const { data: reportSettings } = await supabase.from('app_settings').select('key, value_num').in('key', ['report_edit_window_days', 'report_sub_visibility_months'])
      const byKey = new Map((reportSettings ?? []).map((r: { key: string; value_num: number | null }) => [r.key, r.value_num ?? 0]))
      setReportEditWindowDays(String(byKey.get('report_edit_window_days') ?? 2))
      setReportSubVisibilityMonths(String(byKey.get('report_sub_visibility_months') ?? 3))
      const { data: enabled } = await supabase.from('report_enabled_users').select('user_id')
      setReportEnabledUserIds(new Set((enabled ?? []).map((r: { user_id: string }) => r.user_id)))
      const { data: dgm, error: dgmErr } = await supabase.from('dispatch_group_members').select('user_id')
      if (dgmErr) setError(dgmErr.message)
      else setDispatchMemberIds(new Set((dgm ?? []).map((r: { user_id: string }) => r.user_id)))
      const { data: jobOwnerOverrides } = await supabase.from('app_settings').select('key, value_text').like('key', 'job_owner_override_%')
      const overrides: Record<string, string> = {}
      for (const row of jobOwnerOverrides ?? []) {
        const userId = row.key.replace(/^job_owner_override_/, '')
        if (userId && row.value_text) overrides[userId] = row.value_text
      }
      setJobOwnerOverrideByUserId(overrides)
      const { data: jobCountRows } = await supabase.from('jobs_ledger').select('master_user_id')
      const counts: Record<string, number> = {}
      for (const row of jobCountRows ?? []) {
        const id = (row as { master_user_id: string }).master_user_id
        if (id) counts[id] = (counts[id] ?? 0) + 1
      }
      setJobCountByUserId(counts)
      await loadArchivedUsers()
    }
    
    setLoading(false)
  }

  async function loadArchivedUsers() {
    if (!authUser?.id) return
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role, archived_at')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    setArchivedUsers((data as UserRow[]) ?? [])
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

  async function saveJobOwnerOverrides(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') return
    setJobOwnerOverridesSaving(true)
    try {
      const creators = users.filter((u) => ['dev', 'master_technician', 'assistant'].includes(u.role))
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
    const canEditName = myRole !== 'subcontractor'
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
    if (!authUser?.id || (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant')) return
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
      .eq('role', 'assistant')
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
    setServiceTypeError(null)
    setServiceTypeFormOpen(true)
  }

  function closeEditServiceType() {
    setEditingServiceType(null)
    setServiceTypeName('')
    setServiceTypeDescription('')
    setServiceTypeColor('')
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
    
    if (editingServiceType) {
      // Update existing service type
      const { error: e } = await supabase
        .from('service_types' as any)
        .update({
          name: serviceTypeName.trim(),
          description: serviceTypeDescription.trim() || null,
          color: serviceTypeColor.trim() || null,
        } as any)
        .eq('id', editingServiceType.id)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
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
          sequence_order: maxSeq + 1,
        } as any)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
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

  const showMyReports = myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'primary' || myRole === 'subcontractor'

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
        const list = arr.map((r: { id: string; template_id: string; template_name: string; job_display_name: string; job_ledger_id?: string | null; project_id?: string | null; created_at: string; created_by_name: string; field_values?: unknown; reported_at_lat?: number | null; reported_at_lng?: number | null }) => ({
          id: r.id,
          template_id: r.template_id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          job_ledger_id: r.job_ledger_id ?? null,
          project_id: r.project_id ?? null,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          field_values: r.field_values as Record<string, string> | undefined,
          reported_at_lat: r.reported_at_lat ?? null,
          reported_at_lng: r.reported_at_lng ?? null,
        }))
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
    if (deleteReassignUserId) {
      loadCustomerCount(deleteReassignUserId)
    }
  }, [deleteReassignUserId])

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

  async function updateRole(id: string, role: UserRole) {
    setUpdatingId(id)
    setError(null)
    const { error: e } = await supabase.from('users').update({ role }).eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    }
    setUpdatingId(null)
  }

  function startEditUser(u: UserRow) {
    setEditingUserId(u.id)
    setEditEmail(u.email)
    setEditName(u.name)
    setEditEstimatorProspectsAccess(u.role === 'estimator' && !!u.estimator_prospects_access)
    setEditEstimatorServiceTypeIds(u.role === 'estimator' ? (u.estimator_service_type_ids ?? []) : [])
    setEditPrimaryServiceTypeIds(u.role === 'primary' ? (u.primary_service_type_ids ?? []) : [])
    setEditSuperintendentServiceTypeIds(u.role === 'superintendent' ? (u.superintendent_service_type_ids ?? []) : [])
    setEditSubcontractorServiceTypeIds(u.role === 'subcontractor' ? (u.subcontractor_service_type_ids ?? []) : [])
    setEditError(null)
  }

  function cancelEditUser() {
    setEditingUserId(null)
    setEditEmail('')
    setEditName('')
    setEditEstimatorProspectsAccess(false)
    setEditEstimatorServiceTypeIds([])
    setEditPrimaryServiceTypeIds([])
    setEditSuperintendentServiceTypeIds([])
    setEditSubcontractorServiceTypeIds([])
    setEditError(null)
  }

  async function updateUserProfile(
    id: string,
    updates: {
      name: string
      email: string
      estimator_service_type_ids?: string[] | null
      estimator_prospects_access?: boolean
      primary_service_type_ids?: string[] | null
      superintendent_service_type_ids?: string[] | null
      subcontractor_service_type_ids?: string[] | null
    },
    oldName?: string,
    userEmail?: string | null
  ) {
    setUpdatingId(id)
    setError(null)
    setEditError(null)
    const updatePayload: Record<string, unknown> = { name: updates.name, email: updates.email }
    if (updates.estimator_service_type_ids !== undefined) {
      updatePayload.estimator_service_type_ids = updates.estimator_service_type_ids?.length ? updates.estimator_service_type_ids : null
    }
    if (updates.estimator_prospects_access !== undefined) {
      updatePayload.estimator_prospects_access = updates.estimator_prospects_access
    }
    if (updates.primary_service_type_ids !== undefined) {
      updatePayload.primary_service_type_ids = updates.primary_service_type_ids?.length ? updates.primary_service_type_ids : null
    }
    if (updates.superintendent_service_type_ids !== undefined) {
      updatePayload.superintendent_service_type_ids = updates.superintendent_service_type_ids?.length ? updates.superintendent_service_type_ids : null
    }
    if (updates.subcontractor_service_type_ids !== undefined) {
      updatePayload.subcontractor_service_type_ids = updates.subcontractor_service_type_ids?.length ? updates.subcontractor_service_type_ids : null
    }
    try {
      await withSupabaseRetry(
        async () => supabase.from('users').update(updatePayload).eq('id', id).select('id').maybeSingle(),
        'update user profile',
      )
    } catch (e) {
      setEditError(formatErrorMessage(e))
      setUpdatingId(null)
      return
    }
    if (oldName != null && oldName.trim() !== updates.name.trim()) {
      const fromDb = await getPersonNamesForUser(id, userEmail ?? null)
      const namesToCascade = new Set([oldName.trim(), ...fromDb.map((n) => n.trim()).filter(Boolean)])
      const trimmedNew = updates.name.trim()
      for (const name of namesToCascade) {
        if (name?.trim() && name.trim() !== trimmedNew) {
          await cascadePersonNameInPayTables(name.trim(), trimmedNew)
        }
      }
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              name: updates.name,
              email: updates.email,
              ...(updates.estimator_service_type_ids !== undefined ? { estimator_service_type_ids: updates.estimator_service_type_ids } : {}),
              ...(updates.estimator_prospects_access !== undefined ? { estimator_prospects_access: updates.estimator_prospects_access } : {}),
              ...(updates.primary_service_type_ids !== undefined ? { primary_service_type_ids: updates.primary_service_type_ids } : {}),
              ...(updates.superintendent_service_type_ids !== undefined ? { superintendent_service_type_ids: updates.superintendent_service_type_ids } : {}),
              ...(updates.subcontractor_service_type_ids !== undefined ? { subcontractor_service_type_ids: updates.subcontractor_service_type_ids } : {}),
            }
          : u
      ),
    )
    setUpdatingId(null)
  }

  async function saveUserEdits() {
    if (!editingUserId) return
    const trimmedEmail = editEmail.trim()
    const trimmedName = editName.trim()
    const editingUser = users.find((u) => u.id === editingUserId)

    if (!trimmedEmail) {
      setEditError('Email is required.')
      return
    }

    if (trimmedName) {
      const isDuplicate = await checkDuplicateName(trimmedName, editingUserId)
      if (isDuplicate) {
        setEditError(
          `A person or user with the name "${trimmedName}" already exists. Names must be unique.`,
        )
        return
      }
    }

    const updates: {
      name: string
      email: string
      estimator_service_type_ids?: string[] | null
      estimator_prospects_access?: boolean
      primary_service_type_ids?: string[] | null
      superintendent_service_type_ids?: string[] | null
      subcontractor_service_type_ids?: string[] | null
    } = {
      name: trimmedName,
      email: trimmedEmail,
    }
    if (editingUser?.role === 'estimator') {
      updates.estimator_service_type_ids = editEstimatorServiceTypeIds.length > 0 ? editEstimatorServiceTypeIds : null
      updates.estimator_prospects_access = editEstimatorProspectsAccess
    }
    if (editingUser?.role === 'primary') {
      updates.primary_service_type_ids = editPrimaryServiceTypeIds.length > 0 ? editPrimaryServiceTypeIds : null
    }
    if (editingUser?.role === 'superintendent') {
      updates.superintendent_service_type_ids = editSuperintendentServiceTypeIds.length > 0 ? editSuperintendentServiceTypeIds : null
    }
    if (editingUser?.role === 'subcontractor') {
      updates.subcontractor_service_type_ids = editSubcontractorServiceTypeIds.length > 0 ? editSubcontractorServiceTypeIds : null
    }
    await updateUserProfile(editingUserId, updates, editingUser?.name, editingUser?.email)
    setEditingUserId(null)
    setEditEmail('')
    setEditName('')
    setEditEstimatorProspectsAccess(false)
    setEditEstimatorServiceTypeIds([])
    setEditPrimaryServiceTypeIds([])
    setEditSubcontractorServiceTypeIds([])
    setEditError(null)
  }

  async function sendSignInEmail(u: UserRow) {
    setSendingSignInEmailId(u.id)
    setError(null)
    const redirectTo = new URL('dashboard', window.location.href).href
    const { error: e } = await supabase.auth.signInWithOtp({
      email: u.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    })
    if (e) setError(e.message)
    setSendingSignInEmailId(null)
  }

  function openInvite() {
    setInviteOpen(true)
    setInviteEmail('')
    setInviteRole('master_technician')
    setInviteName('')
    setInviteError(null)
  }

  function closeInvite() {
    setInviteOpen(false)
  }

  function openManualAdd() {
    setManualAddOpen(true)
    setManualAddEmail('')
    setManualAddName('')
    setManualAddRole('master_technician')
    setManualAddPassword('')
    setManualAddServiceTypeIds([])
    setManualAddError(null)
  }

  function closeManualAdd() {
    setManualAddOpen(false)
  }

  function openArchive() {
    setDeleteOpen(true)
    setDeleteEmail('')
    setDeleteName('')
    setDeleteError(null)
  }

  function closeArchive() {
    setDeleteOpen(false)
  }

  function openArchiveReassign() {
    setDeleteReassignOpen(true)
    setDeleteReassignUserId('')
    setDeleteReassignNewMasterId('')
    setDeleteReassignCustomerCount(0)
    setDeleteReassignError(null)
  }

  function closeArchiveReassign() {
    setDeleteReassignOpen(false)
  }

  async function loadCustomerCount(userId: string) {
    if (!userId) {
      setDeleteReassignCustomerCount(0)
      return
    }
    
    const { count, error } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('master_user_id', userId)
    
    if (!error && count !== null) {
      setDeleteReassignCustomerCount(count)
    }
  }

  async function handleArchiveReassign(e: React.FormEvent) {
    e.preventDefault()
    setDeleteReassignError(null)
    
    if (!deleteReassignUserId || !deleteReassignNewMasterId) {
      setDeleteReassignError('Please select both users')
      return
    }
    
    if (deleteReassignUserId === deleteReassignNewMasterId) {
      setDeleteReassignError('Cannot reassign to the same user')
      return
    }
    
    const userToArchive = users.find(u => u.id === deleteReassignUserId)
    if (!userToArchive) {
      setDeleteReassignError('User to archive not found')
      return
    }
    
    setDeleteReassignSubmitting(true)
    
    const { data, error: eFn } = await supabase.functions.invoke('archive-user', {
      body: { 
        email: userToArchive.email, 
        name: userToArchive.name,
        reassign_customers_to: deleteReassignNewMasterId 
      },
    })
    
    setDeleteReassignSubmitting(false)
    
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        msg = (eFn.context.json as { error?: string }).error || msg
      }
      setDeleteReassignError(msg)
      return
    }
    
    if (data?.error) {
      setDeleteReassignError(data.error)
      return
    }
    
    closeArchiveReassign()
    await loadData()
  }

  async function handleRestore(userId: string) {
    setRestoreError(null)
    setRestoringUserId(userId)
    setRestoreSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('restore-user', {
      body: { user_id: userId },
    })
    setRestoreSubmitting(false)
    setRestoringUserId(null)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        msg = (eFn.context.json as { error?: string }).error || msg
      }
      setRestoreError(msg)
      return
    }
    if (data?.error) {
      setRestoreError(data.error)
      return
    }
    await loadData()
  }

  function closeSetPassword() {
    setSetPasswordUser(null)
    setSetPasswordValue('')
    setSetPasswordConfirm('')
    setSetPasswordError(null)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!setPasswordUser) return
    setSetPasswordError(null)
    if (setPasswordValue !== setPasswordConfirm) {
      setSetPasswordError('Passwords do not match.')
      return
    }
    if (setPasswordValue.length < 6) {
      setSetPasswordError('Password must be at least 6 characters.')
      return
    }
    setSetPasswordSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('set-user-password', {
      body: { user_id: setPasswordUser.id, password: setPasswordValue },
    })
    setSetPasswordSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setSetPasswordError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setSetPasswordError(err)
      return
    }
    closeSetPassword()
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

  async function handleArchive(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    if (!deleteEmail.trim() && !deleteName.trim()) {
      setDeleteError('Enter an email or name.')
      return
    }
    setDeleteSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('archive-user', {
      body: { email: deleteEmail.trim(), name: deleteName.trim() },
    })
    setDeleteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setDeleteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setDeleteError(err)
      return
    }
    closeArchive()
    await loadData()
  }

  async function openFindDuplicatesModal() {
    setMergeDuplicatesModalOpen(true)
    setMergeDuplicatesLoading(true)
    try {
      const { data } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
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
      const { data } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
      const payConfig: Record<string, PayConfigRowForMerge> = {}
      for (const r of (data ?? []) as PayConfigRowForMerge[]) {
        payConfig[r.person_name] = r
      }
      await mergePersonIntoUser(dup.personName, dup.userDisplayName, payConfig, userId)
      await loadData()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  async function handleConvertMaster(e: React.FormEvent) {
    e.preventDefault()
    setConvertError(null)
    setConvertSummary(null)

    if (!convertMasterId || !convertNewMasterId) {
      setConvertError('Please select both the master to convert and the new master owner.')
      return
    }
    if (convertMasterId === convertNewMasterId) {
      setConvertError('The new master owner must be different from the master being converted.')
      return
    }

    const masterUser = users.find((u) => u.id === convertMasterId)
    const newMasterUser = users.find((u) => u.id === convertNewMasterId)

    const masterLabel = masterUser?.name || masterUser?.email || 'Selected master'
    const newMasterLabel = newMasterUser?.name || newMasterUser?.email || 'New master'
    const roleLabel = convertNewRole === 'assistant' ? 'assistant' : 'subcontractor'

    const confirmed = window.confirm(
      `Convert "${masterLabel}" from master to ${roleLabel} and reassign all of their customers, projects, and people to "${newMasterLabel}"? This cannot easily be undone.`
    )
    if (!confirmed) return

    setConvertSubmitting(true)
    try {
      const { data, error } = await (supabase as any).rpc('convert_master_user', {
        old_master_id: convertMasterId,
        new_master_id: convertNewMasterId,
        new_role: convertNewRole,
        auto_adopt: convertAutoAdopt,
      })
      if (error) {
        setConvertError(error.message)
        return
      }
      const result = (data as {
        customers_moved?: number
        projects_moved?: number
        people_moved?: number
        new_role?: string
      }) || {}
      const c = result.customers_moved ?? 0
      const p = result.projects_moved ?? 0
      const pe = result.people_moved ?? 0
      const nr = result.new_role ?? convertNewRole
      setConvertSummary(
        `Converted "${masterLabel}" to ${nr}. Reassigned ${c} customers, ${p} projects, and ${pe} people to "${newMasterLabel}".`
      )
      setConvertMasterId('')
      setConvertNewMasterId('')
      setConvertNewRole('assistant')
      setConvertAutoAdopt(true)
      await loadData()
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Unknown error converting master')
    } finally {
      setConvertSubmitting(false)
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

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    setManualAddError(null)
    setManualAddSubmitting(true)
    
    const trimmedName = manualAddName.trim()
    if (trimmedName) {
      // Check for duplicate names (case-insensitive)
      const isDuplicate = await checkDuplicateName(trimmedName)
      if (isDuplicate) {
        setManualAddError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        setManualAddSubmitting(false)
        return
      }
    }
    
    const body: Record<string, unknown> = {
        email: manualAddEmail.trim(),
        password: manualAddPassword,
        role: manualAddRole,
        name: trimmedName || undefined,
    }
    if ((manualAddRole === 'estimator' || manualAddRole === 'subcontractor') && manualAddServiceTypeIds.length > 0) {
      body.service_type_ids = manualAddServiceTypeIds
    }
    const { data, error: eFn } = await supabase.functions.invoke('create-user', {
      body,
    })
    setManualAddSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setManualAddError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setManualAddError(err)
      return
    }
    closeManualAdd()
    await loadData()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSubmitting(true)
    
    const trimmedName = inviteName.trim()
    if (trimmedName) {
      // Check for duplicate names (case-insensitive)
      const isDuplicate = await checkDuplicateName(trimmedName)
      if (isDuplicate) {
        setInviteError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        setInviteSubmitting(false)
        return
      }
    }
    
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail.trim(), role: inviteRole, name: trimmedName || undefined },
    })
    setInviteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setInviteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setInviteError(err)
      return
    }
    closeInvite()
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
    if (typeof window === 'undefined') return
    const k = getLastFullBackupStorageKey(authUser?.id)
    setLastFullBackupAtIso(localStorage.getItem(k))
  }, [authUser?.id])

  if (loading) return <p>Loading…</p>
  if (error && !myRole) return <p style={{ color: '#b91c1c' }}>{error}</p>

  // For estimators with restrictions, only show approved service types in Material Part/Assembly Types
  const visibleServiceTypesForMaterials = myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : serviceTypes
  const canDeleteMaterialTypes = myRole === 'dev'

  const exportBackupBusy =
    exportProjectsLoading ||
    exportMaterialsLoading ||
    exportBidsLoading ||
    exportPeopleLoading ||
    exportJobsLoading ||
    exportChecklistLoading ||
    exportReportsLoading ||
    exportProspectsLoading ||
    exportSettingsLoading ||
    exportAllLoading

  return (
    <div>
      {impersonating && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: '#92400e', fontWeight: 500 }}>Signed in as another user</span>
          <button
            type="button"
            onClick={handleBackToMyAccount}
            style={{
              padding: '0.35rem 0.75rem',
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #f59e0b',
              borderRadius: 4,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to my account
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
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

      <SettingsJumpNav groups={settingsJumpGroups} />

      <SettingsGroup
        id="settings-account"
        title="Your account"
        titleTrailing={
          myRole === 'dev' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                justifyContent: 'flex-end',
                        gap: '0.5rem',
                flexShrink: 1,
                minWidth: 0,
                maxWidth: 'min(100%, 22rem)',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  lineHeight: 1.35,
                  textAlign: 'right',
                }}
              >
                Time since manual DB backup:{' '}
                {lastFullBackupAtIso == null
                  ? 'Never'
                  : (() => {
                      const d = wholeDaysSince(lastFullBackupAtIso)
                      return d === null ? 'Never' : `${d} day${d === 1 ? '' : 's'}`
                    })()}
              </span>
                        <button
                          type="button"
                onClick={() => {
                  void exportAllBackup()
                }}
                disabled={exportBackupBusy}
                aria-label="Export all backup"
                title="Export all backup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  padding: '0.35rem',
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#374151',
                  cursor: exportBackupBusy ? 'not-allowed' : 'pointer',
                  opacity: exportBackupBusy ? 0.55 : 1,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden style={{ width: '1.25rem', height: '1.25rem', display: 'block' }}>
                  <path fill="currentColor" d="M544 269.8C529.2 279.6 512.2 287.5 494.5 293.8C447.5 310.6 385.8 320 320 320C254.2 320 192.4 310.5 145.5 293.8C127.9 287.5 110.8 279.6 96 269.8L96 352C96 396.2 196.3 432 320 432C443.7 432 544 396.2 544 352L544 269.8zM544 192L544 144C544 99.8 443.7 64 320 64C196.3 64 96 99.8 96 144L96 192C96 236.2 196.3 272 320 272C443.7 272 544 236.2 544 192zM494.5 453.8C447.6 470.5 385.9 480 320 480C254.1 480 192.4 470.5 145.5 453.8C127.9 447.5 110.8 439.6 96 429.8L96 496C96 540.2 196.3 576 320 576C443.7 576 544 540.2 544 496L544 429.8C529.2 439.6 512.2 447.5 494.5 453.8z" />
                </svg>
                        </button>
                    </div>
          ) : null
        }
      >


      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#f9fafb' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem', fontWeight: 600 }}>My Profile</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Update your name, email, and phone. Your phone is used in prospect copy templates.
        </p>
        <form onSubmit={saveMyProfile}>
          {myProfileError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{myProfileError}</p>}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Name</label>
            <input
              type="text"
              value={myProfileName}
              onChange={(e) => setMyProfileName(e.target.value)}
              readOnly={myRole === 'subcontractor'}
              disabled={myRole === 'subcontractor'}
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                boxSizing: 'border-box',
                ...(myRole === 'subcontractor' && { background: '#f3f4f6', cursor: 'not-allowed' }),
              }}
            />
            {myRole === 'subcontractor' && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                Name is managed by admins. Contact a master or dev to change it.
              </p>
            )}
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Email</label>
            <input
              type="email"
              value={myProfileEmail}
              onChange={(e) => setMyProfileEmail(e.target.value)}
              required
              style={{ width: '100%', maxWidth: 320, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Phone</label>
            <input
              type="tel"
              value={myProfilePhone}
              onChange={(e) => setMyProfilePhone(e.target.value)}
              placeholder="e.g. (555) 123-4567"
              style={{ width: '100%', maxWidth: 320, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={myProfileSaving}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: myProfileSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            {myProfileSaving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Push Notifications</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
          Get browser notifications when a workflow stage is completed and it&apos;s your turn to pick up the task.
        </p>
        {!pushNotifications.supported && (
          <p style={{ color: '#92400e', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            Push notifications require HTTPS (or localhost) and a supporting browser. Try the deployed app or use Chrome/Firefox on localhost.
          </p>
        )}
        {pushNotifications.supported && pushNotifications.error && (
          <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{pushNotifications.error}</p>
        )}
        {pushNotifications.supported && !pushNotifications.vapidConfigured && (
          <p style={{ color: '#92400e', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY in your environment.
          </p>
        )}
        {pushNotifications.supported && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {pushNotifications.isSubscribed ? (
                <>
                  <span style={{ fontSize: '0.875rem', color: '#059669' }}>Enabled</span>
        <button
          type="button"
                    onClick={() => pushNotifications.disable()}
                    disabled={pushNotifications.loading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    {pushNotifications.loading ? 'Disabling…' : 'Disable'}
        </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => pushNotifications.enable()}
                  disabled={pushNotifications.loading || !pushNotifications.vapidConfigured}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {pushNotifications.loading ? 'Enabling…' : 'Enable push notifications'}
                </button>
            )}
          </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
                onClick={handleTestNotification}
                disabled={!pushNotifications.isSubscribed || testNotificationSending || !pushNotifications.vapidConfigured}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: 'white' }}
              >
                {testNotificationSending ? 'Sending…' : 'Test notification'}
          </button>
              {!pushNotifications.isSubscribed && pushNotifications.vapidConfigured && (
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Enable push notifications first to test</span>
              )}
            </div>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Allow location for location-based reminders
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {locationPermission === 'granted' ? (
                <span style={{ fontSize: '0.875rem', color: '#059669' }}>Location based reminders enabled</span>
              ) : locationPermission === 'denied' ? (
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Location based reminders disabled — enable in browser settings to allow location based reminders
                </span>
              ) : (
                          <button
                            type="button"
                  onClick={handleEnableLocation}
                  disabled={locationLoading}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: 'white' }}
                          >
                  {locationLoading ? 'Requesting…' : 'Enable Location based Reminders'}
                          </button>
              )}
                        </div>
            {testNotificationSuccess && (
              <p style={{ color: '#059669', margin: 0, fontSize: '0.875rem' }}>{testNotificationSuccess}</p>
            )}
            {testNotificationError && (
              <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.875rem' }}>{testNotificationError}</p>
              )}
            </div>
          )}
        </div>

      {/* Inline Change Password form - toggled from header button */}
      {passwordChangeOpen && (
        <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem', padding: '1rem 0' }}>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="current-password"
                label="Current password *"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="current-password"
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="new-password"
                label="New password *"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                id="confirm-password"
                label="Confirm new password *"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            {passwordChangeError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{passwordChangeError}</p>}
            {passwordChangeSuccess && <p style={{ color: '#059669', marginBottom: '1rem' }}>Password changed successfully!</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                {passwordChangeSubmitting ? 'Changing…' : 'Change password'}
              </button>
              <button type="button" onClick={closePasswordChange} disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

      </SettingsGroup>

      {authUser?.id && (
        <section
          id="settings-salary-workday"
          aria-labelledby="settings-salary-workday-heading"
          style={{ marginBottom: '2rem', scrollMarginTop: '0.75rem' }}
        >
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
            <button
              type="button"
              id="settings-salary-workday-heading"
              aria-expanded={salaryWorkdaySectionOpen}
              aria-controls="settings-salary-workday-panel"
              onClick={() => setSalaryWorkdaySectionOpen((prev) => !prev)}
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
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#111827',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }} aria-hidden>
                {salaryWorkdaySectionOpen ? '▼' : '▶'}
              </span>
              Salaried workday
            </button>
            {salaryWorkdaySectionOpen && (
              <div
                id="settings-salary-workday-panel"
                style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}
              >
                <SalaryWorkScheduleSettings
                  userId={authUser.id}
                  userPayName={users.find((u) => u.id === authUser.id)?.name?.trim() ?? ''}
                  canEditPastDayOverrides={
                    myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant'
                  }
                />
              </div>
            )}
          </div>
        </section>
      )}

      <SettingsGroup id="settings-dashboard" title="Dashboard & alerts">

      {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
          <button
            type="button"
            aria-expanded={dashboardButtonsSectionOpen}
            onClick={() => setDashboardButtonsSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{dashboardButtonsSectionOpen ? '▼' : '▶'}</span>
            Dashboard buttons
          </button>
          {dashboardButtonsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>
                Choose which quick-action buttons appear on your Dashboard.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
                {(['job', 'job_labor', 'bid', 'project', 'part', 'assembly', 'prospect', 'inspections', 'builder_review'] as const)
                  .filter((key) => key !== 'builder_review' || myRole === 'master_technician')
                  .map((key) => {
                  const label = key === 'job_labor' ? 'Job Labor' : key === 'prospect' ? 'Prospect' : key === 'inspections' ? 'Inspections' : key === 'builder_review' ? 'Builder Review' : key.charAt(0).toUpperCase() + key.slice(1)
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={dashboardButtons[key] !== false}
                        onChange={async (e) => {
                          const visible = e.target.checked
                          setDashboardButtons((prev) => ({ ...prev, [key]: visible }))
                          setDashboardButtonsSaving(true)
                          await supabase.from('user_dashboard_buttons').upsert(
                            { user_id: authUser!.id, button_key: key, visible },
                            { onConflict: 'user_id,button_key' }
                          )
                          setDashboardButtonsSaving(false)
                        }}
                        disabled={dashboardButtonsSaving}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>Placement</p>
                <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
                  Show quick-action buttons at the top of the Dashboard (above Clock In/Out), or in the same row as your pinned page tabs.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dashboard-quick-buttons-placement"
                      checked={dashboardQuickButtonsPlacement === 'top'}
                      onChange={async () => {
                        if (!authUser?.id) return
                        setDashboardQuickButtonsPlacement('top')
                        setDashboardQuickButtonsPlacementSaving(true)
                        const { error } = await supabase.from('user_dashboard_preferences').upsert(
                          { user_id: authUser.id, quick_buttons_placement: 'top' },
                          { onConflict: 'user_id' },
                        )
                        setDashboardQuickButtonsPlacementSaving(false)
                        if (error) setError(error.message)
                      }}
                      disabled={dashboardQuickButtonsPlacementSaving}
                    />
                    At the top (above Clock In/Out)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dashboard-quick-buttons-placement"
                      checked={dashboardQuickButtonsPlacement === 'with_pins'}
                      onChange={async () => {
                        if (!authUser?.id) return
                        setDashboardQuickButtonsPlacement('with_pins')
                        setDashboardQuickButtonsPlacementSaving(true)
                        const { error } = await supabase.from('user_dashboard_preferences').upsert(
                          { user_id: authUser.id, quick_buttons_placement: 'with_pins' },
                          { onConflict: 'user_id' },
                        )
                        setDashboardQuickButtonsPlacementSaving(false)
                        if (error) setError(error.message)
                      }}
                      disabled={dashboardQuickButtonsPlacementSaving}
                    />
                    With pinned tabs
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {myRole != null && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            type="button"
            onClick={() => setFinancialPinsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{financialPinsSectionOpen ? '▼' : '▶'}</span>
            Dashboard Page Pins
          </button>
          {financialPinsSectionOpen && (
            <div style={{ padding: '1rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Page pins</h2>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  Pinned pages appear as shortcut links at the top of your Dashboard.
                </p>
                {pinsClearSuccess && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                    Page pins cleared.
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    clearPinned(authUser?.id)
                    if (authUser?.id) await clearPinnedInSupabase(authUser.id)
                    setPinsClearSuccess(true)
                    setTimeout(() => setPinsClearSuccess(false), 3000)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Clear all page pins
                </button>
                {!pinsLoading && myPins.length > 0 && (
                  <ul style={{ margin: '1rem 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {myPins.map((item) => {
                      const pinKey = `${item.path}:${item.tab ?? ''}`
                      const label = item.tab
                        ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}`
                        : item.label
                      const removing = pinRemovingId === pinKey
                      return (
                        <li
                          key={pinKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: '#f9fafb',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <span style={{ fontSize: '0.875rem' }}>{label}</span>
                          <button
                            type="button"
                            disabled={removing}
                            onClick={async () => {
                              setPinRemovingId(pinKey)
                              await removePin(authUser?.id, item)
                              setPinRemovingId(null)
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              background: removing ? '#e5e7eb' : '#fef2f2',
                              color: removing ? '#9ca3af' : '#b91c1c',
                              border: '1px solid #e5e7eb',
                              borderRadius: 4,
                              cursor: removing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {removing ? 'Removing…' : 'Remove'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {myRole === 'dev' && (
              <>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Billed to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin Billed count and total to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinBilledMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinBilledMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinBilledMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinBilledMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinBilledSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinBilledSaving || pinBilledMasterIds.size === 0}
              onClick={async () => {
                setPinBilledSaving(true)
                setPinBilledMessage(null)
                const count = billedCount ?? 0
                const total = billedTotal ?? 0
                const label = `Billed Awaiting Payment (${count}) - $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                const item = { path: '/jobs', label, tab: 'billed' as const }
                const ids = Array.from(pinBilledMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinBilledSaving(false)
                if (errMsg) setPinBilledMessage({ type: 'error', text: errMsg })
                else {
                  loadBilledTotalAndPinnedUsers()
                  setPinBilledMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinBilledMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinBilledSaving || pinBilledMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinBilledSaving || pinBilledUnpinSaving}
              onClick={async () => {
                setPinBilledUnpinSaving(true)
                setPinBilledMessage(null)
                const { count, error } = await deletePinForPathAndTab('/jobs', 'billed')
                setPinBilledUnpinSaving(false)
                if (error) setPinBilledMessage({ type: 'error', text: error.message })
                else {
                  loadBilledTotalAndPinnedUsers()
                  setPinBilledMessage({ type: 'success', text: `Unpinned Billed for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinBilledMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: pinBilledSaving || pinBilledUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinBilledMessage && (
            <p style={{ color: pinBilledMessage.type === 'success' ? '#059669' : '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinBilledMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Cost matrix to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin Cost matrix to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinCostMatrixMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinCostMatrixMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinCostMatrixMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinCostMatrixMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinCostMatrixSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinCostMatrixSaving || pinCostMatrixMasterIds.size === 0}
              onClick={async () => {
                setPinCostMatrixSaving(true)
                setPinCostMatrixMessage(null)
                const total = costMatrixTotal ?? 0
                const item = { path: '/people', label: `Internal Team: $${Math.round(total).toLocaleString('en-US')}`, tab: 'pay' as const }
                const ids = Array.from(pinCostMatrixMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinCostMatrixSaving(false)
                if (errMsg) setPinCostMatrixMessage({ type: 'error', text: errMsg })
                else {
                  loadCostMatrixPinnedUsers()
                  setPinCostMatrixMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinCostMatrixMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinCostMatrixSaving || pinCostMatrixMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinCostMatrixSaving || pinCostMatrixUnpinSaving}
              onClick={async () => {
                setPinCostMatrixUnpinSaving(true)
                setPinCostMatrixMessage(null)
                const { count, error } = await deletePinForPathAndTab('/people', 'pay')
                setPinCostMatrixUnpinSaving(false)
                if (error) setPinCostMatrixMessage({ type: 'error', text: error.message })
                else {
                  loadCostMatrixPinnedUsers()
                  setPinCostMatrixMessage({ type: 'success', text: `Unpinned Cost matrix for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinCostMatrixMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: pinCostMatrixSaving || pinCostMatrixUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinCostMatrixMessage && (
            <p style={{ color: pinCostMatrixMessage.type === 'success' ? '#059669' : '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinCostMatrixMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Supply Houses AP to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin Supply Houses AP total to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinAPMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinAPMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinAPMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinAPMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinAPSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinAPSaving || pinAPMasterIds.size === 0}
              onClick={async () => {
                setPinAPSaving(true)
                setPinAPMessage(null)
                const total = apTotal ?? 0
                const item = { path: '/materials', label: `Supply Houses AP | $${Math.round(total).toLocaleString('en-US')}`, tab: 'supply-houses' as const }
                const ids = Array.from(pinAPMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinAPSaving(false)
                if (errMsg) setPinAPMessage({ type: 'error', text: errMsg })
                else {
                  loadSupplyHousesAPTotalAndPinnedUsers()
                  setPinAPMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinAPMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinAPSaving || pinAPMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinAPSaving || pinAPUnpinSaving}
              onClick={async () => {
                setPinAPUnpinSaving(true)
                setPinAPMessage(null)
                const { count, error } = await deletePinForPathAndTab('/materials', 'supply-houses')
                setPinAPUnpinSaving(false)
                if (error) setPinAPMessage({ type: 'error', text: error.message })
                else {
                  loadSupplyHousesAPTotalAndPinnedUsers()
                  setPinAPMessage({ type: 'success', text: `Unpinned Supply Houses AP for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinAPMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: pinAPSaving || pinAPUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinAPMessage && (
            <p style={{ color: pinAPMessage.type === 'success' ? '#059669' : '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinAPMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Sub Labor Due to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin Sub Labor Due (unpaid sub labor balances) to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinExternalTeamMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinExternalTeamMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinExternalTeamMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinExternalTeamMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinExternalTeamSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinExternalTeamSaving || pinExternalTeamMasterIds.size === 0}
              onClick={async () => {
                setPinExternalTeamSaving(true)
                setPinExternalTeamMessage(null)
                const total = externalTeamTotal ?? 0
                const formatTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                const item = { path: '/jobs', label: `Sub Labor Due: $${formatTotal}`, tab: 'sub_sheet_ledger' as const }
                const ids = Array.from(pinExternalTeamMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinExternalTeamSaving(false)
                if (errMsg) setPinExternalTeamMessage({ type: 'error', text: errMsg })
                else {
                  loadExternalTeamTotalAndPinnedUsers()
                  setPinExternalTeamMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinExternalTeamMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinExternalTeamSaving || pinExternalTeamMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinExternalTeamSaving || pinExternalTeamUnpinSaving}
              onClick={async () => {
                setPinExternalTeamUnpinSaving(true)
                setPinExternalTeamMessage(null)
                const [subRes, extRes] = await Promise.all([
                  deletePinForPathAndTab('/jobs', 'sub_sheet_ledger'),
                  deletePinForPathAndTab('/materials', 'external-team'),
                ])
                const count = (subRes.count ?? 0) + (extRes.count ?? 0)
                const error = subRes.error ?? extRes.error
                setPinExternalTeamUnpinSaving(false)
                if (error) setPinExternalTeamMessage({ type: 'error', text: error.message })
                else {
                  loadExternalTeamTotalAndPinnedUsers()
                  setPinExternalTeamMessage({ type: 'success', text: `Unpinned Sub Labor Due for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinExternalTeamMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: pinExternalTeamSaving || pinExternalTeamUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinExternalTeamMessage && (
            <p style={{ color: pinExternalTeamMessage.type === 'success' ? '#059669' : '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinExternalTeamMessage.text}
            </p>
          )}
        </div>
              </>
              )}

            </div>
          )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
          <button
            type="button"
            aria-expanded={dailyGoalsSectionOpen}
            onClick={() => setDailyGoalsSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{dailyGoalsSectionOpen ? '▼' : '▶'}</span>
            Daily goals (clock-in gate)
          </button>
          {dailyGoalsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>
                After a user&apos;s first clock-in each calendar day, they must check off these goals before using the app. Leave empty to disable the gate for that user.
              </p>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>User</label>
              <select
                value={dailyGoalsTargetUserId}
                onChange={(e) => setDailyGoalsTargetUserId(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', marginBottom: '1rem', maxWidth: 420, width: '100%' }}
              >
                <option value="">Select user…</option>
                {goalPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
              {dailyGoalsTargetUserId &&
                (dailyGoalsLoading ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
                ) : (
                  <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {dailyGoalsRows.map((row) => (
                        <li key={row.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                          <textarea
                            value={row.body}
                            onChange={(e) => {
                              const v = e.target.value
                              setDailyGoalsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, body: v } : r)))
                            }}
                            onBlur={async (e) => {
                              const body = e.currentTarget.value.trim()
                              if (!body) return
                              const { error: err } = await supabase.from('user_dashboard_goals').update({ body }).eq('id', row.id)
                              if (err) setError(err.message)
                            }}
                            rows={2}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Delete this goal?')) return
                              const { error: err } = await supabase.from('user_dashboard_goals').delete().eq('id', row.id)
                              if (err) setError(err.message)
                              else setDailyGoalsRows((prev) => prev.filter((r) => r.id !== row.id))
                            }}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dailyGoalsTargetUserId) return
                        const nextOrder =
                          dailyGoalsRows.length === 0 ? 0 : Math.max(...dailyGoalsRows.map((r) => r.sort_order), 0) + 1
                        const { data, error: err } = await supabase
                          .from('user_dashboard_goals')
                          .insert({ user_id: dailyGoalsTargetUserId, body: 'New goal', sort_order: nextOrder })
                          .select('id, body, sort_order')
                          .single()
                        if (err) setError(err.message)
                        else if (data)
                          setDailyGoalsRows((prev) => [...prev, data as { id: string; body: string; sort_order: number }])
                      }}
                      style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                    >
                      Add goal
                    </button>
                  </>
                ))}
            </div>
          )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
          <button
            type="button"
            aria-expanded={teamLeadAssignmentsSectionOpen}
            onClick={() => setTeamLeadAssignmentsSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{teamLeadAssignmentsSectionOpen ? '▼' : '▶'}</span>
            Team Hours Sharing
          </button>
          {teamLeadAssignmentsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>
            Link a leader to a member for team hours sharing—the leader can approve that member&apos;s hours from Dashboard → My Team. Any account role can be leader or member. A member can have more than one leader (with a different leader each time). The member list skips people already linked to the leader you pick.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Leader</label>
              <select
                value={teamAssignLeaderId}
                onChange={(e) => {
                  setTeamAssignLeaderId(e.target.value)
                  setTeamAssignMemberId('')
                }}
                style={{ padding: '0.35rem 0.5rem', maxWidth: 320, width: '100%', minWidth: 200, border: '1px solid #d1d5db' }}
              >
                <option value="">Select user…</option>
                {goalPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Member</label>
              <select
                value={teamAssignMemberId}
                disabled={teamHoursMemberPickerDisabled}
                onChange={(e) => setTeamAssignMemberId(e.target.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  maxWidth: 320,
                  width: '100%',
                  minWidth: 200,
                  ...(teamHoursMemberPickerDisabled
                    ? {
                        background: '#f3f4f6',
                        color: '#9ca3af',
                        cursor: 'not-allowed',
                        border: '1px solid #e5e7eb',
                      }
                    : {
                        background: 'white',
                        color: 'inherit',
                        cursor: 'pointer',
                        border: '1px solid #d1d5db',
                      }),
                }}
              >
                <option value="">{teamHoursMemberPlaceholder}</option>
                {teamHoursMemberPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={teamAssignSaving || !teamAssignLeaderId || !teamAssignMemberId || teamAssignLeaderId === teamAssignMemberId}
              onClick={async () => {
                if (!authUser?.id || !teamAssignLeaderId || !teamAssignMemberId) return
                if (teamAssignLeaderId === teamAssignMemberId) {
                  setError('Leader and member must be different users.')
                  return
                }
                setTeamAssignSaving(true)
                try {
                  const inserted = await withSupabaseRetry(
                    async () =>
                      supabase
                        .from('team_leader_assignments')
                        .insert({
                          leader_user_id: teamAssignLeaderId,
                          member_user_id: teamAssignMemberId,
                          created_by_user_id: authUser.id,
                        })
                        .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
                        .single(),
                    'add team lead assignment',
                  )
                  if (!inserted) {
                    setError('Could not add assignment.')
                    return
                  }
                  const row = inserted as {
                    id: string
                    leader_user_id: string
                    member_user_id: string
                    dashboard_hours_visibility: string | null
                  }
                  setTeamLeaderAssignments((prev) => [
                    {
                      id: row.id,
                      leader_user_id: row.leader_user_id,
                      member_user_id: row.member_user_id,
                      dashboard_hours_visibility:
                        row.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
                    },
                    ...prev,
                  ])
                  setTeamAssignLeaderId('')
                  setTeamAssignMemberId('')
                } catch (e) {
                  setError(formatErrorMessage(e))
                } finally {
                  setTeamAssignSaving(false)
                }
              }}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.875rem',
                borderRadius: 4,
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: 'white',
                cursor: teamAssignSaving ? 'wait' : 'pointer',
                opacity: teamAssignSaving ? 0.7 : 1,
              }}
            >
              Add
            </button>
          </div>
          {teamLeaderAssignments.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>No assignments yet.</p>
          ) : (
            <React.Fragment>
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="search"
                  value={teamLeaderAssignmentsSearchQuery}
                  onChange={(e) => setTeamLeaderAssignmentsSearchQuery(e.target.value)}
                  placeholder="Search by leader or member…"
                  aria-label="Search team hours assignments by leader or member"
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {filteredTeamLeaderAssignments.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>No assignments match your search.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th
                      scope="col"
                      aria-sort={
                        teamLeaderSortColumn === 'leader'
                          ? teamLeaderSortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (teamLeaderSortColumn === 'leader') {
                            setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                          } else {
                            setTeamLeaderSortColumn('leader')
                            setTeamLeaderSortDir('asc')
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontStyle: 'inherit',
                          lineHeight: 'inherit',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        Leader
                        {teamLeaderSortColumn === 'leader' && (
                          <span aria-hidden style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            {teamLeaderSortDir === 'asc' ? '\u25B2' : '\u25BC'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        teamLeaderSortColumn === 'member'
                          ? teamLeaderSortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (teamLeaderSortColumn === 'member') {
                            setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                          } else {
                            setTeamLeaderSortColumn('member')
                            setTeamLeaderSortDir('asc')
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontStyle: 'inherit',
                          lineHeight: 'inherit',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        Member
                        {teamLeaderSortColumn === 'member' && (
                          <span aria-hidden style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            {teamLeaderSortDir === 'asc' ? '\u25B2' : '\u25BC'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                      Leader dashboard
                    </th>
                    <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamLeaderAssignments.map((row) => {
                    const leaderLabel = displayLabelForGoalPickerUser(row.leader_user_id, goalPickerUsers)
                    const memberLabel = displayLabelForGoalPickerUser(row.member_user_id, goalPickerUsers)
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{leaderLabel}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{memberLabel}</td>
                        <td style={{ padding: '0.5rem 0.75rem', maxWidth: 220 }}>
                          <select
                            value={row.dashboard_hours_visibility}
                            disabled={myRole !== 'dev' || teamLeaderVisibilitySavingId === row.id}
                            title={
                              myRole !== 'dev'
                                ? 'Only a developer can change this setting.'
                                : 'What this leader sees on their Dashboard for this member'
                            }
                            onChange={(e) => {
                              const next = e.target.value === 'strip_only' ? 'strip_only' : 'full'
                              if (next === row.dashboard_hours_visibility) return
                              setTeamLeaderVisibilitySavingId(row.id)
                              void (async () => {
                                try {
                                  await withSupabaseRetry(
                                    async () =>
                                      supabase
                                        .from('team_leader_assignments')
                                        .update({ dashboard_hours_visibility: next })
                                        .eq('id', row.id),
                                    'update team leader dashboard visibility',
                                  )
                                  setTeamLeaderAssignments((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, dashboard_hours_visibility: next } : r)),
                                  )
                                } catch (err) {
                                  setError(formatErrorMessage(err))
                                } finally {
                                  setTeamLeaderVisibilitySavingId(null)
                                }
                              })()
                            }}
                            style={{
                              width: '100%',
                              maxWidth: 200,
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: myRole !== 'dev' ? '#f3f4f6' : 'white',
                              cursor: myRole !== 'dev' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <option value="full">Full My Team</option>
                            <option value="strip_only">Clock strip only</option>
                          </select>
                          {myRole !== 'dev' ? (
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>Dev only</div>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <button
                            type="button"
                            disabled={teamAssignSaving}
                            onClick={async () => {
                              if (!confirm('Remove this team lead assignment?')) return
                              setTeamAssignSaving(true)
                              try {
                                await withSupabaseRetry(
                                  async () => supabase.from('team_leader_assignments').delete().eq('id', row.id),
                                  'remove team lead assignment',
                                )
                                setTeamLeaderAssignments((prev) => prev.filter((r) => r.id !== row.id))
                              } catch (e) {
                                setError(formatErrorMessage(e))
                              } finally {
                                setTeamAssignSaving(false)
                              }
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              borderRadius: 4,
                              background: '#fef2f2',
                              cursor: teamAssignSaving ? 'wait' : 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
            </React.Fragment>
          )}
        </div>
      )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <button
            type="button"
            aria-expanded={reportNotificationsSectionOpen}
            onClick={() => setReportNotificationsSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{reportNotificationsSectionOpen ? '▼' : '▶'}</span>
            Report notifications
          </button>
          {reportNotificationsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                Get a push notification when someone submits these report types. Enable push notifications above first.
              </p>
              <form onSubmit={saveReportNotificationPreferences}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {reportTemplates.map((t) => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={reportNotificationTemplateIds.has(t.id)}
                        onChange={() => toggleReportNotificationTemplate(t.id)}
                      />
                      Notify me when someone submits: {t.name}
                    </label>
                  ))}
                  {reportTemplates.length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No report templates.</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={reportNotificationSaving}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reportNotificationSaving ? 'not-allowed' : 'pointer' }}
                >
                  {reportNotificationSaving ? 'Saving…' : 'Save report notification preferences'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}


      {showMyReports && (
        <div
          style={{
            marginBottom: '2rem',
            marginTop: 0,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
            <button
              type="button"
            onClick={() => setMyReportsExpanded((prev) => !prev)}
            aria-expanded={myReportsExpanded}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap',
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem' }} aria-hidden>{myReportsExpanded ? '▼' : '▶'}</span>
              My Reports
            </span>
            {myReportsExpanded && !myReportsLoading && myReports.length > 1 && (
            <button
              type="button"
                onClick={(e) => { e.stopPropagation(); setMyReportsModalOpen(true) }}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.875rem', color: '#2563eb', cursor: 'pointer' }}
            >
                Show more →
            </button>
            )}
            </button>
          {myReportsExpanded && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              {myReportsLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading reports…</p>
              ) : myReports.length > 0 ? (
                (() => {
                  const r = myReports[0]!
                  const editWindowMs = myReportsReportEditWindowDays * 24 * 60 * 60 * 1000
                  const isWithinEditWindow = new Date(r.created_at).getTime() >= Date.now() - editWindowMs
                  return (
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{ flex: 1, minWidth: 0 }}
                        onClick={() => {
                          setSelectedReport({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, created_by_name: r.created_by_name, field_values: r.field_values, reported_at_lat: r.reported_at_lat ?? null, reported_at_lng: r.reported_at_lng ?? null })
                          setViewReportModalOpen(true)
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {r.template_name}</span>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      {isWithinEditWindow && (
            <button
              type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReportForEdit({ id: r.id, template_id: r.template_id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, field_values: r.field_values })
                            setEditReportModalOpen(true)
                          }}
                          style={{ flexShrink: 0, padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Edit
            </button>
                      )}
          </div>
                  )
                })()
              ) : (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No reports yet. Create one from a job.</p>
              )}
            </div>
          )}
        </div>
      )}

      {hasNotificationHistory === true && (
      <div
        style={{
          marginBottom: '2rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#f9fafb',
        }}
      >
            <button
              type="button"
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
          onClick={() => setNotificationHistoryOpen((o) => !o)}
          aria-expanded={notificationHistoryOpen}
          aria-controls="notification-history-content"
            >
          <span style={{ fontSize: '0.75rem' }} aria-hidden>{notificationHistoryOpen ? '▼' : '▶'}</span>
          My Notification History
            </button>
        {notificationHistoryOpen && (
          <div id="notification-history-content" style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            {notificationHistoryLoading ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
            ) : notificationHistoryError ? (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }}>{notificationHistoryError}</p>
            ) : notificationHistory.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No notifications yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notificationHistory.map((row) => {
                  const channelLabel = row.channel === 'both' ? 'Email + Push' : row.channel === 'email' ? 'Email' : 'Push'
                  const link =
                    row.project_id && row.step_id
                      ? `/workflows/${row.project_id}#step-${row.step_id}`
                      : row.checklist_instance_id
                        ? '/checklist'
                        : null
                  return (
                    <li
                      key={row.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        marginBottom: '0.5rem',
                        background: '#fff',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', minWidth: 140 }}>
                        {formatNotificationDatetime(row.sent_at)}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{row.title}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#f3f4f6',
                          color: '#374151',
                        }}
                      >
                        {channelLabel}
                      </span>
                      {link && (
                        <Link to={link} style={{ fontSize: '0.875rem', color: '#2563eb' }}>
                          View →
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
              </div>
            )}
          </div>
      )}

      {authUser?.id && (
        <div
          style={{
            marginBottom: '2rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
            <button
              type="button"
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
            onClick={() => setMutedTasksOpen((o) => !o)}
            aria-expanded={mutedTasksOpen}
            aria-controls="muted-tasks-content"
            >
            <span style={{ fontSize: '0.75rem' }} aria-hidden>{mutedTasksOpen ? '▼' : '▶'}</span>
            Muted Tasks
            </button>
          {mutedTasksOpen && (
            <div id="muted-tasks-content" style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              {mutedTasksLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : mutedTasks.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                  You are not muting any task notifications. Use the mute icon on a task (Checklist or Dashboard) to mute it.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {mutedTasks.map((m) => {
                    const until = new Date(m.muted_until)
                    const isForever = until > new Date('9999-01-01')
                    const expiryText = isForever ? 'Forever' : until.toLocaleDateString(undefined, { dateStyle: 'medium' })
                    return (
                      <li
                        key={m.checklist_item_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          background: '#f9fafb',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.task_title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Muted until: {expiryText}</div>
                  </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                            type="button"
                            onClick={() => { setMuteModalItemId(m.checklist_item_id); setMuteModalTitle(m.task_title) }}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Change
                  </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!authUser?.id) return
                              await supabase
                                .from('user_checklist_item_mute_preferences')
                                .delete()
                                .eq('user_id', authUser.id)
                                .eq('checklist_item_id', m.checklist_item_id)
                              loadMutedTasks()
                            }}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Unmute
                          </button>
              </div>
                      </li>
                    )
                  })}
                </ul>
            )}
          </div>
          )}
        </div>
      )}

      {myRole === 'dev' && authUser?.id && (
        <div
          style={{
            marginBottom: '2rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
            <button
              type="button"
            aria-expanded={ignoredTaskTypesOpen}
            onClick={() => setIgnoredTaskTypesOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }} aria-hidden>{ignoredTaskTypesOpen ? '▼' : '▶'}</span>
            Ignored task types (Dashboard)
            </button>
          {ignoredTaskTypesOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>
                These affect which task types appear in Recently Completed Tasks on the Dashboard. They are not the same as
                Muted Tasks (notifications).
              </p>
              {ignoredTaskTypesLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : ignoredTaskTypes.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                  No ignored task types. On the Dashboard, use Ignore in Recently Completed Tasks to move a type here.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ignoredTaskTypes.map((row) => (
                    <li
                      key={row.checklist_item_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                            border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: '#fff',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.task_title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Ignored {new Date(row.ignored_at).toLocaleString()}
                  </div>
              </div>
                      <button
                        type="button"
                        disabled={ignoredTaskTypesUnignoringId != null}
                        onClick={async () => {
                          if (!authUser?.id) return
                          setIgnoredTaskTypesUnignoringId(row.checklist_item_id)
                          try {
                            await withSupabaseRetry(
                              async () =>
                                supabase
                                  .from('dev_ignored_checklist_items')
                                  .delete()
                                  .eq('dev_user_id', authUser.id)
                                  .eq('checklist_item_id', row.checklist_item_id),
                              'unignore checklist item type',
                            )
                            showToast('Task type removed from ignored list.', 'success')
                            await loadIgnoredTaskTypes()
                          } catch (e) {
                            setError(formatErrorMessage(e))
                          } finally {
                            setIgnoredTaskTypesUnignoringId(null)
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.8125rem',
                          background: 'white',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: ignoredTaskTypesUnignoringId != null ? 'wait' : 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {ignoredTaskTypesUnignoringId === row.checklist_item_id ? 'Removing…' : 'Un-ignore'}
              </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        )}

      </SettingsGroup>

      <SettingsGroup id="settings-people" title="People & accounts">
      {myRole === 'dev' && (
        <>
          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setActiveAccountsSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{activeAccountsSectionOpen ? '▼' : '▶'}</span>
              Active Accounts
            </button>
            {activeAccountsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Set user class for everyone who has signed up. Only owners can change these.
          </p>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={openInvite} style={{ padding: '0.5rem 1rem' }}>
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} style={{ padding: '0.5rem 1rem' }}>
              Manually add user
            </button>
            <button type="button" onClick={openArchive} style={{ padding: '0.5rem 1rem' }}>
              Archive user
            </button>
            <button type="button" onClick={openArchiveReassign} style={{ padding: '0.5rem 1rem' }}>
              Archive User & Reassign Customers
            </button>
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Service types</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Last login</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <React.Fragment key={u.id}>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {editingUserId === u.id ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {editingUserId === u.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                        disabled={updatingId === u.id}
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                      {u.role === 'estimator'
                        ? (u.estimator_service_type_ids?.length
                          ? (u.estimator_service_type_ids
                              .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                              .filter(Boolean)
                              .join(', ') || '—')
                          : 'All')
                        : u.role === 'primary'
                          ? (u.primary_service_type_ids?.length
                            ? (u.primary_service_type_ids
                                .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                                .filter(Boolean)
                                .join(', ') || '—')
                            : 'All')
                          : u.role === 'superintendent'
                            ? (u.superintendent_service_type_ids?.length
                              ? (u.superintendent_service_type_ids
                                  .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                                  .filter(Boolean)
                                  .join(', ') || '—')
                              : 'All')
                            : u.role === 'subcontractor'
                            ? (u.subcontractor_service_type_ids?.length
                              ? (u.subcontractor_service_type_ids
                                  .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                                  .filter(Boolean)
                                  .join(', ') || '—')
                              : 'All')
                            : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{timeSinceAgo(u.last_sign_in_at)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0.5rem', alignItems: 'center' }}>
                        {editingUserId === u.id ? (
                          <>
                            <button
                              type="button"
                              onClick={saveUserEdits}
                              disabled={updatingId === u.id}
                              style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditUser}
                              disabled={updatingId === u.id}
                              style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditUser(u)}
                            style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => sendSignInEmail(u)}
                          disabled={sendingSignInEmailId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {sendingSignInEmailId === u.id ? 'Sending…' : 'Send email to sign in'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSetPasswordUser(u)
                            setSetPasswordValue('')
                            setSetPasswordConfirm('')
                            setSetPasswordError(null)
                          }}
                          disabled={setPasswordSubmitting}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          Set password
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingUserId === u.id && u.role === 'estimator' && (
                    <tr key={`${u.id}-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials)</div>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                            {serviceTypes.map((st) => (
                              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editEstimatorServiceTypeIds.includes(st.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditEstimatorServiceTypeIds((prev) => [...prev, st.id])
                                    } else {
                                      setEditEstimatorServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                                    }
                                  }}
                                  disabled={updatingId === u.id}
                                />
                                {st.name}
                              </label>
                            ))}
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editEstimatorProspectsAccess}
                              onChange={(e) => setEditEstimatorProspectsAccess(e.target.checked)}
                              disabled={updatingId === u.id}
                            />
                            Can access Prospects
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUserId === u.id && u.role === 'primary' && (
                    <tr key={`${u.id}-primary-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials)</div>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                            {serviceTypes.map((st) => (
                              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editPrimaryServiceTypeIds.includes(st.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditPrimaryServiceTypeIds((prev) => [...prev, st.id])
                                    } else {
                                      setEditPrimaryServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                                    }
                                  }}
                                  disabled={updatingId === u.id}
                                />
                                {st.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUserId === u.id && u.role === 'superintendent' && (
                    <tr key={`${u.id}-superintendent-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials, Bids)</div>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                            {serviceTypes.map((st) => (
                              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editSuperintendentServiceTypeIds.includes(st.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditSuperintendentServiceTypeIds((prev) => [...prev, st.id])
                                    } else {
                                      setEditSuperintendentServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                                    }
                                  }}
                                  disabled={updatingId === u.id}
                                />
                                {st.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUserId === u.id && u.role === 'subcontractor' && (
                    <tr key={`${u.id}-subcontractor-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Clock In, Dispatch)</div>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict job/bid association.</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                            {serviceTypes.map((st) => (
                              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editSubcontractorServiceTypeIds.includes(st.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditSubcontractorServiceTypeIds((prev) => [...prev, st.id])
                                    } else {
                                      setEditSubcontractorServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                                    }
                                  }}
                                  disabled={updatingId === u.id}
                                />
                                {st.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {editError && (
            <p style={{ color: '#b91c1c', marginTop: '0.5rem' }}>
              {editError}
            </p>
          )}
          {users.length === 0 && <p style={{ marginTop: '1rem' }}>No users yet.</p>}

          {/* Archived users */}
          <div style={{ marginTop: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxWidth: 640 }}>
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
              Archived users ({archivedUsers.length})
            </button>
            {archivedSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                {restoreError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{restoreError}</p>}
                {archivedUsers.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No archived users.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Archived</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedUsers.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{u.email}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{u.name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{u.role}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                              {u.archived_at ? new Date(u.archived_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => handleRestore(u.id)}
                                disabled={restoreSubmitting}
                                style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                              >
                                {restoringUserId === u.id ? 'Restoring…' : 'Restore'}
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

          {/* Convert Master to Assistant/Subcontractor */}
          {users.length > 0 && (
            <div style={{ marginTop: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxWidth: 640 }}>
              <button
                type="button"
                onClick={() => setConvertMasterSectionOpen((prev) => !prev)}
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
                <span style={{ fontSize: '0.75rem' }}>{convertMasterSectionOpen ? '▼' : '▶'}</span>
                Convert Master to Assistant/Subcontractor
              </button>
              {convertMasterSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Convert an existing master into an assistant or subcontractor. All of their customers, projects, and people
                will be reassigned to another master.
              </p>
              <form onSubmit={handleConvertMaster}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="convert-master" style={{ display: 'block', marginBottom: 4 }}>Master to convert *</label>
                  <select
                    id="convert-master"
                    value={convertMasterId}
                    onChange={(e) => { setConvertMasterId(e.target.value); setConvertError(null); setConvertSummary(null) }}
                    disabled={convertSubmitting}
                    style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
                  >
                    <option value="">Select master…</option>
                    {users
                      .filter((u) => u.role === 'master_technician')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="convert-new-master" style={{ display: 'block', marginBottom: 4 }}>New master owner *</label>
                  <select
                    id="convert-new-master"
                    value={convertNewMasterId}
                    onChange={(e) => { setConvertNewMasterId(e.target.value); setConvertError(null); setConvertSummary(null) }}
                    disabled={convertSubmitting}
                    style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
                  >
                    <option value="">Select new master…</option>
                    {users
                      .filter((u) => u.role === 'master_technician' && u.id !== convertMasterId)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ display: 'block', marginBottom: 4 }}>New role *</span>
                  <label style={{ marginRight: '1rem' }}>
                    <input
                      type="radio"
                      name="convert-new-role"
                      value="assistant"
                      checked={convertNewRole === 'assistant'}
                      onChange={() => { setConvertNewRole('assistant'); setConvertError(null); setConvertSummary(null) }}
                      disabled={convertSubmitting}
                    />{' '}
                    Assistant
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="convert-new-role"
                      value="subcontractor"
                      checked={convertNewRole === 'subcontractor'}
                      onChange={() => { setConvertNewRole('subcontractor'); setConvertError(null); setConvertSummary(null) }}
                      disabled={convertSubmitting}
                    />{' '}
                    Subcontractor
                  </label>
                </div>
                {convertNewRole === 'assistant' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={convertAutoAdopt}
                        onChange={(e) => { setConvertAutoAdopt(e.target.checked); setConvertError(null); setConvertSummary(null) }}
                        disabled={convertSubmitting}
                        style={{ marginRight: 4 }}
                      />
                      Auto-adopt this assistant to the new master
                    </label>
                  </div>
                )}
                <p style={{ marginBottom: '0.75rem', color: '#b45309', fontSize: '0.8125rem' }}>
                  This operation reassigns all customers, projects, and people owned by the selected master to the new master and
                  changes their role. It is not easily reversible.
                </p>
                {convertError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{convertError}</p>}
                {convertSummary && <p style={{ color: '#059669', marginBottom: '0.75rem' }}>{convertSummary}</p>}
                <button
                  type="submit"
                  disabled={
                    convertSubmitting ||
                    !convertMasterId ||
                    !convertNewMasterId ||
                    convertMasterId === convertNewMasterId
                  }
                >
                  {convertSubmitting ? 'Converting…' : 'Convert master'}
                </button>
              </form>
              </div>
              )}
            </div>
          )}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                Roster of Assistants, Masters, and Subcontractors. You can add people who have not signed up. Use these when assigning workflow steps.
              </p>
              <button
                type="button"
                onClick={openFindDuplicatesModal}
                style={{ padding: '0.35rem 0.75rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Find duplicates
              </button>
            </div>
            </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setRoleVisibilityExpanded((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{roleVisibilityExpanded ? '▼' : '▶'}</span>
              Role visibility (what each role can see)
            </button>
            {roleVisibilityExpanded && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Page access by role. See ACCESS_CONTROL.md for full feature-level permissions.
                </p>
                <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 520 }}>
                      <thead>
                      <tr>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'left', background: '#f9fafb' }}>Page</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Dev</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Master</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Assistant</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Sub</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Estimator</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Primary</th>
                        </tr>
                      </thead>
                      <tbody>
                      {PAGE_ACCESS.map((row) => (
                        <tr key={row.page}>
                          <td style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', fontWeight: 500 }}>{row.page}</td>
                          {(['dev', 'master', 'assistant', 'sub', 'estimator', 'primary', 'superintendent'] as const).map((role) => {
                            const val = row[role]
                            return (
                              <td key={role} style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                {val === 'yes' ? '✓' : val === 'no' ? '✗' : val}
                              </td>
                            )
                          })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>
                  Redirection: Subcontractors → /dashboard; Estimators → /bids; Primary → /dashboard (Jobs: Reports tab only; Bids: Bid Board, RFI, Change Order, Lien Release; Projects hidden).
                </p>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setTaskDispatchSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{taskDispatchSectionOpen ? '▼' : '▶'}</span>
              Task Dispatch group
            </button>
            {taskDispatchSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Choose which <strong>assistants</strong> and <strong>estimators</strong> receive Task Dispatch notifications and see the Dispatch inbox on Dashboard.
                  Only users with role Assistant or Estimator can be added (enforced by the database).
                </p>
                {dispatchMemberIds.size === 0 && (
                  <p style={{ marginBottom: '0.75rem', color: '#b45309', fontSize: '0.875rem' }}>
                    No dispatch members yet — nobody will receive push notifications until you select at least one assistant or estimator.
                  </p>
                )}
                {dispatchGroupError && (
                  <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{dispatchGroupError}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 480 }}>
                  {users
                    .filter((u) => u.role === 'assistant' || u.role === 'estimator')
                    .map((u) => {
                      const checked = dispatchMemberIds.has(u.id)
                      return (
                        <label
                          key={u.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: dispatchGroupSavingUserId ? 'not-allowed' : 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!!dispatchGroupSavingUserId}
                            onChange={() => toggleDispatchGroupMember(u.id, checked)}
                          />
                          <span>
                            {u.name || u.email}
                            {u.email && u.name ? (
                              <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.35rem' }}>({u.email})</span>
                            ) : null}
                          </span>
                          {dispatchGroupSavingUserId === u.id && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saving…</span>
                          )}
                        </label>
                      )
                    })}
                  {users.filter((u) => u.role === 'assistant' || u.role === 'estimator').length === 0 && (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No assistant or estimator accounts in the system.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <button
                type="button"
              onClick={() => setPayApprovedMastersSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{payApprovedMastersSectionOpen ? '▼' : '▶'}</span>
              Pay Approved Masters
              </button>
            {payApprovedMastersSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  Masters selected here can access the Pay and Hours tabs on the People page. Their assistants can enter hours in the Hours tab.
                </p>
                {payApprovedError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{payApprovedError}</p>}
                {payApprovedMasters.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>No masters or devs found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
                    {payApprovedMasters.map((m) => {
                      const isApproved = payApprovedMasterIds.has(m.id)
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: 4,
                            cursor: payApprovedSaving ? 'not-allowed' : 'pointer',
                            background: isApproved ? '#f0fdf4' : 'white',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isApproved}
                            onChange={() => togglePayApproved(m.id, isApproved)}
                            disabled={payApprovedSaving}
                            style={{ cursor: payApprovedSaving ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{m.name || m.email}</span>
                            {m.email && m.name && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                ({m.email})
                              </span>
                            )}
                            {m.role === 'dev' && (
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>dev</span>
                            )}
                          </span>
                          {isApproved && (
                            <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                              Approved
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

          <TeamFeedbackDevSettingsBlock />

          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <button
                type="button"
              onClick={() => setAdditionalPeopleSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{additionalPeopleSectionOpen ? '▼' : '▶'}</span>
              Additional People
              </button>
            {additionalPeopleSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>People Created by Me</h2>
            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
              People entries in your roster.
            </p>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Kind</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPeople.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {p.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {p.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.kind === 'assistant'
                          ? 'Assistant'
                          : p.kind === 'master_technician'
                            ? 'Master Technician'
                            : p.kind === 'estimator'
                              ? 'Estimator'
                              : p.kind === 'primary'
                                ? 'Primary'
                                : p.kind === 'superintendent'
                                  ? 'Superintendent'
                                  : p.kind === 'dev'
                                    ? 'Dev'
                                    : 'Subcontractor'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.is_user ? (
                          <span style={{ color: '#059669', fontWeight: 500 }}>Has account</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>No account</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
            {myPeople.length === 0 && <p style={{ marginTop: '1rem' }}>No people entries created by you.</p>}

            <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>People Created by Other Users</h2>
            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
              People entries in rosters created by other users, and who created them.
            </p>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            {nonUserPeople.length === 0 && allPeopleCount > 0 && (
              <p style={{ color: '#f59e0b', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Note: All {allPeopleCount} visible people entry{allPeopleCount !== 1 ? 'ies' : ''} belong to you. The RLS policy for the &apos;people&apos; table may be restricting access to other users&apos; entries. To see people created by other users, the RLS policy needs to allow owners to read all entries.
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Kind</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Created by</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                  {nonUserPeople.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {p.email}
                          </a>
                        ) : (
                          '—'
                        )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {p.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.kind === 'assistant'
                          ? 'Assistant'
                          : p.kind === 'master_technician'
                            ? 'Master Technician'
                            : p.kind === 'estimator'
                              ? 'Estimator'
                              : p.kind === 'primary'
                                ? 'Primary'
                                : p.kind === 'superintendent'
                                  ? 'Superintendent'
                                  : p.kind === 'dev'
                                    ? 'Dev'
                                    : 'Subcontractor'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.is_user ? (
                          <span style={{ color: '#059669', fontWeight: 500 }}>Has account</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>No account</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.creator_name || p.creator_email ? (
                          <span>
                            {p.creator_name || 'Unknown'}
                            {p.creator_email && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>
                                ({p.creator_email})
                              </span>
                            )}
                          </span>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                            onClick={() => {
                              setEditingNonUserPerson(p)
                              setEditPersonName(p.name)
                              setEditPersonEmail(p.email ?? '')
                              setEditPersonPhone(p.phone ?? '')
                              setEditPersonNotes(p.notes ?? '')
                              setEditPersonError(null)
                            }}
                            style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                          >
                            Edit
                            </button>
                          <button
                            type="button"
                            onClick={() => deleteNonUserPerson(p)}
                            disabled={deletingPersonId === p.id}
                            style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                          >
                            {deletingPersonId === p.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            {editingNonUserPerson && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
                  <h2 style={{ marginTop: 0 }}>Edit person: {editingNonUserPerson.name}</h2>
                  {editPersonError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{editPersonError}</p>}
                  <form onSubmit={saveNonUserPersonEdit}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                      <input type="text" value={editPersonName} onChange={(e) => setEditPersonName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
                      <input type="email" value={editPersonEmail} onChange={(e) => setEditPersonEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                      <input type="tel" value={editPersonPhone} onChange={(e) => setEditPersonPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                      <textarea value={editPersonNotes} onChange={(e) => setEditPersonNotes(e.target.value)} style={{ width: '100%', padding: '0.5rem', minHeight: 60, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" disabled={editPersonSaving}>{editPersonSaving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => { setEditingNonUserPerson(null); setEditPersonError(null) }} disabled={editPersonSaving}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {nonUserPeople.length === 0 && <p style={{ marginTop: '1rem' }}>No people entries created by other users.</p>}
          </div>
            )}
        </div>
        </>
      )}

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
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
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Adopt Assistants</h2>
          {myRole === 'dev' && (
            <p style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
              <label htmlFor="adoption-master-select" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #d1d5db', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt assistants for the selected master. Changes apply to that master's access.`
              : 'Adopt assistants to give them access to your customers and projects. Assistants can create projects and assign them to you. Assistants cannot see financial totals.'}
          </p>
          {adoptionError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{adoptionError}</p>}
          {assistants.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No assistants found.</p>
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
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: adoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? '#f0fdf4' : 'white',
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
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({assistant.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
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
            <p style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
              <label htmlFor="adoption-master-select-primaries" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select-primaries"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #d1d5db', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt primaries for the selected master. Changes apply to that master's access.`
              : 'Adopt primaries to associate them with your organization. Primaries can add materials to jobs in the Jobs Billing tab.'}
          </p>
          {primaryAdoptionError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{primaryAdoptionError}</p>}
          {primaries.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No primaries found.</p>
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
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: primaryAdoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? '#f0fdf4' : 'white',
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
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({primary.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
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
            <p style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
              <label htmlFor="adoption-master-select-superintendents" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
              <select
                id="adoption-master-select-superintendents"
                value={selectedMasterIdForAdoptions ?? ''}
                onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #d1d5db', minWidth: 200 }}
              >
                <option value="">Myself</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                ))}
              </select>
            </p>
          )}
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            {myRole === 'dev' && adoptionMasterId && adoptionMasterId !== authUser?.id
              ? `Adopt or unadopt superintendents for the selected master. Changes apply to that master's access.`
              : 'Adopt superintendents to grant them access to your projects, workflows, jobs, and bids. Superintendents run jobs and manage subcontractors.'}
          </p>
          {superintendentAdoptionError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{superintendentAdoptionError}</p>}
          {superintendents.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No superintendents found.</p>
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
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: superintendentAdoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? '#f0fdf4' : 'white',
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
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({sup.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                        Adopted
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Share with other Master</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Share your customers and projects with another master. They will see your jobs with assistant-level access (cannot see financial totals).
          </p>
          {sharingError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{sharingError}</p>}
          {masters.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No other masters found.</p>
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
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: sharingSaving ? 'not-allowed' : 'pointer',
                      background: isShared ? '#f0fdf4' : 'white',
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
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({master.email})
                        </span>
                      )}
                    </span>
                    {isShared && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
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

      <SettingsGroup id="settings-data" title="Data & migration">
      {myRole === 'dev' && (
        <>
          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <button
            type="button"
              aria-expanded={dataBackupSectionOpen}
              onClick={() => setDataBackupSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{dataBackupSectionOpen ? '▼' : '▶'}</span>
              Data backup (dev)
          </button>
            {dataBackupSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', marginTop: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  Export projects, materials, bids, people & access, jobs, checklist, reports, prospects, or settings & reference as JSON for backup. Use &quot;Export all backup&quot; to download everything in one file. Files respect RLS. Export may take several minutes for large datasets and uses significant database resources.
                </p>
                {exportError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{exportError}</p>}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={exportProjectsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportProjectsLoading ? 'Exporting…' : 'Export projects backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportMaterialsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#065f46', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportMaterialsLoading ? 'Exporting…' : 'Export materials backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportBidsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#7c2d12', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportBidsLoading ? 'Exporting…' : 'Export bids backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportPeopleBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#4c1d95', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportPeopleLoading ? 'Exporting…' : 'Export people backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportJobsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#0e7490', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportJobsLoading ? 'Exporting…' : 'Export jobs backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportChecklistBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportChecklistLoading ? 'Exporting…' : 'Export checklist backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportReportsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportReportsLoading ? 'Exporting…' : 'Export reports backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportProspectsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#6b21a8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportProspectsLoading ? 'Exporting…' : 'Export prospects backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportSettingsBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    {exportSettingsLoading ? 'Exporting…' : 'Export settings backup'}
                  </button>
                  <button
                    type="button"
                    onClick={exportAllBackup}
                    disabled={exportBackupBusy}
                    style={{ padding: '0.5rem 1rem', background: '#111827', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {exportAllLoading ? 'Exporting…' : 'Export all backup'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      </SettingsGroup>

      <SettingsGroup id="settings-jobs" title="Jobs & dispatch">
      {myRole === 'dev' && (
        <>
          {/* Job creation overrides */}
          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setJobOwnerOverridesSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{jobOwnerOverridesSectionOpen ? '▼' : '▶'}</span>
              Job creation overrides
            </button>
            {jobOwnerOverridesSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  When a user creates a job, assign it to another user instead of themselves.
                </p>
                <form onSubmit={saveJobOwnerOverrides}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>User</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Create jobs as</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Jobs</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Re-assign all to</th>
                </tr>
              </thead>
              <tbody>
                        {users
                          .filter((u) => ['dev', 'master_technician', 'assistant'].includes(u.role))
                          .map((u) => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{u.name || u.email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                <select
                                  value={jobOwnerOverrideByUserId[u.id] ?? ''}
                                  onChange={(e) =>
                                    setJobOwnerOverrideByUserId((prev) => ({
                                      ...prev,
                                      [u.id]: e.target.value,
                                    }))
                                  }
                                  disabled={jobOwnerOverridesSaving}
                                  style={{ padding: '0.25rem 0.5rem', minWidth: 160 }}
                                >
                                  <option value="">Self</option>
                                  {users
                                    .filter((o) => ['master_technician', 'assistant'].includes(o.role) && o.id !== u.id)
                                    .map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.name || o.email}
                                      </option>
                                    ))}
                                </select>
                    </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{jobCountByUserId[u.id] ?? 0}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <select
                                    value={reassignTargetByUserId[u.id] ?? ''}
                                    onChange={(e) =>
                                      setReassignTargetByUserId((prev) => ({
                                        ...prev,
                                        [u.id]: e.target.value,
                                      }))
                                    }
                                    disabled={reassignSubmitting || (jobCountByUserId[u.id] ?? 0) === 0}
                                    style={{ padding: '0.25rem 0.5rem', minWidth: 140 }}
                                  >
                                    <option value="">—</option>
                                    {users
                                      .filter((o) => ['master_technician', 'assistant'].includes(o.role) && o.id !== u.id)
                                      .map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.name || o.email}
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const target = reassignTargetByUserId[u.id]
                                      if (target) {
                                        setReassignSourceUserId(u.id)
                                        setReassignTargetUserId(target)
                                        setReassignConfirmOpen(true)
                                      }
                                    }}
                                    disabled={
                                      reassignSubmitting ||
                                      (jobCountByUserId[u.id] ?? 0) === 0 ||
                                      !reassignTargetByUserId[u.id]
                                    }
                                    style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                                  >
                                    Re-assign
                                  </button>
                                </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
                  <button
                    type="submit"
                    disabled={jobOwnerOverridesSaving}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
                  >
                    {jobOwnerOverridesSaving ? 'Saving…' : 'Save job creation overrides'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {reassignConfirmOpen && reassignSourceUserId && reassignTargetUserId && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
                <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Re-assign jobs</h2>
                <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Re-assign {jobCountByUserId[reassignSourceUserId] ?? 0} jobs from {users.find((u) => u.id === reassignSourceUserId)?.name || 'Unknown'} to {users.find((u) => u.id === reassignTargetUserId)?.name || 'Unknown'}? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReassignConfirmOpen(false)
                      setReassignSourceUserId(null)
                      setReassignTargetUserId(null)
                    }}
                    disabled={reassignSubmitting}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmReassignJobs}
                    disabled={reassignSubmitting}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reassignSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {reassignSubmitting ? 'Re-assigning…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              aria-expanded={defaultLaborRateSectionOpen}
              onClick={() => setDefaultLaborRateSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{defaultLaborRateSectionOpen ? '▼' : '▶'}</span>
              Default Labor Rate (dev)
            </button>
            {defaultLaborRateSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', marginTop: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  Set the default Labor rate ($/hr) used when adding a new labor job in Jobs → + Labor. Leave blank for no default.
                </p>
                <form onSubmit={saveDefaultLaborRate} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label htmlFor="default-labor-rate" style={{ fontWeight: 500 }}>Labor rate ($/hr)</label>
                  <input
                    id="default-labor-rate"
                    type="number"
                    min={0}
                    step={0.01}
                    value={defaultLaborRate}
                    onChange={(e) => setDefaultLaborRate(e.target.value)}
                    placeholder="e.g. 75"
                    style={{ width: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                  <button
                    type="submit"
                    disabled={defaultLaborRateSaving}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: defaultLaborRateSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {defaultLaborRateSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
      </SettingsGroup>

      {myRole === 'dev' && (
        <>
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setProspectCopySectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{prospectCopySectionOpen ? '▼' : '▶'}</span>
              Prospect copy templates (dev)
            </button>
            {prospectCopySectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Default text for the three copy buttons in Prospects → Follow Up. Users can override with their own text. Placeholders: [User name], [user email], [user phone number], [company name], [prospect phone number], [prospect contact name], [prospect last contact], [prospect last successful contact] (and _______ for Phone call / Just checking in).
                </p>
                <form onSubmit={saveProspectCopyDefaults}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>No Response Email</label>
                    <input
                      type="text"
                      value={prospectCopyNoResponseSubject}
                      onChange={(e) => setProspectCopyNoResponseSubject(e.target.value)}
                      placeholder="Subject (e.g. Follow up - [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyNoResponse}
                      onChange={(e) => setProspectCopyNoResponse(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone call Follow up Email</label>
                    <input
                      type="text"
                      value={prospectCopyPhoneFollowupSubject}
                      onChange={(e) => setProspectCopyPhoneFollowupSubject(e.target.value)}
                      placeholder="Subject (e.g. Re: [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyPhoneFollowup}
                      onChange={(e) => setProspectCopyPhoneFollowup(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Just checking in Email</label>
                    <input
                      type="text"
                      value={prospectCopyJustCheckingInSubject}
                      onChange={(e) => setProspectCopyJustCheckingInSubject(e.target.value)}
                      placeholder="Subject (e.g. Re: [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyJustCheckingIn}
                      onChange={(e) => setProspectCopyJustCheckingIn(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={prospectCopySaving}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: prospectCopySaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {prospectCopySaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}

      {mergeDuplicatesModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
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
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Checking…</p>
            ) : mergeDuplicates.length === 0 ? (
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No duplicates found.</p>
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: '900px', width: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Orphaned material prices</h2>
                        <button
                          type="button"
                          onClick={() => {
                  setViewingOrphanPrices(false)
                  setOrphanError(null)
                  setOrphanPrices([])
                }}
                style={{ padding: '0.25rem 0.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
                        </button>
            </div>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
              These are material prices whose part or supply house no longer exists. They do not appear in the Materials Price Book.
            </p>
            {loadingOrphanPrices && <p>Loading orphaned prices…</p>}
            {orphanError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{orphanError}</p>}
            {!loadingOrphanPrices && orphanPrices.length === 0 && !orphanError && (
              <p style={{ marginBottom: '0.75rem', color: '#16a34a' }}>No orphaned prices found.</p>
            )}
            {!loadingOrphanPrices && orphanPrices.length > 0 && (
              <>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
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
                <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply house</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Effective date</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Reason</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanPrices.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                              style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
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

      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Invite via email</h2>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }}
                  required
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {inviteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{inviteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? 'Sending…' : 'Send invite'}
                </button>
                <button type="button" onClick={closeInvite} disabled={inviteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manualAddOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Manually add user</h2>
            <form onSubmit={handleManualAdd}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="manual-email"
                  type="email"
                  value={manualAddEmail}
                  onChange={(e) => { setManualAddEmail(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  autoComplete="username"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <PasswordInput
                  id="manual-password"
                  label="Initial password *"
                  value={manualAddPassword}
                  onChange={(e) => { setManualAddPassword(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="manual-role"
                  value={manualAddRole}
                  onChange={(e) => setManualAddRole(e.target.value as UserRole)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              {(manualAddRole === 'estimator' || manualAddRole === 'subcontractor') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Service types (optional)</label>
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>{manualAddRole === 'estimator' ? 'Leave unchecked for access to all service types. Select specific types to restrict.' : 'Leave unchecked for access to all. Select specific types to restrict job/bid association in Clock In and Dispatch.'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {serviceTypes.map((st) => (
                      <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={manualAddServiceTypeIds.includes(st.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setManualAddServiceTypeIds((prev) => [...prev, st.id])
                            } else {
                              setManualAddServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                            }
                          }}
                          disabled={manualAddSubmitting}
                        />
                        {st.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="manual-name"
                  type="text"
                  value={manualAddName}
                  onChange={(e) => setManualAddName(e.target.value)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {manualAddError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{manualAddError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={manualAddSubmitting}>
                  {manualAddSubmitting ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" onClick={closeManualAdd} disabled={manualAddSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Archive user</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Enter the user&apos;s email and/or name as shown in Active accounts. At least one field must match;
              the server finds the user by email first, then by name.
            </p>
            <form onSubmit={handleArchive}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  id="delete-email"
                  type="text"
                  value={deleteEmail}
                  onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null) }}
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-name" style={{ display: 'block', marginBottom: 4 }}>Name</label>
                <input
                  id="delete-name"
                  type="text"
                  value={deleteName}
                  onChange={(e) => { setDeleteName(e.target.value); setDeleteError(null) }}
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {deleteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={deleteSubmitting} style={{ color: '#b91c1c' }}>
                  {deleteSubmitting ? 'Archiving…' : 'Archive user'}
                </button>
                <button type="button" onClick={closeArchive} disabled={deleteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteReassignOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 500 }}>
            <h2 style={{ marginTop: 0 }}>Archive User & Reassign Customers</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Select a user to archive and a master to inherit their customers. 
              The user will be archived after all customers are reassigned.
            </p>
            <form onSubmit={handleArchiveReassign}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-reassign-user" style={{ display: 'block', marginBottom: 4 }}>
                  User to archive *
                </label>
                <select
                  id="delete-reassign-user"
                  value={deleteReassignUserId}
                  onChange={(e) => {
                    setDeleteReassignUserId(e.target.value)
                    setDeleteReassignError(null)
                  }}
                  required
                  disabled={deleteReassignSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select user...</option>
                  {users
                    .filter(u => u.role === 'master_technician' || u.role === 'dev')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {deleteReassignCustomerCount > 0 && (
                <p style={{ 
                  background: '#fef3c7', 
                  border: '1px solid #f59e0b', 
                  padding: '0.75rem', 
                  borderRadius: 4, 
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  ⚠️ This user has <strong>{deleteReassignCustomerCount}</strong> customer{deleteReassignCustomerCount !== 1 ? 's' : ''} that will be reassigned.
                </p>
              )}
              
              {deleteReassignUserId && deleteReassignCustomerCount === 0 && (
                <p style={{ 
                  background: '#e0e7ff', 
                  border: '1px solid #6366f1', 
                  padding: '0.75rem', 
                  borderRadius: 4, 
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  ℹ️ This user has no customers to reassign.
                </p>
              )}
              
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-reassign-new-master" style={{ display: 'block', marginBottom: 4 }}>
                  New master for customers *
                </label>
                <select
                  id="delete-reassign-new-master"
                  value={deleteReassignNewMasterId}
                  onChange={(e) => {
                    setDeleteReassignNewMasterId(e.target.value)
                    setDeleteReassignError(null)
                  }}
                  required
                  disabled={deleteReassignSubmitting || !deleteReassignUserId}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select new master...</option>
                  {users
                    .filter(u => 
                      (u.role === 'master_technician' || u.role === 'dev') &&
                      u.id !== deleteReassignUserId
                    )
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {deleteReassignError && (
                <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {deleteReassignError}
                </p>
              )}
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  type="submit" 
                  disabled={deleteReassignSubmitting || !deleteReassignUserId || !deleteReassignNewMasterId} 
                  style={{ 
                    padding: '0.5rem 1rem',
                    color: '#fff',
                    background: deleteReassignSubmitting || !deleteReassignUserId || !deleteReassignNewMasterId ? '#9ca3af' : '#dc2626',
                    border: 'none',
                    borderRadius: 4,
                    cursor: deleteReassignSubmitting || !deleteReassignUserId || !deleteReassignNewMasterId ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deleteReassignSubmitting ? 'Processing…' : 'Delete & Reassign'}
                </button>
                <button 
                  type="button" 
                  onClick={closeArchiveReassign} 
                  disabled={deleteReassignSubmitting}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {setPasswordUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Set password for {setPasswordUser.email}</h2>
            <form onSubmit={handleSetPassword}>
              <div style={{ marginBottom: '1rem' }}>
                <PasswordInput
                  id="set-password-new"
                  label="New password *"
                  value={setPasswordValue}
                  onChange={(e) => { setSetPasswordValue(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <PasswordInput
                  id="set-password-confirm"
                  label="Confirm password *"
                  value={setPasswordConfirm}
                  onChange={(e) => { setSetPasswordConfirm(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                />
              </div>
              {setPasswordError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{setPasswordError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={setPasswordSubmitting}>
                  {setPasswordSubmitting ? 'Setting…' : 'Set password'}
                </button>
                <button type="button" onClick={closeSetPassword} disabled={setPasswordSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SettingsGroup id="settings-catalogs" title="Catalogs & trades">
      {(myRole === 'dev' || myRole === 'estimator') && (
        <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setManagePartsSectionOpen((prev) => !prev)}
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
            <span style={{ fontSize: '0.75rem' }}>{managePartsSectionOpen ? '▼' : '▶'}</span>
            Manage Parts
          </button>
          {managePartsSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Duplicate Materials</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Find and delete duplicate material parts in the price book (matching names or 80%+ similarity).
          </p>
          <Link
            to="/duplicates"
            style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, textDecoration: 'none', fontWeight: 500, display: 'inline-block' }}
          >
            View Duplicate Materials
          </Link>
          {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Service Types</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage service types for categorizing bids and materials (Plumbing, Electrical, HVAC, etc.). These filters appear on the Materials and Bids pages.
          </p>
          
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => openEditServiceType(null)}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              + Add Service Type
            </button>
          </div>

          {serviceTypes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {serviceTypes.map((st, idx) => (
                <div key={st.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{st.name}</h3>
                        {st.color && (
                          <div style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: st.color, border: '1px solid #d1d5db' }}></div>
                        )}
                      </div>
                      {st.description && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{st.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => moveServiceType(st, 'up')}
                        disabled={idx === 0}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.875rem',
                          background: idx === 0 ? '#f3f4f6' : '#e5e7eb',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: idx === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveServiceType(st, 'down')}
                        disabled={idx === serviceTypes.length - 1}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.875rem',
                          background: idx === serviceTypes.length - 1 ? '#f3f4f6' : '#e5e7eb',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: idx === serviceTypes.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditServiceType(st)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteServiceType(st)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>No service types created yet.</p>
          )}

          {serviceTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                  {editingServiceType ? 'Edit Service Type' : 'Add Service Type'}
                </h3>
                
                {serviceTypeError && (
                  <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {serviceTypeError}
                  </div>
                )}
                
                <form onSubmit={saveServiceType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={serviceTypeName}
                      onChange={(e) => setServiceTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      required
                      autoFocus
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Description
                    </label>
                    <textarea
                      value={serviceTypeDescription}
                      onChange={(e) => setServiceTypeDescription(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minHeight: '80px' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Color (optional)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={serviceTypeColor || '#3b82f6'}
                        onChange={(e) => setServiceTypeColor(e.target.value)}
                        style={{ width: '60px', height: '40px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={serviceTypeColor}
                        onChange={(e) => setServiceTypeColor(e.target.value)}
                        placeholder="#3b82f6"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditServiceType}
                      disabled={serviceTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={serviceTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: serviceTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: serviceTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {serviceTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {(myRole === 'dev' || myRole === 'estimator') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Material Part Types</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage material part types for each service type. Material part types are used in the Materials system to categorize material parts (pipes, fittings, valves, etc.). This is separate from Takeoff, Labor, and Price Book Names which are used in Bids/Books for installed fixtures.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForParts}
              onChange={(e) => setSelectedServiceTypeForParts(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {visibleServiceTypesForMaterials.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForParts && (
            <>
              {myRole === 'estimator' && visibleServiceTypesForMaterials.length > 1 && (
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Showing part types for <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForParts)?.name ?? 'this service type'}</strong>. Change the service type above to see types for other trades.
                </p>
              )}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditPartType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Material Part Type
                </button>
                
                {canDeleteMaterialTypes && (
                <button
                  type="button"
                  onClick={removeAllUnusedPartTypes}
                  disabled={removingUnusedPartTypes || partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    background: removingUnusedPartTypes ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: removingUnusedPartTypes || partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 0.5 : 1
                  }}
                  title={partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 'No unused material part types' : `Remove ${partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length} unused material part type(s)`}
                >
                  {removingUnusedPartTypes ? 'Removing...' : 'Remove All Unused Material Part Types'}
                </button>
                )}
              </div>

              {partTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {partTypes.map((pt, idx) => (
                    <div key={pt.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{pt.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (partTypePartCounts[pt.id] ?? 0) > 0 ? '#d1fae5' : '#f3f4f6',
                                color: (partTypePartCounts[pt.id] ?? 0) > 0 ? '#065f46' : '#6b7280',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title={`${partTypePartCounts[pt.id] || 0} material part${partTypePartCounts[pt.id] === 1 ? '' : 's'} assigned`}
                            >
                              {partTypePartCounts[pt.id] || 0} part{partTypePartCounts[pt.id] === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => movePartType(pt, 'up')}
                            disabled={idx === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === 0 ? '#f3f4f6' : '#e5e7eb',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              cursor: idx === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => movePartType(pt, 'down')}
                            disabled={idx === partTypes.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === partTypes.length - 1 ? '#f3f4f6' : '#e5e7eb',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              cursor: idx === partTypes.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPartType(pt)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          {canDeleteMaterialTypes && (
                          <button
                            type="button"
                            onClick={() => deletePartType(pt)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  No material part types yet. Click "Add Material Part Type" to create one.
                </div>
              )}
            </>
          )}

          {partTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingPartType ? 'Edit Material Part Type' : 'Add Material Part Type'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForParts)?.name}</strong>
                  </span>
                </div>
                
                {partTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, color: '#b91c1c' }}>
                    {partTypeError}
                  </div>
                )}
                
                <form onSubmit={savePartType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={partTypeName}
                      onChange={(e) => setPartTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Pipe, Fitting, Valve, Sink, Faucet"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditPartType}
                      disabled={partTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={partTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: partTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: partTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {partTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {(myRole === 'dev' || myRole === 'estimator') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Material Assembly Types</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage assembly types for each service type. Assembly types are used in the Materials system to categorize material assemblies/templates (e.g., Bathroom, Kitchen, Utility). This helps organize and filter assemblies.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForAssemblies}
              onChange={(e) => setSelectedServiceTypeForAssemblies(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {visibleServiceTypesForMaterials.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForAssemblies && (
            <>
              {myRole === 'estimator' && visibleServiceTypesForMaterials.length > 1 && (
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Showing assembly types for <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForAssemblies)?.name ?? 'this service type'}</strong>. Change the service type above to see types for other trades.
                </p>
              )}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditAssemblyType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Assembly Type
                </button>
                
                {canDeleteMaterialTypes && (
                <button
                  type="button"
                  onClick={removeAllUnusedAssemblyTypes}
                  disabled={removingUnusedAssemblyTypes || assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    background: removingUnusedAssemblyTypes ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: removingUnusedAssemblyTypes || assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 0.5 : 1
                  }}
                  title={assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 'No unused assembly types' : `Remove ${assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length} unused assembly type(s)`}
                >
                  {removingUnusedAssemblyTypes ? 'Removing...' : 'Remove All Unused Assembly Types'}
                </button>
                )}
              </div>

              {assemblyTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {assemblyTypes.map((at, idx) => (
                    <div key={at.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{at.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (assemblyTypeAssemblyCounts[at.id] ?? 0) > 0 ? '#d1fae5' : '#f3f4f6',
                                color: (assemblyTypeAssemblyCounts[at.id] ?? 0) > 0 ? '#065f46' : '#6b7280',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title={`${assemblyTypeAssemblyCounts[at.id] || 0} assembl${assemblyTypeAssemblyCounts[at.id] === 1 ? 'y' : 'ies'} assigned`}
                            >
                              {assemblyTypeAssemblyCounts[at.id] || 0} assembl{assemblyTypeAssemblyCounts[at.id] === 1 ? 'y' : 'ies'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => moveAssemblyType(at, 'up')}
                            disabled={idx === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === 0 ? '#f3f4f6' : '#e5e7eb',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              cursor: idx === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAssemblyType(at, 'down')}
                            disabled={idx === assemblyTypes.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === assemblyTypes.length - 1 ? '#f3f4f6' : '#e5e7eb',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              cursor: idx === assemblyTypes.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAssemblyType(at)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          {canDeleteMaterialTypes && (
                          <button
                            type="button"
                            onClick={() => deleteAssemblyType(at)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  No assembly types yet. Click "Add Assembly Type" to create one.
                </div>
              )}
            </>
          )}

          {assemblyTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingAssemblyType ? 'Edit Assembly Type' : 'Add Assembly Type'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForAssemblies)?.name}</strong>
                  </span>
                </div>
                
                {assemblyTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, color: '#b91c1c' }}>
                    {assemblyTypeError}
                  </div>
                )}
                
                <form onSubmit={saveAssemblyType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={assemblyTypeName}
                      onChange={(e) => setAssemblyTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Bathroom, Kitchen, Utility, Commercial"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditAssemblyType}
                      disabled={assemblyTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assemblyTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: assemblyTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: assemblyTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {assemblyTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Takeoff, Labor, and Price Book Names</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Book names are the fixture and tie-in names (e.g., Toilet, Kitchen Sink, Water Heater) used across the Takeoff, Labor, and Price books. Each row shows a name with badges indicating how many entries in each book use it. These names appear in Bids Counts and when adding or editing book entries. New names can also be created automatically when adding book entries. Note: Materials uses Material Part Types for categorizing parts and supplies.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForFixtures}
              onChange={(e) => setSelectedServiceTypeForFixtures(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForFixtures && (
            <>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditFixtureType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Book Name
                </button>
                <button
                  type="button"
                  onClick={() => removeUnusedFixtureTypes()}
                  disabled={removingUnusedFixtureTypes}
                  title="Remove book names with 0 takeoff, 0 labor, 0 price"
                  style={{ padding: '0.5rem 1rem', background: removingUnusedFixtureTypes ? '#d1d5db' : '#f3f4f6', color: 'inherit', border: '1px solid #d1d5db', borderRadius: 4, cursor: removingUnusedFixtureTypes ? 'not-allowed' : 'pointer'
                  }}
                >
                  {removingUnusedFixtureTypes ? 'Removing…' : 'Remove unused book names (0 takeoff, 0 labor, 0 price)'}
                </button>
              </div>

              {fixtureTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fixtureTypes.map((ft) => (
                    <div key={ft.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{ft.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypeTakeoffBookCounts[ft.id] ?? 0) > 0 ? '#ede9fe' : '#f3f4f6',
                                color: (fixtureTypeTakeoffBookCounts[ft.id] ?? 0) > 0 ? '#5b21b6' : '#6b7280',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Takeoff book entries"
                            >
                              {fixtureTypeTakeoffBookCounts[ft.id] || 0} takeoff
                            </span>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypeLaborBookCounts[ft.id] ?? 0) > 0 ? '#dbeafe' : '#f3f4f6',
                                color: (fixtureTypeLaborBookCounts[ft.id] ?? 0) > 0 ? '#1e40af' : '#6b7280',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Labor book entries"
                            >
                              {fixtureTypeLaborBookCounts[ft.id] || 0} labor
                            </span>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypePriceBookCounts[ft.id] ?? 0) > 0 ? '#d1fae5' : '#f3f4f6',
                                color: (fixtureTypePriceBookCounts[ft.id] ?? 0) > 0 ? '#065f46' : '#6b7280',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Price book entries"
                            >
                              {fixtureTypePriceBookCounts[ft.id] || 0} price
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => openEditFixtureType(ft)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFixtureType(ft)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  No book names yet. Click "Add Book Name" to create one.
                </div>
              )}
            </>
          )}

          {fixtureTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingFixtureType ? 'Edit Book Name' : 'Add Book Name'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForFixtures)?.name}</strong>
                  </span>
                </div>
                
                {fixtureTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, color: '#b91c1c' }}>
                    {fixtureTypeError}
                  </div>
                )}
                
                <form onSubmit={saveFixtureType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={fixtureTypeName}
                      onChange={(e) => setFixtureTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Toilet, Kitchen Sink, Water Heater"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditFixtureType}
                      disabled={fixtureTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={fixtureTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: fixtureTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: fixtureTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {fixtureTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Counts Quick-add Names</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Quick-select fixture groups shown when adding count rows in Bids. Each service type (Plumbing, Electrical, HVAC) has its own set of groups and fixtures.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Service Type *</label>
            <select
              value={selectedServiceTypeForCountsFixtures}
              onChange={(e) => setSelectedServiceTypeForCountsFixtures(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
          {selectedServiceTypeForCountsFixtures && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => openEditCountsFixtureGroup(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Group
                </button>
              </div>
              {countsFixtureGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {countsFixtureGroups.map((grp, gIdx) => (
                    <div key={grp.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{grp.label}</span>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button type="button" onClick={() => moveCountsFixtureGroup(grp, 'up')} disabled={gIdx === 0} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>↑</button>
                          <button type="button" onClick={() => moveCountsFixtureGroup(grp, 'down')} disabled={gIdx === countsFixtureGroups.length - 1} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>↓</button>
                          <button type="button" onClick={() => openEditCountsFixtureGroup(grp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>Edit</button>
                          <button type="button" onClick={() => openEditCountsFixtureItem(grp, null)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Fixture</button>
                          <button type="button" onClick={() => deleteCountsFixtureGroup(grp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {countsFixtureGroupItems
                          .filter((i) => i.group_id === grp.id)
                          .sort((a, b) => a.sequence_order - b.sequence_order)
                          .map((item, iIdx) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button type="button" onClick={() => moveCountsFixtureItem(item, 'up')} disabled={iIdx === 0} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>↑</button>
                              <button type="button" onClick={() => moveCountsFixtureItem(item, 'down')} disabled={iIdx === countsFixtureGroupItems.filter((x) => x.group_id === grp.id).length - 1} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>↓</button>
                              <span style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem' }}>{item.name}</span>
                              <button type="button" onClick={() => openEditCountsFixtureItem(grp, item)} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>Edit</button>
                              <button type="button" onClick={() => deleteCountsFixtureItem(item)} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>×</button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  No groups yet. Click "Add Group" to create one (e.g. Bathrooms:, Kitchen:).
                </div>
              )}
            </>
          )}
          {countsFixtureGroupFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
                <h3 style={{ margin: '0 0 1rem' }}>{editingCountsFixtureGroup ? 'Edit Group' : 'Add Group'}</h3>
                {countsFixtureGroupError && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#fef2f2', color: '#b91c1c', borderRadius: 4, fontSize: '0.875rem' }}>{countsFixtureGroupError}</div>}
                <form onSubmit={saveCountsFixtureGroup}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Group label (e.g. Bathrooms:, Kitchen:)</label>
                  <input type="text" value={countsFixtureGroupLabel} onChange={(e) => setCountsFixtureGroupLabel(e.target.value)} placeholder="Bathrooms:" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem' }} required />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeEditCountsFixtureGroup} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                    <button type="submit" disabled={countsFixtureGroupSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{countsFixtureGroupSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {countsFixtureItemFormOpen && editingCountsFixtureGroupForItem && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
                <h3 style={{ margin: '0 0 1rem' }}>{editingCountsFixtureItem ? 'Edit Fixture' : 'Add Fixture'}</h3>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Group: {editingCountsFixtureGroupForItem.label}</p>
                {countsFixtureItemError && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#fef2f2', color: '#b91c1c', borderRadius: 4, fontSize: '0.875rem' }}>{countsFixtureItemError}</div>}
                <form onSubmit={saveCountsFixtureItem}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture name</label>
                  <input type="text" value={countsFixtureItemName} onChange={(e) => setCountsFixtureItemName(e.target.value)} placeholder="e.g. Toilets, Kitchen sinks" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem' }} required />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeEditCountsFixtureItem} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                    <button type="submit" disabled={countsFixtureItemSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{countsFixtureItemSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Maintenance: Materials prices</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Review and clean up material prices that don&apos;t match any part or supply house (these won&apos;t appear in the Price Book).
          </p>
          <button
            type="button"
            onClick={() => {
              setViewingOrphanPrices(true)
              loadOrphanMaterialPrices()
            }}
            style={{ padding: '0.5rem 1rem', background: '#92400e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Review orphaned material prices
          </button>
          </div>
          )}
        </div>
      )}
      </SettingsGroup>

      <SettingsGroup id="settings-templates" title="Templates & testing">
      {myRole === 'dev' && (
        <>
          <p style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Choose who receives <strong>notification</strong> and <strong>email</strong> template tests (push goes to their devices; email goes to their account email).
          </p>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="templates-test-target" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Test target (notifications and email):
            </label>
            <select
              id="templates-test-target"
              value={templateTestTargetUserId}
              onChange={(e) => {
                setTemplateTestTargetUserId(e.target.value)
                setNotificationTestError(null)
                setNotificationTestSuccess(null)
                setTestError(null)
                setWorkflowFnTestError(null)
                setWorkflowFnTestSuccess(null)
              }}
              style={{ padding: '0.35rem 0.5rem', minWidth: 200 }}
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === authUser?.id ? `${u.name || u.email} (Me)` : u.name || u.email}
                </option>
              ))}
            </select>
            {notificationTestSuccess && (
              <span style={{ color: '#059669', fontSize: '0.875rem' }}>{notificationTestSuccess}</span>
            )}
            {notificationTestError && (
              <span style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{notificationTestError}</span>
            )}
          </div>

          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setWorkflowFnEmailSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{workflowFnEmailSectionOpen ? '▼' : '▶'}</span>
              Workflow email (Edge Function)
            </button>
            {workflowFnEmailSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 0.75rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Calls <code style={{ fontSize: '0.8125rem' }}>send-workflow-notification</code> so the server loads{' '}
                  <code style={{ fontSize: '0.8125rem' }}>email_templates</code> by type and sends via Resend (not the{' '}
                  <code style={{ fontSize: '0.8125rem' }}>test-email</code> shortcut). Does not write{' '}
                  <code style={{ fontSize: '0.8125rem' }}>notification_history</code>.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="workflow-fn-test-template" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    Template type:
                  </label>
                  <select
                    id="workflow-fn-test-template"
                    value={workflowFnTestTemplateType}
                    onChange={(e) => {
                      setWorkflowFnTestTemplateType(e.target.value as WorkflowFnEmailTemplateType)
                      setWorkflowFnTestError(null)
                      setWorkflowFnTestSuccess(null)
                    }}
                    style={{ padding: '0.35rem 0.5rem', minWidth: 220 }}
                  >
                    {WORKFLOW_FN_EMAIL_TEST_OPTIONS.map((o) => (
                      <option key={o.type} value={o.type}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void sendWorkflowNotificationEmailTest()}
                    disabled={
                      !templateTestTargetUserId ||
                      workflowFnTestSending ||
                      !emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType)
                    }
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    {workflowFnTestSending ? 'Sending…' : 'Send test'}
                  </button>
                </div>
                {!emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType) && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#b45309', fontSize: '0.8125rem' }}>
                    Create this template under Email Templates below to enable the button.
                  </p>
                )}
                {workflowFnTestSuccess && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#059669', fontSize: '0.875rem' }}>{workflowFnTestSuccess}</p>
                )}
                {workflowFnTestError && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#b91c1c', fontSize: '0.875rem' }}>{workflowFnTestError}</p>
                )}
              </div>
            )}
          </div>

          {/* Notification Templates - collapsible, above Email Templates */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setNotificationTemplatesSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{notificationTemplatesSectionOpen ? '▼' : '▶'}</span>
              Notification Templates
            </button>
            {notificationTemplatesSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize push notification title and body shown to users. Use variables like {NOTIFICATION_VARIABLE_HINT}.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { type: 'checklist_completed' as const, label: 'Checklist completed', description: 'When a checklist item is completed' },
                    { type: 'test_notification' as const, label: 'Test notification', description: 'Settings test notification' },
                    { type: 'stage_assigned_started' as const, label: 'Stage started (assigned)', description: 'Workflow stage started, sent to assigned person' },
                    { type: 'stage_assigned_complete' as const, label: 'Stage completed (assigned)', description: 'Workflow stage completed, sent to assigned person' },
                    { type: 'stage_assigned_reopened' as const, label: 'Stage re-opened (assigned)', description: 'Workflow stage re-opened, sent to assigned person' },
                    { type: 'stage_me_started' as const, label: 'Stage started (ME)', description: 'Subscribed stage started' },
                    { type: 'stage_me_complete' as const, label: 'Stage completed (ME)', description: 'Subscribed stage completed' },
                    { type: 'stage_me_reopened' as const, label: 'Stage re-opened (ME)', description: 'Subscribed stage re-opened' },
                    { type: 'stage_next_complete_or_approved' as const, label: 'Your turn', description: 'Next stage ready after previous completed/approved' },
                    { type: 'stage_prior_rejected' as const, label: 'Prior work incomplete', description: 'Prior work incomplete, sent to prior assignee' },
                  ].map(({ type, label, description }) => {
                    const template = notificationTemplates.find(t => t.template_type === type)
                    return (
                      <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => template && sendTestNotificationTemplate(template)}
                              disabled={!template || !templateTestTargetUserId || !!notificationTestSending}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              {notificationTestSending === type ? 'Sending…' : 'Test'}
                            </button>
                            <button
                              type="button"
                              onClick={() => template && openEditNotificationTemplate(template)}
                              disabled={!template}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        {template && (
                          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            <div><strong>Title:</strong> {template.push_title}</div>
                            <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                              <strong>Body:</strong> {template.push_body.substring(0, 100)}{template.push_body.length > 100 ? '...' : ''}
                            </div>
                            {template.updated_at && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                                Last updated: {new Date(template.updated_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Email Templates - collapsible, collapsed by default */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setEmailTemplatesSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{emailTemplatesSectionOpen ? '▼' : '▶'}</span>
              Email Templates
            </button>
            {emailTemplatesSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  Note: Create an account · Forgot password? has been hidden on the sign in page.
                </p>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize the content of emails sent to users. Use variables like {VARIABLE_HINT} in your templates.
                </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>User Management</h3>
            {[
              { type: 'invitation' as const, label: 'Invitation Email', description: 'Sent when inviting a new user' },
              { type: 'sign_in' as const, label: 'Sign-In Email', description: 'Sent when requesting a sign-in link' },
              { type: 'login_as' as const, label: 'Login As Email', description: 'Sent when dev logs in as another user' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h3 style={{ margin: '1.5rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Workflow Stage Notifications</h3>
            <h4 style={{ margin: '0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Assigned Person</h4>
            {[
              { type: 'stage_assigned_started' as const, label: 'Stage Started (Assigned)', description: 'Sent to assigned person when stage is started' },
              { type: 'stage_assigned_complete' as const, label: 'Stage Complete (Assigned)', description: 'Sent to assigned person when stage is completed' },
              { type: 'stage_assigned_reopened' as const, label: 'Stage Re-opened (Assigned)', description: 'Sent to assigned person when stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Me (Current User)</h4>
            {[
              { type: 'stage_me_started' as const, label: 'Stage Started (ME)', description: 'Sent to you when a subscribed stage is started' },
              { type: 'stage_me_complete' as const, label: 'Stage Complete (ME)', description: 'Sent to you when a subscribed stage is completed' },
              { type: 'stage_me_reopened' as const, label: 'Stage Re-opened (ME)', description: 'Sent to you when a subscribed stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Cross-Step Notifications</h4>
            {[
              { type: 'stage_next_complete_or_approved' as const, label: 'Next Stage Ready', description: 'Sent to next stage assignee when current stage is completed or approved' },
              { type: 'stage_prior_rejected' as const, label: 'Prior work incomplete', description: 'Sent to prior stage assignee when their stage is marked incomplete' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
                </div>
              </div>
            )}
          </div>

          {editingTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>
                  Edit {editingTemplate.template_type === 'invitation' ? 'Invitation' : 
                    editingTemplate.template_type === 'sign_in' ? 'Sign-In' : 
                    editingTemplate.template_type === 'login_as' ? 'Login As' :
                    editingTemplate.template_type === 'stage_assigned_started' ? 'Stage Started (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_complete' ? 'Stage Complete (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_reopened' ? 'Stage Re-opened (Assigned)' :
                    editingTemplate.template_type === 'stage_me_started' ? 'Stage Started (ME)' :
                    editingTemplate.template_type === 'stage_me_complete' ? 'Stage Complete (ME)' :
                    editingTemplate.template_type === 'stage_me_reopened' ? 'Stage Re-opened (ME)' :
                    editingTemplate.template_type === 'stage_next_complete_or_approved' ? 'Next Stage Ready' :
                    editingTemplate.template_type === 'stage_prior_rejected' ? 'Prior work incomplete' :
                    'Email'} Template
                </h2>
                <form onSubmit={saveEmailTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-subject" style={{ display: 'block', marginBottom: 4 }}>Subject *</label>
                    <input
                      id="template-subject"
                      type="text"
                      value={templateSubject}
                      onChange={(e) => { setTemplateSubject(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      placeholder="e.g., Welcome to PipeTooling"
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-body" style={{ display: 'block', marginBottom: 4 }}>Body *</label>
                    <textarea
                      id="template-body"
                      value={templateBody}
                      onChange={(e) => { setTemplateBody(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      rows={12}
                      placeholder="e.g., Hi {{name}},&#10;&#10;You've been invited to join PipeTooling as a {{role}}. Click the link below to set up your account:&#10;&#10;{{link}}"
                      style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  {templateError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{templateError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={templateSaving}>
                      {templateSaving ? 'Saving…' : 'Save template'}
                    </button>
                    <button 
                      type="button" 
                      onClick={testCurrentTemplate}
                      disabled={templateSaving || !templateSubject.trim() || !templateBody.trim() || !templateTestTargetUserId}
                      style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                    >
                      Test Email
                    </button>
                    <button type="button" onClick={closeEditTemplate} disabled={templateSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingNotificationTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>
                  Edit Notification: {editingNotificationTemplate.template_type.replace(/_/g, ' ')}
                </h2>
                <form onSubmit={saveNotificationTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="notification-template-title" style={{ display: 'block', marginBottom: 4 }}>Push Title *</label>
                    <input
                      id="notification-template-title"
                      type="text"
                      value={notificationTemplateTitle}
                      onChange={(e) => { setNotificationTemplateTitle(e.target.value); setNotificationTemplateError(null) }}
                      required
                      disabled={notificationTemplateSaving}
                      placeholder="e.g., Checklist completed"
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="notification-template-body" style={{ display: 'block', marginBottom: 4 }}>Push Body *</label>
                    <textarea
                      id="notification-template-body"
                      value={notificationTemplateBody}
                      onChange={(e) => { setNotificationTemplateBody(e.target.value); setNotificationTemplateError(null) }}
                      required
                      disabled={notificationTemplateSaving}
                      rows={6}
                      placeholder="e.g., {{assignee_name}} completed {{item_title}}"
                      style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Variables: {NOTIFICATION_VARIABLE_HINT}
                    </p>
                  </div>
                  {notificationTemplateError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{notificationTemplateError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={notificationTemplateSaving}>
                      {notificationTemplateSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={closeEditNotificationTemplate} disabled={notificationTemplateSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {testingTemplate && (() => {
            const testTargetUser = templateTestTargetUserId
              ? users.find((u) => u.id === templateTestTargetUserId)
              : undefined
            const testTargetEmail = testTargetUser?.email?.trim() ?? ''
            const testRecipientLabel =
              testTargetEmail && (testTargetUser?.name || '').trim()
                ? `${(testTargetUser?.name || '').trim()} <${testTargetEmail}>`
                : testTargetEmail || '—'
            return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400 }}>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Send a test email to <strong>{testRecipientLabel}</strong> (the user selected under <strong>Test target</strong> above). Variables like {'{{name}}'}, {'{{email}}'}, and {'{{role}}'} use that user&apos;s data; other placeholders use sample values.
                </p>
                <form onSubmit={sendTestEmail}>
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4, fontSize: '0.875rem' }}>
                    <div><strong>Template:</strong> {testingTemplate.template_type}</div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Subject:</strong> {testingTemplate.subject}</div>
                    <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Body Preview:</strong><br />{testingTemplate.body.substring(0, 200)}{testingTemplate.body.length > 200 ? '...' : ''}</div>
                  </div>
                  {testError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{testError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={testSending || !templateTestTargetUserId || !testTargetEmail}>
                      {testSending ? 'Sending…' : 'Send Test Email'}
                    </button>
                    <button type="button" onClick={closeTestEmail} disabled={testSending}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
            )
          })()}

          {/* Dashboard: Report Review - collapsible, dev-only */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setReportSettingsSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{reportSettingsSectionOpen ? '▼' : '▶'}</span>
              Dashboard: Report Review
            </button>
            {reportSettingsSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <form onSubmit={saveReportSettings}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Report edit window (days)</label>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Days subcontractors can edit their own reports after creation.</p>
                    <input type="number" min={0} step={1} value={reportEditWindowDays} onChange={(e) => setReportEditWindowDays(e.target.value)} style={{ width: '6rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Subcontractor report visibility (months)</label>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Months subcontractors can see their own reports.</p>
                    <input type="number" min={0} step={1} value={reportSubVisibilityMonths} onChange={(e) => setReportSubVisibilityMonths(e.target.value)} style={{ width: '6rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Report-enabled users</h3>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Subcontractors and primaries selected here can see the Recent Reports section on their Dashboard. Unselected users do not see Recent Reports. All users can create reports via the Job Report button.</p>
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, padding: '0.5rem' }}>
                      {users.filter((u) => u.role === 'subcontractor' || u.role === 'primary').map((u) => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                          <input type="checkbox" checked={reportEnabledUserIds.has(u.id)} onChange={() => toggleReportEnabledUser(u.id)} />
                          <span>{u.name || u.email}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({u.role})</span>
                        </label>
                      ))}
                      {users.filter((u) => u.role === 'subcontractor' || u.role === 'primary').length === 0 && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No subcontractors or primaries.</p>
                      )}
                    </div>
                  </div>
                  <button type="submit" disabled={reportSettingsSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reportSettingsSaving ? 'not-allowed' : 'pointer' }}>
                    {reportSettingsSaving ? 'Saving…' : 'Save report settings'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
      </SettingsGroup>

      {myRole !== 'subcontractor' && (
      <div id="settings-advanced-tools" style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setAdvancedSectionOpen((prev) => !prev)}
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
            fontSize: '0.9375rem',
            fontWeight: 500,
            textAlign: 'left',
            color: '#6b7280',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{advancedSectionOpen ? '▼' : '▶'}</span>
          Advanced
        </button>
        {advancedSectionOpen && (
          <div style={{ padding: '1rem 0 0 0' }}>
            <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
              <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Fix app</h2>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                If the app shows a white screen after an update (e.g. phone was open during deploy), open{' '}
                <a href="/fix-cache.html" style={{ color: '#2563eb', fontWeight: 500 }}>
                  Fix app
                </a>{' '}
                to clear cached files and reload. Bookmark this link to use when the app won&apos;t load.
              </p>
            </div>
            <form onSubmit={handleClaimCode}>
              <label htmlFor="code" style={{ display: 'block', marginBottom: 4 }}>Enter code</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setCodeError(null) }}
                  disabled={codeSubmitting}
                  placeholder="Admin code"
                  style={{ padding: '0.5rem', minWidth: 160 }}
                  autoComplete="one-time-code"
                />
                <button type="submit" disabled={codeSubmitting || !code.trim()}>
                  {codeSubmitting ? 'Checking…' : 'Submit'}
                </button>
              </div>
              {codeError && <p style={{ color: '#b91c1c', marginTop: 4, marginBottom: 0 }}>{codeError}</p>}
            </form>
          </div>
        )}
      </div>
      )}

      {showMyReports && (
        <>
          <ReportViewModal
            open={viewReportModalOpen}
            report={selectedReport}
            onClose={() => { setViewReportModalOpen(false); setSelectedReport(null) }}
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

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#f9fafb' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
            PipeTooling helps Masters better manage Projects with Subs.
            <br />
            Three types of People: Masters, Assistants, Subs
          </div>
          <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem', fontWeight: 600 }}>How It Works</h2>
          <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
            <li style={{ marginBottom: '0.5rem' }}>Master accounts have Customers</li>
            <li style={{ marginBottom: '0.5rem' }}>Customers can have Projects</li>
            <li style={{ marginBottom: '0.5rem' }}>Masters assign People to Project Stages</li>
            <li>When People complete Stages, Masters are updated</li>
          </ol>
          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
            <strong>Sharing</strong>:
            <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, listStyle: 'disc' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                Masters can choose to adopt assistants in Settings
                <div style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                  → they can manage stages and see private notes but not financial totals
                </div>
              </li>
              <li>
                Masters can choose to share with other Masters
                <div style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                  → they have the same permissions as assistants
                </div>
              </li>
            </ul>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
            <strong>Subcontractors</strong>:
            <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, listStyle: 'disc' }}>
              <li>Only see a stage when it is assigned to them</li>
              <li>Can only Start and Complete their stages</li>
              <li>Cannot see private notes or financials</li>
              <li>Cannot add, edit, delete, or assign stages</li>
            </ul>
            <div style={{ marginTop: '0.5rem' }}>
              When a Master or Assistant selects to Notify when a stage updates, that stage will show up in their Subscribed Stages on the Dashboard.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
