/** Self-contained state + handlers for the Active Accounts management UI
 * (users table, invite / manual add / archive / archive+reassign / restore /
 * set-password / send-sign-in-email / convert-master). Lifted verbatim from
 * Settings.tsx so the same panel can render inline in Settings and inside the
 * app-level Active Accounts modal. `enabled` gates data loading (the modal only
 * loads while open); `onDataChanged` lets the host page refresh its own lists
 * after a successful mutation. */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth, type UserRole } from './useAuth'
import { useToastContext } from '../contexts/ToastContext'
import type { ServiceType, UserRow } from '../types/settingsRows'
import { cascadePersonNameInPayTables, getPersonNamesForUser } from '../lib/cascadePersonName'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type UseActiveAccountsManagementOptions = {
  enabled: boolean
  onDataChanged?: () => void
}

export function useActiveAccountsManagement({ enabled, onDataChanged }: UseActiveAccountsManagementOptions) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [users, setUsers] = useState<UserRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [archivedUsers, setArchivedUsers] = useState<UserRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('master_technician')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteServiceTypeIds, setInviteServiceTypeIds] = useState<string[]>([])
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
  const [archiveConfirmUser, setArchiveConfirmUser] = useState<UserRow | null>(null)
  const [archiveConfirmSubmitting, setArchiveConfirmSubmitting] = useState(false)
  const [archiveConfirmError, setArchiveConfirmError] = useState<string | null>(null)
  const [archiveConfirmCustomerCount, setArchiveConfirmCustomerCount] = useState<number | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSurvivorId, setMergeSurvivorId] = useState('')
  const [mergeAbsorbedId, setMergeAbsorbedId] = useState('')
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeSubmitting, setMergeSubmitting] = useState(false)
  const [mergePreview, setMergePreview] = useState<{
    moved: Record<string, number>
    warnings: string[]
  } | null>(null)
  const [restoreSubmitting, setRestoreSubmitting] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoringUserId, setRestoringUserId] = useState<string | null>(null)
  const [sendingSignInEmailId, setSendingSignInEmailId] = useState<string | null>(null)
  const [setPasswordUser, setSetPasswordUser] = useState<UserRow | null>(null)
  const [setPasswordValue, setSetPasswordValue] = useState('')
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('')
  const [setPasswordSubmitting, setSetPasswordSubmitting] = useState(false)
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editEstimatorServiceTypeIds, setEditEstimatorServiceTypeIds] = useState<string[]>([])
  const [editEstimatorProspectsAccess, setEditEstimatorProspectsAccess] = useState(false)
  const [editPrimaryServiceTypeIds, setEditPrimaryServiceTypeIds] = useState<string[]>([])
  const [editSuperintendentServiceTypeIds, setEditSuperintendentServiceTypeIds] = useState<string[]>([])
  const [editSubcontractorServiceTypeIds, setEditSubcontractorServiceTypeIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [convertMasterId, setConvertMasterId] = useState<string>('')
  const [convertNewMasterId, setConvertNewMasterId] = useState<string>('')
  const [convertNewRole, setConvertNewRole] = useState<'assistant' | 'subcontractor'>('assistant')
  const [convertAutoAdopt, setConvertAutoAdopt] = useState<boolean>(true)
  const [convertSubmitting, setConvertSubmitting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertMasterSectionOpen, setConvertMasterSectionOpen] = useState(false)
  const [convertSummary, setConvertSummary] = useState<string | null>(null)
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false)
  const [activeAccountsSectionOpen, setActiveAccountsSectionOpen] = useState(false)

  async function loadUsers() {
    const { data: list, error: eList } = await supabase
      .from('users')
      .select('id, email, name, role, last_sign_in_at, read_only, estimator_prospects_access, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids')
      .is('archived_at', null)
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
  }

  /** Refresh the panel's own data after a successful mutation, then let the host page refresh its lists. */
  async function reloadAfterMutation() {
    await Promise.all([loadUsers(), loadArchivedUsers()])
    onDataChanged?.()
  }

  const loadAll = useCallback(async () => {
    await Promise.all([loadUsers(), loadArchivedUsers(), loadServiceTypes()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  useEffect(() => {
    if (!enabled) return
    void loadAll()
  }, [enabled, loadAll])

  async function updateRole(id: string, role: UserRole) {
    setUpdatingId(id)
    setError(null)
    // 'controller' is live in the DB enum but the generated types are stale, hence the cast.
    const { error: e } = await supabase.from('users').update({ role: role as Exclude<UserRole, 'controller'> }).eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    }
    setUpdatingId(null)
  }

  async function updateReadOnly(id: string, readOnly: boolean) {
    setUpdatingId(id)
    setError(null)
    const { error: e } = await supabase.from('users').update({ read_only: readOnly }).eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, read_only: readOnly } : u)))
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
    setEditSubcontractorServiceTypeIds(
      u.role === 'subcontractor'
        ? (u.subcontractor_service_type_ids ?? [])
        : u.role === 'helpers'
          ? (u.helpers_service_type_ids ?? [])
          : [],
    )
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
      helpers_service_type_ids?: string[] | null
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
    if (updates.helpers_service_type_ids !== undefined) {
      updatePayload.helpers_service_type_ids = updates.helpers_service_type_ids?.length ? updates.helpers_service_type_ids : null
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
              ...(updates.helpers_service_type_ids !== undefined ? { helpers_service_type_ids: updates.helpers_service_type_ids } : {}),
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
      helpers_service_type_ids?: string[] | null
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
    if (editingUser?.role === 'helpers') {
      updates.helpers_service_type_ids = editSubcontractorServiceTypeIds.length > 0 ? editSubcontractorServiceTypeIds : null
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
    const { data, error: eFn } = await supabase.functions.invoke('send-sign-in-email', {
      body: { email: u.email, redirectTo },
    })
    setSendingSignInEmailId(null)
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
    showToast(`Sign-in email sent to ${u.email}`, 'success')
  }

  function openInvite() {
    setInviteOpen(true)
    setInviteEmail('')
    setInviteRole('master_technician')
    setInviteName('')
    setInviteServiceTypeIds([])
    setInviteError(null)
  }

  function closeInvite() {
    setInviteOpen(false)
  }

  async function handleInvite(e: FormEvent) {
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
    
    const body: Record<string, unknown> = {
      email: inviteEmail.trim(),
      role: inviteRole,
      name: trimmedName || undefined,
      redirectTo: `${window.location.origin}/accept-invite`,
    }
    if ((inviteRole === 'estimator' || inviteRole === 'subcontractor' || inviteRole === 'helpers') && inviteServiceTypeIds.length > 0) {
      body.service_type_ids = inviteServiceTypeIds
    }
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body,
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
    showToast(`Invite sent to ${inviteEmail.trim()}`, 'success')
    closeInvite()
    await reloadAfterMutation()
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

  async function handleManualAdd(e: FormEvent) {
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
    if ((manualAddRole === 'estimator' || manualAddRole === 'subcontractor' || manualAddRole === 'helpers') && manualAddServiceTypeIds.length > 0) {
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
    await reloadAfterMutation()
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

  async function handleArchive(e: FormEvent) {
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
    await reloadAfterMutation()
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

  async function handleArchiveReassign(e: FormEvent) {
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
    await reloadAfterMutation()
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
    await reloadAfterMutation()
  }

  function closeSetPassword() {
    setSetPasswordUser(null)
    setSetPasswordValue('')
    setSetPasswordConfirm('')
    setSetPasswordError(null)
  }

  async function handleSetPassword(e: FormEvent) {
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
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) {
      setSetPasswordSubmitting(false)
      setSetPasswordError('Not signed in. Please sign in again.')
      return
    }
    const { data, error: eFn } = await supabase.functions.invoke('set-user-password', {
      body: { user_id: setPasswordUser.id, password: setPasswordValue },
      headers: { Authorization: `Bearer ${token}` },
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

  async function handleConvertMaster(e: FormEvent) {
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
      await reloadAfterMutation()
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Unknown error converting master')
    } finally {
      setConvertSubmitting(false)
    }
  }

  async function loadArchivedUsers() {
    if (!authUser?.id) return
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role, archived_at, last_sign_in_at')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    setArchivedUsers((data as UserRow[]) ?? [])
  }

  // ---- Per-row Archive with confirm (Edit mode → Archive; same archive-user fn as the dialog)
  function openArchiveConfirm(u: UserRow) {
    setArchiveConfirmUser(u)
    setArchiveConfirmError(null)
    setArchiveConfirmCustomerCount(null)
    void (async () => {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('master_user_id', u.id)
      setArchiveConfirmCustomerCount(count ?? 0)
    })()
  }

  function closeArchiveConfirm() {
    setArchiveConfirmUser(null)
  }

  async function handleArchiveConfirm() {
    const u = archiveConfirmUser
    if (!u) return
    setArchiveConfirmError(null)
    setArchiveConfirmSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('archive-user', {
      body: { email: (u.email ?? '').trim(), name: (u.name ?? '').trim() },
    })
    setArchiveConfirmSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch {
          /* ignore */
        }
      }
      setArchiveConfirmError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setArchiveConfirmError(err)
      return
    }
    showToast(`${u.name || u.email} archived.`, 'success')
    setArchiveConfirmUser(null)
    cancelEditUser()
    await reloadAfterMutation()
  }

  // ---- Merge users (Active Accounts → Merge users; RPC merge_user_accounts via merge-users fn)
  function openMerge() {
    setMergeOpen(true)
    setMergeSurvivorId('')
    setMergeAbsorbedId('')
    setMergeError(null)
    setMergePreview(null)
  }

  function closeMerge() {
    setMergeOpen(false)
  }

  async function runMerge(dryRun: boolean) {
    if (!mergeSurvivorId || !mergeAbsorbedId) {
      setMergeError('Pick both accounts.')
      return
    }
    setMergeError(null)
    setMergeSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('merge-users', {
      body: {
        survivor_user_id: mergeSurvivorId,
        absorbed_user_id: mergeAbsorbedId,
        dry_run: dryRun,
      },
    })
    setMergeSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch {
          /* ignore */
        }
      }
      setMergeError(msg)
      return
    }
    const res = data as {
      success?: boolean
      error?: string
      dry_run?: boolean
      moved?: Record<string, number>
      warnings?: string[]
    } | null
    if (!res?.success) {
      setMergeError(res?.error || 'Merge failed.')
      return
    }
    if (dryRun) {
      setMergePreview({ moved: res.moved ?? {}, warnings: res.warnings ?? [] })
      return
    }
    showToast('Accounts merged.', 'success')
    setMergeOpen(false)
    await reloadAfterMutation()
  }

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

  useEffect(() => {
    if (deleteReassignUserId) {
      void loadCustomerCount(deleteReassignUserId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteReassignUserId])

  return {
    users,
    setUsers,
    error,
    setError,
    updatingId,
    setUpdatingId,
    serviceTypes,
    setServiceTypes,
    archivedUsers,
    setArchivedUsers,
    inviteOpen,
    setInviteOpen,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteName,
    setInviteName,
    inviteError,
    setInviteError,
    inviteSubmitting,
    setInviteSubmitting,
    inviteServiceTypeIds,
    setInviteServiceTypeIds,
    manualAddOpen,
    setManualAddOpen,
    manualAddEmail,
    setManualAddEmail,
    manualAddName,
    setManualAddName,
    manualAddRole,
    setManualAddRole,
    manualAddPassword,
    setManualAddPassword,
    manualAddServiceTypeIds,
    setManualAddServiceTypeIds,
    manualAddError,
    setManualAddError,
    manualAddSubmitting,
    setManualAddSubmitting,
    deleteOpen,
    setDeleteOpen,
    deleteEmail,
    setDeleteEmail,
    deleteName,
    setDeleteName,
    deleteError,
    setDeleteError,
    deleteSubmitting,
    setDeleteSubmitting,
    deleteReassignOpen,
    setDeleteReassignOpen,
    deleteReassignUserId,
    setDeleteReassignUserId,
    deleteReassignNewMasterId,
    setDeleteReassignNewMasterId,
    deleteReassignSubmitting,
    setDeleteReassignSubmitting,
    deleteReassignError,
    setDeleteReassignError,
    deleteReassignCustomerCount,
    setDeleteReassignCustomerCount,
    restoreSubmitting,
    setRestoreSubmitting,
    restoreError,
    setRestoreError,
    restoringUserId,
    setRestoringUserId,
    sendingSignInEmailId,
    setSendingSignInEmailId,
    setPasswordUser,
    setSetPasswordUser,
    setPasswordValue,
    setSetPasswordValue,
    setPasswordConfirm,
    setSetPasswordConfirm,
    setPasswordSubmitting,
    setSetPasswordSubmitting,
    setPasswordError,
    setSetPasswordError,
    editingUserId,
    setEditingUserId,
    editEmail,
    setEditEmail,
    editName,
    setEditName,
    editEstimatorServiceTypeIds,
    setEditEstimatorServiceTypeIds,
    editEstimatorProspectsAccess,
    setEditEstimatorProspectsAccess,
    editPrimaryServiceTypeIds,
    setEditPrimaryServiceTypeIds,
    editSuperintendentServiceTypeIds,
    setEditSuperintendentServiceTypeIds,
    editSubcontractorServiceTypeIds,
    setEditSubcontractorServiceTypeIds,
    editError,
    setEditError,
    convertMasterId,
    setConvertMasterId,
    convertNewMasterId,
    setConvertNewMasterId,
    convertNewRole,
    setConvertNewRole,
    convertAutoAdopt,
    setConvertAutoAdopt,
    convertSubmitting,
    setConvertSubmitting,
    convertError,
    setConvertError,
    convertMasterSectionOpen,
    setConvertMasterSectionOpen,
    convertSummary,
    setConvertSummary,
    archivedSectionOpen,
    setArchivedSectionOpen,
    activeAccountsSectionOpen,
    setActiveAccountsSectionOpen,
    updateRole,
    updateReadOnly,
    startEditUser,
    cancelEditUser,
    updateUserProfile,
    saveUserEdits,
    sendSignInEmail,
    openInvite,
    closeInvite,
    handleInvite,
    openManualAdd,
    closeManualAdd,
    handleManualAdd,
    openArchive,
    closeArchive,
    handleArchive,
    archiveConfirmUser,
    archiveConfirmSubmitting,
    archiveConfirmError,
    archiveConfirmCustomerCount,
    openArchiveConfirm,
    closeArchiveConfirm,
    handleArchiveConfirm,
    mergeOpen,
    mergeSurvivorId,
    setMergeSurvivorId,
    mergeAbsorbedId,
    setMergeAbsorbedId,
    mergeError,
    setMergeError,
    mergeSubmitting,
    mergePreview,
    setMergePreview,
    openMerge,
    closeMerge,
    runMerge,
    openArchiveReassign,
    closeArchiveReassign,
    loadCustomerCount,
    handleArchiveReassign,
    handleRestore,
    closeSetPassword,
    handleSetPassword,
    checkDuplicateName,
    handleConvertMaster,
    loadArchivedUsers,
    loadServiceTypes,
  }
}
