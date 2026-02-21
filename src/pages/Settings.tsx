import React, { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { useAuth } from '../hooks/useAuth'
import { addPinForUser, clearPinned, clearPinnedInSupabase, deletePinForPathAndTab, getUsersWithPin } from '../lib/pinnedTabs'
import { useCostMatrixTotal } from '../hooks/useCostMatrixTotal'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useUpdatePrompt } from '../contexts/UpdatePromptContext'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole
  last_sign_in_at: string | null
  estimator_service_type_ids?: string[] | null
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

const ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator']

const VARIABLE_HINT = '{{name}}, {{email}}, {{role}}, {{link}}'
const NOTIFICATION_VARIABLE_HINT = '{{assignee_name}}, {{item_title}}, {{name}}, {{stage_name}}, {{project_name}}, {{assigned_to_name}}, {{next_stage_name}}, {{rejection_reason}}'

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

export default function Settings() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const pushNotifications = usePushNotifications(authUser?.id)
  const updatePrompt = useUpdatePrompt()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
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
  const [pinsClearSuccess, setPinsClearSuccess] = useState(false)
  // AR pin to dashboard (dev-only)
  const [pinARMasterIds, setPinARMasterIds] = useState<Set<string>>(new Set())
  const [pinARSaving, setPinARSaving] = useState(false)
  const [pinARUnpinSaving, setPinARUnpinSaving] = useState(false)
  const [pinARMessage, setPinARMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [arTotal, setArTotal] = useState<number | null>(null)
  // Supply Houses AP pin to dashboard (dev-only)
  const [pinAPMasterIds, setPinAPMasterIds] = useState<Set<string>>(new Set())
  const [pinAPSaving, setPinAPSaving] = useState(false)
  const [pinAPUnpinSaving, setPinAPUnpinSaving] = useState(false)
  const [pinAPMessage, setPinAPMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [apTotal, setApTotal] = useState<number | null>(null)
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
  const [sendingSignInEmailId, setSendingSignInEmailId] = useState<string | null>(null)
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)
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
  const [editError, setEditError] = useState<string | null>(null)
  const [defaultLaborRate, setDefaultLaborRate] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  
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
  const [maintenanceMaterialsPricesExpanded, setMaintenanceMaterialsPricesExpanded] = useState(false)
  const [orphanPrices, setOrphanPrices] = useState<OrphanedPriceRow[]>([])
  const [loadingOrphanPrices, setLoadingOrphanPrices] = useState(false)
  const [orphanError, setOrphanError] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  async function handleTestNotification() {
    if (!authUser?.id) return
    setTestNotificationError(null)
    setTestNotificationSuccess(null)
    setTestNotificationSending(true)
    try {
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr) {
        setTestNotificationError('Session expired. Please sign out and sign back in.')
        return
      }
      const { data, error } = await supabase.functions.invoke('send-checklist-notification', {
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

  const [convertMasterId, setConvertMasterId] = useState<string>('')
  const [convertNewMasterId, setConvertNewMasterId] = useState<string>('')
  const [convertNewRole, setConvertNewRole] = useState<'assistant' | 'subcontractor'>('assistant')
  const [convertAutoAdopt, setConvertAutoAdopt] = useState<boolean>(true)
  const [convertSubmitting, setConvertSubmitting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertMasterSectionOpen, setConvertMasterSectionOpen] = useState(false)
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false)
  const [emailTemplatesSectionOpen, setEmailTemplatesSectionOpen] = useState(false)
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([])
  const [notificationTemplatesSectionOpen, setNotificationTemplatesSectionOpen] = useState(false)
  const [editingNotificationTemplate, setEditingNotificationTemplate] = useState<NotificationTemplate | null>(null)
  const [notificationTemplateTitle, setNotificationTemplateTitle] = useState('')
  const [notificationTemplateBody, setNotificationTemplateBody] = useState('')
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false)
  const [notificationTemplateError, setNotificationTemplateError] = useState<string | null>(null)
  const [notificationTestTargetUserId, setNotificationTestTargetUserId] = useState('')
  const [notificationTestSending, setNotificationTestSending] = useState<string | null>(null)
  const [notificationTestError, setNotificationTestError] = useState<string | null>(null)
  const [notificationTestSuccess, setNotificationTestSuccess] = useState<string | null>(null)
  const [editingNonUserPerson, setEditingNonUserPerson] = useState<PersonRow | null>(null)
  const [editPersonName, setEditPersonName] = useState('')
  const [editPersonEmail, setEditPersonEmail] = useState('')
  const [editPersonPhone, setEditPersonPhone] = useState('')
  const [editPersonNotes, setEditPersonNotes] = useState('')
  const [editPersonSaving, setEditPersonSaving] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null)
  const [convertSummary, setConvertSummary] = useState<string | null>(null)
  const [exportProjectsLoading, setExportProjectsLoading] = useState(false)
  const [exportMaterialsLoading, setExportMaterialsLoading] = useState(false)
  const [exportBidsLoading, setExportBidsLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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

  async function loadArTotalAndPinnedUsers() {
    if (myRole !== 'dev') return
    const [arRes, pinnedRes] = await Promise.all([
      supabase.from('jobs_receivables').select('amount'),
      getUsersWithPin('/jobs', 'receivables'),
    ])
    const total = (arRes.data ?? []).reduce((sum, r) => sum + Number((r as { amount: number }).amount ?? 0), 0)
    setArTotal(total)
    setPinARMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
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
      .select('role, estimator_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    
    // Load assistants and adoptions for masters and devs
    if (role === 'master_technician' || role === 'dev') {
      await loadAssistantsAndAdoptions(authUser.id)
      await loadMastersAndShares(authUser.id)
    }
    
    // Load dev-only data (users, people, etc.)
    if (role === 'dev') {
    const { data: list, error: eList } = await supabase
      .from('users')
      .select('id, email, name, role, last_sign_in_at, estimator_service_type_ids')
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
    
    // Load all people entries (RLS may restrict, but we'll filter client-side)
    // Note: RLS policy may need to allow owners to see all people entries
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
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
    }
    
    setLoading(false)
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

  async function loadPeopleForDev() {
    if (!authUser?.id || myRole !== 'dev') return
    const { data: list } = await supabase.from('users').select('id, email, name').order('name')
    const userEmails = new Set((list as UserRow[] | null)?.map(u => u.email?.toLowerCase()).filter(Boolean) ?? [])
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
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

  async function handleAdoptionMasterChange(masterId: string | null) {
    setSelectedMasterIdForAdoptions(masterId)
    if (authUser?.id) {
      await loadAssistantsAndAdoptions(masterId ?? authUser.id)
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
    if (!notificationTestTargetUserId) {
      setNotificationTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === notificationTestTargetUserId)
    if (!targetUser) {
      setNotificationTestError('Target user not found')
      return
    }
    setNotificationTestSending(template.template_type)
    setNotificationTestError(null)
    setNotificationTestSuccess(null)
    try {
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr) {
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
        body: {
          recipient_user_id: notificationTestTargetUserId,
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
          subject: 'Workflow stage rejected: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" that you completed has been rejected.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nRejection reason: {{rejection_reason}}\n\nView the workflow: {{workflow_link}}',
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
    if (!testingTemplate || !authUser?.email) return
    
    setTestSending(true)
    setTestError(null)
    
    // Ensure we have an active session with a valid JWT
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      setTestError('Not authenticated. Please sign in again.')
      setTestSending(false)
      return
    }
    
    const userEmail = authUser.email
    
    // Replace variables with test data
    const testVariables: Record<string, string> = {
      name: 'Test User',
      email: userEmail,
      role: 'assistant',
      link: 'https://example.com/test-link',
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'John Doe',
      workflow_link: 'https://example.com/workflow',
      previous_stage_name: 'Previous Stage',
      rejection_reason: 'Test rejection reason',
    }
    
    const { subject, body } = replaceTemplateVariables(testingTemplate, testVariables)
    
    // Call test email function
    // Note: Supabase client automatically includes JWT from current session
    const { data, error: eFn } = await supabase.functions.invoke('test-email', {
      body: {
        to: userEmail,
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
      alert(`Test email sent to ${userEmail}!\n\nSubject: ${subject}\n\nBody:\n${body}`)
      setTestingTemplate(null)
    }
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
    if (myRole === 'dev') {
      loadArTotalAndPinnedUsers()
      loadSupplyHousesAPTotalAndPinnedUsers()
      loadCostMatrixPinnedUsers()
    }
  }, [myRole])

  const { total: costMatrixTotal } = useCostMatrixTotal(myRole === 'dev')

  // Default notification test target: current user if in list, else first user
  useEffect(() => {
    if (myRole !== 'dev' || users.length === 0) return
    setNotificationTestTargetUserId((prev) => {
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
    const { data, error: eRpc } = await supabase.rpc('claim_dev_with_code', { code_input: code.trim() })
    setCodeSubmitting(false)
    if (eRpc) {
      setCodeError(eRpc.message)
      return
    }
    if (data) {
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
    setEditEstimatorServiceTypeIds(u.role === 'estimator' ? (u.estimator_service_type_ids ?? []) : [])
    setEditError(null)
  }

  function cancelEditUser() {
    setEditingUserId(null)
    setEditEmail('')
    setEditName('')
    setEditEstimatorServiceTypeIds([])
    setEditError(null)
  }

  async function updateUserProfile(
    id: string,
    updates: { name: string; email: string; estimator_service_type_ids?: string[] | null },
    oldName?: string
  ) {
    setUpdatingId(id)
    setError(null)
    setEditError(null)
    const updatePayload: Record<string, unknown> = { name: updates.name, email: updates.email }
    if (updates.estimator_service_type_ids !== undefined) {
      updatePayload.estimator_service_type_ids = updates.estimator_service_type_ids?.length ? updates.estimator_service_type_ids : null
    }
    const { error: e } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
    if (e) {
      setEditError(e.message)
    } else {
      if (oldName != null && oldName.trim() !== updates.name.trim()) {
        await cascadePersonNameInPayTables(oldName, updates.name)
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, name: updates.name, email: updates.email, ...(updates.estimator_service_type_ids !== undefined ? { estimator_service_type_ids: updates.estimator_service_type_ids } : {}) }
            : u
        ),
      )
    }
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

    const updates: { name: string; email: string; estimator_service_type_ids?: string[] | null } = {
      name: trimmedName,
      email: trimmedEmail,
    }
    if (editingUser?.role === 'estimator') {
      updates.estimator_service_type_ids = editEstimatorServiceTypeIds.length > 0 ? editEstimatorServiceTypeIds : null
    }
    await updateUserProfile(editingUserId, updates, editingUser?.name)
    setEditingUserId(null)
    setEditEmail('')
    setEditName('')
    setEditEstimatorServiceTypeIds([])
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

  async function loginAsUser(u: UserRow) {
    setLoggingInAsId(u.id)
    setError(null)
    // Construct redirect URL - use the current origin to ensure it works in all environments
    const redirectTo = `${window.location.origin}/dashboard`
    const { data, error: eFn } = await supabase.functions.invoke('login-as-user', {
      body: { email: u.email, redirectTo },
    })
    setLoggingInAsId(null)
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
    const link = (data as { action_link?: string } | null)?.action_link
    if (!link) {
      setError('Could not get login link')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token && session?.refresh_token) {
      localStorage.setItem('impersonation_original', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }))
    }
    window.location.href = link
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

  function openDelete() {
    setDeleteOpen(true)
    setDeleteEmail('')
    setDeleteName('')
    setDeleteError(null)
  }

  function closeDelete() {
    setDeleteOpen(false)
  }

  function openDeleteReassign() {
    setDeleteReassignOpen(true)
    setDeleteReassignUserId('')
    setDeleteReassignNewMasterId('')
    setDeleteReassignCustomerCount(0)
    setDeleteReassignError(null)
  }

  function closeDeleteReassign() {
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

  async function handleDeleteReassign(e: React.FormEvent) {
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
    
    const userToDelete = users.find(u => u.id === deleteReassignUserId)
    if (!userToDelete) {
      setDeleteReassignError('User to delete not found')
      return
    }
    
    setDeleteReassignSubmitting(true)
    
    const { data, error: eFn } = await supabase.functions.invoke('delete-user', {
      body: { 
        email: userToDelete.email, 
        name: userToDelete.name,
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
    
    closeDeleteReassign()
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

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    setDeleteSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('delete-user', {
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
    closeDelete()
    await loadData()
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
    
    // Check in people table
    const { data: peopleData } = await supabase
      .from('people')
      .select('id, name')
    
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
    if (manualAddRole === 'estimator' && manualAddServiceTypeIds.length > 0) {
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

  if (loading) return <p>Loading…</p>
  if (error && !myRole) return <p style={{ color: '#b91c1c' }}>{error}</p>

  // For estimators with restrictions, only show approved service types in Material Part/Assembly Types
  const visibleServiceTypesForMaterials = myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : serviceTypes
  const canDeleteMaterialTypes = myRole === 'dev'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Your role: <strong>{myRole == null ? '—' : myRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {updatePrompt?.needRefresh && updatePrompt?.updateSW && (
            <button
              type="button"
              onClick={() => {
                updatePrompt.dismiss()
                updatePrompt.updateSW?.()
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Reload to update
            </button>
          )}
          <button type="button" onClick={handleSignOut} style={{ padding: '0.5rem 1rem' }}>
            Sign out
          </button>
          <button type="button" onClick={openPasswordChange} style={{ padding: '0.5rem 1rem' }}>
            Change password
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Fix app</h2>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
          If the app shows a white screen after an update (e.g. phone was open during deploy), open{' '}
          <a href="/fix-cache.html" style={{ color: '#2563eb', fontWeight: 500 }}>
            Fix app
          </a>{' '}
          to clear cached files and reload. Bookmark this link to use when the app won&apos;t load.
        </p>
      </div>

      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
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
      </div>

      {myRole === 'dev' && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin AR to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin AR total to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinARMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinARMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinARMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinARMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinARSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinARSaving || pinARMasterIds.size === 0}
              onClick={async () => {
                setPinARSaving(true)
                setPinARMessage(null)
                const total = arTotal ?? 0
                const item = { path: '/jobs', label: `AR | $${Math.round(total).toLocaleString('en-US')}`, tab: 'receivables' as const }
                const ids = Array.from(pinARMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinARSaving(false)
                if (errMsg) setPinARMessage({ type: 'error', text: errMsg })
                else {
                  loadArTotalAndPinnedUsers()
                  setPinARMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinARMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinARSaving || pinARMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinARSaving || pinARUnpinSaving}
              onClick={async () => {
                setPinARUnpinSaving(true)
                setPinARMessage(null)
                const { count, error } = await deletePinForPathAndTab('/jobs', 'receivables')
                setPinARUnpinSaving(false)
                if (error) setPinARMessage({ type: 'error', text: error.message })
                else {
                  loadArTotalAndPinnedUsers()
                  setPinARMessage({ type: 'success', text: `Unpinned AR for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinARMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: pinARSaving || pinARUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinARMessage && (
            <p style={{ color: pinARMessage.type === 'success' ? '#059669' : '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinARMessage.text}
            </p>
          )}
        </div>
      )}

      {myRole === 'dev' && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Supply Houses AP to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Pin Material Supply Houses AP total to a master or dev&apos;s dashboard so it appears on their Dashboard.
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
                const item = { path: '/materials', label: `Supply House AP | $${Math.round(total).toLocaleString('en-US')}`, tab: 'supply-houses' as const }
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
      )}

      {myRole === 'dev' && (
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
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
      )}

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
                  → they can manage stages but not see financials or private notes
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
            {testNotificationSuccess && (
              <p style={{ color: '#059669', margin: 0, fontSize: '0.875rem' }}>{testNotificationSuccess}</p>
            )}
            {testNotificationError && (
              <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.875rem' }}>{testNotificationError}</p>
            )}
          </div>
        )}
      </div>

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Default Labor Rate (dev)</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Set the default Labor rate ($/hr) used when adding a new labor job in Jobs → + Labor. Leave blank for no default.
          </p>
          <form onSubmit={saveDefaultLaborRate} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
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

          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Data backup (dev)</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Export projects (customers, projects, workflows, steps, line items, projections), materials (supply houses, parts, prices, assemblies, assembly items), or bids (bids, counts, takeoffs, cost estimates, pricing / price book, purchase orders and PO items) as JSON for backup. Files respect RLS. Export may take several minutes for large datasets and uses significant database resources.
          </p>
          {exportError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{exportError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={exportProjectsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportProjectsLoading ? 'Exporting…' : 'Export projects backup'}
            </button>
            <button
              type="button"
              onClick={exportMaterialsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#065f46', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportMaterialsLoading ? 'Exporting…' : 'Export materials backup'}
            </button>
            <button
              type="button"
              onClick={exportBidsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#7c2d12', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportBidsLoading ? 'Exporting…' : 'Export bids backup'}
            </button>
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Duplicate Materials</h3>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Find and delete duplicate material parts in the price book (matching names or 80%+ similarity).
          </p>
          <Link
            to="/duplicates"
            style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, textDecoration: 'none', fontWeight: 500, display: 'inline-block' }}
          >
            View Duplicate Materials
          </Link>

          <h3
            style={{
              marginTop: '2rem',
              marginBottom: maintenanceMaterialsPricesExpanded ? '0.5rem' : 0,
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onClick={() => setMaintenanceMaterialsPricesExpanded(prev => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setMaintenanceMaterialsPricesExpanded(prev => !prev)
              }
            }}
          >
            <span style={{ transform: maintenanceMaterialsPricesExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
            Maintenance: Materials prices
          </h3>
          {maintenanceMaterialsPricesExpanded && (
            <>
              <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
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
            </>
          )}
        </>
      )}

      {/* Inline Change Password form - toggled from header button */}
      {passwordChangeOpen && (
        <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem', padding: '1rem 0' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="current-password" style={{ display: 'block', marginBottom: 4 }}>Current password *</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="current-password"
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="new-password" style={{ display: 'block', marginBottom: 4 }}>New password *</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: 4 }}>Confirm new password *</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
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

      {myRole !== 'dev' && <p style={{ marginBottom: '1.5rem' }}>Only devs can manage user roles.</p>}

      {myRole === 'dev' && (
        <>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Set user class for everyone who has signed up. Only owners can change these.
          </p>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={openInvite} style={{ padding: '0.5rem 1rem' }}>
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} style={{ padding: '0.5rem 1rem' }}>
              Manually add user
            </button>
            <button type="button" onClick={openDelete} style={{ padding: '0.5rem 1rem' }}>
              Delete user
            </button>
            <button type="button" onClick={openDeleteReassign} style={{ padding: '0.5rem 1rem' }}>
              Delete User & Reassign Customers
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
                          onClick={() => loginAsUser(u)}
                          disabled={loggingInAsId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {loggingInAsId === u.id ? 'Redirecting…' : 'imitate'}
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
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types</div>
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
        </>
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

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Assistants</h2>
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
              : 'Adopt assistants to give them access to your customers and projects. Assistants can create projects and assign them to you. Assistants can not see private notes or financials.'}
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
        </>
      )}

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Share with other Master</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Share your customers and projects with another master. They will see your jobs with assistant-level access (cannot see private notes or financials).
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
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Pay Approved Masters</h2>
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
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>People Created by Me</h2>
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
                      {p.kind === 'assistant' ? 'Assistant' : p.kind === 'master_technician' ? 'Master Technician' : 'Subcontractor'}
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
                      {p.kind === 'assistant' ? 'Assistant' : p.kind === 'master_technician' ? 'Master Technician' : 'Subcontractor'}
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
        </>
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
                <label htmlFor="manual-password" style={{ display: 'block', marginBottom: 4 }}>Initial password *</label>
                <input
                  id="manual-password"
                  type="password"
                  value={manualAddPassword}
                  onChange={(e) => { setManualAddPassword(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
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
              {manualAddRole === 'estimator' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Service types (optional)</label>
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>Leave unchecked for access to all service types. Select specific types to restrict.</p>
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
            <h2 style={{ marginTop: 0 }}>Delete user</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Type the user&apos;s email and name exactly. Both must match to delete.
            </p>
            <form onSubmit={handleDelete}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="delete-name"
                  type="text"
                  value={deleteName}
                  onChange={(e) => { setDeleteName(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {deleteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={deleteSubmitting} style={{ color: '#b91c1c' }}>
                  {deleteSubmitting ? 'Deleting…' : 'Delete user'}
                </button>
                <button type="button" onClick={closeDelete} disabled={deleteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteReassignOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 500 }}>
            <h2 style={{ marginTop: 0 }}>Delete User & Reassign Customers</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Select a user to delete and a master to inherit their customers. 
              The user will be deleted after all customers are reassigned.
            </p>
            <form onSubmit={handleDeleteReassign}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-reassign-user" style={{ display: 'block', marginBottom: 4 }}>
                  User to delete *
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
                  onClick={closeDeleteReassign} 
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
                <label htmlFor="set-password-new" style={{ display: 'block', marginBottom: 4 }}>New password *</label>
                <input
                  id="set-password-new"
                  type="password"
                  value={setPasswordValue}
                  onChange={(e) => { setSetPasswordValue(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="set-password-confirm" style={{ display: 'block', marginBottom: 4 }}>Confirm password *</label>
                <input
                  id="set-password-confirm"
                  type="password"
                  value={setPasswordConfirm}
                  onChange={(e) => { setSetPasswordConfirm(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.5rem' }}
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

      <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
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

      {myRole === 'dev' && (
        <>
          {/* Notification Templates - collapsible, above Email Templates */}
          <div style={{ marginTop: '2rem' }}>
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
              <div style={{ padding: '1rem 0 0 0' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize push notification title and body shown to users. Use variables like {NOTIFICATION_VARIABLE_HINT}.
                </p>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label htmlFor="notification-test-target" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    Test target:
                  </label>
                  <select
                    id="notification-test-target"
                    value={notificationTestTargetUserId}
                    onChange={(e) => {
                      setNotificationTestTargetUserId(e.target.value)
                      setNotificationTestError(null)
                      setNotificationTestSuccess(null)
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
                    { type: 'stage_prior_rejected' as const, label: 'Stage rejected', description: 'Stage rejected, sent to prior assignee' },
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
                              disabled={!template || !notificationTestTargetUserId || !!notificationTestSending}
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
          <div style={{ marginTop: '2rem' }}>
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
              <div style={{ padding: '1rem 0 0 0' }}>
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
              { type: 'stage_prior_rejected' as const, label: 'Prior Stage Rejected', description: 'Sent to prior stage assignee when their stage is rejected' },
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
                    editingTemplate.template_type === 'stage_prior_rejected' ? 'Prior Stage Rejected' :
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
                      disabled={templateSaving || !templateSubject.trim() || !templateBody.trim()}
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

          {testingTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400 }}>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Send a test email to <strong>{authUser?.email || 'your account email'}</strong> with the template to verify it works. Variables will be replaced with test data.
                </p>
                <form onSubmit={sendTestEmail}>
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4, fontSize: '0.875rem' }}>
                    <div><strong>Template:</strong> {testingTemplate.template_type}</div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Subject:</strong> {testingTemplate.subject}</div>
                    <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Body Preview:</strong><br />{testingTemplate.body.substring(0, 200)}{testingTemplate.body.length > 200 ? '...' : ''}</div>
                  </div>
                  {testError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{testError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={testSending || !authUser?.email}>
                      {testSending ? 'Sending…' : 'Send Test Email'}
                    </button>
                    <button type="button" onClick={closeTestEmail} disabled={testSending}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
